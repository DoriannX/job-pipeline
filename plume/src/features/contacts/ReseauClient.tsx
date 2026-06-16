"use client";

// Orchestrateur CLIENT de l'onglet Réseau (story 2.1).
// Pilote l'enchaînement des moments sans quitter la page : liste sobre ↔ formulaire
// (ajout / édition) ↔ confirmation de suppression. La galerie triée par froideur +
// la recherche = story 2.3 (hors périmètre ici).
//
// Les données arrivent du serveur (page.tsx via db.forUser) ; après chaque mutation,
// la server action a déjà `revalidatePath('/reseau')` — on déclenche `router.refresh()`
// pour re-rendre la page serveur avec la liste à jour.

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/design/icons";

import { createContactAction, updateContactAction } from "./actions";
import { ContactCard } from "./ContactCard";
import { ContactForm, type ContactFormDefaults } from "./ContactForm";
import { DeleteContactDialog } from "./DeleteContactDialog";
import { EmptyNetwork } from "./EmptyNetwork";
import type { ContactView } from "./types";

type Mode =
  | { kind: "list" }
  | { kind: "add" }
  | { kind: "edit"; contact: ContactView };

interface ReseauClientProps {
  contacts: ContactView[];
}

export function ReseauClient({ contacts }: ReseauClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [toDelete, setToDelete] = useState<ContactView | null>(null);

  const backToList = () => setMode({ kind: "list" });
  const afterMutation = () => {
    setMode({ kind: "list" });
    router.refresh();
  };

  // — Formulaire d'AJOUT —
  if (mode.kind === "add") {
    return (
      <FormShell title="Nouveau contact">
        <ContactForm
          action={createContactAction}
          submitLabel="Ajouter"
          onCancel={backToList}
          onSuccess={afterMutation}
        />
      </FormShell>
    );
  }

  // — Formulaire d'ÉDITION —
  if (mode.kind === "edit") {
    const defaults: ContactFormDefaults = {
      id: mode.contact.id,
      nom: mode.contact.nom,
      canalPrefere: mode.contact.canalPrefere,
      handles: mode.contact.handles,
      notes: mode.contact.notes,
    };
    return (
      <FormShell title="Modifier le contact">
        <ContactForm
          action={updateContactAction}
          submitLabel="Enregistrer"
          defaults={defaults}
          onCancel={backToList}
          onSuccess={afterMutation}
        />
      </FormShell>
    );
  }

  // — Réseau VIDE : état d'amorçage propriétaire —
  if (contacts.length === 0) {
    return <EmptyNetwork onAddFirst={() => setMode({ kind: "add" })} />;
  }

  // — Liste sobre des contacts —
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-margin-mobile py-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-display-name font-semibold tracking-[-0.01em] text-ink">
          Ton réseau
        </h1>
        <button
          type="button"
          onClick={() => setMode({ kind: "add" })}
          aria-label="Ajouter un contact"
          className="inline-flex items-center gap-2 rounded-button border-[length:--border-width-ink] border-ink bg-accent px-4 py-2 font-body text-body font-bold text-accent-on shadow-[var(--shadow-button-primary)] outline-accent outline-offset-2 focus-visible:outline-2"
        >
          <Icon name="plus" size={20} />
          Ajouter
        </button>
      </header>

      <ul className="flex flex-col gap-4">
        {contacts.map((contact) => (
          <ContactCard
            key={contact.id}
            contact={contact}
            onEdit={(c) => setMode({ kind: "edit", contact: c })}
            onDelete={(c) => setToDelete(c)}
          />
        ))}
      </ul>

      {toDelete ? (
        <DeleteContactDialog
          contact={toDelete}
          onCancel={() => setToDelete(null)}
          onDeleted={() => {
            setToDelete(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/** Cadre commun des écrans-formulaire (titre + zone scrollable). */
function FormShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-margin-mobile py-8">
      <h1 className="font-display text-display-name font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h1>
      {children}
    </div>
  );
}

export default ReseauClient;
