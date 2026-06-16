// Préférences LOCALES du Composeur (localStorage) — story 3.3.
//
// CLIENT-SAFE, sans dépendance serveur. Deux préférences :
//   1. le REGISTRE par défaut (Rapide/Soigné) global, qui survit aux ouvertures
//      (FR-14, NFR-5) — c'est le défaut d'un NOUVEAU brouillon ; un brouillon par-contact
//      garde son propre tone restauré (priorité au brouillon).
//   2. le flag « transparence API déjà vue » (FR-32, UX-DR21) : la micro-ligne « le texte
//      est envoyé à l'API Claude » ne s'affiche QU'UNE fois, à la 1re génération.
//
// SSR-safe : tout accès `window`/`localStorage` est gardé (le module peut être importé
// pendant un rendu serveur ; les lectures renvoient alors le défaut, sans planter).

import type { Tone } from "./generation";

const TONE_KEY = "plume.composer.tone";
const API_NOTICE_KEY = "plume.composer.apiNoticeSeen";

const TONES: readonly Tone[] = ["rapide", "soigne"];

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

/** Registre par défaut persistant. Haiku/Rapide par défaut (FR-14) si rien d'enregistré. */
export function getDefaultTone(): Tone {
  if (!hasStorage()) return "rapide";
  const v = window.localStorage.getItem(TONE_KEY);
  return v && (TONES as readonly string[]).includes(v) ? (v as Tone) : "rapide";
}

/** Mémorise le registre choisi comme nouveau défaut global. */
export function setDefaultTone(tone: Tone): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(TONE_KEY, tone);
  } catch {
    // Quota / mode privé : silencieux (la préférence est un confort, pas un invariant).
  }
}

/** La micro-ligne de transparence API a-t-elle déjà été vue ? */
export function hasSeenApiNotice(): boolean {
  if (!hasStorage()) return true; // pas de storage ⇒ on évite de la ré-afficher en boucle
  return window.localStorage.getItem(API_NOTICE_KEY) === "1";
}

/** Marque la micro-ligne de transparence API comme vue (one-time). */
export function markApiNoticeSeen(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(API_NOTICE_KEY, "1");
  } catch {
    // idem : silencieux.
  }
}
