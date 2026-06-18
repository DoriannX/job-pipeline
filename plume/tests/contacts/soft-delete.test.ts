// Soft-delete + ré-ajout idempotent (lot de corrections dogfooding Epic 3).
//
// On prouve les invariants ajoutés par ce lot :
//   1. `remove()` ARCHIVE (ne supprime pas) : invisible en lecture normale, lisible avec
//      `includeArchived` — la porte scopée masque `archived_at IS NULL` par défaut ;
//   2. re-créer un contact archivé le RÉACTIVE et fusionne les champs re-saisis ;
//   3. re-créer un DOUBLON actif fusionne sans écraser par du vide (pas de perte) ;
//   4. `bulkCreate` réactive aussi un archivé (parité avec `create`) ;
//   5. éditer le nom+entreprise vers une autre clé existante lève l'index unique ;
//   6. `markSent` refuse un contact archivé (la garde d'intégrité passe par la porte).
//
// Tout passe par la porte scopée `forUserDb` + les repositories (jamais Drizzle nu).

import { beforeEach, describe, expect, it } from "vitest";

import { contactsRepository, messagesRepository, forUserDb } from "@/lib/db";
import type { Clock } from "@/lib/domain/time";

import { makeTestDb, seedUsers, type TestDb } from "../db/harness";
import { makeUser } from "../factories/user";
import { makeMarkSent } from "../factories/message";

const now: Clock = () => 1_700_000_000_000;

describe("soft-delete + ré-ajout idempotent (corrections Epic 3)", () => {
  let db: TestDb;
  const user = makeUser({ name: "Alice" });

  const repo = () => contactsRepository(forUserDb(db, user.id, now));
  const messages = () => messagesRepository(forUserDb(db, user.id, now));

  beforeEach(async () => {
    db = await makeTestDb();
    await seedUsers(db, [user]);
  });

  it("remove() archive : invisible en lecture normale, lisible avec includeArchived", async () => {
    const c = await repo().create({ nom: "Michel" });

    const removed = await repo().remove(c.id);
    expect(removed).toBe(true);

    // Lecture normale : disparu.
    expect(await repo().list()).toHaveLength(0);
    expect(await repo().get(c.id)).toBeUndefined();

    // La donnée demeure (réversible) : visible avec includeArchived.
    const archived = await repo().get(c.id, { includeArchived: true });
    expect(archived?.id).toBe(c.id);
    expect(archived?.archivedAt).not.toBeNull();

    // Idempotent : ré-archiver un déjà-archivé ne fait rien.
    expect(await repo().remove(c.id)).toBe(false);
  });

  it("re-créer un contact archivé le RÉACTIVE et applique les champs re-saisis", async () => {
    const c = await repo().create({ nom: "Michel" });
    await repo().remove(c.id);

    const revived = await repo().create({ nom: "michel", notes: "ami de fac" });

    // Même ligne (même clé de dédup), désarchivée, enrichie.
    expect(revived.id).toBe(c.id);
    expect(revived.archivedAt).toBeNull();
    expect(revived.notes).toBe("ami de fac");

    const list = await repo().list();
    expect(list).toHaveLength(1);
    expect(list[0]?.notes).toBe("ami de fac");
  });

  it("re-créer un DOUBLON actif fusionne sans écraser par du vide", async () => {
    const c = await repo().create({ nom: "Michel", notes: "ami de fac" });

    // Ré-ajout avec de NOUVELLES notes → fusion (on garde une seule ligne, notes à jour).
    const merged = await repo().create({ nom: "Michel", notes: "collègue" });
    expect(merged.id).toBe(c.id);
    expect(merged.notes).toBe("collègue");

    // Ré-ajout MINIMAL (sans notes) → on NE vide PAS les notes existantes.
    const again = await repo().create({ nom: "michel" });
    expect(again.id).toBe(c.id);
    expect(again.notes).toBe("collègue");

    expect(await repo().list()).toHaveLength(1);
  });

  it("bulkCreate réactive un contact archivé (parité avec create)", async () => {
    const c = await repo().create({ nom: "Sophie", entreprise: "Acme" });
    await repo().remove(c.id);
    expect(await repo().list()).toHaveLength(0);

    const report = await repo().bulkCreate([
      { nom: "Sophie", entreprise: "Acme" },
    ]);
    // Réactivation comptée comme « créée » (le contact réapparaît).
    expect(report).toEqual({ created: 1, merged: 0 });

    const list = await repo().list();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(c.id);
    expect(list[0]?.archivedAt).toBeNull();
  });

  it("éditer nom+entreprise vers une clé existante lève l'index unique", async () => {
    const a = await repo().create({ nom: "Marc", entreprise: "Acme" });
    const b = await repo().create({ nom: "Marc" }); // clé distincte (sans entreprise)
    expect(a.dedupKey).not.toBe(b.dedupKey);

    // B prend l'entreprise « Acme » → sa dedup_key collisionne avec A → UNIQUE viole.
    let thrown: unknown;
    try {
      await repo().update(b.id, { nom: "Marc", entreprise: "Acme" });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeDefined();

    // libSQL EMBALLE l'erreur : le motif vit dans la chaîne de `cause`. C'est sur cette
    // chaîne que `updateContactAction` détecte la collision (→ message doux, pas un 500).
    const chain: string[] = [];
    for (let cur: unknown = thrown; cur instanceof Error; cur = cur.cause) {
      chain.push(cur.message);
    }
    expect(chain.join(" | ")).toMatch(/UNIQUE constraint failed/i);
  });

  it("markSent refuse un contact archivé", async () => {
    const c = await repo().create({ nom: "Léa" });
    await repo().remove(c.id);

    await expect(
      messages().markSent(makeMarkSent(c.id, { texte: "Salut Léa !" })),
    ).rejects.toThrow();

    // Aucun message n'a été écrit (rollback / garde).
    const history = await messages().listForContact(c.id);
    expect(history).toHaveLength(0);
  });
});
