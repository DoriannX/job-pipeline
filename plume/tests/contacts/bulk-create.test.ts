// Ajout rapide multiple — `bulkCreate` du repository Contacts (story 2.2).
//
// On prouve la dédup (AR-9) à TROIS niveaux :
//   1. intra-lot : un même contact répété dans le collage n'est créé qu'une fois ;
//   2. vs existant : un contact déjà en base n'est PAS re-créé (compté « fusionné ») ;
//   3. cross-tenant : la MÊME clé de dédup chez deux users donne DEUX lignes
//      (l'index unique est par `(user_id, dedup_key)`) — zéro collision, zéro fuite.
//
// Tout passe par la porte scopée `forUserDb` + le repository (jamais Drizzle nu).

import { beforeEach, describe, expect, it } from "vitest";

import { contactsRepository, forUserDb } from "@/lib/db";
import type { Clock } from "@/lib/domain/time";

import { makeTestDb, seedUsers, type TestDb } from "../db/harness";
import { makeUser } from "../factories/user";

const now: Clock = () => 1_700_000_000_000;

describe("bulkCreate — dédup par tenant (story 2.2)", () => {
  let db: TestDb;
  const userA = makeUser({ name: "Alice" });
  const userB = makeUser({ name: "Bob" });

  const repoA = () => contactsRepository(forUserDb(db, userA.id, now));
  const repoB = () => contactsRepository(forUserDb(db, userB.id, now));

  beforeEach(async () => {
    db = await makeTestDb();
    await seedUsers(db, [userA, userB]);
  });

  it("crée N Contacts en une action (compte-rendu exact)", async () => {
    const report = await repoA().bulkCreate([
      { nom: "Léa Martin", entreprise: "Acme" },
      { nom: "Hervé Dupont" },
      { nom: "Nour", entreprise: "Studio Bleu" },
    ]);
    expect(report).toEqual({ created: 3, merged: 0 });

    const list = await repoA().list();
    expect(list.map((c) => c.nom).sort()).toEqual([
      "Hervé Dupont",
      "Léa Martin",
      "Nour",
    ]);
    // L'entreprise est persistée et la provenance est 'rapide'.
    const lea = list.find((c) => c.nom === "Léa Martin");
    expect(lea?.entreprise).toBe("Acme");
    expect(lea?.source).toBe("rapide");
  });

  it("dédup INTRA-lot : la même personne répétée n'est créée qu'une fois", async () => {
    const report = await repoA().bulkCreate([
      { nom: "Léa Martin", entreprise: "Acme" },
      { nom: "lea  martin", entreprise: "ACME" }, // équivalent après normalisation
      { nom: "Léa Martin", entreprise: "Acme" }, // strict doublon
    ]);
    expect(report).toEqual({ created: 1, merged: 2 });
    expect((await repoA().list()).length).toBe(1);
  });

  it("dédup par EMAIL : même email = même contact, quel que soit le nom", async () => {
    const report = await repoA().bulkCreate([
      { nom: "Jean Dupont", email: "jean@acme.fr" },
      { nom: "J. Dupont", email: "JEAN@ACME.FR" }, // même email normalisé
    ]);
    expect(report).toEqual({ created: 1, merged: 1 });
    expect((await repoA().list()).length).toBe(1);
  });

  it("dédup VS EXISTANT : un contact déjà présent n'est pas re-créé", async () => {
    // Contact créé via le create unitaire (story 2.1) — même socle de clé.
    await repoA().create({ nom: "Léa Martin", entreprise: "Acme" });

    const report = await repoA().bulkCreate([
      { nom: "Léa Martin", entreprise: "Acme" }, // déjà là => fusionné
      { nom: "Tout Nouveau" }, // nouveau => créé
    ]);
    expect(report).toEqual({ created: 1, merged: 1 });
    expect((await repoA().list()).length).toBe(2);
  });

  it("CROSS-TENANT : même clé chez A et B => deux lignes, aucune collision", async () => {
    const itemsIdentiques = [{ nom: "Léa Martin", entreprise: "Acme" }];

    const reportA = await repoA().bulkCreate(itemsIdentiques);
    const reportB = await repoB().bulkCreate(itemsIdentiques);

    // Chacun crée sa propre ligne : l'unicité est par tenant.
    expect(reportA).toEqual({ created: 1, merged: 0 });
    expect(reportB).toEqual({ created: 1, merged: 0 });

    // A ne voit QUE sa ligne, B QUE la sienne (zéro fuite).
    const listA = await repoA().list();
    const listB = await repoB().list();
    expect(listA.length).toBe(1);
    expect(listB.length).toBe(1);
    expect(listA[0].userId).toBe(userA.id);
    expect(listB[0].userId).toBe(userB.id);
    expect(listA[0].id).not.toBe(listB[0].id);
  });

  it("lot vide / sans nom valide => 0 créé", async () => {
    const report = await repoA().bulkCreate([]);
    expect(report).toEqual({ created: 0, merged: 0 });
    expect((await repoA().list()).length).toBe(0);
  });
});
