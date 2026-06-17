// Régression (revue story 2.2) : la migration 0002 doit s'appliquer sur une table
// `contacts` DÉJÀ PEUPLÉE (déploiement incrémental après 2.1), pas seulement sur une
// base vide. SQLite refuse un `ADD ... NOT NULL` nu sur une table avec des lignes ;
// 0002 utilise donc `DEFAULT ''` + backfill de `dedup_key` avant l'index unique.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient, type Client } from "@libsql/client";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../drizzle", import.meta.url));

function statementsOf(sqlText: string): string[] {
  return sqlText
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function apply(client: Client, file: string): Promise<void> {
  const content = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
  for (const statement of statementsOf(content)) {
    await client.execute(statement);
  }
}

describe("migration 0002 — rétro-compatible sur base peuplée", () => {
  it("s'applique sur des contacts 2.1 déjà présents (backfill dedup_key, index unique actif)", async () => {
    const client = createClient({ url: "file::memory:?cache=private" });
    const files = migrationFiles();

    // État 2.1 : on applique tout SAUF 0002 (contacts existe sans dedup_key/entreprise).
    for (const f of files.filter((f) => !f.startsWith("0002"))) {
      await apply(client, f);
    }

    // Données pré-existantes (créées par la saisie manuelle 2.1).
    await client.execute(
      "INSERT INTO users (id, timezone, voix_ton) VALUES ('u1','Europe/Paris','neutre')",
    );
    await client.execute(
      `INSERT INTO contacts (id, user_id, nom, source, handles) VALUES ('c1','u1','Alice','manuel','{"email":"ALICE@MAIL.com"}')`,
    );
    await client.execute(
      "INSERT INTO contacts (id, user_id, nom, source) VALUES ('c2','u1','Bob','manuel')",
    );

    // La migration NE DOIT PAS échouer (c'était le bug : ADD NOT NULL nu sur table peuplée).
    const m0002 = files.find((f) => f.startsWith("0002"));
    expect(m0002).toBeDefined();
    await apply(client, m0002!);

    // Backfill : clés non vides et distinctes (email pour Alice, nom pour Bob).
    const res = await client.execute(
      "SELECT id, dedup_key FROM contacts ORDER BY id",
    );
    const keys = res.rows.map((r) => String(r.dedup_key));
    expect(keys.every((k) => k.length > 0)).toBe(true);
    expect(new Set(keys).size).toBe(2);
    expect(keys).toContain("email:alice@mail.com");

    // L'index unique (user_id, dedup_key) est actif : un doublon de clé est rejeté.
    await expect(
      client.execute(
        "INSERT INTO contacts (id,user_id,nom,source,dedup_key) VALUES ('c3','u1','dup','manuel','email:alice@mail.com')",
      ),
    ).rejects.toThrow();
  });
});

describe("migration 0003 — rétro-compatible (CREATE TABLE only) sur base peuplée", () => {
  it("ajoute import_jobs / merge_candidates sans toucher aux contacts existants", async () => {
    const client = createClient({ url: "file::memory:?cache=private" });
    const files = migrationFiles();

    // État 2.4 : on applique tout SAUF 0003 (contacts déjà peuplé, dedup actif).
    for (const f of files.filter((f) => !f.startsWith("0003"))) {
      await apply(client, f);
    }
    await client.execute(
      "INSERT INTO users (id, timezone, voix_ton) VALUES ('u1','Europe/Paris','neutre')",
    );
    await client.execute(
      "INSERT INTO contacts (id, user_id, nom, source, dedup_key) VALUES ('c1','u1','Alice','manuel','name:alice|')",
    );

    // 0003 ne fait que des CREATE TABLE : aucune ALTER sur la table peuplée.
    const m0003 = files.find((f) => f.startsWith("0003"));
    expect(m0003).toBeDefined();
    await apply(client, m0003!);

    // Les contacts pré-existants sont intacts.
    const c = await client.execute("SELECT id, nom FROM contacts");
    expect(c.rows).toHaveLength(1);
    expect(String(c.rows[0].nom)).toBe("Alice");

    // Les nouvelles tables existent et sont utilisables.
    await client.execute(
      "INSERT INTO import_jobs (id, user_id, status) VALUES ('j1','u1','pending')",
    );
    await client.execute(
      "INSERT INTO merge_candidates (id, user_id, import_job_id, existing_contact_id, nom) VALUES ('m1','u1','j1','c1','Alice')",
    );
    const jobs = await client.execute("SELECT status FROM import_jobs");
    expect(String(jobs.rows[0].status)).toBe("pending");
    const cands = await client.execute(
      "SELECT status FROM merge_candidates",
    );
    // DEFAULT 'pending' appliqué.
    expect(String(cands.rows[0].status)).toBe("pending");
  });
});

describe("migration 0004 — rétro-compatible (CREATE TABLE only) sur base peuplée", () => {
  it("ajoute seed_voix sans toucher aux contacts existants (story 3.5)", async () => {
    const client = createClient({ url: "file::memory:?cache=private" });
    const files = migrationFiles();

    // État 3.4 : on applique tout SAUF 0004 (contacts déjà peuplé, dedup actif).
    for (const f of files.filter((f) => !f.startsWith("0004"))) {
      await apply(client, f);
    }
    await client.execute(
      "INSERT INTO users (id, timezone, voix_ton) VALUES ('u1','Europe/Paris','neutre')",
    );
    await client.execute(
      "INSERT INTO contacts (id, user_id, nom, source, dedup_key) VALUES ('c1','u1','Alice','manuel','name:alice|')",
    );

    // 0004 ne fait qu'un CREATE TABLE : aucune ALTER sur une table peuplée.
    const m0004 = files.find((f) => f.startsWith("0004"));
    expect(m0004).toBeDefined();
    await apply(client, m0004!);

    // Les contacts pré-existants sont intacts.
    const c = await client.execute("SELECT id, nom FROM contacts");
    expect(c.rows).toHaveLength(1);
    expect(String(c.rows[0].nom)).toBe("Alice");

    // La nouvelle table existe et est utilisable (texte sanitizé à l'import = stocké tel quel).
    await client.execute(
      "INSERT INTO seed_voix (id, user_id, texte, created_at) VALUES ('s1','u1','Salut, on se cale un cafe ?',1700000000000)",
    );
    const seeds = await client.execute("SELECT texte FROM seed_voix");
    expect(seeds.rows).toHaveLength(1);
    expect(String(seeds.rows[0].texte)).toBe("Salut, on se cale un cafe ?");
  });
});
