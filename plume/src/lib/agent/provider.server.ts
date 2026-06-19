import "server-only";

// ENCAPSULATION du provider LLM du copilote (Phase 1, brainstorm Archi #3/#4).
// Barrière « clé server-only » : le SDK IA (clé API) ne touche JAMAIS le client.
// Un SEUL endroit décide du modèle → swap dev/prod par env var (Archi #4).
//
// Décision provider : Vercel AI SDK multi-provider (cf. mémoire copilote-provider-decision).
//   - dev (défaut) : Gemini Flash, tier gratuit — on valide la PLOMBERIE de la boucle.
//   - prod (AGENT_PROVIDER=prod) : Claude Sonnet — qualité de raisonnement réelle.

import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/** Échec de configuration du copilote (clé absente, etc.). Message déjà « doux ». */
export class AgentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentConfigError";
  }
}

/** Modèle de prod : Sonnet (qualité de tool-calling réelle). */
const PROD_MODEL = "claude-sonnet-4-6";
/** Modèle de dev : Gemini Flash, gratuit (plomberie uniquement). */
const DEV_MODEL = "gemini-2.5-flash";

/**
 * Résout le modèle du copilote selon `AGENT_PROVIDER`. Échoue TÔT et PROPREMENT
 * si la clé du provider choisi est absente (plutôt qu'une erreur opaque en plein
 * stream). Les providers lisent leur clé dans l'env standard :
 *   - Google  → `GOOGLE_GENERATIVE_AI_API_KEY`
 *   - Anthropic → `ANTHROPIC_API_KEY` (déjà présent pour le composer)
 */
export function getAgentModel(): LanguageModel {
  // FAIL-CLOSED : seuls `prod` et `dev` (défaut si vide/absent) sont valides. Un
  // typo (`production`, `PROD`…) LÈVE plutôt que de retomber silencieusement sur le
  // modèle de dev en production.
  const provider = process.env.AGENT_PROVIDER || "dev";

  if (provider === "prod") {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AgentConfigError(
        "Copilote indisponible : clé API absente (ANTHROPIC_API_KEY).",
      );
    }
    return anthropic(PROD_MODEL);
  }

  if (provider === "dev") {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new AgentConfigError(
        "Copilote indisponible : clé API absente (GOOGLE_GENERATIVE_AI_API_KEY).",
      );
    }
    return google(DEV_MODEL);
  }

  throw new AgentConfigError(
    `Copilote mal configuré : AGENT_PROVIDER="${provider}" inconnu (attendu "prod" ou "dev").`,
  );
}
