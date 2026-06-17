// Repository de la VOIX (seed) — ZONE AUTORISÉE (src/lib/db/**). C'est ICI, et seulement
// ici, qu'on touche au schéma Drizzle pour `seed_voix` ; les features n'importent JAMAIS
// ni le schéma ni drizzle-orm (barrière ESLint n°1 / AR-2, AR-13). Le repository encapsule
// la table scopée `seed_voix` et expose un petit contrat (create / list / remove), toutes
// opérations auto-scopées par `user_id` via la porte `scopedDb`.
//
// Le repository reçoit un `ScopedDb` INJECTÉ : il reste pur et testable (db en mémoire dans
// les tests, db serveur en prod). Aucune lecture d'env, aucun `auth()` ici. Le NETTOYAGE
// (`sanitize`, point unique AR-3) se fait À L'IMPORT, dans la server action — pas ici :
// le repository persiste le texte tel qu'on le lui donne (déjà sanitizé).

import { desc, eq } from "drizzle-orm";

import { seedVoix } from "./schema";
import type { ScopedDb } from "./scoped";
import { now } from "../domain/time";

/** Ligne `seed_voix` telle que lue en base (typée par le schéma). */
export type SeedVoix = typeof seedVoix.$inferSelect;

/** Contrat exposé par le repository de la Voix (auto-scopé par tenant). */
export type SeedVoixRepository = {
  /** Ajoute un seed (texte déjà sanitizé) ; `user_id` imposé par la porte. */
  create: (texte: string) => Promise<SeedVoix>;
  /** Liste les seeds du tenant, ORDONNÉS du plus récent au plus ancien. */
  list: () => Promise<SeedVoix[]>;
  /** Supprime un seed du tenant ; renvoie `true` si une ligne a été supprimée. */
  remove: (id: string) => Promise<boolean>;
};

/**
 * Construit le repository de la Voix au-dessus d'une porte scopée. Toutes les
 * lectures/écritures sont déjà bornées au tenant par `scoped` ; on ajoute juste le
 * tri (récent → ancien) au `list` et le prédicat `id = …` au `remove`.
 */
export function seedVoixRepository(scoped: ScopedDb): SeedVoixRepository {
  return {
    async create(texte) {
      const [row] = await scoped.insert(seedVoix, {
        texte,
        createdAt: now(scoped.now),
      });
      return row;
    },

    async list() {
      // Tri DESC sur `created_at` : les N plus récents bornent le few-shot (selectFewShot).
      return scoped.findMany(seedVoix, undefined, [desc(seedVoix.createdAt)]);
    },

    async remove(id) {
      const removed = await scoped.delete(seedVoix, eq(seedVoix.id, id));
      return removed.length > 0;
    },
  };
}
