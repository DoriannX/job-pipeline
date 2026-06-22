# Story 7.6: Durcir l'idempotence de `createContact` 🐛 F11

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur du copilote,
I want qu'une demande de créer **un seul** contact n'aboutisse **jamais** à deux fiches,
so that mon réseau reste propre et l'invariant de dédup par tenant (`uq_contacts_user_dedup`) tienne, même quand l'IA hésite ou se répète dans un même tour.

## Contexte du bug (F11, dogfood 2026-06-21)

- **Symptôme observé live :** « ajoute UN contact » → le copilote a créé **deux** fiches du même contact, sans intention.
- **Pourquoi c'est anormal :** le repository `createContactRow` ([repositories.ts:115](../../plume/src/lib/db/repositories.ts)) est **déjà idempotent** — `insertIgnore` (onConflictDoNothing) sur `(user_id, dedup_key)` puis fusion/réactivation sur collision. Un re-ajout **identique** fusionne (test existant `tools.test.ts:233`). Donc le doublon vient d'un chemin qui **échappe à la clé**.
- **Cause racine la plus probable (à confirmer en repro) :** `computeDedupKey` ([dedup.ts:56](../../plume/src/lib/domain/dedup.ts)) sans e-mail = `name:<nom>|<entreprise>`. Si l'agent émet `createContact` **deux fois** avec une `entreprise` **divergente** (ex. tour 1 `{nom:"Sophie Martin"}` → clé `name:sophie martin|`, tour 2 `{nom:"Sophie Martin", entreprise:"Acme"}` → clé `name:sophie martin|acme`), les **deux clés diffèrent** → aucune collision → **2 lignes**. Aucun test ne couvre ce cas (le test de dédup fournit `entreprise` des deux côtés).
- **Cofacteur :** le loop-breaker tool-use ne déduplique PAS « même tool + mêmes args » — cf. commentaire explicite [run.server.ts:58-60](../../plume/src/lib/agent/run.server.ts) (`MAX_STEPS = 8`, « À durcir plus tard (détection même tool + mêmes args) »). Rien n'empêche deux `createContact` dans un même run.

## Acceptance Criteria

1. **Given** un copilote qui émet `createContact` deux fois dans le **même tour** pour la **même personne**, l'une **sans** `entreprise` et l'autre **avec** (mêmes nom normalisé, pas d'e-mail)
   **When** le run s'exécute
   **Then** il existe **une seule** fiche active à la fin (la 2ᵉ émission **enrichit/fusionne** la 1ʳᵉ au lieu de créer une ligne à clé divergente), `entreprise` retenue = la valeur non vide fournie.

2. **Given** deux `createContact` identiques au nom près de la casse/accents (« Sophie Martin » / « sophie martin »), sans e-mail
   **When** le run s'exécute
   **Then** une seule fiche (la normalisation `normalizeName` rend les deux équivalents) — comportement préservé, non régressé.

3. **Given** deux personnes **réellement distinctes** homonymes mais d'entreprises **différentes** et **toutes deux renseignées** (« Jean Dupont @ Acme » puis « Jean Dupont @ Globex »)
   **When** le run s'exécute
   **Then** **deux** fiches distinctes sont créées (on ne fusionne PAS deux entreprises différentes explicites — anti-faux-positif).

4. **Given** un `createContact` ciblant un nom déjà présent **archivé** (soft-deleted)
   **When** l'appel s'exécute
   **Then** la fiche est **réactivée** (désarchivée) et enrichie, **jamais** dupliquée — parité avec le comportement existant `createContactRow` (op `reactivated`).

5. **Given** un `createContact` avec e-mail
   **When** l'appel s'exécute
   **Then** la dédup par `email:<email>` reste prioritaire et inchangée (la nouvelle résolution par nom ne s'applique QUE sans e-mail).

6. **Given** la fusion/enrichissement déclenché par cette story
   **When** elle a lieu via le copilote (`journal` fourni)
   **Then** l'entrée `action_log` reflète l'`op` réelle (`merged`/`reactivated`, jamais un faux `created`) et reste **rewindable** (parité journalisation existante).

7. **Given** les chemins **manuel** (story 2.1, UI), **seedContacts** et **importContacts**
   **When** cette story est livrée
   **Then** leur comportement de dédup est **strictement inchangé** (le durcissement est scopé au **tool** `createContact` du copilote, pas au cœur partagé `createContactRow`, sauf décision archi explicite — cf. Dev Notes).

8. **Given** l'isolement tenant
   **When** la résolution par nom cherche un contact existant
   **Then** elle ne voit QUE les contacts du tenant courant (porte scopée `forUser` ; un nom identique chez un autre user ne fusionne jamais) — test cross-tenant ajouté.

## Tasks / Subtasks

- [ ] **Task 1 — Repro rouge du bug F11** (AC: #1)
  - [ ] Ajouter dans [tests/agent/tools.test.ts](../../plume/tests/agent/tools.test.ts), bloc `describe("createContact …")`, un test : deux `createContact` même nom, l'un sans `entreprise` l'autre avec, sans e-mail → attendre **1** contact. Vérifier qu'il **échoue** sur le code actuel (prouve la cause racine divergent-key).
- [ ] **Task 2 — Résolution par nom au niveau tool** (AC: #1, #2, #3, #5)
  - [ ] Dans [tools.server.ts](../../plume/src/lib/agent/tools.server.ts), durcir la fonction **pure** `createContact` : **sans e-mail**, résoudre un contact ACTIF existant par **nom normalisé** (`normalizeName` de `@/lib/domain/dedup`) AVANT l'insert.
  - [ ] Règle de fusion anti-faux-positif (AC #3) : fusionner **seulement** si l'existant a une `entreprise` **vide** OU **égale** (normalisée) à celle fournie. Si l'existant a une `entreprise` **différente non vide** → ne pas fusionner (laisser le chemin actuel créer une fiche distincte).
  - [ ] Élargir le contrat injecté : `Pick<ContactsRepository, "create">` → `"create" | "list"` (ou `"get"`), pour lire l'existant scopé sans accès drizzle direct (Archi #1).
  - [ ] Router la fusion via le `create` existant (qui fusionne déjà sur clé) en alignant la clé, OU via `update` ciblé sur l'id résolu — **choix à trancher** (cf. Dev Notes) en gardant la journalisation correcte (AC #6).
- [ ] **Task 3 — Réactivation + e-mail prioritaire** (AC: #4, #5)
  - [ ] Vérifier que la résolution par nom inclut les archivés pour réactiver (parité `createContactRow`), et que le chemin **avec e-mail** court-circuite la nouvelle résolution (clé `email:` prioritaire).
- [ ] **Task 4 — Journalisation / rewind** (AC: #6)
  - [ ] S'assurer que l'`op` journalisée (`merged`/`reactivated`) et le `prevState` sont exacts quand la story fusionne ; un rewind restaure l'état antérieur sans re-archivage aveugle.
- [ ] **Task 5 — Tests** (AC: #1–#8)
  - [ ] Cas verts : enrichissement (1 fiche), casse/accents, homonymes-entreprises-différentes (2 fiches), réactivation archivé, e-mail prioritaire, isolement cross-tenant.
  - [ ] Non-régression : exécuter les tests existants `createContact`/`importContacts`/`seedContacts` inchangés.
- [ ] **Task 6 — (optionnel, defense-in-depth) loop-breaker** (AC: #1)
  - [ ] Évaluer une garde « même tool + mêmes args dans un même `turnId` » côté [run.server.ts](../../plume/src/lib/agent/run.server.ts). **Hors scope par défaut** (la résolution Task 2 suffit à l'AC) ; ne l'implémenter que si trivial et sans risque. Sinon laisser un TODO + tracer en deferred-work.

## Dev Notes

### Cause racine & stratégie (lire avant de coder)
- Le bug n'est **pas** dans le repository : `createContactRow` dédupe correctement sur clé identique. Le trou = **deux clés `name:` divergentes** pour la même personne (entreprise présente d'un côté, absente de l'autre) + rien n'empêche le double appel tool.
- **Fix scopé au tool, PAS au cœur partagé.** `createContactRow` ([repositories.ts:115](../../plume/src/lib/db/repositories.ts)) est appelé par **4 chemins** : UI manuelle (story 2.1), `seedContacts`, `importContacts`, et le tool `createContact`. Changer sa sémantique de dédup (ex. matcher sur nom seul) impacterait **tous** ces chemins et casserait l'intention de `importContacts` (dédup intra-lot exacte) et des seeds (e-mails uniques). → **Durcir la fonction pure `createContact` du tool** ([tools.server.ts:208](../../plume/src/lib/agent/tools.server.ts)), qui est le seul chemin fautif au dogfood. Garder `createContactRow` intact (AC #7).

### Fichiers à toucher
- **[plume/src/lib/agent/tools.server.ts](../../plume/src/lib/agent/tools.server.ts)** — fonction pure `createContact` (l.208-228) + le `tool({...})` `createContact` (l.684-730 : adapter le `Pick` injecté au `gate.contacts`). Ne PAS toucher aux autres tools.
- **[plume/tests/agent/tools.test.ts](../../plume/tests/agent/tools.test.ts)** — bloc `describe("createContact …", l.206)`. Suivre le patron existant : `repoA()` (repo scopé tenant A en mémoire), assertions sur `list()`.
- **Lecture seule (comprendre, ne pas modifier)** : [repositories.ts](../../plume/src/lib/db/repositories.ts) (`createContactRow`, fusion/`prevState`), [dedup.ts](../../plume/src/lib/domain/dedup.ts) (`normalizeName`, `computeDedupKey`), [run.server.ts](../../plume/src/lib/agent/run.server.ts) (boucle, `turnId`, `MAX_STEPS`).

### Décision à confirmer avec l'Architecte (Winston) avant de figer
- **Où router la fusion** une fois l'existant résolu par nom :
  - **Option A (recommandée, faible rayon de blast)** : dans la fn pure `createContact`, si un existant actif/archivé matche le nom (règle anti-faux-positif AC #3), appeler `contacts.update(existing.id, { entreprise?, canalPrefere?, handles?, archivedAt:null })`. Simple, mais `update` n'est **pas journalisé** aujourd'hui → pour respecter AC #6 (rewind), préférer Option B ou ajouter la journalisation.
  - **Option B** : normaliser les arguments AVANT d'appeler `contacts.create` de sorte que la `dedupKey` calculée **converge** vers celle de l'existant (ex. réutiliser l'`entreprise` de l'existant si l'appel l'omet). La fusion + journalisation `merged`/`reactivated` du repo s'appliquent alors **telles quelles** (AC #6 gratuit). **Privilégier B** si faisable proprement.
- **Politique homonymes** (AC #3) : on NE fusionne PAS deux `entreprise` explicites différentes. Confirmer que c'est la règle voulue (alternative : demander à l'utilisateur — hors scope ici, le copilote confirmera en amont via prompt, story 7.1).

### Invariants & barrières (NON négociables — project-context.md)
- **Aucun accès drizzle/`schema` sous un tool** (Archi #1, barrière ESLint n°1) : passer par les **repositories** via la porte scopée `forUser(userId)`. Le tool reçoit `gate.contacts`, jamais la db.
- **Scope tenant clos par closure** (SÉCU #3) : `userId` n'est jamais un argument d'agent. La résolution par nom lit via le repo déjà scopé → isolement gratuit (AC #8), mais **ajouter un test cross-tenant** explicite (definition of done « test cross-tenant étendu à chaque table touchée »).
- **Soft-delete only** : jamais de hard-delete ; réactivation = `archivedAt:null`.
- **Réversibilité/rewind** : toute écriture du copilote passe par la sink `journal` (`turnId`) → `action_log` atomique. Ne pas créer un chemin d'écriture non journalisé pour le copilote.
- **FR & commentaires de code en français.** Erreurs UI = teinte douce, jamais de rouge (n/a ici, logique serveur).

### Testing standards
- Runner : **Vitest** (`pnpm test` dans `plume/`). Tests db en mémoire, repos scopés injectés (cf. helpers en tête de [tools.test.ts](../../plume/tests/agent/tools.test.ts)).
- Frontière de test = la **fonction pure** `createContact(repo, input, journal?)` (pas le `tool()` wrapper) — déterministe, sans serveur. Pour journal/rewind, voir [tests/db/action-log.test.ts](../../plume/tests/db/action-log.test.ts) et [tests/db/rewind.test.ts](../../plume/tests/db/rewind.test.ts).
- **Definition of done** : repro rouge (Task 1) devient verte ; tous les tests existants restent verts ; `pnpm lint` + `pnpm typecheck` passent (mode strict, 3 barrières ESLint).

### Project Structure Notes
- Alignement OK : write-tool dans `src/lib/agent/tools.server.ts`, logique de dédup pure réutilisée depuis `src/lib/domain/dedup.ts` (zone neutre, importable des deux côtés sans casser les barrières).
- Variance : élargir le `Pick<ContactsRepository, …>` injecté à `createContact` ajoute `"list"` (ou `"get"`) — conforme au contrat repo existant, aucune nouvelle table ni migration.
- **Aucune migration de schéma** : `uq_contacts_user_dedup` et `dedup_key` restent inchangés ; on corrige le **chemin d'appel**, pas la contrainte.

### References
- [Source: docs/implementation-artifacts/compte-rendu-test-dogfood-copilote.md#F11] — symptôme, causes candidates, « à durcir ».
- [Source: docs/planning-artifacts/epics.md#Story 7.6] — énoncé stub + priorité dogfood.
- [Source: docs/planning-artifacts/sprint-change-proposal-2026-06-21-pivot-copilote.md#3.2] — contrat write-tools, durcissement `createContact` (idempotence), `action_log`/rewind.
- [Source: plume/src/lib/db/repositories.ts:115] — `createContactRow` (dédup insertIgnore + fusion/réactivation + `prevState`).
- [Source: plume/src/lib/domain/dedup.ts:56] — `computeDedupKey` (`email:` vs `name:`), `normalizeName`.
- [Source: plume/src/lib/agent/tools.server.ts:208] — fonction pure `createContact` à durcir + `WRITE_TOOL_NAMES`.
- [Source: plume/src/lib/agent/run.server.ts:58] — `MAX_STEPS`, loop-breaker sans détection « même tool + mêmes args ».
- [Source: docs/project-context.md] — invariants (Archi #1, SÉCU #3, scope `user_id`, soft-delete, FR-only).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
