// ÉCRITURE ATOMIQUE de l'envoi (story 3.6, AR-8, SM-1).
//
// On vérifie le cœur du moat : `markSent` écrit, DANS UNE transaction scopée :
//   (a) le Message FIGÉ (statut 'envoye', `envoye_at` posé, texte final) ;
//   (b) le `generation_events` (generated/sent/edit_distance/tokens/versions) SI génération ;
//   (c) la mise à jour de `contacts.dernier_contact_at` (la froideur devient vivante).
// Un texte tapé MAIN (generation:null) → Message seul, `genere_par_ia=false`, AUCUN event.
// Si une écriture de la transaction échoue → ROLLBACK TOTAL (ni message ni event).

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { messagesRepository } from "@/lib/db";
import { normalizedLevenshtein } from "@/lib/domain/edit-distance";
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

const now: Clock = () => 1_700_000_000_000;

describe("markSent — écriture atomique du moat (story 3.6)", () => {
  let db: TestDb;
  const user = makeUser({ name: "Alice" });
  let contactId: string;

  const repo = () => messagesRepository(forUserDb(db, user.id, now));

  beforeEach(async () => {
    db = await makeTestDb();
    await seedUsers(db, [user]);
    // Un contact JAMAIS contacté (dernier_contact_at NULL) pour observer la maj.
    const [c] = await forUserDb(db, user.id, now).insert(contacts, {
      nom: "Léa",
      source: "manuel",
      dedupKey: "name:lea|",
      createdAt: now(),
      updatedAt: now(),
    });
    contactId = c.id;
  });

  it("génération : écrit message FIGÉ + generation_events ENSEMBLE", async () => {
    const generated = "Bonjour Léa, ravi de te recontacter après tout ce temps.";
    const sent = "Salut Léa ! Content de te recontacter après tout ce temps.";
    const input = makeMarkSent(contactId, {
      texte: sent,
      generation: makeGeneration({
        generated,
        voiceExamplesRef: ["seed1", "message:0"],
        tokens: { input: 130, output: 50 },
      }),
    });

    const message = await repo().markSent(input);

    // Message figé : statut 'envoye', envoye_at posé, texte FINAL, genere_par_ia=true,
    // texte_genere = sortie IA d'origine.
    expect(message.statut).toBe("envoye");
    expect(message.envoyeAt).toBe(now());
    expect(message.texte).toBe(sent);
    expect(message.texteGenere).toBe(generated);
    expect(message.genereParIa).toBe(true);
    expect(message.userId).toBe(user.id);

    // generation_events lié au message, edit_distance = distance normalisée généré→envoyé.
    const events = await db
      .select()
      .from(generationEvents)
      .where(eq(generationEvents.messageId, message.id));
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.userId).toBe(user.id);
    expect(ev.contactId).toBe(contactId);
    expect(ev.generated).toBe(generated);
    expect(ev.sent).toBe(sent);
    expect(ev.editDistance).toBeCloseTo(
      normalizedLevenshtein(generated, sent),
      10,
    );
    expect(ev.rawIntent).toBe("reprendre contact avec Léa");
    expect(ev.promptVersion).toBe(1);
    expect(ev.modelId).toBe("claude-haiku-4-5");
    expect(ev.sanitizeVersion).toBe(1);
    expect(ev.tokensInput).toBe(130);
    expect(ev.tokensOutput).toBe(50);
    // voice_examples_ref = JSON des ids injectés.
    expect(JSON.parse(ev.voiceExamplesRef ?? "[]")).toEqual(["seed1", "message:0"]);
  });

  it("texte tapé MAIN (generation:null) : message SEUL, aucun generation_events", async () => {
    const message = await repo().markSent(
      makeMarkSent(contactId, {
        texte: "Coucou, on se voit quand ?",
        generation: null,
      }),
    );

    expect(message.genereParIa).toBe(false);
    expect(message.texteGenere).toBeNull();
    expect(message.statut).toBe("envoye");

    // AUCUN event : un Message manuel n'instrumente pas le moat.
    const events = await db
      .select()
      .from(generationEvents)
      .where(eq(generationEvents.messageId, message.id));
    expect(events).toHaveLength(0);
  });

  it("met à jour contacts.dernier_contact_at (la froideur devient vivante)", async () => {
    const t = 1_700_000_500_000;
    const clock: Clock = () => t;
    const r = messagesRepository(forUserDb(db, user.id, clock));

    await r.markSent(makeMarkSent(contactId, { generation: null }));

    const [c] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId));
    expect(c.dernierContactAt).toBe(t);
  });

  it("ROLLBACK TOTAL si une écriture de la transaction échoue", async () => {
    // On injecte une erreur EN COURS de transaction via une porte dont `update` lève
    // (la maj du contact, étape (c)). Le message + l'event (a/b) doivent être annulés.
    const scoped = forUserDb(db, user.id, now);
    const sabotaged = {
      ...scoped,
      async transaction<T>(fn: (tx: typeof scoped) => Promise<T>): Promise<T> {
        return scoped.transaction(async (tx) => {
          const brokenTx = {
            ...tx,
            update: async () => {
              throw new Error("écriture sabotée (maj contact)");
            },
          };
          return fn(brokenTx as typeof scoped);
        });
      },
    };

    const repoKo = messagesRepository(sabotaged as typeof scoped);

    await expect(
      repoKo.markSent(makeMarkSent(contactId)),
    ).rejects.toThrow(/sabotée/);

    // Aucun message, aucun event : la transaction a tout annulé.
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.contactId, contactId));
    expect(msgs).toHaveLength(0);
    const events = await db.select().from(generationEvents);
    expect(events).toHaveLength(0);
    // Le contact n'a PAS été marqué (dernier_contact_at toujours NULL).
    const [c] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId));
    expect(c.dernierContactAt).toBeNull();
  });

  it("refuse un contactId HORS-TENANT (orphelin) : rollback, rien écrit", async () => {
    // Un contact appartenant à un AUTRE user (Mallory).
    const autre = makeUser({ name: "Mallory" });
    await seedUsers(db, [autre]);
    const [foreign] = await forUserDb(db, autre.id, now).insert(contacts, {
      nom: "Victime",
      source: "manuel",
      dedupKey: "name:victime|",
      createdAt: now(),
      updatedAt: now(),
    });

    // Alice tente d'enregistrer un message vers le contact de Mallory : la garde
    // d'appartenance (findFirst scopé) ne le voit pas → rejet + rollback total.
    await expect(
      repo().markSent(makeMarkSent(foreign.id, { generation: null })),
    ).rejects.toThrow(/introuvable/i);

    // Aucun message ni event créé (ni côté Alice, ni pointant vers le contact de Mallory).
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.contactId, foreign.id));
    expect(msgs).toHaveLength(0);
    const events = await db.select().from(generationEvents);
    expect(events).toHaveLength(0);
  });

  it("listForContact rend les Messages récent → ancien ; listSentTexts ne rend que les envoyés", async () => {
    let t = 1_700_000_000_000;
    const clock: Clock = () => (t += 1000);
    const r = messagesRepository(forUserDb(db, user.id, clock));

    await r.markSent(makeMarkSent(contactId, { texte: "le plus ancien", generation: null }));
    await r.markSent(makeMarkSent(contactId, { texte: "au milieu", generation: null }));
    await r.markSent(makeMarkSent(contactId, { texte: "le plus récent", generation: null }));

    const list = await r.listForContact(contactId);
    expect(list.map((m) => m.texte)).toEqual([
      "le plus récent",
      "au milieu",
      "le plus ancien",
    ]);

    // Tous au statut 'envoye' → corpus de voix complet, récent → ancien.
    const corpus = await r.listSentTexts();
    expect(corpus).toEqual(["le plus récent", "au milieu", "le plus ancien"]);
  });
});
