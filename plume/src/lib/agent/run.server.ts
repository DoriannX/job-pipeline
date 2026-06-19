import "server-only";

// CŒUR SERVEUR du copilote (brainstorm Archi #3) : une seule porte tient la boucle
// tool-use. Le route handler reste « bête » (auth + validation + renvoie ce flux).
// La clé API ne quitte jamais le serveur. Wrapper analogue à `claude.server.ts`
// pour le composer : la route passe par CE module, jamais par le SDK IA nu.

import { streamText, stepCountIs, type ModelMessage } from "ai";

import { getAgentModel } from "./provider.server";
import { buildTools } from "./tools.server";

/** Message de conversation accepté à la frontière (façade simple pour la route). */
export type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Plafond de tours de la boucle tool-use (SÉCU #6 : retry-cap / loop-breaker).
 * Borne le coût et casse une boucle folle — l'agent rend la main proprement au
 * lieu de s'acharner. À durcir plus tard (détection « même tool + mêmes args »).
 */
const MAX_STEPS = 8;

/** Personnalité : coach prospection, mais contrôle des actions Plume (Stratégie #2). */
const SYSTEM_PROMPT = [
  "Tu es le copilote de Plume, un assistant spécialisé dans la prospection réseau.",
  "Tu peux consulter les contacts de l'utilisateur (queryContacts) et, à sa demande,",
  "peupler son réseau de contacts de TEST fabriqués (seedContacts) pour qu'il essaie l'app.",
  "Appuie chaque réponse factuelle sur les outils ; n'invente jamais de contacts.",
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
 * Lance la boucle tool-use pour un tenant et renvoie un flux texte (NDJSON-free,
 * `text/plain` streamé — suffisant pour le test curl du Checkpoint 1).
 *
 * `userId` vient de la session next-auth (jamais du client) → tous les tools sont
 * scopés à ce tenant (SÉCU #3). Peut lever `AgentConfigError` (clé absente) à la
 * construction : l'appelant l'attrape et renvoie une erreur douce.
 */
export function runAgentChat(opts: {
  userId: string;
  messages: ChatMessage[];
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
  const model = getAgentModel();

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages,
    tools: buildTools(opts.userId),
    stopWhen: stepCountIs(MAX_STEPS),
    // Une erreur SURVENANT EN PLEIN STREAM (provider 429/5xx, coupure, tool qui
    // jette) arrive APRÈS le renvoi de la Response : le try/catch de la route ne
    // peut plus la voir, et `toTextStreamResponse` ignore les events non-texte.
    // Sans ce hook, l'échec serait SILENCIEUX (flux tronqué). On le journalise au
    // minimum (l'erreur in-band côté client viendra avec l'UI / un UIMessageStream).
    onError: ({ error }) => {
      console.error("[agent] erreur en cours de stream :", error);
    },
  });

  return result.toTextStreamResponse();
}
