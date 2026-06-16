"use client";

// File de revue des collisions ambiguës (story 2.5, UX-DR16) — esprit DECK, 1-par-1.
//
// Pour chaque candidat (ligne CSV qui ressemble à un contact existant), on présente la
// décision en deux gestes nets : « Fusionner » (enrichit l'existant) ou « Garder
// séparés » (crée un contact distinct). On ne fusionne JAMAIS à tort : c'est l'humain
// qui tranche, une carte à la fois. Quand la pile est vide, message serein.
//
// Aucune couleur hex hors design/ : uniquement les tokens.

import { useState, useTransition } from "react";

import {
  resolveMergeAction,
  type MergeCandidateView,
} from "./import-actions";

interface MergeReviewDeckProps {
  candidates: MergeCandidateView[];
  /** Retour à la galerie (la pile peut rester non vide : on y revient quand on veut). */
  onClose?: () => void;
  /** Notifie le parent qu'une décision a été prise (refresh éventuel). */
  onResolved?: () => void;
}

export function MergeReviewDeck({
  candidates,
  onClose,
  onResolved,
}: MergeReviewDeckProps) {
  // Pile locale : on retire la carte tranchée pour avancer dans le deck.
  const [pile, setPile] = useState<MergeCandidateView[]>(candidates);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const current = pile[0];

  const decide = (decision: "merge" | "keep_separate") => {
    if (!current) return;
    setError(null);
    startTransition(async () => {
      const res = await resolveMergeAction(current.id, decision);
      if (!res.ok) {
        setError(res.error ?? "Ce choix n'a pas pu être appliqué.");
        return;
      }
      setPile((p) => p.slice(1));
      onResolved?.();
    });
  };

  if (!current) {
    return (
      <div className="flex flex-col gap-5">
        <p
          role="status"
          className="rounded-card border-[length:--border-width-ink] border-ink bg-surface-card px-5 py-4 font-body text-body text-ink"
        >
          Plus rien à vérifier. Ton réseau est à jour.
        </p>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="self-start rounded-button border-[length:--border-width-ink] border-ink bg-accent px-6 py-3 font-body text-button font-bold text-accent-on shadow-[var(--shadow-button-primary)] outline-accent outline-offset-2 focus-visible:outline-2"
          >
            Revenir au réseau
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft">
        {pile.length} à vérifier
      </p>

      {error ? (
        <p
          role="alert"
          className="rounded-md border-[length:--border-width-ink] border-accent bg-accent-tint px-4 py-3 font-body text-body text-accent-deep"
        >
          {error}
        </p>
      ) : null}

      <article className="flex flex-col gap-4 rounded-card border-[length:--border-width-ink] border-ink bg-surface-card px-5 py-4">
        <p className="font-body text-body text-ink">
          Cette ligne ressemble à un contact que tu as déjà. On ne fusionne rien
          sans toi.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {/* Le contact EXISTANT. */}
          <div className="flex flex-col gap-1 rounded-md border-[length:--border-width-ink] border-line bg-surface-note px-3 py-2">
            <span className="font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft">
              Déjà dans ton réseau
            </span>
            <span className="font-display text-body font-semibold text-ink">
              {current.existing?.nom ?? "Contact existant"}
            </span>
            {current.existing?.entreprise ? (
              <span className="font-body text-label text-ink-soft">
                {current.existing.entreprise}
              </span>
            ) : null}
          </div>

          {/* La ligne ENTRANTE (CSV). */}
          <div className="flex flex-col gap-1 rounded-md border-[length:--border-width-ink] border-line bg-surface-note px-3 py-2">
            <span className="font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft">
              Dans ton import
            </span>
            <span className="font-display text-body font-semibold text-ink">
              {current.nom}
            </span>
            {current.entreprise ? (
              <span className="font-body text-label text-ink-soft">
                {current.entreprise}
              </span>
            ) : null}
            {current.email ? (
              <span className="font-body text-label text-ink-soft">
                {current.email}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => decide("merge")}
            className="rounded-button border-[length:--border-width-ink] border-ink bg-accent px-6 py-3 font-body text-button font-bold text-accent-on shadow-[var(--shadow-button-primary)] outline-accent outline-offset-2 focus-visible:outline-2 disabled:opacity-70"
          >
            {pending ? "Un instant…" : "Fusionner"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => decide("keep_separate")}
            className="rounded-button border-[length:--border-width-ink] border-ink bg-surface-card px-6 py-3 font-body text-button font-bold text-ink outline-accent outline-offset-2 focus-visible:outline-2 disabled:opacity-70"
          >
            Garder séparés
          </button>
        </div>
      </article>

      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="self-start rounded-button px-4 py-3 font-body text-body font-bold text-ink-soft outline-accent outline-offset-2 focus-visible:outline-2"
        >
          Plus tard
        </button>
      ) : null}
    </div>
  );
}

export default MergeReviewDeck;
