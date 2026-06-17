"use client";

// Verrou read-only après Envoyé + Modifier (Epic 3, story 3.7) — wrapper CLIENT par carte.
//
// La timeline « Votre histoire » est rendue par un SERVER component (ContactDetail). Le
// texte d'un Message envoyé est READ-ONLY PAR DÉFAUT : un rendu STATIQUE (jamais un champ
// éditable, FR-20). Toucher « Modifier » (bouton DISCRET) rouvre LA carte en édition —
// un textarea inline pré-rempli — sans quitter la fiche. « Enregistrer » appelle la server
// action `editSentMessageAction` (verrou optimiste) ; « Annuler » revient en read-only.
//
// Le `updatedAt` reçu en prop est le JETON DE VERSION optimiste (`expectedUpdatedAt`) : il
// prouve l'état qu'on édite. Succès → la carte revient en read-only avec le nouveau texte
// (router.refresh re-lit la fiche serveur). CONFLIT (409) → message doux « modifié
// ailleurs, recharge » SANS écraser la saisie. L'édition est IMPOSSIBLE hors Modifier
// (aucun champ tant qu'on n'a pas cliqué) ; l'autorité serveur sur `Sent` est le 2e verrou.
//
// Barrière : ce module n'importe NI schéma NI Drizzle. Style aux tokens du design-system.

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/design/icons";

import { editSentMessageAction } from "./edit";

interface MessageCardActionsProps {
  /** Id du Message envoyé (clé d'édition côté serveur). */
  messageId: string;
  /** Texte FIGÉ courant — rendu statiquement, pré-rempli dans le textarea à l'ouverture. */
  texte: string;
  /** Jeton de version optimiste courant (`expectedUpdatedAt`). */
  updatedAt: number;
  /** Mise en avant visuelle (accent mauve) de la carte — aligne les libellés. */
  accent: boolean;
}

// Champ texte d'édition : fond note, contour encre, focus mauve net (cohérent ContactForm).
const FIELD_CLASS =
  "w-full rounded-md border-[length:--border-width-ink] border-ink bg-surface-note px-4 py-3 font-body text-body text-ink placeholder:text-ink-hint outline-accent outline-offset-2 focus-visible:outline-2";

export function MessageCardActions({
  messageId,
  texte,
  updatedAt,
  accent,
}: MessageCardActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(texte);
  const [pending, setPending] = useState(false);
  // Message doux d'échec / conflit (jamais rouge alarme) ; null = rien à signaler.
  const [notice, setNotice] = useState<string | null>(null);

  function ouvrir() {
    // Rouvre LA carte en édition : on repart du texte courant et on efface tout avis.
    setDraft(texte);
    setNotice(null);
    setEditing(true);
  }

  function annuler() {
    // Retour read-only sans rien changer (saisie abandonnée).
    setEditing(false);
    setNotice(null);
  }

  async function enregistrer() {
    setPending(true);
    setNotice(null);
    const result = await editSentMessageAction({
      messageId,
      texte: draft,
      expectedUpdatedAt: updatedAt,
    });
    setPending(false);

    if (result.status === "ok") {
      // La carte revient en read-only ; on re-lit la fiche serveur (nouveau texte + jeton).
      setEditing(false);
      router.refresh();
      return;
    }

    // Conflit (409) ou échec doux : on garde l'édition ouverte, la saisie n'est PAS écrasée.
    setNotice(result.error);
  }

  // — Édition en place : textarea inline pré-rempli, dans LA carte timeline. —
  if (editing) {
    return (
      <div className="flex flex-col gap-3">
        <label htmlFor={`edit-${messageId}`} className="sr-only">
          Modifier le message
        </label>
        <textarea
          id={`edit-${messageId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          autoFocus
          aria-describedby={notice ? `edit-notice-${messageId}` : undefined}
          className={`${FIELD_CLASS} resize-y`}
        />

        {/* Avis DOUX (conflit 409 / échec) — mauve mesuré, jamais rouge alarme. */}
        {notice ? (
          <p
            id={`edit-notice-${messageId}`}
            role="alert"
            className="rounded-md border-[length:--border-width-ink] border-accent bg-accent-tint px-4 py-2 font-body text-label text-accent-deep"
          >
            {notice}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={enregistrer}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-button border-[length:--border-width-ink] border-ink bg-accent px-5 py-2 font-body text-button font-bold text-accent-on shadow-[var(--shadow-button-primary)] outline-accent outline-offset-2 focus-visible:outline-2 disabled:opacity-70"
          >
            <Icon name="check" size={18} />
            {pending ? "Un instant…" : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={annuler}
            disabled={pending}
            className="rounded-button px-4 py-2 font-body text-body font-bold text-ink-soft outline-accent outline-offset-2 focus-visible:outline-2 disabled:opacity-70"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  // — READ-ONLY par défaut : le texte est un rendu STATIQUE (aucun champ) + Modifier discret. —
  return (
    <div className="flex flex-col gap-2">
      <p className="whitespace-pre-line font-body text-body text-ink">{texte}</p>
      <button
        type="button"
        onClick={ouvrir}
        className={`inline-flex w-fit items-center gap-1.5 rounded-button px-2 py-1 font-body text-label font-bold outline-accent outline-offset-2 focus-visible:outline-2 ${
          accent ? "text-accent-deep" : "text-ink-soft"
        }`}
      >
        <Icon name="edit" size={16} />
        Modifier
      </button>
    </div>
  );
}

export default MessageCardActions;
