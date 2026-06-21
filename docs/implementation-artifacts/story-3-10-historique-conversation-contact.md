---
baseline_commit: 2cb867c5e148113f1046f3ca4e94f963580ee885
---

# Story 3.10: Historique de conversation du Contact → génération en continuité

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur,
I want attacher l'historique brut de mes échanges passés avec un Contact,
so that le message généré tienne compte du passé et réponde juste (en continuité, pas hors-sol).

## Acceptance Criteria

1. **Saisie & persistance** — La fiche Contact et le formulaire de création/édition exposent un champ historique (textarea libre). À l'enregistrement, `contacts.historique` (text, nullable, **distinct de `notes`**) est écrit, **sanitizé** (`sanitize()`), scopé `user_id`. Le champ est éditable à tout moment. (FR-35)
2. **Injection bornée en continuité** — Quand le Contact a un historique non vide, une génération depuis le Composeur injecte cet historique comme **bloc de contexte volatil borné** (troncature serveur via constante type `MAX_HISTORIQUE`, parité `MAX_SEED`/`MAX_IMPORT`) dans le prompt, à côté de l'idée (optionnelle) et du few-shot. La consigne demande de **rebondir sur le dernier point laissé en suspens** (continuité, pas simple rappel). (FR-35, AR-7, NFR-1, NFR-5)
3. **Non-régression sans historique** — Un Contact sans historique (NULL ou vide) génère **exactement** comme aujourd'hui (few-shot seul). Aucun changement de prompt observable, aucune adresse/bloc parasite.
4. **Transparence** — Quand un historique est transmis lors d'une génération, la micro-ligne de transparence API le reflète (l'historique fait partie du contexte envoyé à Claude). (extension FR-32)
5. **Sécurité / borne** — `contacts.historique` passe le test cross-tenant 2-users (jamais lisible hors tenant). L'historique au-delà de la borne est **tronqué** côté serveur (« borné, pas honoré tel quel »), jamais envoyé intégralement.
6. **Frontières produit** — Génération = **Composeur** (jamais le Copilote). Le champ intention (idea) reste **optionnel**. **Pas de parsing de format** : le bloc est avalé tel quel. Boutons-intention, écran de confiance/surlignage, nudge onboarding, jauge, multi-fils par canal et forward mail = **HORS SCOPE** (incréments ultérieurs).

## Tasks / Subtasks

- [x] **Task 1 — Schéma & migration** (AC: 1, 5)
  - [x] Ajouter `historique: text("historique")` (nullable) à la table `contacts` dans [plume/src/lib/db/schema.ts](../../plume/src/lib/db/schema.ts) (après `notes`, commenter en FR : « Historique brut des échanges passés, nourrit la génération en continuité — FR-35 »).
  - [x] Générer la migration Drizzle : `pnpm db:generate` → `drizzle/0009_violet_iron_man.sql` (`ALTER TABLE contacts ADD historique text`).
  - [x] Vérifier que `db:check` passe. ✅ « Everything's fine ».
- [x] **Task 2 — Repository & types** (AC: 1, 5)
  - [x] Étendre `ContactCreate`/`ContactUpdate` du `contactsRepository` ([plume/src/lib/db/repositories.ts](../../plume/src/lib/db/repositories.ts)) pour mapper `historique` (insert + merge re-ajout + update), patron `notes`.
  - [x] `sanitize()` l'historique **à l'écriture** — placé dans la **server action** (parité seeds : le repo persiste du texte déjà sanitizé, cf. voice-repositories.ts).
- [x] **Task 3 — Validation & server action** (AC: 1)
  - [x] `historique` ajouté à `contactInputSchema` + `HISTORIQUE_MAX = 8000` (borne douce de saisie) dans [validation.ts](../../plume/src/features/contacts/validation.ts).
  - [x] Câblé dans `createContactAction`/`updateContactAction` + helper `cleanHistorique` (sanitize, vide → null) ([actions.ts](../../plume/src/features/contacts/actions.ts)).
- [x] **Task 4 — UI fiche + formulaire** (AC: 1)
  - [x] Textarea historique dans [ContactForm.tsx](../../plume/src/features/contacts/ContactForm.tsx) (rendu `notes` : `bg-surface-note`, label FR, jamais de rouge — primitives design-system, pas de hex brut).
  - [x] Édition exposée depuis la fiche (defaults + affichage read-only) : [ContactDetail.tsx](../../plume/src/features/contacts/ContactDetail.tsx), [ContactDetailActions.tsx](../../plume/src/features/contacts/ContactDetailActions.tsx), [contact-detail.ts](../../plume/src/features/contacts/contact-detail.ts), [page](../../plume/src/app/(app)/reseau/[contactId]/page.tsx).
- [x] **Task 5 — Prompt builder (continuité)** (AC: 2, 3)
  - [x] `PromptContactContext.historique?: string | null` ajouté ([prompt.server.ts](../../plume/src/lib/prompt.server.ts)).
  - [x] `buildPrompt` injecte l'historique dans le **suffixe volatil** (`userText`), JAMAIS le `system` cachable, avec consigne de continuité — uniquement si non vide ET mode `generate` (en `improve`, conflit avec « en place » → non injecté).
  - [x] `PROMPT_VERSION` incrémentée à **3** + raison commentée.
- [x] **Task 6 — Pipeline & route** (AC: 2, 3, 4, 5)
  - [x] `composeInVoice` transporte déjà `contact` → `generateMessage` → `buildPrompt` (enrichi via `PromptContactContext.historique`). Helper pur `clampHistorique` + `MAX_HISTORIQUE = 4000` ajoutés ([pipeline.server.ts](../../plume/src/lib/composer/pipeline.server.ts)).
  - [x] **`/api/composer`** : `contactId` (optionnel) ajouté au `bodySchema` → `gate.contacts.get(contactId)` (scopé) → `contact: { nom, historique: clampHistorique(...) }` ([route.ts](../../plume/src/app/api/composer/route.ts)).
  - [x] Client Composeur : `contactId` envoyé dans le POST ([stream-client.ts](../../plume/src/features/composer/stream-client.ts), [ComposerSheet.tsx](../../plume/src/features/composer/ComposerSheet.tsx)).
  - [x] Micro-ligne de transparence reflète la présence d'historique via `ComposerContext.hasHistorique` (AC 4).
- [x] **Task 7 — Tests** (AC: 2, 3, 5)
  - [x] Unit prompt : présent → bloc + continuité dans `userText`, absent du `system` ; vide/NULL → `userText` identique à un prompt sans contact (non-régression) ; `improve` → non injecté ([prompt.test.ts](../../plume/tests/composer/prompt.test.ts)).
  - [x] Unit borne `clampHistorique` (vide→null, sous borne inchangé, au-delà tronqué) ([historique-bound.test.ts](../../plume/tests/composer/historique-bound.test.ts)).
  - [x] DB : cross-tenant 2-users sur `contacts.historique` ([cross-tenant.test.ts](../../plume/tests/security/cross-tenant.test.ts)).
  - [x] Suite voix figée (3.9) ne régresse pas : **415 tests passent** avec `PROMPT_VERSION=3` (pipeline.test lit la constante vivante).

## Dev Notes

### Contexte & frontières (à NE PAS violer)
- **Composeur ≠ Copilote.** La feature vit dans le flux Composeur. Le tool copilote `composeMessage` ([plume/src/lib/agent/tools.server.ts](../../plume/src/lib/agent/tools.server.ts)) appelle aussi `composeInVoice` ; lui faire bénéficier de l'historique est **possible mais hors scope** (ne pas s'en occuper ici, sauf si trivial via le même `contact`).
- **Champ intention reste optionnel** : `idea` peut être vide. Ne PAS rendre l'historique obligatoire ni bloquant.
- **Pas de parsing de format** : on n'essaie pas de démêler « qui a dit quoi ». Bloc brut → prompt.
- **Stockage brut, vie privée = responsabilité utilisateur** (il censure ce qu'il colle). Pas de chiffrement/résumé spécial.

### Découverte critique — la route ne porte pas de contact
`/api/composer` valide `{ idea, canal, tone, mode }` et appelle `composeInVoice` **sans `contact`** : aujourd'hui ni le nom ni l'historique ne sont injectés à la génération. Cette story **introduit `contactId`** dans le body → chargement scopé serveur → `{ nom, historique }`. C'est le maillon manquant ; le builder `buildPrompt` sait déjà gérer `contact.nom` (adresse), inutilisé jusqu'ici depuis la route.

### Prompt caching — invariant à préserver
[prompt.server.ts](../../plume/src/lib/prompt.server.ts) sépare un **préfixe stable cachable** (`system` = persona + few-shot, `cache_control: ephemeral`) d'un **suffixe volatil** (`messages`, tour utilisateur). L'historique est **per-contact volatil** → il DOIT aller dans `userText` (suffixe), jamais dans `system`. Sinon le cache se brise à chaque contact. (Source: [architecture.md prompt caching], prompt.server.ts l.13-19, l.160-210)

### Deux bornes distinctes (patron projet « clampé, pas honoré »)
- `HISTORIQUE_MAX` (validation saisie, [validation.ts](../../plume/src/features/contacts/validation.ts)) = borne douce de stockage (rejette l'absurde à la frontière).
- `MAX_HISTORIQUE` (injection prompt, serveur) = **troncature** avant envoi à Claude (coût NFR-5 / perf NFR-1). Une valeur grande mais plausible est **tronquée**, pas rejetée. Même patron à 2 bornes que `seedContacts`/`importContacts` (cf. tools.server.ts `MAX_SEED`/`MAX_IMPORT`).

### Sanitize
Règle projet : `sanitize()` passe AUSSI à l'import des textes (seeds, corpus). L'historique est un texte importé → **sanitizé à l'écriture** (form/action ou repository, s'aligner sur le point existant). Voir [project-context.md §Composeur].

### Source tree — fichiers touchés
| Fichier | Type | Quoi |
|---------|------|------|
| `plume/src/lib/db/schema.ts` | UPDATE | +colonne `historique` sur `contacts` |
| `plume/drizzle/*` | NEW | migration générée (`pnpm db:generate`) |
| `plume/src/lib/db/repositories.ts` | UPDATE | mapping `historique` en create/update + sanitize |
| `plume/src/features/contacts/validation.ts` | UPDATE | `historique` dans `contactInputSchema` + `HISTORIQUE_MAX` |
| `plume/src/features/contacts/actions.ts` | UPDATE | câblage server action |
| `plume/src/features/contacts/ContactForm.tsx` | UPDATE | textarea (patron `notes`) |
| `plume/src/features/contacts/ContactDetail.tsx` + `contact-detail.ts` | UPDATE | affichage/édition fiche |
| `plume/src/lib/prompt.server.ts` | UPDATE | `PromptContactContext.historique` + bloc continuité + `PROMPT_VERSION=3` |
| `plume/src/lib/composer/pipeline.server.ts` | UPDATE | transport `historique` dans `composeInVoice` |
| `plume/src/app/api/composer/route.ts` | UPDATE | `contactId` body → load scopé → `{nom, historique}` borné |
| Composeur client (POST) | UPDATE | envoyer `contactId` |
| `plume/tests/...` | NEW | prompt (présent/absent/borne) + cross-tenant DB |

### Testing standards
- **Vitest** (`pnpm test`). `fake-indexeddb`/`fast-check` dispo. Payloads Claude **gelés** (`tests/fixtures/claude-canned/`) — pas d'appel réseau (cf. story 3.9). `buildPrompt` est pur → test sans mock.
- Test non-régression = **snapshot du prompt** avec historique vide == prompt actuel.

### Project Structure Notes
- Frontières `.server.ts` / `domain/` / porte `db.forUser` respectées (3 barrières ESLint). `historique` traverse la porte scopée, jamais d'accès drizzle direct sous un tool/route.
- Naming colonnes `snake_case` (`historique`), tables/colonnes per architecture.md l.249-250.
- ⚠️ **Next.js de ce repo a des breaking changes** : lire `node_modules/next/dist/docs/` avant d'écrire du code route/server (cf. plume/AGENTS.md).

### References
- [Source: docs/planning-artifacts/epics.md#Story 3.10] — ACs BDD.
- [Source: docs/planning-artifacts/prds/prd-job-pipeline-2026-06-15/prd.md#FR-35] + extension FR-32.
- [Source: docs/planning-artifacts/architecture.md#Historique de Contact] — colonne, pipeline, borne.
- [Source: docs/planning-artifacts/ux-designs/ux-job-pipeline-2026-06-15/EXPERIENCE.md#Champ historique] — UI.
- [Source: docs/planning-artifacts/sprint-change-proposal-2026-06-21.md] — proposal d'origine.
- [Source: docs/project-context.md] — règles design-system, sanitize, scoping, bornes.
- [Source: docs/brainstorming/brainstorming-session-2026-06-21.md] — genèse + décisions C1-C5.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev-story workflow, 2026-06-21).

### Debug Log References

- `db:migrate` initial → appliqué au repli local `file:./local.db` (drizzle-kit ne charge pas `.env.local`). Symptôme : `/reseau` 500 « no such column: historique » côté dev server (qui pointe Turso via `.env.local`). Correctif : rejouer `db:migrate` avec `.env.local` chargé (`set -a; . ./.env.local`) → migration 0009 appliquée à la **Turso dev DB**.

### Completion Notes List

- **Découverte confirmée** : `/api/composer` ne passait aucun `contact` — c'était le maillon manquant. La story introduit `contactId` au body → chargement scopé → `{ nom, historique }`. Effet de bord assumé : le **nom** du contact est désormais aussi injecté (`buildPrompt` le gérait déjà, inutilisé jusqu'ici).
- **Sanitize à l'écriture** (pas au repo) : aligné sur le patron seeds (`voice-repositories.ts` persiste du texte déjà nettoyé ; le nettoyage vit dans l'action). Helper `cleanHistorique` (vide après sanitize → `null`).
- **Deux bornes distinctes** respectées : `HISTORIQUE_MAX = 8000` (saisie, validation Zod) vs `MAX_HISTORIQUE = 4000` (injection prompt, troncature `clampHistorique`). « Clampé, pas honoré tel quel ».
- **Cache préservé** : historique injecté dans `userText` (suffixe volatil), jamais dans le `system` cachable — vérifié par test. `system` identique avec/sans historique.
- **Non-régression** : sans historique, `userText` strictement identique à un prompt sans contact (test). En mode `improve`, historique **non injecté** (éviterait le conflit « retravaille en place » vs « rebondis »).
- **AC 4 transparence** : `ComposerContext.hasHistorique` (booléen seul, surface minimale) → micro-ligne API enrichie quand historique présent.
- **Qualité** : `typecheck` ✅, `lint` ✅, **415/415 tests** ✅. Vérif navigateur (Turso dev) : champ rendu (create), round-trip persistance + affichage fiche OK (contact « Camille Test 310 » créé dans la dev DB — artefact de test laissé en place).

### File List

- `plume/src/lib/db/schema.ts` (UPDATE — colonne `historique`)
- `plume/drizzle/0009_violet_iron_man.sql` (NEW — migration générée)
- `plume/drizzle/meta/*` (NEW/UPDATE — snapshot drizzle-kit)
- `plume/src/lib/db/repositories.ts` (UPDATE — mapping `historique` create/merge/update)
- `plume/src/features/contacts/validation.ts` (UPDATE — `historique` + `HISTORIQUE_MAX`)
- `plume/src/features/contacts/actions.ts` (UPDATE — câblage + `cleanHistorique` sanitize)
- `plume/src/features/contacts/ContactForm.tsx` (UPDATE — textarea historique)
- `plume/src/features/contacts/ContactDetail.tsx` (UPDATE — affichage read-only)
- `plume/src/features/contacts/ContactDetailActions.tsx` (UPDATE — defaults édition)
- `plume/src/features/contacts/contact-detail.ts` (UPDATE — `historique` dans la vue)
- `plume/src/app/(app)/reseau/[contactId]/page.tsx` (UPDATE — projection `historique`)
- `plume/src/lib/prompt.server.ts` (UPDATE — `PromptContactContext.historique`, bloc continuité, `PROMPT_VERSION=3`)
- `plume/src/lib/composer/pipeline.server.ts` (UPDATE — `clampHistorique` + `MAX_HISTORIQUE`)
- `plume/src/app/api/composer/route.ts` (UPDATE — `contactId` body → load scopé → contact borné)
- `plume/src/features/composer/actions.ts` (UPDATE — `ComposerContext.hasHistorique`)
- `plume/src/features/composer/stream-client.ts` (UPDATE — `contactId` dans la requête)
- `plume/src/features/composer/ComposerSheet.tsx` (UPDATE — envoi `contactId` + transparence)
- `plume/tests/composer/prompt.test.ts` (UPDATE — tests historique)
- `plume/tests/composer/historique-bound.test.ts` (NEW — borne `clampHistorique`)
- `plume/tests/security/cross-tenant.test.ts` (UPDATE — cross-tenant `contacts.historique`)

## Change Log

- 2026-06-21 — Story 3.10 implémentée (historique de conversation → génération en continuité). Colonne `contacts.historique` (migration 0009), pipeline composeur enrichi (`contactId` route → prompt borné), `PROMPT_VERSION=3`, transparence API. typecheck/lint/415 tests verts. Statut → review.
- 2026-06-21 — Code review (3 couches adversariales : Blind Hunter, Edge Case Hunter, Acceptance Auditor). 1 correctif appliqué : `clampHistorique` tronquait par la TÊTE (`slice(0,MAX)`) → supprimait l'échange le plus RÉCENT, à l'opposé de la consigne « rebondis sur le dernier point ». Corrigé en `slice(-MAX)` (garde la queue) + test de non-régression. 416 tests verts. Statut → done.

## Senior Developer Review (AI)

**Date :** 2026-06-21 · **Reviewer :** code-review (3 couches adversariales) · **Issue :** Changes Requested → résolu (1 finding)

**Outcome :** APPROVE (après correctif). 6/6 AC satisfaits, 4 invariants nommés tenus (PROMPT_VERSION, cache préservé, sanitize à l'écriture, 2 bornes distinctes).

**Action Items :**

- [x] **[High]** `clampHistorique` tronquait par la tête (`slice(0, MAX_HISTORIQUE)`) → jetait l'échange le PLUS RÉCENT alors que le prompt demande de rebondir sur le DERNIER point (bloc « du plus ancien au plus récent »). **Résolu** : `slice(-MAX_HISTORIQUE)` (garde la queue) + test `tronque par la TÊTE → garde la queue` ([pipeline.server.ts](../../plume/src/lib/composer/pipeline.server.ts), [historique-bound.test.ts](../../plume/tests/composer/historique-bound.test.ts)).

**Acquittés sans correctif (par design / hors-scope / pré-existant) :**

- Injection de prompt via fence `"""` — patron pré-existant (champ `idea`/`improve` traités pareil) ; spec : « bloc avalé tel quel », « vie privée = responsabilité utilisateur ». Hors scope story.
- Écart bornes 8000 (saisie) / 4000 (injection) — design « 2 bornes » explicite de la spec.
- Copilote `composeMessage` n'injecte pas l'historique — Dev Notes : « possible mais hors scope ».
- TOCTOU transparence (hasHistorique calculé à l'ouverture vs injection au generate) ; split surrogate UTF-16 ; garde merge `!= null` vs `!== undefined` (parité `notes`) — impact négligeable ou cohérent avec l'existant.
- Micro-ligne transparence « mode-blind » en `improve` — notice one-time, niveau contact ; faible.
