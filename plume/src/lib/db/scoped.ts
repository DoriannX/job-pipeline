// Porte de données SCOPÉE par tenant (invariant n°1 / AR-2, AR-13).
// SEUL accès légitime aux données : `db.forUser(userId)`. La db est INJECTÉE
// (testable), donc PAS de `server-only` ici.
//
// Pour toute table possédant une colonne SQL `user_id`, la porte :
//   - filtre AUTOMATIQUEMENT les lectures par `userId = tenantId` ;
//   - injecte AUTOMATIQUEMENT `userId = tenantId` à l'écriture.
// Aucune donnée d'un tenant n'est lisible/écrivable au nom d'un autre.
//
// Générique : marche pour toute future table scopée (contacts, messages, ...).

import { and, eq, getTableColumns, isNull, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";

import type { Clock } from "../domain/time";

// La porte est INDÉPENDANTE du schéma : elle accepte toute db libSQL (prod ou
// db de test). On n'importe donc PAS client.ts ici (ça tirerait le chemin
// serveur) — on s'appuie sur le type structurel de Drizzle.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ScopableDb = LibSQLDatabase<Record<string, any>>;

/** Nom SQL de la colonne de scoping tenant (convention du schéma). */
const TENANT_COLUMN = "user_id" as const;

/**
 * Nom SQL de la colonne de SOFT-DELETE (convention du schéma). Toute table qui la
 * porte voit ses LECTURES filtrer `archived_at IS NULL` par défaut : l'archivage est
 * une propriété de la PORTE (comme le tenant), pas un filtre à re-écrire dans chaque
 * repository. Une lecture qui veut quand même voir les archivés passe `includeArchived`.
 */
const ARCHIVED_COLUMN = "archived_at" as const;

export type ScopeOptions = {
  /** Identité opaque (cuid2) du tenant courant. */
  tenantId: string;
  /** Horloge injectée (jamais Date.now() en dur). */
  now: Clock;
};

/** Options d'une LECTURE scopée. */
export type ReadOptions = {
  /**
   * Inclure les lignes ARCHIVÉES (soft-delete). `false` par défaut : un archivé est
   * invisible. À mettre à `true` UNIQUEMENT pour les parcours qui doivent voir/ressusciter
   * un archivé (réactivation d'un re-ajout, résolution de fusion d'import).
   */
  includeArchived?: boolean;
};

/**
 * Localise la colonne de scoping (`user_id`) d'une table par son NOM SQL.
 * Robuste quel que soit le nom de propriété Drizzle choisi.
 * Lève si la table n'est pas scopable : on refuse de servir une table sans
 * frontière tenant plutôt que de fuiter (option la plus restrictive).
 */
function tenantColumn(table: SQLiteTable): SQLiteColumn {
  const columns = getTableColumns(table) as Record<string, SQLiteColumn>;
  const match = Object.values(columns).find((c) => c.name === TENANT_COLUMN);
  if (!match) {
    throw new Error(
      `Table non scopable : aucune colonne '${TENANT_COLUMN}'. ` +
        "La porte db.forUser ne sert que des tables scopées par tenant.",
    );
  }
  return match;
}

/**
 * Localise la colonne de soft-delete (`archived_at`) si la table en a une, sinon
 * `undefined`. Générique : aucune table-spécifique n'est codée en dur.
 */
function archivedColumn(table: SQLiteTable): SQLiteColumn | undefined {
  const columns = getTableColumns(table) as Record<string, SQLiteColumn>;
  return Object.values(columns).find((c) => c.name === ARCHIVED_COLUMN);
}

/** Combine le filtre de tenant avec un `where` optionnel fourni par l'appelant. */
function scopedWhere(
  table: SQLiteTable,
  tenantId: string,
  where?: SQL,
): SQL | undefined {
  const tenant = eq(tenantColumn(table), tenantId);
  return where ? and(tenant, where) : tenant;
}

/**
 * `where` de LECTURE : tenant + (sauf `includeArchived`) `archived_at IS NULL` pour les
 * tables soft-deletables, puis le `where` appelant. Centralise l'invariant « un archivé
 * est invisible » à la porte, pour TOUTES les lectures (AR-2 + soft-delete).
 */
function readWhere(
  table: SQLiteTable,
  tenantId: string,
  where: SQL | undefined,
  includeArchived: boolean,
): SQL | undefined {
  const parts: SQL[] = [eq(tenantColumn(table), tenantId)];
  if (!includeArchived) {
    const archived = archivedColumn(table);
    if (archived) parts.push(isNull(archived));
  }
  if (where) parts.push(where);
  return parts.length === 1 ? parts[0] : and(...parts);
}

export type ScopedDb = {
  /** Identité opaque du tenant servi par cette porte. */
  readonly tenantId: string;
  /** Horloge injectée, ré-exposée pour la logique temporelle appelante. */
  readonly now: Clock;
  /**
   * Lecture multi-lignes, filtrée par tenant (et `archived_at IS NULL` pour les tables
   * soft-deletables) ; tri optionnel. `includeArchived` lève le filtre d'archivage.
   */
  findMany: <T extends SQLiteTable>(
    table: T,
    where?: SQL,
    orderBy?: SQL | SQL[],
    opts?: ReadOptions,
  ) => Promise<T["$inferSelect"][]>;
  /**
   * Lecture d'une ligne (ou undefined), filtrée par tenant (et archivage par défaut).
   * `includeArchived` permet de viser une ligne archivée (ex. réactivation, fusion).
   */
  findFirst: <T extends SQLiteTable>(
    table: T,
    where?: SQL,
    opts?: ReadOptions,
  ) => Promise<T["$inferSelect"] | undefined>;
  /** Insertion : `user_id` injecté automatiquement. Renvoie la/les ligne(s). */
  insert: <T extends SQLiteTable>(
    table: T,
    values: Omit<T["$inferInsert"], "userId"> | Omit<T["$inferInsert"], "userId">[],
  ) => Promise<T["$inferSelect"][]>;
  /**
   * Insertion IDEMPOTENTE : `user_id` injecté, et les conflits sont SILENCIEUX
   * (`ON CONFLICT DO NOTHING`). Sert la dédup côté base (AR-9) : seules les lignes
   * réellement insérées sont renvoyées (`returning`), ce qui permet de compter
   * créés vs ignorés. Le `target` (colonnes du conflit) est obligatoire pour viser
   * l'index unique voulu (ex. l'index par tenant `(user_id, dedup_key)`).
   */
  insertIgnore: <T extends SQLiteTable>(
    table: T,
    values: Omit<T["$inferInsert"], "userId"> | Omit<T["$inferInsert"], "userId">[],
    target: SQLiteColumn | SQLiteColumn[],
  ) => Promise<T["$inferSelect"][]>;
  /** Mise à jour, bornée au tenant. Renvoie la/les ligne(s) modifiée(s). */
  update: <T extends SQLiteTable>(
    table: T,
    set: Partial<T["$inferInsert"]>,
    where?: SQL,
  ) => Promise<T["$inferSelect"][]>;
  /** Suppression, bornée au tenant. Renvoie la/les ligne(s) supprimée(s). */
  delete: <T extends SQLiteTable>(
    table: T,
    where?: SQL,
  ) => Promise<T["$inferSelect"][]>;
  /**
   * Porte TRANSACTIONNELLE scopée (AR-8) : exécute `fn` dans UNE transaction Drizzle,
   * en lui passant une porte scopée AU MÊME TENANT (le `user_id` reste borné à
   * l'intérieur de la transaction). Si `fn` lève — ou si une écriture échoue —, la
   * transaction est ANNULÉE (rollback total) : aucune écriture partielle ne subsiste.
   *
   * C'est le socle de l'écriture atomique « message figé + generation_events » (SM-1) :
   * les deux insertions et la mise à jour du contact réussissent ENSEMBLE ou pas du tout.
   */
  transaction: <T>(fn: (tx: ScopedDb) => Promise<T>) => Promise<T>;
};

/**
 * Construit la porte scopée pour un tenant donné, à partir d'une db injectée.
 * Toutes les opérations sont auto-scopées par `user_id`.
 */
export function scopedDb(
  db: ScopableDb,
  { tenantId, now }: ScopeOptions,
): ScopedDb {
  return {
    tenantId,
    now,

    async findMany(table, where, orderBy, opts) {
      const query = db
        .select()
        .from(table)
        .where(readWhere(table, tenantId, where, opts?.includeArchived ?? false));
      // Tri optionnel (ex. `desc(col)` pour « récent → ancien »). Sans tri, l'ordre
      // libSQL n'est pas garanti : on ne l'impose donc qu'à la demande de l'appelant.
      const ordered = orderBy
        ? query.orderBy(...(Array.isArray(orderBy) ? orderBy : [orderBy]))
        : query;
      return ordered as Promise<(typeof table)["$inferSelect"][]>;
    },

    async findFirst(table, where, opts) {
      const rows = await db
        .select()
        .from(table)
        .where(readWhere(table, tenantId, where, opts?.includeArchived ?? false))
        .limit(1);
      return rows[0] as (typeof table)["$inferSelect"] | undefined;
    },

    async insert(table, values) {
      // Le tenant est imposé : on écrase toute valeur user_id fournie.
      const list = Array.isArray(values) ? values : [values];
      const scoped = list.map((v) => ({
        ...(v as Record<string, unknown>),
        userId: tenantId,
      }));
      return db
        .insert(table)
        .values(scoped as (typeof table)["$inferInsert"][])
        .returning() as Promise<(typeof table)["$inferSelect"][]>;
    },

    async insertIgnore(table, values, target) {
      // Même injection de tenant que `insert`, mais en ignorant les conflits.
      const list = Array.isArray(values) ? values : [values];
      const scoped = list.map((v) => ({
        ...(v as Record<string, unknown>),
        userId: tenantId,
      }));
      return db
        .insert(table)
        .values(scoped as (typeof table)["$inferInsert"][])
        .onConflictDoNothing({ target })
        .returning() as Promise<(typeof table)["$inferSelect"][]>;
    },

    async update(table, set, where) {
      // On ne laisse jamais déplacer une ligne hors du tenant via `set`.
      const safeSet = { ...(set as Record<string, unknown>) };
      delete safeSet.userId;
      return db
        .update(table)
        .set(safeSet as Partial<(typeof table)["$inferInsert"]>)
        .where(scopedWhere(table, tenantId, where))
        .returning() as Promise<(typeof table)["$inferSelect"][]>;
    },

    async delete(table, where) {
      return db
        .delete(table)
        .where(scopedWhere(table, tenantId, where))
        .returning() as Promise<(typeof table)["$inferSelect"][]>;
    },

    async transaction(fn) {
      // On délègue à la transaction Drizzle de la db injectée, puis on RE-SCOPE le
      // handle transactionnel au MÊME tenant : à l'intérieur, toutes les opérations
      // restent bornées par `user_id`. Le `txDb` est un `LibSQLTransaction` ; il porte
      // la même surface structurelle (select/insert/update/delete/transaction) qu'une
      // db libSQL, mais son type Drizzle est distinct → cast SÛR vers `ScopableDb`
      // (on ne fait qu'utiliser les méthodes communes). Drizzle annule la transaction
      // si le callback rejette (rollback total) : l'atomicité moat tient (AR-8).
      return db.transaction(async (txDb) => {
        const txScoped = scopedDb(txDb as unknown as ScopableDb, {
          tenantId,
          now,
        });
        return fn(txScoped);
      });
    },
  };
}

/**
 * Porte scopée GÉNÉRIQUE à db injectée : `forUserDb(db, userId, now)`.
 * Équivaut à `scopedDb(db, { tenantId: userId, now })`.
 *
 * C'est la forme testable (db en mémoire fournie). En prod/serveur, on n'appelle
 * jamais cette fonction directement : on passe par la convenance `forUser(userId)`
 * de `db/server.ts` (qui câble la db serveur + l'horloge système + les repositories).
 */
export function forUserDb(
  db: ScopableDb,
  userId: string,
  now: Clock,
): ScopedDb {
  return scopedDb(db, { tenantId: userId, now });
}
