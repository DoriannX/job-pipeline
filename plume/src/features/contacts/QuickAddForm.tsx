"use client";

// Ajout rapide MULTIPLE (story 2.2). Zone de collage (textarea) + bouton « Ajouter »
// (primitive chunky mauve, design-system). On colle N lignes (« Nom, Entreprise » ou
// un nom par ligne) → N Contacts créés en une action, dédupliqués (AR-9).
//
// À la soumission, un mini compte-rendu NEUTRE s'affiche : « N créés · N fusionnés »
// (ton neutre, jamais d'alarme). a11y : label explicite, focus net (flou=0 via
// outline mauve), statut annoncé (role="status", aria-live="polite").
//
// Aucune couleur hex hors design/ : on n'utilise que les tokens (accent, ink, surface…).

import { useActionState } from "react";

import { quickAddAction, type QuickAddState } from "./actions";

const INITIAL: QuickAddState = { ok: false };

interface QuickAddFormProps {
  /** Callback après un ajout réussi (refresh de la liste serveur). */
  onSuccess?: () => void;
  /** Callback d'annulation (retour à la liste), facultatif. */
  onCancel?: () => void;
}

export function QuickAddForm({ onSuccess, onCancel }: QuickAddFormProps) {
  const [state, formAction, pending] = useActionState(
    async (prev: QuickAddState, formData: FormData) => {
      const next = await quickAddAction(prev, formData);
      if (next.ok) onSuccess?.();
      return next;
    },
    INITIAL,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* Message d'erreur DOUX (mauve mesuré) — jamais rouge alarme. */}
      {state.error ? (
        <p
          role="alert"
          className="rounded-md border-[length:--border-width-ink] border-accent bg-accent-tint px-4 py-3 font-body text-body text-accent-deep"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label
          htmlFor="quickadd-text"
          className="font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft"
        >
          Colle ta liste
        </label>
        <p id="quickadd-hint" className="font-body text-body text-ink-soft">
          Une personne par ligne. Tu peux ajouter l&apos;entreprise après une
          virgule, par exemple «&nbsp;Léa Martin, Acme&nbsp;».
        </p>
        <textarea
          id="quickadd-text"
          name="rawText"
          rows={6}
          required
          aria-describedby="quickadd-hint"
          placeholder={"Léa Martin, Acme\nHervé Dupont\nNour, Studio Bleu"}
          className="w-full resize-y rounded-md border-[length:--border-width-ink] border-ink bg-surface-note px-4 py-3 font-body text-body text-ink placeholder:text-ink-hint outline-accent outline-offset-2 focus-visible:outline-2"
        />
      </div>

      {/* Mini compte-rendu NEUTRE — annoncé poliment, ton sobre (jamais d'alarme). */}
      {state.ok && state.report ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border-[length:--border-width-ink] border-ink bg-surface-card px-4 py-3 font-body text-body text-ink"
        >
          {state.report.created} créé{state.report.created > 1 ? "s" : ""}
          {" · "}
          {state.report.merged} fusionné{state.report.merged > 1 ? "s" : ""}
        </p>
      ) : null}

      {/* Actions : primaire chunky mauve + annuler discret. */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-button border-[length:--border-width-ink] border-ink bg-accent px-6 py-3 font-body text-button font-bold text-accent-on shadow-[var(--shadow-button-primary)] outline-accent outline-offset-2 focus-visible:outline-2 disabled:opacity-70"
        >
          {pending ? "Un instant…" : "Ajouter"}
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
  );
}

export default QuickAddForm;
