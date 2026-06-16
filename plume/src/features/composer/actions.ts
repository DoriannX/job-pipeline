"use server";

// Server action de CONTEXTE du Composeur (story 3.1).
//
// Le Composeur ancre AU-DESSUS du champ le contexte du Contact (nom + canal préféré,
// FR-13) — jamais un onglet. Cette donnée vit côté serveur (scopée au tenant) : le
// composeur la charge à l'ouverture via cette action.
//
// RÈGLE DURE : cette action n'importe NI le schéma Drizzle NI drizzle-orm. Tout accès
// passe par la porte `forUser(userId)` de `@/lib/db` (barrière n°1). `userId` est
// résolu via `auth()` DANS l'action. C'est un LECTEUR de contexte (pas une mutation) :
// sans session, on ne lève pas — on renvoie `null` (rien à afficher). On renvoie une
// vue PLATE, sérialisable (pas de fuite du schéma) — ou `null` si le contact est
// introuvable / appartient à un autre tenant (le `get` scopé ne distingue pas, et ne
// fuite rien).

import { forUser } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { Canal } from "@/lib/domain/enums";

/** Contexte plat du Contact ancré en tête du Composeur (sérialisable). */
export type ComposerContext = {
  id: string;
  nom: string;
  /** Canal préféré (pré-sélectionne le sélecteur de canal) ; null si non renseigné. */
  canalPrefere: Canal | null;
};

/**
 * Charge le contexte d'un Contact pour le Composeur. Retourne `null` si la session
 * manque ou si le contact est introuvable (id inexistant OU d'un autre tenant — la
 * porte scopée ne révèle pas la différence). Aucune autre donnée n'est exposée.
 */
export async function loadComposerContextAction(
  contactId: string,
): Promise<ComposerContext | null> {
  if (!contactId) return null;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const db = await forUser(userId);
  const contact = await db.contacts.get(contactId);
  if (!contact) return null;

  return {
    id: contact.id,
    nom: contact.nom,
    canalPrefere: contact.canalPrefere ?? null,
  };
}
