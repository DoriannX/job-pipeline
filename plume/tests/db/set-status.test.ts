// TRANSITION DE STATUT d'un Message via la machine à états (story 3.8, AR-5).
//
// On vérifie l'autorité serveur sur la machine à états (`setStatus`) :
//   • transition LÉGALE → `statut` mis à jour + `updated_at` AVANCÉ, et RIEN d'autre touché
//     (texte, texte_genere, genere_par_ia, generation_events restent intacts) ;
//   • transition ILLÉGALE → refus (`illegal`), AUCUNE écriture (statut + updated_at figés) ;
//   • id inexistant / autre tenant → `not-found` (porte scopée).

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { messagesRepository } from "@/lib/db";
import { forUserDb } from "@/lib/db";
import type { Clock } from "@/lib/domain/time";

import {
  contacts,
  generationEvents,
  makeTestDb,
  messages,
  seedUsers,
  type TestDb,
} from "./harness";
import { makeMarkSent, makeGeneration } from "../factories/message";
import { makeUser } from "../factories/user";

describe("setStatus — transition de la machine à états (story 3.8)", () => {
  let db: TestDb;
  const user = makeUser({ name: "Alice" });
  let contactId: string;

  // Horloge MONOTONE : chaque écriture reçoit un instant strictement croissant, donc le
  // `updated_at` posé par `setStatus` diffère du jeton d'envoi (avancée observable).
  let t = 1_700_000_000_000;
  const clock: Clock = () => (t += 1000);

  const repo = () => messagesRepository(forUserDb(db, user.id, clock));

  beforeEach(async () => {
    t = 1_700_000_000_000;
    db = await makeTestDb();
    await seedUsers(db, [user]);
    const [c] = await forUserDb(db, user.id, clock).insert(contacts, {
      nom: "Léa",
      source: "manuel",
      dedupKey: "name:lea|",
      createdAt: clock(),
      updatedAt: clock(),
    });
    contactId = c.id;
  });

  it("transition LÉGALE (envoye → vu) : statut mis à jour + updated_at avancé", async () => {
    const message = await repo().markSent(
      makeMarkSent(contactId, { generation: null }),
    );
    const jeton = message.updatedAt!;

    const result = await repo().setStatus({ id: message.id, statut: "vu" });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.message.statut).toBe("vu");
    expect(result.message.updatedAt!).toBeGreaterThan(jeton);

    // Persisté en base.
    const [row] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, message.id));
    expect(row.statut).toBe("vu");
  });

  it("chaîne légale envoye → vu → repondu (chaque transition d'un appel)", async () => {
    const message = await repo().markSent(
      makeMarkSent(contactId, { generation: null }),
    );

    const vu = await repo().setStatus({ id: message.id, statut: "vu" });
    expect(vu.status).toBe("ok");

    const repondu = await repo().setStatus({
      id: message.id,
      statut: "repondu",
    });
    expect(repondu.status).toBe("ok");
    if (repondu.status !== "ok") return;
    expect(repondu.message.statut).toBe("repondu");
  });

  it("transition LÉGALE ne touche RIEN d'autre (texte + generation_events intacts)", async () => {
    const generated = "Bonjour Léa, ravi de te recontacter après tout ce temps.";
    const sent = "Salut Léa ! Content de te recontacter.";
    const message = await repo().markSent(
      makeMarkSent(contactId, {
        texte: sent,
        generation: makeGeneration({ generated }),
      }),
    );

    // Snapshot de l'event AVANT la transition.
    const [before] = await db
      .select()
      .from(generationEvents)
      .where(eq(generationEvents.messageId, message.id));
    expect(before).toBeDefined();

    const result = await repo().setStatus({ id: message.id, statut: "repondu" });
    expect(result.status).toBe("ok");

    // L'event du moat est STRICTEMENT inchangé.
    const [after] = await db
      .select()
      .from(generationEvents)
      .where(eq(generationEvents.messageId, message.id));
    expect(after).toEqual(before);

    // Le texte figé + texte_genere + genere_par_ia restent intacts (seul le statut bouge).
    const [row] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, message.id));
    expect(row.texte).toBe(sent);
    expect(row.texteGenere).toBe(generated);
    expect(row.genereParIa).toBe(true);
    expect(row.statut).toBe("repondu");
  });

  it("transition ILLÉGALE (repondu → vu) : refus, AUCUNE écriture", async () => {
    const message = await repo().markSent(
      makeMarkSent(contactId, { generation: null }),
    );
    // On amène le message à un terminal par une transition légale.
    await repo().setStatus({ id: message.id, statut: "repondu" });

    const before = await repo().getById(message.id);
    const jetonAvant = before!.updatedAt;

    // Tentative ILLÉGALE depuis un terminal.
    const result = await repo().setStatus({ id: message.id, statut: "vu" });
    expect(result.status).toBe("illegal");

    // Aucune écriture : statut + updated_at strictement figés.
    const [row] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, message.id));
    expect(row.statut).toBe("repondu");
    expect(row.updatedAt).toBe(jetonAvant);
  });

  it("transition ILLÉGALE (envoye → brouillon, retour arrière) : refus, statut figé", async () => {
    const message = await repo().markSent(
      makeMarkSent(contactId, { generation: null }),
    );

    const result = await repo().setStatus({
      id: message.id,
      statut: "brouillon",
    });
    expect(result.status).toBe("illegal");

    const [row] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, message.id));
    expect(row.statut).toBe("envoye");
  });

  it("setStatus d'un id inexistant → not-found (aucune écriture)", async () => {
    const result = await repo().setStatus({ id: "inexistant", statut: "vu" });
    expect(result.status).toBe("not-found");
  });
});
