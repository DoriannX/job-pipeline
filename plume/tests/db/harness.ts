// Harnais DB de test — db libSQL en mémoire, isolée par test.
//
// `makeTestDb()` applique les migrations Drizzle générées (dossier drizzle/) sur
// une base en mémoire fraîche, puis crée une petite table SCAFFOLDING de test
// `test_items` (scopée par `user_id`) pour exercer la porte générique tant que
// les vraies tables scopées (contacts, ...) n'existent pas encore.
//
// IMPORTANT : `test_items` n'existe QUE dans la db de test. Le schéma de prod
// (src/lib/db/schema.ts) reste à users + tables auth uniquement.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import * as prodSchema from "@/lib/db/schema";

/** Ré-export du schéma de prod pour les tests (qui ne l'importent pas en direct). */
export const { users, contacts } = prodSchema;

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

// --- Table SCAFFOLDING de test (n'existe pas en prod) -----------------------
// Représentative d'une table scopée : id + user_id + une donnée. Sert à prouver
// l'invariant cross-tenant sur la porte générique. À REMPLACER/ÉTENDRE par les
// vraies tables (contacts en 2.1, messages, ...) au fil des epics : le test
// cross-tenant doit couvrir CHAQUE table scopée.
export const testItems = sqliteTable("test_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  label: text("label").notNull(),
});

const DDL_TEST_ITEMS = `CREATE TABLE \`test_items\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`user_id\` text NOT NULL,
  \`label\` text NOT NULL
);`;

/** Schéma combiné prod + scaffolding, exposé au type Db de la porte. */
export const testSchema = { ...prodSchema, testItems };

export type TestDb = LibSQLDatabase<typeof testSchema>;

/** Découpe un fichier de migration Drizzle en instructions exécutables. */
function statementsOf(migrationSql: string): string[] {
  return migrationSql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Crée une db libSQL en mémoire isolée, applique les migrations générées, puis
 * ajoute la table scaffolding `test_items`. Idempotent : chaque appel = une db
 * distincte (nom unique en mémoire), donc des tests parfaitement isolables.
 */
export async function makeTestDb(): Promise<TestDb> {
  // Nom unique : chaque base ":memory:" nommée est indépendante.
  const client = createClient({ url: "file::memory:?cache=private" });
  const db = drizzle(client, { schema: testSchema });

  // Applique chaque migration générée, dans l'ordre du dossier drizzle/.
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const content = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of statementsOf(content)) {
      await db.run(sql.raw(statement));
    }
  }

  // Table scaffolding de test (hors schéma de prod).
  await db.run(sql.raw(DDL_TEST_ITEMS));

  return db;
}

/**
 * Insère des lignes `users` directement (chemin harnais, hors porte) afin de
 * satisfaire la FK `contacts.user_id → users.id`. Réservé au setup de test :
 * la porte `forUser` ne gère que les tables scopées, pas la table `users` elle-même.
 */
export async function seedUsers(
  db: TestDb,
  rows: (typeof prodSchema.users.$inferInsert)[],
): Promise<void> {
  await db.insert(prodSchema.users).values(rows);
}
