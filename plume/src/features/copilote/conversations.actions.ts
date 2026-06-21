"use server";

// Server actions de GESTION DES FILS copilote (Phase 3-B, CAP-4) — liste, réouverture, renommage,
// archivage. Patron canonique = `rewind.actions.ts` : `"use server"`, `auth()` ICI (sans session →
// rejet DOUX, parité 401), accès via la porte `forUser(userId)` UNIQUEMENT (jamais drizzle/schéma
// direct — barrière n°1), erreurs DOUCES (jamais de stack/500 au client). La porte scopée garantit
// par CONSTRUCTION qu'on ne touche QUE ses propres fils (un fil d'autrui est invisible → no-op).
//
// FRONTIÈRE MOAT : le titre renommé ne passe PAS par `sanitize()` (c'est du transcript d'assistance,
// pas du corpus d'outreach). Réversibilité : archive = SOFT (`archived_at`), JAMAIS de hard-delete.

import { z } from "zod";

import { auth } from "@/lib/auth";
import { forUser, MAX_CONTEXT_TURNS, type ConversationSummary } from "@/lib/db";

import type { BootstrapResult } from "./bootstrap.actions";

/** Bornes anti-DoS à la frontière (parité `MAX_CONTENT`/`MAX_ID` de la route). */
const MAX_ID = 64;
const MAX_TITRE = 120;
const idSchema = z.string().trim().min(1).max(MAX_ID);
const titreSchema = z.string().trim().min(1).max(MAX_TITRE);

/** Résultat DOUX d'une action de mutation de fil. */
export type ConversationActionResult = { ok: boolean };

/**
 * Liste les fils ACTIFS du tenant (titre + récence, scopés à lui seul), du plus récent au plus
 * ancien. Sans session → liste vide (jamais de lecture anonyme). Erreur → liste vide (doux).
 */
export async function listConversationsAction(): Promise<ConversationSummary[]> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return [];
  try {
    const gate = await forUser(userId);
    return await gate.conversations.listActive();
  } catch {
    return [];
  }
}

/**
 * Renomme un fil du tenant. Zod borne `id`/`titre` ; le titre n'est PAS sanitizé (frontière moat).
 * Scopé → no-op silencieux si le fil n'appartient pas au tenant. Erreurs douces.
 */
export async function renameConversationAction(
  id: string,
  titre: string,
): Promise<ConversationActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false };

  const parsedId = idSchema.safeParse(id);
  const parsedTitre = titreSchema.safeParse(titre);
  if (!parsedId.success || !parsedTitre.success) return { ok: false };

  try {
    const gate = await forUser(userId);
    const ok = await gate.conversations.rename(parsedId.data, parsedTitre.data);
    return { ok };
  } catch {
    return { ok: false };
  }
}

/**
 * Archive un fil du tenant — SOFT (`archived_at`), jamais de hard-delete : il sort des lectures
 * mais reste en base. Scopé + idempotent. Erreurs douces.
 */
export async function archiveConversationAction(
  id: string,
): Promise<ConversationActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false };

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false };

  try {
    const gate = await forUser(userId);
    const ok = await gate.conversations.archive(parsedId.data);
    return { ok };
  } catch {
    return { ok: false };
  }
}

/**
 * Rouvre un fil : recharge son transcript borné (RÉUTILISE le chemin de lecture de 3-A —
 * `findById` pour l'appartenance + `listForConversation` borné, PAS de nouveau chemin). Renvoie la
 * même forme que le bootstrap (`{ conversationId, turns }`). Fil inconnu/d'autrui (findById → null)
 * ou sans session → `{ conversationId: null, turns: [] }` (jamais le fil d'autrui).
 */
export async function openConversationAction(
  id: string,
): Promise<BootstrapResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { conversationId: null, turns: [] };

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { conversationId: null, turns: [] };

  try {
    const gate = await forUser(userId);
    // APPARTENANCE : un fil d'un autre tenant (ou archivé) est invisible → null, jamais de fuite.
    const owned = await gate.conversations.findById(parsedId.data);
    if (!owned) return { conversationId: null, turns: [] };

    const rows = await gate.chatMessages.listForConversation(owned.id, {
      limit: MAX_CONTEXT_TURNS,
    });
    return {
      conversationId: owned.id,
      turns: rows.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.turnId ? { turnId: m.turnId } : {}),
      })),
    };
  } catch {
    return { conversationId: null, turns: [] };
  }
}
