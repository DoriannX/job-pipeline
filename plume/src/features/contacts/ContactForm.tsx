"use client";

// Formulaire d'ajout / édition d'un Contact (story 2.1).
// Primitives design-system uniquement (aucune couleur hex hors design/). Champs sur
// fond `surface-note`, contour encre ; bouton primaire chunky mauve. Sélecteur de
// canal = 4 boutons-icônes maison (linkedin/email/whatsapp/sms). Validation Zod côté
// action ; les erreurs reviennent en bandeau inline DOUX (mauve mesuré, jamais rouge).

import { useActionState } from "react";

import { Icon, type IconName } from "@/design/icons";
import { CANAUX, type Canal } from "@/lib/domain/enums";

import type { ContactFormState } from "./actions";
import type { ContactHandle } from "./types";

// Libellés FR des 4 canaux + icône maison correspondante.
const CANAL_LABEL: Record<Canal, string> = {
  linkedin: "LinkedIn",
  email: "E-mail",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

// Champs handles affichés (clé technique + libellé + placeholder doux).
const HANDLE_FIELDS: { key: ContactHandle; label: string; placeholder: string }[] =
  [
    { key: "linkedin", label: "LinkedIn", placeholder: "lien ou pseudo" },
    { key: "email", label: "E-mail", placeholder: "prenom@exemple.fr" },
    { key: "phone", label: "Téléphone", placeholder: "06 12 34 56 78" },
    { key: "whatsapp", label: "WhatsApp", placeholder: "numéro WhatsApp" },
  ];

const CANAL_ICON: Record<Canal, IconName> = {
  linkedin: "linkedin",
  email: "email",
  whatsapp: "whatsapp",
  sms: "sms",
};

/** Valeurs initiales (édition) ; toutes optionnelles (ajout = vide). */
export type ContactFormDefaults = {
  id?: string;
  nom?: string;
  canalPrefere?: Canal | null;
  handles?: Partial<Record<ContactHandle, string>> | null;
  notes?: string | null;
};

type ContactAction = (
  prev: ContactFormState,
  formData: FormData,
) => Promise<ContactFormState>;

const INITIAL: ContactFormState = { ok: false };

// Classe partagée des champs texte (fond note, contour encre, focus mauve net).
const FIELD_CLASS =
  "w-full rounded-md border-[length:--border-width-ink] border-ink bg-surface-note px-4 py-3 font-body text-body text-ink placeholder:text-ink-hint outline-accent outline-offset-2 focus-visible:outline-2";

interface ContactFormProps {
  /** Action serveur (créer ou mettre à jour), compatible useActionState. */
  action: ContactAction;
  /** Libellé du bouton de soumission (ex. « Ajouter », « Enregistrer »). */
  submitLabel: string;
  /** Valeurs pré-remplies (mode édition). */
  defaults?: ContactFormDefaults;
  /** Callback d'annulation (retour à la liste), facultatif. */
  onCancel?: () => void;
  /** Appelé après un enregistrement réussi (retour liste / refresh). */
  onSuccess?: () => void;
}

export function ContactForm({
  action,
  submitLabel,
  defaults,
  onCancel,
  onSuccess,
}: ContactFormProps) {
  const [state, formAction, pending] = useActionState(
    async (prev: ContactFormState, formData: FormData) => {
      const next = await action(prev, formData);
      if (next.ok) onSuccess?.();
      return next;
    },
    INITIAL,
  );

  const fieldErr = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {defaults?.id ? (
        <input type="hidden" name="id" value={defaults.id} />
      ) : null}

      {/* Bandeau d'erreur DOUX (mauve-tint, contour mauve) — jamais rouge alarme. */}
      {state.error ? (
        <p
          role="alert"
          className="rounded-md border-[length:--border-width-ink] border-accent bg-accent-tint px-4 py-3 font-body text-body text-accent-deep"
        >
          {state.error}
        </p>
      ) : null}

      {/* Nom (requis) */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="contact-nom"
          className="font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft"
        >
          Nom
        </label>
        <input
          id="contact-nom"
          name="nom"
          type="text"
          required
          defaultValue={defaults?.nom ?? ""}
          placeholder="Prénom Nom"
          autoComplete="off"
          aria-invalid={fieldErr.nom ? true : undefined}
          aria-describedby={fieldErr.nom ? "err-nom" : undefined}
          className={FIELD_CLASS}
        />
        {fieldErr.nom ? (
          <span id="err-nom" className="font-body text-label text-accent-deep">
            {fieldErr.nom}
          </span>
        ) : null}
      </div>

      {/* Canal préféré — 4 boutons-icônes radio (jamais la couleur seule : le picto
          + le label + l'état coché portent l'info ; actif = langage mauve). */}
      <fieldset className="flex flex-col gap-2">
        <legend className="font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft">
          Canal préféré
        </legend>
        <div className="flex flex-wrap gap-2">
          {CANAUX.map((canal) => {
            const checked = defaults?.canalPrefere === canal;
            return (
              <label
                key={canal}
                className="group inline-flex cursor-pointer items-center gap-2 rounded-button border-[length:--border-width-ink] border-ink bg-surface-card px-4 py-2 font-body text-body text-ink has-[:checked]:bg-accent-tint has-[:checked]:text-accent-deep has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-offset-2"
              >
                <input
                  type="radio"
                  name="canalPrefere"
                  value={canal}
                  defaultChecked={checked}
                  className="sr-only"
                />
                <Icon name={CANAL_ICON[canal]} size={20} />
                {CANAL_LABEL[canal]}
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Handles (coordonnées par canal) */}
      <fieldset className="flex flex-col gap-3">
        <legend className="font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft">
          Coordonnées
        </legend>
        {HANDLE_FIELDS.map(({ key, label, placeholder }) => (
          <div key={key} className="flex flex-col gap-1">
            <label
              htmlFor={`handle-${key}`}
              className="font-body text-body text-ink-soft"
            >
              {label}
            </label>
            <input
              id={`handle-${key}`}
              name={`handle_${key}`}
              type="text"
              defaultValue={defaults?.handles?.[key] ?? ""}
              placeholder={placeholder}
              autoComplete="off"
              className={FIELD_CLASS}
            />
          </div>
        ))}
      </fieldset>

      {/* Notes */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="contact-notes"
          className="font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft"
        >
          Notes
        </label>
        <textarea
          id="contact-notes"
          name="notes"
          rows={3}
          defaultValue={defaults?.notes ?? ""}
          placeholder="Ce que tu veux garder en tête…"
          className={`${FIELD_CLASS} resize-y`}
        />
      </div>

      {/* Actions : primaire chunky mauve + annuler discret. */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-button border-[length:--border-width-ink] border-ink bg-accent px-6 py-3 font-body text-button font-bold text-accent-on shadow-[var(--shadow-button-primary)] outline-accent outline-offset-2 focus-visible:outline-2 disabled:opacity-70"
        >
          {pending ? "Un instant…" : submitLabel}
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

export default ContactForm;
