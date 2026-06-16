// Types CLIENT-SAFE de la feature Contacts. Aucune dépendance au schéma Drizzle
// (barrière n°1) : les composants client ('use client') s'appuient sur ces formes
// plates, dérivées de la ligne `contacts` mais sans tirer la couche données.

import type { Canal } from "@/lib/domain/enums";

/** Clés des coordonnées par canal (JSON `handles`). */
export type ContactHandle = "linkedin" | "email" | "phone" | "whatsapp";

/** Vue d'un Contact passée du serveur au client (sérialisable). */
export type ContactView = {
  id: string;
  nom: string;
  canalPrefere: Canal | null;
  handles: Partial<Record<ContactHandle, string>> | null;
  notes: string | null;
  /** Epoch ms ; null = jamais contacté. */
  dernierContactAt: number | null;
};
