// ZONE NEUTRE (domain/) — zéro infra, zéro env, zéro I/O.
// Le temps est une dépendance INJECTÉE partout dans le code (AR-6) : on ne lit
// l'horloge système qu'ici, via `systemClock`. Toute autre logique temporelle
// reçoit un `Clock` en paramètre pour rester testable et déterministe.

/** Horloge : renvoie un instant en epoch millisecondes. */
export type Clock = () => number;

/**
 * SEUL endroit du code autorisé à appeler `Date.now()`.
 * Partout ailleurs, on injecte un `Clock` (souvent `systemClock` en prod,
 * une horloge figée en test).
 */
export const systemClock: Clock = () => Date.now();

/** Lit l'instant courant d'une horloge injectée (sucre syntaxique lisible). */
export function now(clock: Clock): number {
  return clock();
}
