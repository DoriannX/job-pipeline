// Types CLIENT-SAFE de la feature Contacts. Aucune dépendance au schéma Drizzle
// (barrière n°1) : les composants client ('use client') s'appuient sur ces formes
// plates, dérivées de la ligne `contacts` mais sans tirer la couche données.

import type { ColdState } from "@/design/tokens";
import type { Canal } from "@/lib/domain/enums";

/** Clés des coordonnées par canal (JSON `handles`). */
export type ContactHandle = "linkedin" | "email" | "phone" | "whatsapp" | "discord";

/** Vue d'un Contact passée du serveur au client (sérialisable). */
export type ContactView = {
  id: string;
  nom: string;
  canalPrefere: Canal | null;
  handles: Partial<Record<ContactHandle, string>> | null;
  notes: string | null;
  /** Epoch ms ; null = jamais contacté. */
  dernierContactAt: number | null;
  /**
   * Froideur DÉRIVÉE à la lecture (story 2.3), calculée serveur via `coldness(
   * dernierContactAt, now)`. JAMAIS stockée : recalculée à chaque rendu. Portée par la
   * COULEUR de l'avatar + doublée par un ColdTag texte (a11y).
   */
  coldness: ColdState;
};
