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
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import type { Canal, Source } from "../domain/enums";
import { SOURCE_DEFAUT } from "../domain/enums";

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

// --- contacts : réseau de l'utilisateur (Epic 2, story 2.1) ----------------
// Table SCOPÉE par tenant : la colonne `user_id` (convention de la porte db.forUser)
// borne chaque ligne à son propriétaire (invariant n°1 / AR-2, AR-13).
//
// Conventions : colonnes SQL en snake_case ; PK `id` = cuid2 opaque ; temps en
// epoch ms (number) injecté par l'horloge applicative (jamais Date.now() en dur).

/** Coordonnées d'un Contact, par canal. JSON sérialisé en colonne `handles`. */
export type ContactHandles = {
  linkedin?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
};

export const contacts = sqliteTable(
  "contacts",
  {
    // PK opaque cuid2 — généré côté app.
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    // Frontière tenant : NOT NULL, référence users (cascade quand le user disparaît).
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Nom — seul champ requis pour créer un Contact (FR-2).
    nom: text("nom").notNull(),
    // Entreprise — utilisée pour la dédup nom+entreprise (story 2.2), nullable.
    entreprise: text("entreprise"),
    // Canal préféré — union métier (`@/lib/domain/enums`), nullable tant que non choisi.
    canalPrefere: text("canal_prefere").$type<Canal>(),
    // Coordonnées par canal, sérialisées en JSON ({linkedin,email,phone,whatsapp}).
    handles: text("handles", { mode: "json" }).$type<ContactHandles>(),
    // Notes libres.
    notes: text("notes"),
    // Dernier contact, epoch ms ; NULL = jamais contacté (porte le Score de froideur, story 2.3).
    dernierContactAt: integer("dernier_contact_at", { mode: "number" }),
    // Provenance — 'manuel' par défaut (AR-9, AR-16).
    source: text("source").$type<Source>().notNull().default(SOURCE_DEFAUT),
    // Horodatage d'import (epoch ms) ; NULL pour une saisie manuelle.
    importedAt: integer("imported_at", { mode: "number" }),
    // Base légale de traitement (RGPD) ; NULL au MVP pour la saisie manuelle.
    legalBasis: text("legal_basis"),
    // Clé de dédup (story 2.2) : email normalisé sinon nom+entreprise normalisés
    // (calculée par `computeDedupKey`, zone neutre). NOT NULL — toujours dérivable.
    // DEFAULT '' transitoire : rend la migration rétro-compatible (SQLite refuse un
    // ADD NOT NULL nu sur une table peuplée) ; l'app pose TOUJOURS une vraie clé via
    // le repository, donc '' n'est jamais persisté pour une ligne créée par le code.
    dedupKey: text("dedup_key").notNull().default(""),
    // Horodatages de cycle de vie (epoch ms), posés via l'horloge injectée.
    createdAt: integer("created_at", { mode: "number" }),
    updatedAt: integer("updated_at", { mode: "number" }),
  },
  (table) => [
    // Unicité PAR TENANT : aucun doublon (AR-9) chez un même user, mais deux users
    // peuvent partager la même `dedup_key` sans collision (cross-tenant garanti).
    uniqueIndex("uq_contacts_user_dedup").on(table.userId, table.dedupKey),
  ],
);

// --- import_jobs : import CSV LinkedIn en backfill asynchrone (Epic 2, story 2.5) ---
// Table SCOPÉE par tenant : `user_id` borne chaque job à son propriétaire (AR-2, AR-13).
// Le job porte SON tenant dans sa ligne : c'est lui qui « voyage » avec le payload du
// traitement post-réponse (`after()`), la requête HTTP déclencheuse pouvant être finie.
//
// Statut : 'pending' à la création, 'done' une fois le bilan écrit, 'error' si le
// traitement a échoué. Les compteurs (total/created/merged/skipped) + `reasons` (JSON)
// composent l'`ImportReport` rendu en carte-bilan non bloquante dans Réseau (UX-DR16).

/** Une entrée du bilan d'import : la ligne fautive et la raison (ton neutre). */
export type ImportReason = {
  ligne: number;
  raison: string;
};

export const importJobs = sqliteTable("import_jobs", {
  // PK opaque cuid2 — généré côté app.
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  // Frontière tenant : NOT NULL, référence users (cascade quand le user disparaît).
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Cycle de vie du job : 'pending' | 'done' | 'error'.
  status: text("status").$type<"pending" | "done" | "error">().notNull(),
  // Nom du fichier importé (pour l'affichage du bilan), nullable.
  filename: text("filename"),
  // Compteurs du bilan (ImportReport). Posés à la fin du traitement.
  total: integer("total", { mode: "number" }).notNull().default(0),
  created: integer("created", { mode: "number" }).notNull().default(0),
  merged: integer("merged", { mode: "number" }).notNull().default(0),
  skipped: integer("skipped", { mode: "number" }).notNull().default(0),
  // Détail des lignes ignorées/à vérifier : JSON `[{ligne, raison}, …]`.
  reasons: text("reasons", { mode: "json" }).$type<ImportReason[]>(),
  // Horodatages (epoch ms), posés via l'horloge injectée (jamais Date.now() en dur).
  createdAt: integer("created_at", { mode: "number" }),
  finishedAt: integer("finished_at", { mode: "number" }),
});

// --- merge_candidates : file de revue des collisions ambiguës (story 2.5, UX-DR16) ---
// Table SCOPÉE par tenant. Une ligne CSV qui ENTRE EN COLLISION AMBIGUË avec un contact
// existant (même nom+entreprise, mais l'email diffère/absent d'un côté) n'est NI créée en
// double NI fusionnée à tort : on dépose un candidat 'pending' à résoudre 1-par-1
// (Fusionner / Garder séparés). Les données entrantes sont stockées telles que parsées.

export const mergeCandidates = sqliteTable("merge_candidates", {
  // PK opaque cuid2 — généré côté app.
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  // Frontière tenant : NOT NULL, référence users (cascade).
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Job d'import qui a produit ce candidat (traçabilité du bilan).
  importJobId: text("import_job_id").notNull(),
  // Contact existant en collision (celui que l'on POURRAIT enrichir si « Fusionner »).
  existingContactId: text("existing_contact_id").notNull(),
  // Données de la ligne ENTRANTE (telles que parsées du CSV).
  nom: text("nom").notNull(),
  entreprise: text("entreprise"),
  email: text("email"),
  // Coordonnées entrantes (JSON {linkedin,email,…}), comme pour `contacts.handles`.
  handles: text("handles", { mode: "json" }).$type<ContactHandles>(),
  // Statut de résolution : 'pending' | 'merged' | 'kept_separate'.
  status: text("status")
    .$type<"pending" | "merged" | "kept_separate">()
    .notNull()
    .default("pending"),
  // Horodatage de création (epoch ms), posé via l'horloge injectée.
  createdAt: integer("created_at", { mode: "number" }),
});
