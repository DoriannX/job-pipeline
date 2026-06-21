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
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import type { Canal, MessageStatut, Source } from "../domain/enums";
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
    // Historique brut des échanges passés, nourrit la génération en continuité — FR-35.
    // DISTINCT de `notes` (qui reste un pense-bête perso) : ce champ est INJECTÉ au prompt
    // du Composeur (borné) pour rebondir sur le dernier point en suspens. Sanitizé à
    // l'écriture (parité seeds/corpus, AR-3), nullable (ADD COLUMN rétro-compatible).
    historique: text("historique"),
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
    // Archivage SOFT (suppression réversible) : epoch ms d'archivage ; NULL = actif.
    // Le soft-delete PRÉSERVE l'histoire (messages/relances) ; les lectures de la porte
    // filtrent `archived_at IS NULL`. Re-créer un contact à la même `dedup_key` le
    // RÉACTIVE (désarchive). ADD COLUMN rétro-compatible (nullable).
    archivedAt: integer("archived_at", { mode: "number" }),
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

// --- seed_voix : amorce optionnelle de la Voix de l'utilisateur (Epic 3, story 3.5) ---
// Table SCOPÉE par tenant : `user_id` borne chaque seed à son propriétaire (invariant
// n°1 / AR-2, AR-13). Un seed = un ancien message collé par l'utilisateur pour AMORCER
// sa voix ; le texte est nettoyé par `sanitize()` À L'IMPORT (point unique, AR-3) puis
// alimente immédiatement le few-shot de génération (stratégie bornée `selectFewShot`).
//
// Optionnel (FR-16) : sans seed, Plume écrit en ton NEUTRE — jamais d'échec. En 3.6, le
// corpus de Voix s'étendra aux Messages ENVOYÉS (FR-17) ; ici on ne lit QUE `seed_voix`.
//
// Conventions : colonnes SQL en snake_case ; PK `id` = cuid2 opaque ; `created_at` en
// epoch ms (number) injecté par l'horloge applicative (jamais Date.now() en dur). Sert
// l'ordre « du plus récent au plus ancien » (les N plus récents bornent le prompt).
export const seedVoix = sqliteTable("seed_voix", {
  // PK opaque cuid2 — généré côté app.
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  // Frontière tenant : NOT NULL, référence users (cascade quand le user disparaît).
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Texte de l'amorce — déjà sanitizé À L'IMPORT (jamais re-nettoyé à la lecture).
  texte: text("texte").notNull(),
  // Horodatage de création (epoch ms), posé via l'horloge injectée.
  createdAt: integer("created_at", { mode: "number" }),
});

// --- messages : un Message tracé du Contact (Epic 3, story 3.6) -------------
// Table SCOPÉE par tenant : `user_id` borne chaque Message à son propriétaire (invariant
// n°1 / AR-2, AR-13). Un Message = la sortie FIGÉE d'une rédaction (générée-éditée OU
// tapée main), marquée Envoyé. Le `texte` est la sortie sanitizée FINALE (l'éditée si
// retouchée à la main) ; `texte_genere` garde la sortie IA AVANT édition pour SM-1.
//
// MACHINE À ÉTATS (AR-5) : la story 3.6 n'écrit que `brouillon → envoye` (Marquer Envoyé,
// `envoye_at` posé). Les états `vu`/`repondu`/`ignore` et les timestamps que les Relances
// CONSOMMERONT (Epic 4 / story 3.8) sont conçus dès maintenant — l'union `MessageStatut`
// est complète, stockée en `text` NON traduit (libellé FR dans `lib/copy.ts`).
//
// Conventions : colonnes SQL en snake_case ; PK `id` = cuid2 opaque ; temps en epoch ms
// (number) injecté par l'horloge applicative (jamais Date.now() en dur).
export const messages = sqliteTable("messages", {
  // PK opaque cuid2 — généré côté app.
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  // Frontière tenant : NOT NULL, référence users (cascade quand le user disparaît).
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Contact destinataire — NOT NULL, référence contacts (cascade quand le contact disparaît).
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  // Canal utilisé (union métier `@/lib/domain/enums`) — LinkedIn / E-mail / WhatsApp / SMS.
  canal: text("canal").$type<Canal>().notNull(),
  // Texte FIGÉ = sortie sanitizée finale (l'éditée si retouchée à la main). NOT NULL (AR-5).
  texte: text("texte").notNull(),
  // Sortie IA AVANT édition (pour la distance d'édition SM-1) ; NULL si tapé main.
  texteGenere: text("texte_genere"),
  // Statut dans la machine à états — défaut 'brouillon' ; 3.6 le passe à 'envoye'.
  statut: text("statut").$type<MessageStatut>().notNull().default("brouillon"),
  // Le Message a-t-il été produit par l'IA ? (booléen SQLite = integer 0/1).
  genereParIa: integer("genere_par_ia", { mode: "boolean" })
    .notNull()
    .default(false),
  // Horodatage d'envoi (epoch ms) ; NULL tant qu'au statut 'brouillon'.
  envoyeAt: integer("envoye_at", { mode: "number" }),
  // Horodatage de création (epoch ms), posé via l'horloge injectée.
  createdAt: integer("created_at", { mode: "number" }),
  // Jeton de VERSION pour le VERROU OPTIMISTE après envoi (story 3.7, AR-12). Epoch ms,
  // posé à l'envoi (1er jeton = `envoye_at`) puis ré-écrit à CHAQUE édition via Modifier.
  // L'autorité serveur sur `Sent` n'autorise `editSent` que si le jeton fourni ÉGALE
  // celui en base (`WHERE updated_at = expectedUpdatedAt`) : une réédition concurrente
  // (jeton périmé) matche 0 ligne → CONFLIT (409), aucune écriture. Nullable : ADD COLUMN
  // rétro-compatible sur la table `messages` peuplée (jamais NOT NULL nu, cf. migration).
  updatedAt: integer("updated_at", { mode: "number" }),
  // Archivage SOFT du Message (copilote Phase 2 inc.4) : epoch ms d'archivage ; NULL = actif.
  // ASSUMPTION TRANCHÉE (SPEC inc.4, option a) : on GÉNÉRALISE le soft-delete des contacts aux
  // messages plutôt qu'un statut terminal `"annule"` — c'est l'option « la plus cohérente avec
  // la porte générique » (la porte `db.forUser` filtre déjà `archived_at IS NULL` pour TOUTE
  // table portant la colonne, donc un brouillon rewindé disparaît des lectures sans une ligne
  // de filtre en plus). L'inverse de `composeMessage` (rewind) pose ce champ — JAMAIS de DELETE.
  // ADD COLUMN nullable → rétro-compatible sur la table `messages` peuplée.
  archivedAt: integer("archived_at", { mode: "number" }),
});

// --- action_log : journal d'actions du copilote (Phase 2 inc.4) -------------
// Table SCOPÉE par tenant (colonne `user_id` → scoping AUTOMATIQUE par la porte db.forUser,
// comme toute table scopée). C'est le JOURNAL D'ACTIONS qui rend le rewind possible ET, par
// construction, un JOURNAL D'AUDIT durable (qui a fait quoi, quand, annulable) — l'actif
// réutilisé tel quel au passage SaaS.
//
// POURQUOI une table DÉDIÉE et PAS `generation_events` (Constraint SPEC) : `generation_events`
// est l'observabilité du MOAT (distance d'édition SM-1, tokens), écrite UNIQUEMENT à l'envoi et
// seulement pour une génération — mauvaise forme et mauvais déclencheur pour un journal transverse
// qui doit couvrir `createContact`/`importContacts` (sans envoi). On ne la pollue pas.
//
// ATOMICITÉ (Constraint SPEC, parité `markSent`+`generation_events`) : une entrée est écrite dans
// la MÊME transaction que la mutation qu'elle journalise (jamais un log async ratable). Une
// mutation persistée sans son entrée est un état INTERDIT.
//
// Le journal n'est JAMAIS purgé par le rewind : un rewind AJOUTE une entrée `op = "rewind"`, il
// n'efface pas les entrées annulées — le récit d'audit reste complet.

/**
 * État antérieur capturé par une entrée `action_log`, pour rendre l'inverse exact (CAP-3).
 *   - mutation `merged`/`reactivated` : les champs touchés AVANT la mutation (forme partielle
 *     d'un `ContactUpdate` : `entreprise`, `canalPrefere`, `handles`, `notes`, `dernierContactAt`,
 *     `archivedAt`…) — le rewind les RESTAURE (jamais un re-archivage aveugle qui détruirait du
 *     préexistant) ;
 *   - entrée `rewind` : la liste des `turnId` annulés (`{ turnIds }`) — entrée d'audit terminale.
 * `created` pur n'a pas de `prevState` (l'inverse est l'archivage).
 */
export type ActionLogPrevState = Record<string, unknown>;

export const actionLog = sqliteTable("action_log", {
  // PK opaque cuid2 — généré côté app.
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  // Frontière tenant : NOT NULL, référence users (cascade quand le user disparaît).
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Tour d'agent : un run `runAgentChat` = un `turnId` (clos par closure, jamais argument agent).
  // Groupe TOUTES les mutations d'un même run ; le rewind cible un tour par ce champ.
  turnId: text("turn_id").notNull(),
  // Tool ayant déclenché la mutation (`createContact`, `composeMessage`, `importContacts`,
  // `seedContacts`) ; `"rewind"` pour l'entrée d'audit du rewind lui-même.
  toolName: text("tool_name").notNull(),
  // Type d'entité touchée : `contact` | `message` | `turn` (le dernier pour l'entrée `rewind`).
  entityType: text("entity_type")
    .$type<"contact" | "message" | "turn">()
    .notNull(),
  // Ligne touchée (id du contact/message ; pour `rewind`, l'id du tour ciblé).
  entityId: text("entity_id").notNull(),
  // Opération journalisée — DÉTERMINE l'inverse rejoué au rewind (voir action-inverse-map.md) :
  //   `created`    → re-archivage ; `merged`/`reactivated` → restauration de `prev_state` ;
  //   `archived`   → désarchivage (restaure l'actif via `prev_state = {archivedAt: null}`) ;
  //   `rewind`     → entrée d'audit terminale, non ré-inversable (pas de redo, cf. Non-goals).
  op: text("op")
    .$type<"created" | "merged" | "reactivated" | "archived" | "rewind">()
    .notNull(),
  // État antérieur capturé — REQUIS pour `merged`/`reactivated` (champs à restaurer), liste des
  // `turnId` annulés pour `rewind`, OMIS (NULL) pour `created` (l'inverse est l'archivage).
  prevState: text("prev_state", { mode: "json" }).$type<ActionLogPrevState>(),
  // Horodatage (epoch ms) posé via l'horloge injectée — porte l'ordre LIFO du rewind (rejeu des
  // inverses en ordre chronologique inverse). Jamais Date.now() en dur.
  createdAt: integer("created_at", { mode: "number" }),
});

// --- generation_events : observabilité du moat (SM-1, archi l.80-84) --------
// Table SCOPÉE par tenant. Un événement de génération est écrit TRANSACTIONNELLEMENT
// AVEC l'envoi (jamais un log async ratable, archi l.82) — uniquement quand une
// génération IA a eu lieu (un Message tapé main n'en produit pas). Il capture, dans le
// MÊME enregistrement, la qualité du moat (`edit_distance` = distance d'édition
// généré→envoyé, SM-1) ET le coût (`tokens_*`) — les deux faces de la même donnée.
//
// L'écart d'édition est IMPOSSIBLE à rétro-calculer s'il n'est pas gardé dès J1 : d'où
// la capture transactionnelle. Les champs versionnés (`prompt_version`, `model_id`,
// `sanitize_version`) rendent l'historique de génération reconstructible a posteriori.
export const generationEvents = sqliteTable("generation_events", {
  // PK opaque cuid2 — généré côté app.
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  // Frontière tenant : NOT NULL, référence users (cascade).
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Message produit par cette génération — référence messages (cascade).
  messageId: text("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  // Contact concerné (traçabilité ; redondant avec le message mais pratique à requêter).
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  // Texte GÉNÉRÉ (sortie IA sanitizée, avant édition éventuelle).
  generated: text("generated").notNull(),
  // Texte ENVOYÉ (sortie FIGÉE finale = `messages.texte`).
  sent: text("sent").notNull(),
  // Distance d'édition NORMALISÉE généré→envoyé ∈ [0,1] (métrique SM-1). REAL (fractionnaire).
  editDistance: real("edit_distance").notNull(),
  // Idée brute saisie par l'utilisateur (avant génération) — `raw_intent`.
  rawIntent: text("raw_intent").notNull(),
  // Version du prompt ayant servi (reconstructibilité du moat).
  promptVersion: integer("prompt_version", { mode: "number" }).notNull(),
  // Id EXACT du modèle Claude qui a produit le texte.
  modelId: text("model_id").notNull(),
  // Références (JSON) des exemples de voix injectés (ids seeds et/ou messages).
  voiceExamplesRef: text("voice_examples_ref"),
  // Version du nettoyage `sanitize()` appliqué.
  sanitizeVersion: integer("sanitize_version", { mode: "number" }).notNull(),
  // Tokens d'entrée (prompt facturé, hors cache) — coût + plafond free tier.
  tokensInput: integer("tokens_input", { mode: "number" }).notNull(),
  // Tokens de sortie (texte généré).
  tokensOutput: integer("tokens_output", { mode: "number" }).notNull(),
  // Horodatage de création (epoch ms), posé via l'horloge injectée.
  createdAt: integer("created_at", { mode: "number" }),
});
