// ÉDITION d'un message envoyé avec VERROU OPTIMISTE (story 3.7, AR-12).
//
// On vérifie l'autorité serveur sur `Sent` :
//   • `markSent` pose `updated_at` (= `envoye_at` au départ) — le 1er jeton de version ;
//   • `editSent` met à jour `texte` + `updated_at` et GARDE `statut='envoye'` ;
//   • CONCURRENCE : deux `editSent` avec le MÊME `expectedUpdatedAt` → le 1er réussit
//     (nouveau jeton), le 2e est en CONFLIT (0 ligne, aucune écriture) — prouve le 409 ;
//   • `generation_events` reste INTACT après une édition (historique du moat, AR-12) ;
//   • `getById` lit l'état courant scopé (null hors tenant).

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

describe("editSent — verrou optimiste sur un message envoyé (story 3.7)", () => {
  let db: TestDb;
  const user = makeUser({ name: "Alice" });
  let contactId: string;

  // Horloge MONOTONE : chaque écriture reçoit un instant strictement croissant, donc le
  // `updated_at` posé par `editSent` diffère du jeton d'envoi (jetons distincts observables).
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

  it("markSent pose updated_at = envoye_at (1er jeton de version)", async () => {
    const message = await repo().markSent(
      makeMarkSent(contactId, { generation: null }),
    );
    expect(message.updatedAt).not.toBeNull();
    expect(message.updatedAt).toBe(message.envoyeAt);
  });

  it("editSent met à jour texte + updated_at, garde statut='envoye'", async () => {
    const message = await repo().markSent(
      makeMarkSent(contactId, { texte: "premier jet", generation: null }),
    );
    const jeton = message.updatedAt!;

    const result = await repo().editSent({
      id: message.id,
      texte: "version retouchée",
      expectedUpdatedAt: jeton,
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.message.texte).toBe("version retouchée");
    // Le statut ne bouge pas (reste 'envoye') ; le jeton est RÉ-ÉCRIT (strictement après).
    expect(result.message.statut).toBe("envoye");
    expect(result.message.updatedAt).not.toBe(jeton);
    expect(result.message.updatedAt!).toBeGreaterThan(jeton);

    // Persisté en base : le texte figé final est bien la version retouchée.
    const [row] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, message.id));
    expect(row.texte).toBe("version retouchée");
    expect(row.statut).toBe("envoye");
  });

  it("CONCURRENCE : deux editSent avec le MÊME jeton → 1er OK, 2e CONFLIT (409), aucune écriture", async () => {
    const message = await repo().markSent(
      makeMarkSent(contactId, { texte: "origine", generation: null }),
    );
    const jeton = message.updatedAt!;

    // Premier éditeur : réussit, obtient un NOUVEAU jeton.
    const first = await repo().editSent({
      id: message.id,
      texte: "édité par le 1er",
      expectedUpdatedAt: jeton,
    });
    expect(first.status).toBe("ok");

    // Second éditeur : MÊME jeton périmé → CONFLIT (l'autorité serveur rejette).
    const second = await repo().editSent({
      id: message.id,
      texte: "édité par le 2e (ne doit PAS passer)",
      expectedUpdatedAt: jeton,
    });
    expect(second.status).toBe("conflict");

    // Aucune écriture du 2e : le texte en base est celui du 1er éditeur.
    const [row] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, message.id));
    expect(row.texte).toBe("édité par le 1er");
  });

  it("generation_events reste INTACT après editSent (historique du moat, AR-12)", async () => {
    const generated = "Bonjour Léa, ravi de te recontacter après tout ce temps.";
    const sent = "Salut Léa ! Content de te recontacter.";
    const message = await repo().markSent(
      makeMarkSent(contactId, {
        texte: sent,
        generation: makeGeneration({ generated }),
      }),
    );

    // Snapshot de l'event AVANT édition.
    const [before] = await db
      .select()
      .from(generationEvents)
      .where(eq(generationEvents.messageId, message.id));
    expect(before).toBeDefined();

    const result = await repo().editSent({
      id: message.id,
      texte: "texte ré-édité après coup",
      expectedUpdatedAt: message.updatedAt!,
    });
    expect(result.status).toBe("ok");

    // L'event est STRICTEMENT inchangé : generated/sent/edit_distance figés à l'envoi.
    const [after] = await db
      .select()
      .from(generationEvents)
      .where(eq(generationEvents.messageId, message.id));
    expect(after).toEqual(before);
    expect(after.generated).toBe(generated);
    expect(after.sent).toBe(sent);
    expect(after.editDistance).toBe(before.editDistance);

    // Et le `texte_genere` du message d'origine est lui aussi intact (figé à l'envoi).
    const [row] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, message.id));
    expect(row.texteGenere).toBe(generated);
    expect(row.genereParIa).toBe(true);
  });

  it("editSent d'un id inexistant → not-found (aucune écriture)", async () => {
    const result = await repo().editSent({
      id: "inexistant",
      texte: "peu importe",
      expectedUpdatedAt: 1,
    });
    expect(result.status).toBe("not-found");
  });

  it("getById lit l'état courant scopé (incluant le jeton updated_at)", async () => {
    const message = await repo().markSent(
      makeMarkSent(contactId, { texte: "à lire", generation: null }),
    );
    const read = await repo().getById(message.id);
    expect(read).not.toBeNull();
    expect(read!.id).toBe(message.id);
    expect(read!.updatedAt).toBe(message.updatedAt);

    expect(await repo().getById("inexistant")).toBeNull();
  });
});
