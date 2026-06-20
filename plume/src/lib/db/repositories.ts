// Repositories d'entités — ZONE AUTORISÉE (src/lib/db/**). C'est ICI, et seulement
// ici, qu'on touche au schéma Drizzle ; les features n'importent JAMAIS ni le schéma
// ni drizzle-orm (barrière ESLint n°1 / AR-2, AR-13). Un repository encapsule UNE
// table scopée et expose un petit contrat CRUD (create / list / get / update / remove),
// toutes opérations auto-scopées par `user_id` via la porte `scopedDb`.
//
// Le repository reçoit un `ScopedDb` INJECTÉ : il reste pur et testable (db en mémoire
// dans les tests, db serveur en prod). Aucune lecture d'env, aucun `auth()` ici.

import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import type { JournalSink, MutationRecord } from "./journal";
import { contacts, type ActionLogPrevState, type ContactHandles } from "./schema";
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
  /**
   * Crée (ou fusionne/réactive par dédup) un Contact. `journal` (copilote inc.4) est une SINK
   * optionnelle : fournie, la mutation s'exécute dans UNE transaction et l'entrée `action_log`
   * y est écrite ATOMIQUEMENT (l'`op` réelle — `created`/`merged`/`reactivated` — et le
   * `prevState` sont calculés ici, seul endroit qui les connaît). Absente ⇒ chemin hérité (UI
   * manuelle), non journalisé.
   */
  create: (data: ContactCreate, journal?: JournalSink) => Promise<Contact>;
  bulkCreate: (
    items: BulkCreateItem[],
    journal?: JournalSink,
  ) => Promise<BulkCreateResult>;
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
 * CŒUR de `create` extrait pour s'exécuter indifféremment sur la porte scopée OU sur un handle
 * transactionnel (`tx`) — c'est ce qui permet d'envelopper mutation + journal dans une seule
 * transaction (CAP-1). Renvoie le Contact ET la `MutationRecord` qui le décrit (l'`op` réelle et
 * le `prevState` à restaurer — calculés ICI, seul endroit qui connaît le verdict insert/merge/
 * reactivate). Comportement de la mutation strictement inchangé vs l'historique.
 */
async function createContactRow(
  db: ScopedDb,
  data: ContactCreate,
): Promise<{ contact: Contact; record: MutationRecord }> {
  const ts = now(db.now);
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
  const [inserted] = await db.insertIgnore(
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
  if (inserted) {
    // Ligne neuve : op `created`, pas de `prevState` (l'inverse est l'archivage).
    return {
      contact: inserted,
      record: { entityType: "contact", entityId: inserted.id, op: "created" },
    };
  }

  // Doublon : un contact à cette clé existe déjà chez ce tenant (ACTIF ou ARCHIVÉ).
  // On NE crée PAS un second contact (intention : fusionner). On le relit en INCLUANT
  // les archivés (sinon un doublon archivé serait invisible et la fusion impossible).
  const existing = await db.findFirst(
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
  //
  // CAPTURE `prevState` (CAP-3) : pour CHAQUE champ que la fusion va écraser, on garde sa
  // valeur ANTÉRIEURE — le rewind la restaure (jamais un re-archivage aveugle qui perdrait du
  // préexistant). `archivedAt` antérieur est capturé si la ligne était archivée (réactivation).
  const merge: Record<string, unknown> = { updatedAt: ts };
  const prevState: ActionLogPrevState = {};
  if (data.entreprise != null) {
    merge.entreprise = data.entreprise;
    prevState.entreprise = existing.entreprise;
  }
  if (data.canalPrefere != null) {
    merge.canalPrefere = data.canalPrefere;
    prevState.canalPrefere = existing.canalPrefere;
  }
  if (data.handles != null) {
    merge.handles = { ...(existing.handles ?? {}), ...data.handles };
    prevState.handles = existing.handles;
  }
  if (data.notes != null) {
    merge.notes = data.notes;
    prevState.notes = existing.notes;
  }
  if (data.dernierContactAt != null) {
    merge.dernierContactAt = data.dernierContactAt;
    prevState.dernierContactAt = existing.dernierContactAt;
  }
  const reactivated = existing.archivedAt != null;
  if (reactivated) {
    merge.archivedAt = null; // réactivation
    prevState.archivedAt = existing.archivedAt;
  }

  const [merged] = await db.update(contacts, merge, eq(contacts.id, existing.id));
  const contact = merged ?? existing;
  return {
    contact,
    record: {
      entityType: "contact",
      entityId: contact.id,
      // Réactivation prime sur fusion : son inverse restaure `archivedAt` (+ champs écrasés).
      op: reactivated ? "reactivated" : "merged",
      prevState,
    },
  };
}

/**
 * Construit le repository Contacts au-dessus d'une porte scopée.
 * Toutes les lectures/écritures sont déjà bornées au tenant par `scoped` ; on ajoute
 * juste, au `get/update/remove`, le prédicat `id = …` (la porte combine avec le tenant).
 */
export function contactsRepository(scoped: ScopedDb): ContactsRepository {
  return {
    async create(data, journal) {
      // Le corps s'exécute sur `db` = la porte scopée normale, OU le handle transactionnel
      // (`tx`) quand on journalise — pour que mutation + entrée `action_log` soient atomiques.
      const run = async (db: ScopedDb) => {
        const { contact, record } = await createContactRow(db, data);
        if (journal) await journal(db, record);
        return contact;
      };
      // Journalisé ⇒ tout-ou-rien dans une transaction (parité `markSent`). Sinon, chemin
      // hérité non transactionnel (saisie UI manuelle), au comportement strictement inchangé.
      return journal ? scoped.transaction(run) : run(scoped);
    },

    async bulkCreate(items, journal) {
      const run = async (db: ScopedDb) => {
        // Ajout rapide multiple (FR-34) : N entrées → N lignes, dédupliquées.
        // 1) Dédup INTRA-lot : on garde la 1ʳᵉ occurrence de chaque clé (les doublons
        //    au sein du collage ne doivent pas compter comme « créés »).
        // 2) Dédup VS EXISTANT : `onConflictDoNothing` sur l'index unique par tenant
        //    (user_id, dedup_key) ignore silencieusement les clés déjà présentes (AR-9).
        // Le compte-rendu se déduit du nombre de lignes réellement renvoyées (returning).
        const ts = now(db.now);
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

        const inserted = await db.insertIgnore(
          contacts,
          rows,
          [contacts.userId, contacts.dedupKey],
        );

        // RÉACTIVATION (parité avec `create()`) : parmi les clés en conflit (non insérées),
        // celles qui pointent un contact ARCHIVÉ sont DÉSARCHIVÉES. On RELIT d'abord ces
        // lignes archivées (includeArchived) pour CAPTURER leur `archivedAt` antérieur AVANT
        // de les désarchiver — c'est le `prevState` qui rend le rewind exact (CAP-3 : le
        // réactivé retourne à l'état archivé, pas un re-archivage aveugle).
        const insertedKeys = new Set(inserted.map((r) => r.dedupKey));
        const conflictedKeys = [...seen].filter((k) => !insertedKeys.has(k));
        let toRevive: Contact[] = [];
        if (conflictedKeys.length > 0) {
          toRevive = await db.findMany(
            contacts,
            and(
              inArray(contacts.dedupKey, conflictedKeys),
              isNotNull(contacts.archivedAt),
            ),
            undefined,
            { includeArchived: true },
          );
          if (toRevive.length > 0) {
            await db.update(
              contacts,
              { archivedAt: null, updatedAt: ts },
              inArray(
                contacts.id,
                toRevive.map((r) => r.id),
              ),
            );
          }
        }

        if (journal) {
          // Une entrée par mutation : chaque insertion = `created`, chaque réactivation =
          // `reactivated` avec le `archivedAt` antérieur à restaurer (LIFO au rewind).
          for (const row of inserted) {
            await journal(db, {
              entityType: "contact",
              entityId: row.id,
              op: "created",
            });
          }
          for (const row of toRevive) {
            await journal(db, {
              entityType: "contact",
              entityId: row.id,
              op: "reactivated",
              prevState: { archivedAt: row.archivedAt },
            });
          }
        }

        const created = inserted.length + toRevive.length;
        // « Fusionnés » = tout ce qui n'a pas donné lieu à une création/réactivation
        // (doublons intra-lot + collisions avec un actif). Ton neutre, pas une erreur.
        return { created, merged: requested - created };
      };

      return journal ? scoped.transaction(run) : run(scoped);
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
