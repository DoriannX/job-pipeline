// Gestion multi-fils + rétention (copilote Phase 3-B) — `conversationsRepository` étendu.
//
// On prouve les success criteria :
//   - CAP-4 : listActive scopé + ordonné, rename persistant (scopé), archive SOFT (le fil sort des
//     lectures mais reste en base), nouvelle conversation = id distinct sans toucher les autres,
//     réouverture recharge le bon transcript, AUCUN `DELETE` physique ;
//   - CAP-6 : au-delà du seuil, purgeBeyondThreshold archive (SOFT) les plus VIEUX (par updated_at),
//     les fils sous le seuil intacts, AUCUN `DELETE`, idempotent ; purge déclenchée à la création.
//
// Tout passe par la porte scopée `forUserDb` + le repository (Drizzle nu seulement en assertion).

import { eq, isNotNull } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  conversationsRepository,
  chatMessagesRepository,
  forUserDb,
  MAX_CONVERSATIONS_PER_TENANT,
} from "@/lib/db";
import type { Clock } from "@/lib/domain/time";

import {
  conversations,
  makeTestDb,
  seedUsers,
  type TestDb,
} from "./harness";
import { makeUser } from "../factories/user";

function monotonicClock(start = 1_700_000_000_000, step = 1000): Clock {
  let t = start;
  return () => (t += step);
}

describe("conversationsRepository — multi-fils + rétention (Phase 3-B)", () => {
  let db: TestDb;
  const userA = makeUser({ name: "Alice" });
  const userB = makeUser({ name: "Bob" });
  const now = monotonicClock();

  const convoRepo = (userId: string) =>
    conversationsRepository(forUserDb(db, userId, now));
  const msgRepo = (userId: string) =>
    chatMessagesRepository(forUserDb(db, userId, now));
  const physicalA = () =>
    db.select().from(conversations).where(eq(conversations.userId, userA.id));

  beforeEach(async () => {
    db = await makeTestDb();
    await seedUsers(db, [userA, userB]);
  });

  it("CAP-4 : listActive scopé + ordonné récent→ancien, le fil de B invisible pour A", async () => {
    const f1 = await convoRepo(userA.id).create({ firstUserMessage: "fil A1" });
    const f2 = await convoRepo(userA.id).create({ firstUserMessage: "fil A2" });
    await convoRepo(userA.id).touch(f1.id); // f1 redevient le plus récent
    await convoRepo(userB.id).create({ firstUserMessage: "fil B secret" });

    const list = await convoRepo(userA.id).listActive();
    expect(list.map((c) => c.id)).toEqual([f1.id, f2.id]); // récent → ancien
    expect(list.some((c) => c.titre?.includes("secret"))).toBe(false);
    // Projection légère : seulement id/titre/updatedAt.
    expect(Object.keys(list[0]!).sort()).toEqual(["id", "titre", "updatedAt"]);
  });

  it("CAP-4 : rename persiste le nouveau titre ; scopé (no-op pour un autre tenant)", async () => {
    const convo = await convoRepo(userA.id).create({ firstUserMessage: "ancien titre" });

    expect(await convoRepo(userA.id).rename(convo.id, "Prospection Q3")).toBe(true);
    expect((await convoRepo(userA.id).findById(convo.id))?.titre).toBe(
      "Prospection Q3",
    );

    // B ne peut pas renommer le fil de A (scopé → no-op, aucune fuite).
    expect(await convoRepo(userB.id).rename(convo.id, "piraté")).toBe(false);
    expect((await convoRepo(userA.id).findById(convo.id))?.titre).toBe(
      "Prospection Q3",
    );
  });

  it("CAP-4 : archive = SOFT (sort des lectures, reste en base), idempotent, jamais de DELETE", async () => {
    const convo = await convoRepo(userA.id).create({ firstUserMessage: "à archiver" });

    expect(await convoRepo(userA.id).archive(convo.id)).toBe(true);
    // Sort de TOUTES les lectures.
    expect(await convoRepo(userA.id).listActive()).toHaveLength(0);
    expect(await convoRepo(userA.id).findById(convo.id)).toBeNull();
    // Idempotent : ré-archiver un fil déjà archivé ⇒ false, aucune écriture.
    expect(await convoRepo(userA.id).archive(convo.id)).toBe(false);
    // JAMAIS de hard-delete : le fil existe toujours physiquement, avec archived_at posé.
    const physical = await physicalA();
    expect(physical).toHaveLength(1);
    expect(physical[0]!.archivedAt).not.toBeNull();
  });

  it("CAP-4 : nouvelle conversation = id distinct, n'altère pas les autres ; réouverture recharge le bon fil", async () => {
    const f1 = await convoRepo(userA.id).create({ firstUserMessage: "fil 1" });
    await msgRepo(userA.id).append({
      conversationId: f1.id,
      role: "user",
      content: "contenu du fil 1",
    });
    const f2 = await convoRepo(userA.id).create({ firstUserMessage: "fil 2" });
    await msgRepo(userA.id).append({
      conversationId: f2.id,
      role: "user",
      content: "contenu du fil 2",
    });

    expect(f1.id).not.toBe(f2.id);
    // Réouverture = relecture scopée du bon transcript (réutilise listForConversation de 3-A).
    const t1 = await msgRepo(userA.id).listForConversation(f1.id);
    const t2 = await msgRepo(userA.id).listForConversation(f2.id);
    expect(t1.map((m) => m.content)).toEqual(["contenu du fil 1"]);
    expect(t2.map((m) => m.content)).toEqual(["contenu du fil 2"]);
  });

  it("CAP-6 : purgeBeyondThreshold archive les plus VIEUX (par updated_at), seuil intact, jamais de DELETE, idempotent", async () => {
    const overflow = 3;
    const total = MAX_CONVERSATIONS_PER_TENANT + overflow;
    const scoped = forUserDb(db, userA.id, now);
    // Insertion DIRECTE (bypass `create` pour ne pas déclencher la purge) : N fils actifs, à des
    // `updated_at` croissants (monotones) → l'ordre d'ancienneté est déterministe.
    const ids: string[] = [];
    for (let i = 0; i < total; i += 1) {
      const ts = now();
      const [row] = await scoped.insert(conversations, {
        titre: `fil ${String(i).padStart(2, "0")}`,
        archivedAt: null,
        createdAt: ts,
        updatedAt: ts,
      });
      ids.push(row.id);
    }
    const oldestIds = ids.slice(0, overflow); // les `overflow` plus vieux (updated_at croissant)

    const archivedCount = await convoRepo(userA.id).purgeBeyondThreshold();
    expect(archivedCount).toBe(overflow);

    // Le seuil exact de fils reste ACTIF.
    expect(await convoRepo(userA.id).listActive()).toHaveLength(
      MAX_CONVERSATIONS_PER_TENANT,
    );
    // Les fils archivés sont précisément les plus VIEUX.
    for (const id of oldestIds) {
      expect(await convoRepo(userA.id).findById(id)).toBeNull();
    }
    // JAMAIS de DELETE : tout existe toujours physiquement.
    expect(await physicalA()).toHaveLength(total);
    const archivedRows = await db
      .select()
      .from(conversations)
      .where(isNotNull(conversations.archivedAt));
    expect(archivedRows).toHaveLength(overflow);

    // IDEMPOTENT : rejouer sous le seuil n'archive plus rien.
    expect(await convoRepo(userA.id).purgeBeyondThreshold()).toBe(0);
    expect(await convoRepo(userA.id).listActive()).toHaveLength(
      MAX_CONVERSATIONS_PER_TENANT,
    );
  });

  it("CAP-6 : la purge se déclenche à la CRÉATION d'un nouveau fil (borne appliquée par la porte)", async () => {
    // On crée jusqu'au seuil + 1 via `create` (qui purge à chaque écriture) : la borne se maintient.
    for (let i = 0; i < MAX_CONVERSATIONS_PER_TENANT + 1; i += 1) {
      await convoRepo(userA.id).create({ firstUserMessage: `fil ${i}` });
    }
    // Jamais plus que le seuil de fils ACTIFS.
    expect(await convoRepo(userA.id).listActive()).toHaveLength(
      MAX_CONVERSATIONS_PER_TENANT,
    );
    // Le fil le PLUS RÉCENT (le dernier créé) est bien actif (jamais purgé).
    const list = await convoRepo(userA.id).listActive();
    expect(list[0]!.titre).toBe(`fil ${MAX_CONVERSATIONS_PER_TENANT}`);
    // Et rien n'est hard-deleté : total physique = seuil + 1.
    expect(await physicalA()).toHaveLength(MAX_CONVERSATIONS_PER_TENANT + 1);
  });
});
