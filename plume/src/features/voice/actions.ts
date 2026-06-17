"use server";

// Server actions de la VOIX (seed optionnel, story 3.5).
//
// RÈGLE DURE : ces actions n'importent JAMAIS le schéma Drizzle ni drizzle-orm. Tout
// accès aux données passe par la porte `forUser(userId)` de `@/lib/db` (barrière n°1).
// `userId` est résolu via `auth()` DANS CHAQUE action ; sans session, on rejette.
//
// Le seed est OPTIONNEL (FR-16) : sans seed, Plume écrit en ton NEUTRE — jamais d'échec.
// À l'import, le texte passe par `sanitize()` (POINT UNIQUE de nettoyage, AR-3) via la
// fonction pure `prepareSeedText` ; un seed vide après nettoyage est refusé en douceur.
//
// FRONTIÈRE 3.6 : la gestion du seed vit au MVP dans Réglages (l'onboarding 5.5 viendra
// plus tard). Le corpus de Voix s'étendra aux Messages ENVOYÉS (FR-17) en 3.6 — ici on ne
// gère QUE `seed_voix`.

import { revalidatePath } from "next/cache";

import { forUser } from "@/lib/db";
import { auth } from "@/lib/auth";

import { prepareSeedText } from "./seed-text";

const REGLAGES_PATH = "/reglages";

/** Résout l'id du tenant courant ; lève si pas de session. */
async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Session requise.");
  }
  return userId;
}

/** Vue plate d'un seed de voix, projetée pour le client (sérialisable). */
export type VoiceSeedView = {
  id: string;
  texte: string;
  createdAt: number | null;
};

/** État renvoyé par l'ajout d'un seed (pour `useActionState`). */
export type AddVoiceSeedState = {
  ok: boolean;
  /** Message d'erreur global, ton DOUX (jamais rouge alarme). */
  error?: string;
};

/**
 * Ajoute un seed de voix (AC-1). Pipeline : auth() → `sanitize()` à l'import (via
 * `prepareSeedText`) → rejet doux si vide après nettoyage → `seedVoix.create(...)` via
 * la porte scopée (qui impose `user_id`). Revalide la page Réglages.
 *
 * Signature `useActionState` : `(prevState, formData) => Promise<AddVoiceSeedState>`.
 */
export async function addVoiceSeedAction(
  _prev: AddVoiceSeedState,
  formData: FormData,
): Promise<AddVoiceSeedState> {
  const userId = await requireUserId();

  const raw = String(formData.get("texte") ?? "");
  const prepared = prepareSeedText(raw);
  if (!prepared.ok) {
    // Ton doux : un collage vide (ou que des invisibles/emojis) n'est pas une erreur.
    return { ok: false, error: "Colle un message pour amorcer ta voix." };
  }

  const db = await forUser(userId);
  await db.seedVoix.create(prepared.texte);

  revalidatePath(REGLAGES_PATH);
  return { ok: true };
}

/**
 * Liste les seeds de voix du tenant, ordonnés du plus récent au plus ancien (la porte
 * `seedVoix.list()` garantit le tri). Projection PLATE, sérialisable (pas de fuite schéma).
 */
export async function listVoiceSeedsAction(): Promise<VoiceSeedView[]> {
  const userId = await requireUserId();
  const db = await forUser(userId);
  const rows = await db.seedVoix.list();
  return rows.map((s) => ({
    id: s.id,
    texte: s.texte,
    createdAt: s.createdAt ?? null,
  }));
}

/**
 * Supprime UN seed de voix (borné au tenant). Un id d'autrui (ou inexistant) ne supprime
 * rien : la porte ne renvoie aucune ligne. Revalide la page Réglages.
 */
export async function removeVoiceSeedAction(id: string): Promise<void> {
  const userId = await requireUserId();
  if (!id) return;

  const db = await forUser(userId);
  await db.seedVoix.remove(id);

  revalidatePath(REGLAGES_PATH);
}
