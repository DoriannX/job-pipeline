"use client";

// Confirmation d'ARCHIVAGE d'un Contact (soft-delete).
// On n'efface JAMAIS : le contact est archivé (réversible), son histoire (messages,
// relances) est conservée. Ton doux, mauve mesuré, JAMAIS de rouge alarme. Le bouton
// d'action porte le langage mauve (accent), pas une couleur de danger.

import { useTransition } from "react";

import { deleteContactAction } from "./actions";
import type { ContactView } from "./types";

interface DeleteContactDialogProps {
  contact: ContactView;
  onCancel: () => void;
  onDeleted: () => void;
}

export function DeleteContactDialog({
  contact,
  onCancel,
  onDeleted,
}: DeleteContactDialogProps) {
  const [pending, startTransition] = useTransition();

  function confirm() {
    const formData = new FormData();
    formData.set("id", contact.id);
    startTransition(async () => {
      await deleteContactAction(formData);
      onDeleted();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="del-title"
      className="fixed inset-0 z-20 flex items-end justify-center bg-ink/30 px-margin-mobile py-6 sm:items-center"
    >
      <div className="w-full max-w-md rounded-sheet border-[length:--border-width-ink] border-ink bg-surface-card p-6 shadow-[var(--shadow-group-accent)]">
        <h2
          id="del-title"
          className="font-display text-display-title font-semibold tracking-[-0.01em] text-ink"
        >
          Archiver {contact.nom} ?
        </h2>
        <p className="mt-3 font-body text-body text-ink-soft">
          Ce contact quitte ton réseau, mais son histoire (messages, relances)
          est conservée. Tu pourras le retrouver en le ré-ajoutant.
        </p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-button px-4 py-3 font-body text-body font-bold text-ink-soft outline-accent outline-offset-2 focus-visible:outline-2 disabled:opacity-70"
          >
            Garder
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="rounded-button border-[length:--border-width-ink] border-ink bg-accent px-6 py-3 font-body text-button font-bold text-accent-on shadow-[var(--shadow-button-primary)] outline-accent outline-offset-2 focus-visible:outline-2 disabled:opacity-70"
          >
            {pending ? "Un instant…" : "Archiver"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteContactDialog;
