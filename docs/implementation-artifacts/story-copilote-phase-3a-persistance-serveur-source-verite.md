# Story Copilote Phase 3-A : Persistance + serveur source de vérité (CAP-1, CAP-3, CAP-2, CAP-5)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Piste copilote = lignée `spec-copilote-phase-N` (phases 1-2 sont des artefacts spec, pas des
     lignes sprint-status ; epic-3 déjà `done`). Cette story N'EST PAS ajoutée à sprint-status :
     elle suit la même piste que `spec-copilote-phase-1-agent-chat.md`. -->

## Story

As **Monsieur (l'utilisateur de Plume)**,
I want **que chaque échange avec le copilote soit persisté côté serveur et rechargé à l'ouverture du popup, avec un contexte multi-tour reconstruit depuis la base (plus depuis mon navigateur)**,
so that **ma conversation survive à un reload/une fermeture, que le serveur soit la mémoire de confiance (un navigateur trafiqué ne fabrique plus de faux passé), et que le bouton « annuler ce tour » reste disponible après reload**.

## Acceptance Criteria

> Source canonique : [SPEC.md](../specs/spec-copilote-phase-3-historique-persistant/SPEC.md). Cette story livre CAP-1, CAP-3, CAP-2, CAP-5.

1. **CAP-1 — Persistance des deux rôles, scopée, ordonnée.** Given une session valide et une conversation active, when je POST un message et que l'agent répond, then une ligne `chat_messages` est écrite pour le tour `user` PUIS pour le tour `assistant` (texte final), toutes deux rattachées au même `conversationId`, scopées à l'utilisateur courant, ordonnées (`created_at`), et invisibles pour un autre tenant. Test : persistance des deux rôles + rattachement au fil + ordre + isolement cross-tenant (2 users).
2. **CAP-3 — Serveur source de vérité du contexte.** Given une conversation persistée, when le client POST uniquement `{ conversationId, message }`, then `runAgentChat` charge les tours antérieurs via la porte scopée (jamais depuis le body) avant d'appeler le modèle, et un tour `assistant` fabriqué dans un body client ne peut plus entrer dans le contexte. Test : l'historique vient de la DB (un faux passé `assistant` dans le body n'influence pas la génération) + chargement scopé tenant (impossible de cibler le fil d'un autre user).
3. **CAP-2 — Reprise après reload.** Given une conversation de N échanges persistée, when je recharge la page ou ferme/rouvre le popup, then le popup affiche les tours `user`/`assistant` du fil depuis la DB (scopés, ordonnés, bornés au plus récent), et NON un fil vide. Test/démo : réhydratation depuis la DB après reload.
4. **CAP-5 — Rewind après reload.** Given un fil persisté contenant un tour ayant écrit (donc avec `turnId`), when je recharge et rouvre ce fil, then l'affordance « annuler ce tour » réapparaît sur ce tour (réhydratée via le `turn_id` stocké sur `chat_messages`), un clic rejoue les inverses d'`action_log` exactement comme en-session (parité inc.4, aucun hard-delete), et un tour read-only rechargé n'offre PAS de rewind. Test : réhydratation du `turnId` + rewind d'un tour rechargé annule ses mutations.

## Tasks / Subtasks

- [ ] **Tâche 1 — Schéma : tables `conversations` + `chat_messages` (AC: 1, 5)**
  - [ ] Ajouter les deux tables dans [`plume/src/lib/db/schema.ts`](../../plume/src/lib/db/schema.ts), en suivant le patron des tables existantes (PK `id` cuid2 via `$defaultFn(createId)`, `userId` text NOT NULL → `users` cascade, temps epoch ms `integer(..., { mode: "number" })` posé par l'horloge injectée — JAMAIS `Date.now()` en dur, colonnes SQL snake_case). Forme exacte = [data-model.md](../specs/spec-copilote-phase-3-historique-persistant/data-model.md).
    - `conversations` : `id`, `userId`, `titre` (text nullable), `archivedAt` (integer epoch ms nullable = soft-delete), `createdAt`, `updatedAt`.
    - `chat_messages` : `id`, `userId`, `conversationId` (text NOT NULL → `conversations`, cascade), `role` (`text().$type<"user" | "assistant">()`), `content` (text NOT NULL), `turnId` (text nullable — LIEN vers `action_log.turn_id`), `createdAt`.
  - [ ] Index : `(user_id, updated_at)` sur `conversations` (reprise du dernier fil) ; `(conversation_id, created_at)` sur `chat_messages` (lecture ordonnée).
  - [ ] Générer/écrire la migration en suivant l'outillage drizzle existant du projet (cf. dossier de migrations + config drizzle-kit). Ce sont des `CREATE TABLE` neufs (pas d'`ADD COLUMN` rétro-compatible à gérer). **TODO si l'outillage de migration n'est pas évident : demander, ne pas deviner** (norme « ne rien deviner »).
- [ ] **Tâche 2 — Repositories scopés `conversationsRepository` + `chatMessagesRepository` (AC: 1, 2, 3)**
  - [ ] Créer `plume/src/lib/db/conversation-repositories.ts` (zone autorisée `src/lib/db/**`), patron = [`action-log-repositories.ts`](../../plume/src/lib/db/action-log-repositories.ts) (factory `(scoped: ScopedDb) => …`, `scoped.insert`/`scoped.findMany`, `now(scoped.now)`). AUCUNE logique BDD ailleurs (Constraint SPEC).
  - [ ] `conversationsRepository` : `findLatestActive()` (le fil non archivé au `updated_at` le plus récent, ou `null`) ; `create({ firstUserMessage })` (pose `titre` = troncature déterministe du 1er message `user`, constante de longueur — AUCUN appel IA) ; `findById(id)` (scopé → `null` si pas au tenant courant) ; `touch(id)` (bump `updated_at`).
  - [ ] `chatMessagesRepository` : `append({ conversationId, role, content, turnId? })` ; `listForConversation(conversationId, { limit })` ordonné par `created_at` croissant — **la lecture qui alimente le modèle est BORNÉE** (fenêtre glissante sur les tours récents, constante serveur `MAX_CONTEXT_TURNS`, parité `MAX_MESSAGES = 50`) ; la persistance garde tout le fil, seul le contexte modèle est tronqué.
  - [ ] Câbler dans [`buildRepositories`](../../plume/src/lib/db/server.ts) (`server.ts`) + exporter via le barrel [`index.ts`](../../plume/src/lib/db/index.ts) (types inclus).
- [ ] **Tâche 3 — `runAgentChat` : contexte chargé serveur + persistance des 2 tours (AC: 1, 2, 3, 5)**
  - [ ] Changer la signature de [`runAgentChat`](../../plume/src/lib/agent/run.server.ts) de `{ userId, messages }` vers `{ userId, conversationId, message }` (+ ports injectables pour tests, cf. Tâche 6).
  - [ ] Au lieu de mapper le body client : **charger l'historique borné depuis la porte scopée** (`chatMessages.listForConversation(conversationId, { limit: MAX_CONTEXT_TURNS })`) → `ModelMessage[]`. Persister le tour `user` AVANT `streamText`.
  - [ ] Persister le tour `assistant` FINAL en fin de run : seam = `onFinish({ text })` de `streamText` (parité du calcul `didWrite`/`turnId` déjà fait). Renseigner `turnId` sur la ligne `assistant` **uniquement si le run a écrit** (réutiliser `didWrite` + le `turnId` déjà généré l.151). `touch(conversationId)` pour bumper `updated_at`.
  - [ ] **Retirer `selectTrustedTurns` du chemin de contexte** (il filtrait les tours du body — devenu inutile, le body ne porte plus l'historique). Ne JAMAIS recréer une dépendance au passé `assistant` fourni par le client (Constraint SPEC). La fonction peut être supprimée ou réduite à une défense résiduelle non câblée.
  - [ ] **Ne persister que `user` + texte `assistant` FINAL.** Les chips tool-use / étapes intermédiaires restent éphémères (non persistés). PAS de `sanitize()` sur `content` (frontière moat). Le transcript n'entre JAMAIS dans `seed_voix`/few-shot/`generation_events`.
- [ ] **Tâche 4 — Route `/api/agent/chat` : body `{ conversationId, message }` + validation ownership (AC: 1, 3)**
  - [ ] [`route.ts`](../../plume/src/app/api/agent/chat/route.ts) : remplacer le `bodySchema` par `z.object({ conversationId: z.string().trim().min(1).max(…).optional(), message: contentField })`. `conversationId` absent = 1er message d'un fil neuf (le serveur crée le fil, cf. Tâche 5).
  - [ ] **Vérifier l'appartenance** : si `conversationId` fourni, `gate.conversations.findById(conversationId)` → s'il n'appartient pas au tenant courant, **404/403** (jamais le fil d'autrui), aucune génération. `auth()` → 401 inchangé. Erreurs douces (jamais de stack/500). Retirer le `selectTrustedTurns` de la route.
- [ ] **Tâche 5 — Bootstrap + propagation du `conversationId` (AC: 2, 3, 5)**
  - [ ] Server action de bootstrap (ex. `bootstrapCopiloteAction`) : `auth()` → renvoie `{ conversationId, turns }` du fil actif (`findLatestActive` + `listForConversation` borné), ou `{ conversationId: null, turns: [] }` si aucun fil. Chaque `turn` assistant porte son `turnId` (pour CAP-5).
  - [ ] Création paresseuse : sur le 1er `send` avec `conversationId: null`, le serveur CRÉE le fil (titre = troncature du 1er message) et renvoie le nouveau `conversationId` **in-band** (part `message-metadata`, à côté de `didWrite`/`turnId`). Le client le RETIENT et le RENVOIE aux messages suivants ; le serveur le valide à chaque appel (Assumptions SPEC).
- [ ] **Tâche 6 — Réhydratation popup + stream-client (AC: 2, 5)**
  - [ ] [`CopiloteSheet.tsx`](../../plume/src/features/copilote/CopiloteSheet.tsx) : au 1er `open` (mount), appeler le bootstrap, mapper `turns` → `ChatItem[]` (`user`/`assistant`, texte final UNIQUEMENT — chips tool-use NON réhydratées). Pour chaque tour `assistant` avec `turnId`, poser une `RewindAffordance` (réutiliser le composant existant l.651). Stocker `conversationId` en state.
  - [ ] [`stream-client.ts`](../../plume/src/features/copilote/stream-client.ts) : `streamCopilote` n'envoie PLUS le tableau `messages` ; il envoie `{ conversationId, message }`. Lire le `conversationId` renvoyé in-band (part `message-metadata`) et le remonter au composant (nouveau callback, ex. `onConversation(id)`), pour que le popup le retienne. Supprimer la construction de `history`/`pushTurn` dans `send()` (l.272-283) — le serveur tient le contexte.
  - [ ] La sync héritée (`didWrite` → `router.refresh()`) et l'affordance rewind en-session restent INCHANGÉES.
- [ ] **Tâche 7 — Tests (AC: 1, 2, 3, 5)**
  - [ ] Harnais = db en mémoire via `scopedDb` (patron [`tests/agent/tools.test.ts`](../../plume/tests/agent/tools.test.ts)). Tests des repositories + de `runAgentChat` (modèle mocké) :
    - CAP-1 : `user` puis `assistant` persistés, même `conversationId`, ordre `created_at`, isolement cross-tenant (2 users — le fil du user B invisible pour A).
    - CAP-3 : l'historique envoyé au modèle vient de la DB ; un body `{ conversationId, message }` ne peut pas injecter de faux `assistant` (le mock capture les `ModelMessage` → ils correspondent au fil DB, pas au body) ; `findById` d'un fil d'un autre tenant → `null` (no-op, jamais de fuite).
    - CAP-2 : le bootstrap renvoie les tours du fil depuis la DB après « reload » (nouvelle instance de gate).
    - CAP-5 : `turnId` réhydraté depuis `chat_messages` ; rewind d'un tour rechargé annule ses mutations (réutiliser `replayRewind`/`rewindTurnAction`).
- [ ] **Tâche 8 — Vérification (parité phase 1)**
  - [ ] `cd plume && pnpm exec tsc --noEmit` → 0 erreur type.
  - [ ] `cd plume && pnpm exec eslint src/lib/db src/lib/agent src/app/api/agent src/features/copilote` → 0 violation (barrières : drizzle/schéma hors `src/lib/db/**`, `ai`/`@ai-sdk/*` server-only).
  - [ ] `cd plume && pnpm exec vitest run` → tests verts.

## Dev Notes

### Contexte & invariants (lire AVANT de coder)

- **Plume = pnpm/corepack.** En worktree neuf : `pwsh plume/scripts/setup-worktree.ps1` (lie `.env.local` au store central + `pnpm install`). `_bmad/` + `docs/` n'existent QUE dans le repo principal (absents des worktrees) → lire les specs via chemin absolu du repo principal. Cf. memory `plume-worktree-setup`.
- **`AGENTS.md` Plume** : « This is NOT the Next.js you know » — lire `node_modules/next/dist/docs/` avant d'écrire du code Next, héed les déprécations.
- **Persistance via la porte scopée UNIQUEMENT** (Archi #1, parité `action_log`/`contactsRepository`) : aucun `insert`/`update`/`select` drizzle direct dans le route handler, `runAgentChat` ou un tool. Toute table porte `user_id` → scoping AUTOMATIQUE par `db.forUser`. [Source: SPEC.md#Constraints]
- **Parité sécu phase 1/2 intégralement préservée** : modules `server-only`, barrières ESLint, `auth()` → 401 (ni lecture ni écriture de fil sans session), zod à la frontière (`conversationId` + `message` bornés), erreurs douces, route via `runAgentChat`, réponse via `toUIMessageStreamResponse` (`didWrite` + `turnId` in-band conservés). [Source: SPEC.md#Constraints]
- **`turnId` reste clos par closure** (SÉCU #3, inchangé inc.4) : généré serveur l.151 de `run.server.ts`, jamais argument agent. Le client ne fait que RETENIR/RENVOYER un `conversationId` que le serveur valide. La persistance n'ouvre AUCUN canal où le client contrôlerait `turnId` ou ciblerait le fil d'autrui. [Source: SPEC.md#Constraints]

### État actuel des fichiers MODIFIÉS (ce que la story change / préserve)

- **[`run.server.ts`](../../plume/src/lib/agent/run.server.ts)** : aujourd'hui `runAgentChat({ userId, messages })` mappe `selectTrustedTurns(messages)` → `ModelMessage[]`, `streamText({ model, system, messages, tools, stopWhen, onStepFinish→didWrite, onError })`, renvoie `toUIMessageStreamResponse({ messageMetadata(finish)→{didWrite,turnId?}, onError })`. **À préserver** : `MAX_STEPS=8`, `SYSTEM_PROMPT` (ajouter éventuellement une ligne sur la mémoire persistée mais NE PAS dénaturer), calcul `didWrite` via `WRITE_TOOL_NAMES`, `turnId = createId()` clos par closure, la métadonnée in-band. **À changer** : source du contexte (DB, pas body), ajout persistance user/assistant, signature.
- **[`route.ts`](../../plume/src/app/api/agent/chat/route.ts)** : aujourd'hui `auth()`→401, `bodySchema` union `{message}|{messages[]}`, `selectTrustedTurns`, délègue `runAgentChat({ userId, messages: trusted })`, catch `AgentConfigError`→503. **À préserver** : ordre auth→zod→délégation→erreurs douces, `runtime nodejs`/`dynamic force-dynamic`, bornes anti-DoS. **À changer** : body = `{ conversationId?, message }`, validation ownership du fil, plus de `selectTrustedTurns`.
- **[`CopiloteSheet.tsx`](../../plume/src/features/copilote/CopiloteSheet.tsx)** : front « bête », FSM 3-phases d'animation, `items: ChatItem[]` en-session, `send()` construit `history` (l.272-283) et appelle `streamCopilote`, `onWrite(turnId)` pose la `RewindAffordance`, `newConversation()` vide l'état. **À préserver** : toute l'animation/UX, `RewindAffordance`/`Bubble`/`ToolChip`, la sync `didWrite`→`router.refresh()`, le rewind en-session. **À changer** : réhydratation au mount (bootstrap), `conversationId` en state, `send` envoie `{conversationId, message}` (plus de `history`), réhydratation des `RewindAffordance` sur les tours rechargés avec `turnId`.
- **[`schema.ts`](../../plume/src/lib/db/schema.ts)** : 2 tables neuves à ajouter (cf. Tâche 1). **À préserver** : ne toucher à aucune table existante.

### Frontières à NE PAS franchir (rappels SPEC)

- **`chat_messages` ≠ `action_log`** (transcript vs mutations) ; le seul pont = `turn_id`. Ne pas fusionner. [Source: data-model.md#Notes]
- **`chat_messages` ≠ `messages` (outreach)** : le transcript copilote n'entre jamais dans le moat (few-shot, `generation_events`, `sanitize()`). [Source: data-model.md#Notes, SPEC.md#Constraints]
- **Titre = troncature déterministe du 1er message `user`** (constante de longueur), JAMAIS de génération IA. [Source: SPEC.md#Constraints]
- **Borne de contexte** (`MAX_CONTEXT_TURNS`, constante serveur nommée — parité `MAX_MESSAGES`/`MAX_CONTENT`) : un fil long est tronqué (fenêtre glissante sur les tours récents), jamais envoyé intégralement au modèle. [Source: SPEC.md#Constraints]
- **Pas de persistance de la timeline tool-use** ; seuls `user` + texte `assistant` final survivent. [Source: SPEC.md#Non-goals]

### Design system (finition préservée — `project-context.md`)

- Réhydratation = mêmes bulles (`Bubble`, `CopiloteMarkdown`) ; ne pas alourdir le popup ni casser l'UX « partout, jamais intrusif » (UX #1). Pas d'esthétique « app IA générique ». Erreurs en teinte douce, jamais rouge alarme. Mauve = action seule. [Source: project-context.md#Design-system, SPEC.md#Constraints]

### Notes techniques AI SDK v6

- `streamText` (ai 6.0.x) expose `onFinish({ text, … })` (texte final agrégé) et `onStepFinish` (déjà utilisé pour `didWrite`). Persister l'`assistant` dans `onFinish` est le seam naturel (l'appelant a déjà `conversationId` + la porte en closure). `toUIMessageStreamResponse({ messageMetadata })` peut porter le `conversationId` neuf in-band sur la part `finish` (à côté de `didWrite`/`turnId`). [Source: spec-copilote-phase-1-agent-chat.md#Design-Notes]
- Injecter la porte/les repositories dans `runAgentChat` (comme `model`/`tools` le sont déjà) → tests avec `scopedDb` en mémoire, sans I/O réel.

### Project Structure Notes

- Nouveaux fichiers : `plume/src/lib/db/conversation-repositories.ts`, une migration drizzle, éventuellement `plume/src/features/copilote/bootstrap.actions.ts` (server action). Tests sous `plume/tests/…` (parité `tests/agent/`).
- Câblage obligatoire : `server.ts` (`buildRepositories` + `ScopedRepositories` type) ET `index.ts` (barrel) — sinon la porte n'expose pas les nouveaux repos.

### References

- [Source: docs/specs/spec-copilote-phase-3-historique-persistant/SPEC.md] — CAP-1/2/3/5, Constraints, Assumptions, Non-goals.
- [Source: docs/specs/spec-copilote-phase-3-historique-persistant/data-model.md] — forme des tables + index + frontières.
- [Source: docs/specs/spec-copilote-phase-3-historique-persistant/architecture-diagrams.md] — flux serveur (contexte chargé DB) + reprise reload.
- [Source: docs/implementation-artifacts/spec-copilote-phase-1-agent-chat.md] — `runAgentChat`, `selectTrustedTurns`, scope clos par closure, AI SDK v6, harnais de test.
- [Source: docs/specs/spec-copilote-phase-2-rewind/SPEC.md] — `action_log` + `turnId` (CAP-5 s'y branche).
- [Source: docs/specs/spec-copilote-phase-2-ui-sync/SPEC.md] — popup + sync `didWrite` hérités.
- [Source: docs/project-context.md] — design-system, scoping `user_id`, server-only, frontière moat.
- [Source: docs/implementation-artifacts/deferred-work.md] — dette « valider/signer les tours `assistant` côté serveur » soldée par CAP-3.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
