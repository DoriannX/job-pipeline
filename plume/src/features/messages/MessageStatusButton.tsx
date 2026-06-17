"use client";

// Pastille de statut TAPPABLE + mini-sheet (Epic 3, story 3.8) — wrapper CLIENT par carte.
//
// La timeline « Votre histoire » est rendue par un SERVER component (ContactDetail). La
// pastille de statut d'un Message devient un VRAI <button> : la toucher ouvre un MINI-SHEET
// (FR-19, UX-DR22) — overlay role=dialog/aria-modal, fermable à l'Échap et au backdrop,
// calqué sur DeleteContactDialog — proposant les transitions LÉGALES depuis le statut
// courant (Vu / Répondu / Sans réponse), libellées en FR. Toucher une option appelle la
// server action `setMessageStatusAction` ; succès → router.refresh() (la pastille reflète
// le nouveau statut) SANS quitter la fiche. Échec / illégal → message doux (jamais rouge).
//
// Une pastille SANS option légale (statuts terminaux `repondu`/`ignore`, ou `brouillon`)
// n'est PAS tappable : on rend une pastille STATIQUE (aucun sheet, « rien à changer »).
//
// Barrière : ce module n'importe NI schéma NI Drizzle. Style aux tokens du design-system.

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";

import type { MessageStatut } from "@/lib/domain/enums";
import type { StatutOption } from "@/features/contacts/contact-detail";

import { setMessageStatusAction } from "./status";

interface MessageStatusButtonProps {
  /** Id du Message dont on fait évoluer le statut. */
  messageId: string;
  /** Libellé FR du statut COURANT (rendu dans la pastille). */
  statutLabel: string;
  /** Transitions manuelles légales depuis le statut courant (vide ⇒ non tappable). */
  options: StatutOption[];
  /** Mise en avant visuelle (accent mauve) de la carte — aligne la pastille. */
  accent: boolean;
}

export function MessageStatusButton({
  messageId,
  statutLabel,
  options,
  accent,
}: MessageStatusButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  // Message doux d'échec / transition illégale (jamais rouge alarme) ; null = rien.
  const [notice, setNotice] = useState<string | null>(null);
  const titleId = useId();
  const noticeId = useId();

  // Couleur d'encre de la pastille, alignée sur l'accent de la carte (cohérent timeline).
  const tone = accent ? "text-accent-deep" : "text-ink-soft";

  // Fermeture à l'Échap quand le sheet est ouvert (a11y clavier, comme DeleteContactDialog).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Statut TERMINAL ou brouillon : aucune transition manuelle → pastille STATIQUE (FR-19).
  // On garde le libellé lisible, mais on ne propose AUCUNE action (rien à changer).
  if (options.length === 0) {
    return (
      <span
        className={`text-label font-bold uppercase tracking-[0.12em] ${tone}`}
      >
        {statutLabel}
      </span>
    );
  }

  function ouvrir() {
    setNotice(null);
    setOpen(true);
  }

  function fermer() {
    setOpen(false);
    setNotice(null);
  }

  async function choisir(cible: MessageStatut) {
    setPending(true);
    setNotice(null);
    const result = await setMessageStatusAction({ messageId, statut: cible });
    setPending(false);

    if (result.status === "ok") {
      // Le sheet se referme ; on re-lit la fiche serveur (la pastille reflète le statut).
      setOpen(false);
      router.refresh();
      return;
    }

    // Illégal / échec doux : on garde le sheet ouvert, on annonce l'avis (sans quitter).
    setNotice(result.error);
  }

  return (
    <>
      {/* — Pastille TAPPABLE : un vrai bouton (aria-haspopup=dialog), focus mauve, libellé
          courant suivi d'un séparateur « · » discret (affordance « tappable »). — */}
      <button
        type="button"
        onClick={ouvrir}
        aria-haspopup="dialog"
        className={`inline-flex items-center gap-1 rounded-button px-1 py-0.5 text-label font-bold uppercase tracking-[0.12em] outline-accent outline-offset-2 focus-visible:outline-2 ${tone}`}
      >
        {statutLabel}
        <span aria-hidden="true">·</span>
      </button>

      {/* — MINI-SHEET : overlay role=dialog/aria-modal, backdrop cliquable, calqué sur
          DeleteContactDialog. Les options = transitions LÉGALES (Vu / Répondu / Sans réponse). — */}
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={notice ? noticeId : undefined}
          className="fixed inset-0 z-20 flex items-end justify-center bg-ink/30 px-margin-mobile py-6 sm:items-center"
        >
          {/* Backdrop : un tap hors du panneau referme le sheet (sans rien changer). */}
          <button
            type="button"
            aria-label="Fermer"
            onClick={fermer}
            className="absolute inset-0 cursor-default"
            tabIndex={-1}
          />

          <div className="relative w-full max-w-md rounded-sheet border-[length:--border-width-ink] border-ink bg-surface-card p-6 shadow-[var(--shadow-group-accent)]">
            <h2
              id={titleId}
              className="font-display text-display-title font-semibold tracking-[-0.01em] text-ink"
            >
              Où en est l&apos;échange ?
            </h2>
            <p className="mt-2 font-body text-body text-ink-soft">
              Mets ce message à jour d&apos;un tap.
            </p>

            {/* Avis DOUX (transition illégale / échec) — mauve mesuré, jamais rouge alarme. */}
            {notice ? (
              <p
                id={noticeId}
                role="alert"
                className="mt-4 rounded-md border-[length:--border-width-ink] border-accent bg-accent-tint px-4 py-2 font-body text-label text-accent-deep"
              >
                {notice}
              </p>
            ) : null}

            <ul className="mt-6 flex flex-col gap-2">
              {options.map((opt) => (
                <li key={opt.statut}>
                  <button
                    type="button"
                    onClick={() => choisir(opt.statut)}
                    disabled={pending}
                    className="flex w-full items-center justify-between rounded-button border-[length:--border-width-ink] border-ink bg-surface-card px-5 py-3 font-body text-body font-bold text-ink shadow-[var(--shadow-button-primary)] outline-accent outline-offset-2 focus-visible:outline-2 disabled:opacity-70"
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex items-center justify-end">
              <button
                type="button"
                onClick={fermer}
                disabled={pending}
                className="rounded-button px-4 py-3 font-body text-body font-bold text-ink-soft outline-accent outline-offset-2 focus-visible:outline-2 disabled:opacity-70"
              >
                {pending ? "Un instant…" : "Fermer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default MessageStatusButton;
