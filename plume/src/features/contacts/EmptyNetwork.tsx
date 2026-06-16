"use client";

// État vide d'AMORÇAGE du Réseau — moment « réseau vide / premier contact » (story 2.1).
// PROPRIÉTAIRE UNIQUE de ce moment : l'onboarding (Epic 5) RÉUTILISE cet écran tel quel,
// il ne le re-conçoit pas. DISTINCT de l'état « deck terminé » (UX-DR23) : ici on AMORCE,
// on ne clôt pas. Composition : plume-mascotte + titre d'invitation + CTA chunky mauve.

import { Icon } from "@/design/icons";
import { Plume } from "@/design/illustration/Plume";

interface EmptyNetworkProps {
  /** Ouvre le formulaire d'ajout du premier contact. */
  onAddFirst: () => void;
  /** Ouvre l'import CSV LinkedIn (backfill en masse, story 2.5), facultatif. */
  onImport?: () => void;
}

export function EmptyNetwork({ onAddFirst, onImport }: EmptyNetworkProps) {
  return (
    <section className="flex min-h-full flex-col items-center justify-center gap-5 px-margin-mobile py-12 text-center">
      <Plume name="feather" size={120} />

      <h1 className="font-display text-display-title font-semibold tracking-[-0.01em] text-ink">
        Par qui on commence ?
      </h1>
      <p className="max-w-xs font-body text-body text-ink-soft">
        Ton réseau démarre avec une première personne. Ajoute-la, et Plume
        t&apos;aidera à garder le lien au chaud.
      </p>

      <button
        type="button"
        onClick={onAddFirst}
        className="inline-flex items-center gap-2 rounded-button border-[length:--border-width-ink] border-ink bg-accent px-6 py-3 font-body text-button font-bold text-accent-on shadow-[var(--shadow-button-primary)] outline-accent outline-offset-2 focus-visible:outline-2"
      >
        <Icon name="plus" size={24} />
        Ajouter un premier contact
      </button>

      {onImport ? (
        <button
          type="button"
          onClick={onImport}
          className="rounded-button px-4 py-2 font-body text-body font-bold text-ink-soft underline-offset-2 outline-accent outline-offset-2 hover:underline focus-visible:outline-2"
        >
          ou importer un CSV LinkedIn
        </button>
      ) : null}
    </section>
  );
}

export default EmptyNetwork;
