---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-06-16'
inputDocuments:
  - docs/planning-artifacts/prds/prd-job-pipeline-2026-06-15/prd.md
  - docs/planning-artifacts/prds/prd-job-pipeline-2026-06-15/addendum.md
  - docs/planning-artifacts/diagrams.md
  - docs/project-context.md
  - docs/planning-artifacts/ux-designs/ux-job-pipeline-2026-06-15/DESIGN.md
  - docs/planning-artifacts/ux-designs/ux-job-pipeline-2026-06-15/EXPERIENCE.md
  - docs/planning-artifacts/prfaq-job-pipeline-distillate.md
  - docs/brainstorming/brainstorming-session-2026-06-15.md
workflowType: 'architecture'
project_name: 'Plume (repo job-pipeline)'
user_name: 'Monsieur'
date: '2026-06-16'
---

# Architecture Decision Document — Plume

_Ce document se construit collaborativement, étape par étape. Les sections sont ajoutées au fil des décisions architecturales prises ensemble. Source amont : PRD + addendum + UX + project-context (`docs/planning-artifacts/`). En cas de conflit PRD↔UX, l'UX (plus récent) prime. Diagrammes (frontières server/client, machine à états Messages, séquence Composeur) : voir [`diagrams.md`](diagrams.md)._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (34 FRs, 7 features) :**
- Contacts/Réseau (FR-1..5, 34) : import CSV async + dédup, ajout manuel/rapide, fiche timeline, Score de froideur dérivé, tri.
- Composeur "ta voix" — le moat (FR-6..14) : champ unique source de vérité, Générer/Améliorer, canal-aware, few-shot en contexte, Liste noire des Tells, revue humaine, en flow, choix modèle. (FR-15 Mode sans-IA supprimé — #30 clos.)
- Apprentissage Voix (FR-16..17) : seed optionnel + corpus = messages envoyés (pas de fine-tuning).
- Messages/Statut (FR-18..21) : enregistrement, cycle de Statut, verrou read-only post-Envoyé, copier->Envoyé.
- File du jour (FR-22..24) : écran par défaut, file priorisée dérivée, action-first.
- Relances zéro-fuite (FR-25..27) : Next-action auto idempotente, push, compteur.
- PWA/Auth/Privacy (FR-28..33) : PWA installable, Google OAuth + scoping user_id, export, suppression, transparence API, onboarding < 2 min.

**Non-Functional Requirements :**
- Perf composeur : < 5 s avant le premier texte (few-shot en contexte) — traité comme contrat d'état UI (streaming), pas seule métrique serveur.
- Archi SaaS-ready : entités scopées par user_id dès J1, sans sur-ingénierie multi-tenant.
- Mobile-first strict ; privacy first-class ; coût maîtrisé (Haiku défaut) ; résilience (import partiel + composeur dégradé hors-ligne).

**Scale & Complexity :**
- Primary domain : full-stack PWA (Next.js + Turso/libSQL + API Claude côté serveur).
- Complexity level : moyenne. Composants archi : ~6-7. Exploitation mono-utilisateur, archi SaaS-ready.

### Invariants non-négociables (tout agent IA les relit avant de coder)

Principe : un agent IA n'implémente pas des adjectifs ("privacy", "résilience"), il implémente des contraintes vérifiables. Chaque concern transverse est donc posé comme invariant testable.

1. **Scoping data** — toute lecture/écriture transite par une couche d'accès scopée `user_id` ; aucune query nue (un `db.execute("SELECT ...")` sans scope = violation, pas un détail de style). Turso mono-base = pas de RLS, le scoping est 100% applicatif → filet de test transversal : 2 users, asserter zéro fuite cross-tenant sur chaque endpoint.
2. **Import async porte le user_id** — l'import CSV tourne en job background ; le `user_id` voyage dans le payload du job (la requête HTTP est finie). Follow-ups et File du jour (objets système, pas requête user) héritent du `user_id` de l'entité parente.
3. **`sanitize()` = contrat versionné, idempotent, ordonné, borné** — `sanitize(sanitize(x)) === sanitize(x)` (property-based test). Ordre des transformations figé (décider NFC avant/après strip : NFC peut recomposer un caractère que l'anti-emoji doit voir). Couverture Unicode explicite : em-dash U+2014 ET cousins (en-dash U+2013, U+2015, NBSP  , zero-width ​), anti-emoji = `\p{Extended_Pictographic}` + ZWJ/skin-tone/regional-indicators. Boucle sanitize→re-valide **plafonnée** (MAX_RETRIES ≈ 2) + comportement de dépassement défini (servir le meilleur candidat sanitizé). `sanitize_version` **stockée au passage Envoyé** (corpus few-shot homogène dans le temps). Table de vecteurs entrée→sortie comme spec exécutable.
4. **Idempotence = une primitive en base** — pour import / follow-up / compose-retry : contrainte d'unicité + `INSERT ... ON CONFLICT DO NOTHING`, jamais check-then-insert applicatif (fenêtre de course). Follow-up : `UNIQUE(message_id)` ; deux invocations concurrentes du scheduler → 1 ligne, erreur UNIQUE avalée proprement (pas un 500).
5. **Machine à états des messages explicite** — Statut **stocké** (enum canonique, source unique `domain/enums.ts`) = `brouillon → envoyé → vu → répondu | ignoré`. `généré` n'est **pas** un Statut stocké mais un état transitoire du Composeur (texte présent, pas encore envoyé), sous-état de `brouillon`. Une `Relance` (due) **dérive** d'un message `envoyé` non répondu — ce n'est pas un Statut du message. Transitions légales nommées. `body` **immuable applicativement** après Envoyé (SQLite ne l'interdit pas → règle archi). Lien explicite : figé ⇒ corpus de confiance. Le texte gelé = la sortie sanitizée finale (l'édité si l'user a retouché à la main), pas le brouillon.
6. **Temps dérivé, horloge injectée** — tout "Today" / échéance follow-up dérivé de `(now, user.timezone)` ; `now` est un **paramètre injecté**, jamais `Date.now()` en dur (sinon tests flaky). `timezone` = propriété de l'user dès J1 (hardcodé = dette au 1er multi-user).
7. **Claude = dépendance externe synchrone** sur le chemin critique du hero → budget tokens borné par compose, stratégie de sélection des exemples few-shot **nommée** (le prompt enfle avec le corpus → NFR <5s casse en silence à 200 messages), chemin de dégradation explicite : hors-ligne/IA indispo = Générer/Améliorer grisés + message doux, champ éditable et envoi manuel (FR-7) — un état de bouton, pas un mode (#30 clos).
8. **Modèle contact↔canal et clé(s) de dédup tranchés AVANT le schéma** — un contact a N canaux (email/LinkedIn/tel) ; "un contact = une ligne email" bloque le multi-canal. Dédup : clé(s) normalisées (casse/trim), dédup intra-fichier ET vs-DB, gestion des collisions de clé (A a un email, B même nom+entreprise sans email), `ImportReport` (n créés / fusionnés / ignorés + raisons). Définition de "answered" = **champ état manuel** (pas d'inbox connectée) — à modéliser, sinon FR fantôme.

### Décisions irréversibles quasi-gratuites maintenant (SaaS-readiness minimale)

Posture asymétrique (arbitrage analyste) : single-user ↔ SaaS n'est pas un choix binaire mais une discipline — invariants pas chers maintenant, systèmes coûteux différés jusqu'à validation de SM-1 (le moat). Classées par coût de réversion décroissant ; les premières coûtent ~0 aujourd'hui, énormément demain.

| Décision | Si mal prise | Quand l'acter |
|---|---|---|
| `user_id` dans chaque table | re-migration data + réécriture requêtes + audit fuites | Maintenant (coût ~0) |
| Clé d'identité **opaque** (jamais l'email Google en PK ; OAuth = attribut) | migrer la PK d'identité de tout le système | Maintenant |
| Provenance/base légale par contact (`source`, `imported_at`, `legal_basis`) | corpus de contacts orphelins in-prouvables au SaaS | Maintenant (colonnes, même vides) |
| Versioning `prompt_version` + `model_id` dans l'événement de génération | historique moat ininterprétable, non-reconstructible | À la 1ère génération |
| Structure de prompt cachable + compteur tokens/user | réécriture du Composeur + marge pilotée à l'aveugle | Avant d'écrire le Composeur |
| Effacement cross-user d'un contact tiers | dépend de la tenancy (cf. TODO) | Décision de tenancy |
| Tenancy mono-base vs DB-per-user | migration data, mais bornée si `user_id` présent | Différable si `user_id` présent |

### Économie unitaire = contrainte d'architecture (pas note de bas de page)

- Few-shot in-context = on repaie le style à chaque appel. **Prompt caching = décision d'archi** : préfixe stable (système + exemples voix) cachable, suffixe contact-specific en fin. À structurer avant d'écrire le Composeur.
- Compteur de tokens **par user** (borne la marge SaaS, plafond du free tier).
- SM-1 (qualité moat) et coût = la même donnée sous deux angles : capturer les deux dans le même événement de génération.

### Observabilité du moat (SM-1)

SM-1 = distance d'édition médiane généré→envoyé < 20% sur 20-30 messages réels. N minuscule → instrumentation **100% fiable, pas best-effort**. Événement de génération écrit **transactionnellement avec l'envoi** (pas un log async ratable) :
`(generated, sent, edit_distance, contact_id, raw_intent, prompt_version, model_id, voice_examples_ref, sanitize_version, tokens, timestamp)`.
L'écart d'édition est **impossible à rétro-calculer** s'il n'est pas gardé dès J1.

### Garanties d'expérience à porter par l'architecture

Promues de "détail UX" à garantie archi (sinon le reste de la stack sert une app ouverte une seule fois) :
- **Streaming du Composeur** — premier token rendu en flux (SSE/fetch stream edge→champ) ; latence transformée en spectacle. Timeout UX à 5s vers message doux (jamais spinner infini), génération annulable.
- **Brouillon qui ne meurt jamais** — texte du Composeur persisté localement (IndexedDB) à chaque frappe avant tout réseau. "Améliorer" garde l'ancienne version récupérable (undo Composeur). Modèle offline explicite : écritures optimistes vs mises en file vs réconciliées avec Turso, et résolution de conflit.
- **Swipe-deck = machine à états + undo** — "plus tard" = carte déplacée avec timestamp de réapparition (rejoint la Next-action) ; snackbar Annuler doublé d'un label ; tri figé au chargement de session (sinon cartes qui sautent sous le doigt).
- **Timing permission push = événement gagné**, jamais à l'init (iOS refuse définitivement après un "Non") : après le 1er message envoyé.
- **PWA/iOS** — détection display-mode (Safari vs standalone) ; onboarding <2 min inclut "Ajoute à l'écran d'accueil" ; dégradation gracieuse (pas de push → badge in-app à la réouverture).
- **a11y structurelle, pas CSS** — états portés par forme + texte + **ARIA** ; swipe-deck (geste pur) a des équivalents non-gestuels (boutons, clavier, lecteur d'écran) ; tints d'erreur "doux" vérifiés en **contraste AA**.

### Arbitrage : scheduler de relances + Web Push (verdict PM)

Décision d'archi **Priorité 1 — à PRENDRE maintenant, à CONSTRUIRE plus tard**. Build MVP = **Layer 1 (filet in-app) seul** (tient la garantie zéro-fuite *donnée* pour l'user n°1). Push hors sprint MVP. L'archi verrouille dès maintenant, sinon le report casse la promesse en silence :
1. **Topologie du déclencheur** (scheduler serveur stateful vs pur client) — décidée maintenant.
2. **Next-action = source de vérité requêtable serveur-side** le jour du cron, sans réécrire le modèle (la due-date dérivée-à-la-lecture client doit rester lisible serveur).
3. **Frontière écrite** : filet = non-perte de donnée ; push = ré-engagement. Zéro-fuite *au sens rétention* INCOMPLÈTE jusqu'au push — pas de prose qui prétende l'inverse.
4. **Trigger iOS** = contrainte connue (PWA écran d'accueil), pas surprise.
Déclencheur réel du build push = **le premier user non-founder**, pas une date.

### Technical Constraints & Dependencies

- Appels Claude exclusivement côté serveur (route handler / server action) ; clé en env serveur, jamais NEXT_PUBLIC_*.
- Toute lecture/écriture filtrée par user_id (Turso mono-base partagée au MVP) ; aucune query sans clause user_id.
- sanitize() déterministe côté serveur PUIS validation des Tells, en boucle bornée ; appliqué à la génération ET à l'import (seeds/corpus).
- Score de froideur dérivé à la lecture depuis `dernier_contact_at` (non stocké) ; **4 bandes canoniques (project-context)** : jamais contacté (`dernier_contact_at = null`) · frais < 30 j · tiède 30-90 j · froid > 90 j. Seuils figés dans `domain/cold-score.ts` (dérivés de `(now, user.timezone)`).
- Relance idempotente : contrainte d'unicité 1 par message non répondu ; **délai par défaut J+5** (project-context ; dérivé de `(now, user.timezone)`, décalable/annulable) ; rejouer le scheduler ne crée ni doublon ni double notification.
- Web Push via service worker ; iOS exige la PWA ajoutée à l'écran d'accueil.
- Pas de scraping LinkedIn, pas d'auto-send (CGU/ban) ; envoi = copier puis marquer Envoyé.
- Capacitor-ready : le front ne doit pas empêcher un wrap natif ultérieur.

### Cross-Cutting Concerns Identified

- Authentification + scoping user_id (sécurité d'accès aux données).
- Frontière de sécurité serveur/client pour la clé Claude.
- sanitize() partagé (lib réutilisable serveur, `lib/copy.ts`) entre génération et import.
- Résilience hors-ligne / dégradation gracieuse du composeur (état dégradé, pas mode parallèle).
- Privacy/RGPD : export, suppression, transparence ; données tiers (Contacts) = base légale + effacement cross-user à cadrer ; registre de ce qui sort vers Claude.
- Observabilité du moat : événement de génération transactionnel pour SM-1, compteur de tokens.

### TODO archi à trancher dans ce document

- Versions de la stack (rien figé en amont).
- **Topologie du scheduler de relances / déclencheur push** ([PRD §14](prds/prd-job-pipeline-2026-06-15/prd.md)) — verdict : décider la topologie maintenant, construire au 1er user non-founder.
- Stratégie multi-tenancy Turso — recadrée : critère = **conformité (effacement cross-user d'un contact tiers)** + blast-radius, PAS scaling. Arbitrage MVP : mono-base partagée, défendable *seulement si* `user_id` partout dès J1.
- **#30 "Mode sans-IA" — CLOS (2026-06-16). FR-15 SUPPRIMÉ** (PRD aligné sur UX #18/#19). Pas de mode ni de toggle : ne pas générer = déjà aucun appel IA (FR-6) ; hors-ligne/IA indispo = Générer/Améliorer grisés + message doux, champ éditable et envoi manuel (FR-7). Corpus = TOUS les messages envoyés (manuels inclus), aucune exclusion.

## Starter Template Evaluation

### Primary Technology Domain

Full-stack PWA mobile-first (Next.js App Router + Turso/libSQL + API Claude serveur-only). Domaine identifié depuis l'analyse de contexte : pas de besoin temps-réel collaboratif, mais offline/PWA, streaming LLM, et appels serveur-only.

### Starter Options Considered

- **Vanilla `create-next-app` à la carte (RETENU)** — Next.js 16 (App Router, Turbopack, React Compiler), TypeScript, Tailwind ; on ajoute Drizzle+libSQL, Auth.js v5, Serwist à la main. Contrôle total, dernière version Next, pas de tRPC.
- **`create-t3-app` (écarté)** — scaffold opinionated (Drizzle/Auth.js/tRPC/Tailwind). Écarté : basé Next 15 (retard sur 16), pas de preset Turso (recâblage sqlite→libSQL de toute façon), tRPC = couche inutile au MVP single-user (Claude serveur-only = route handlers ; server actions suffisent), Serwist à ajouter quand même.
- **Vite + Capacitor pur (écarté)** — perdrait le SSR/route handlers serveur nécessaires à la frontière "clé Claude serveur-only" et au futur scheduler ; Next reste Capacitor-ready sans cela.

### Selected Starter: create-next-app (à la carte)

**Rationale for Selection :**
Next 16 dernière stable (Turbopack par défaut, React Compiler 1.0). Turso est 1er-class via Drizzle libSQL (aucun preset à défaire). La frontière d'archi "appels Claude serveur-only" tombe naturellement sur les route handlers / server actions — pas besoin de tRPC. Serwist (compatible Turbopack) remplace next-pwa (non maintenu, exige --webpack). Contrôle explicite = Capacitor-ready maîtrisé. Gestionnaire de paquets : pnpm.

**Initialization Command (versions vérifiées juin 2026) :**

```bash
pnpm create next-app@latest plume \
  --typescript --tailwind --app --src-dir --eslint \
  --import-alias "@/*" --use-pnpm

# Couche données — Turso/libSQL + Drizzle
pnpm add drizzle-orm @libsql/client
pnpm add -D drizzle-kit

# Auth — Auth.js v5 (Google) + adapter Drizzle
pnpm add next-auth@beta @auth/drizzle-adapter

# PWA — Serwist (compatible Turbopack)
pnpm add serwist && pnpm add -D @serwist/next

# IA — SDK Anthropic (import serveur-only uniquement)
pnpm add @anthropic-ai/sdk
```

**Architectural Decisions Provided by Starter :**

- **Language & Runtime :** TypeScript strict, Next.js 16 App Router, React 19.2, runtime Node serveur pour les appels Claude (clé en env serveur, jamais NEXT_PUBLIC_*).
- **Styling :** Tailwind CSS v4 ; design system Plume (palette/typo/rayons/offsets figés) via tokens Tailwind + CSS vars ; aucune lib d'UI tierce (signature "fait-main").
- **Build Tooling :** Turbopack (dev + build, défaut Next 16). Serwist via `@serwist/next` (precache manifest + `public/sw.js`) ; `--webpack` seulement pour le test PWA en dev local.
- **Data Layer :** Drizzle ORM + `@libsql/client` ; `drizzle.config.ts` dialect `turso` ; schémas `sqliteTable` ; client `drizzle(createClient({ url, authToken }))` depuis `drizzle-orm/libsql` ; migrations drizzle-kit. **Couche d'accès scopée user_id à construire au-dessus** (invariant #1) — pas de query Drizzle nue.
- **Auth :** Auth.js v5 (next-auth beta), provider Google, `@auth/drizzle-adapter` ; clé d'identité **opaque** (user id interne ; email Google = attribut, jamais PK — décision irréversible).
- **Code Organization :** `src/app` (routes + route handlers), `src/lib` (dont `lib/copy.ts` = sanitize() + libellés générés, partagé serveur), `src/db` (schéma Drizzle + client scopé), `src/components`. Server components par défaut ; Composeur = client component avec streaming.
- **Development Experience :** ESLint, TypeScript, hot reload Turbopack, drizzle-kit studio/migrations.

**Note :** L'init via cette commande doit être la **première story d'implémentation**.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical (bloquent l'implémentation) :** modèle de données + clé dédup · couche d'accès scopée user_id · pattern streaming Composeur · topologie scheduler.
**Important (façonnent l'archi) :** validation Zod · état client + offline (Dexie) · hébergement.
**Deferred (post-MVP) :** build effectif du push (1er user non-founder) · enforcement quota (SaaS) · table contact_channels normalisée (v1 si multi-handle réel).

### Data Architecture

- **ORM/DB :** Drizzle + Turso/libSQL (starter). Schémas `sqliteTable`. Source de types DB = Drizzle.
- **Modèle de domaine (entités MVP) :** `users` (id opaque, email Google = attribut) · `contacts` · `messages` · `next_actions` · `seed_voix` · `push_subscriptions` · `generation_events` (observabilité moat). **Corpus de Voix = PAS une table** : TOUS les `messages` au statut `envoyé` (manuels inclus, aucune exclusion) ; `seed_voix` = amorce optionnelle.
- **Contact↔canal (tranché AVANT schéma) :** enum `Canal` **canonique = `{linkedin, email, whatsapp, sms}`** (4 canaux UI, project-context ; source unique `domain/enums.ts`). `contacts.canal_prefere` ∈ `Canal` + `contacts.handles` = JSON des **points de contact stockés** `{linkedin, email, phone, whatsapp}` — axe distinct du canal : le handle `phone` porte le canal `sms` (et `whatsapp` si pas de handle WhatsApp dédié). `messages.canal` ∈ `Canal` = canal utilisé. Évite la table de jointure au MVP sans verrouiller "1 contact = 1 email" (table `contact_channels` normalisée = v1 si multi-handle réel).
- **Historique de Contact (FR-35, story 3.10, ajout 2026-06-21) :** colonne `contacts.historique` (`text`, nullable) — **distincte de `notes`** ; stockage **brut**, sanitizé à l'écriture (parité règle « sanitize à l'import »), scopée `user_id`. Le pipeline `composeInVoice` (`lib/composer/pipeline.server.ts`) reçoit un paramètre optionnel `historique` injecté comme **bloc de contexte borné** dans le prompt (constante serveur type `MAX_HISTORIQUE`, troncature « bornée pas honorée », parité `MAX_SEED`/`MAX_IMPORT`) → génération en continuité. **Pas de table de messages d'historique** ni de multi-fils par canal au MVP (différé, comme `contact_channels`).
- **Clé de dédup :** email normalisé (lowercase+trim) si présent, sinon `nom_normalisé + entreprise_normalisée` ; collision → flag `merge_pending` + fusion manuelle, jamais fusion à tort. `ImportReport {created, merged, skipped, reasons}`.
- **Validation :** Zod 4 à chaque frontière (route handler, server action, ligne CSV, formulaire). `drizzle-zod` pour dériver les schémas. Une donnée non validée n'entre jamais en BDD.
- **Migrations :** drizzle-kit (`generate` + `migrate`), fichiers SQL committés au repo.
- **Caching :** cold-score + File du jour = **dérivés à la lecture** (zéro cache, zéro table dérivée). Prompt caching Anthropic sur le préfixe stable (système + exemples voix). Pas de cache HTTP applicatif au MVP.
- **Horloge :** `now` injecté (param), jamais `Date.now()` en dur ; tout "Today"/échéance dérivé de `(now, user.timezone)`.

### Authentication & Security

- **Auth :** Auth.js v5 (next-auth beta), provider Google unique au MVP. `auth()` résout `user_id` côté serveur dans chaque route handler / server action.
- **Identité :** clé interne **opaque** (cuid/uuid), email = attribut, jamais PK (décision irréversible, SaaS-ready).
- **Authorization (enforcement invariant #1) :** module d'accès scopé `db.forUser(userId)` (repository) ; **aucune query Drizzle nue** hors de ce module. Filet de test transversal : 2 users, asserter zéro fuite cross-tenant par endpoint.
- **Secrets :** clé Claude + token Turso + VAPID privé = env **serveur** uniquement, jamais `NEXT_PUBLIC_*` (sauf VAPID public).
- **Quota/cost :** `generation_events.tokens` + compteur par user dès J1 ; rate-limit basique sur `/api/composer` (anti-runaway) ; enforcement de quota différé au SaaS.

### API & Communication Patterns

- **Pattern :** Route handlers + Server Actions (App Router) ; **pas de tRPC**.
- **Composeur :** `POST /api/composer` → **streaming** (ReadableStream/SSE) token-par-token vers le champ. Pipeline serveur : résoudre user_id → SELECT corpus voix (scopé) → prompt few-shot canal-aware (Haiku/Opus) → `sanitize()` déterministe → boucle re-valide **bornée (MAX 2)** → renvoi + usage tokens. Clé Claude jamais au client.
- **Mutations :** Server Actions (créer contact, marquer Envoyé, reporter relance) avec validation Zod.
- **Idempotence :** contrainte d'unicité BDD + `INSERT ... ON CONFLICT DO NOTHING` (import, `next_actions UNIQUE(message_id)`), jamais check-then-insert.
- **Erreurs :** modèle typé (Result) ; UX douce (jamais rouge alarme) ; fallback hors-ligne = champ éditable, brouillon préservé.

### Frontend Architecture

- **Rendu :** Server Components par défaut ; Composeur = Client Component (streaming + état local).
- **État client :** minimal — **Zustand** pour l'état du Composeur + l'outbox offline ; pas de Redux. Reste = server components + server actions.
- **Offline / optimistic (garantie d'archi) :** **Dexie** (IndexedDB) — brouillon persisté à chaque frappe **avant tout réseau**, "Améliorer" garde l'ancienne version (undo Composeur), **outbox queue** rejouée à la reconnexion. `dexie-react-hooks` (`useLiveQuery`) pour la réactivité SW→composant. Conflits : autorité serveur sur `Sent` (immuable), last-write-wins ailleurs.
- **Routing :** App Router, 3 segments (`/aujourdhui`, `/reseau`, `/reglages`). Composeur = **bottom-sheet overlay** client (en flow, hors barre d'onglets), pas un segment d'onglet. Swipe-deck = machine à états + undo + tri figé par session.
- **Design system :** tokens Tailwind v4 + CSS vars (palette/typo/rayons/offsets figés du project-context) ; a11y structurelle (forme+texte+ARIA, équivalents non-gestuels au swipe).
- **Illustration (technique tranchée) :** SVG canonique **référencé par path** via `<use href="/plume-illustration-assets.svg#name">`, recolor par **CSS vars / `currentColor`** (fill froideur + ombre interne `-shade`). **Jamais d'inline du markup SVG dans le bundle JS, jamais de redraw/régénération par écran** (project-context) ; `<Plume>` n'est qu'un wrapper autour du `<use>`.

### Infrastructure & Deployment

- **Hébergement :** **Vercel** (Next-natif : edge, server functions, Cron) + Turso (edge SQLite). [confirmable — alternative self-host/Cloudflare/Railway si lock-in/coût rédhibitoire]
- **Scheduler relances (TOPOLOGIE LOCKÉE) :** **Vercel Cron managé** (`vercel.json`) → route handler authentifié (`CRON_SECRET`) → SELECT `next_actions` dues (due_at **lisible serveur-side**) → Web Push via `web-push`/VAPID. **Serverless cron + Turso comme état**, PAS de worker long-running stateful. Cron quotidien suffit au MVP (Hobby 1×/jour). **Build différé au 1er user non-founder** ; topologie + contrat due_at serveur-lisible lockés maintenant.
- **CI/CD :** GitHub Actions (repo public) — lint + typecheck + test + check migrations drizzle.
- **Env config :** Vercel env vars (serveur) ; `.env.local` dev. VAPID public = seule var `NEXT_PUBLIC_*` côté secrets.
- **Monitoring :** logs Vercel + table `generation_events` (tokens/SM-1) ; pas d'APM tiers au MVP.

### Decision Impact Analysis

**Implementation Sequence :** (1) init starter + schéma Drizzle scopé + Auth.js Google → (2) `db.forUser` + filet test cross-tenant → (3) Contacts (manuel/rapide, dédup, CSV async) → (4) Composeur streaming + `sanitize()` + `generation_events` → (5) Messages/Statut + state machine + figer Sent → (6) File du jour dérivée + Relances in-app (filet) → (7) PWA Serwist + offline Dexie → (8) [différé] cron + Web Push.

**Cross-Component Dependencies :** `db.forUser` sous-tend tout (bloquant). `generation_events` couple moat+coût (écrit transactionnellement avec l'envoi). `next_actions.due_at` serveur-lisible = pré-requis du futur cron. Dexie outbox ↔ server actions (réconciliation). `sanitize()` partagé génération ET import (`lib/copy.ts`).

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

~24 points de divergence possibles entre agents IA, verrouillés ci-dessous. Stack : Next 16 (App Router/TS) + Drizzle/Turso + Zod 4 + Tailwind v4 + Zustand + Dexie.

### Naming Patterns

**Database (Drizzle/libSQL) :**
- Tables : `snake_case` **pluriel** (`contacts`, `next_actions`, `generation_events`, `push_subscriptions`).
- Colonnes : `snake_case` (`user_id`, `canal_prefere`, `dernier_contact_at`, `envoye_at`).
- FK : `<entité>_id` (`user_id`, `contact_id`, `message_id`). Timestamps : suffixe `_at` (epoch ms en `integer` SQLite).
- PK : `id` (cuid2 texte, opaque). Index : `idx_<table>_<col>` ; unique : `uq_<table>_<col>` (ex. `uq_next_actions_message_id`).
- Enums : stockés en `text` + union TS (`'brouillon'|'envoye'|'vu'|'repondu'|'ignore'`), valeurs **non traduites** (clé stable, le libellé FR vit dans `lib/copy.ts`).

**API / routes :**
- Route handlers : `src/app/api/<kebab>/route.ts` (`/api/composer`, `/api/cron/relances`). Verbe HTTP réel (POST génération, GET cron).
- Server Actions : verbe d'action camelCase (`createContact`, `markMessageSent`, `snoozeRelance`), fichier `actions.ts` co-localisé au feature.
- Pas de params d'URL pour les mutations (server actions). Query params `camelCase`.

**Code (TS/React) :**
- Composants : `PascalCase`, fichier `PascalCase.tsx` (`ComposerSheet.tsx`, `ColdTag.tsx`).
- Fonctions/vars : `camelCase`. Types/interfaces : `PascalCase`. Constantes module : `SCREAMING_SNAKE` (`MAX_SANITIZE_RETRIES = 2`).
- Hooks : `useXxx`. Stores Zustand : `useXxxStore` (`useComposerStore`).
- **Langue : UI/microcopy/commentaires = français** (project-context). Identifiants de code = anglais. Pas de fallback anglais à l'écran.

### Structure Patterns

- Racine : `src/` (`--src-dir`). Organisation **par domaine/feature**, pas par type :
  `src/features/{contacts,composer,messages,today,relances,voice,settings}/` (composants + actions + logique du feature).
- Transverse : `src/lib/` (`copy.ts` = sanitize()+libellés, `db/` client scopé + schéma Drizzle, `auth.ts`, `time.ts` horloge injectée, `push.ts`), `src/components/ui/` (primitives design-system), `src/app/` (routes).
- **Tests co-localisés** `*.test.ts(x)` à côté du code ; E2E dans `e2e/` racine. `sanitize()` = property-based test obligatoire.
- Schéma Drizzle : `src/lib/db/schema.ts` ; migrations générées : `drizzle/`. Assets : `public/` (dont `plume-illustration-assets.svg`).

### Format Patterns

- **Frontière API en `camelCase`** ; DB en `snake_case` → mapping via Drizzle (pas de snake_case fuité au client).
- Dates : **ISO 8601 UTC** en transit (string) ; stockage epoch ms (`integer`). Affichage = dérivé `(now, user.timezone)`.
- Réponses : retour direct (pas de wrapper `{data}`). Erreur : `Result<T, AppError>` typé — `AppError {code, message, retriable}`. Codes HTTP réels (400 validation, 401 auth, 409 conflit idempotence, 429 quota, 503 IA indispo).
- Booléens : `true/false`. Null explicite (`dernier_contact_at: null` = jamais contacté). Montants tokens : `integer`.

### Communication / State Patterns

- **Zustand** : updates immutables, un store par domaine UI stateful (`useComposerStore`, `useOutboxStore`). Pas de store global monolithe.
- **Dexie** : tables `drafts`, `outbox` ; `useLiveQuery` pour lire ; toute mutation offline passe par l'outbox (jamais d'écriture directe optimiste hors queue).
- Server Actions = source d'autorité ; le client réconcilie. `Sent` = immuable côté serveur (rejet 409 si réédition).
- Logs : structuré `{level, event, user_id?, ...}` ; events `domaine.action` (`composer.generated`, `relance.due`, `import.completed`). Jamais de PII de contact tiers dans les logs.

### Process Patterns

- **Validation timing :** Zod à la frontière (entrée route/action/CSV/form) AVANT toute logique ou écriture DB. Schémas dérivés de Drizzle via `drizzle-zod`.
- **Erreurs UX :** teinte douce de la famille, jamais rouge alarme (project-context). Distinguer log technique vs message user.
- **Loading/streaming :** Composeur = état `idle|generating|ok|error|offline` (machine à états) ; premier token < 5s sinon message doux ; spinner infini **interdit**.
- **Retry :** seul retry autorisé = boucle `sanitize→re-valide` bornée `MAX_SANITIZE_RETRIES=2` côté serveur ; pas de retry réseau auto silencieux (le brouillon reste éditable, l'user décide).
- **Idempotence :** `INSERT ... ON CONFLICT DO NOTHING` partout (import, relances) ; jamais read-then-write.
- **Auth flow :** `auth()` serveur résout `user_id` ; toute query via `db.forUser(userId)`.

### Enforcement Guidelines

**Tout agent IA DOIT :**
- Lire `project-context.md` + cette section AVANT de coder.
- Passer toute lecture/écriture par `db.forUser(userId)` — zéro query Drizzle nue.
- Router tout texte généré ET importé par `sanitize()` de `lib/copy.ts` (jamais de sanitize ad-hoc).
- Écrire UI/commentaires en français ; libellés via `lib/copy.ts`, jamais en dur dispersés.
- Injecter `now` (jamais `Date.now()` en dur) dans toute logique temporelle.
- En cas de doute : option la plus restrictive + `TODO` explicite, jamais deviner (norme "ne rien deviner").

**Vérification :** ESLint (no-restricted-imports sur `@anthropic-ai/sdk` hors `src/lib/**` serveur), test cross-tenant 2 users, property-test `sanitize()`, check migrations en CI.

### Pattern Examples

**Good :** `await db.forUser(userId).select().from(contacts)` · `const t = sanitize(raw)` · `messages.status: 'envoye'` + libellé `copy.statut.envoye` · `ComposerSheet.tsx`.
**Anti-patterns :** `db.select().from(contacts)` (non scopé) · `new Date()`/`Date.now()` en logique · `text.replace('—','-')` ad-hoc hors sanitize · libellé FR codé en dur dans un composant · appel `@anthropic-ai/sdk` dans un client component.

## Project Structure & Boundaries

### Complete Project Directory Structure

```
plume/
├── package.json · pnpm-lock.yaml · README.md
├── next.config.ts                 # wrap Serwist (@serwist/next)
├── tsconfig.json (strict, @/*) · eslint.config.mjs (3 barrières, cf. Enforcement)
├── tailwind.config.ts             # CONSOMME src/design/tokens.ts (ne redéfinit pas)
├── drizzle.config.ts              # dialect 'turso'
├── vitest.config.ts               # setupFiles: tests/setup/fake-indexeddb.ts
├── playwright.config.ts
├── vercel.json                    # crons: /api/cron/relances (build différé)
├── .env.local · .env.example
├── .github/workflows/ci.yml       # migrate → vitest → playwright + drizzle check
├── drizzle/                       # migrations SQL générées (committées)
├── scripts/{seed.ts,migrate.ts}   # seed idempotent (réutilise tests/factories), wrapper migrate
├── public/
│   ├── manifest.webmanifest · icons/
│   └── plume-illustration-assets.svg   # asset (accédé SEULEMENT via src/design/illustration)
├── src/
│   ├── app/
│   │   ├── layout.tsx · globals.css (@theme consomme tokens) · page.tsx (→ /aujourdhui)
│   │   ├── (auth)/login/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx          # monte ComposerSheet UNE fois (au-dessus des routes)
│   │   │   ├── aujourdhui/page.tsx · reseau/page.tsx · reseau/[contactId]/page.tsx · reglages/page.tsx
│   │   ├── sw.ts                   # bootstrap Serwist MINIMAL (logique → lib/offline)
│   │   └── api/{composer,auth/[...nextauth],push/subscribe,cron/relances}/route.ts
│   ├── design/                     # FOYER UNIQUE du design-system
│   │   ├── tokens.ts               # radii/spacing/offset/outline 2.5px/tints — source de vérité
│   │   └── illustration/Plume.tsx  # <Plume name tint/> = wrapper <use href="/plume-illustration-assets.svg#name"/> ; ref par path (jamais inline le markup) + recolor CSS/currentColor ; jamais redraw
│   ├── features/
│   │   ├── contacts/    # FR-1,2,5,34 : composants + actions.ts + import-csv.ts + dedup.ts
│   │   ├── composer/    # FR-6..15 : ComposerSheet('use client') + actions.ts('use server')
│   │   │                #   prompt.server.ts · schema.ts(Zod neutre) · index.ts(barrel client-safe)
│   │   │                #   use-composer-route.ts(?compose=) · draft-store.ts · use-generation.ts(stream FSM)
│   │   │                #   use-online-status.ts(Générer grisé hors-ligne, #30 clos)
│   │   ├── voice/       # FR-10,16,17 : few-shot.server.ts (sélection corpus), seed
│   │   ├── messages/    # FR-18..21 : timeline · send.ts (tx atomique message figé + generation_events)
│   │   ├── today/       # FR-22..24 : SwipeDeck · use-deck.ts (undo + lastDismissed)
│   │   ├── relances/    # FR-25..27 : dérivation in-app (filet) · snooze
│   │   └── settings/    # FR-30..33 : export · suppression · transparence · onboarding · push-client.ts
│   ├── components/ui/   # primitives : ColdTag(coldness→tint+label+aria) · StatusMessage(tone) · Button · BottomSheet
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts           # tables Drizzle SEULES (consomme domain/enums)
│   │   │   ├── client.ts           # factory createClient(config) — ZÉRO env au module-load ; export _db interne
│   │   │   ├── env.ts              # SEUL lecteur process.env.TURSO_* ('server-only')
│   │   │   ├── scoped.ts           # scopedDb(db,{tenantId,now}) — db INJECTÉ, PAS de 'server-only'
│   │   │   └── index.ts            # ré-exporte forUser UNIQUEMENT
│   │   ├── domain/                 # ZONE NEUTRE (ni client ni server, zéro Drizzle)
│   │   │   ├── enums.ts            # source unique des enums (statut/canal/froideur)
│   │   │   ├── types.ts · cold-score.ts · time.ts (now injecté)
│   │   ├── copy.ts                 # sanitize() + libellés FR (server-only)
│   │   ├── auth.ts · claude.server.ts · push.server.ts (dispatch VAPID privée)
│   │   ├── connectivity.ts         # signal online/offline partagé
│   │   └── offline/{dexie.ts, sync.ts}   # sync.ts : replay(queue,{db,now}) PUR
│   └── types/                      # AppError, Result
├── tests/
│   ├── db/harness.ts(makeTestDb · file::memory:?cache=shared + migrate) · index.ts
│   ├── factories/{contact,message,user,generationEvent}.ts
│   ├── fixtures/{copy/ai-markers.ts, claude-canned/}   # payloads gelés
│   ├── security/cross-tenant.test.ts                   # INVARIANT n°1 (seed A+B, zéro fuite)
│   ├── offline/replay.test.ts
│   └── setup/fake-indexeddb.ts
└── e2e/today-queue.spec.ts         # Playwright (UJ-1..3)
```
(co-localisés : `copy.property.test.ts`, `db/scoped.test.ts`, `messages/send.test.ts`, etc.)

### Architectural Boundaries

- **API :** `POST /api/composer` (seule entrée génération, clé Claude derrière) · `/api/auth/*` · `/api/push/subscribe` · `/api/cron/relances` (CRON_SECRET, différé). Mutations métier = Server Actions co-localisées.
- **Frontière server/client (durcie) :** suffixe `.server.ts` + `import 'server-only'` sur `claude.server.ts`, `push.server.ts`, `prompt.server.ts`, `few-shot.server.ts`, `db/env.ts`, `copy.ts`. Barrels `index.ts` n'exposent QUE le client-safe.
- **Zone neutre :** `src/lib/domain/*` et `src/design/tokens.ts` importables client ET server (zéro infra). Le client n'importe JAMAIS `db/schema.ts` (passe par `domain/enums`).
- **Porte de données unique :** `src/lib/db/scoped.ts` (`db.forUser`) = seul accès ; `client.ts`/`schema.ts`/`env.ts` internes au dossier `db/`, jamais importés hors `lib/db`.
- **Atomicité moat :** `features/messages/send.ts` écrit `messages`(figé) + `generation_events` dans **une** transaction Drizzle.
- **Offline ↔ serveur :** `lib/offline/sync.ts` rejoue l'outbox (pur, testable) vers les server actions ; autorité serveur sur `Sent`.

### Requirements → Structure Mapping

| Feature (FRs) | Emplacement |
|---|---|
| Contacts (FR-1..5,34) | `features/contacts/`, `app/(app)/reseau/`, `db/schema.ts` |
| Composeur (FR-6..15) | `features/composer/`, `api/composer/route.ts`, `lib/claude.server.ts`, `lib/copy.ts` |
| Voix (FR-10,16,17) | `features/voice/`, schema (`seed_voix` ; corpus = `messages` envoyés) |
| Messages/Statut (FR-18..21) | `features/messages/` (`send.ts`), state-machine, figer Sent |
| File du jour (FR-22..24) | `features/today/` (`use-deck.ts`), `lib/domain/cold-score.ts`, `lib/domain/time.ts` |
| Relances (FR-25..27) | `features/relances/`, `api/cron/relances/`, `lib/push.server.ts`, `next_actions` |
| PWA/Auth/Privacy (FR-28..33) | `app/sw.ts`, `manifest`, `lib/auth.ts`, `features/settings/` |
| Design-system (transverse) | `src/design/` (tokens + illustration), `components/ui/` |

**Cross-Cutting :** scoping → `db/scoped.ts` (+ `tests/security/cross-tenant`) · sanitize → `lib/copy.ts` (gen+import, + `copy.property.test`) · moat → `generation_events` (tx avec send) · a11y → enforced dans primitives `ui/` · tokens → `design/tokens.ts`.

### Build & Workflow

- **Dev :** `pnpm dev` (Turbopack) ; `--webpack` pour tester le SW/PWA en local.
- **⚠️ Trap PWA :** `@serwist/next` compile `sw.ts` via webpack → **build PWA peut exiger `next build --webpack`** (à valider contre la version Serwist figée, en CI dès le 1er commit Serwist).
- **CI :** `migrate` (libSQL file temp) → `vitest run` → `playwright test` + check migrations drizzle.
- **Deploy :** Vercel (env serveur) ; `drizzle-kit migrate` en étape ; `vercel.json` arme le cron (activé au 1er user non-founder).

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility :** Stack mutuellement compatible et à jour (vérifié juin 2026) : Next 16 ↔ Drizzle/libSQL ↔ Auth.js v5 ↔ Zod 4 ↔ Serwist ↔ Zustand ↔ Dexie ↔ @anthropic-ai/sdk. Un seul point de friction outillage : Serwist compile le SW via webpack alors que Next 16 default Turbopack (trap noté, à valider en CI). Aucune décision contradictoire.

**Pattern Consistency :** Conventions de nommage (DB snake_case / API camelCase / code PascalCase-camelCase) cohérentes avec la stack ; idempotence (ON CONFLICT) cohérente avec les contraintes d'unicité ; horloge injectée cohérente avec le dérivé-à-la-lecture. Les 3 barrières ESLint matérialisent les invariants.

**Structure Alignment :** La structure porte chaque invariant — zone neutre `domain/` (enums source unique) brise les fuites de bundle ; porte unique `db/scoped.ts` verrouillée ESLint ; `.server.ts` + `server-only` isolent la clé Claude/VAPID ; `send.ts` rend l'atomicité moat testable ; `design/tokens.ts` foyer unique.

### Requirements Coverage Validation

**Functional Requirements (34/34 architecturalement supportés) :** Contacts FR-1..5,34 ✅ · Composeur FR-6..14 ✅ · Messages FR-18..21 ✅ · File FR-22..24 ✅ · Relances FR-25,27 ✅ · PWA/Auth/Privacy FR-28..33 ✅ · Voix FR-16,17 ✅.
- **FR-15 (Mode sans-IA) — SUPPRIMÉ ✅** : #30 clos (2026-06-16), PRD aligné sur l'UX. Pas de mode ; le cas manuel/hors-ligne = FR-6/FR-7. Corpus = tous les messages envoyés.
- **FR-26 (push) ⚠️** : topologie lockée (Vercel Cron → route → web-push), build différé au 1er user non-founder ; zéro-fuite FR-27 tenue par le filet in-app indépendamment du push.

**Non-Functional Requirements :** Perf <5s (streaming) ✅ · SaaS-ready (user_id + clé opaque J1) ✅ · Mobile-first ✅ · Privacy (export/delete/transparence) ✅ · Coût (Haiku + compteur tokens) ✅ · Résilience (import partiel + Dexie) ✅.
- **RGPD données tiers ⚠️** : provenance/base légale en schéma J1, cadrage juridique (effacement cross-user) à instruire avant SaaS (non bloquant MVP single-user).

### Implementation Readiness Validation ✅

Décisions critiques documentées avec versions ; séquence d'implémentation ordonnée (8 étapes) ; dépendances cross-composant explicites. Arbre complet et spécifique (fichiers, configs, tests, scripts CI) ; frontières + intégrations cartographiées ; mapping FR→structure complet. ~24 points de conflit adressés ; enforcement vérifiable (ESLint + tests).

### Gap Analysis Results

**Critical (bloquent) :** aucun. Le MVP peut démarrer l'implémentation.
**Important (non bloquants) :**
1. ~~Réconciliation #30 / FR-15~~ — **RÉSOLU (2026-06-16)** : FR-15 supprimé, PRD + project-context alignés sur l'UX.
2. Cadrage RGPD base légale données tiers (avant SaaS).
3. Spec exécutable `sanitize()` : table de vecteurs Unicode exacte — début de la story Composeur.
4. Stratégie de sélection few-shot : N exemples / critère exact à fixer (assumption FR-17).
5. Valider le chemin build PWA (webpack/Serwist) en CI dès le 1er commit Serwist.
**Nice-to-have (différés) :** APM tiers · enforcement quota (SaaS) · table `contact_channels` normalisée (v1).

### Architecture Completeness Checklist

**Requirements Analysis :** [x] context analysé · [x] scale/complexité · [x] contraintes techniques · [x] cross-cutting mappé.
**Architectural Decisions :** [x] décisions critiques + versions · [x] stack spécifiée · [x] patterns d'intégration · [x] perf.
**Implementation Patterns :** [x] nommage · [x] structure · [x] communication · [x] process.
**Project Structure :** [x] arbre complet · [x] frontières · [x] intégrations · [x] mapping FR→structure.

### Architecture Readiness Assessment

**Overall Status :** READY WITH MINOR GAPS — 16/16 items validés, zéro Critical Gap ; 5 gaps Important non-bloquants (2 décisions produit/juridique différables, 3 résolus au début des stories concernées).
**Confidence Level :** high — ancré sur PRD+UX, versions vérifiées, invariants rendus vérifiables par structure+CI, revue adversariale (4 agents) intégrée.
**Key Strengths :** invariants → propriétés CI (3 barrières ESLint + tests cross-tenant/property/atomicité) ; frontière clé Claude triplement gardée ; observabilité moat (SM-1) première-classe ; topologie scheduler décidée sans sur-construire ; design-system à foyer unique.
**Areas for Future Enhancement :** multi-tenancy DB-per-user (SaaS) ; enforcement quota ; envoi direct multi-canal (v1) ; module Opportunités (v1).

### Implementation Handoff

**AI Agent Guidelines :** suivre `project-context.md` + ce document à la lettre ; doute → option la plus restrictive + TODO ; toute donnée via `db.forUser(userId)` ; tout texte via `sanitize()` ; `now` injecté ; UI/commentaires français ; respecter `.server.ts` / zone neutre `domain/` / porte unique `db/`.

**First Implementation Priority :**
```bash
pnpm create next-app@latest plume --typescript --tailwind --app --src-dir --eslint --import-alias "@/*" --use-pnpm
```
puis schéma Drizzle scopé + Auth.js Google + `db.forUser` + filet test cross-tenant (étapes 1-2 de la séquence).
