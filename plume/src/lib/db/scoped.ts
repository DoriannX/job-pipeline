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

import { and, eq, getTableColumns, type SQL } from "drizzle-orm";
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

export type ScopeOptions = {
  /** Identité opaque (cuid2) du tenant courant. */
  tenantId: string;
  /** Horloge injectée (jamais Date.now() en dur). */
  now: Clock;
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

/** Combine le filtre de tenant avec un `where` optionnel fourni par l'appelant. */
function scopedWhere(
  table: SQLiteTable,
  tenantId: string,
  where?: SQL,
): SQL | undefined {
  const tenant = eq(tenantColumn(table), tenantId);
  return where ? and(tenant, where) : tenant;
}

export type ScopedDb = {
  /** Identité opaque du tenant servi par cette porte. */
  readonly tenantId: string;
  /** Horloge injectée, ré-exposée pour la logique temporelle appelante. */
  readonly now: Clock;
  /** Lecture multi-lignes, filtrée par tenant. */
  findMany: <T extends SQLiteTable>(
    table: T,
    where?: SQL,
  ) => Promise<T["$inferSelect"][]>;
  /** Lecture d'une ligne (ou undefined), filtrée par tenant. */
  findFirst: <T extends SQLiteTable>(
    table: T,
    where?: SQL,
  ) => Promise<T["$inferSelect"] | undefined>;
  /** Insertion : `user_id` injecté automatiquement. Renvoie la/les ligne(s). */
  insert: <T extends SQLiteTable>(
    table: T,
    values: Omit<T["$inferInsert"], "userId"> | Omit<T["$inferInsert"], "userId">[],
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

    async findMany(table, where) {
      return db
        .select()
        .from(table)
        .where(scopedWhere(table, tenantId, where)) as Promise<
        (typeof table)["$inferSelect"][]
      >;
    },

    async findFirst(table, where) {
      const rows = await db
        .select()
        .from(table)
        .where(scopedWhere(table, tenantId, where))
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
  };
}

/**
 * Porte d'entrée canonique : `forUser(db, userId, now)`.
 * Équivaut à `scopedDb(db, { tenantId: userId, now })`.
 */
export function forUser(
  db: ScopableDb,
  userId: string,
  now: Clock,
): ScopedDb {
  return scopedDb(db, { tenantId: userId, now });
}
