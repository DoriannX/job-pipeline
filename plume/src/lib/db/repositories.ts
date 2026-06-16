// Repositories d'entités — ZONE AUTORISÉE (src/lib/db/**). C'est ICI, et seulement
// ici, qu'on touche au schéma Drizzle ; les features n'importent JAMAIS ni le schéma
// ni drizzle-orm (barrière ESLint n°1 / AR-2, AR-13). Un repository encapsule UNE
// table scopée et expose un petit contrat CRUD (create / list / get / update / remove),
// toutes opérations auto-scopées par `user_id` via la porte `scopedDb`.
//
// Le repository reçoit un `ScopedDb` INJECTÉ : il reste pur et testable (db en mémoire
// dans les tests, db serveur en prod). Aucune lecture d'env, aucun `auth()` ici.

import { eq } from "drizzle-orm";

import { contacts, type ContactHandles } from "./schema";
import type { ScopedDb } from "./scoped";
import type { Canal, Source } from "../domain/enums";
import { now } from "../domain/time";

/** Ligne Contact telle que lue en base (typée par le schéma). */
export type Contact = typeof contacts.$inferSelect;

/**
 * Données de création d'un Contact, frontière côté repository.
 * `userId` est IMPOSÉ par la porte (jamais fourni ici) ; `id` et les horodatages
 * sont posés par le repository via l'horloge injectée.
 */
export type ContactCreate = {
  nom: string;
  canalPrefere?: Canal | null;
  handles?: ContactHandles | null;
  notes?: string | null;
  dernierContactAt?: number | null;
  source?: Source;
  importedAt?: number | null;
  legalBasis?: string | null;
};

/** Champs éditables d'un Contact (tous optionnels). `id`/`userId` jamais modifiables. */
export type ContactUpdate = Partial<ContactCreate>;

/** Contrat exposé par le repository Contacts (auto-scopé par tenant). */
export type ContactsRepository = {
  create: (data: ContactCreate) => Promise<Contact>;
  list: () => Promise<Contact[]>;
  get: (id: string) => Promise<Contact | undefined>;
  update: (id: string, data: ContactUpdate) => Promise<Contact | undefined>;
  remove: (id: string) => Promise<boolean>;
};

/**
 * Construit le repository Contacts au-dessus d'une porte scopée.
 * Toutes les lectures/écritures sont déjà bornées au tenant par `scoped` ; on ajoute
 * juste, au `get/update/remove`, le prédicat `id = …` (la porte combine avec le tenant).
 */
export function contactsRepository(scoped: ScopedDb): ContactsRepository {
  return {
    async create(data) {
      const ts = now(scoped.now);
      const [row] = await scoped.insert(contacts, {
        nom: data.nom,
        canalPrefere: data.canalPrefere ?? null,
        handles: data.handles ?? null,
        notes: data.notes ?? null,
        dernierContactAt: data.dernierContactAt ?? null,
        // `source` garde son défaut SQL ('manuel') si non fourni.
        ...(data.source ? { source: data.source } : {}),
        importedAt: data.importedAt ?? null,
        legalBasis: data.legalBasis ?? null,
        createdAt: ts,
        updatedAt: ts,
      });
      return row;
    },

    async list() {
      return scoped.findMany(contacts);
    },

    async get(id) {
      return scoped.findFirst(contacts, eq(contacts.id, id));
    },

    async update(id, data) {
      // On ne touche que les champs fournis ; `updatedAt` est rafraîchi via l'horloge.
      // `id`/`userId` ne sont jamais dans `data` (le type ContactUpdate les exclut),
      // et l'historique (createdAt, dernierContactAt non fourni) reste intact.
      const set: Record<string, unknown> = { updatedAt: now(scoped.now) };
      if (data.nom !== undefined) set.nom = data.nom;
      if (data.canalPrefere !== undefined) set.canalPrefere = data.canalPrefere;
      if (data.handles !== undefined) set.handles = data.handles;
      if (data.notes !== undefined) set.notes = data.notes;
      if (data.dernierContactAt !== undefined)
        set.dernierContactAt = data.dernierContactAt;
      if (data.source !== undefined) set.source = data.source;
      if (data.importedAt !== undefined) set.importedAt = data.importedAt;
      if (data.legalBasis !== undefined) set.legalBasis = data.legalBasis;

      const [row] = await scoped.update(contacts, set, eq(contacts.id, id));
      return row;
    },

    async remove(id) {
      const removed = await scoped.delete(contacts, eq(contacts.id, id));
      return removed.length > 0;
    },
  };
}
