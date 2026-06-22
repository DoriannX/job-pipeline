# Story 7.3: Capter le contexte relationnel à la création de contact — FR-38

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur du copilote,
I want que, **quand je crée un contact via le copilote**, l'IA me pose des questions ciblées (comment je connais cette personne, à quand remonte la dernière interaction, le ton),
so that le champ **historique/contexte** du contact soit nourri dès la création et **réutilisé pour chaque message futur** (continuité) — sans que l'IA devine la relation.

## Contexte (pivot conversationnel, FR-38)

Le pivot (Epic 7) acte : **le copilote pose toujours des questions, ne devine jamais la relation** (cf. mémoire `copilote-pivot-conversationnel`, finding dogfood central : la Voix déraille quand l'IA présume la relation). Cette story applique ce principe **au moment de la création de contact** — le pendant amont de la rédaction.

L'infrastructure est **déjà en place** (story 3.10 / FR-35) — cette story est surtout du **prompt + un petit branchement** :
- Le champ `historique` (text, nullable) existe sur `contacts` ([schema.ts:130-134](../../plume/src/lib/db/schema.ts)) et est **injecté borné au prompt de génération** (`clampHistorique`, [pipeline.server.ts:101-127](../../plume/src/lib/composer/pipeline.server.ts) ; [prompt.server.ts:247-252](../../plume/src/lib/prompt.server.ts)).
- Le repository supporte déjà `historique` à la **création** (`ContactCreate.historique`, [repositories.ts:26-38](../../plume/src/lib/db/repositories.ts)) et à la **fusion** (merge historique [repositories.ts:218-221](../../plume/src/lib/db/repositories.ts)).
- Le tool `setContactHistorique` (append/replace) existe pour écrire l'historique **après** création ([tools.server.ts:567-643](../../plume/src/lib/agent/tools.server.ts)).
- Le system prompt ([run.server.ts:63-107](../../plume/src/lib/agent/run.server.ts)) instruit déjà de poser des questions relationnelles **avant `composeMessage`** — mais **rien** pour la **création de contact**.
- Le tool `createContact` ([tools.server.ts:196-202, 885-915](../../plume/src/lib/agent/tools.server.ts)) **n'accepte PAS** de champ historique/contexte aujourd'hui.

## Décision d'implémentation (stratégie A — à confirmer en dev, alternative documentée)

**Stratégie A retenue (atomique, déterministe)** : ajouter un champ **optionnel** `historique` (ou `contexte`) à l'input de `createContact` (Zod + fn pure), qui le passe à `contacts.create` (le repository le supporte déjà). + enrichir le system prompt pour que le copilote **pose les questions relationnelles avant de créer** et remplisse ce champ avec les réponses de l'utilisateur (jamais inventé).

- **Pourquoi A** : capture atomique (le contexte est posé même si un 2ᵉ appel échouerait) ; déterministe et testable ; réutilise le merge historique existant ; `historique` ne participe PAS à la `dedupKey` → aucun risque pour l'idempotence durcie en 7-6.
- **Alternative B (non retenue par défaut)** : ne pas toucher `createContact` ; le system prompt orchestre `createContact` → `setContactHistorique` (append) en 2 appels. Plus aligné « copilote orchestre tout » mais dépend de la fiabilité du chaînage 2-tools et n'est pas atomique. À retenir **seulement** si l'extension de `createContact` s'avère heurter l'idempotence 7-6 (peu probable).

## Acceptance Criteria

1. **Given** l'utilisateur demande au copilote de créer un contact (« ajoute Untel »)
   **When** un élément clé du contexte relationnel manque ou est ambigu (comment il le connaît, récence de la dernière interaction, ton/objectif)
   **Then** le copilote **pose une ou des questions ciblées AVANT de créer**, attend la réponse, **ne devine jamais** la relation (parité avec l'instruction existante pour `composeMessage`).

2. **Given** l'utilisateur a répondu aux questions de contexte
   **When** le copilote crée le contact
   **Then** le champ `historique` du contact est **nourri** des faits relationnels fournis (uniquement ce que l'utilisateur a dit — **aucun fait inventé**), de sorte qu'une génération de message ultérieure l'injecte (continuité, FR-35).

3. **Given** la stratégie A (champ `historique` optionnel sur `createContact`)
   **When** `createContact` est appelé **sans** historique (l'utilisateur n'a rien fourni de pertinent, ou contexte déjà clair)
   **Then** le comportement est **strictement inchangé** (champ `null`, parité actuelle) — la capture de contexte est **opportuniste, jamais bloquante** si l'utilisateur ne veut pas répondre.

4. **Given** un `historique` fourni à la création
   **When** il est écrit
   **Then** il passe par `sanitize()` (parité seeds/corpus/édition, point unique d'écriture) — pas d'écriture brute.

5. **Given** que `createContact` a été durci pour l'idempotence en 7-6 (dédup par nom normalisé / e-mail, fusion/réactivation)
   **When** l'ajout du champ `historique` est livré
   **Then** l'idempotence et la dédup **restent intactes** (`historique` ne participe PAS à la `dedupKey`) ; en cas de **fusion** avec un contact existant, l'historique fourni est fusionné via le chemin merge existant ([repositories.ts:218-221](../../plume/src/lib/db/repositories.ts)), jamais perdu silencieusement.

6. **Given** l'isolement tenant et la réversibilité
   **When** la création (avec historique) a lieu via le copilote (`journal` fourni)
   **Then** l'écriture reste scopée `forUser` et journalisée/rewindable comme la création actuelle (parité `action_log`, AC du write-tools).

7. **Given** les chemins de création **manuels** (UI story 2.1) et `importContacts`/`seedContacts`
   **When** cette story est livrée
   **Then** leur comportement est **inchangé** (l'extension est portée par le **tool** `createContact` du copilote + le system prompt ; le cœur partagé `createContactRow` accepte déjà `historique` et n'est pas modifié sémantiquement).

## Tasks / Subtasks

- [ ] **Task 1 — System prompt : poser les questions à la création** (AC: #1, #2)
  - [ ] Dans `SYSTEM_PROMPT` ([run.server.ts:63-107](../../plume/src/lib/agent/run.server.ts)), ajouter un bloc « CRÉATION DE CONTACT (createContact) » miroir du bloc RÉDACTION : capter le contexte relationnel par questions ciblées (comment l'utilisateur connaît ce contact, récence de la dernière interaction, ton/objectif) AVANT de créer ; ne JAMAIS deviner ; n'utiliser que les faits fournis ; passer ces faits dans le champ `historique` de `createContact`. Capture **opportuniste, non bloquante** (si l'utilisateur ne veut pas, créer sans).
  - [ ] Garder le prompt concis (parité de ton avec l'existant, français).
- [ ] **Task 2 — Étendre `createContact` (champ `historique` optionnel)** (AC: #2, #3, #4, #5)
  - [ ] Ajouter `historique?: string | null` à `CreateContactInput` ([tools.server.ts:196-202](../../plume/src/lib/agent/tools.server.ts)) et au schéma Zod du tool ([tools.server.ts:885-915](../../plume/src/lib/agent/tools.server.ts)) avec `.describe(...)` clair (« Contexte relationnel/historique fourni par l'utilisateur — comment il connaît le contact, dernière interaction, ton. N'invente rien. »). Borne raisonnable (ex. `.max(16_000)` parité `setContactHistorique`).
  - [ ] Passer `historique` à `contacts.create({...})` dans la fn pure (le repository le supporte déjà). Appliquer `sanitize()` au point d'écriture (parité — vérifier où `setContactHistorique` sanitize et refléter ; idéalement la sanitize centralisée du tool, AC #4).
  - [ ] **Ne pas** inclure `historique` dans la `dedupKey`/résolution (AC #5). Vérifier le chemin de fusion : si l'appel matche un existant, `historique` fourni doit suivre le merge existant.
- [ ] **Task 3 — Tests** (AC: #2–#7)
  - [ ] [tests/agent/tools.test.ts](../../plume/tests/agent/tools.test.ts), bloc `createContact` : création avec `historique` → champ persisté (sanitizé) ; création sans `historique` → `null` (parité, AC #3) ; fusion avec existant fournissant `historique` → historique fusionné non perdu (AC #5) ; isolement cross-tenant préservé.
  - [ ] Non-régression : tests `createContact` (dédup/idempotence 7-6), `setContactHistorique`, `importContacts`/`seedContacts` inchangés et verts.
- [ ] **Task 4 — Garde-fous**
  - [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test` verts.
  - [ ] Vérif preview (dev login) : demander « ajoute [nom] » au copilote → il pose une question de contexte → après réponse, le contact est créé ET son historique est nourri (vérifier la fiche / une génération ultérieure qui l'injecte). Documenter dans le Dev Agent Record.

## Dev Notes

### Stratégie & rayon de blast
- Le gros de la story est le **system prompt** (comportement conversationnel) + une **extension additive** de `createContact` (champ optionnel). Le repository (`ContactCreate.historique`) et l'injection au prompt (`clampHistorique`) **existent déjà** — ne PAS les réinventer.
- `createContact` a été **durci en 7-6** (idempotence). L'ajout d'un champ `historique` est **orthogonal** à la dédup (clé = e-mail OU nom normalisé + entreprise) → ne touche pas la résolution. **Relire la fn pure `createContact` (7-6) avant d'éditer** pour brancher `historique` au bon endroit (création ET fusion).

### Sanitize (AC #4)
- `setContactHistorique` applique `clean`/`sanitize()` à l'écriture ([tools.server.ts:567-643](../../plume/src/lib/agent/tools.server.ts)). Pour `createContact`, refléter ce point unique : sanitize l'`historique` avant `contacts.create`. NB : `createContactRow` indique que `historique` est « déjà sanitizé par l'action » → sanitize **dans le tool** (côté action), pas dans le repo.

### Invariants & barrières (NON négociables — project-context.md)
- **Aucun accès drizzle/schema sous un tool** (barrière n°1) : passer par `gate.contacts` (porte scopée `forUser`).
- **Scope tenant clos par closure** : `userId` jamais argument d'agent. Test cross-tenant à étendre si une table touchée.
- **Réversibilité** : écriture copilote via la sink `journal` → `action_log` (parité création actuelle).
- **`historique` ≠ `notes`** : `notes` = pense-bête perso (non injecté) ; `historique` = injecté au prompt. Ne pas confondre les champs.
- **FR & commentaires de code en français.** Aucun fait inventé par l'IA (règle moat).
- **Champ `Composeur` vide par défaut**, pas de pré-génération (n/a ici mais garder l'esprit : on capture du contexte, on ne génère pas de message à la création).

### Testing standards
- Vitest (`pnpm test` dans `plume/`), repos en mémoire scopés (helpers en tête de [tools.test.ts](../../plume/tests/agent/tools.test.ts)). Frontière de test = fn pure `createContact(repo, input, journal?, sanitize?)`.
- Definition of done : nouveaux tests verts + suite existante inchangée + lint/typecheck verts + vérif preview documentée.

### Project Structure Notes
- Tout dans `src/lib/agent/tools.server.ts` (tool + fn pure) et `src/lib/agent/run.server.ts` (prompt). **Aucune migration** (`historique` existe déjà en base). Aucune nouvelle table, aucun nouveau tool.

### References
- [Source: docs/planning-artifacts/epics.md#Story 7.3] — énoncé FR-38.
- [Source: docs/implementation-artifacts/compte-rendu-test-dogfood-copilote.md] — pivot : poser des questions, ne pas deviner la relation.
- [Source: plume/src/lib/agent/run.server.ts:63-107] — SYSTEM_PROMPT (bloc RÉDACTION à mirroir pour la création).
- [Source: plume/src/lib/agent/tools.server.ts:196-202,885-915] — `createContact` (input + Zod) à étendre.
- [Source: plume/src/lib/agent/tools.server.ts:567-643] — `setContactHistorique` (réf sanitize + alternative B).
- [Source: plume/src/lib/db/repositories.ts:26-38,150-155,218-221] — `ContactCreate.historique` (création + fusion).
- [Source: plume/src/lib/db/schema.ts:130-134] — champ `historique` (text nullable, distinct de `notes`).
- [Source: plume/src/lib/composer/pipeline.server.ts:101-127] + [prompt.server.ts:247-252] — injection `clampHistorique` au prompt de génération.
- [Source: docs/project-context.md] — invariants (barrières, scope tenant, FR-only, no-invention).

## Dev Agent Record

### Agent Model Used
claude-opus-4-8 (story-pilot autonome)

### Debug Log References
- `pnpm typecheck` ✓ · `pnpm lint` ✓ · `pnpm test` **477/477** (+5 nouveaux tests createContact/historique).
- Vérif preview e2e (dev login) — voir Completion Notes.

### Completion Notes List
- **Stratégie A retenue** (extension de `createContact`), comme cadré. Le repository + l'injection au prompt (`clampHistorique`) existaient déjà ; le travail = system prompt + branchement additif du champ.
- **System prompt** ([run.server.ts](../../plume/src/lib/agent/run.server.ts)) : ajout d'un bloc « CRÉATION DE CONTACT (createContact) » miroir du bloc RÉDACTION — poser des questions ciblées (relation, récence, ton/objectif) AVANT de créer, ne jamais deviner, passer les faits dans `historique`, capture **opportuniste non bloquante**, et renvoyer vers `setContactHistorique` (append) pour COMPLÉTER un contact existant.
- **Tool `createContact`** ([tools.server.ts](../../plume/src/lib/agent/tools.server.ts)) : champ `historique` optionnel ajouté (type `CreateContactInput`, schéma Zod `.max(16_000)`, `.describe` anti-invention). Fn pure : nouveau param `clean` (sanitize injecté, défaut identité) ; historique **sanitizé au point unique d'écriture** puis passé à `contacts.create`. Chemin **fusion homonyme 7-6** (clé divergente → `update`) : historique ajouté au patch en **enrich-if-absent** (jamais d'écrasement) ; pour écraser/compléter un historique présent, c'est `setContactHistorique`. `historique` **ne participe pas** à la `dedupKey` → idempotence 7-6 intacte.
- **Tests** ([tools.test.ts](../../plume/tests/agent/tools.test.ts)) : création avec historique (persisté), sans/vide (→ null, parité), sanitize (clean injecté strippe le tiret cadratin), fusion divergente enrich-if-absent, fusion divergente sans écrasement d'un historique présent. Suite existante (idempotence 7-6, setContactHistorique, import/seed) inchangée et verte.
- **Vérif preview e2e** : « Ajoute Marie Durand » → le copilote pose les 3 questions + offre « sans contexte si tu ne veux pas » (AC#1), ne crée PAS encore. Après réponse (« ancienne collègue Betclic, 2024, dernier échange 6 mois, prospection ») → contact créé, et la **fiche affiche** « HISTORIQUE DE CONVERSATION : Ancienne collègue chez Betclic… objectif prospection » (AC#2). Capture → persistance → affichage → injectable pour génération future, confirmés bout-en-bout.
- **Non touché** : `createContactRow` (cœur partagé UI/seed/import), `updateContact` (n'expose toujours pas l'historique — tool dédié), schéma DB (champ `historique` préexistant). Aucune migration.

### File List
- `plume/src/lib/agent/tools.server.ts` (modifié — `CreateContactInput.historique`, fn pure `createContact` param `clean` + threading + enrich-if-absent, Zod + execute sanitize)
- `plume/src/lib/agent/run.server.ts` (modifié — bloc system prompt « CRÉATION DE CONTACT »)
- `plume/tests/agent/tools.test.ts` (modifié — 5 tests historique à la création)
