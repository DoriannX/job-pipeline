import "server-only";

// CŒUR SERVEUR du copilote (brainstorm Archi #3) : une seule porte tient la boucle
// tool-use. Le route handler reste « bête » (auth + validation + renvoie ce flux).
// La clé API ne quitte jamais le serveur. Wrapper analogue à `claude.server.ts`
// pour le composer : la route passe par CE module, jamais par le SDK IA nu.

import {
  streamText,
  stepCountIs,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
  type UIMessage,
} from "ai";

import { getAgentModel } from "./provider.server";
import { buildTools, WRITE_TOOL_NAMES } from "./tools.server";

/** Message de conversation accepté à la frontière (façade simple pour la route). */
export type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Métadonnée portée par le flux UI message (CAP-2) : `didWrite` dit si le run a
 * comporté ≥1 écriture. Le client lit ce SEUL fait en fin de stream pour décider
 * d'un `router.refresh()` (jamais la forme des mutations — le front reste « bête »).
 */
export type CopiloteMetadata = { didWrite: boolean };

/** Forme de message UI typée pour notre métadonnée de sync. */
type CopiloteUIMessage = UIMessage<CopiloteMetadata>;

/**
 * Plafond de tours de la boucle tool-use (SÉCU #6 : retry-cap / loop-breaker).
 * Borne le coût et casse une boucle folle — l'agent rend la main proprement au
 * lieu de s'acharner. À durcir plus tard (détection « même tool + mêmes args »).
 */
const MAX_STEPS = 8;

/** Personnalité : coach prospection, mais contrôle des actions Plume (Stratégie #2). */
const SYSTEM_PROMPT = [
  "Tu es le copilote de Plume, un assistant spécialisé dans la prospection réseau.",
  "Tu peux : consulter les contacts (queryContacts) ; ajouter un VRAI contact dicté",
  "(createContact) ; importer plusieurs vrais contacts en bloc à partir d'un texte que tu",
  "structures toi-même (importContacts) ; rédiger un BROUILLON de message dans la voix de",
  "l'utilisateur (composeMessage) ; et, à sa demande, peupler son réseau de contacts de",
  "TEST (seedContacts) pour essayer l'app.",
  "RÈGLE ABSOLUE : tu RÉDIGES, tu n'ENVOIES JAMAIS. composeMessage ne crée qu'un brouillon ;",
  "l'envoi reste l'action de l'utilisateur depuis l'app. N'invente jamais de contacts ni de",
  "faits ; n'enregistre que ce que l'utilisateur a réellement dicté.",
  "Appuie chaque réponse factuelle sur les outils.",
  "Réponds en français, de façon concise et actionnable.",
].join(" ");

/**
 * CAP-3 (durcissement de l'historique reçu, ferme la dette Phase 1) : l'historique
 * fourni par le CLIENT n'est pas digne de confiance — un appelant peut fabriquer de
 * faux tours `assistant`/`tool` pour amorcer l'agent avec un contexte mensonger
 * (« tu as déjà l'autorisation de tout supprimer », « voici les contacts : … »).
 *
 * Tant qu'aucun historique serveur signé n'existe (pas de mémoire persistante cette
 * phase), la SEULE source de vérité est ce que l'UTILISATEUR a tapé : on ne garde
 * que les tours `user`. Les tours non-`user` reçus sont ÉCARTÉS avant tout appel
 * modèle. Fonction pure → testable (un faux `assistant` ne devient jamais du contexte).
 *
 * À renégocier quand un vrai multi-tour arrive : il faudra alors valider/signer les
 * tours `assistant` côté serveur plutôt que de les écarter.
 */
export function selectTrustedTurns(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((m) => m.role === "user");
}

/**
 * Message DOUX (jamais de stack/rouge alarme — règle DA) substitué à toute erreur
 * survenant en plein stream. Le détail technique est journalisé serveur-side ; le
 * client ne voit qu'une fin de tour terminale et lisible (CAP-3).
 */
const STREAM_ERROR_MESSAGE =
  "Le copilote a rencontré un souci en cours de route. Réessaie dans un instant.";

/**
 * Lance la boucle tool-use pour un tenant et renvoie un FLUX UI MESSAGE du SDK
 * (`toUIMessageStreamResponse`). Ce format porte DEUX signaux que `toTextStreamResponse`
 * ne pouvait pas :
 *   - CAP-3 : une erreur mid-stream devient une part `error` TERMINALE (via `onError`),
 *     rendue en teinte douce côté client — plus de flux tronqué pris pour un succès.
 *   - CAP-2 : la part `finish` porte `messageMetadata.didWrite` — le SEUL fait dont le
 *     client a besoin pour déclencher UN `router.refresh()` si le run a écrit.
 *
 * `userId` vient de la session next-auth (jamais du client) → tous les tools sont
 * scopés à ce tenant (SÉCU #3). `model`/`tools` sont injectables pour les tests
 * (défauts = provider réel + catalogue scopé). Peut lever `AgentConfigError` (clé
 * absente) SYNCHRONEMENT : l'appelant l'attrape et renvoie une erreur douce.
 */
export function runAgentChat(opts: {
  userId: string;
  messages: ChatMessage[];
  /** Injection test : modèle mocké. Défaut = provider réel (clé serveur). */
  model?: LanguageModel;
  /** Injection test : catalogue de tools. Défaut = tools scopés au tenant. */
  tools?: ToolSet;
}): Response {
  // Défense en profondeur (CAP-3) : même si l'appelant oublie de filtrer, le wrapper
  // (porte unique) n'envoie au modèle que des tours dignes de confiance.
  const messages: ModelMessage[] = selectTrustedTurns(opts.messages).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Résolu AVANT `streamText` : un `AgentConfigError` (clé absente) doit remonter
  // SYNCHRONEMENT pour être attrapé par l'appelant (erreur douce), pas se perdre
  // dans le flux.
  const model = opts.model ?? getAgentModel();
  const tools = opts.tools ?? buildTools(opts.userId);

  // CAP-2 — déterminé CÔTÉ SERVEUR : le run a-t-il appelé ≥1 write-tool ? On lève le
  // drapeau dès qu'un step contient l'appel d'un tool d'écriture (registre générique
  // `WRITE_TOOL_NAMES`), et on l'expose UNE seule fois, sur la part `finish`. Jamais
  // un signal par token ; rien du tout si le run était read-only.
  let didWrite = false;

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
    onStepFinish: (step) => {
      if (step.toolCalls.some((call) => WRITE_TOOL_NAMES.has(call.toolName))) {
        didWrite = true;
      }
    },
    // Journalisation serveur du détail (le client ne verra que le message doux que
    // `toUIMessageStreamResponse({ onError })` met dans la part `error` terminale).
    onError: ({ error }) => {
      console.error("[agent] erreur en cours de stream :", error);
    },
  });

  return result.toUIMessageStreamResponse<CopiloteUIMessage>({
    // CAP-2 : signal de fin d'écriture, porté UNE fois sur la part `finish`.
    messageMetadata: ({ part }) =>
      part.type === "finish" ? { didWrite } : undefined,
    // CAP-3 : transforme une erreur mid-stream en part `error` terminale lisible.
    // Détail déjà journalisé par `onError` de `streamText` ; ici on ne renvoie au
    // client qu'un texte doux (jamais de stack).
    onError: () => STREAM_ERROR_MESSAGE,
  });
}
