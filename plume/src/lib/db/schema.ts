// Schéma Drizzle — tables SEULES. Source de vérité du schéma libSQL/Turso.
// Aucune logique, aucun env, aucun I/O ici.
//
// Convention : colonnes SQL en snake_case ; PK `id` = texte cuid2 (id opaque).
// L'email Google est un attribut, JAMAIS la PK (FR-29, NFR-2).
//
// NB sur l'adaptateur Auth.js : `@auth/drizzle-adapter` accède aux colonnes par
// le NOM DE PROPRIÉTÉ Drizzle (ex. `usersTable.emailVerified`, `accountsTable.userId`).
// On garde donc les clés de propriété attendues par l'adaptateur (camelCase) tout
// en nommant les colonnes SQL en snake_case via le 1ᵉʳ argument de text()/integer().

import { createId } from "@paralleldrive/cuid2";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// --- users : colonnes adaptateur Auth.js + colonnes domaine Plume ---
export const users = sqliteTable("users", {
  // PK opaque cuid2 — généré côté app (jamais l'email).
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  // Colonnes adaptateur Auth.js (clés camelCase requises par l'adaptateur).
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("email_verified", { mode: "timestamp_ms" }),
  image: text("image"),
  // Colonnes domaine Plume — `timezone` présent dès J1 (AR-6).
  timezone: text("timezone").notNull().default("Europe/Paris"),
  voixTon: text("voix_ton").notNull().default("neutre"),
  // Horodatage de création en epoch ms ; `now` est injecté à l'écriture (jamais
  // Date.now() en dur). Pas de default SQL : la valeur vient du Clock applicatif.
  createdAt: integer("created_at", { mode: "number" }),
});

// --- accounts : table adaptateur standard @auth/drizzle-adapter (SQLite) ---
export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<string>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ],
);

// --- sessions : stratégie database (Auth.js) ---
export const sessions = sqliteTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

// --- verification_tokens : table adaptateur standard ---
export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (vt) => [
    primaryKey({
      columns: [vt.identifier, vt.token],
    }),
  ],
);
