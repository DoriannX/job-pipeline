// Type PARTAGÉ `GenerationEvent` — la frontière du moat, story 3.3 (AR-8).
//
// « Une frontière = un type, pas une ligne » : cet objet est PRODUIT EN MÉMOIRE à
// chaque génération réussie (3.3) et sera PERSISTÉ TRANSACTIONNELLEMENT À L'ENVOI
// en story 3.6 (jamais écrit ici). Il capture, dans le même événement, la qualité
// du moat (SM-1) ET le coût (tokens) — les deux faces de la même donnée (archi l.78).
//
// CLIENT-SAFE par construction : ce module ne dépend de RIEN de serveur (pas de
// `server-only`, pas du SDK, pas de db). La route serveur le construit et le renvoie
// dans le flux ; le client le conserve en state pour le passer à l'envoi (3.6). Le
// garder neutre permet aux DEUX côtés de la frontière de partager le MÊME type.

import type { Canal } from "@/lib/domain/enums";

/**
 * Registre de rédaction — pilote le choix de modèle. 3 paliers (story 7.7, F13) :
 * `rapide` (Haiku, défaut) < `equilibre` (Sonnet, compromis coût/qualité) < `soigne` (Opus).
 * Le choix est CONVERSATIONNEL côté copilote (arg `tone` de `composeMessage`) — plus de sélecteur
 * UI (le composeur one-shot est déprécié, story 7.2).
 */
export type Tone = "rapide" | "equilibre" | "soigne";

/**
 * Mode de génération (story 3.4) : `generate` met en forme une idée brute ; `improve`
 * retravaille en place un texte déjà écrit. Tracé sur l'event pour distinguer, a
 * posteriori, une génération d'une amélioration (le pipeline serveur est identique).
 */
export type GenerationMode = "generate" | "improve";

/**
 * RÈGLE UNIQUE « faut-il un texte d'entrée ? » (source de vérité partagée client+serveur) :
 *   - `improve` EXIGE un texte à retravailler ;
 *   - `generate` TOLÈRE un champ vide (produit un brouillon de prise de contact).
 * Le garde UI, le `refine` du schéma serveur et la branche du prompt s'appuient tous
 * dessus — une seule définition à faire évoluer, pas trois copies divergentes.
 */
export function ideaRequired(mode: GenerationMode): boolean {
  return mode === "improve";
}

/** Compteur de tokens d'une génération (borne la marge SaaS, archi l.77). */
export interface GenerationTokens {
  /** Tokens d'entrée (prompt) facturés — hors cache. */
  input: number;
  /** Tokens de sortie (texte généré). */
  output: number;
}

/**
 * Événement de génération — produit en mémoire à la fin d'un flux réussi.
 *
 * Champs versionnés (`promptVersion`, `modelId`, `sanitizeVersion`) =
 * reconstructibilité du moat : sans eux, l'historique de génération est
 * ininterprétable a posteriori (archi l.69, l.83). `voiceExamplesRef` trace QUELS
 * few-shots de voix ont alimenté le prompt (vide pour l'instant — corpus 3.5).
 */
export interface GenerationEvent {
  /** Texte généré APRÈS `sanitize()` (ce qui s'affiche / sera envoyé). */
  generatedText: string;
  /** Idée brute saisie par l'utilisateur (avant génération) — `raw_intent`. */
  rawIntent: string;
  /** Canal ciblé (LinkedIn / Email / WhatsApp / SMS) — pilote la longueur. */
  canal: Canal;
  /** Registre demandé — détermine le modèle. */
  tone: Tone;
  /** Mode de génération (`generate` | `improve`) — quelle recette a produit ce texte. */
  mode: GenerationMode;
  /** Id EXACT du modèle Claude qui a produit le texte (`claude-haiku-4-5` / `claude-opus-4-8`). */
  modelId: string;
  /** Version du prompt (système + few-shot + contraintes) ayant servi. */
  promptVersion: number;
  /** Version du nettoyage `sanitize()` appliqué au texte. */
  sanitizeVersion: number;
  /** Références des exemples de voix injectés (vide tant que le corpus 3.5 est vide). */
  voiceExamplesRef: string[];
  /** Tokens consommés (entrée/sortie) — coût + plafond free tier. */
  tokens: GenerationTokens;
}
