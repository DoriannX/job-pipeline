// JOURNAL D'ACTIONS `action_log` (copilote Phase 2 inc.4, CAP-1 + capture CAP-3).
//
// On prouve les success criteria de CAP-1 :
//   - GROUPEMENT par tour : toutes les mutations d'un même run partagent le `turnId` ;
//   - forme de l'entrée `{turnId, toolName, entityType, entityId, op, prevState?}` scopée tenant ;
//   - ATOMICITÉ : une mutation persistée SANS son entrée de journal est impossible (rollback) ;
//   - ISOLEMENT cross-tenant : aucune entrée d'un tenant n'est visible pour un autre.
// Et la CAPTURE `prevState` de CAP-3 (merge/réactivation), qui rendra l'inverse exact.
//
// Tout passe par la porte scopée + les repositories (jamais Drizzle nu hors lecture d'assertion).

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  actionLogRepository,
  contactsRepository,
  forUserDb,
  type JournalSink,
} from "@/lib/db";
import { createContact, importContacts } from "@/lib/agent/tools.server";
import type { Clock } from "@/lib/domain/time";

import { actionLog, contacts, makeTestDb, seedUsers, type TestDb } from "./harness";
import { makeUser } from "../factories/user";

// Horloge MONOTONE : chaque appel avance le temps. Indispensable pour que des tours distincts
// reçoivent des horodatages distincts (l'ordre LIFO du rewind s'appuie dessus, cf. rewind.test).
function monotonicClock(start = 1_700_000_000_000, step = 1000): Clock {
  let t = start;
  return () => (t += step);
}

/**
 * Construit la SINK de journalisation EXACTEMENT comme `buildTools` en prod : elle écrit l'entrée
 * `action_log` via `actionLogRepository(tx)` DANS la transaction de la mutation (le repository
 * l'invoque avec son handle `tx`) → atomicité. `turnId` est clos par cette closure.
 */
const makeJournal =
  (turnId: string, toolName: string): JournalSink =>
  async (tx, record) => {
    await actionLogRepository(tx).record({
      turnId,
      toolName,
      entityType: record.entityType,
      entityId: record.entityId,
      op: record.op,
      prevState: record.prevState,
    });
  };

describe("action_log — journal atomique groupé par tour (CAP-1)", () => {
  let db: TestDb;
  const userA = makeUser({ name: "Alice" });
  const userB = makeUser({ name: "Bob" });
  const now = monotonicClock();

  const repoA = () => contactsRepository(forUserDb(db, userA.id, now));
  const logRowsA = () =>
    db.select().from(actionLog).where(eq(actionLog.userId, userA.id));

  beforeEach(async () => {
    db = await makeTestDb();
    await seedUsers(db, [userA, userB]);
  });

  it("groupe TOUTES les mutations d'un run sous le même turnId (forme d'entrée complète)", async () => {
    // « ajoute Sophie » PUIS import de 5 personnes, dans le MÊME tour (même turnId).
    await createContact(repoA(), { nom: "Sophie", entreprise: "Acme" }, makeJournal("turn-1", "createContact"));
    await importContacts(
      repoA(),
      {
        contacts: [
          { nom: "A" },
          { nom: "B" },
          { nom: "C" },
          { nom: "D" },
          { nom: "E" },
        ],
      },
      makeJournal("turn-1", "importContacts"),
    );

    const rows = await logRowsA();
    // 1 (createContact) + 5 (importContacts) = 6 entrées, toutes sous le même turnId.
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.turnId === "turn-1")).toBe(true);
    expect(rows.every((r) => r.userId === userA.id)).toBe(true);
    expect(rows.every((r) => r.entityType === "contact")).toBe(true);
    expect(rows.every((r) => r.op === "created")).toBe(true);
    // Chaque entrée porte la forme contractuelle (entityId non vide, toolName du tool).
    expect(rows.every((r) => r.entityId.length > 0)).toBe(true);
    const tools = new Set(rows.map((r) => r.toolName));
    expect(tools).toEqual(new Set(["createContact", "importContacts"]));
  });

  it("ATOMICITÉ : si l'écriture du journal échoue, la mutation est ANNULÉE (rollback total)", async () => {
    // Sink qui JETTE → la transaction de `create` doit tout annuler : ni contact, ni entrée.
    const sabotage: JournalSink = async () => {
      throw new Error("journal sabotage");
    };

    await expect(
      createContact(repoA(), { nom: "Fantôme" }, sabotage),
    ).rejects.toThrow(/sabotage/);

    // Aucun contact créé (rollback) — « mutation sans entrée de journal = impossible ».
    expect(await repoA().list()).toHaveLength(0);
    // Aucune entrée non plus (la transaction a tout annulé).
    expect(await logRowsA()).toHaveLength(0);
  });

  it("ISOLEMENT cross-tenant : une entrée de A n'est jamais visible pour B", async () => {
    await createContact(repoA(), { nom: "Secret de A" }, makeJournal("turn-A", "createContact"));

    // B lit son propre journal via la porte scopée : vide (aucune fuite).
    const seenByB = await forUserDb(db, userB.id, now).findMany(actionLog);
    expect(seenByB).toHaveLength(0);
    // A voit bien la sienne.
    expect(await logRowsA()).toHaveLength(1);
  });
});

describe("action_log — capture prevState pour merge/réactivation (CAP-3)", () => {
  let db: TestDb;
  const user = makeUser({ name: "Alice" });
  const now = monotonicClock();
  const repo = () => contactsRepository(forUserDb(db, user.id, now));
  const logRows = () => db.select().from(actionLog);

  beforeEach(async () => {
    db = await makeTestDb();
    await seedUsers(db, [user]);
  });

  it("FUSION (merge) : op='merged' + prevState capture les champs écrasés", async () => {
    // Clé = e-mail (stable) → un 2ᵉ ajout au même e-mail FUSIONNE (n'invente pas une 2ᵉ ligne).
    await createContact(repo(), { nom: "Sophie", email: "s@x.test", entreprise: "Acme" }, makeJournal("t1", "createContact"));
    await createContact(
      repo(),
      { nom: "Sophie", email: "s@x.test", entreprise: "Globex" },
      makeJournal("t2", "createContact"),
    );

    const rows = await logRows();
    expect(rows).toHaveLength(2);
    const merged = rows.find((r) => r.turnId === "t2");
    expect(merged?.op).toBe("merged");
    // prevState garde l'entreprise ANTÉRIEURE (Acme) → le rewind la restaurera.
    expect((merged?.prevState as { entreprise?: string }).entreprise).toBe("Acme");
    // Une seule ligne contact (fusion, pas de doublon).
    expect(await repo().list()).toHaveLength(1);
  });

  it("RÉACTIVATION : op='reactivated' + prevState capture l'archivedAt antérieur EXACT", async () => {
    const created = await createContact(repo(), { nom: "Zoé", email: "z@x.test" }, makeJournal("t1", "createContact"));
    // Archive le contact : on note l'instant d'archivage pour vérifier sa restauration exacte.
    await repo().remove(created.id);
    const archived = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, created.id));
    const archivedAt = archived[0]!.archivedAt;
    expect(archivedAt).not.toBeNull();

    // Re-création à la même clé → RÉACTIVATION (désarchive).
    await createContact(repo(), { nom: "Zoé", email: "z@x.test" }, makeJournal("t2", "createContact"));

    const reactivated = (await logRows()).find((r) => r.turnId === "t2");
    expect(reactivated?.op).toBe("reactivated");
    // prevState porte l'archivedAt EXACT à restaurer (pas un re-archivage à `now`).
    expect((reactivated?.prevState as { archivedAt?: number }).archivedAt).toBe(
      archivedAt,
    );
  });
});
