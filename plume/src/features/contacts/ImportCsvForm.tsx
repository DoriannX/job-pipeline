"use client";

// Import CSV LinkedIn (story 2.5) — écran d'upload NON BLOQUANT depuis Réseau.
//
// Parcours : on choisit un fichier `.csv`, on le lit CÔTÉ CLIENT (FileReader), on
// envoie son TEXTE à la server action `startImportAction`. Celle-ci crée un job
// 'pending' et renvoie son id IMMÉDIATEMENT (le traitement tourne après la réponse,
// via `after()`), puis on POLL `getImportStatusAction(jobId)` jusqu'au bilan 'done'.
// À AUCUN moment l'app n'est verrouillée : on peut quitter cet écran librement.
//
// a11y : input fichier avec label explicite, statut annoncé (role="status",
// aria-live="polite"). Aucune couleur hex hors design/ : uniquement les tokens.

import { useActionState, useEffect, useRef, useState } from "react";

import {
  getImportStatusAction,
  startImportAction,
  type ImportStatusResult,
  type StartImportState,
} from "./import-actions";
import { ImportReportCard } from "./ImportReportCard";

const INITIAL: StartImportState = { ok: false };
const POLL_MS = 1200;

interface ImportCsvFormProps {
  /** Retour à la galerie (l'import continue côté serveur même si on quitte). */
  onCancel?: () => void;
  /** Ouvre la file de revue des collisions à vérifier. */
  onReview?: () => void;
}

export function ImportCsvForm({ onCancel, onReview }: ImportCsvFormProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [readError, setReadError] = useState<string | null>(null);

  // Statut du job (poll) : null tant qu'aucun import lancé.
  const [status, setStatus] = useState<ImportStatusResult | null>(null);

  const [state, formAction, pending] = useActionState(
    async (prev: StartImportState, formData: FormData) => {
      formData.set("csv", csvText);
      formData.set("filename", fileName);
      return startImportAction(prev, formData);
    },
    INITIAL,
  );

  // Dès qu'un jobId est connu, on POLL le statut jusqu'à 'done'/'error'.
  useEffect(() => {
    const jobId = state.jobId;
    if (!jobId) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      const next = await getImportStatusAction(jobId);
      if (!active) return;
      setStatus(next);
      if (next.status === "pending") {
        timer = setTimeout(tick, POLL_MS);
      }
    };
    void tick();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [state.jobId]);

  // Lit le fichier choisi en texte (client-side), sans rien envoyer encore.
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReadError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setCsvText("");
      setFileName("");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.onerror = () =>
      setReadError("Ce fichier n'a pas pu être lu. Réessaie ?");
    reader.readAsText(file);
  };

  const launched = Boolean(state.jobId);

  return (
    <div className="flex flex-col gap-5">
      {/* Erreur DOUCE (mauve mesuré) — jamais rouge alarme. */}
      {(state.error || readError) ? (
        <p
          role="alert"
          className="rounded-md border-[length:--border-width-ink] border-accent bg-accent-tint px-4 py-3 font-body text-body text-accent-deep"
        >
          {state.error ?? readError}
        </p>
      ) : null}

      {!launched ? (
        <form action={formAction} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="csv-file"
              className="font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft"
            >
              Ton export LinkedIn
            </label>
            <p id="csv-hint" className="font-body text-body text-ink-soft">
              Choisis le fichier «&nbsp;Connections.csv&nbsp;» exporté depuis
              LinkedIn. L&apos;import tourne en arrière-plan : tu peux continuer à
              naviguer.
            </p>
            <input
              ref={fileRef}
              id="csv-file"
              name="csv-file"
              type="file"
              accept=".csv,text/csv"
              required
              aria-describedby="csv-hint"
              onChange={onFileChange}
              className="w-full rounded-md border-[length:--border-width-ink] border-ink bg-surface-note px-4 py-3 font-body text-body text-ink outline-accent outline-offset-2 focus-visible:outline-2 file:mr-4 file:rounded-button file:border-0 file:bg-accent file:px-4 file:py-2 file:font-body file:text-button file:font-bold file:text-accent-on"
            />
            {fileName ? (
              <p className="font-body text-label text-ink-soft">
                Fichier choisi&nbsp;: {fileName}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={pending || csvText.trim() === ""}
              className="rounded-button border-[length:--border-width-ink] border-ink bg-accent px-6 py-3 font-body text-button font-bold text-accent-on shadow-[var(--shadow-button-primary)] outline-accent outline-offset-2 focus-visible:outline-2 disabled:opacity-70"
            >
              {pending ? "Un instant…" : "Importer"}
            </button>
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-button px-4 py-3 font-body text-body font-bold text-ink-soft outline-accent outline-offset-2 focus-visible:outline-2"
              >
                Annuler
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Import LANCÉ : on n'attend pas, on annonce poliment l'avancement. */}
          {status?.status === "done" && status.report ? (
            <ImportReportCard report={status.report} onReview={onReview} />
          ) : status?.status === "error" ? (
            <p
              role="status"
              aria-live="polite"
              className="rounded-md border-[length:--border-width-ink] border-accent bg-accent-tint px-4 py-3 font-body text-body text-accent-deep"
            >
              L&apos;import s&apos;est arrêté en chemin. Tu peux réessayer.
            </p>
          ) : (
            <p
              role="status"
              aria-live="polite"
              className="rounded-md border-[length:--border-width-ink] border-ink bg-surface-card px-4 py-3 font-body text-body text-ink"
            >
              Import en cours… tu peux continuer à naviguer, on t&apos;affiche le
              bilan ici dès qu&apos;il est prêt.
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-button border-[length:--border-width-ink] border-ink bg-surface-card px-6 py-3 font-body text-button font-bold text-ink outline-accent outline-offset-2 focus-visible:outline-2"
            >
              Revenir au réseau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportCsvForm;
