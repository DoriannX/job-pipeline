# Story 1.1 — Initialiser le starter & l'outillage

- **Epic :** 1 — Socle, identité & design-system
- **Statut :** review (dev terminé, suite verte) → pause eyeball avant merge (1ʳᵉ story du run)
- **Branche :** `claude/kind-hypatia-oaxgri` (contrainte harness ; base = `origin/main`)
- **App :** sous-dossier `plume/`

## User story

As a fondateur-développeur,
I want un projet Next.js 16 scaffoldé avec la stack figée et une CI verte,
So that toute story suivante démarre sur un socle conforme à l'architecture.

## Acceptance Criteria → preuve

1. **Scaffold + dev** — `create-next-app` (TS, Tailwind v4, App Router, src-dir, ESLint, alias `@/*`, pnpm). → `pnpm build` ✅ (page par défaut prerendue `/`).
2. **Stack figée + tooling strict** — ajout de `drizzle-orm`, `@libsql/client`, `drizzle-kit`, `next-auth@beta`, `@auth/drizzle-adapter`, `serwist`, `@serwist/next`, `@anthropic-ai/sdk`, `zod` (+ `vitest`). → `pnpm install --frozen-lockfile` ✅, `pnpm typecheck` ✅, `pnpm lint` ✅ (strict). Arbo par feature conforme AR-17 : `src/features/{contacts,composer,messages,today,relances,voice,settings}`, `src/lib/{db,domain,offline}`, `src/design/`, `src/components/ui/`, `src/types/`.
3. **CI verte + secrets** — `.github/workflows/ci.yml` (scopé `plume/`) : install → lint → typecheck → test → `drizzle-kit check` → `next build` (garde l'AC #1 en CI, suite à la revue). `.env.example` liste `TURSO_*`, `AUTH_GOOGLE_*`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`, `VAPID_*`, `CRON_SECRET`. `.env.local` gitignored (`.env*` + exception `!.env.example`). Aucun secret committé.

## Décisions / périmètre

- **3 barrières ESLint** posées dès J1 (`eslint.config.mjs`, zone client `app/features/components/design`) : Drizzle nu interdit hors `lib/db`, `@anthropic-ai/sdk` server-only, `server-only`/`*.server` jamais côté client. Durcissement complet (`db.forUser`, `.server.ts`) = story 1.3.
- **`schema.ts` volontairement vide** (`export {}`) : la table `users` + migrations réelles = story 1.3. `drizzle-kit generate` a posé `drizzle/meta/_journal.json` → `drizzle-kit check` ✅ hors-ligne.
- **Serwist** : dépendance présente, wiring `next.config`/`sw.ts` reporté à l'Epic 5 (PWA) — `next.config.ts` gardé minimal (AGENTS.md Next 16 : ne pas introduire d'API non maîtrisée).

## Hors périmètre (stories suivantes)

Design-system/tokens (1.2), Auth Google + `db.forUser` + test cross-tenant + 3 barrières durcies (1.3), coquille 3 onglets (1.4).
