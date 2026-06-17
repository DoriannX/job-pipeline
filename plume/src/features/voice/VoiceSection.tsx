"use client";

// Section « Ta voix » des Réglages (story 3.5) — wrapper CLIENT minimal.
//
// La page Réglages est un SERVER component (lecture des seeds via db.forUser). Cette
// section pilote les moments INTERACTIFS : ajouter un seed (textarea + bouton), lister
// les seeds existants (texte tronqué) et en supprimer un. Toute la donnée passe par les
// server actions (`addVoiceSeedAction`, `removeVoiceSeedAction`) — AUCUNE logique data ici.
//
// Barrière : ce module n'importe NI schéma NI Drizzle. Il reçoit une vue plate des seeds.
// Le seed est OPTIONNEL (FR-16) : sans seed, Plume écrit en ton NEUTRE — « ne rien
// ajouter » est évident et sans échec. Style aux tokens (imite QuickAddForm).
//
// a11y : label explicite, focus net (flou=0 via outline mauve), statut annoncé.

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/design/icons";

import {
  addVoiceSeedAction,
  removeVoiceSeedAction,
  type AddVoiceSeedState,
  type VoiceSeedView,
} from "./actions";

const INITIAL: AddVoiceSeedState = { ok: false };

/** Longueur d'aperçu d'un seed dans la liste (texte tronqué, jamais le pavé entier). */
const PREVIEW_MAX = 140;

function preview(texte: string): string {
  const oneLine = texte.replace(/\s+/g, " ").trim();
  return oneLine.length > PREVIEW_MAX
    ? `${oneLine.slice(0, PREVIEW_MAX).trimEnd()}…`
    : oneLine;
}

interface VoiceSectionProps {
  /** Seeds existants (vue plate, ordonnés du plus récent au plus ancien). */
  seeds: VoiceSeedView[];
}

export function VoiceSection({ seeds }: VoiceSectionProps) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isRemoving, startRemoving] = useTransition();

  const [state, formAction, pending] = useActionState(
    async (prev: AddVoiceSeedState, formData: FormData) => {
      const next = await addVoiceSeedAction(prev, formData);
      if (next.ok) {
        // Re-rend la page serveur : la liste des seeds se rafraîchit.
        router.refresh();
      }
      return next;
    },
    INITIAL,
  );

  function remove(id: string) {
    setRemovingId(id);
    startRemoving(async () => {
      await removeVoiceSeedAction(id);
      setRemovingId(null);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-5 rounded-card border-[length:--border-width-ink] border-ink bg-surface-card p-5 shadow-[var(--shadow-group-mint)]">
      <header className="flex flex-col gap-2">
        <h2 className="font-display text-display-title font-semibold tracking-[-0.01em] text-ink">
          Ta voix
        </h2>
        <p className="font-body text-body text-ink-soft">
          Colle un ou deux anciens messages : Plume s&apos;en inspire pour
          écrire comme toi. C&apos;est optionnel — sans rien ajouter, Plume
          garde un ton neutre, tout simplement.
        </p>
      </header>

      {/* — Ajouter à ma voix — */}
      <form action={formAction} className="flex flex-col gap-3">
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
            htmlFor="voice-seed-text"
            className="font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft"
          >
            Un ancien message
          </label>
          <textarea
            id="voice-seed-text"
            name="texte"
            rows={5}
            required
            placeholder="Colle ici un message que tu as déjà écrit, dans ton style à toi."
            className="w-full resize-y rounded-md border-[length:--border-width-ink] border-ink bg-surface-note px-4 py-3 font-body text-body text-ink placeholder:text-ink-hint outline-accent outline-offset-2 focus-visible:outline-2"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="rounded-button border-[length:--border-width-ink] border-ink bg-accent px-6 py-3 font-body text-button font-bold text-accent-on shadow-[var(--shadow-button-primary)] outline-accent outline-offset-2 focus-visible:outline-2 disabled:opacity-70"
          >
            {pending ? "Un instant…" : "Ajouter à ma voix"}
          </button>
        </div>
      </form>

      {/* — Liste des seeds existants (texte tronqué) — */}
      {seeds.length > 0 ? (
        <ul className="flex flex-col gap-3" aria-label="Tes messages d'amorce">
          {seeds.map((seed) => (
            <li
              key={seed.id}
              className="flex items-start justify-between gap-3 rounded-md border-[length:--border-width-ink] border-line bg-surface-note px-4 py-3"
            >
              <p className="font-body text-body text-ink">{preview(seed.texte)}</p>
              <button
                type="button"
                onClick={() => remove(seed.id)}
                disabled={isRemoving && removingId === seed.id}
                aria-label="Retirer ce message de ma voix"
                className="inline-flex shrink-0 items-center gap-2 rounded-button px-3 py-2 font-body text-body font-bold text-ink-soft outline-accent outline-offset-2 focus-visible:outline-2 disabled:opacity-70"
              >
                <Icon name="trash" size={20} />
                Retirer
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p
          role="status"
          className="rounded-md border-[length:--border-width-ink] border-line bg-surface-note px-4 py-3 font-body text-body text-ink-soft"
        >
          Aucune amorce pour l&apos;instant. Tu peux passer : Plume écrira dans
          un ton neutre.
        </p>
      )}
    </section>
  );
}

export default VoiceSection;
