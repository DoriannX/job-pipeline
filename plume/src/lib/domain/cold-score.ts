// ZONE NEUTRE (domain/) — Score de FROIDEUR d'un lien, dérivé À LA LECTURE (FR-4).
// Zéro infra, zéro env, zéro I/O. JAMAIS stocké en base : la froideur se recalcule à
// chaque rendu à partir de `(dernier_contact_at, now)`. Le temps est INJECTÉ (AR-6) :
// aucun `Date.now()` ici — `now` arrive en paramètre (epoch ms).
//
// Bandes (FR-4) :
//   • jamais contacté  → dernier_contact_at === null
//   • frais  (fresh)   → écoulé  < 30 j
//   • tiède  (warm)    → 30 j ≤ écoulé ≤ 90 j
//   • froid  (cold)    → écoulé  > 90 j
// Bornes EXACTES : 29 j = frais, 30 j = tiède, 90 j = tiède, 91 j = froid.
//
// `ColdState` est la source de vérité du design-system (4 teintes d'avatar) — on le
// RÉUTILISE depuis les tokens, on ne le duplique pas.

import type { ColdState } from "@/design/tokens";

/** Un jour en millisecondes (unité des seuils ci-dessous). */
const JOUR_MS = 24 * 60 * 60 * 1000;

/** Seuils de froideur en JOURS (nommés, pas de magie dans le code). */
export const SEUIL_FRAIS_JOURS = 30; // < 30 j = frais ; ≥ 30 j bascule en tiède
export const SEUIL_FROID_JOURS = 90; // ≤ 90 j = tiède ; > 90 j bascule en froid

/**
 * Froideur d'un lien à l'instant `now`, dérivée du dernier contact.
 * @param dernierContactAt epoch ms du dernier contact, ou `null` si jamais contacté.
 * @param now epoch ms courant (horloge INJECTÉE — jamais `Date.now()` ici).
 */
export function coldness(
  dernierContactAt: number | null,
  now: number,
): ColdState {
  if (dernierContactAt === null) return "never";

  // Jours entiers écoulés (un contact « il y a 29,9 j » compte comme 29 j → frais).
  const joursEcoules = Math.floor((now - dernierContactAt) / JOUR_MS);

  if (joursEcoules < SEUIL_FRAIS_JOURS) return "fresh"; // < 30 j
  if (joursEcoules <= SEUIL_FROID_JOURS) return "warm"; // 30–90 j
  return "cold"; // > 90 j
}

// Ordre de TRI « les liens qui refroidissent en premier » : on met en tête ce qui
// demande de l'attention. Un lien JAMAIS contacté est le plus à risque (aucun lien
// encore tissé), puis le FROID (lien qui s'éteint), puis le TIÈDE, le FRAIS en dernier
// (relation chaude, rien à faire). Rang croissant = remonte dans la galerie.
const RANG_FROIDEUR: Record<ColdState, number> = {
  never: 0,
  cold: 1,
  warm: 2,
  fresh: 3,
};

/**
 * Rang de tri d'un état de froideur (plus PETIT = remonte en tête : « refroidit le
 * plus / demande le plus d'attention »). Ordre : never < cold < warm < fresh.
 */
export function coldnessRank(state: ColdState): number {
  return RANG_FROIDEUR[state];
}
