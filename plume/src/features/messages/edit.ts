"use server";

// Server action « Modifier un message envoyé » (Epic 3, story 3.7).
//
// RÈGLE DURE : cette action n'importe NI le schéma Drizzle NI drizzle-orm. Tout accès aux
// données passe par la porte `forUser(userId)` de `@/lib/db` (barrière n°1) ; l'édition
// avec VERROU OPTIMISTE (autorité serveur sur `Sent`, AR-12) vit dans le repository.
// `userId` est résolu via `auth()` DANS l'action ; sans session, on rejette.
//
// Un message envoyé est FIGÉ : on ne le rouvre QUE via Modifier (FR-20). Le texte édité
// repasse par `sanitize()` — le POINT UNIQUE de nettoyage des « Tells » d'IA (AR-3) : un
// message édité reste « zéro Tell ». L'édition NE TOUCHE JAMAIS `generation_events`
// (historique du moat intact, AR-12) ni le `statut` (reste 'envoye').
//
// CONCURRENCE : le client porte le jeton `expectedUpdatedAt` (le `updated_at` courant lu
// sur la fiche). Si quelqu'un a édité entre-temps (jeton périmé), l'autorité serveur
// rejette l'écriture → CONFLIT (sémantique 409) : on n'écrase RIEN, on demande de recharger.

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { forUser } from "@/lib/db";
import { sanitize } from "@/lib/copy";

/** Entrée plate de l'action (sérialisable, traversant la frontière client→serveur). */
export type EditSentMessageInput = {
  /** Id du Message envoyé à rouvrir. */
  messageId: string;
  /** Nouveau texte saisi dans le textarea inline (sanitizé ici, AR-3). */
  texte: string;
  /** Jeton de version optimiste : le `updated_at` courant porté depuis la fiche. */
  expectedUpdatedAt: number;
};

/**
 * Résultat de l'action (ton DOUX ; le champ est préservé côté client en cas d'échec).
 *   • `ok` : édition appliquée, le NOUVEAU jeton `updatedAt` est renvoyé (re-arme la carte) ;
 *   • `conflict` : sémantique 409 — « modifié ailleurs, recharge » (rien n'a été écrasé) ;
 *   • `error` : échec doux (texte vide, message introuvable, erreur transitoire).
 */
export type EditSentMessageResult =
  | { status: "ok"; updatedAt: number }
  | { status: "conflict"; error: string }
  | { status: "error"; error: string };

/**
 * Édite un Message au statut 'envoyé' (rouvert via Modifier).
 *
 * Pipeline : auth() → garde douce (texte présent) → `sanitize()` (point unique, AR-3) →
 * `forUser(userId).messages.editSent(...)` (verrou optimiste scopé). Selon l'issue :
 *   • succès → revalide la fiche Contact et renvoie le nouveau jeton ;
 *   • conflit → message doux 409 (aucune écriture, aucune saisie perdue côté client) ;
 *   • échec → message doux.
 */
export async function editSentMessageAction(
  input: EditSentMessageInput,
): Promise<EditSentMessageResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { status: "error", error: "Session requise." };
  }

  // Nettoyage au POINT UNIQUE (AR-3) : un message édité reste « zéro Tell ».
  const texte = sanitize(input.texte ?? "");
  if (!input.messageId || texte.length === 0) {
    // Rien à enregistrer : ton neutre, le champ reste éditable côté client.
    return { status: "error", error: "Écris un message avant d'enregistrer." };
  }

  try {
    const db = await forUser(userId);
    const result = await db.messages.editSent({
      id: input.messageId,
      texte,
      expectedUpdatedAt: input.expectedUpdatedAt,
    });

    if (result.status === "ok") {
      // La timeline de la fiche Contact change (texte mis à jour).
      revalidatePath(`/reseau/${result.message.contactId}`);
      return { status: "ok", updatedAt: result.message.updatedAt ?? 0 };
    }

    if (result.status === "conflict") {
      // 409 : édité ailleurs / jeton périmé. On n'écrase rien, on invite à recharger.
      return {
        status: "conflict",
        error: "Ce message a été modifié ailleurs. Recharge la fiche.",
      };
    }

    // Introuvable (ou message d'un autre tenant, invisible) : échec doux.
    return { status: "error", error: "Ce message est introuvable." };
  } catch {
    // Échec doux : message lisible, champ préservé côté client (aucune saisie perdue).
    return {
      status: "error",
      error: "L'enregistrement a échoué. Réessaie dans un instant.",
    };
  }
}
