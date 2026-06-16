# Story 1.3 — Connexion Google + porte de données scopée (invariant n°1)

- **Epic :** 1 — Socle, identité & design-system
- **Statut :** review (dev terminé, suite verte ; revue sécurité isolée en cours)
- **Branche :** `claude/kind-hypatia-oaxgri` (base = `origin/main`)
- **Dev :** sous-agent à contexte plein (brief ancré archi) ; vérif indépendante + revue isolée par l'orchestrateur.

## User story

As a utilisateur, I want me connecter via Google et que mes données soient isolées par mon
identité, So that personne d'autre n'y accède (architecture SaaS-ready dès J1).

## Acceptance Criteria → preuve

1. **Identité opaque** — Auth.js v5 + Google ; `auth()` résout un `user_id` **cuid2 opaque**
   (`users.id` = `$defaultFn(createId)`), email = attribut `unique` **jamais PK** (FR-29, NFR-2).
2. **Table `users` migrée** — colonnes adaptateur Auth.js + domaine (`timezone` NOT NULL default
   `Europe/Paris`, `voix_ton` default `neutre`, `created_at` epoch ms). Migration drizzle générée
   et committée ; `now` **injecté** (`Clock`), `Date.now()` confiné à `lib/domain/time.ts` (AR-6).
3. **Porte `db.forUser` = seul accès** — `lib/db/scoped.ts` : auto-scope par `user_id` en lecture
   ET écriture, **fail-closed** (lève si la table n'a pas de `user_id`), `where` appelant en
   `and(tenant, …)` (rétrécit, ne contourne pas), `insert` impose le tenant, `update` interdit le
   déplacement cross-tenant. 3 barrières ESLint durcies (porte unique, SDK Claude server-only,
   frontière `*.server`/`server-only`). `env.ts`/`auth.ts` = `server-only` ; `client.ts` = factory
   pure (zéro env au load) ; `index.ts` n'expose que `forUser`.
4. **Test cross-tenant VERT** — `tests/security/cross-tenant.test.ts` : 2 users A/B seedés, 4 cas
   (lecture isolée, `findFirst` borné, `update`/`delete` sans effet cross-tenant, `insert` impose
   `user_id`) sur le **vrai** gate. Harnais (`tests/db/harness.ts`) **paramétré pour être étendu à
   chaque table** des epics suivants.

**Vérif indépendante (orchestrateur) :** `typecheck` · `lint` · `test` **10/10** · `db:check` ·
`build` → tous verts. Route `/api/auth/[...nextauth]` dynamique.

## Écarts assumés (justifiés)

- **Init NextAuth paresseuse** (`NextAuth(() => config)`) : sinon `getServerDb()` s'exécute au
  module-load et `next build` échoue faute de `TURSO_DATABASE_URL`. Pattern Auth.js v5 standard.
- **Overrides ESLint étroits** pour `lib/auth.ts` (racine de composition : peut câbler l'adaptateur
  aux tables, mais `drizzle-orm` nu reste interdit) et `tests/db/**` (le harnais construit la db de
  test). Barrières pleines partout ailleurs.
- **`getServerDb()`** lit l'env via `require` différé pour garder `createDb` une factory pure.

## Dette tracée (revue sécurité — non bloquant)

- **`insert` écrit la clé de propriété `userId` en dur** (vs lecture qui localise la colonne par
  son nom SQL `user_id`). Fail-**closed** (une table hors-convention déclencherait un `NOT NULL`,
  pas une fuite) et garde-fou par la convention `userId`/`user_id`. À durcir (écrire via la colonne
  localisée) le jour où une table dévie de la convention.
- **`users.created_at` reste `null` en prod** : l'adaptateur Auth.js crée les users sans passer par
  `forUser`/`Clock`. Aucun AC ne l'utilise aujourd'hui ; à peupler via un hook adaptateur quand il
  servira.
- **Harnais cross-tenant** : n'exerce encore que `test_items` (scaffolding). DoD de chaque story
  suivante = brancher la vraie table (contacts, messages…) sur ces mêmes assertions.

## Hors périmètre

Coquille 3 onglets + redirections connecté/non-connecté (1.4) ; tables métier (`contacts` 2.1, etc.)
qui se brancheront sur la même porte + le même harnais cross-tenant.
