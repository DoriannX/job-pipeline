"use server";

// Server actions de l'IMPORT CSV LinkedIn (story 2.5).
//
// RÈGLE DURE : ces actions n'importent JAMAIS le schéma Drizzle ni drizzle-orm. Tout
// accès aux données passe par la porte `forUser(userId)` de `@/lib/db` (barrière n°1).
// `userId` est résolu via `auth()` DANS CHAQUE action ; sans session, on rejette.
//
// NON-BLOCANT (AC-1, FR-1, NFR-6) : le déclenchement crée un job 'pending', renvoie son
// id IMMÉDIATEMENT, et planifie le TRAITEMENT via `after()` de `next/server` — exécuté
// APRÈS la réponse (la requête HTTP déclencheuse peut être finie). Le `user_id` voyage
// dans la closure du job (et dans la ligne `import_jobs`). Le client POLL ensuite le
// statut via `getImportStatusAction` et affiche l'`ImportReport` quand 'done'.

import { after } from "next/server";

import { revalidatePath } from "next/cache";

import {
  forUser,
  processCsvImport,
  resolveMergeCandidate,
  type ImportReport,
  type MergeDecision,
} from "@/lib/db";
import { auth } from "@/lib/auth";
import { parseLinkedinCsv } from "@/lib/domain/csv";

const RESEAU_PATH = "/reseau";

/** Résout l'id du tenant courant ; lève si pas de session. */
async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Session requise.");
  }
  return userId;
}

/** État renvoyé au déclenchement d'un import (pour `useActionState`). */
export type StartImportState = {
  ok: boolean;
  /** Id du job créé (le client poll ce job jusqu'à 'done'). */
  jobId?: string;
  /** Message d'erreur global, ton doux (jamais rouge alarme). */
  error?: string;
};

/**
 * Déclenche un import CSV LinkedIn (AC-1). Pipeline NON-BLOQUANT :
 *   1. auth() → lecture du texte CSV envoyé (lu côté client depuis le fichier) ;
 *   2. parse PUR (`parseLinkedinCsv`) — détecte tôt un fichier illisible ;
 *   3. création d'un job 'pending' → on RENVOIT son id sans attendre le traitement ;
 *   4. `after()` planifie le traitement réel (dédup + insertion + bilan) POST-RÉPONSE,
 *      en re-résolvant la porte `forUser(userId)` (le tenant voyage dans la closure).
 */
export async function startImportAction(
  _prev: StartImportState,
  formData: FormData,
): Promise<StartImportState> {
  const userId = await requireUserId();

  const text = String(formData.get("csv") ?? "");
  const filename = (formData.get("filename") as string) || null;
  if (text.trim() === "") {
    return { ok: false, error: "Le fichier semble vide." };
  }

  // Parse à la frontière (pur) : on connaît tout de suite lignes valides / ignorées.
  const parsed = parseLinkedinCsv(text);
  if (parsed.rows.length === 0 && parsed.skipped.every((s) => s.ligne === 0)) {
    // Aucune ligne exploitable ET pas de vraies données (fichier non LinkedIn / vide).
    return {
      ok: false,
      error: "Ce fichier ne ressemble pas à un export LinkedIn.",
    };
  }

  const db = await forUser(userId);
  const job = await db.importJobs.start(filename);

  // Traitement APRÈS la réponse : l'UI reste navigable, aucun parcours ne bloque.
  // On re-résout la porte dans la closure pour ne pas capturer un état de requête.
  after(async () => {
    const gate = await forUser(userId);
    try {
      await processCsvImport(job.id, parsed, {
        contacts: gate.contacts,
        importJobs: gate.importJobs,
        mergeCandidates: gate.mergeCandidates,
        listContacts: gate.contacts.list,
      });
    } catch {
      // Échec du traitement post-réponse (ex. erreur Turso transitoire) : on FERME le
      // job en 'error' — sinon il reste 'pending' éternel et le client poll en boucle.
      // Le statut 'error' active la bannière d'erreur douce de l'UI (jamais de rouge).
      await gate.importJobs.finish(job.id, {
        status: "error",
        total: parsed.rows.length + parsed.skipped.length,
        created: 0,
        merged: 0,
        skipped: parsed.skipped.length,
        reasons: [
          { ligne: 0, raison: "L'import n'a pas pu être terminé. Réessaie." },
        ],
      });
    }
    // Rafraîchit la galerie une fois l'import terminé (nouveaux contacts visibles).
    revalidatePath(RESEAU_PATH);
  });

  return { ok: true, jobId: job.id };
}

/** Statut d'un import, projeté pour le poll client. */
export type ImportStatusResult = {
  status: "pending" | "done" | "error" | "unknown";
  report?: ImportReport;
};

/**
 * Statut d'un job d'import (poll client). Renvoie 'pending' tant que le traitement
 * post-réponse n'a pas écrit le bilan, puis l'`ImportReport` complet quand 'done'.
 */
export async function getImportStatusAction(
  jobId: string,
): Promise<ImportStatusResult> {
  const userId = await requireUserId();
  const db = await forUser(userId);
  const job = await db.importJobs.get(jobId);
  if (!job) return { status: "unknown" };

  if (job.status === "pending") return { status: "pending" };

  return {
    status: job.status,
    report: {
      status: job.status,
      filename: job.filename,
      total: job.total,
      created: job.created,
      merged: job.merged,
      skipped: job.skipped,
      reasons: job.reasons ?? [],
    },
  };
}

/** Une carte de la file de revue (collision ambiguë à trancher). */
export type MergeCandidateView = {
  id: string;
  nom: string;
  entreprise: string | null;
  email: string | null;
  linkedin: string | null;
  /** Identité du contact existant en collision (pour contexte d'affichage). */
  existing: { id: string; nom: string; entreprise: string | null } | null;
};

/**
 * Liste les candidats de fusion 'pending' du tenant (file de revue 1-par-1). On
 * joint l'identité du contact existant pour donner du contexte à la décision.
 */
export async function listMergeCandidatesAction(): Promise<MergeCandidateView[]> {
  const userId = await requireUserId();
  const db = await forUser(userId);
  const pending = await db.mergeCandidates.listPending();

  const out: MergeCandidateView[] = [];
  for (const c of pending) {
    const existing = await db.contacts.get(c.existingContactId);
    out.push({
      id: c.id,
      nom: c.nom,
      entreprise: c.entreprise,
      email: c.email,
      linkedin: c.handles?.linkedin ?? null,
      existing: existing
        ? { id: existing.id, nom: existing.nom, entreprise: existing.entreprise }
        : null,
    });
  }
  return out;
}

/** État renvoyé après résolution d'un candidat (pour `useActionState`). */
export type ResolveMergeState = {
  ok: boolean;
  error?: string;
};

/**
 * Résout UN candidat de fusion (Fusionner / Garder séparés). Server action scopée :
 * la décision est appliquée via la porte `forUser`, puis la galerie est rafraîchie.
 */
export async function resolveMergeAction(
  candidateId: string,
  decision: MergeDecision,
): Promise<ResolveMergeState> {
  const userId = await requireUserId();
  if (!candidateId) return { ok: false, error: "Candidat introuvable." };

  const db = await forUser(userId);
  const done = await resolveMergeCandidate(candidateId, decision, {
    contacts: db.contacts,
    mergeCandidates: db.mergeCandidates,
  });
  if (!done) {
    return { ok: false, error: "Ce choix n'a pas pu être appliqué." };
  }

  revalidatePath(RESEAU_PATH);
  return { ok: true };
}
