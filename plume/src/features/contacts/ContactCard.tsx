"use client";

// Carte d'un Contact dans la liste sobre du Réseau (story 2.1).
// La galerie d'avatars triée par froideur = story 2.3 : ici, simple carte lisible.
// Chaque carte expose : le nom, le bouton « Écrire » (placeholder désactivé, ouverture
// réelle = Epic 3), et l'accès Édition / Suppression. Aucune couleur hex hors design/.

import { Icon } from "@/design/icons";

import type { ContactView } from "./types";

interface ContactCardProps {
  contact: ContactView;
  onEdit: (contact: ContactView) => void;
  onDelete: (contact: ContactView) => void;
}

export function ContactCard({ contact, onEdit, onDelete }: ContactCardProps) {
  return (
    <li className="flex flex-col gap-3 rounded-card border-[length:--border-width-ink] border-ink bg-surface-card p-4">
      <h2 className="font-display text-display-title font-semibold tracking-[-0.01em] text-ink">
        {contact.nom}
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        {/* « Écrire » VISIBLE mais désactivé : l'ouverture réelle arrive à l'Epic 3. */}
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Bientôt : écrire à ce contact (Epic 3)"
          className="inline-flex items-center gap-2 rounded-button border-[length:--border-width-ink] border-ink bg-accent px-4 py-2 font-body text-body font-bold text-accent-on shadow-[var(--shadow-button-primary)] opacity-60"
        >
          <Icon name="arrow-up" size={20} />
          Écrire
        </button>

        <button
          type="button"
          onClick={() => onEdit(contact)}
          className="inline-flex items-center gap-2 rounded-button border-[length:--border-width-ink] border-ink bg-surface-card px-4 py-2 font-body text-body font-bold text-ink outline-accent outline-offset-2 focus-visible:outline-2"
        >
          <Icon name="edit" size={20} />
          Modifier
        </button>

        <button
          type="button"
          onClick={() => onDelete(contact)}
          className="rounded-button px-4 py-2 font-body text-body font-bold text-ink-soft outline-accent outline-offset-2 focus-visible:outline-2"
        >
          Retirer
        </button>
      </div>
    </li>
  );
}

export default ContactCard;
