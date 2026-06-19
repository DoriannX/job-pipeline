// Tool `queryContacts` du copilote (Phase 1) — logique PURE testée sur db :memory:.
//
// On prouve l'invariant SÉCU #3 (scope tenant verrouillé SOUS le tool) et le
// comportement de la matrice I/O de la spec :
//   1. isolement : un tenant ne voit JAMAIS les contacts d'un autre ;
//   2. filtre `search` : insensible à la casse, sur nom OU entreprise ;
//   3. projection légère + `count` exact ;
//   4. liste vide → résultat vide, pas d'erreur.
//
// Tout passe par la porte scopée `forUserDb` + le repository (jamais Drizzle nu).

import { beforeEach, describe, expect, it } from "vitest";

import { contactsRepository, forUserDb } from "@/lib/db";
import type { Clock } from "@/lib/domain/time";

import { queryContacts } from "@/lib/agent/tools.server";

import { makeTestDb, seedUsers, type TestDb } from "../db/harness";
import { makeUser } from "../factories/user";

const now: Clock = () => 1_700_000_000_000;

describe("queryContacts — scope tenant + filtre (copilote Phase 1)", () => {
  let db: TestDb;
  const userA = makeUser({ name: "Alice" });
  const userB = makeUser({ name: "Bob" });

  const repoA = () => contactsRepository(forUserDb(db, userA.id, now));
  const repoB = () => contactsRepository(forUserDb(db, userB.id, now));

  beforeEach(async () => {
    db = await makeTestDb();
    await seedUsers(db, [userA, userB]);
  });

  it("ne voit QUE les contacts du tenant courant (isolement)", async () => {
    await repoA().bulkCreate([
      { nom: "Léa Martin", entreprise: "Acme" },
      { nom: "Hervé Dupont" },
    ]);
    await repoB().bulkCreate([{ nom: "Secret Bob", entreprise: "Bobcorp" }]);

    const a = await queryContacts(repoA(), {});
    expect(a.count).toBe(2);
    expect(a.contacts.map((c) => c.nom).sort()).toEqual([
      "Hervé Dupont",
      "Léa Martin",
    ]);
    // Aucune fuite cross-tenant.
    expect(a.contacts.some((c) => c.nom === "Secret Bob")).toBe(false);

    const b = await queryContacts(repoB(), {});
    expect(b.count).toBe(1);
    expect(b.contacts[0]?.nom).toBe("Secret Bob");
  });

  it("filtre `search` insensible à la casse sur nom ou entreprise", async () => {
    await repoA().bulkCreate([
      { nom: "Léa Martin", entreprise: "Acme" },
      { nom: "Hervé Dupont", entreprise: "Studio Bleu" },
      { nom: "Nora Acme-Fan" },
    ]);

    const parEntreprise = await queryContacts(repoA(), { search: "acme" });
    expect(parEntreprise.contacts.map((c) => c.nom).sort()).toEqual([
      "Léa Martin",
      "Nora Acme-Fan",
    ]);

    const parNom = await queryContacts(repoA(), { search: "HERVÉ" });
    expect(parNom.count).toBe(1);
    expect(parNom.contacts[0]?.nom).toBe("Hervé Dupont");
  });

  it("projette une forme légère (id, nom, entreprise, canalPrefere)", async () => {
    await repoA().bulkCreate([{ nom: "Léa Martin", entreprise: "Acme" }]);
    const { contacts } = await queryContacts(repoA(), {});
    expect(Object.keys(contacts[0]!).sort()).toEqual([
      "canalPrefere",
      "entreprise",
      "id",
      "nom",
    ]);
    expect(contacts[0]!.entreprise).toBe("Acme");
  });

  it("liste vide → résultat vide, pas d'erreur", async () => {
    const res = await queryContacts(repoA(), {});
    expect(res).toEqual({ count: 0, contacts: [], truncated: false });
  });

  it("borne l'échantillon à 50 et signale la troncature (count reste exact)", async () => {
    await repoA().bulkCreate(
      Array.from({ length: 55 }, (_, i) => ({
        nom: `Contact ${String(i).padStart(2, "0")}`,
      })),
    );
    const res = await queryContacts(repoA(), {});
    expect(res.count).toBe(55);
    expect(res.contacts).toHaveLength(50);
    expect(res.truncated).toBe(true);
  });
});
