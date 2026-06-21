// Harnais DB de test — db libSQL en mémoire, isolée par test.
//
// `makeTestDb()` applique les migrations Drizzle générées (dossier drizzle/) sur
// une base en mémoire fraîche, puis crée une petite table SCAFFOLDING de test
// `test_items` (scopée par `user_id`) pour exercer la porte générique tant que
// les vraies tables scopées (contacts, ...) n'existent pas encore.
//
// IMPORTANT : `test_items` n'existe QUE dans la db de test. Le schéma de prod
// (src/lib/db/schema.ts) reste à users + tables auth uniquement.

import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import * as prodSchema from "@/lib/db/schema";

/** Ré-export du schéma de prod pour les tests (qui ne l'importent pas en direct). */
export const {
  users,
  contacts,
  importJobs,
  mergeCandidates,
  seedVoix,
  messages,
  generationEvents,
  actionLog,
  conversations,
  chatMessages,
} = prodSchema;

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

// Dossiers temporaires créés par `makeTestDb`, nettoyés en bloc à la sortie du process
// de test (chaque db est jetable ; on évite d'accumuler des fichiers entre les runs).
const tempDirs: string[] = [];
let cleanupRegistered = false;
function registerCleanup(): void {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  process.on("exit", () => {
    for (const dir of tempDirs) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // Best-effort : un fichier déjà supprimé / verrouillé n'est pas une erreur de test.
      }
    }
  });
}

export type TestDb = LibSQLDatabase<typeof testSchema>;

/** Découpe un fichier de migration Drizzle en instructions exécutables. */
function statementsOf(migrationSql: string): string[] {
  return migrationSql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Crée une db libSQL ISOLÉE par appel, applique les migrations générées, puis ajoute
 * la table scaffolding `test_items`. Chaque appel = une db distincte (fichier temporaire
 * unique), donc des tests parfaitement isolables.
 *
 * POURQUOI un fichier temporaire et non `:memory:` : le client libSQL n'accepte le mode
 * en mémoire que sous le nom FIXE `:memory:` (`cache=private` le rend connection-privé,
 * `cache=shared` le partage entre TOUS les tests → isolation perdue). Or une TRANSACTION
 * Drizzle (story 3.6) crée une connexion distincte qui, en mode privé, ne voit pas les
 * tables. Un fichier temporaire unique résout les deux : isolation par fichier ET
 * visibilité transactionnelle inter-connexions. Le fichier est nettoyé au démontage.
 */
export async function makeTestDb(): Promise<TestDb> {
  // Dossier temporaire unique → fichier SQLite isolé, partagé entre connexions (tx OK).
  registerCleanup();
  const dir = mkdtempSync(path.join(tmpdir(), "plume-test-"));
  tempDirs.push(dir);
  const dbPath = path.join(dir, "test.db");
  const client = createClient({ url: `file:${dbPath}` });
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
