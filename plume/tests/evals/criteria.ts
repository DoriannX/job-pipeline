// CRITÈRES BINAIRES PURS de l'éval Voix (story 3.9). Réutilisables, déterministes,
// sans état ni horloge ni I/O. Trois critères, alignés sur la contrainte canal-aware
// du prompt (CONTRAINTE_CANAL dans src/lib/prompt.server.ts) et sur sanitize() (3.2) :
//
//   1. withinCanalTarget(text, canal) — longueur dans la cible du canal (FR-9) ;
//   2. hasNoTells(text)               — zéro Tell d'IA (réutilise hasTells de @/lib/copy) ;
//   3. (ton conservé)                 — traité par le runner comme l'égalité au golden
//                                       `expectedSanitized` (pas un helper ici : c'est une
//                                       comparaison exacte, vetée humainement à la création).
//
// Ces helpers ne DUPLIQUENT pas la logique applicative : `hasNoTells` s'appuie sur le
// VRAI `hasTells`, et `withinCanalTarget` encode la même règle que CONTRAINTE_CANAL.

import { hasTells } from "@/lib/copy";
import type { Canal } from "@/lib/domain/enums";

// ─── 1. Longueur dans la cible canal ─────────────────────────────────────────
//
// Heuristique de comptage de PHRASES — simple et DÉTERMINISTE (mêmes entrées →
// même compte, à chaque run). On compte les groupes terminés par une ponctuation
// forte `.`, `!`, `?` (éventuellement répétée : `?!`, `...`). Le « ... » terminal
// compte donc pour UNE phrase, pas trois. Un fragment final sans ponctuation compte
// pour une phrase s'il contient du texte.
//
// Règle PAR CANAL (alignée sur CONTRAINTE_CANAL) :
//   - linkedin : COURT, 2 à 4 phrases        → 1..4 phrases (borne haute = 4) ;
//   - whatsapp : TRÈS COURT, 1 à 2 phrases   → 1..2 phrases ;
//   - sms      : TRÈS COURT, 1 à 2 phrases   → 1..2 phrases ;
//   - email    : STRUCTURÉ (ouverture + corps + clôture) → ≥ 2 BLOCS/paragraphes,
//                séparés par une ligne blanche (les `\n\n` que sanitize() PRÉSERVE).
//                On ne borne pas l'email en phrases : sa cible est la STRUCTURE.
//
// Les bornes hautes (4 / 2) sont les régressions « longueur hors cible » qu'on veut
// attraper : si le pipeline rallonge un message court au-delà, l'eval échoue.

/** Cibles de longueur en NOMBRE DE PHRASES, par canal « court » (borne max incluse). */
const SENTENCE_TARGET: Partial<Record<Canal, { min: number; max: number }>> = {
  linkedin: { min: 2, max: 4 },
  whatsapp: { min: 1, max: 2 },
  sms: { min: 1, max: 2 },
  discord: { min: 1, max: 2 },
};

/** Nombre minimal de blocs/paragraphes pour un e-mail « structuré ». */
const EMAIL_MIN_BLOCKS = 2;

/**
 * Compte les phrases d'un texte de façon déterministe. On NORMALISE d'abord les
 * sauts de ligne en espaces (un saut de paragraphe ne crée pas de phrase en soi),
 * puis on scinde sur les runs de ponctuation forte. Une ponctuation forte RÉPÉTÉE
 * (`...`, `?!`) compte pour UNE seule frontière.
 *
 * LIMITE CONNUE (à garder en tête lors d'un RE-GEL du panier) : un `.` d'abréviation
 * (« M. Dupont ») ou de décimale (« 3.5 ») est compté comme une frontière de phrase.
 * Aucun cas gelé actuel n'en contient ; éviter ces formes dans un golden re-gelé pour
 * ne pas introduire un faux positif de longueur.
 */
export function countSentences(text: string): number {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length === 0) return 0;

  // Scinde APRÈS chaque run de `.!?`. Le `\s*` mange l'espace qui suit la frontière.
  const parts = flat.split(/[.!?]+\s*/);

  // Un fragment non vide = une phrase. Le split laisse un dernier élément vide si le
  // texte se termine par une ponctuation forte (ex. "Salut !" → ["Salut", ""]).
  return parts.filter((p) => p.trim().length > 0).length;
}

/**
 * Compte les BLOCS/paragraphes : segments séparés par une ligne blanche (`\n\n`+),
 * non vides. `sanitize()` (3.2) PRÉSERVE ces frontières de paragraphe, donc un e-mail
 * structuré (ouverture / corps / clôture) en compte au moins 2.
 */
export function countBlocks(text: string): number {
  return text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0).length;
}

/**
 * CRITÈRE 1 — la longueur de `text` tient dans la cible de `canal`.
 *   - canaux courts (linkedin/whatsapp/sms) : nombre de phrases dans [min, max] ;
 *   - email : au moins `EMAIL_MIN_BLOCKS` blocs (structure ouverture + corps/clôture).
 * Déterministe, booléen pur.
 */
export function withinCanalTarget(text: string, canal: Canal): boolean {
  if (canal === "email") {
    return countBlocks(text) >= EMAIL_MIN_BLOCKS;
  }
  const target = SENTENCE_TARGET[canal];
  if (!target) return false; // canal inconnu : pas dans la cible (sécurité).
  const n = countSentences(text);
  return n >= target.min && n <= target.max;
}

// ─── 2. Zéro Tell ────────────────────────────────────────────────────────────

/** Cadratin & cousins (em/en dash, barre horizontale) — Tells typographiques. */
const EM_DASH_AND_KIN = /[—–―]/;
/** Pictogrammes étendus + modificateurs de teinte + regional indicators (emojis). */
const PICTOGRAPHIC =
  /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}]/u;

/**
 * CRITÈRE 2 — `text` ne contient AUCUN Tell d'IA. On réutilise le VRAI `hasTells`
 * de @/lib/copy (cadratin/cousins, invisibles, emojis) ET on RE-ASSERTE explicitement
 * l'absence de cadratin et de `\p{Extended_Pictographic}` : double filet, pour que
 * l'éval échoue si un Tell réapparaît même si `hasTells` venait à régresser.
 */
export function hasNoTells(text: string): boolean {
  return (
    !hasTells(text) && !EM_DASH_AND_KIN.test(text) && !PICTOGRAPHIC.test(text)
  );
}
