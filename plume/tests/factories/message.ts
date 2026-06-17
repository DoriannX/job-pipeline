// Factory de test — construit une entrée `markSent` valide, surchargeable.
// Sert les tests d'envoi (story 3.6). Aucune dépendance infra : forme PLATE,
// alignée sur `MarkSentInput` du repository des Messages.

import type { MarkSentInput, MarkSentGeneration } from "@/lib/db";
import type { Canal } from "@/lib/domain/enums";

/** Données de génération plausibles (texte généré, versions, tokens) pour les tests. */
export function makeGeneration(
  overrides: Partial<MarkSentGeneration> = {},
): MarkSentGeneration {
  return {
    generated: "Bonjour Léa, ravi de te recontacter après tout ce temps.",
    rawIntent: "reprendre contact avec Léa",
    promptVersion: 1,
    modelId: "claude-haiku-4-5",
    voiceExamplesRef: [],
    sanitizeVersion: 1,
    tokens: { input: 120, output: 45 },
    ...overrides,
  };
}

/**
 * Construit une entrée `markSent`. Par défaut : un Message GÉNÉRÉ (avec génération).
 * Passer `generation: null` pour un Message tapé MAIN (aucun generation_events).
 */
export function makeMarkSent(
  contactId: string,
  overrides: Partial<MarkSentInput> = {},
): MarkSentInput {
  const canal: Canal = overrides.canal ?? "linkedin";
  return {
    contactId,
    canal,
    texte: "Bonjour Léa, ravi de te recontacter après tout ce temps.",
    generation: makeGeneration(),
    ...overrides,
  };
}
