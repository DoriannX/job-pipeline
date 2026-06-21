import "server-only";

// BYPASS D'AUTH POUR LE DÉVELOPPEMENT UNIQUEMENT (preview / localhost).
//
// Pourquoi : la connexion normale passe par Google OAuth (redirect vers accounts.google.com).
// Dans le pane de preview (iframe localhost-only) ce redirect est BLOQUÉ → impossible de se
// connecter, et toute l'app est derrière le login. Ce module crée une session SANS Google.
//
// SÉCURITÉ — TRIPLE GARDE, JAMAIS EN PRODUCTION :
//   1. `isDevAuthEnabled()` exige `NODE_ENV !== "production"` (faux dans tout build Vercel prod) ;
//   2. `devSignIn()` re-vérifie la garde et LÈVE si appelée hors dev (défense en profondeur) ;
//   3. la page de login ne REND le bouton dev que si `isDevAuthEnabled()` (rien à cliquer en prod).
// La stratégie de session reste `database` (cf. auth.ts) : `createDevSession` (zone db/ autorisée)
// insère une VRAIE ligne `sessions`, on pose ensuite le cookie Auth.js — `auth()` la résout comme
// une session normale. Aucune query DB nue ici : l'accès passe par la façade `@/lib/db` (AR-2).

import { createId } from "@paralleldrive/cuid2";
import { cookies } from "next/headers";

import { createDevSession } from "@/lib/db";

/**
 * Nom du cookie de session Auth.js v5 en HTTP local (pas de préfixe `__Secure-`, réservé au
 * HTTPS). C'est le MÊME cookie que `auth()` lit pour résoudre la session `database` : on y met
 * le `sessionToken` brut (la stratégie database stocke le token en clair, pas un JWT chiffré).
 */
const SESSION_COOKIE = "authjs.session-token";

/** Le bypass dev est-il autorisé ? Faux en production (build Vercel) → garde principale. */
export function isDevAuthEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Connecte le faux utilisateur de dev : crée une session `database` (via la façade db) et pose le
 * cookie Auth.js. Après appel, `auth()` renvoie une session valide. LÈVE si appelée hors dev
 * (garde n°2). Aucune dépendance à Google / OAuth.
 */
export async function devSignIn(): Promise<void> {
  if (!isDevAuthEnabled()) {
    throw new Error("Connexion dev désactivée hors développement.");
  }

  // Token opaque, long et non devinable (deux cuid2 concaténés).
  const { sessionToken, expires } = await createDevSession(
    () => `${createId()}${createId()}`,
  );

  // Pose le cookie qu'`auth()` lira (httpOnly, lax, non-secure pour http://localhost).
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
    secure: false,
  });
}
