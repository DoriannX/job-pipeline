"use client";

// Orchestrateur CLIENT de l'onglet Réseau (stories 2.1 → 2.3).
// Pilote l'enchaînement des moments sans quitter la page : galerie ↔ formulaire
// (ajout / édition) ↔ confirmation de suppression. Le réseau PEUPLÉ s'affiche en
// galerie triée par froideur + recherche (story 2.3, via ReseauGallery) ; le réseau
// VIDE garde l'état d'amorçage de 2.1 (EmptyNetwork).
//
// Les données arrivent du serveur (page.tsx via db.forUser, froideur déjà dérivée) ;
// après chaque mutation, la server action a déjà `revalidatePath('/reseau')` — on
// déclenche `router.refresh()` pour re-rendre la page serveur avec la liste à jour.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createContactAction, updateContactAction } from "./actions";
import {
  listMergeCandidatesAction,
  type MergeCandidateView,
} from "./import-actions";
import { ContactForm, type ContactFormDefaults } from "./ContactForm";
import { DeleteContactDialog } from "./DeleteContactDialog";
import { EmptyNetwork } from "./EmptyNetwork";
import { ImportCsvForm } from "./ImportCsvForm";
import { MergeReviewDeck } from "./MergeReviewDeck";
import { QuickAddForm } from "./QuickAddForm";
import { ReseauGallery } from "./ReseauGallery";
import type { ContactView } from "./types";

type Mode =
  | { kind: "list" }
  | { kind: "add" }
  | { kind: "quickAdd" }
  | { kind: "import" }
  | { kind: "review" }
  | { kind: "edit"; contact: ContactView };

interface ReseauClientProps {
  contacts: ContactView[];
  /** Nombre de collisions ambiguës en attente de revue (carte d'alerte douce). */
  pendingMerges: number;
}

export function ReseauClient({ contacts, pendingMerges }: ReseauClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [toDelete, setToDelete] = useState<ContactView | null>(null);

  const backToList = () => setMode({ kind: "list" });
  const afterMutation = () => {
    setMode({ kind: "list" });
    router.refresh();
  };

  // — File de revue : on charge les candidats à la demande (entrée en mode review). —
  // L'effet ne s'abonne QUE quand on est en mode review ; le reset se fait au cleanup
  // (sortie du mode), pas dans le corps de l'effet (évite un setState synchrone).
  const inReview = mode.kind === "review";
  const [candidates, setCandidates] = useState<MergeCandidateView[] | null>(null);
  useEffect(() => {
    if (!inReview) return;
    let active = true;
    void listMergeCandidatesAction().then((list) => {
      if (active) setCandidates(list);
    });
    return () => {
      active = false;
      setCandidates(null);
    };
  }, [inReview]);

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

  // — AJOUT RAPIDE multiple (story 2.2) — on reste sur l'écran après succès pour
  //   laisser lire le compte-rendu ; on rafraîchit juste la liste serveur.
  if (mode.kind === "quickAdd") {
    return (
      <FormShell title="Ajout rapide">
        <QuickAddForm onCancel={backToList} onSuccess={() => router.refresh()} />
      </FormShell>
    );
  }

  // — IMPORT CSV LinkedIn (story 2.5) — non bloquant : on reste navigable, le bilan
  //   s'affiche ici quand l'import (post-réponse) a terminé. —
  if (mode.kind === "import") {
    return (
      <FormShell title="Importer un CSV">
        <ImportCsvForm
          onCancel={() => {
            backToList();
            router.refresh();
          }}
          onReview={() => setMode({ kind: "review" })}
        />
      </FormShell>
    );
  }

  // — FILE DE REVUE des collisions ambiguës (1-par-1) —
  if (mode.kind === "review") {
    return (
      <FormShell title="À vérifier">
        {candidates === null ? (
          <p
            role="status"
            className="font-body text-body text-ink-soft"
          >
            Un instant…
          </p>
        ) : (
          <MergeReviewDeck
            candidates={candidates}
            onClose={() => {
              backToList();
              router.refresh();
            }}
            onResolved={() => router.refresh()}
          />
        )}
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

  // — Réseau VIDE : état d'amorçage propriétaire (inchangé depuis 2.1) —
  //   On y ajoute l'entrée d'import CSV (backfill possible dès le premier instant).
  if (contacts.length === 0) {
    return (
      <EmptyNetwork
        onAddFirst={() => setMode({ kind: "add" })}
        onImport={() => setMode({ kind: "import" })}
      />
    );
  }

  // — Réseau PEUPLÉ : galerie triée par froideur + recherche (story 2.3) —
  // L'édition et la suppression (capacités 2.1) restent accessibles DEPUIS la galerie
  // (actions par contact) ; la fiche 2.4 les reprendra ensuite. Le dialogue de
  // suppression se monte à la demande quand `toDelete` est posé.
  return (
    <>
      <ReseauGallery
        contacts={contacts}
        pendingMerges={pendingMerges}
        onAdd={() => setMode({ kind: "add" })}
        onQuickAdd={() => setMode({ kind: "quickAdd" })}
        onImport={() => setMode({ kind: "import" })}
        onReview={() => setMode({ kind: "review" })}
        onEdit={(contact) => setMode({ kind: "edit", contact })}
        onDelete={(contact) => setToDelete(contact)}
      />

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
    </>
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
