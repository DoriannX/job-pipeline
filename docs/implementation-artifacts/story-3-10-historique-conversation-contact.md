# Story 3.10: Historique de conversation du Contact → génération en continuité

Status: ready-for-dev

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

- [ ] **Task 1 — Schéma & migration** (AC: 1, 5)
  - [ ] Ajouter `historique: text("historique")` (nullable) à la table `contacts` dans [plume/src/lib/db/schema.ts](../../plume/src/lib/db/schema.ts) (après `notes`, commenter en FR : « Historique brut des échanges passés, nourrit la génération en continuité — FR-35 »).
  - [ ] Générer la migration Drizzle : `pnpm db:generate` (NE PAS écrire le SQL à la main). Vérifier le fichier généré sous `plume/drizzle/` (ou dossier de migrations du projet).
  - [ ] Vérifier que `db:check` passe.
- [ ] **Task 2 — Repository & types** (AC: 1, 5)
  - [ ] Étendre le type d'entrée create/update du `contactsRepository` ([plume/src/lib/db/repositories.ts](../../plume/src/lib/db/repositories.ts)) pour mapper `historique` (optionnel). Suivre le patron existant de `notes`.
  - [ ] `sanitize()` l'historique **à l'écriture** (parité règle projet « sanitize à l'import » — cf. seeds/corpus). Confirmer le point exact (server action vs repository) en s'alignant sur où `notes`/seeds sont traités.
- [ ] **Task 3 — Validation & server action** (AC: 1)
  - [ ] Ajouter `historique` à `contactInputSchema` dans [plume/src/features/contacts/validation.ts](../../plume/src/features/contacts/validation.ts) : `z.string().trim().max(HISTORIQUE_MAX, "…").optional().transform(v => v ? v : undefined)`. Définir `HISTORIQUE_MAX` (borne douce de saisie, ex. 8000 — distincte de la borne d'injection prompt).
  - [ ] Câbler le champ dans la server action de création/édition ([plume/src/features/contacts/actions.ts](../../plume/src/features/contacts/actions.ts)).
- [ ] **Task 4 — UI fiche + formulaire** (AC: 1)
  - [ ] Ajouter le textarea historique dans [plume/src/features/contacts/ContactForm.tsx](../../plume/src/features/contacts/ContactForm.tsx) (suivre le rendu du champ `notes`). Token design : fond `#EDF6F2`, label FR, **jamais de rouge**, rayons/espacements figés (cf. design-system).
  - [ ] Exposer l'édition depuis la fiche ([plume/src/features/contacts/ContactDetail.tsx](../../plume/src/features/contacts/ContactDetail.tsx) / [contact-detail.ts](../../plume/src/features/contacts/contact-detail.ts) / [page](../../plume/src/app/(app)/reseau/[contactId]/page.tsx)).
- [ ] **Task 5 — Prompt builder (continuité)** (AC: 2, 3)
  - [ ] Étendre `PromptContactContext` avec `historique?: string | null` dans [plume/src/lib/prompt.server.ts](../../plume/src/lib/prompt.server.ts).
  - [ ] Dans `buildPrompt`, injecter l'historique dans le **suffixe volatil** (`userText`, APRÈS la césure de cache — NE JAMAIS le mettre dans le `system` cachable). Ajouter un bloc + une instruction de continuité (« rebondis sur le dernier point laissé en suspens ; ne te contente pas de résumer ») **uniquement si historique non vide**.
  - [ ] **Incrémenter `PROMPT_VERSION` à 3** (changement observable de recette) + commenter la raison (parité v2/mode).
- [ ] **Task 6 — Pipeline & route** (AC: 2, 3, 4, 5)
  - [ ] `composeInVoice` ([plume/src/lib/composer/pipeline.server.ts](../../plume/src/lib/composer/pipeline.server.ts)) : transporter `contact.historique` jusqu'à `generateMessage`/`buildPrompt` (le param `contact` existe déjà — l'enrichir).
  - [ ] **`/api/composer`** ([plume/src/app/api/composer/route.ts](../../plume/src/app/api/composer/route.ts)) : ⚠️ la route ne passe **aujourd'hui aucun `contact`**. Ajouter `contactId` (optionnel) au `bodySchema`, charger le contact via `gate.contacts.get(contactId)` (scopé tenant), puis passer `contact: { nom, historique }` à `composeInVoice`. Appliquer la **troncature `MAX_HISTORIQUE`** côté serveur avant injection.
  - [ ] Côté client Composeur : envoyer `contactId` dans le POST (le contact est déjà en contexte UI à l'ouverture du sheet).
  - [ ] Micro-ligne de transparence : refléter la présence d'historique (AC 4).
- [ ] **Task 7 — Tests** (AC: 2, 3, 5)
  - [ ] Unit prompt : historique présent → bloc + consigne continuité dans `userText`, **absent du `system`** (cache préservé). Historique vide/NULL → prompt **identique** à l'actuel (non-régression, snapshot).
  - [ ] Unit borne : historique > `MAX_HISTORIQUE` → tronqué avant injection.
  - [ ] DB : test **cross-tenant 2-users** sur `contacts.historique` (definition of done, parité `messages`/`generation_events`).
  - [ ] Vérifier que la suite voix figée (story 3.9 evals) ne régresse pas avec `PROMPT_VERSION=3`.

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

### Debug Log References

### Completion Notes List

### File List
