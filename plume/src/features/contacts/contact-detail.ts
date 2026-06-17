// Logique PURE de la fiche Contact (story 2.4) : mise en forme des canaux + vue détail.
// Extraite des composants pour rester testable sans React. Aucune dépendance infra,
// aucun import de schéma/Drizzle (barrière n°1) — formes plates, sérialisables.
//
// PÉRIMÈTRE borné à l'Epic 2 : on dérive la liste des canaux RENSEIGNÉS (handles) d'un
// contact, le canal PRÉFÉRÉ mis en tête. La timeline des Messages (peuplée Epic 3)
// reste une coquille narrative côté composant — aucune donnée à mettre en forme ici.

import type { IconName } from "@/design/icons";
import type { ColdState } from "@/design/tokens";
import type { Canal, MessageStatut } from "@/lib/domain/enums";

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
  /** Messages de la timeline « Votre histoire », récent → ancien (peuplée Epic 3). */
  messages: MessageTimelineItem[];
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

// --- Timeline « Votre histoire » (Epic 3, story 3.6) -----------------------
// La fiche affiche les Messages ENVOYÉS dans la timeline narrative. Vue PLATE,
// sérialisable, dérivée serveur (page.tsx) — aucun schéma/Drizzle ici (barrière n°1).

/** Libellé FR de chaque canal (clé technique non traduite → mot lisible). */
const CANAL_LABEL: Record<Canal, string> = {
  linkedin: "LinkedIn",
  email: "E-mail",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

/** Icône maison de chaque canal (l'icône `sms` illustre le SMS). */
const CANAL_ICON: Record<Canal, IconName> = {
  linkedin: "linkedin",
  email: "email",
  whatsapp: "whatsapp",
  sms: "sms",
};

/** Libellé FR de chaque statut (la valeur stockée reste non traduite, clé stable AR-5). */
const STATUT_LABEL: Record<MessageStatut, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  vu: "Vu",
  repondu: "Répondu",
  ignore: "Sans réponse",
};

/**
 * Un Message de la timeline, prêt à afficher : date d'envoi, canal (icône + libellé),
 * statut (libellé FR) et texte FIGÉ. `accent` = mis en avant (langage mauve, AC 3.6).
 */
export type MessageTimelineItem = {
  id: string;
  canal: Canal;
  canalLabel: string;
  canalIcon: IconName;
  statut: MessageStatut;
  statutLabel: string;
  texte: string;
  /** Epoch ms de l'envoi (ou de création si non envoyé) ; null si inconnu. */
  at: number | null;
  /** Mise en avant visuelle (accent mauve) — vrai pour les Messages envoyés. */
  accent: boolean;
  /**
   * Jeton de version optimiste (story 3.7) : le `updated_at` courant du Message, porté
   * jusqu'au wrapper d'édition (Modifier) pour servir d'`expectedUpdatedAt`. `null` si
   * la colonne n'est pas encore peuplée (anciens messages d'avant la migration 0006).
   */
  updatedAt: number | null;
  /** Vrai si le Message est ÉDITABLE via Modifier (au statut 'envoye' avec un jeton). */
  editable: boolean;
};

/** Forme plate d'un Message reçue du serveur (sous-ensemble de la ligne `messages`). */
export type MessageTimelineInput = {
  id: string;
  canal: Canal;
  statut: MessageStatut;
  texte: string;
  envoyeAt: number | null;
  createdAt: number | null;
  /** Jeton de version optimiste (`messages.updated_at`) ; null si non peuplé. */
  updatedAt: number | null;
};

/**
 * Met en forme les Messages pour la timeline « Votre histoire ». L'ordre d'entrée est
 * conservé (le serveur le fournit déjà du plus récent au plus ancien). Un Message au
 * statut 'envoye' est marqué `accent` (mis en avant) ; les autres restent neutres.
 */
export function timelineItems(
  rows: readonly MessageTimelineInput[],
): MessageTimelineItem[] {
  return rows.map((m) => ({
    id: m.id,
    canal: m.canal,
    canalLabel: CANAL_LABEL[m.canal],
    canalIcon: CANAL_ICON[m.canal],
    statut: m.statut,
    statutLabel: STATUT_LABEL[m.statut],
    texte: m.texte,
    at: m.envoyeAt ?? m.createdAt ?? null,
    accent: m.statut === "envoye",
    updatedAt: m.updatedAt,
    // Un Message ENVOYÉ avec un jeton de version est rouvrable via Modifier (story 3.7).
    // Sans jeton (ancien message d'avant la migration), on ne propose pas l'édition
    // optimiste (aucun `expectedUpdatedAt` fiable) : il reste read-only, jamais cassé.
    editable: m.statut === "envoye" && m.updatedAt !== null,
  }));
}
