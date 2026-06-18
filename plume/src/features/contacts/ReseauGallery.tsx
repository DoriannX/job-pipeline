"use client";

// Galerie Réseau (story 2.3) — réseau PEUPLÉ : avatars-blobs en 3 COLONNES, JAMAIS un
// tableau/CRM (UX-DR7). Chaque cellule = un blob recoloré par froideur + le nom (Fraunces)
// + un ColdTag texte (la couleur ne porte JAMAIS seule l'info — a11y). La carte est un
// lien vers la fiche `/reseau/[contactId]` (la fiche elle-même = story 2.4).
//
// Tri par froideur par DÉFAUT (les liens qui refroidissent en premier), bascule froideur↔nom,
// + recherche par nom (filtre live). La froideur est calculée SERVEUR (page.tsx) et arrive
// dans `contact.coldness` — non stockée, dérivée à la lecture.

import { useMemo, useState } from "react";
import Link from "next/link";

import { ColdTag } from "@/components/ui/ColdTag";
import { Icon } from "@/design/icons";
import { Plume } from "@/design/illustration/Plume";

import { buildGallery, type SortKey } from "./gallery";
import type { ContactView } from "./types";

interface ReseauGalleryProps {
  contacts: ContactView[];
  /** Nombre de collisions ambiguës en attente de revue (story 2.5). */
  pendingMerges: number;
  /** Ouvre le formulaire d'ajout (géré par l'orchestrateur ReseauClient). */
  onAdd: () => void;
  /** Ouvre l'ajout rapide multiple (story 2.2). */
  onQuickAdd: () => void;
  /** Ouvre l'import CSV LinkedIn (story 2.5). */
  onImport: () => void;
  /** Ouvre la file de revue des collisions à vérifier (story 2.5). */
  onReview: () => void;
  /** Ouvre l'édition d'un contact (capacité 2.1, accessible depuis la galerie). */
  onEdit: (contact: ContactView) => void;
  /** Déclenche la confirmation de suppression d'un contact (capacité 2.1). */
  onDelete: (contact: ContactView) => void;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: "coldness", label: "Froideur" },
  { key: "name", label: "Nom" },
];

export function ReseauGallery({
  contacts,
  pendingMerges,
  onAdd,
  onQuickAdd,
  onImport,
  onReview,
  onEdit,
  onDelete,
}: ReseauGalleryProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("coldness");

  // Tri + filtre PURS (logique testable extraite dans ./gallery).
  const visibles = useMemo(
    () => buildGallery(contacts, { query, sort }),
    [contacts, query, sort],
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-margin-mobile py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-display-name font-semibold tracking-[-0.01em] text-ink">
          Ton réseau
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onImport}
            aria-label="Importer un CSV LinkedIn"
            className="rounded-button border-[length:--border-width-ink] border-ink bg-surface-card px-4 py-2 font-body text-body font-bold text-ink outline-accent outline-offset-2 focus-visible:outline-2"
          >
            Importer un CSV
          </button>
          <button
            type="button"
            onClick={onQuickAdd}
            aria-label="Ajout rapide de plusieurs contacts"
            className="rounded-button border-[length:--border-width-ink] border-ink bg-surface-card px-4 py-2 font-body text-body font-bold text-ink outline-accent outline-offset-2 focus-visible:outline-2"
          >
            Ajout rapide
          </button>
          <button
            type="button"
            onClick={onAdd}
            aria-label="Ajouter un contact"
            className="inline-flex items-center gap-2 rounded-button border-[length:--border-width-ink] border-ink bg-accent px-4 py-2 font-body text-body font-bold text-accent-on shadow-[var(--shadow-button-primary)] outline-accent outline-offset-2 focus-visible:outline-2"
          >
            <Icon name="plus" size={20} />
            Ajouter
          </button>
        </div>
      </header>

      {/* Rappel DOUX des collisions à vérifier (file de revue 1-par-1, UX-DR16) — ton
          neutre, jamais alarmiste ; visible seulement s'il reste des candidats. */}
      {pendingMerges > 0 ? (
        <button
          type="button"
          onClick={onReview}
          className="flex items-center justify-between gap-3 rounded-card border-[length:--border-width-ink] border-ink bg-accent-tint px-4 py-3 text-left font-body text-body text-accent-deep outline-accent outline-offset-2 focus-visible:outline-2"
        >
          <span>
            {pendingMerges} contact{pendingMerges > 1 ? "s" : ""} à vérifier après
            ton import.
          </span>
          <span aria-hidden="true" className="font-bold">
            Vérifier
          </span>
        </button>
      ) : null}

      {/* — Recherche par nom (FR-5) — label SR, icône loupe, focus net (flou = 0). */}
      <div className="flex flex-col gap-3">
        <label className="relative block">
          <span className="sr-only">Rechercher un contact par nom</span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-hint"
          >
            <Icon name="search" size={20} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un nom…"
            autoComplete="off"
            className="w-full rounded-button border-[length:--border-width-ink] border-ink bg-surface-card py-2 pl-10 pr-4 font-body text-body text-ink outline-accent outline-offset-2 placeholder:text-ink-hint focus-visible:outline-2"
          />
        </label>

        {/* — Tri (froideur / nom). TODO(Epic 3): ajouter tri par date du dernier
            Message + filtre par Statut du dernier Message (FR-5) quand les Messages
            existeront — PAS d'UI morte tant que la donnée n'existe pas. */}
        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">Trier la galerie</legend>
          <span
            aria-hidden="true"
            className="font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft"
          >
            Trier
          </span>
          {SORTS.map(({ key, label }) => {
            const active = sort === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                aria-pressed={active}
                className={`rounded-button border-[length:--border-width-ink] px-3 py-1 font-body text-label font-bold uppercase tracking-[0.12em] outline-accent outline-offset-2 focus-visible:outline-2 ${
                  active
                    ? "border-ink bg-accent text-accent-on"
                    : "border-line bg-surface-card text-ink-soft"
                }`}
              >
                {label}
              </button>
            );
          })}
        </fieldset>
      </div>

      {/* — GALERIE : 3 colonnes, gap 16px (∈ 12–18px), JAMAIS un tableau (UX-DR7). */}
      {visibles.length === 0 ? (
        <p
          role="status"
          className="py-8 text-center font-body text-body text-ink-soft"
        >
          Aucun contact ne correspond à « {query} ».
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-4">
          {visibles.map((contact) => (
            <li key={contact.id} className="flex flex-col items-center gap-1">
              <Link
                href={`/reseau/${contact.id}`}
                className="flex flex-col items-center gap-2 rounded-card px-1 py-2 text-center outline-accent outline-offset-2 focus-visible:outline-2"
              >
                <Plume name="blob" tint={contact.coldness} size={84} />
                <span className="line-clamp-2 font-display text-body font-semibold leading-tight tracking-[-0.01em] text-ink">
                  {contact.nom}
                </span>
                <ColdTag state={contact.coldness} />
              </Link>
              {/* Actions par contact (capacités 2.1, accessibles sans attendre la fiche
                  2.4) : ton DOUX (encre douce), jamais de rouge alarme. */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(contact)}
                  aria-label={`Modifier ${contact.nom}`}
                  className="rounded-md p-1 text-ink-soft outline-accent outline-offset-2 focus-visible:outline-2"
                >
                  <Icon name="edit" size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(contact)}
                  aria-label={`Archiver ${contact.nom}`}
                  className="rounded-md p-1 text-ink-soft outline-accent outline-offset-2 focus-visible:outline-2"
                >
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ReseauGallery;
