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

describe("migration 0005 — rétro-compatible (CREATE TABLE only) sur base peuplée", () => {
  it("ajoute messages / generation_events sans toucher aux contacts existants (story 3.6)", async () => {
    const client = createClient({ url: "file::memory:?cache=private" });
    const files = migrationFiles();

    // État 3.5 : on applique tout ce qui PRÉCÈDE 0005 (contacts déjà peuplé, dedup actif).
    // On borne strictement aux migrations antérieures : les migrations POSTÉRIEURES (0006+)
    // dépendent des tables créées par 0005 et ne peuvent pas s'appliquer avant elle.
    for (const f of files.filter((f) => f < "0005")) {
      await apply(client, f);
    }
    await client.execute(
      "INSERT INTO users (id, timezone, voix_ton) VALUES ('u1','Europe/Paris','neutre')",
    );
    await client.execute(
      "INSERT INTO contacts (id, user_id, nom, source, dedup_key) VALUES ('c1','u1','Alice','manuel','name:alice|')",
    );

    // 0005 ne fait que des CREATE TABLE : aucune ALTER sur une table peuplée.
    const m0005 = files.find((f) => f.startsWith("0005"));
    expect(m0005).toBeDefined();
    await apply(client, m0005!);

    // Les contacts pré-existants sont intacts.
    const c = await client.execute("SELECT id, nom FROM contacts");
    expect(c.rows).toHaveLength(1);
    expect(String(c.rows[0].nom)).toBe("Alice");

    // messages : DEFAULT 'brouillon' + genere_par_ia DEFAULT false appliqués.
    await client.execute(
      "INSERT INTO messages (id, user_id, contact_id, canal, texte, envoye_at, created_at) VALUES ('m1','u1','c1','linkedin','Salut !',1700000000000,1700000000000)",
    );
    const msgs = await client.execute(
      "SELECT statut, genere_par_ia, envoye_at FROM messages",
    );
    expect(msgs.rows).toHaveLength(1);
    expect(String(msgs.rows[0].statut)).toBe("brouillon");
    expect(Number(msgs.rows[0].genere_par_ia)).toBe(0);

    // generation_events : edit_distance REAL stocké tel quel.
    await client.execute(
      "INSERT INTO generation_events (id, user_id, message_id, contact_id, generated, sent, edit_distance, raw_intent, prompt_version, model_id, sanitize_version, tokens_input, tokens_output, created_at) VALUES ('g1','u1','m1','c1','genere','envoye',0.2,'idee',1,'claude-haiku-4-5',1,100,40,1700000000000)",
    );
    const evs = await client.execute(
      "SELECT edit_distance, tokens_input FROM generation_events",
    );
    expect(evs.rows).toHaveLength(1);
    expect(Number(evs.rows[0].edit_distance)).toBeCloseTo(0.2, 5);
    expect(Number(evs.rows[0].tokens_input)).toBe(100);
  });
});

describe("migration 0006 — ADD COLUMN nullable rétro-compatible (story 3.7)", () => {
  it("ajoute messages.updated_at sur une table `messages` DÉJÀ PEUPLÉE, sans casse", async () => {
    const client = createClient({ url: "file::memory:?cache=private" });
    const files = migrationFiles();

    // État 3.6 : on applique tout SAUF 0006 (messages existe SANS updated_at).
    for (const f of files.filter((f) => !f.startsWith("0006"))) {
      await apply(client, f);
    }
    await client.execute(
      "INSERT INTO users (id, timezone, voix_ton) VALUES ('u1','Europe/Paris','neutre')",
    );
    await client.execute(
      "INSERT INTO contacts (id, user_id, nom, source, dedup_key) VALUES ('c1','u1','Alice','manuel','name:alice|')",
    );
    // Un message envoyé PRÉ-EXISTANT (avant la migration) : pas d'updated_at encore.
    await client.execute(
      "INSERT INTO messages (id, user_id, contact_id, canal, texte, statut, envoye_at, created_at) VALUES ('m1','u1','c1','linkedin','Salut !','envoye',1700000000000,1700000000000)",
    );

    // 0006 = ADD COLUMN nullable : NE DOIT PAS échouer sur la table peuplée (rétro-compat).
    const m0006 = files.find((f) => f.startsWith("0006"));
    expect(m0006).toBeDefined();
    await apply(client, m0006!);

    // La ligne pré-existante est intacte ; son updated_at est NULL (colonne nullable).
    const before = await client.execute(
      "SELECT texte, statut, updated_at FROM messages WHERE id = 'm1'",
    );
    expect(before.rows).toHaveLength(1);
    expect(String(before.rows[0].texte)).toBe("Salut !");
    expect(String(before.rows[0].statut)).toBe("envoye");
    expect(before.rows[0].updated_at).toBeNull();

    // Une nouvelle ligne peut écrire updated_at (le verrou optimiste 3.7 l'utilise).
    await client.execute(
      "INSERT INTO messages (id, user_id, contact_id, canal, texte, statut, envoye_at, created_at, updated_at) VALUES ('m2','u1','c1','email','Coucou','envoye',1700000001000,1700000001000,1700000001000)",
    );
    const after = await client.execute(
      "SELECT updated_at FROM messages WHERE id = 'm2'",
    );
    expect(Number(after.rows[0].updated_at)).toBe(1700000001000);
  });
});
