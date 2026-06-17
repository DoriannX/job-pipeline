import "server-only";

// SÉLECTION FEW-SHOT BORNÉE de la Voix (story 3.5, AR-7, NFR-1).
//
// STRATÉGIE NOMMÉE : « les N seeds les plus RÉCENTS ». La liste d'entrée est supposée
// déjà ORDONNÉE du plus récent au plus ancien (c'est l'ordre que rend `seedVoix.list()`).
// On en garde simplement les `max` premiers : le prompt few-shot est ainsi BORNÉ (jamais
// gonflé par un corpus qui grandit), ce qui protège la latence et le coût (NFR-1) tout en
// gardant la voix la plus actuelle (les anciens messages comptent moins).
//
// Pure et testable (zéro I/O, zéro état) ; `server-only` car elle vit dans le pipeline
// serveur de génération. Liste vide → `[]` → `buildFewShotBlock` retombe sur le ton
// NEUTRE (FR-16) : aucune sélection ne peut faire échouer la génération.
//
// FRONTIÈRE 3.6 : aujourd'hui la seule source de voix est `seed_voix`. En 3.6, le corpus
// s'étendra aux Messages ENVOYÉS (FR-17) ; cette stratégie restera le point de bornage —
// l'appelant lui passera la liste fusionnée (seeds + messages), déjà ordonnée.

/**
 * Plafond du nombre d'exemples few-shot injectés dans le prompt. Choisi à 5 : assez
 * pour capter un ton, assez bas pour borner le coût/latence (NFR-1, AR-7).
 */
export const MAX_FEW_SHOT = 5;

/**
 * Sélectionne les `max` seeds les plus RÉCENTS pour amorcer le few-shot.
 *
 * @param seeds textes de voix, supposés ordonnés du plus récent au plus ancien.
 * @param max   plafond (défaut `MAX_FEW_SHOT`) ; une valeur <= 0 renvoie `[]`.
 * @returns au plus `max` textes (les premiers de la liste) ; `[]` si vide → ton neutre.
 */
export function selectFewShot(
  seeds: readonly string[],
  max: number = MAX_FEW_SHOT,
): string[] {
  if (max <= 0) return [];
  return seeds.slice(0, max);
}
