// Factory de test — construit une ligne `users` valide, surchargeable.
// L'id est un cuid2 opaque (jamais l'email). `created_at` injecté via une
// horloge figée (pas de Date.now() en dur dans les tests).

import { createId } from "@paralleldrive/cuid2";

// Le type vient du harnais (qui ré-exporte le schéma de prod) : on n'importe pas
// directement @/lib/db/schema hors de la porte / du harnais (barrière 1).
import type { testSchema } from "../db/harness";

type UserRow = (typeof testSchema)["users"]["$inferInsert"];
// `id` est optionnel à l'insert (default cuid2) mais la factory le pose TOUJOURS :
// on l'expose donc comme requis pour un usage ergonomique dans les tests.
type SeededUser = UserRow & { id: string };

let seq = 0;

/** Construit une ligne user de test (id cuid2 opaque, toujours présent). */
export function makeUser(overrides: Partial<UserRow> = {}): SeededUser {
  seq += 1;
  return {
    name: `Utilisateur ${seq}`,
    email: `user${seq}.${createId()}@example.test`,
    emailVerified: null,
    image: null,
    timezone: "Europe/Paris",
    voixTon: "neutre",
    createdAt: 1_700_000_000_000, // instant figé, déterministe
    ...overrides,
    // `id` posé APRÈS le spread : toujours un cuid2 opaque non-undefined.
    id: overrides.id ?? createId(),
  };
}
