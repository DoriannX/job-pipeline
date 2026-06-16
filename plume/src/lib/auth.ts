import "server-only";

// Auth.js v5 (NextAuth) — provider Google, stratégie de session `database`.
// L'adaptateur Drizzle persiste users/accounts/sessions/verification_tokens.
//
// Invariant : `auth()` résout un `user.id` OPAQUE (cuid2). L'email Google est un
// attribut de profil, JAMAIS la clé primaire (FR-29, NFR-2). Server-only : ce
// module touche des secrets (AUTH_GOOGLE_*) et le SDK serveur.

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { getServerDb } from "./db/client";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "./db/schema";

// Initialisation PARESSEUSE (forme `NextAuth(() => config)`) : la config — donc
// `getServerDb()` qui lit l'env — n'est évaluée qu'À LA REQUÊTE, jamais au
// chargement du module. Indispensable pour que `next build` (collecte des routes)
// ne tente pas de lire TURSO_DATABASE_URL alors qu'aucun secret n'est présent.
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: DrizzleAdapter(getServerDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [Google],
  // Stratégie database : la session vit en base, pas dans un JWT.
  session: { strategy: "database" },
  callbacks: {
    // Expose l'id opaque (cuid2) du user en session. Avec la stratégie database,
    // le 2ᵉ argument `user` est la ligne `users` (id = cuid2). On ne propage
    // JAMAIS l'email comme identifiant.
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
}));
