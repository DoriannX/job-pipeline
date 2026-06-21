"use server";

// Server action de REWIND d'un tour d'agent (copilote Phase 2 inc.4, CAP-2).
//
// AFFORDANCE HUMAINE, jamais un tool d'agent (Constraint SPEC) : « l'humain seul annule », parité
// avec « l'humain seul envoie » (Sécu #4). Cette action n'importe NI le schéma Drizzle NI
// drizzle-orm : tout accès passe par la porte `forUser(userId)` (barrière n°1). `userId` est
// résolu via `auth()` ICI — sans session, on rejette (parité 401). La porte scopée vérifie par
// CONSTRUCTION que les `turnId` ciblés appartiennent au tenant courant (un tour d'un autre tenant
// est invisible → no-op). Erreurs DOUCES (jamais de stack/500 au client).

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { forUser } from "@/lib/db";

import { replayRewind, type RewindSummary } from "./rewind";

/** Résultat de l'action (ton DOUX en cas d'échec). */
export type RewindActionResult =
  | { ok: true; summary: RewindSummary }
  | { ok: false; error: string };

/**
 * Annule un tour d'agent (et ses tours postérieurs, LIFO) : rejoue les inverses journalisés via
 * les repositories scopés, sans jamais hard-delete, puis journalise le rewind (audit).
 *
 * SYNC : CAP-4 — on réutilise l'unique levier d'invalidation d'inc.2 (`revalidatePath` côté
 * serveur + `router.refresh()` côté client). AUCUN nouveau code de sync, aucun chemin par tour.
 */
export async function rewindTurnAction(
  turnId: string,
): Promise<RewindActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    // Sans session : pas de rewind anonyme (parité 401 de la route agent).
    return { ok: false, error: "Session requise." };
  }

  const id = typeof turnId === "string" ? turnId.trim() : "";
  if (!id) {
    return { ok: false, error: "Tour introuvable." };
  }

  try {
    const gate = await forUser(userId);
    // ATOMICITÉ du rewind (« rewind TRANSACTIONNEL ») : tous les inverses + l'entrée d'audit
    // `rewind` s'exécutent dans UNE transaction scopée — tout-ou-rien, jamais d'undo partiel
    // sans trace (parité avec l'écriture atomique du journal côté mutation, CAP-1). La porte est
    // scopée au tenant : `entriesToReverse` ne voit QUE le journal de cet utilisateur — un
    // `turnId` d'un autre tenant renvoie [] (no-op), jamais une fuite.
    const summary = await gate.transaction((tx) =>
      replayRewind(
        { actionLog: tx.actionLog, contacts: tx.contacts, messages: tx.messages },
        id,
      ),
    );

    // Sync héritée d'inc.2 : la galerie Réseau (server component) relit la vérité serveur.
    revalidatePath("/reseau");
    return { ok: true, summary };
  } catch {
    return { ok: false, error: "L'annulation a échoué. Réessaie dans un instant." };
  }
}
