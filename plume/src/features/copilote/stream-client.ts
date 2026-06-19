// CLIENT du flux UI message de `/api/agent/chat` (copilote, incrément 2) — navigateur.
//
// CLIENT-SAFE et « front bête » : appelle `fetch("/api/agent/chat")` et lit le
// ReadableStream À LA MAIN. AUCUN import serveur ni SDK IA (barrière ESLint) — la clé
// API reste server-only, et le front n'embarque aucune logique métier : il ne fait que
// rendre le texte streamé et appliquer le SIGNAL de sync (`didWrite`).
//
// Format consommé : le flux UI message du SDK (`toUIMessageStreamResponse`), du SSE où
// chaque event est une ligne `data: <json>`. On ne traite que les quelques parts utiles
// à cet incrément :
//   - `text-delta` { delta }                  → texte de la réponse, appendu en direct ;
//   - `error`      { errorText }               → fin TERMINALE douce (CAP-3) ;
//   - `abort`                                  → interruption serveur (timeout plateforme) ;
//   - `finish` / `message-metadata` { didWrite } → signal de sync (CAP-2).
// Les autres parts (start, tool-*, step-*…) sont ignorées : le front n'a pas à comprendre
// la forme des actions de l'agent.
//
// CAP-2 (robustesse) : le SDK émet la part `finish` porteuse de `didWrite` MÊME quand le
// tour se clôt sur une erreur (`finishReason:"error"`). On dissocie donc le SIGNAL DE SYNC
// (`onWrite`, déclenché en fin de tour si une écriture a eu lieu, succès OU erreur) de la
// fin normale (`onDone`) : une mutation réellement commise reste reflétée même si la
// verbalisation casse en route.

/** Un tour de conversation envoyé au serveur (le serveur ne fait confiance qu'aux `user`). */
export type CopiloteTurn = { role: "user" | "assistant"; content: string };

/** Callbacks de pilotage du flux (le composant tient la FSM et l'état du chat). */
export interface CopiloteCallbacks {
  /** Un fragment de texte est arrivé (à appendre dans la bulle assistant en cours). */
  onDelta: (text: string) => void;
  /** Échec doux (réseau, 401/503, erreur ou interruption mid-stream). Message déjà « doux ». */
  onError: (message: string) => void;
  /** Le flux s'est terminé SANS erreur terminale (fin normale du tour). */
  onDone: () => void;
  /**
   * CAP-2 : le run a comporté ≥1 écriture. Appelé AU PLUS UNE FOIS, en fin de tour, que
   * celui-ci finisse normalement OU sur une erreur — le composant déclenche alors UN SEUL
   * `router.refresh()`. Absent ⇒ run read-only, aucune sync.
   */
  onWrite?: () => void;
}

const GENERIC_ERROR =
  "Le copilote est indisponible un court instant. Réessaie dans un moment.";
const ABORTED_MESSAGE =
  "Le tour a été interrompu avant la fin. Réessaie dans un instant.";

/** Part minimale du flux UI message qui nous intéresse (le reste est ignoré). */
type StreamPart = {
  type?: string;
  delta?: unknown;
  errorText?: unknown;
  messageMetadata?: { didWrite?: unknown } | null;
};

/**
 * Lance un tour de copilote et pompe le flux. `signal` permet d'annuler (démontage).
 * Ne LÈVE jamais : toute issue passe par les callbacks.
 */
export async function streamCopilote(
  messages: CopiloteTurn[],
  callbacks: CopiloteCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch {
    if (!signal?.aborted) callbacks.onError(GENERIC_ERROR);
    return;
  }

  // 401 / 400 / 503 sans flux : message doux (jamais de 500 brut / stack au client).
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
  let didWrite = false;
  // Une part TERMINALE (error/abort) a-t-elle clos le tour ? (CAP-3) → pas de `onDone`.
  let sawTerminalError = false;

  const handleLine = (rawLine: string) => {
    // SSE : on ne garde que les lignes de données (`data: …`). Les lignes de commentaire
    // (`:` keep-alive) ou de champ (`event:`/`id:`) sont ignorées. `trimEnd` absorbe le
    // `\r` d'un éventuel CRLF.
    const trimmed = rawLine.trimEnd();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;

    let part: StreamPart;
    try {
      part = JSON.parse(payload) as StreamPart;
    } catch {
      return; // ligne partielle/non-JSON : on ignore (le reste arrive)
    }

    switch (part.type) {
      case "text-delta": {
        if (typeof part.delta === "string" && part.delta.length > 0) {
          callbacks.onDelta(part.delta);
        }
        break;
      }
      case "error": {
        sawTerminalError = true;
        const text =
          typeof part.errorText === "string" && part.errorText.length > 0
            ? part.errorText
            : GENERIC_ERROR;
        callbacks.onError(text);
        break;
      }
      case "abort": {
        // Interruption serveur (ex. timeout plateforme) : fin terminale douce, jamais
        // présentée comme une réponse vide réussie.
        sawTerminalError = true;
        callbacks.onError(ABORTED_MESSAGE);
        break;
      }
      case "finish":
      case "message-metadata": {
        const flag = part.messageMetadata?.didWrite;
        if (typeof flag === "boolean" && flag) didWrite = true;
        break;
      }
      default:
        break; // start, tool-*, start-step, finish-step… : non pertinents pour le front
    }
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE : events séparés par `\n` (ou `\n\n`) ; on garde la dernière ligne partielle.
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) handleLine(line);
    }
    if (buffer.trim()) handleLine(buffer);
  } catch {
    // Coupure réseau / abort volontaire : remonté doux, sauf annulation explicite ou
    // erreur terminale déjà signalée.
    if (!signal?.aborted && !sawTerminalError) callbacks.onError(GENERIC_ERROR);
    return;
  }

  // CAP-2 : une écriture commise se reflète même si le tour s'est clos sur une erreur —
  // la part `finish` porte `didWrite` y compris quand `finishReason` vaut "error".
  if (didWrite) callbacks.onWrite?.();
  // Fin NORMALE : seulement si aucune erreur/interruption terminale n'a clos le tour.
  if (!sawTerminalError) callbacks.onDone();
}
