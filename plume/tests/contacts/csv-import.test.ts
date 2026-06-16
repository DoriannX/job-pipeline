// Traitement de l'IMPORT CSV (story 2.5) — `processCsvImport` + résolution.
//
// On prouve, via la porte scopée `forUserDb` + les repositories (jamais Drizzle nu) :
//   - dédup INTRA-FICHIER (même clé une seule fois) ;
//   - idempotence VS-DB (réutilise bulkCreate : ON CONFLICT DO NOTHING par tenant) ;
//   - détection de la COLLISION AMBIGUË (A a un email, B même nom+entreprise sans email,
//     et l'inverse) → candidat `merge_candidates` 'pending', JAMAIS de fusion à tort ;
//   - bilan exact (created/merged/skipped + reasons) ;
//   - résolution Fusionner (enrichit l'existant) / Garder séparés (crée distinct).

import { beforeEach, describe, expect, it } from "vitest";

import {
  contactsRepository,
  forUserDb,
  importJobsRepository,
  mergeCandidatesRepository,
  processCsvImport,
  resolveMergeCandidate,
} from "@/lib/db";
import type { Clock } from "@/lib/domain/time";

import { makeTestDb, seedUsers, type TestDb } from "../db/harness";
import { makeUser } from "../factories/user";

const now: Clock = () => 1_700_000_000_000;

describe("processCsvImport — dédup, idempotence, merge_pending (story 2.5)", () => {
  let db: TestDb;
  const userA = makeUser({ name: "Alice" });

  const gate = () => {
    const scoped = forUserDb(db, userA.id, now);
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
    await seedUsers(db, [userA]);
  });

  it("crée N contacts depuis des lignes valides + compte les lignes ignorées", async () => {
    const g = gate();
    const job = await g.importJobs.start("Connections.csv");

    const report = await processCsvImport(
      job.id,
      {
        rows: [
          { nom: "Léa Martin", entreprise: "Acme", email: "lea@acme.fr" },
          { nom: "Hervé Dupont", entreprise: "Studio Bleu" },
        ],
        skipped: [{ ligne: 4, raison: "Ligne sans nom — ignorée." }],
      },
      g,
    );

    expect(report.status).toBe("done");
    expect(report.created).toBe(2);
    expect(report.skipped).toBe(1);
    expect(report.total).toBe(3);
    expect((await g.contacts.list()).length).toBe(2);

    // Le bilan est persisté sur le job (poll client ➜ 'done').
    const persisted = await g.importJobs.get(job.id);
    expect(persisted?.status).toBe("done");
    expect(persisted?.created).toBe(2);
    expect(persisted?.skipped).toBe(1);
    expect(persisted?.reasons?.[0].raison).toMatch(/sans nom/i);
  });

  it("dédup INTRA-FICHIER : une même clé répétée n'est créée qu'une fois", async () => {
    const g = gate();
    const job = await g.importJobs.start(null);

    const report = await processCsvImport(
      job.id,
      {
        rows: [
          { nom: "Léa Martin", entreprise: "Acme" },
          { nom: "lea  martin", entreprise: "ACME" }, // équivalent normalisé
          { nom: "Jean", email: "jean@x.fr" },
          { nom: "Autre", email: "JEAN@X.FR" }, // même email normalisé
        ],
        skipped: [],
      },
      g,
    );

    expect(report.created).toBe(2);
    expect(report.merged).toBe(2);
    expect((await g.contacts.list()).length).toBe(2);
  });

  it("idempotence VS-DB : relancer le MÊME import ne crée aucun doublon", async () => {
    const g = gate();
    const rows = [
      { nom: "Léa Martin", entreprise: "Acme", email: "lea@acme.fr" },
      { nom: "Hervé Dupont", entreprise: "Studio Bleu" },
    ];

    const job1 = await g.importJobs.start(null);
    const first = await processCsvImport(job1.id, { rows, skipped: [] }, g);
    expect(first.created).toBe(2);

    // Second passage : tout existe déjà ➜ 0 créé, tout « fusionné » (ON CONFLICT).
    const job2 = await g.importJobs.start(null);
    const second = await processCsvImport(job2.id, { rows, skipped: [] }, g);
    expect(second.created).toBe(0);
    expect(second.merged).toBe(2);
    expect((await g.contacts.list()).length).toBe(2);
  });

  it("COLLISION AMBIGUË (existant a un email, ligne CSV même nom+entreprise SANS email) → merge_pending", async () => {
    const g = gate();
    // Existant : Léa @ Acme AVEC email ➜ clé `email:...`.
    await g.contacts.create({
      nom: "Léa Martin",
      entreprise: "Acme",
      handles: { email: "lea@acme.fr" },
    });

    const job = await g.importJobs.start(null);
    const report = await processCsvImport(
      job.id,
      {
        // Ligne CSV : même nom+entreprise mais SANS email ➜ clé `name:...` ≠ existant.
        rows: [{ nom: "Léa Martin", entreprise: "Acme" }],
        skipped: [],
      },
      g,
    );

    // JAMAIS de fusion à tort : aucun nouveau contact, un candidat 'pending' déposé.
    expect(report.created).toBe(0);
    expect((await g.contacts.list()).length).toBe(1);
    const pending = await g.mergeCandidates.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].nom).toBe("Léa Martin");
    expect(pending[0].status).toBe("pending");
    // Comptée comme « à vérifier » dans le bilan (merged + reason dédiée).
    expect(report.merged).toBe(1);
    expect(report.reasons.some((r) => r.raison.includes("à vérifier"))).toBe(
      true,
    );
  });

  it("COLLISION AMBIGUË INVERSE (existant SANS email, ligne CSV même nom+entreprise AVEC email) → merge_pending", async () => {
    const g = gate();
    // Existant : Léa @ Acme SANS email ➜ clé `name:...`.
    await g.contacts.create({ nom: "Léa Martin", entreprise: "Acme" });

    const job = await g.importJobs.start(null);
    const report = await processCsvImport(
      job.id,
      {
        rows: [{ nom: "Léa Martin", entreprise: "Acme", email: "lea@acme.fr" }],
        skipped: [],
      },
      g,
    );

    expect(report.created).toBe(0);
    expect((await g.contacts.list()).length).toBe(1);
    expect(await g.mergeCandidates.listPending()).toHaveLength(1);
  });

  it("PAS de merge_pending quand les clés coïncident (même email) : idempotent, pas ambigu", async () => {
    const g = gate();
    await g.contacts.create({
      nom: "Léa Martin",
      entreprise: "Acme",
      handles: { email: "lea@acme.fr" },
    });

    const job = await g.importJobs.start(null);
    const report = await processCsvImport(
      job.id,
      {
        rows: [{ nom: "Léa Martin", entreprise: "Acme", email: "lea@acme.fr" }],
        skipped: [],
      },
      g,
    );

    // Même clé `email:lea@acme.fr` ➜ ON CONFLICT, juste « fusionné », aucun candidat.
    expect(report.created).toBe(0);
    expect(report.merged).toBe(1);
    expect(await g.mergeCandidates.listPending()).toHaveLength(0);
  });
});

describe("resolveMergeCandidate — Fusionner / Garder séparés (story 2.5)", () => {
  let db: TestDb;
  const userA = makeUser({ name: "Alice" });

  const gate = () => {
    const scoped = forUserDb(db, userA.id, now);
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
    await seedUsers(db, [userA]);
  });

  /** Met en place une collision ambiguë et renvoie le candidat 'pending'. */
  async function seedAmbiguous(g: ReturnType<typeof gate>) {
    const existing = await g.contacts.create({
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
    const [candidate] = await g.mergeCandidates.listPending();
    return { existing, candidate };
  }

  it("Fusionner : enrichit l'existant, ne crée pas de doublon, marque résolu", async () => {
    const g = gate();
    const { existing, candidate } = await seedAmbiguous(g);

    const ok = await resolveMergeCandidate(candidate.id, "merge", g);
    expect(ok).toBe(true);

    // Toujours UN seul contact : l'existant, enrichi (email conservé).
    const list = await g.contacts.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(existing.id);
    expect(list[0].handles?.email).toBe("lea@acme.fr");

    // Plus rien à vérifier.
    expect(await g.mergeCandidates.listPending()).toHaveLength(0);
  });

  it("Garder séparés : crée le contact entrant distinct, marque résolu", async () => {
    const g = gate();
    const { candidate } = await seedAmbiguous(g);

    const ok = await resolveMergeCandidate(candidate.id, "keep_separate", g);
    expect(ok).toBe(true);

    // DEUX contacts désormais : l'existant + la ligne entrante distincte.
    expect((await g.contacts.list()).length).toBe(2);
    expect(await g.mergeCandidates.listPending()).toHaveLength(0);
  });

  it("idempotent : résoudre deux fois le même candidat n'a plus d'effet", async () => {
    const g = gate();
    const { candidate } = await seedAmbiguous(g);

    expect(await resolveMergeCandidate(candidate.id, "merge", g)).toBe(true);
    // Déjà résolu ➜ false, aucun nouveau contact.
    expect(await resolveMergeCandidate(candidate.id, "keep_separate", g)).toBe(
      false,
    );
    expect((await g.contacts.list()).length).toBe(1);
  });

  it("candidat inconnu ➜ false", async () => {
    const g = gate();
    expect(await resolveMergeCandidate("inexistant", "merge", g)).toBe(false);
  });
});
