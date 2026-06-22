// REWIND transactionnel d'un tour (copilote Phase 2 inc.4, CAP-2 + CAP-3).
//
// On prouve les success criteria :
//   - CAP-2 : rewind d'un tour = undo EXACT (contacts re-archivés, brouillon retiré SOFT), AUCUNE
//     ligne hard-deletée, le rewind LUI-MÊME journalisé (op="rewind" référençant les turnId) ;
//   - CAP-3 : l'inverse d'une FUSION/RÉACTIVATION restaure l'état antérieur (prevState) — un
//     contact vivant préexistant n'est JAMAIS archivé/perdu par le rewind d'un tour qui n'a fait
//     que le modifier ; l'`op` (created vs merged vs reactivated) sélectionne le bon inverse ;
//   - ORDRE LIFO : le rewind d'un tour annule ce tour ET ses tours postérieurs, en ordre inverse.
//
// La logique de rewind est PURE (`replayRewind`), orchestrant les repositories scopés — jamais de
// Drizzle nu (sauf lecture d'assertion, autorisée dans tests/db/**).

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  actionLogRepository,
  contactsRepository,
  forUserDb,
  messagesRepository,
  type JournalSink,
} from "@/lib/db";
import {
  archiveContact,
  archiveContacts,
  archiveDraftTool,
  createContact,
  importContacts,
  updateContact,
} from "@/lib/agent/tools.server";
import { replayRewind } from "@/features/copilote/rewind";
import type { Clock } from "@/lib/domain/time";

import {
  actionLog,
  contacts,
  makeTestDb,
  messages,
  seedUsers,
  type TestDb,
} from "./harness";
import { makeUser } from "../factories/user";

// Horloge MONOTONE : des tours distincts → horodatages distincts (socle de l'ordre LIFO).
function monotonicClock(start = 1_700_000_000_000, step = 1000): Clock {
  let t = start;
  return () => (t += step);
}

/** Sink de journalisation (comme `buildTools`), liée à un `turnId`+`toolName`. */
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

describe("rewind — undo exact, soft, journalisé (CAP-2/CAP-3)", () => {
  let db: TestDb;
  const user = makeUser({ name: "Alice" });
  let now: Clock;

  const contactsRepo = () => contactsRepository(forUserDb(db, user.id, now));
  const messagesRepo = () => messagesRepository(forUserDb(db, user.id, now));
  const actionLogRepo = () => actionLogRepository(forUserDb(db, user.id, now));

  const journal =
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

  const deps = () => ({
    actionLog: actionLogRepo(),
    contacts: contactsRepo(),
    messages: messagesRepo(),
  });

  beforeEach(async () => {
    db = await makeTestDb();
    now = monotonicClock();
    await seedUsers(db, [user]);
  });

  it("annule un tour (contact créé re-archivé + brouillon retiré), sans hard-delete, et se journalise", async () => {
    // Tour t1 : crée un contact, puis un brouillon lié à ce contact.
    const c = await createContact(
      contactsRepo(),
      { nom: "Sophie", email: "s@x.test" },
      journal("t1", "createContact"),
    );
    await messagesRepo().createDraft(
      { contactId: c.id, canal: "linkedin", texte: "Salut Sophie !" },
      journal("t1", "composeMessage"),
    );

    // Pré-condition : contact visible + 1 brouillon visible.
    expect(await contactsRepo().list()).toHaveLength(1);
    expect(await messagesRepo().listForContact(c.id)).toHaveLength(1);

    const summary = await replayRewind(deps(), "t1");
    expect(summary.contacts).toBe(1);
    expect(summary.messages).toBe(1);
    expect(summary.turnIds).toEqual(["t1"]);

    // Contact RE-ARCHIVÉ (invisible aux lectures), brouillon RETIRÉ (soft).
    expect(await contactsRepo().list()).toHaveLength(0);
    expect(await messagesRepo().listForContact(c.id)).toHaveLength(0);

    // AUCUN hard-delete : les lignes existent TOUJOURS physiquement, juste archivées.
    const rawContacts = await db.select().from(contacts);
    const rawMessages = await db.select().from(messages);
    expect(rawContacts).toHaveLength(1);
    expect(rawContacts[0]!.archivedAt).not.toBeNull();
    expect(rawMessages).toHaveLength(1);
    expect(rawMessages[0]!.archivedAt).not.toBeNull();

    // Le rewind est JOURNALISÉ (audit), pas effaçant : entrées d'origine CONSERVÉES + 1 rewind.
    const log = await db.select().from(actionLog);
    const rewindEntry = log.find((r) => r.op === "rewind");
    expect(rewindEntry).toBeDefined();
    expect((rewindEntry!.prevState as { turnIds?: string[] }).turnIds).toContain(
      "t1",
    );
    // Les 2 entrées de mutation d'origine n'ont pas été supprimées.
    expect(log.filter((r) => r.op === "created")).toHaveLength(2);
  });

  it("FUSION : rewind du tour de fusion RESTAURE prevState sans archiver le contact préexistant (CAP-3)", async () => {
    // t1 crée le contact (Acme) ; t2 le FUSIONNE (Globex). Le contact PRÉEXISTE au tour t2.
    const a = await createContact(
      contactsRepo(),
      { nom: "Sophie", email: "s@x.test", entreprise: "Acme" },
      journal("t1", "createContact"),
    );
    await createContact(
      contactsRepo(),
      { nom: "Sophie", email: "s@x.test", entreprise: "Globex" },
      journal("t2", "createContact"),
    );
    // Après fusion : entreprise = Globex (champ écrasé).
    expect((await contactsRepo().get(a.id))!.entreprise).toBe("Globex");

    // Rewind du SEUL tour de fusion (t2) : restaure l'entreprise antérieure, NE l'archive PAS.
    const summary = await replayRewind(deps(), "t2");
    expect(summary.turnIds).toEqual(["t2"]); // t1 (antérieur) NON touché
    const restored = await contactsRepo().get(a.id);
    expect(restored).toBeDefined(); // toujours ACTIF — pas d'archivage aveugle
    expect(restored!.entreprise).toBe("Acme"); // état antérieur EXACT restauré

    // Rewind ENSUITE du tour de création (t1) : là, le contact créé est re-archivé.
    await replayRewind(deps(), "t1");
    expect(await contactsRepo().get(a.id)).toBeUndefined();
    expect((await contactsRepo().get(a.id, { includeArchived: true }))!.archivedAt).not.toBeNull();
  });

  it("7.4 (AC#6) : rewind d'updateContact RESTAURE l'état antérieur EXACT (handles complets inclus)", async () => {
    // t1 crée la fiche (handles linkedin) ; t2 l'édite (entreprise + ajoute phone, garde linkedin).
    const c = await createContact(
      contactsRepo(),
      { nom: "Amoussou", entreprise: "Acme" },
      journal("t1", "createContact"),
    );
    await contactsRepo().update(c.id, { handles: { linkedin: "ancien" } }); // état de départ (non journalisé)
    await updateContact(
      contactsRepo(),
      { contactId: c.id, entreprise: "Globex", handles: { phone: "+33612345678" } },
      journal("t2", "updateContact"),
    );
    // Après édition : entreprise écrasée + handles fusionnés (linkedin préservé).
    const edited = (await contactsRepo().get(c.id))!;
    expect(edited.entreprise).toBe("Globex");
    expect(edited.handles).toEqual({ linkedin: "ancien", phone: "+33612345678" });

    // Rewind du SEUL tour d'édition (t2) : restaure l'antérieur, n'archive PAS la fiche.
    const summary = await replayRewind(deps(), "t2");
    expect(summary.turnIds).toEqual(["t2"]); // t1 (création) non touché
    const restored = (await contactsRepo().get(c.id))!;
    expect(restored).toBeDefined(); // toujours active
    expect(restored.entreprise).toBe("Acme"); // valeur antérieure
    expect(restored.handles).toEqual({ linkedin: "ancien" }); // handles COMPLETS d'avant (phone disparu)
  });

  it("RÉACTIVATION : rewind restaure l'archivedAt antérieur EXACT ; un actif préexistant est intact (CAP-3)", async () => {
    // Pré-état : un contact ARCHIVÉ (Zoé) + un contact ACTIF préexistant (Max).
    const zoe = await createContact(contactsRepo(), { nom: "Zoé", email: "z@x.test" });
    await contactsRepo().remove(zoe.id);
    const zoeArchived = (await db.select().from(contacts).where(eq(contacts.id, zoe.id)))[0]!;
    const prevArchivedAt = zoeArchived.archivedAt;

    const max = await createContact(contactsRepo(), { nom: "Max", email: "m@x.test" });

    // t1 : importe [Zoé (réactive), Neo (crée), Max (déjà actif → skip, AUCUNE mutation)].
    await importContacts(
      contactsRepo(),
      {
        contacts: [
          { nom: "Zoé", email: "z@x.test" },
          { nom: "Neo", email: "n@x.test" },
          { nom: "Max", email: "m@x.test" },
        ],
      },
      journal("t1", "importContacts"),
    );
    // Zoé réactivée (visible) ; Neo créé ; Max toujours là.
    expect(await contactsRepo().get(zoe.id)).toBeDefined();

    await replayRewind(deps(), "t1");

    // Zoé RE-ARCHIVÉE à son archivedAt ANTÉRIEUR exact (pas un re-archivage à `now`).
    const zoeAfter = (await db.select().from(contacts).where(eq(contacts.id, zoe.id)))[0]!;
    expect(zoeAfter.archivedAt).toBe(prevArchivedAt);
    // Neo (créé au tour) : archivé.
    expect(await contactsRepo().get(max.id)).toBeDefined(); // Max, actif préexistant : INTACT
    const visibles = await contactsRepo().list();
    // Seul Max reste visible : Zoé re-archivée, Neo archivé. Le préexistant actif survit.
    expect(visibles.map((c) => c.nom)).toEqual(["Max"]);
  });

  it("LIFO : rewind d'un tour annule CE tour ET les tours postérieurs (ordre inverse)", async () => {
    // t1 crée A ; t2 crée B. Rewind t1 doit annuler t1 ET t2 (postérieur).
    const a = await createContact(contactsRepo(), { nom: "A", email: "a@x.test" }, journal("t1", "createContact"));
    const b = await createContact(contactsRepo(), { nom: "B", email: "b@x.test" }, journal("t2", "createContact"));

    const summary = await replayRewind(deps(), "t1");
    expect(new Set(summary.turnIds)).toEqual(new Set(["t1", "t2"]));
    // Les deux contacts sont archivés.
    expect(await contactsRepo().get(a.id)).toBeUndefined();
    expect(await contactsRepo().get(b.id)).toBeUndefined();
  });

  it("IDEMPOTENCE : rewind d'un tour déjà annulé est un no-op (pas de double-inverse)", async () => {
    await createContact(contactsRepo(), { nom: "Sophie", email: "s@x.test" }, journal("t1", "createContact"));
    const first = await replayRewind(deps(), "t1");
    expect(first.reversed).toBeGreaterThan(0);

    const second = await replayRewind(deps(), "t1");
    expect(second.reversed).toBe(0); // tour déjà annulé → rien à inverser
    expect(second.turnIds).toEqual([]);
  });

  it("ARCHIVE contact : rewind DÉSARCHIVE le contact (l'inverse d'archiveContact restaure l'actif)", async () => {
    // Un contact ACTIF préexistant (créé hors tour journalisé). t1 l'archive.
    const c = await createContact(contactsRepo(), { nom: "Sophie", email: "s@x.test" });
    expect(await contactsRepo().get(c.id)).toBeDefined();

    await archiveContact(
      contactsRepo(),
      { contactId: c.id },
      journal("t1", "archiveContact"),
    );
    // Archivé : invisible aux lectures.
    expect(await contactsRepo().get(c.id)).toBeUndefined();

    await replayRewind(deps(), "t1");
    // DÉSARCHIVÉ : le contact retrouve son état actif (archivedAt remis à null).
    const restored = await contactsRepo().get(c.id);
    expect(restored).toBeDefined();
    expect(restored!.archivedAt).toBeNull();
  });

  it("ARCHIVE en bloc : rewind désarchive TOUS les contacts du lot (réversibilité de masse)", async () => {
    const a = await createContact(contactsRepo(), { nom: "A", email: "a@x.test" });
    const b = await createContact(contactsRepo(), { nom: "B", email: "b@x.test" });
    const res = await archiveContacts(
      contactsRepo(),
      { contactIds: [a.id, b.id] },
      journal("t1", "archiveContacts"),
    );
    expect(res.archived).toBe(2);
    expect(await contactsRepo().list()).toHaveLength(0);

    await replayRewind(deps(), "t1");
    // Les deux réapparaissent (chaque archivage du lot était journalisé sous t1).
    expect(await contactsRepo().list()).toHaveLength(2);
  });

  it("ARCHIVE brouillon : rewind RESTAURE le brouillon retiré (inverse d'archiveDraft)", async () => {
    const c = await createContact(contactsRepo(), { nom: "Sophie", email: "s@x.test" });
    const draft = await messagesRepo().createDraft({
      contactId: c.id,
      canal: "linkedin",
      texte: "Brouillon à retirer puis restaurer",
    });
    await archiveDraftTool(
      messagesRepo(),
      { messageId: draft.id },
      journal("t1", "archiveDraft"),
    );
    expect(await messagesRepo().listForContact(c.id)).toHaveLength(0);

    await replayRewind(deps(), "t1");
    // Le brouillon réapparaît dans la timeline du contact.
    const msgs = await messagesRepo().listForContact(c.id);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.statut).toBe("brouillon");
    expect(msgs[0]!.archivedAt).toBeNull();
  });

  it("FUSION sans champ écrasé : rewind est un no-op exact (le préexistant reste intact)", async () => {
    // t1 crée Sophie (clé e-mail) ; t2 re-ajoute la MÊME clé SANS aucun champ optionnel → fusion
    // qui n'écrase RIEN (prevState vide). Rewind t2 ne doit ni archiver ni altérer le contact.
    const a = await createContact(
      contactsRepo(),
      { nom: "Sophie", email: "s@x.test", entreprise: "Acme" },
      journal("t1", "createContact"),
    );
    await createContact(contactsRepo(), { nom: "Sophie", email: "s@x.test" }, journal("t2", "createContact"));

    await replayRewind(deps(), "t2");
    const after = await contactsRepo().get(a.id);
    expect(after).toBeDefined(); // toujours actif (jamais archivé par une fusion qu'on annule)
    expect(after!.entreprise).toBe("Acme"); // rien n'avait été écrasé → rien à restaurer
  });
});

describe("rewind — atomicité, garde brouillon, isolement tenant (revue inc.4)", () => {
  let db: TestDb;
  const userA = makeUser({ name: "Alice" });
  const userB = makeUser({ name: "Bob" });
  let now: Clock;

  const cRepo = (u: string) => contactsRepository(forUserDb(db, u, now));
  const mRepo = (u: string) => messagesRepository(forUserDb(db, u, now));
  const lRepo = (u: string) => actionLogRepository(forUserDb(db, u, now));
  const depsFor = (u: string) => ({
    actionLog: lRepo(u),
    contacts: cRepo(u),
    messages: mRepo(u),
  });

  beforeEach(async () => {
    db = await makeTestDb();
    now = monotonicClock();
    await seedUsers(db, [userA, userB]);
  });

  it("ATOMICITÉ : si une étape du rewind échoue dans la transaction, TOUT est annulé (rollback)", async () => {
    const c = await createContact(
      cRepo(userA.id),
      { nom: "Sophie", email: "s@x.test" },
      makeJournal("t1", "createContact"),
    );

    // On rejoue le rewind DANS une transaction scopée (comme la server action), mais avec un
    // `recordRewind` SABOTÉ (dernière étape) → toute la transaction doit être annulée.
    const scoped = forUserDb(db, userA.id, now);
    await expect(
      scoped.transaction(async (tx) =>
        replayRewind(
          {
            actionLog: {
              entriesToReverse: actionLogRepository(tx).entriesToReverse,
              recordRewind: async () => {
                throw new Error("audit sabotage");
              },
            },
            contacts: contactsRepository(tx),
            messages: messagesRepository(tx),
          },
          "t1",
        ),
      ),
    ).rejects.toThrow(/sabotage/);

    // Rollback total : le contact N'A PAS été re-archivé (toujours visible), AUCUNE entrée
    // `rewind` n'a été écrite. L'undo est tout-ou-rien.
    expect(await cRepo(userA.id).get(c.id)).toBeDefined();
    const log = await db.select().from(actionLog);
    expect(log.some((r) => r.op === "rewind")).toBe(false);
  });

  it("GARDE brouillon : un brouillon PROMU 'envoye' n'est PAS retiré par le rewind (corpus préservé)", async () => {
    const c = await createContact(cRepo(userA.id), { nom: "Sophie", email: "s@x.test" });
    const draft = await mRepo(userA.id).createDraft(
      { contactId: c.id, canal: "linkedin", texte: "Bonjour Sophie" },
      makeJournal("t1", "composeMessage"),
    );
    // L'humain l'ENVOIE (brouillon → envoye) : le message quitte la sphère « brouillon agent ».
    const sent = await mRepo(userA.id).setStatus({ id: draft.id, statut: "envoye" });
    expect(sent.status).toBe("ok");

    await replayRewind(depsFor(userA.id), "t1");

    // Le message envoyé survit (toujours dans la timeline ET le corpus de voix) — jamais retiré.
    const msgs = await mRepo(userA.id).listForContact(c.id);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.statut).toBe("envoye");
    expect(await mRepo(userA.id).listSentTexts()).toContain("Bonjour Sophie");
  });

  it("ISOLEMENT tenant : B ne peut PAS rewind un tour de A (turnId étranger = no-op, données de A intactes)", async () => {
    const c = await createContact(
      cRepo(userA.id),
      { nom: "Secret de A", email: "a@x.test" },
      makeJournal("t1", "createContact"),
    );

    // B tente de rewind le tour "t1" de A : son journal scopé ne contient rien → no-op total.
    const summary = await replayRewind(depsFor(userB.id), "t1");
    expect(summary.reversed).toBe(0);
    expect(summary.turnIds).toEqual([]);

    // Le contact de A est INTACT (jamais archivé par la tentative de B).
    expect(await cRepo(userA.id).get(c.id)).toBeDefined();
    // Aucune entrée `rewind` n'a été écrite (ni chez B, ni chez A).
    const log = await db.select().from(actionLog);
    expect(log.some((r) => r.op === "rewind")).toBe(false);
  });
});
