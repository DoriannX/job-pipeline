// CLIENT du flux NDJSON de `/api/composer` (story 3.3) — côté navigateur.
//
// CLIENT-SAFE : appelle `fetch("/api/composer")` et parse le ReadableStream. Aucun
// import serveur (la clé Claude reste server-only). Le protocole est documenté dans
// la route : une ligne JSON par event (`delta` | `done` | `error`).
//
// On expose une seule fonction `streamGeneration` qui prend des callbacks et résout
// quand le flux est terminé. Le composant pilote la FSM et le champ ; ce module ne fait
// QUE lire le réseau et découper le NDJSON.

import type { Canal } from "@/lib/domain/enums";
import type { GenerationEvent, GenerationMode, Tone } from "./generation";

/**
 * Corps POST attendu par la route. `mode` choisit la recette (story 3.4) :
 *   - `generate` : `idea` = idée brute à mettre en forme (story 3.3) ;
 *   - `improve`  : `idea` = message déjà écrit à retravailler en place.
 * Défaut `generate` (le serveur applique aussi ce défaut) — l'appel de génération
 * existant n'a rien à changer.
 */
export interface GenerateRequest {
  idea: string;
  canal: Canal;
  tone: Tone;
  mode?: GenerationMode;
}

/** Callbacks de pilotage du flux. */
export interface StreamCallbacks {
  /** Un delta de texte est arrivé (à appendre dans le champ en direct). */
  onDelta: (text: string) => void;
  /** Le flux s'est terminé OK : texte final sanitizé + GenerationEvent en mémoire. */
  onDone: (payload: {
    text: string;
    event: GenerationEvent;
    usage: { input: number; output: number };
  }) => void;
  /** Échec doux (IA indispo, erreur réseau, event `error`). Message déjà « doux ». */
  onError: (message: string) => void;
  /** Optionnel : le 1er delta est arrivé (pour annuler le timeout doux de 5 s). */
  onFirstDelta?: () => void;
}

/** Messages NDJSON possibles (miroir du protocole de la route). */
type StreamMessage =
  | { type: "delta"; text: string }
  | {
      type: "done";
      text: string;
      event: GenerationEvent;
      usage: { input: number; output: number };
    }
  | { type: "error"; message: string };

const GENERIC_ERROR = "La génération a échoué. Réessaie dans un instant.";

/**
 * Lance la génération et pompe le flux. `signal` permet d'annuler (régénérer/fermeture).
 * Ne lève jamais : toute erreur passe par `onError` (le champ reste éditable, FR-7).
 */
export async function streamGeneration(
  req: GenerateRequest,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let firstDeltaSeen = false;

  let response: Response;
  try {
    response = await fetch("/api/composer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `mode` vient de `req` (défaut `generate` côté serveur si absent) — on ne le
      // hardcode plus : Générer envoie `generate`, Améliorer envoie `improve`.
      body: JSON.stringify({ mode: "generate", ...req }),
      signal,
    });
  } catch {
    callbacks.onError(GENERIC_ERROR);
    return;
  }

  // 401 / 400 / 503 sans flux : message doux (le client ne montre jamais de 500 brut).
  if (!response.ok || !response.body) {
    callbacks.onError(
      response.status === 401
        ? "Session expirée. Reconnecte-toi puis réessaie."
        : GENERIC_ERROR,
    );
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handle = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg: StreamMessage;
    try {
      msg = JSON.parse(trimmed) as StreamMessage;
    } catch {
      return; // ligne partielle/corrompue : on ignore (le reste arrive)
    }
    if (msg.type === "delta") {
      if (!firstDeltaSeen) {
        firstDeltaSeen = true;
        callbacks.onFirstDelta?.();
      }
      callbacks.onDelta(msg.text);
    } else if (msg.type === "done") {
      callbacks.onDone({ text: msg.text, event: msg.event, usage: msg.usage });
    } else if (msg.type === "error") {
      callbacks.onError(msg.message || GENERIC_ERROR);
    }
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // NDJSON : on découpe sur `\n`, on garde la dernière ligne partielle en buffer.
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) handle(line);
    }
    // Flush d'une éventuelle dernière ligne sans `\n` final.
    if (buffer.trim()) handle(buffer);
  } catch {
    // Abort (régénérer/fermeture) ou coupure réseau : remonté doux, sauf si annulé
    // volontairement (le composant ignore alors via son propre garde).
    callbacks.onError(GENERIC_ERROR);
  }
}
