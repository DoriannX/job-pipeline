# Story Copilote Phase 3-B : Multi-fils + rétention bornée (CAP-4, CAP-6)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- DÉPEND de la story 3-A (tables `conversations`+`chat_messages`, repositories scopés, bootstrap,
     réhydratation popup). Purement ADDITIF sur 3-A : ne réécrit rien de 3-A. Lignée copilote
     `spec-copilote-phase-N` ; non ajoutée à sprint-status (epic-3 déjà `done`). -->

## Story

As **Monsieur (l'utilisateur de Plume)**,
I want **gérer mes fils de conversation copilote depuis le popup — démarrer une nouvelle conversation, voir la liste de mes fils passés, en rouvrir un, le renommer, l'archiver — avec une rétention bornée qui purge en soft les plus vieux fils**,
so that **je retrouve et j'organise mes discussions sans jamais rien perdre physiquement, et que le coût DB reste contenu**.

## Acceptance Criteria

> Source canonique : [SPEC.md](../specs/spec-copilote-phase-3-historique-persistant/SPEC.md). Cette story livre CAP-4 et CAP-6.

1. **CAP-4 — Multi-fils complet, scopé.** Given plusieurs fils persistés, when j'ouvre la liste des conversations, then j'y vois mes fils (titre + récence, scopés à moi seul), je peux : en rouvrir un (son transcript se recharge — réutilise la réhydratation 3-A) ; le renommer (le nouveau titre persiste) ; l'archiver (soft-delete `archivedAt` → il sort des lectures, jamais de hard-delete) ; créer une nouvelle conversation (nouveau `conversationId`, popup vide) sans toucher les autres. Test : liste scopée (aucun fil d'un autre tenant), réouverture, renommage persistant, archivage soft, et qu'AUCUNE opération n'écrase ni ne supprime physiquement un fil.
2. **CAP-6 — Rétention bornée, soft.** Given un tenant dont le nombre de fils (ou l'ancienneté d'un fil) dépasse le seuil retenu, when la borne s'applique (à l'écriture d'un nouveau fil ou à un balayage), then les fils excédentaires/les plus vieux passent à `archivedAt` (sortis des lectures), AUCUN n'est hard-deleté, et les fils sous le seuil sont intacts. Test : déclenchement au seuil, sélection des plus anciens (par `updated_at`), absence de `DELETE` physique. Seuil = constante serveur explicite.

## Tasks / Subtasks

- [ ] **Tâche 1 — Repositories : méthodes multi-fils + purge (AC: 1, 2)**
  - [ ] Étendre `conversationsRepository` (créé en 3-A, `plume/src/lib/db/conversation-repositories.ts`) — patron [`action-log-repositories.ts`](../../plume/src/lib/db/action-log-repositories.ts), AUCUNE logique BDD hors `src/lib/db/**` :
    - `listActive()` : fils du tenant NON archivés, ordonnés `updated_at` desc, projection légère (`id`, `titre`, `updatedAt`). La porte exclut déjà `archived_at IS NULL` (parité contacts) — vérifier que les lectures de liste l'appliquent.
    - `rename(id, titre)` : écrase `titre` par celui de l'utilisateur (borné, cf. Tâche 3). Scopé → no-op silencieux si le fil n'est pas au tenant.
    - `archive(id)` : pose `archivedAt` (epoch ms via horloge injectée). **SOFT only, jamais `DELETE`.** Scopé.
    - `purgeBeyondThreshold()` (CAP-6) : si le nombre de fils actifs du tenant dépasse `MAX_CONVERSATIONS_PER_TENANT` (et/ou ancienneté > `MAX_CONVERSATION_AGE_MS`), passe les plus vieux (par `updated_at` croissant) à `archivedAt` — **SOFT, jamais `DELETE`**, et ne touche jamais un fil sous le seuil.
  - [ ] Déclencher `purgeBeyondThreshold()` à l'écriture d'un nouveau fil (dans `create`, ou juste après, côté serveur) — parité « borne appliquée par la porte/un repository ». [Source: SPEC.md#Constraints]
- [ ] **Tâche 2 — Server actions de gestion des fils (AC: 1)**
  - [ ] `plume/src/features/copilote/conversations.actions.ts` (server actions) : `listConversationsAction()`, `renameConversationAction(id, titre)`, `archiveConversationAction(id)`. Patron = [`rewind.actions.ts`](../../plume/src/features/copilote/rewind.actions.ts) : `"use server"`, `auth()` → rejet doux sans session, accès via `forUser(userId)` (jamais drizzle/schéma direct), erreurs DOUCES (jamais stack/500). La porte scopée garantit par CONSTRUCTION qu'on ne touche que ses propres fils.
  - [ ] Réouverture d'un fil = réutiliser le bootstrap/chargement de 3-A (`listForConversation` borné) — PAS de nouveau chemin de lecture.
- [ ] **Tâche 3 — Validation (AC: 1)**
  - [ ] Zod à la frontière des actions : `id` (string borné), `titre` (`z.string().trim().min(1).max(…)`) — parité bornes anti-DoS. Le titre renommé ne passe PAS par `sanitize()` (frontière moat — c'est du transcript, pas du corpus d'outreach).
- [ ] **Tâche 4 — UI gestion des fils dans le popup (AC: 1)**
  - [ ] [`CopiloteSheet.tsx`](../../plume/src/features/copilote/CopiloteSheet.tsx) : ajouter une vue « liste des fils » (bascule depuis l'en-tête du popup) affichant `titre` + récence. Actions par fil : rouvrir (charge le transcript, bascule en vue conversation), renommer (édition inline → `renameConversationAction`), archiver (→ `archiveConversationAction`, le fil sort de la liste). Le bouton « nouvelle conversation » existant (l.512-522, icône `edit`) crée un fil neuf (`conversationId` → `null`, popup vide — la création paresseuse de 3-A pose le fil au 1er message).
  - [ ] **Design-system (`project-context.md`)** : Fraunces + Quicksand, contour plein + hard offset (blur 0), **mauve = action seule** (« nouvelle conversation » = action → mauve ; archiver/renommer = secondaire, ghost menthe). Erreurs en teinte douce, jamais rouge alarme. Doublage a11y (tout signal couleur doublé d'un label). Ne pas alourdir le popup ni casser l'UX « partout, jamais intrusif » (UX #1). Rayons/espacements de l'échelle figée (4/8/12/16/22/24). [Source: SPEC.md#Constraints, project-context.md]
  - [ ] Sync : après rename/archive, rafraîchir la liste (relire via l'action, ou `router.refresh()` — réutiliser le levier existant, AUCUN nouveau mécanisme de sync).
- [ ] **Tâche 5 — Tests (AC: 1, 2)**
  - [ ] Harnais db en mémoire (`scopedDb`, patron [`tests/agent/tools.test.ts`](../../plume/tests/agent/tools.test.ts)) :
    - CAP-4 : `listActive` scopé (le fil du user B invisible pour A) ; réouverture recharge le bon transcript ; `rename` persiste le nouveau titre ; `archive` pose `archivedAt` et le fil sort des lectures (liste comprise) ; nouvelle conversation = `conversationId` distinct, n'altère pas les autres ; AUCUN `DELETE` physique (le fil archivé existe toujours en base).
    - CAP-6 : au-delà du seuil, `purgeBeyondThreshold` archive les plus vieux (sélection par `updated_at`), les fils sous le seuil intacts, AUCUN `DELETE` physique ; idempotent (rejouer ne sur-archive pas).
- [ ] **Tâche 6 — Vérification (parité phase 1)**
  - [ ] `cd plume && pnpm exec tsc --noEmit` → 0 erreur.
  - [ ] `cd plume && pnpm exec eslint src/lib/db src/features/copilote` → 0 violation (barrières drizzle/schéma + server-only).
  - [ ] `cd plume && pnpm exec vitest run` → tests verts.

## Dev Notes

### Pré-requis & contexte

- **DÉPEND de 3-A** : tables `conversations`+`chat_messages`, `conversationsRepository`/`chatMessagesRepository`, bootstrap, réhydratation popup, propagation `conversationId`. Ne PAS re-créer ces fondations — les étendre.
- **Plume = pnpm/corepack** ; worktree neuf : `pwsh plume/scripts/setup-worktree.ps1`. `_bmad/`+`docs/` repo principal seulement (lire specs via chemin absolu si worktree). Cf. memory `plume-worktree-setup`. `AGENTS.md` Plume : lire `node_modules/next/dist/docs/` avant code Next.
- **Accès données via la porte scopée UNIQUEMENT** (Archi #1) : aucun drizzle/schéma direct dans une action ou le popup ; tout via `forUser(userId)` → repositories. [Source: SPEC.md#Constraints]

### Réversibilité / soft-delete (non négocié)

- **L'archivage d'un fil (CAP-4) ET la purge de rétention (CAP-6) sont SOFT** (`archivedAt`), jamais un hard-delete. Le filtrage par la porte exclut les fils archivés des lectures (liste comprise). AUCUN `DELETE` physique d'un fil ou d'un message. C'est l'invariant testé le plus important de cette story. [Source: SPEC.md#Constraints, data-model.md#Notes]
- Parité exacte avec le soft-delete des `contacts` (`archived_at`, cf. [`schema.ts`](../../plume/src/lib/db/schema.ts) l.151-155) et des `messages` (l.314-321).

### Rétention bornée (CAP-6)

- Seuil = **constante serveur explicite et nommée** (`MAX_CONVERSATIONS_PER_TENANT` et/ou `MAX_CONVERSATION_AGE_MS`), parité `MAX_MESSAGES`/`MAX_HISTORIQUE` (borne nommée, pas magique). Valeur exacte = réglage produit/coût, à trancher au dev et ajustable — le contrat exige seulement qu'une borne EXISTE et que la purge soit SOFT. [Source: SPEC.md#Constraints, SPEC.md#Assumptions]
- Sélection des plus anciens via `updated_at` croissant. [Source: data-model.md#Notes]

### État actuel des fichiers MODIFIÉS

- **[`CopiloteSheet.tsx`](../../plume/src/features/copilote/CopiloteSheet.tsx)** : popup front « bête », un seul fil en-session aujourd'hui. Bouton « nouvelle conversation » existant l.512-522 (`newConversation()` l.154-163 vide l'état — à recâbler vers la création de fil neuf de 3-A). **À préserver** : toute l'animation 3-phases, `Bubble`/`ToolChip`/`RewindAffordance`, sync `didWrite`. **À ajouter** : vue liste + actions par fil.
- **[`rewind.actions.ts`](../../plume/src/features/copilote/rewind.actions.ts)** : patron canonique des server actions du copilote (auth → `forUser` → erreurs douces → sync héritée). **Ne pas modifier** — l'imiter pour `conversations.actions.ts`.

### Frontières moat (rappel)

- Le transcript copilote (titres inclus) n'entre JAMAIS dans `seed_voix`/few-shot/`generation_events` et n'est PAS soumis à `sanitize()`. [Source: SPEC.md#Constraints, data-model.md#Notes]

### Non-goals (ne PAS implémenter)

- Pas de recherche plein-texte / filtrage dans les fils. Pas d'édition/suppression d'un message individuel. Pas de partage/export dédié (Privacy global = Epic 5). Pas de sync temps réel multi-device. Pas de titres générés par IA. [Source: SPEC.md#Non-goals]

### Project Structure Notes

- Nouveau fichier : `plume/src/features/copilote/conversations.actions.ts`. Extension de `conversation-repositories.ts` (3-A). Tests sous `plume/tests/…`.
- Vérifier que les nouvelles méthodes repo sont bien atteignables via la porte (`server.ts`/`index.ts` câblés en 3-A).

### References

- [Source: docs/specs/spec-copilote-phase-3-historique-persistant/SPEC.md] — CAP-4/6, Constraints (soft-delete, rétention, titre, moat), Non-goals, Assumptions.
- [Source: docs/specs/spec-copilote-phase-3-historique-persistant/data-model.md] — `archived_at` (soft) + sélection des plus anciens par `updated_at` + index `(user_id, updated_at)`.
- [Source: docs/project-context.md] — design-system (mauve = action, soft tints, a11y, échelle figée), scoping `user_id`, server-only.
- [Source: plume/src/features/copilote/rewind.actions.ts] — patron server action copilote.
- [Source: plume/src/lib/db/schema.ts] — patron soft-delete `archived_at` (contacts l.151-155, messages l.314-321).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
