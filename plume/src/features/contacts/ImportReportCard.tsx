"use client";

// Carte-bilan d'import (story 2.5, UX-DR16) — NON BLOQUANTE, ton NEUTRE.
//
// Résume un import terminé : « N ajoutés · N fusionnés · N à vérifier · N ignorés ».
// Jamais d'alarme : c'est une information sereine, pas une erreur. S'il y a des lignes
// « à vérifier » (collisions ambiguës), un lien doux ouvre la file de revue 1-par-1.
//
// Aucune couleur hex hors design/ : uniquement les tokens (ink, surface, accent…).

import type { ImportReport } from "@/lib/db";

interface ImportReportCardProps {
  report: ImportReport;
  /** Ouvre la file de revue des collisions à vérifier (si > 0). */
  onReview?: () => void;
}

/** Accord du pluriel FR (sobre) : « ajouté » / « ajoutés ». */
function plural(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}

export function ImportReportCard({ report, onReview }: ImportReportCardProps) {
  // « à vérifier » = collisions ambiguës déposées en file de revue. On les compte via
  // les raisons « à vérifier » : ce sont les seules raisons sans numéro de ligne réel.
  const aVerifier = report.reasons.filter((r) =>
    r.raison.includes("à vérifier"),
  ).length;

  return (
    <section
      role="status"
      aria-live="polite"
      aria-label="Bilan de l'import"
      className="flex flex-col gap-3 rounded-card border-[length:--border-width-ink] border-ink bg-surface-card px-5 py-4"
    >
      <h2 className="font-display text-body font-semibold tracking-[-0.01em] text-ink">
        Import terminé
        {report.filename ? (
          <span className="font-body font-normal text-ink-soft">
            {" "}
            · {report.filename}
          </span>
        ) : null}
      </h2>

      <p className="font-body text-body text-ink">
        {plural(report.created, "ajouté")}
        {" · "}
        {plural(report.merged, "fusionné")}
        {aVerifier > 0 ? (
          <>
            {" · "}
            {aVerifier} à vérifier
          </>
        ) : null}
        {" · "}
        {plural(report.skipped, "ignoré")}
      </p>

      {aVerifier > 0 && onReview ? (
        <button
          type="button"
          onClick={onReview}
          className="self-start rounded-button border-[length:--border-width-ink] border-ink bg-accent px-4 py-2 font-body text-body font-bold text-accent-on shadow-[var(--shadow-button-primary)] outline-accent outline-offset-2 focus-visible:outline-2"
        >
          Vérifier {aVerifier === 1 ? "le doublon" : "les doublons"}
        </button>
      ) : null}

      {/* Détail des lignes ignorées (replié, ton neutre) — utile sans être anxiogène. */}
      {report.skipped > 0 ? (
        <details className="font-body text-label text-ink-soft">
          <summary className="cursor-pointer outline-accent outline-offset-2 focus-visible:outline-2">
            Voir les lignes ignorées
          </summary>
          <ul className="mt-2 flex flex-col gap-1 pl-1">
            {report.reasons
              .filter((r) => !r.raison.includes("à vérifier"))
              .map((r, i) => (
                <li key={i}>
                  {r.ligne > 0 ? `Ligne ${r.ligne} : ` : ""}
                  {r.raison}
                </li>
              ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

export default ImportReportCard;
