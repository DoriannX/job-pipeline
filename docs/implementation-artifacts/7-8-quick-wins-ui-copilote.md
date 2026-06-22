# Story 7.8: Quick-wins UI copilote — F7 / F9 / F12 / F14

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur du copilote (dogfood),
I want que l'historique de chat soit **lisible** (markdown rendu, locuteur identifié), que le composeur ne **prête pas à confusion** (pas d'affordance de génération en double), et que le copilote ne **rouvre pas un fil tout seul** au refresh,
so that la surface IA quotidienne reste claire et non intrusive — sans toucher au moteur (persistance, génération) déjà livré.

## Contexte (dogfood 2026-06-21, findings F7/F9/F12/F14)

Quatre **quick-wins UI** issus du compte-rendu dogfood. Aucun ne touche l'IA, la persistance ni les write-tools — pur **rendu / câblage UI**. Surface unique : `src/features/copilote/CopiloteSheet.tsx`, `CopiloteMarkdown.tsx`, et `src/features/composer/ComposerSheet.tsx`. **Aucune migration, aucun changement de schéma, aucun nouveau tool.**

⚠️ **État du code à vérifier avant de coder** — depuis le dogfood (06-21), trois PR ont mergé sur `dev` (7-6 #30, 7-4 #31, 7-1 #32) **sans toucher** `CopiloteSheet`/`ComposerSheet`. Mais un fix antérieur (`2c79fa7`, sur `dev`) a retravaillé `CopiloteMarkdown` (liens internes en navigation soft). L'analyse statique suggère que **F7 est peut-être déjà satisfait** et que **F12 ne correspond plus au symptôme décrit** (cf. Dev Notes). **Chaque sous-item commence par une vérification empirique de l'état réel** (lancer l'app, recharger, observer) avant toute modification — on ne « refait » pas ce qui marche, on **verrouille** et on **comble** seulement les vrais trous.

## Acceptance Criteria

### F7 — Markdown des tours réhydratés (liens fiches cliquables après reload)

1. **Given** une conversation copilote persistée contenant une réponse assistant en markdown avec un lien interne (ex. `[Voir la fiche](/reseau/<id>)`)
   **When** l'utilisateur recharge la page puis rouvre ce fil (bootstrap **ou** réouverture explicite via l'historique)
   **Then** le tour réhydraté est rendu en **markdown** (gras/listes/liens), pas en texte brut, **via le même composant** que le stream live (`CopiloteMarkdown`), et le lien interne est **cliquable** et navigue en **soft** (sans rechargement, popup préservé).

2. **Given** que l'analyse du code indique que `mapTurns` → `Bubble` route déjà les tours assistant réhydratés à travers `CopiloteMarkdown`
   **When** la vérification empirique confirme que F7 est **déjà satisfait**
   **Then** aucune régression n'est introduite et un **garde anti-régression** est posé (cf. Tasks — au minimum un test sur la fonction pure de mapping si extractible, sinon une note de vérification manuelle documentée dans le Dev Agent Record). Si un **gap réel** subsiste (un chemin de rendu réhydraté qui n'emprunte pas `CopiloteMarkdown`), il est corrigé pour router vers `CopiloteMarkdown`.

### F9 — Label de locuteur dans le chat

3. **Given** le fil de chat copilote (tours `user` et `assistant`, en stream **et** réhydratés)
   **When** il est affiché
   **Then** chaque tour porte une **attribution lisible** : « Moi » pour `user`, « Copilote » pour `assistant`, en plus de la distinction visuelle existante (alignement + mascotte). La donnée `role`/`kind` est déjà présente — c'est du rendu.

4. **Given** le doublage a11y obligatoire (project-context : « la couleur n'est jamais le seul signal »)
   **When** le label est ajouté
   **Then** il respecte le design-system (typo Quicksand `font-body`, teintes douces, **pas** de rouge, pas d'emoji en icône) et reste discret (ne casse pas la densité du fil).

### F12 — Affordance de génération en double dans le composeur

5. **Given** la barre d'actions du composeur (`ComposerSheetPanel`)
   **When** l'utilisateur l'observe
   **Then** il n'existe **qu'une seule** affordance de **génération** (le bouton primaire « ✦ Générer ») ; aucune **deuxième** affordance ne déclenche **la même action `generer`**. L'action **« Améliorer »** (distincte, mode `improve`, `double-sparkle`) **est préservée** — elle n'est PAS un doublon de Générer.

6. **Given** la suppression éventuelle d'une affordance redondante
   **When** elle est retirée
   **Then** **aucun handler/état** n'est laissé orphelin (vérifier qu'aucun `onClick`/state n'était câblé uniquement sur l'icône supprimée). Si la vérification montre qu'**aucun vrai doublon de `generer` n'existe plus** (cf. Dev Notes : le symptôme dogfood ne correspond plus au code actuel), F12 est clôturé comme **déjà résolu / caduc** avec note explicite — **sans inventer** de suppression qui amputerait « Améliorer ».

### F14 — Pas de réhydratation auto au refresh

7. **Given** une conversation active persistée
   **When** l'utilisateur recharge la page **et ouvre** le copilote
   **Then** le copilote s'ouvre **vide** (nouveau fil), **aucun** fil n'est rouvert d'office : la réhydratation automatique au 1er dépliage (`useEffect` bootstrap, `CopiloteSheet.tsx:464-482`) est **coupée**.

8. **Given** que le fil reste persisté en DB (la persistance N'EST PAS en cause)
   **When** l'utilisateur veut reprendre un ancien fil
   **Then** il le rouvre **uniquement** par **sélection explicite** dans l'historique multi-fils (`ThreadListView` → `openThread`, déjà existant) — ce chemin reste pleinement fonctionnel (réhydratation markdown incluse, cf. F7).

9. **Given** le retrait du bootstrap auto
   **When** plus aucun appel n'en dépend
   **Then** le code mort associé est nettoyé proprement (la server action `bootstrapCopiloteAction` n'est supprimée **que** si plus aucun appelant ne subsiste ; sinon laisser un TODO explicite) — `pnpm lint`/`typecheck` restent verts.

## Tasks / Subtasks

- [ ] **Task 0 — Vérification empirique de l'état réel** (AC: #1, #2, #5, #6) — *préalable obligatoire, « ne rien deviner »*
  - [ ] Lancer l'app (preview) avec une conversation copilote persistée. Recharger, rouvrir le fil → **observer** si le markdown réhydraté est rendu et les liens cliquables (F7). Noter le verdict dans le Dev Agent Record.
  - [ ] Observer la barre du composeur → **cliquer** les deux affordances soupçonnées (icône gauche `double-sparkle` « Améliorer » vs bouton « Générer ») et confirmer si elles font la **même** action ou non (F12).
- [ ] **Task 1 — F9 : label de locuteur** (AC: #3, #4)
  - [ ] Dans `Bubble` ([CopiloteSheet.tsx:1095-1133](../../plume/src/features/copilote/CopiloteSheet.tsx)), ajouter un label « Moi » (kind `user`) / « Copilote » (kind `assistant`) au design-system. Centraliser les libellés dans [lib/copy.ts](../../plume/src/lib/copy.ts) si cohérent avec l'existant.
  - [ ] S'assurer que le label apparaît **aussi** sur les tours réhydratés (même composant `Bubble`, donc gratuit) et sur le stream live.
- [ ] **Task 2 — F14 : couper la réhydratation auto** (AC: #7, #8, #9)
  - [ ] Retirer/neutraliser le `useEffect` de bootstrap ([CopiloteSheet.tsx:464-482](../../plume/src/features/copilote/CopiloteSheet.tsx)) : à l'ouverture, popup **vide** (nouveau fil) — ne plus appeler `bootstrapCopiloteAction()` au 1er dépliage.
  - [ ] Vérifier que `openThread` (réouverture explicite, l.359-375) et `showThreadList`/`refreshThreads` (l.342-355) restent intacts : la reprise via historique fonctionne (réhydratation markdown via `mapTurns`).
  - [ ] Nettoyer le code mort : `bootstrappedRef`, et `bootstrapCopiloteAction` ([bootstrap.actions.ts](../../plume/src/features/copilote/bootstrap.actions.ts)) **si** plus aucun appelant. Sinon TODO explicite + trace `deferred-work.md`.
- [ ] **Task 3 — F7 : verrouiller / combler** (AC: #1, #2)
  - [ ] Selon le verdict Task 0 : si déjà rendu → poser un garde anti-régression (test sur le mapping pur si extractible, sinon note de vérif manuelle). Si gap → router le chemin réhydraté fautif vers `CopiloteMarkdown`.
- [ ] **Task 4 — F12 : retirer le vrai doublon (le cas échéant)** (AC: #5, #6)
  - [ ] Selon le verdict Task 0 : s'il existe une **vraie** 2ᵉ affordance déclenchant `generer`, la retirer ([ComposerSheet.tsx:723-760](../../plume/src/features/composer/ComposerSheet.tsx)) en **préservant** « Améliorer », « Copier », « Marquer envoyé ». Vérifier l'absence de handler orphelin.
  - [ ] Sinon, clôturer F12 comme **déjà résolu / caduc** (note dans le Dev Agent Record + mention de la tension pivot, cf. Dev Notes). **Ne pas** supprimer « Améliorer ».
- [ ] **Task 5 — Garde-fous** (AC: tous)
  - [ ] `pnpm lint` + `pnpm typecheck` verts (mode strict, 3 barrières ESLint). `pnpm test` : suite existante inchangée (aucun test UI n'existe pour cette surface — cf. Testing standards).
  - [ ] Vérif preview finale : reload → copilote fermé/vide ; ouverture → vide ; historique → reprise OK avec markdown + liens cliquables ; labels visibles ; composeur sans doublon de Générer.

## Dev Notes

### État actuel du code (analyse statique — à confirmer empiriquement, Task 0)
- **F7** : `mapTurns` ([CopiloteSheet.tsx:316-338](../../plume/src/features/copilote/CopiloteSheet.tsx)) crée des items `{ kind:"assistant", content: turn.content }` ; `Bubble` (l.1124-1132) rend l'assistant via `<CopiloteMarkdown content={item.content} />` — **le même composant** que le stream live (l.1129). Les liens internes naviguent en **soft** (`router.push`, [CopiloteMarkdown.tsx:107-151](../../plume/src/features/copilote/CopiloteMarkdown.tsx), fix `2c79fa7`). → **F7 paraît déjà satisfait** ; le but de cette story est de **confirmer + verrouiller**, pas de réécrire.
- **F9** : `Bubble` distingue `user` (droite, `bg-surface-chip`) / `assistant` (gauche, mascotte `Plume name="feather"`, `bg-surface-note`) mais **aucun label textuel**. Donnée `kind` dispo. Ajout pur d'UI.
- **F12** : la barre ([ComposerSheet.tsx:723-760](../../plume/src/features/composer/ComposerSheet.tsx)) = `double-sparkle` « Améliorer » (`ameliorer`, mode improve) · `copy` · `check` · bouton primaire `sparkle` « Générer » (`generer`). Le dogfood décrivait **deux affordances déclenchant exactement `generer`** ; le code actuel montre une icône gauche câblée sur **`ameliorer`** (action **distincte**). → soit le doublon a déjà disparu, soit le testeur a confondu l'icône « Améliorer » avec un 2ᵉ « Générer ». **Trancher en Task 0** ; ne pas amputer « Améliorer ».
- **F14** : `useEffect` ([CopiloteSheet.tsx:464-482](../../plume/src/features/copilote/CopiloteSheet.tsx)) appelle `bootstrapCopiloteAction()` au 1er `expanded` et réaffiche le dernier fil actif → **c'est le comportement intrusif à couper**. L'état initial est déjà `phase="closed"` / `conversationId=null` (l.105, 114) → le retrait du bootstrap suffit pour « ouvre vide ».

### Tension pivot (décision produit déjà tranchée — appliquer, ne pas rouvrir)
- Le compte-rendu (l.162) note que **F12 et F13 appartiennent au composeur one-shot**, que le pivot conversationnel (Epic 7) **déprécie** (« copilote = toute l'IA, app = tout le manuel » — cf. mémoire `copilote-pivot-conversationnel`). `ComposerSheet` reste **monté** dans [layout.tsx:35](../../plume/src/app/(app)/layout.tsx) à ce stade (7-1 a migré la génération **dans** le copilote mais n'a pas retiré le composeur one-shot).
- **Posture pour cette story** : F12 est un **nettoyage UI borné** du composeur tel qu'il existe aujourd'hui. On ne décide PAS ici de supprimer le composeur one-shot (hors scope — autre story/décision). On retire un **vrai doublon** s'il existe, sinon on clôt F12 caduc. Aucune régression du chemin « Améliorer/Copier/Marquer envoyé ».

### Fichiers à toucher
- **[plume/src/features/copilote/CopiloteSheet.tsx](../../plume/src/features/copilote/CopiloteSheet.tsx)** — `Bubble` (label F9), `useEffect` bootstrap (couper F14), `bootstrappedRef`.
- **[plume/src/features/composer/ComposerSheet.tsx](../../plume/src/features/composer/ComposerSheet.tsx)** — barre d'actions (F12, le cas échéant).
- **Lecture seule (comprendre, ne pas modifier sauf gap F7)** : [CopiloteMarkdown.tsx](../../plume/src/features/copilote/CopiloteMarkdown.tsx), [bootstrap.actions.ts](../../plume/src/features/copilote/bootstrap.actions.ts) (supprimer **seulement** si plus d'appelant), [conversations.actions.ts](../../plume/src/features/copilote/conversations.actions.ts) (`openThread` doit rester), [lib/copy.ts](../../plume/src/lib/copy.ts) (libellés).

### Invariants & barrières (NON négociables — project-context.md)
- **UI, microcopy ET commentaires de code = français.** Pas de fallback anglais.
- **Design-system strict** : Quicksand/Fraunces (jamais Inter/système/emoji en icône) ; mauve = **action uniquement** ; contours pleins + hard offset (flou box-shadow = 0) ; espacement figé `4/8/12/16/22/24`. Erreurs en teinte douce, **jamais de rouge**.
- **Doublage a11y** : tout signal de couleur doublé par texte/label (F9 va exactement dans ce sens).
- **Pas de nouveau mécanisme de sync** : F14 ne fait que **retirer** un déclencheur ; ne pas inventer d'état global. La reprise explicite (`openThread`) et `router.refresh` existants suffisent.
- **Scope tenant** : `bootstrapCopiloteAction`/`listConversationsAction`/`openConversationAction` sont déjà scopées `forUser` — ne pas dé-scoper en touchant au câblage.

### Testing standards
- Runner : **Vitest** (`pnpm test` dans `plume/`). **Aucun test UI** n'existe pour `CopiloteSheet`/`CopiloteMarkdown`/`ComposerSheet` (composants React client, hors scope vitest actuel — cf. `tests/agent/*`, `tests/db/*`).
- Conséquence : la **Definition of done** de cette story repose sur (1) `pnpm lint` + `pnpm typecheck` verts, (2) la **suite existante inchangée et verte**, (3) **vérification preview** documentée dans le Dev Agent Record (reload/ouverture/historique/labels/composeur). Si une fonction **pure** est extractible (ex. mapping de label par `kind`), ajouter un test unitaire ciblé ; sinon ne pas forcer un harnais UI hors-scope.

### Project Structure Notes
- Tout est intra-feature (`features/copilote`, `features/composer`) + `lib/copy.ts`. **Aucune migration, aucun schéma, aucun nouveau tool, aucune frontière `.server.ts`/`domain/` touchée.** Rayon de blast minimal — c'est l'esprit « quick-wins ».

### References
- [Source: docs/implementation-artifacts/compte-rendu-test-dogfood-copilote.md#F7] — markdown réhydraté brut, liens fiches non cliquables après reload.
- [Source: docs/implementation-artifacts/compte-rendu-test-dogfood-copilote.md#F9] — pas de label de locuteur ; `role` déjà persisté.
- [Source: docs/implementation-artifacts/compte-rendu-test-dogfood-copilote.md#F12] — « deux Générer redondants » ; fix = retirer l'icône gauche, garder le bouton rose.
- [Source: docs/implementation-artifacts/compte-rendu-test-dogfood-copilote.md#F14] — refresh : copilote fermé/vide ; couper CAP-2 ; reprise sur sélection explicite.
- [Source: docs/implementation-artifacts/compte-rendu-test-dogfood-copilote.md (l.162)] — F12/F13 = composeur one-shot, possiblement caducs post-pivot.
- [Source: docs/planning-artifacts/epics.md#Story 7.8] — stub des 4 quick-wins.
- [Source: plume/src/features/copilote/CopiloteSheet.tsx:316-338,464-482,1095-1133] — mapTurns, bootstrap useEffect, Bubble.
- [Source: plume/src/features/copilote/CopiloteMarkdown.tsx:100-160] — rendu markdown + liens soft (fix 2c79fa7).
- [Source: plume/src/features/composer/ComposerSheet.tsx:723-760] — barre d'actions du composeur.
- [Source: docs/project-context.md] — design-system, a11y, FR-only, scope tenant.

## Dev Agent Record

### Agent Model Used
claude-opus-4-8 (story-pilot autonome)

### Debug Log References
- `pnpm typecheck` (tsc --noEmit) : vert.
- `pnpm lint` (eslint .) : vert, 0 finding.
- `pnpm test` (vitest run) : **472 tests / 37 fichiers, tous verts** (suite existante inchangée).
- Vérif preview (dev login `Connexion dev (sans Google)`, localhost:3000) — voir Completion Notes.

### Completion Notes List
- **F9 (label locuteur) — IMPLÉMENTÉ.** Ajout des labels « Moi » (kind `user`) / « Copilote » (kind `assistant`) dans `Bubble` ([CopiloteSheet.tsx](../../plume/src/features/copilote/CopiloteSheet.tsx)), `font-body text-label text-ink-hint`, doublant le signal visuel (alignement/mascotte) — a11y. **Vérifié preview** : labels visibles sur les tours en stream live ET réhydratés.
- **F14 (refresh fermé/vide) — IMPLÉMENTÉ.** Retrait du `useEffect` de réhydratation auto (appel `bootstrapCopiloteAction` au 1er dépliage) + `bootstrappedRef`. Suppression de la fonction `bootstrapCopiloteAction` (plus aucun appelant) dans [bootstrap.actions.ts](../../plume/src/features/copilote/bootstrap.actions.ts) ; **types `BootstrapTurn`/`BootstrapResult` conservés** (servent `mapTurns` + `openConversationAction`), imports/`"use server"` inutiles retirés. **Vérifié preview** : après reload, copilote vide (hint d'accueil), aucun fil rouvert d'office ; réouverture explicite via « Mes conversations » → `openThread` fonctionne (fil rechargé, labels + markdown).
- **F7 (markdown réhydraté + liens) — DÉJÀ SATISFAIT, verrouillé.** `mapTurns` → `Bubble` → `CopiloteMarkdown` (chemin partagé avec le stream live) + soft-nav des liens internes (`CopiloteMarkdown`, fix `2c79fa7` sur `dev`). **Vérifié preview** : fil réhydraté rouvert rend le markdown (`<strong>` présent), même chemin que le live. Les liens `/reseau/<id>` n'apparaissent que si le modèle les émet (Gemini dev ne les a pas produits dans le fil de test) — mais le chemin de rendu/navigation est identique et en place. Aucune modif de code nécessaire ; garde anti-régression = la vérif preview documentée (pas de harnais UI Vitest, hors-scope).
- **F12 (doublon Générer) — CADUC / DÉJÀ RÉSOLU.** Le code actuel ne contient PAS deux affordances déclenchant `generer` : l'icône gauche du composeur est câblée sur **`ameliorer`** (mode improve, action **distincte**), le bouton primaire sur `generer`. Le symptôme dogfood (« deux boutons → exactement la même action ») ne correspond plus au code. **Aucune suppression** (retirer l'icône gauche amputerait « Améliorer »). F12 clôturé sans changement de code, conformément à la note dogfood (l.162 : composeur one-shot déprécié par le pivot).
- **Code laissé en l'état (justifié, hors-scope)** : `findLatestActive` ([conversation-repositories.ts](../../plume/src/lib/db/conversation-repositories.ts)) n'a plus d'appelant après F14 mais reste une capacité légitime du repository (surface lib, pas de churn DB pour un quick-win UI). Non supprimé volontairement.

### File List
- `plume/src/features/copilote/CopiloteSheet.tsx` (modifié — F9 labels, F14 retrait bootstrap useEffect + bootstrappedRef + import)
- `plume/src/features/copilote/bootstrap.actions.ts` (modifié — suppression fonction `bootstrapCopiloteAction`, types conservés)
