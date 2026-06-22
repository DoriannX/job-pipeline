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
  /** Historique brut des échanges (FR-35), déjà sanitizé par l'action (parité seeds). */
  historique?: string | null;
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
  /**
   * Liste les contacts du tenant. Par défaut, seuls les ACTIFS (la porte filtre
   * `archived_at IS NULL`). `includeArchived` lève ce masque — réservé aux parcours de
   * résolution/fusion (story 7.6 : réactiver un homonyme archivé à clé `name:` divergente).
   */
  list: (opts?: { includeArchived?: boolean }) => Promise<Contact[]>;
  /**
   * Lit un contact ACTIF par id (les archivés sont invisibles). `includeArchived`
   * vise aussi un archivé — réservé aux parcours de réactivation/fusion d'import.
   */
  get: (
    id: string,
    opts?: { includeArchived?: boolean },
  ) => Promise<Contact | undefined>;
  /**
   * Met à jour les champs FOURNIS d'un contact (recalcule `dedupKey` si un champ-clé bouge).
   * `journal` (copilote — fusion par résolution de nom, story 7.6) est une SINK optionnelle :
   * fournie, la mutation s'exécute dans UNE transaction et l'entrée `action_log` (op `merged`,
   * ou `reactivated` si `archivedAt` repasse à `null` ; `prevState` = valeurs antérieures des
   * champs écrasés) y est écrite ATOMIQUEMENT → l'enrichissement devient rewindable (parité
   * `create`). Absente ⇒ chemin hérité non journalisé (UI manuelle, import, rewind), inchangé.
   */
  update: (
    id: string,
    data: ContactUpdate,
    journal?: JournalSink,
  ) => Promise<Contact | undefined>;
  /**
   * SOFT-DELETE (archivage) d'un contact ACTIF : pose `archived_at`, jamais de `DELETE`.
   * `journal` (copilote — archiveContact) est une SINK optionnelle : fournie, l'archivage
   * s'exécute dans UNE transaction et l'entrée `action_log` (op `archived`, `prevState =
   * {archivedAt: null}`) y est écrite ATOMIQUEMENT → l'archivage devient rewindable (l'inverse
   * DÉSARCHIVE). Absente ⇒ chemin hérité non journalisé (UI manuelle, inverse de `created` au
   * rewind). Idempotent : un contact déjà archivé ⇒ `false`, aucune écriture, aucune entrée.
   */
  remove: (id: string, journal?: JournalSink) => Promise<boolean>;
  /**
   * SOFT-DELETE EN BLOC (archivage) — version atomique de `remove` pour un LOT d'ids (copilote —
   * archiveContacts). Tout le lot s'archive dans UNE SEULE transaction (parité `bulkCreate`) :
   * un échec en cours de route ANNULE TOUT (rollback total), jamais d'archivage partiel. Chaque
   * ligne réellement archivée est journalisée (op `archived`, `prevState = {archivedAt: null}`)
   * sous le même `turnId` → tout le lot rewindable d'un geste. Renvoie le nombre d'archivages
   * EFFECTIFS (un id inconnu / déjà archivé ne compte pas, ne journalise rien). `journal` absente
   * ⇒ chemin non journalisé (toujours en bloc, mais sans entrées d'audit).
   */
  bulkRemove: (ids: string[], journal?: JournalSink) => Promise<number>;
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
      historique: data.historique ?? null,
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
  if (data.historique != null) {
    merge.historique = data.historique;
    prevState.historique = existing.historique;
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
 * CŒUR du soft-delete d'UN contact, extrait pour s'exécuter indifféremment sur la porte scopée OU
 * sur un handle transactionnel (`tx`). Partagé par `remove` (un id) et `bulkRemove` (un lot dans
 * UNE transaction) → la logique d'archivage + journal est écrite une seule fois. On n'archive
 * qu'un contact ACTIF (idempotent : déjà archivé ⇒ 0 ligne → `false`, aucune écriture, aucune
 * entrée — sinon le rewind « désarchiverait » à tort). `prevState = {archivedAt: null}` = l'état
 * AVANT (actif) → l'inverse restaure l'actif.
 */
async function archiveContactRow(
  db: ScopedDb,
  id: string,
  journal?: JournalSink,
): Promise<boolean> {
  const ts = now(db.now);
  const [row] = await db.update(
    contacts,
    { archivedAt: ts, updatedAt: ts },
    and(eq(contacts.id, id), isNull(contacts.archivedAt)),
  );
  if (row && journal) {
    await journal(db, {
      entityType: "contact",
      entityId: row.id,
      op: "archived",
      prevState: { archivedAt: null },
    });
  }
  return row !== undefined;
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

    async list(opts) {
      // Soft-delete : la PORTE filtre déjà `archived_at IS NULL` pour cette table.
      // `includeArchived` (résolution d'homonyme story 7.6) lève ce masque.
      return scoped.findMany(contacts, undefined, undefined, opts);
    },

    async get(id, opts) {
      // Un contact archivé est traité comme absent (notFound côté page) : la porte le
      // masque par défaut. `includeArchived` (fusion d'import) lève ce masque.
      return scoped.findFirst(contacts, eq(contacts.id, id), opts);
    },

    async update(id, data, journal) {
      // Construit le `set` (champs FOURNIS uniquement) et recalcule `dedupKey` si un champ-clé
      // bouge (nom/entreprise/email des handles). `db` = porte scopée normale OU handle
      // transactionnel (`tx`) quand on journalise. Renvoie aussi la ligne ANTÉRIEURE (lue
      // includeArchived pour capturer `archivedAt`) quand on en a besoin (clé ou journal).
      const applique = async (
        db: ScopedDb,
      ): Promise<{ row: Contact | undefined; current: Contact | undefined }> => {
        // On ne touche que les champs fournis ; `updatedAt` est rafraîchi via l'horloge.
        // `id`/`userId` ne sont jamais dans `data` (le type ContactUpdate les exclut),
        // et l'historique (createdAt, dernierContactAt non fourni) reste intact.
        const set: Record<string, unknown> = { updatedAt: now(db.now) };
        if (data.nom !== undefined) set.nom = data.nom;
        if (data.entreprise !== undefined) set.entreprise = data.entreprise;
        if (data.canalPrefere !== undefined) set.canalPrefere = data.canalPrefere;
        if (data.handles !== undefined) set.handles = data.handles;
        if (data.notes !== undefined) set.notes = data.notes;
        if (data.historique !== undefined) set.historique = data.historique;
        if (data.dernierContactAt !== undefined)
          set.dernierContactAt = data.dernierContactAt;
        if (data.source !== undefined) set.source = data.source;
        if (data.importedAt !== undefined) set.importedAt = data.importedAt;
        if (data.legalBasis !== undefined) set.legalBasis = data.legalBasis;
        // Réactivation explicite (fusion d'import) : on autorise `archived_at` dans le set.
        if (data.archivedAt !== undefined) set.archivedAt = data.archivedAt;

        // Si un champ qui DÉTERMINE la clé de dédup change (nom, entreprise, email des
        // handles), on la recalcule à partir de la ligne courante fusionnée avec les
        // changements (AR-9). On a aussi besoin de la ligne courante pour le `prevState`
        // journalisé → on la lit dès que la clé bouge OU que `journal` est fourni.
        const touchesKey =
          data.nom !== undefined ||
          data.entreprise !== undefined ||
          data.handles !== undefined;
        let current: Contact | undefined;
        if (touchesKey || journal) {
          current = await db.findFirst(contacts, eq(contacts.id, id), {
            includeArchived: true,
          });
          if (current && touchesKey) {
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

        const [row] = await db.update(contacts, set, eq(contacts.id, id));
        return { row, current };
      };

      // Chemin hérité NON journalisé (UI manuelle, import, rewind) : comportement inchangé.
      if (!journal) {
        const { row } = await applique(scoped);
        return row;
      }

      // Chemin JOURNALISÉ (copilote — fusion par résolution de nom, story 7.6) : mutation +
      // entrée `action_log` dans UNE transaction (parité `create`) → fusion rewindable.
      return scoped.transaction(async (db) => {
        const { row, current } = await applique(db);
        if (row && current) {
          // `prevState` = valeur ANTÉRIEURE de chaque champ écrasé (le rewind la restaure,
          // jamais un re-archivage aveugle — CAP-3). On capture les MÊMES champs que le merge
          // de `createContactRow` pour une journalisation strictement parallèle.
          const prevState: ActionLogPrevState = {};
          if (data.entreprise !== undefined) prevState.entreprise = current.entreprise;
          if (data.canalPrefere !== undefined)
            prevState.canalPrefere = current.canalPrefere;
          if (data.handles !== undefined) prevState.handles = current.handles;
          if (data.notes !== undefined) prevState.notes = current.notes;
          if (data.historique !== undefined) prevState.historique = current.historique;
          if (data.dernierContactAt !== undefined)
            prevState.dernierContactAt = current.dernierContactAt;
          // Réactivation = `archivedAt` repasse de non-null à null ; son inverse restaure
          // l'`archivedAt` antérieur. Sinon simple enrichissement = op `merged`.
          const reactivated = data.archivedAt === null && current.archivedAt != null;
          if (reactivated) prevState.archivedAt = current.archivedAt;
          await journal(db, {
            entityType: "contact",
            entityId: row.id,
            op: reactivated ? "reactivated" : "merged",
            prevState,
          });
        }
        return row;
      });
    },

    async remove(id, journal) {
      // SOFT-DELETE (archivage) : on ne supprime JAMAIS la ligne — on pose `archived_at`.
      // L'histoire (messages, relances) est préservée ; le contact disparaît des lectures
      // (list/get filtrent les archivés). On n'archive qu'un contact ACTIF (idempotent).
      //
      // `db` = porte scopée, OU handle transactionnel (`tx`) quand on journalise — pour rendre
      // l'archivage ET son entrée `action_log` atomiques (parité `createDraft`/`create`).
      const run = (db: ScopedDb) => archiveContactRow(db, id, journal);
      return journal ? scoped.transaction(run) : run(scoped);
    },

    async bulkRemove(ids, journal) {
      // ARCHIVAGE EN BLOC ATOMIQUE (copilote — archiveContacts) : tout le lot s'archive dans UNE
      // SEULE transaction (parité `bulkCreate`), au lieu de N transactions indépendantes. Un échec
      // en cours (DB/connexion) annule TOUT le lot (rollback total) → jamais d'archivage partiel
      // ni de compte erroné. Chaque ligne réellement archivée est journalisée sous le même
      // `turnId` → le lot entier reste rewindable d'un geste. Compte les archivages EFFECTIFS.
      const run = async (db: ScopedDb) => {
        let archived = 0;
        for (const id of ids) {
          if (await archiveContactRow(db, id, journal)) archived += 1;
        }
        return archived;
      };
      return journal ? scoped.transaction(run) : run(scoped);
    },
  };
}
