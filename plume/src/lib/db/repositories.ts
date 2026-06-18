// Repositories d'entités — ZONE AUTORISÉE (src/lib/db/**). C'est ICI, et seulement
// ici, qu'on touche au schéma Drizzle ; les features n'importent JAMAIS ni le schéma
// ni drizzle-orm (barrière ESLint n°1 / AR-2, AR-13). Un repository encapsule UNE
// table scopée et expose un petit contrat CRUD (create / list / get / update / remove),
// toutes opérations auto-scopées par `user_id` via la porte `scopedDb`.
//
// Le repository reçoit un `ScopedDb` INJECTÉ : il reste pur et testable (db en mémoire
// dans les tests, db serveur en prod). Aucune lecture d'env, aucun `auth()` ici.

import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { contacts, type ContactHandles } from "./schema";
import type { ScopedDb } from "./scoped";
import { computeDedupKey } from "../domain/dedup";
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
  entreprise?: string | null;
  canalPrefere?: Canal | null;
  handles?: ContactHandles | null;
  notes?: string | null;
  dernierContactAt?: number | null;
  source?: Source;
  importedAt?: number | null;
  legalBasis?: string | null;
};

/**
 * Champs éditables d'un Contact (tous optionnels). `id`/`userId` jamais modifiables.
 * `archivedAt` est éditable ici (réactivation lors d'une fusion d'import) ; le geste
 * normal d'archivage passe néanmoins par `remove()`.
 */
export type ContactUpdate = Partial<ContactCreate> & {
  archivedAt?: number | null;
};

/** Entrée d'un ajout rapide multiple (story 2.2) : un nom requis, reste optionnel. */
export type BulkCreateItem = {
  nom: string;
  entreprise?: string | null;
  email?: string | null;
};

/** Compte-rendu d'un ajout rapide : N créés / N fusionnés (déjà présents). */
export type BulkCreateResult = {
  created: number;
  merged: number;
};

/** Contrat exposé par le repository Contacts (auto-scopé par tenant). */
export type ContactsRepository = {
  create: (data: ContactCreate) => Promise<Contact>;
  bulkCreate: (items: BulkCreateItem[]) => Promise<BulkCreateResult>;
  list: () => Promise<Contact[]>;
  /**
   * Lit un contact ACTIF par id (les archivés sont invisibles). `includeArchived`
   * vise aussi un archivé — réservé aux parcours de réactivation/fusion d'import.
   */
  get: (
    id: string,
    opts?: { includeArchived?: boolean },
  ) => Promise<Contact | undefined>;
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
      // Clé de dédup dérivée (zone neutre) : email du handle s'il existe, sinon
      // nom + entreprise normalisés (casse/accents insensibles). NOT NULL — calculable.
      const dedupKey = computeDedupKey({
        nom: data.nom,
        entreprise: data.entreprise,
        email: data.handles?.email,
      });
      // Création IDEMPOTENTE (AR-9) : même un ajout UNITAIRE dédup. « Michel » et
      // « michel » partagent la même `dedup_key` → on ne crée JAMAIS de doublon. Le
      // conflit sur l'index unique par tenant est silencieux (onConflictDoNothing).
      const [inserted] = await scoped.insertIgnore(
        contacts,
        {
          nom: data.nom,
          entreprise: data.entreprise ?? null,
          canalPrefere: data.canalPrefere ?? null,
          handles: data.handles ?? null,
          notes: data.notes ?? null,
          dernierContactAt: data.dernierContactAt ?? null,
          // `source` garde son défaut SQL ('manuel') si non fourni.
          ...(data.source ? { source: data.source } : {}),
          importedAt: data.importedAt ?? null,
          legalBasis: data.legalBasis ?? null,
          dedupKey,
          createdAt: ts,
          updatedAt: ts,
        },
        [contacts.userId, contacts.dedupKey],
      );
      if (inserted) return inserted;

      // Doublon : un contact à cette clé existe déjà chez ce tenant (ACTIF ou ARCHIVÉ).
      // On NE crée PAS un second contact (intention : fusionner). On le relit en INCLUANT
      // les archivés (sinon un doublon archivé serait invisible et la fusion impossible).
      const existing = await scoped.findFirst(
        contacts,
        eq(contacts.dedupKey, dedupKey),
        { includeArchived: true },
      );
      if (!existing) {
        // Course rarissime : la ligne en conflit a disparu entre l'insert et la relecture.
        // On le signale franchement plutôt que de masquer un `undefined` derrière un cast.
        throw new Error(
          "Conflit de dédup sans ligne existante (course concurrente).",
        );
      }

      // FUSION du re-ajout : on applique les champs FOURNIS (sans écraser par du vide —
      // un re-ajout minimal ne doit pas effacer les notes/handles existants) et, si la
      // ligne était archivée, on la RÉACTIVE. Les champs qui DÉTERMINENT la clé (nom,
      // entreprise/email) sont déjà équivalents par construction (même `dedupKey`), donc
      // la clé reste cohérente — on n'y touche pas.
      const merge: Record<string, unknown> = { updatedAt: ts };
      if (data.entreprise != null) merge.entreprise = data.entreprise;
      if (data.canalPrefere != null) merge.canalPrefere = data.canalPrefere;
      if (data.handles != null)
        merge.handles = { ...(existing.handles ?? {}), ...data.handles };
      if (data.notes != null) merge.notes = data.notes;
      if (data.dernierContactAt != null)
        merge.dernierContactAt = data.dernierContactAt;
      if (existing.archivedAt != null) merge.archivedAt = null; // réactivation

      const [merged] = await scoped.update(
        contacts,
        merge,
        eq(contacts.id, existing.id),
      );
      return merged ?? existing;
    },

    async bulkCreate(items) {
      // Ajout rapide multiple (FR-34) : N entrées → N lignes, dédupliquées.
      // 1) Dédup INTRA-lot : on garde la 1ʳᵉ occurrence de chaque clé (les doublons
      //    au sein du collage ne doivent pas compter comme « créés »).
      // 2) Dédup VS EXISTANT : `onConflictDoNothing` sur l'index unique par tenant
      //    (user_id, dedup_key) ignore silencieusement les clés déjà présentes (AR-9).
      // Le compte-rendu se déduit du nombre de lignes réellement renvoyées (returning).
      const ts = now(scoped.now);
      const seen = new Set<string>();
      const rows: Array<Omit<typeof contacts.$inferInsert, "userId">> = [];
      for (const item of items) {
        const dedupKey = computeDedupKey({
          nom: item.nom,
          entreprise: item.entreprise,
          email: item.email,
        });
        if (seen.has(dedupKey)) continue; // doublon intra-lot
        seen.add(dedupKey);
        rows.push({
          nom: item.nom,
          entreprise: item.entreprise ?? null,
          // Provenance 'rapide' : collage multiple (AR-9, AR-16).
          source: "rapide",
          // L'email collé alimente le handle e-mail (seule coordonnée connue ici).
          handles: item.email ? { email: item.email } : null,
          dedupKey,
          createdAt: ts,
          updatedAt: ts,
        });
      }

      const requested = items.length;
      if (rows.length === 0) {
        return { created: 0, merged: requested };
      }

      const inserted = await scoped.insertIgnore(
        contacts,
        rows,
        [contacts.userId, contacts.dedupKey],
      );

      // RÉACTIVATION (parité avec `create()`) : parmi les clés en conflit (non insérées),
      // celles qui pointent un contact ARCHIVÉ sont DÉSARCHIVÉES — re-coller/importer un
      // contact archivé le fait réapparaître (sinon il resterait invisible, en
      // contradiction avec « tu pourras le retrouver en le ré-ajoutant »).
      const insertedKeys = new Set(inserted.map((r) => r.dedupKey));
      const conflictedKeys = [...seen].filter((k) => !insertedKeys.has(k));
      let revivedCount = 0;
      if (conflictedKeys.length > 0) {
        const revived = await scoped.update(
          contacts,
          { archivedAt: null, updatedAt: ts },
          and(
            inArray(contacts.dedupKey, conflictedKeys),
            isNotNull(contacts.archivedAt),
          ),
        );
        revivedCount = revived.length;
      }

      const created = inserted.length + revivedCount;
      // « Fusionnés » = tout ce qui n'a pas donné lieu à une création/réactivation
      // (doublons intra-lot + collisions avec un actif). Ton neutre, pas une erreur.
      return { created, merged: requested - created };
    },

    async list() {
      // Soft-delete : la PORTE filtre déjà `archived_at IS NULL` pour cette table.
      return scoped.findMany(contacts);
    },

    async get(id, opts) {
      // Un contact archivé est traité comme absent (notFound côté page) : la porte le
      // masque par défaut. `includeArchived` (fusion d'import) lève ce masque.
      return scoped.findFirst(contacts, eq(contacts.id, id), opts);
    },

    async update(id, data) {
      // On ne touche que les champs fournis ; `updatedAt` est rafraîchi via l'horloge.
      // `id`/`userId` ne sont jamais dans `data` (le type ContactUpdate les exclut),
      // et l'historique (createdAt, dernierContactAt non fourni) reste intact.
      const set: Record<string, unknown> = { updatedAt: now(scoped.now) };
      if (data.nom !== undefined) set.nom = data.nom;
      if (data.entreprise !== undefined) set.entreprise = data.entreprise;
      if (data.canalPrefere !== undefined) set.canalPrefere = data.canalPrefere;
      if (data.handles !== undefined) set.handles = data.handles;
      if (data.notes !== undefined) set.notes = data.notes;
      if (data.dernierContactAt !== undefined)
        set.dernierContactAt = data.dernierContactAt;
      if (data.source !== undefined) set.source = data.source;
      if (data.importedAt !== undefined) set.importedAt = data.importedAt;
      if (data.legalBasis !== undefined) set.legalBasis = data.legalBasis;
      // Réactivation explicite (fusion d'import) : on autorise `archived_at` dans le set.
      if (data.archivedAt !== undefined) set.archivedAt = data.archivedAt;

      // Si un champ qui DÉTERMINE la clé de dédup change (nom, entreprise, email
      // des handles), on la recalcule à partir de la ligne courante fusionnée avec
      // les changements, pour garder l'index unique cohérent (AR-9). On lit la ligne
      // en INCLUANT les archivés (une fusion d'import peut viser un contact archivé).
      const touchesKey =
        data.nom !== undefined ||
        data.entreprise !== undefined ||
        data.handles !== undefined;
      if (touchesKey) {
        const current = await scoped.findFirst(contacts, eq(contacts.id, id), {
          includeArchived: true,
        });
        if (current) {
          const nom = data.nom ?? current.nom;
          const entreprise =
            data.entreprise !== undefined ? data.entreprise : current.entreprise;
          const email =
            data.handles !== undefined
              ? data.handles?.email
              : current.handles?.email;
          set.dedupKey = computeDedupKey({ nom, entreprise, email });
        }
      }

      const [row] = await scoped.update(contacts, set, eq(contacts.id, id));
      return row;
    },

    async remove(id) {
      // SOFT-DELETE (archivage) : on ne supprime JAMAIS la ligne — on pose `archived_at`.
      // L'histoire (messages, relances) est préservée ; le contact disparaît des lectures
      // (list/get filtrent les archivés). On n'archive qu'un contact ACTIF (idempotent).
      const ts = now(scoped.now);
      const [row] = await scoped.update(
        contacts,
        { archivedAt: ts, updatedAt: ts },
        and(eq(contacts.id, id), isNull(contacts.archivedAt)),
      );
      return row !== undefined;
    },
  };
}
