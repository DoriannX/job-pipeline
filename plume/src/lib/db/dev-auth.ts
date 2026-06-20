import "server-only";

// CRÉATION DE SESSION POUR LE DÉVELOPPEMENT UNIQUEMENT — ZONE AUTORISÉE (src/lib/db/**).
//
// Le bypass d'auth dev (cf. src/lib/auth-dev.ts) a besoin d'INSÉRER un user + une session
// `database` sans passer par Google OAuth. Or ces tables (users/sessions) sont gérées par
// l'adaptateur Auth.js, hors de la porte scopée `forUser` (qui suppose un tenant DÉJÀ connu) :
// il y a un œuf-poule (pas de user → pas de tenant). On fait donc l'insert ICI, le SEUL endroit
// autorisé à toucher le schéma/Drizzle (AR-2), au lieu de violer la barrière depuis une feature.
//
// Aucune logique de cookie/garde ici : ce module ne fait QUE la mutation DB et rend le token.
// La garde « dev only » + la pose du cookie vivent dans src/lib/auth-dev.ts.

import { eq } from "drizzle-orm";

import { getServerDb } from "./client";
import { sessions, users } from "./schema";

/** Identité du faux utilisateur de dev (email réservé, jamais un vrai compte Google). */
const DEV_EMAIL = "dev@plume.local";
const DEV_NAME = "Dev Local";
/** Durée de vie de la session dev (alignée sur le défaut Auth.js : 30 jours). */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Session dev fraîchement créée : le token à poser en cookie + sa date d'expiration. */
export type DevSession = { sessionToken: string; expires: Date };

/**
 * (Ré)utilise l'utilisateur de dev et lui crée une VRAIE session `database`. Renvoie le
 * `sessionToken` (à poser dans le cookie Auth.js par l'appelant) et son expiration. Toute la
 * dangerosité de garde (« jamais en prod ») est À LA CHARGE de l'appelant — ce module suppose
 * l'autorisation déjà vérifiée.
 */
export async function createDevSession(makeToken: () => string): Promise<DevSession> {
  const db = getServerDb();

  let user = (
    await db.select().from(users).where(eq(users.email, DEV_EMAIL)).limit(1)
  )[0];
  if (!user) {
    // `createdAt` en epoch ms : pas d'horloge injectée sur ce chemin adaptateur (hors porte).
    const [created] = await db
      .insert(users)
      .values({ email: DEV_EMAIL, name: DEV_NAME, createdAt: Date.now() })
      .returning();
    user = created;
  }

  const sessionToken = makeToken();
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ sessionToken, userId: user!.id, expires });

  return { sessionToken, expires };
}
