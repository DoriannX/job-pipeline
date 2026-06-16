// INVARIANT N°1 — isolation cross-tenant (AR-2, AR-13).
//
// Deux users A et B sont seedés, chacun avec ses propres ressources scopées
// (table scaffolding `test_items`). On prouve que la porte `forUser` ne laisse
// JAMAIS un tenant lire/écrire les données d'un autre.
//
// CE HARNAIS EST À ÉTENDRE À CHAQUE VRAIE TABLE SCOPÉE des epics suivants
// (contacts en 2.1, messages, relances, ...) : il suffira de remplacer/ajouter
// `test_items` par la vraie table et de re-jouer ces mêmes assertions. La porte
// étant générique, la couverture suit automatiquement.

import { beforeEach, describe, expect, it } from "vitest";

import { forUser } from "@/lib/db";
import type { Clock } from "@/lib/domain/time";

import { makeTestDb, testItems, type TestDb } from "../db/harness";
import { makeUser } from "../factories/user";

// Horloge figée : déterminisme, et zéro Date.now() en dur dans les tests.
const now: Clock = () => 1_700_000_000_000;

describe("invariant n°1 — isolation cross-tenant", () => {
  let db: TestDb;
  const userA = makeUser({ name: "Alice" });
  const userB = makeUser({ name: "Bob" });

  // Chaque test repart d'une db en mémoire fraîche et isolée.
  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("seed A et B + items, aucune fuite croisée", async () => {
    // Seed des items pour chaque tenant via la porte scopée (user_id imposé).
    const gateA = forUser(db, userA.id, now);
    const gateB = forUser(db, userB.id, now);

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
    const gateA = forUser(db, userA.id, now);
    const gateB = forUser(db, userB.id, now);

    await gateA.insert(testItems, { id: "a1", label: "A" });

    expect(await gateA.findFirst(testItems)).toMatchObject({ id: "a1" });
    // B ne trouve rien : l'item de A lui est invisible.
    expect(await gateB.findFirst(testItems)).toBeUndefined();
  });

  it("update/delete ne touchent jamais les lignes d'un autre tenant", async () => {
    const gateA = forUser(db, userA.id, now);
    const gateB = forUser(db, userB.id, now);

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
    const gateA = forUser(db, userA.id, now);

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
