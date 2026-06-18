"use client";

// Actions de la fiche Contact (story 2.4) — wrapper CLIENT minimal.
//
// La fiche elle-même est un SERVER component (lecture via db.forUser). Or « Modifier »
// et « Supprimer » sont des moments INTERACTIFS qui réutilisent des composants clients
// (ContactForm, DeleteContactDialog) et les server actions existantes (updateContactAction,
// deleteContactAction) — AUCUNE logique dupliquée ici. Ce wrapper pilote juste l'ouverture
// du formulaire d'édition / de la confirmation de suppression DEPUIS la fiche.
//
// Barrière : ce module n'importe NI schéma NI Drizzle. Il reçoit une vue plate du contact.
// Après édition : on rafraîchit la fiche serveur (router.refresh) — la froideur et les
// canaux se recalculent. Après suppression : le contact n'existe plus → retour /reseau.

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Icon } from "@/design/icons";

import { updateContactAction } from "./actions";
import { ContactForm, type ContactFormDefaults } from "./ContactForm";
import { DeleteContactDialog } from "./DeleteContactDialog";
import type { ContactDetailView } from "./contact-detail";
import type { ContactView } from "./types";

interface ContactDetailActionsProps {
  contact: ContactDetailView;
}

export function ContactDetailActions({ contact }: ContactDetailActionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Ouvre le Composeur EN FLOW (story 3.1) : on pose `?compose=<id>` SANS quitter la fiche
  // (même path préservé). Le ComposerSheet, monté une fois dans le layout, lit ce param et
  // monte la bottom-sheet. C'est le point d'entrée dogfoodable (la File du jour = Epic 4).
  function ecrire() {
    router.push(`${pathname}?compose=${contact.id}`, { scroll: false });
  }

  // Valeurs pré-remplies du formulaire d'édition (mêmes champs que la galerie).
  const defaults: ContactFormDefaults = {
    id: contact.id,
    nom: contact.nom,
    entreprise: contact.entreprise,
    canalPrefere: contact.canalPrefere,
    handles: contact.handles,
    notes: contact.notes,
  };

  // DeleteContactDialog attend une ContactView (galerie) ; on réutilise sa forme — seuls
  // l'id et le nom y sont lus pour la confirmation. Aucune logique de suppression ici :
  // tout passe par deleteContactAction (interne au dialogue).
  const viewForDialog: ContactView = {
    id: contact.id,
    nom: contact.nom,
    canalPrefere: contact.canalPrefere,
    handles: contact.handles,
    notes: contact.notes,
    dernierContactAt: contact.dernierContactAt,
    coldness: contact.coldness,
  };

  // — Édition en place : on remplace les boutons par le formulaire (même flow que la galerie). —
  if (editing) {
    return (
      <div className="flex flex-col gap-5 rounded-card border-[length:--border-width-ink] border-ink bg-surface-card p-5 shadow-[var(--shadow-group-mint)]">
        <h2 className="font-display text-display-title font-semibold tracking-[-0.01em] text-ink">
          Modifier le contact
        </h2>
        <ContactForm
          action={updateContactAction}
          submitLabel="Enregistrer"
          defaults={defaults}
          onCancel={() => setEditing(false)}
          onSuccess={() => {
            setEditing(false);
            // Re-rend la fiche serveur : nom/canaux/froideur à jour.
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <>
      {/* — Écrire — action PRIMAIRE chunky (mauve plein) : ouvre le Composeur en flow. — */}
      <button
        type="button"
        onClick={ecrire}
        className="inline-flex w-fit items-center gap-2 self-center rounded-button border-[length:--border-width-ink] border-ink bg-accent px-6 py-3 font-body text-button font-bold text-accent-on shadow-[var(--shadow-button-primary)] outline-accent outline-offset-2 focus-visible:outline-2"
      >
        <Icon name="sparkle" size={20} />
        Écrire
      </button>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-2 rounded-button border-[length:--border-width-ink] border-ink bg-surface-card px-4 py-2 font-body text-body font-bold text-ink outline-accent outline-offset-2 focus-visible:outline-2"
        >
          <Icon name="edit" size={20} />
          Modifier
        </button>
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="inline-flex items-center gap-2 rounded-button px-4 py-2 font-body text-body font-bold text-ink-soft outline-accent outline-offset-2 focus-visible:outline-2"
        >
          <Icon name="trash" size={20} />
          Archiver
        </button>
      </div>

      {confirmingDelete ? (
        <DeleteContactDialog
          contact={viewForDialog}
          onCancel={() => setConfirmingDelete(false)}
          onDeleted={() => {
            setConfirmingDelete(false);
            // Le contact n'existe plus : on quitte la fiche pour la galerie.
            router.replace("/reseau");
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

export default ContactDetailActions;
