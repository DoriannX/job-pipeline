"use server";

// BOOTSTRAP du copilote (Phase 3, CAP-2/5) — réhydratation du fil actif au montage du popup.
//
// AFFORDANCE SERVEUR scopée, jamais un canal client de confiance : `userId` est résolu via
// `auth()` ICI (sans session → fil vide, parité rejet doux). Cette action n'importe NI le schéma
// Drizzle NI drizzle-orm : tout accès passe par la porte `forUser(userId)` (barrière n°1). La
// porte scopée garantit par CONSTRUCTION qu'on ne lit que les fils du tenant courant (un fil
// d'autrui est invisible). Erreurs DOUCES (jamais de stack/500 au client).

import { auth } from "@/lib/auth";
import { forUser, MAX_CONTEXT_TURNS } from "@/lib/db";

/**
 * Un tour réhydraté pour le popup : le rôle, le TEXTE final, et — pour un tour `assistant` ayant
 * écrit — son `turnId` (réhydrate l'affordance « annuler ce tour », CAP-5). Les chips tool-use ne
 * sont JAMAIS réhydratées (progression éphémère, Non-goal).
 */
export type BootstrapTurn = {
  role: "user" | "assistant";
  content: string;
  /** LIEN rewind (CAP-5) : présent seulement sur un tour `assistant` ayant écrit. */
  turnId?: string;
};

/** Réponse du bootstrap : l'id du fil actif (ou `null`) + ses tours bornés au plus récent. */
export type BootstrapResult = {
  conversationId: string | null;
  turns: BootstrapTurn[];
};

/**
 * Renvoie le fil ACTIF du tenant (le plus récemment mis à jour, non archivé) rechargé depuis la
 * DB scopée, borné aux `MAX_CONTEXT_TURNS` tours les plus récents (parité contexte modèle). Aucun
 * fil → `{ conversationId: null, turns: [] }` (le 1er message créera un fil, création paresseuse).
 * Sans session → fil vide (jamais de lecture anonyme).
 */
export async function bootstrapCopiloteAction(): Promise<BootstrapResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { conversationId: null, turns: [] };
  }

  try {
    const gate = await forUser(userId);
    const active = await gate.conversations.findLatestActive();
    if (!active) {
      return { conversationId: null, turns: [] };
    }

    const rows = await gate.chatMessages.listForConversation(active.id, {
      limit: MAX_CONTEXT_TURNS,
    });
    const turns: BootstrapTurn[] = rows.map((m) => ({
      role: m.role,
      content: m.content,
      // CAP-5 : un tour `assistant` porteur d'un `turn_id` rouvre l'affordance de rewind.
      ...(m.turnId ? { turnId: m.turnId } : {}),
    }));

    return { conversationId: active.id, turns };
  } catch {
    // Erreur douce : un échec de réhydratation ne casse jamais l'ouverture du popup.
    return { conversationId: null, turns: [] };
  }
}
