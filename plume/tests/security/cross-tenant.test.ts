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

import {
  contactsRepository,
  forUserDb,
  importJobsRepository,
  mergeCandidatesRepository,
  messagesRepository,
  processCsvImport,
  resolveMergeCandidate,
  seedVoixRepository,
} from "@/lib/db";
import type { Clock } from "@/lib/domain/time";

import {
  generationEvents,
  makeTestDb,
  seedUsers,
  testItems,
  type TestDb,
} from "../db/harness";
import { makeMarkSent } from "../factories/message";
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

  it("contacts.historique (story 3.10) : lisible par son tenant, JAMAIS hors tenant", async () => {
    // A crée un contact avec un historique privé.
    const aContact = await repoA().create({
      nom: "Camille",
      historique: "Moi : on se recroise au meetup ? Lui : oui, je te tiens au courant.",
    });

    // A relit SON historique en clair.
    expect((await repoA().get(aContact.id))?.historique).toContain(
      "on se recroise au meetup",
    );

    // B (qui connaîtrait l'id) ne lit RIEN : zéro fuite de l'historique cross-tenant.
    expect(await repoB().get(aContact.id)).toBeUndefined();

    // B tente d'écraser l'historique de A : aucune ligne touchée, A intact.
    expect(
      await repoB().update(aContact.id, { historique: "piraté par B" }),
    ).toBeUndefined();
    expect((await repoA().get(aContact.id))?.historique).toContain(
      "on se recroise au meetup",
    );
  });
});

describe("invariant n°1 — tables d'IMPORT `import_jobs` / `merge_candidates` (story 2.5)", () => {
  let db: TestDb;
  const userA = makeUser({ name: "Alice" });
  const userB = makeUser({ name: "Bob" });

  // Porte d'import complète (repos câblés) par tenant.
  const gate = (userId: string) => {
    const scoped = forUserDb(db, userId, now);
    const contacts = contactsRepository(scoped);
    return {
      contacts,
      importJobs: importJobsRepository(scoped),
      mergeCandidates: mergeCandidatesRepository(scoped),
      listContacts: contacts.list,
    };
  };

  beforeEach(async () => {
    db = await makeTestDb();
    await seedUsers(db, [userA, userB]);
  });

  it("import_jobs : un job de A est invisible/illisible pour B", async () => {
    const jobA = await importJobsRepository(forUserDb(db, userA.id, now)).start(
      "A.csv",
    );

    // A lit son job ; B (qui connaît l'id) ne le voit pas.
    expect(
      await importJobsRepository(forUserDb(db, userA.id, now)).get(jobA.id),
    ).toMatchObject({ id: jobA.id, userId: userA.id });
    expect(
      await importJobsRepository(forUserDb(db, userB.id, now)).get(jobA.id),
    ).toBeUndefined();
  });

  it("import_jobs : B ne peut pas finaliser (update) le job de A", async () => {
    const jobA = await importJobsRepository(forUserDb(db, userA.id, now)).start(
      null,
    );

    const pirated = await importJobsRepository(
      forUserDb(db, userB.id, now),
    ).finish(jobA.id, {
      status: "done",
      total: 9,
      created: 9,
      merged: 0,
      skipped: 0,
      reasons: [],
    });
    expect(pirated).toBeUndefined();

    // Le job de A est resté 'pending' (intact).
    const stillPending = await importJobsRepository(
      forUserDb(db, userA.id, now),
    ).get(jobA.id);
    expect(stillPending?.status).toBe("pending");
  });

  it("merge_candidates : la file de revue de A est invisible pour B", async () => {
    const g = gate(userA.id);
    // Crée une collision ambiguë chez A ➜ un candidat 'pending'.
    await g.contacts.create({
      nom: "Léa Martin",
      entreprise: "Acme",
      handles: { email: "lea@acme.fr" },
    });
    const job = await g.importJobs.start(null);
    await processCsvImport(
      job.id,
      { rows: [{ nom: "Léa Martin", entreprise: "Acme" }], skipped: [] },
      g,
    );

    // A voit son candidat ; B n'en voit aucun (zéro fuite).
    expect(await g.mergeCandidates.listPending()).toHaveLength(1);
    expect(
      await mergeCandidatesRepository(
        forUserDb(db, userB.id, now),
      ).listPending(),
    ).toHaveLength(0);
  });

  it("merge_candidates : B ne peut pas RÉSOUDRE le candidat de A (voie d'écriture la plus sensible)", async () => {
    const gA = gate(userA.id);
    // Collision ambiguë chez A ➜ un candidat 'pending'.
    await gA.contacts.create({
      nom: "Léa Martin",
      entreprise: "Acme",
      handles: { email: "lea@acme.fr" },
    });
    const job = await gA.importJobs.start(null);
    await processCsvImport(
      job.id,
      { rows: [{ nom: "Léa Martin", entreprise: "Acme" }], skipped: [] },
      gA,
    );
    const [candidate] = await gA.mergeCandidates.listPending();
    expect(candidate).toBeDefined();

    // B (qui connaîtrait l'id) tente de Fusionner ET de Garder séparés : refusé.
    const gB = gate(userB.id);
    const merged = await resolveMergeCandidate(candidate.id, "merge", {
      contacts: gB.contacts,
      mergeCandidates: gB.mergeCandidates,
    });
    const kept = await resolveMergeCandidate(candidate.id, "keep_separate", {
      contacts: gB.contacts,
      mergeCandidates: gB.mergeCandidates,
    });
    expect(merged).toBe(false);
    expect(kept).toBe(false);

    // Le candidat de A reste 'pending' ; B n'a créé aucun contact ; celui de A intact.
    expect(await gA.mergeCandidates.listPending()).toHaveLength(1);
    expect(await gB.contacts.list()).toHaveLength(0);
    expect(await gA.contacts.list()).toHaveLength(1);
  });

  it("import croisé : A et B importent le MÊME CSV ➜ chacun ses lignes, aucune fuite", async () => {
    const rows = [
      { nom: "Léa Martin", entreprise: "Acme", email: "lea@acme.fr" },
    ];
    const gA = gate(userA.id);
    const gB = gate(userB.id);

    const jobA = await gA.importJobs.start(null);
    const jobB = await gB.importJobs.start(null);
    await processCsvImport(jobA.id, { rows, skipped: [] }, gA);
    await processCsvImport(jobB.id, { rows, skipped: [] }, gB);

    const listA = await gA.contacts.list();
    const listB = await gB.contacts.list();
    expect(listA).toHaveLength(1);
    expect(listB).toHaveLength(1);
    expect(listA[0].userId).toBe(userA.id);
    expect(listB[0].userId).toBe(userB.id);
    expect(listA[0].id).not.toBe(listB[0].id);
  });
});

describe("invariant n°1 — table de VOIX `seed_voix` (story 3.5)", () => {
  let db: TestDb;
  const userA = makeUser({ name: "Alice" });
  const userB = makeUser({ name: "Bob" });

  // Repositories de la Voix montés au-dessus de la porte scopée, par tenant.
  const repoA = () => seedVoixRepository(forUserDb(db, userA.id, now));
  const repoB = () => seedVoixRepository(forUserDb(db, userB.id, now));

  beforeEach(async () => {
    db = await makeTestDb();
    // FK seed_voix.user_id → users.id : les deux users doivent exister.
    await seedUsers(db, [userA, userB]);
  });

  it("create impose user_id : un seed appartient toujours à son créateur", async () => {
    const created = await repoA().create("Salut, on se cale un café ?");
    expect(created.userId).toBe(userA.id);
    expect(created.texte).toBe("Salut, on se cale un café ?");
  });

  it("list ne renvoie QUE les seeds du tenant (zéro fuite croisée)", async () => {
    await repoA().create("seed A #1");
    await repoA().create("seed A #2");
    await repoB().create("seed B #1");

    const seenByA = await repoA().list();
    expect(seenByA.map((s) => s.texte).sort()).toEqual(["seed A #1", "seed A #2"]);
    expect(seenByA.every((s) => s.userId === userA.id)).toBe(true);

    const seenByB = await repoB().list();
    expect(seenByB.map((s) => s.texte)).toEqual(["seed B #1"]);
    expect(seenByB.every((s) => s.userId === userB.id)).toBe(true);
  });

  it("list est ordonné du plus RÉCENT au plus ancien", async () => {
    // Horloge croissante : chaque create reçoit un createdAt strictement plus grand.
    let t = 1_700_000_000_000;
    const clock: Clock = () => (t += 1000);
    const repo = seedVoixRepository(forUserDb(db, userA.id, clock));

    await repo.create("le plus ancien");
    await repo.create("au milieu");
    await repo.create("le plus récent");

    const list = await repo.list();
    expect(list.map((s) => s.texte)).toEqual([
      "le plus récent",
      "au milieu",
      "le plus ancien",
    ]);
  });

  it("remove d'autrui n'affecte rien ; remove du sien réussit", async () => {
    const seedA = await repoA().create("À supprimer par A seul");

    // B (qui connaîtrait l'id) tente de supprimer le seed de A : refusé.
    expect(await repoB().remove(seedA.id)).toBe(false);
    expect(await repoA().list()).toHaveLength(1);

    // A supprime le sien : OK.
    expect(await repoA().remove(seedA.id)).toBe(true);
    expect(await repoA().list()).toHaveLength(0);
  });
});

describe("invariant n°1 — tables `messages` / `generation_events` (story 3.6, DoD)", () => {
  let db: TestDb;
  const userA = makeUser({ name: "Alice" });
  const userB = makeUser({ name: "Bob" });

  // Porte complète par tenant : contacts (pour la FK) + messages (markSent atomique).
  const gate = (userId: string) => {
    const scoped = forUserDb(db, userId, now);
    return {
      contacts: contactsRepository(scoped),
      messages: messagesRepository(scoped),
    };
  };

  beforeEach(async () => {
    db = await makeTestDb();
    await seedUsers(db, [userA, userB]);
  });

  it("listForContact ne renvoie QUE les Messages du tenant (zéro fuite croisée)", async () => {
    const gA = gate(userA.id);
    const gB = gate(userB.id);
    const cA = await gA.contacts.create({ nom: "Contact de A" });
    const cB = await gB.contacts.create({ nom: "Contact de B" });

    await gA.messages.markSent(
      makeMarkSent(cA.id, { texte: "secret de A", generation: null }),
    );
    await gB.messages.markSent(
      makeMarkSent(cB.id, { texte: "secret de B", generation: null }),
    );

    // A ne voit que son message ; B ne voit que le sien.
    const aMsgs = await gA.messages.listForContact(cA.id);
    expect(aMsgs.map((m) => m.texte)).toEqual(["secret de A"]);
    expect(aMsgs.every((m) => m.userId === userA.id)).toBe(true);

    // B connaît l'id du contact de A mais ne lit AUCUN de ses messages.
    expect(await gB.messages.listForContact(cA.id)).toHaveLength(0);
    // Le corpus de voix de B ne contient pas les envoyés de A.
    expect(await gB.messages.listSentTexts()).toEqual(["secret de B"]);
  });

  it("markSent impose user_id sur le Message ET son generation_events", async () => {
    const gA = gate(userA.id);
    const cA = await gA.contacts.create({ nom: "Contact de A" });

    const message = await gA.messages.markSent(makeMarkSent(cA.id));
    expect(message.userId).toBe(userA.id);

    // L'event écrit dans la même transaction porte aussi le tenant de A. (db fraîche par
    // test → un seul event ; on lit tout, sans `eq` nu de drizzle-orm hors de la porte.)
    const events = await db.select().from(generationEvents);
    expect(events).toHaveLength(1);
    expect(events[0].messageId).toBe(message.id);
    expect(events[0].userId).toBe(userA.id);

    // B (qui connaîtrait l'id du contact) ne peut pas écrire un Message sur le
    // contact de A : la FK + le scoping du contact côté A protègent, mais surtout B
    // n'a aucun chemin de lecture vers cet event.
    const gB = gate(userB.id);
    expect(await gB.messages.listForContact(cA.id)).toHaveLength(0);
    expect(await gB.messages.listSentTexts()).toHaveLength(0);
  });

  it("le corpus de voix (listSentTexts) est strictement scopé par tenant", async () => {
    const gA = gate(userA.id);
    const gB = gate(userB.id);
    const cA = await gA.contacts.create({ nom: "A" });
    const cB = await gB.contacts.create({ nom: "B" });

    await gA.messages.markSent(makeMarkSent(cA.id, { texte: "voix de A #1", generation: null }));
    await gA.messages.markSent(makeMarkSent(cA.id, { texte: "voix de A #2", generation: null }));
    await gB.messages.markSent(makeMarkSent(cB.id, { texte: "voix de B", generation: null }));

    expect((await gA.messages.listSentTexts()).sort()).toEqual([
      "voix de A #1",
      "voix de A #2",
    ]);
    expect(await gB.messages.listSentTexts()).toEqual(["voix de B"]);
  });

  it("editSent/getById sont scopés : B ne peut NI lire NI éditer le message de A (story 3.7)", async () => {
    const gA = gate(userA.id);
    const gB = gate(userB.id);
    const cA = await gA.contacts.create({ nom: "Contact de A" });

    const msgA = await gA.messages.markSent(
      makeMarkSent(cA.id, { texte: "message privé de A", generation: null }),
    );

    // B (qui connaîtrait l'id du message ET son jeton) ne le voit pas : getById null.
    expect(await gB.messages.getById(msgA.id)).toBeNull();

    // B tente de l'éditer avec le BON jeton : la porte scopée ne match aucune ligne →
    // l'édition cross-tenant est impossible (not-found, jamais d'écriture chez A).
    const piracy = await gB.messages.editSent({
      id: msgA.id,
      texte: "piraté par B",
      expectedUpdatedAt: msgA.updatedAt!,
    });
    expect(piracy.status).toBe("not-found");

    // A relit son message : strictement intact (B n'a rien écrasé).
    const stillA = await gA.messages.getById(msgA.id);
    expect(stillA?.texte).toBe("message privé de A");
  });

  it("setStatus est scopé : B ne change PAS le statut du message de A (story 3.8, DoD)", async () => {
    const gA = gate(userA.id);
    const gB = gate(userB.id);
    const cA = await gA.contacts.create({ nom: "Contact de A" });

    const msgA = await gA.messages.markSent(
      makeMarkSent(cA.id, { texte: "message privé de A", generation: null }),
    );
    expect(msgA.statut).toBe("envoye");

    // B (qui connaîtrait l'id du message) tente une transition LÉGALE en soi (envoye → vu) :
    // la porte scopée ne match aucune ligne de B → not-found, aucune écriture chez A.
    const piracy = await gB.messages.setStatus({ id: msgA.id, statut: "vu" });
    expect(piracy.status).toBe("not-found");

    // Le statut du message de A est resté 'envoye' (B n'a rien changé).
    const stillA = await gA.messages.getById(msgA.id);
    expect(stillA?.statut).toBe("envoye");
  });
});
