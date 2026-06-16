// Logique PURE de la fiche Contact (story 2.4) : mise en forme des canaux + vue détail.
// Extraite des composants pour rester testable sans React. Aucune dépendance infra,
// aucun import de schéma/Drizzle (barrière n°1) — formes plates, sérialisables.
//
// PÉRIMÈTRE borné à l'Epic 2 : on dérive la liste des canaux RENSEIGNÉS (handles) d'un
// contact, le canal PRÉFÉRÉ mis en tête. La timeline des Messages (peuplée Epic 3)
// reste une coquille narrative côté composant — aucune donnée à mettre en forme ici.

import type { IconName } from "@/design/icons";
import type { ColdState } from "@/design/tokens";
import type { Canal } from "@/lib/domain/enums";

import type { ContactHandle } from "./types";

/**
 * Vue détail d'un Contact passée du serveur au composant fiche (sérialisable).
 * Superset de la galerie : on ajoute `entreprise` (affichée sous le nom). La froideur
 * est DÉRIVÉE serveur (cold-score, jamais stockée), comme pour la galerie.
 */
export type ContactDetailView = {
  id: string;
  nom: string;
  entreprise: string | null;
  canalPrefere: Canal | null;
  handles: Partial<Record<ContactHandle, string>> | null;
  notes: string | null;
  /** Epoch ms ; null = jamais contacté. */
  dernierContactAt: number | null;
  /** Froideur dérivée à la lecture (cold-score), portée par couleur + ColdTag texte. */
  coldness: ColdState;
};

/** Un canal renseigné, prêt à afficher : clé handle + icône maison + libellé FR + valeur. */
export type ChannelChip = {
  key: ContactHandle;
  icon: IconName;
  label: string;
  value: string;
  /** Vrai si ce canal correspond au canal préféré du contact (mis en avant). */
  preferred: boolean;
};

/** Libellé FR de chaque coordonnée (clé technique → mot lisible). */
const HANDLE_LABEL: Record<ContactHandle, string> = {
  linkedin: "LinkedIn",
  email: "E-mail",
  phone: "Téléphone",
  whatsapp: "WhatsApp",
};

/** Icône maison de chaque coordonnée (le canal SMS s'illustre par l'icône `sms`). */
const HANDLE_ICON: Record<ContactHandle, IconName> = {
  linkedin: "linkedin",
  email: "email",
  phone: "sms",
  whatsapp: "whatsapp",
};

// Le canal préféré est une valeur `Canal` (linkedin/email/whatsapp/sms) ; le handle
// correspondant porte parfois une autre clé (sms ⇄ téléphone). Ce mapping relie les deux.
const CANAL_TO_HANDLE: Record<Canal, ContactHandle> = {
  linkedin: "linkedin",
  email: "email",
  whatsapp: "whatsapp",
  sms: "phone",
};

/** Ordre d'affichage par défaut des canaux (avant remontée du préféré). */
const HANDLE_ORDER: ContactHandle[] = ["linkedin", "email", "phone", "whatsapp"];

/**
 * Liste ORDONNÉE des canaux RENSEIGNÉS d'un contact, prête à afficher.
 *   • on ne garde que les coordonnées non vides (trim) — pas de puce fantôme ;
 *   • le canal PRÉFÉRÉ (s'il est renseigné) est remonté en tête et marqué `preferred` ;
 *   • le reste suit l'ordre canonique (linkedin, e-mail, téléphone, whatsapp).
 */
export function channelChips(
  handles: Partial<Record<ContactHandle, string>> | null,
  canalPrefere: Canal | null,
): ChannelChip[] {
  if (!handles) return [];

  const preferredHandle = canalPrefere ? CANAL_TO_HANDLE[canalPrefere] : null;

  const present = HANDLE_ORDER.filter((key) => {
    const value = handles[key];
    return typeof value === "string" && value.trim().length > 0;
  });

  // Préféré d'abord (s'il fait partie des renseignés), puis le reste dans l'ordre canonique.
  const ordered = [
    ...present.filter((key) => key === preferredHandle),
    ...present.filter((key) => key !== preferredHandle),
  ];

  return ordered.map((key) => ({
    key,
    icon: HANDLE_ICON[key],
    label: HANDLE_LABEL[key],
    value: (handles[key] as string).trim(),
    preferred: key === preferredHandle,
  }));
}
