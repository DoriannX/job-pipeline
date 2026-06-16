// Validation Zod 4 — frontière de la feature Contacts (story 2.1).
// Module PUR (zéro infra, zéro I/O) : importé par la server action pour valider
// l'entrée à la frontière, et par le formulaire client pour les libellés/règles.
// Les énumérations viennent de la zone neutre `@/lib/domain/enums` (source unique).

import { z } from "zod";

import { CANAUX } from "@/lib/domain/enums";

// Bornes douces : un nom non vide suffit (FR-2) ; les autres champs sont optionnels.
const NOM_MAX = 120;
const NOTES_MAX = 2000;
const HANDLE_MAX = 320;

/** Un handle optionnel : chaîne courte, trim, vide => absent. */
const handle = z
  .string()
  .trim()
  .max(HANDLE_MAX, "C'est un peu long.")
  .optional()
  .transform((v) => (v ? v : undefined));

/**
 * Schéma d'un Contact saisi à la main. Tolérant : on `trim`, on transforme les
 * chaînes vides en `undefined`, on borne les longueurs. Le seul invariant dur est
 * « nom requis ». Les messages sont en français, ton doux (jamais alarmiste).
 */
export const contactInputSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(1, "Donne au moins un nom à ce contact.")
    .max(NOM_MAX, "Ce nom est un peu long."),
  canalPrefere: z
    .enum(CANAUX)
    .optional()
    // Champ <select> : la valeur vide signifie « pas de canal choisi ».
    .or(z.literal("").transform(() => undefined)),
  handles: z
    .object({
      linkedin: handle,
      email: handle,
      phone: handle,
      whatsapp: handle,
    })
    .optional(),
  notes: z
    .string()
    .trim()
    .max(NOTES_MAX, "Ces notes sont un peu longues.")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type ContactInput = z.infer<typeof contactInputSchema>;

/**
 * Schéma d'une entrée d'AJOUT RAPIDE (story 2.2). Frontière de `quickAddAction` :
 * chaque ligne parsée doit avoir un nom non vide (FR-34) ; l'entreprise est
 * optionnelle. Même tolérance (trim, vide => undefined) et mêmes bornes douces.
 */
export const quickAddEntrySchema = z.object({
  nom: z
    .string()
    .trim()
    .min(1, "Donne au moins un nom à ce contact.")
    .max(NOM_MAX, "Ce nom est un peu long."),
  entreprise: z
    .string()
    .trim()
    .max(NOM_MAX, "Ce nom d'entreprise est un peu long.")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type QuickAddEntryInput = z.infer<typeof quickAddEntrySchema>;

/** Forme tolérante des coordonnées (toutes les clés optionnelles). */
type HandlesShape = {
  linkedin?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
};

/** Vrai si l'objet handles ne contient aucune coordonnée (=> stocker NULL). */
export function isHandlesEmpty(h: HandlesShape | null | undefined): boolean {
  if (!h) return true;
  return !h.linkedin && !h.email && !h.phone && !h.whatsapp;
}
