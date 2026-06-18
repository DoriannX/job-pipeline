import "server-only";

// PIPELINE de génération du Composeur — la logique testable, extraite de la route.
//
// La route handler (`app/api/composer/route.ts`) est dure à tester unitairement
// (auth, ReadableStream, env). On en extrait ICI les deux opérations métier pures-ish :
//   1. la finalisation : texte brut → `sanitize()` + boucle re-valide bornée → texte propre ;
//   2. la construction de l'événement `GenerationEvent` en mémoire (AR-8).
// La route se contente d'orchestrer auth + flux + appel de ces fonctions.
//
// `server-only` : importe `sanitize` (server-only) ; appartient au serveur.

import { hasTells, sanitize, SANITIZE_VERSION, MAX_SANITIZE_RETRIES } from "@/lib/copy";
import type { Canal } from "@/lib/domain/enums";
import { PROMPT_VERSION } from "@/lib/prompt.server";
import type {
  GenerationEvent,
  GenerationMode,
  Tone,
} from "@/features/composer/generation";

/**
 * Nettoie le texte généré et RE-VALIDE en boucle bornée (archi l.293).
 *
 * `sanitize()` étant IDEMPOTENT, `hasTells(sanitize(x)) === false` : une seule passe
 * suffit toujours. La boucle bornée par `MAX_SANITIZE_RETRIES` est donc une SÉCURITÉ
 * (au cas où une évolution future de sanitize/hasTells les désynchroniserait) — jamais
 * un chemin chaud. On ne boucle JAMAIS sans borne.
 */
export function finalizeText(raw: string): string {
  let out = sanitize(raw);
  let attempts = 0;
  while (hasTells(out) && attempts < MAX_SANITIZE_RETRIES) {
    out = sanitize(out);
    attempts += 1;
  }
  return out;
}

/** Ingrédients de construction du `GenerationEvent` (tout vient déjà du serveur). */
export interface BuildEventInput {
  /** Texte BRUT renvoyé par le modèle (sera sanitizé ici). */
  rawText: string;
  /** Texte d'entrée (idée brute en `generate`, message à retravailler en `improve`). */
  idea: string;
  /** Canal ciblé. */
  canal: Canal;
  /** Registre demandé. */
  tone: Tone;
  /** Mode de génération (`generate` | `improve`). Défaut `generate` (compat 3.3). */
  mode?: GenerationMode;
  /** Id EXACT du modèle ayant produit le texte. */
  modelId: string;
  /** Références des exemples de voix injectés (vide tant que le corpus 3.5 est vide). */
  voiceExamplesRef: string[];
  /** Tokens consommés. */
  tokens: { input: number; output: number };
}

/**
 * Construit le `GenerationEvent` EN MÉMOIRE (jamais persisté ici — 3.6).
 *
 * Sanitize le texte (via `finalizeText`) puis renseigne les champs versionnés
 * (`promptVersion`, `sanitizeVersion`, `modelId`) qui rendent le moat reconstructible.
 * Retourne aussi à part le texte final (= `generatedText`) pour que la route le renvoie
 * dans l'event `done` sans le re-dériver.
 */
export function buildGenerationEvent(input: BuildEventInput): GenerationEvent {
  const generatedText = finalizeText(input.rawText);
  return {
    generatedText,
    // `rawIntent` = idée brute saisie. CHAÎNE VIDE ⟺ « Générer sans idée » (brouillon de
    // prise de contact) : c'est le marqueur naturel à exclure des analyses SM-1 d'écart
    // généré→envoyé, pour ne pas confondre « aucune idée » et une vraie idée utilisateur.
    rawIntent: input.idea,
    canal: input.canal,
    tone: input.tone,
    mode: input.mode ?? "generate",
    modelId: input.modelId,
    promptVersion: PROMPT_VERSION,
    sanitizeVersion: SANITIZE_VERSION,
    voiceExamplesRef: input.voiceExamplesRef,
    tokens: { input: input.tokens.input, output: input.tokens.output },
  };
}
