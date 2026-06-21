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
//   - `tool-input-start` { toolCallId, toolName } → un outil DÉMARRE (chip « en cours ») ;
//   - `tool-output-available|*-error` { toolCallId } → l'outil a fini/échoué (chip clos) ;
//   - `error`      { errorText }               → fin TERMINALE douce (CAP-3) ;
//   - `abort`                                  → interruption serveur (timeout plateforme) ;
//   - `finish` / `message-metadata` { didWrite } → signal de sync (CAP-2).
// Les autres parts (start, tool-input-delta, step-*…) sont ignorées : le front affiche le
// NOM de l'outil (façon Claude), jamais la forme des arguments — il reste « bête ».
//
// CAP-2 (robustesse) : le SDK émet la part `finish` porteuse de `didWrite` MÊME quand le
// tour se clôt sur une erreur (`finishReason:"error"`). On dissocie donc le SIGNAL DE SYNC
// (`onWrite`, déclenché en fin de tour si une écriture a eu lieu, succès OU erreur) de la
// fin normale (`onDone`) : une mutation réellement commise reste reflétée même si la
// verbalisation casse en route.

/**
 * Requête d'un tour (Phase 3) : le client n'envoie QUE le nouveau message `user` + l'id du fil
 * (jamais l'historique `assistant` — le serveur est la source de vérité du contexte, CAP-3).
 * `conversationId === null` ⇒ 1er message d'un fil neuf (le serveur le crée et renvoie l'id).
 */
export type StreamCopiloteInput = {
  conversationId: string | null;
  message: string;
};

/** Un appel d'outil signalé par le flux (pour l'afficher en petit, façon Claude). */
export interface CopiloteToolEvent {
  /** Id unique de l'appel (corrèle début ↔ fin). */
  id: string;
  /** Nom technique du tool (`createContact`, `queryContacts`…). */
  name: string;
}

/** Callbacks de pilotage du flux (le composant tient la FSM et l'état du chat). */
export interface CopiloteCallbacks {
  /** Un fragment de texte est arrivé (à appendre dans la bulle assistant en cours). */
  onDelta: (text: string) => void;
  /** Un outil COMMENCE à s'exécuter (chip « en cours »). */
  onTool?: (event: CopiloteToolEvent) => void;
  /** Un outil a TERMINÉ (chip « fait » / « échec »). `error` si la sortie a échoué. */
  onToolDone?: (event: { id: string; error: boolean }) => void;
  /** Échec doux (réseau, 401/503, erreur ou interruption mid-stream). Message déjà « doux ». */
  onError: (message: string) => void;
  /** Le flux s'est terminé SANS erreur terminale (fin normale du tour). */
  onDone: () => void;
  /**
   * CAP-2 : le run a comporté ≥1 écriture. Appelé AU PLUS UNE FOIS, en fin de tour, que
   * celui-ci finisse normalement OU sur une erreur — le composant déclenche alors UN SEUL
   * `router.refresh()`. Absent ⇒ run read-only, aucune sync.
   *
   * inc.4 : reçoit le `turnId` du run (porté in-band à côté de `didWrite`) quand le serveur le
   * fournit — le popup le RETIENT en-session pour offrir le rewind humain sur ce tour.
   */
  onWrite?: (turnId?: string) => void;
  /**
   * Phase 3 (CAP-2/3) : id du fil persisté, porté in-band sur la part `finish`. Pour un fil NEUF
   * (création paresseuse au 1er message), c'est le SEUL canal du nouveau `conversationId` — le
   * popup le RETIENT puis le RENVOIE aux tours suivants. Appelé au plus une fois, en fin de tour.
   */
  onConversation?: (conversationId: string) => void;
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
  toolCallId?: unknown;
  toolName?: unknown;
  messageMetadata?: {
    didWrite?: unknown;
    turnId?: unknown;
    conversationId?: unknown;
  } | null;
};

/**
 * Lance un tour de copilote et pompe le flux. `signal` permet d'annuler (démontage).
 * Ne LÈVE jamais : toute issue passe par les callbacks.
 */
export async function streamCopilote(
  input: StreamCopiloteInput,
  callbacks: CopiloteCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    // Le serveur tient le contexte : on n'envoie QUE le nouveau message + l'id du fil (omis pour
    // un fil neuf — le serveur le crée et renvoie son id in-band).
    const body = input.conversationId
      ? { conversationId: input.conversationId, message: input.message }
      : { message: input.message };
    response = await fetch("/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
  // inc.4 : `turnId` du run, porté in-band à côté de `didWrite` (présent seulement si le run a
  // écrit). On le retient pour le passer à `onWrite` en fin de tour.
  let turnId: string | undefined;
  // Phase 3 : `conversationId` du fil, porté in-band sur la part `finish` (toujours présent). On
  // le retient pour le passer à `onConversation` en fin de tour (le popup le RETIENT/RENVOIE).
  let conversationId: string | undefined;
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
      case "tool-input-start": {
        // Un outil DÉMARRE : on l'affiche en petit (façon Claude). Le nom suffit ; le
        // front n'a pas à comprendre les arguments (il reste « bête »).
        if (
          typeof part.toolCallId === "string" &&
          typeof part.toolName === "string"
        ) {
          callbacks.onTool?.({ id: part.toolCallId, name: part.toolName });
        }
        break;
      }
      case "tool-output-available":
      case "tool-output-error":
      case "tool-input-error": {
        // Fin (ou échec) de l'outil → on clôt le chip correspondant.
        if (typeof part.toolCallId === "string") {
          callbacks.onToolDone?.({
            id: part.toolCallId,
            error: part.type !== "tool-output-available",
          });
        }
        break;
      }
      case "finish":
      case "message-metadata": {
        const flag = part.messageMetadata?.didWrite;
        if (typeof flag === "boolean" && flag) didWrite = true;
        const tid = part.messageMetadata?.turnId;
        if (typeof tid === "string" && tid.length > 0) turnId = tid;
        const cid = part.messageMetadata?.conversationId;
        if (typeof cid === "string" && cid.length > 0) conversationId = cid;
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

  // Phase 3 : on remonte d'ABORD le `conversationId` (le popup le retient/renvoie) — y compris
  // quand le tour s'est clos sur une erreur (le fil neuf existe quand même côté serveur).
  if (conversationId) callbacks.onConversation?.(conversationId);
  // CAP-2 : une écriture commise se reflète même si le tour s'est clos sur une erreur —
  // la part `finish` porte `didWrite` y compris quand `finishReason` vaut "error". inc.4 : on
  // transmet le `turnId` retenu pour que le popup offre le rewind sur ce tour.
  if (didWrite) callbacks.onWrite?.(turnId);
  // Fin NORMALE : seulement si aucune erreur/interruption terminale n'a clos le tour.
  if (!sawTerminalError) callbacks.onDone();
}
