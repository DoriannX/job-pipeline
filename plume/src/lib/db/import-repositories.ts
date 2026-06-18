// Repositories de l'IMPORT CSV (story 2.5) — ZONE AUTORISÉE (src/lib/db/**).
// C'est ICI qu'on touche au schéma Drizzle pour `import_jobs` et `merge_candidates` ;
// les features n'importent JAMAIS le schéma (barrière ESLint n°1 / AR-2, AR-13).
//
// Trois pièces :
//   1. `importJobsRepository`   — cycle de vie du job (pending → done/error) + bilan ;
//   2. `mergeCandidatesRepository` — file de revue des collisions ambiguës ;
//   3. `processCsvImport`       — le TRAITEMENT (parse déjà fait en amont) : dédup
//      intra-fichier + vs-DB (via `contacts.bulkCreate`), détection des collisions
//      ambiguës (merge_pending), écriture du bilan. Pur vis-à-vis du framework : il
//      reçoit une porte scopée INJECTÉE, donc testable hors serveur.

import { and, eq } from "drizzle-orm";

import { computeDedupKey, normalizeName } from "../domain/dedup";
import { now } from "../domain/time";
import type { CsvContactRow, CsvSkippedRow } from "../domain/csv";
import type { ContactsRepository } from "./repositories";
import { importJobs, mergeCandidates, type ImportReason } from "./schema";
import type { ScopedDb } from "./scoped";

/** Ligne `import_jobs` telle que lue en base. */
export type ImportJob = typeof importJobs.$inferSelect;
/** Ligne `merge_candidates` telle que lue en base. */
export type MergeCandidate = typeof mergeCandidates.$inferSelect;

/** Bilan d'un import, projeté pour l'UI (carte non bloquante, UX-DR16). */
export type ImportReport = {
  status: ImportJob["status"];
  filename: string | null;
  total: number;
  created: number;
  merged: number;
  skipped: number;
  reasons: ImportReason[];
};

/** Contrat du repository des jobs d'import (auto-scopé par tenant). */
export type ImportJobsRepository = {
  /** Crée un job 'pending' (déclenchement de l'import) ; renvoie la ligne. */
  start: (filename: string | null) => Promise<ImportJob>;
  /** Lit un job par id (borné au tenant) — undefined si inconnu/autrui. */
  get: (id: string) => Promise<ImportJob | undefined>;
  /** Écrit le bilan final et passe le job en 'done' (ou 'error'). */
  finish: (
    id: string,
    result: {
      status: "done" | "error";
      total: number;
      created: number;
      merged: number;
      skipped: number;
      reasons: ImportReason[];
    },
  ) => Promise<ImportJob | undefined>;
};

/** Contrat du repository des candidats à la fusion (file de revue). */
export type MergeCandidatesRepository = {
  /** Dépose un candidat 'pending' (collision ambiguë détectée). */
  create: (data: {
    importJobId: string;
    existingContactId: string;
    nom: string;
    entreprise?: string | null;
    email?: string | null;
    linkedin?: string | null;
  }) => Promise<MergeCandidate>;
  /** Liste les candidats 'pending' du tenant (file de revue 1-par-1). */
  listPending: () => Promise<MergeCandidate[]>;
  /** Lit un candidat par id (borné au tenant). */
  get: (id: string) => Promise<MergeCandidate | undefined>;
  /** Marque un candidat résolu ('merged' | 'kept_separate'). */
  resolve: (
    id: string,
    status: "merged" | "kept_separate",
  ) => Promise<MergeCandidate | undefined>;
};

export function importJobsRepository(scoped: ScopedDb): ImportJobsRepository {
  return {
    async start(filename) {
      const ts = now(scoped.now);
      const [row] = await scoped.insert(importJobs, {
        status: "pending",
        filename: filename ?? null,
        total: 0,
        created: 0,
        merged: 0,
        skipped: 0,
        reasons: null,
        createdAt: ts,
        finishedAt: null,
      });
      return row;
    },

    async get(id) {
      return scoped.findFirst(importJobs, eq(importJobs.id, id));
    },

    async finish(id, result) {
      const [row] = await scoped.update(
        importJobs,
        {
          status: result.status,
          total: result.total,
          created: result.created,
          merged: result.merged,
          skipped: result.skipped,
          reasons: result.reasons,
          finishedAt: now(scoped.now),
        },
        eq(importJobs.id, id),
      );
      return row;
    },
  };
}

export function mergeCandidatesRepository(
  scoped: ScopedDb,
): MergeCandidatesRepository {
  return {
    async create(data) {
      const ts = now(scoped.now);
      const [row] = await scoped.insert(mergeCandidates, {
        importJobId: data.importJobId,
        existingContactId: data.existingContactId,
        nom: data.nom,
        entreprise: data.entreprise ?? null,
        email: data.email ?? null,
        handles: {
          ...(data.email ? { email: data.email } : {}),
          ...(data.linkedin ? { linkedin: data.linkedin } : {}),
        },
        status: "pending",
        createdAt: ts,
      });
      return row;
    },

    async listPending() {
      return scoped.findMany(
        mergeCandidates,
        eq(mergeCandidates.status, "pending"),
      );
    },

    async get(id) {
      return scoped.findFirst(mergeCandidates, eq(mergeCandidates.id, id));
    },

    async resolve(id, status) {
      const [row] = await scoped.update(
        mergeCandidates,
        { status },
        and(eq(mergeCandidates.id, id), eq(mergeCandidates.status, "pending")),
      );
      return row;
    },
  };
}

/**
 * Clé « nom+entreprise » INDÉPENDANTE de l'email (espace de noms `name:`). Sert à
 * repérer une COLLISION AMBIGUË : une ligne CSV et un contact existant qui désignent
 * vraisemblablement la même personne (même nom + entreprise normalisés) alors que leurs
 * clés de dédup `computeDedupKey` DIFFÈRENT (l'un a un email, l'autre non, ou emails
 * distincts). On ne fusionne JAMAIS à tort : on dépose un candidat à revoir.
 */
function nameKey(nom: string, entreprise?: string | null): string {
  return `name:${normalizeName(nom)}|${normalizeName(entreprise)}`;
}

/** Forme des dépendances injectées au traitement (porte + repos déjà câblés). */
export type ImportProcessDeps = {
  contacts: ContactsRepository;
  importJobs: ImportJobsRepository;
  mergeCandidates: MergeCandidatesRepository;
  /** Lecture brute des contacts du tenant (pour l'index nom→contact existant). */
  listContacts: ContactsRepository["list"];
};

/**
 * Traite un import déjà PARSÉ (lignes valides + lignes ignorées) pour un job donné.
 *
 * Étapes :
 *   1. dédup INTRA-FICHIER sur la clé `computeDedupKey` (1ʳᵉ occurrence gardée) ;
 *   2. détection des COLLISIONS AMBIGUËS vs l'existant : si la clé nom+entreprise
 *      matche un contact existant MAIS que la clé de dédup diffère (email d'un seul
 *      côté, ou emails distincts) → on N'INSÈRE PAS, on dépose un `merge_candidates`
 *      'pending' (jamais de fusion à tort) ;
 *   3. insertion des lignes restantes via `contacts.bulkCreate` (idempotence vs-DB :
 *      `ON CONFLICT DO NOTHING` sur l'index unique `(user_id, dedup_key)`, AR-9) ;
 *   4. écriture du bilan (`ImportReport`) et passage du job en 'done'.
 *
 * Le compteur `merged` agrège les doublons (intra-fichier + déjà-en-base) ET les
 * collisions « à vérifier » ; `reasons` détaille les lignes ignorées et à vérifier.
 */
export async function processCsvImport(
  jobId: string,
  parsed: { rows: CsvContactRow[]; skipped: CsvSkippedRow[] },
  deps: ImportProcessDeps,
): Promise<ImportReport> {
  const total = parsed.rows.length + parsed.skipped.length;
  const reasons: ImportReason[] = [...parsed.skipped];
  const skipped = parsed.skipped.length;

  // Index des contacts existants par clé nom+entreprise → {a un email ? clé dédup}.
  const existing = await deps.listContacts();
  const byName = new Map<string, { id: string; dedupKey: string }>();
  for (const c of existing) {
    byName.set(nameKey(c.nom, c.entreprise), {
      id: c.id,
      dedupKey: c.dedupKey,
    });
  }

  // 1) Dédup intra-fichier + 2) détection des collisions ambiguës.
  const seen = new Set<string>();
  const toInsert: CsvContactRow[] = [];
  let mergedAmbiguous = 0;
  let intraFileDupes = 0;

  for (const row of parsed.rows) {
    const dedupKey = computeDedupKey({
      nom: row.nom,
      entreprise: row.entreprise,
      email: row.email,
    });

    // Doublon strict dans le fichier (même clé) : on l'ignore (compté « fusionné »).
    if (seen.has(dedupKey)) {
      intraFileDupes += 1;
      continue;
    }

    // Collision AMBIGUË vs l'existant : même nom+entreprise, mais clé de dédup ≠
    // (un seul côté a un email, ou emails distincts) → candidat à revoir, pas d'insert.
    const match = byName.get(nameKey(row.nom, row.entreprise));
    if (match && match.dedupKey !== dedupKey) {
      await deps.mergeCandidates.create({
        importJobId: jobId,
        existingContactId: match.id,
        nom: row.nom,
        entreprise: row.entreprise ?? null,
        email: row.email ?? null,
        linkedin: row.linkedin ?? null,
      });
      mergedAmbiguous += 1;
      reasons.push({
        ligne: 0,
        raison: `« ${row.nom} » ressemble à un contact existant — à vérifier.`,
      });
      // On marque la clé vue pour ne pas re-déposer le même candidat plusieurs fois.
      seen.add(dedupKey);
      continue;
    }

    seen.add(dedupKey);
    toInsert.push(row);
  }

  // 3) Insertion idempotente vs-DB via bulkCreate (réutilise l'index unique, AR-9).
  const bulk = await deps.contacts.bulkCreate(
    toInsert.map((r) => ({
      nom: r.nom,
      entreprise: r.entreprise ?? null,
      email: r.email ?? null,
    })),
  );

  const created = bulk.created;
  // « Fusionnés » = doublons in-fichier + collisions ambiguës + doublons déjà-en-base
  // (ces derniers comptés par bulkCreate : merged = demandé - créé).
  const dbDupes = bulk.merged; // == toInsert.length - created
  const merged = intraFileDupes + mergedAmbiguous + dbDupes;

  // 4) Bilan final + statut 'done'.
  const job = await deps.importJobs.finish(jobId, {
    status: "done",
    total,
    created,
    merged,
    skipped,
    reasons,
  });

  return {
    status: job?.status ?? "done",
    filename: job?.filename ?? null,
    total,
    created,
    merged,
    skipped,
    reasons,
  };
}

/** Dépendances injectées à la résolution d'un candidat (porte + repos câblés). */
export type ResolveMergeDeps = {
  contacts: ContactsRepository;
  mergeCandidates: MergeCandidatesRepository;
};

/** Décision possible sur un candidat de fusion (file de revue 1-par-1). */
export type MergeDecision = "merge" | "keep_separate";

/**
 * Résout UN candidat de fusion (story 2.5, UX-DR16) :
 *   - 'merge' (Fusionner) → enrichit le contact EXISTANT avec les coordonnées
 *     entrantes (email/linkedin) sans écraser l'historique, puis marque 'merged' ;
 *   - 'keep_separate' (Garder séparés) → crée le contact ENTRANT comme ligne distincte
 *     (via bulkCreate, idempotent), puis marque 'kept_separate'.
 *
 * Idempotent : un candidat déjà résolu (status ≠ 'pending') n'a plus d'effet. Renvoie
 * `false` si le candidat est inconnu/autrui/déjà résolu.
 */
export async function resolveMergeCandidate(
  candidateId: string,
  decision: MergeDecision,
  deps: ResolveMergeDeps,
): Promise<boolean> {
  const candidate = await deps.mergeCandidates.get(candidateId);
  if (!candidate || candidate.status !== "pending") return false;

  if (decision === "merge") {
    // Enrichit le contact existant : on FUSIONNE les handles entrants dans les siens
    // (l'email/linkedin entrant complète ceux déjà connus, sans rien écraser d'utile).
    // On le relit en INCLUANT les archivés : si la cible a été archivée entre la
    // détection et la résolution, on l'enrichit ET on la RÉACTIVE (la fusion la
    // ramène dans le réseau) plutôt que de perdre silencieusement les coordonnées.
    const existing = await deps.contacts.get(candidate.existingContactId, {
      includeArchived: true,
    });
    if (existing) {
      const mergedHandles = {
        ...(existing.handles ?? {}),
        ...(candidate.email ? { email: candidate.email } : {}),
        ...(candidate.handles?.linkedin
          ? { linkedin: candidate.handles.linkedin }
          : {}),
      };
      await deps.contacts.update(existing.id, {
        handles: mergedHandles,
        ...(existing.archivedAt != null ? { archivedAt: null } : {}),
      });
    }
    await deps.mergeCandidates.resolve(candidateId, "merged");
    return true;
  }

  // Garder séparés : on crée la ligne entrante comme contact distinct.
  await deps.contacts.bulkCreate([
    {
      nom: candidate.nom,
      entreprise: candidate.entreprise ?? null,
      email: candidate.email ?? null,
    },
  ]);
  await deps.mergeCandidates.resolve(candidateId, "kept_separate");
  return true;
}
