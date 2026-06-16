// INVARIANT N°1 — isolation cross-tenant (AR-2, AR-13).
//
// Deux users A et B sont seedés, chacun avec ses propres ressources scopées.
// On prouve que la porte scopée ne laisse JAMAIS un tenant lire/écrire les données
// d'un autre — d'abord sur la table SCAFFOLDING générique (`test_items`), puis sur
// la VRAIE table `contacts` (story 2.1), via son repository.
//
// Le harnais est PARAMÉTRÉ/EXTENSIBLE : chaque nouvelle table scopée des epics
// suivants (messages, relances, ...) ré-utilise `forUserDb` + son repository et
// re-joue ces mêmes assertions. La porte étant générique, la couverture suit.

import { beforeEach, describe, expect, it } from "vitest";

import { contactsRepository, forUserDb } from "@/lib/db";
import type { Clock } from "@/lib/domain/time";

import { makeTestDb, seedUsers, testItems, type TestDb } from "../db/harness";
import { makeUser } from "../factories/user";

// Horloge figée : déterminisme, et zéro Date.now() en dur dans les tests.
const now: Clock = () => 1_700_000_000_000;

describe("invariant n°1 — porte générique (scaffolding test_items)", () => {
  let db: TestDb;
  const userA = makeUser({ name: "Alice" });
  const userB = makeUser({ name: "Bob" });

  // Chaque test repart d'une db en mémoire fraîche et isolée.
  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("seed A et B + items, aucune fuite croisée", async () => {
    // Seed des items pour chaque tenant via la porte scopée (user_id imposé).
    const gateA = forUserDb(db, userA.id, now);
    const gateB = forUserDb(db, userB.id, now);

    await gateA.insert(testItems, [
      { id: "a1", label: "secret de A #1" },
      { id: "a2", label: "secret de A #2" },
    ]);
    await gateB.insert(testItems, [{ id: "b1", label: "secret de B #1" }]);

    // A ne voit QUE ses items.
    const seenByA = await gateA.findMany(testItems);
    expect(seenByA.map((r) => r.id).sort()).toEqual(["a1", "a2"]);
    expect(seenByA.every((r) => r.userId === userA.id)).toBe(true);
    expect(seenByA.some((r) => r.id === "b1")).toBe(false);

    // B ne voit QUE ses items.
    const seenByB = await gateB.findMany(testItems);
    expect(seenByB.map((r) => r.id)).toEqual(["b1"]);
    expect(seenByB.every((r) => r.userId === userB.id)).toBe(true);
    expect(seenByB.some((r) => r.id.startsWith("a"))).toBe(false);
  });

  it("findFirst est borné au tenant (aucune lecture croisée)", async () => {
    const gateA = forUserDb(db, userA.id, now);
    const gateB = forUserDb(db, userB.id, now);

    await gateA.insert(testItems, { id: "a1", label: "A" });

    expect(await gateA.findFirst(testItems)).toMatchObject({ id: "a1" });
    // B ne trouve rien : l'item de A lui est invisible.
    expect(await gateB.findFirst(testItems)).toBeUndefined();
  });

  it("update/delete ne touchent jamais les lignes d'un autre tenant", async () => {
    const gateA = forUserDb(db, userA.id, now);
    const gateB = forUserDb(db, userB.id, now);

    await gateA.insert(testItems, { id: "a1", label: "intact" });

    // B tente de modifier l'item de A : aucune ligne affectée.
    const updatedByB = await gateB.update(testItems, { label: "pirate" });
    expect(updatedByB).toHaveLength(0);

    // B tente de supprimer l'item de A : aucune ligne affectée.
    const deletedByB = await gateB.delete(testItems);
    expect(deletedByB).toHaveLength(0);

    // L'item de A est intact.
    const stillThere = await gateA.findFirst(testItems);
    expect(stillThere).toMatchObject({ id: "a1", label: "intact" });
  });

  it("insert impose user_id : impossible d'écrire au nom d'un autre tenant", async () => {
    const gateA = forUserDb(db, userA.id, now);

    // On tente d'injecter le tenant de B dans les valeurs : la porte l'écrase.
    await gateA.insert(testItems, {
      id: "x1",
      label: "tentative d'usurpation",
      // @ts-expect-error userId n'est pas accepté par l'API : la porte l'impose.
      userId: userB.id,
    });

    const row = await gateA.findFirst(testItems);
    expect(row?.userId).toBe(userA.id);
  });
});

describe("invariant n°1 — VRAIE table `contacts` (story 2.1)", () => {
  let db: TestDb;
  const userA = makeUser({ name: "Alice" });
  const userB = makeUser({ name: "Bob" });

  // Repositories montés au-dessus de la porte scopée, par tenant.
  const repoA = () => contactsRepository(forUserDb(db, userA.id, now));
  const repoB = () => contactsRepository(forUserDb(db, userB.id, now));

  beforeEach(async () => {
    db = await makeTestDb();
    // FK contacts.user_id → users.id : les deux users doivent exister.
    await seedUsers(db, [userA, userB]);
  });

  it("list ne renvoie QUE les contacts du tenant", async () => {
    await repoA().create({ nom: "Contact de A #1" });
    await repoA().create({ nom: "Contact de A #2" });
    await repoB().create({ nom: "Contact de B #1" });

    const seenByA = await repoA().list();
    expect(seenByA.map((c) => c.nom).sort()).toEqual([
      "Contact de A #1",
      "Contact de A #2",
    ]);
    expect(seenByA.every((c) => c.userId === userA.id)).toBe(true);

    const seenByB = await repoB().list();
    expect(seenByB.map((c) => c.nom)).toEqual(["Contact de B #1"]);
    expect(seenByB.every((c) => c.userId === userB.id)).toBe(true);
  });

  it("create impose user_id : un Contact appartient toujours à son créateur", async () => {
    const created = await repoA().create({ nom: "Hervé" });
    expect(created.userId).toBe(userA.id);
    // B ne voit pas le contact de A.
    expect(await repoB().get(created.id)).toBeUndefined();
  });

  it("get d'un contact d'autrui renvoie undefined (aucune lecture croisée)", async () => {
    const aContact = await repoA().create({ nom: "Privé de A" });

    expect(await repoA().get(aContact.id)).toMatchObject({ id: aContact.id });
    // B connaît l'id mais ne peut pas le lire.
    expect(await repoB().get(aContact.id)).toBeUndefined();
  });

  it("update d'autrui n'affecte rien et préserve la ligne d'origine", async () => {
    const aContact = await repoA().create({ nom: "Intact" });

    // B tente d'éditer le contact de A (en connaissant son id) : aucun effet.
    const piracy = await repoB().update(aContact.id, { nom: "Piraté" });
    expect(piracy).toBeUndefined();

    // La ligne de A est strictement intacte.
    expect(await repoA().get(aContact.id)).toMatchObject({
      id: aContact.id,
      nom: "Intact",
      userId: userA.id,
    });
  });

  it("remove d'autrui n'affecte rien ; remove du sien réussit", async () => {
    const aContact = await repoA().create({ nom: "À supprimer par A seul" });

    // B tente de supprimer le contact de A : refusé (aucune ligne).
    expect(await repoB().remove(aContact.id)).toBe(false);
    expect(await repoA().get(aContact.id)).toBeDefined();

    // A supprime le sien : OK.
    expect(await repoA().remove(aContact.id)).toBe(true);
    expect(await repoA().get(aContact.id)).toBeUndefined();
  });
});
