"use server";

// Server action « Faire évoluer le statut d'un message » (Epic 3, story 3.8).
//
// RÈGLE DURE : cette action n'importe NI le schéma Drizzle NI drizzle-orm NI Zod. Tout
// accès aux données passe par la porte `forUser(userId)` de `@/lib/db` (barrière n°1) ;
// la VALIDATION de la transition (machine à états AR-5) vit dans le repository (`setStatus`).
// `userId` est résolu via `auth()` DANS l'action ; sans session, on rejette.
//
// UN TAP, SANS QUITTER LA FICHE (FR-19, UX-DR22) : le mini-sheet appelle cette action avec
// le statut CIBLE choisi. On valide la frontière (`isMessageStatut`), on délègue au
// repository (qui relit l'état courant + applique la machine à états), puis on revalide la
// fiche Contact — la pastille reflète le nouveau statut sans navigation.
//
// COUPLAGE RELANCE (Epic 4) : marquer `repondu`/`ignore` est le SIGNAL qui clôturera la
// Relance associée. Ici on se borne à écrire le statut (+ `updated_at`) via `setStatus` ;
// la consommation du signal (fermeture de la Relance) est hors périmètre 3.8.

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { forUser } from "@/lib/db";
import { isMessageStatut, type MessageStatut } from "@/lib/domain/enums";

/** Entrée plate de l'action (sérialisable, traversant la frontière client→serveur). */
export type SetMessageStatusInput = {
  /** Id du Message dont on fait évoluer le statut. */
  messageId: string;
  /** Statut CIBLE choisi dans le mini-sheet (vu / repondu / ignore au MVP). */
  statut: MessageStatut;
};

/**
 * Résultat de l'action (ton DOUX ; aucune navigation, la fiche reste affichée).
 *   • `ok` : transition appliquée, le NOUVEAU statut est renvoyé (la pastille le reflète) ;
 *   • `illegal` : transition refusée par la machine à états (message doux, rien écrit) ;
 *   • `error` : échec doux (statut invalide, message introuvable, erreur transitoire).
 */
export type SetMessageStatusResult =
  | { status: "ok"; statut: MessageStatut }
  | { status: "illegal"; error: string }
  | { status: "error"; error: string };

/**
 * Fait évoluer le statut d'un Message (mini-sheet, un tap).
 *
 * Pipeline : auth() → garde de frontière (`isMessageStatut`) → `forUser(userId).messages
 * .setStatus(...)` (relit l'état courant + valide la transition AR-5, scopé). Selon l'issue :
 *   • succès → revalide la fiche Contact et renvoie le nouveau statut ;
 *   • illégal → message doux (aucune écriture) ;
 *   • introuvable / erreur → message doux.
 */
export async function setMessageStatusAction(
  input: SetMessageStatusInput,
): Promise<SetMessageStatusResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { status: "error", error: "Session requise." };
  }

  // GARDE DE FRONTIÈRE : on n'accepte qu'un statut de l'union métier (AR-5). Une valeur
  // hors union (client trafiqué) est refusée AVANT tout accès aux données.
  if (!input.messageId || !isMessageStatut(input.statut)) {
    return { status: "error", error: "Statut inconnu." };
  }

  try {
    const db = await forUser(userId);
    const result = await db.messages.setStatus({
      id: input.messageId,
      statut: input.statut,
    });

    if (result.status === "ok") {
      // La timeline de la fiche Contact change (pastille de statut).
      revalidatePath(`/reseau/${result.message.contactId}`);
      return { status: "ok", statut: result.message.statut };
    }

    if (result.status === "illegal") {
      // Transition interdite par la machine à états : ton doux, aucune écriture.
      return {
        status: "illegal",
        error: "Ce changement de statut n'est pas possible.",
      };
    }

    // Introuvable (ou message d'un autre tenant, invisible) : échec doux.
    return { status: "error", error: "Ce message est introuvable." };
  } catch {
    // Échec doux : message lisible, la fiche reste affichée (aucun changement appliqué).
    return {
      status: "error",
      error: "Le changement de statut a échoué. Réessaie dans un instant.",
    };
  }
}
