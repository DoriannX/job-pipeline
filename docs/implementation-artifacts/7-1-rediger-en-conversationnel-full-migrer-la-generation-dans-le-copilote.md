# Story 7.1: Rédiger en conversationnel full — migrer la génération dans le copilote 🎯 (cœur du pivot)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur du copilote,
I want que, quand je demande au copilote de rédiger un message, il **capte d'abord le contexte relationnel** (comment je connais ce contact, à quand remonte la dernière interaction, mon objectif) en me posant des questions ciblées **avant** de produire le brouillon,
so that le message colle à la vraie relation au lieu d'être deviné (le tour 1 du dogfood présumait l'oubli sur un contact récent → message froid, non envoyable), et la rédaction assistée vit **dans le copilote conversationnel**, plus dans un bouton « Générer » one-shot.

## Contexte du pivot (dogfood 2026-06-21)

- **Constat central :** la génération one-shot **déraille quand l'IA doit deviner la relation** (tour 1 F3 : « pas spécialement proches » traduit en « il m'a oublié » → ouverture « tu te souviens de moi ? » sur un contact rencontré en entretien il y a quelques mois → froid, non envoyable). Elle marche quand la relation est claire (tour 2, « j'aime bien »). **Décision : ne pas laisser l'IA deviner → lui faire poser les questions.** [Source: compte-rendu-test-dogfood-copilote.md#Synthèse]
- **Décisions VERROUILLÉES par Monsieur (2026-06-21) — ne pas re-litiguer :**
  1. **Si l'utilisateur choisit l'IA → FULL conversationnel** (pas adaptatif) : l'IA pose **toujours** des questions avant de rédiger. Qualité/personnalisation > vitesse **quand l'utilisateur a choisi l'IA**. (Le choix IA/manuel par message = story 7-2, hors de cette story.)
  2. **Frontière des surfaces :** le **copilote gère TOUTE la partie IA** ; l'**application gère TOUT le manuel**. Le composeur one-shot « Générer » disparaît comme **concept**.
- **Réutilisation, pas reconstruction :** le copilote sait DÉJÀ rédiger un brouillon (`composeMessage` → pipeline Composeur Epic 3 : few-shot voix, `sanitize()`, `generation_events`, historique injecté). Le pivot = **changer le COMPORTEMENT** (poser des questions d'abord, calibrer la familiarité) et **porter P1/P2** dans le moteur, **pas** réécrire le pipeline. [Source: sprint-change-proposal-2026-06-21-pivot-copilote.md#3]
- **Corrections de prompt P1/P2 (tirées des verdicts F3) à porter :**
  - **P1 — récence ≠ oubli :** un point de contact concret et **récent** (un entretien il y a quelques mois) implique que l'autre se souvient. NE PAS présumer l'oubli ; référencer l'événement en supposant que l'autre s'en souvient (« suite à notre entretien Programisto… »), pas s'excuser d'exister.
  - **P2 — ne pas minimiser l'interaction :** « on s'était croisés » sous-vend un entretien. Nommer l'interaction réelle au bon niveau, à partir des faits fournis.
  - **Principe transverse :** distance sociale (proches / pas proches) et mémoire (se souvient / a oublié) sont **deux axes distincts** — « pas proches » n'implique pas « m'a oublié ». [Source: compte-rendu-test-dogfood-copilote.md#F3]

## Acceptance Criteria

1. **Le copilote pose des questions AVANT de rédiger (full conversationnel)**
   **Given** une demande de rédaction où le contexte relationnel clé manque ou est ambigu (relation ? récence ? objectif ?)
   **When** l'utilisateur demande au copilote d'écrire à un contact (« écris à X »)
   **Then** le copilote **ne génère pas immédiatement** : il pose **au moins une question ciblée** pour capter le contexte relationnel manquant (comment tu le connais, dernière interaction et **quand**, ce que tu veux obtenir) **avant** d'appeler `composeMessage`. (Comportement piloté par le `SYSTEM_PROMPT` + la description de `composeMessage` ; vérifié au dogfood, parité « confirmation avant écriture » des autres tools.)

2. **Le contexte capté est injecté dans la génération**
   **Given** que l'utilisateur a répondu aux questions du copilote (relation, récence, objectif)
   **When** le copilote appelle ensuite `composeMessage`
   **Then** les faits captés (la relation réelle, l'événement de contact et **sa récence**, l'objectif) sont passés au pipeline via l'argument `idea` (et bénéficient de l'historique injecté si présent) — le moteur reçoit le contexte au lieu de le deviner. **Aucun fait n'est inventé** : seuls les éléments dictés par l'utilisateur servent (parité « n'invente jamais de faits »).

3. **P1 — la génération calibre la familiarité sur la RÉCENCE, pas seulement la proximité**
   **Given** un `idea` qui porte un point de contact concret et récent (« entretien Programisto il y a quelques mois », « pas spécialement proches »)
   **When** le pipeline produit le message
   **Then** le texte **ne présume PAS l'oubli** (pas de « tu te souviens de moi ? », pas d'excuse d'exister) ; il référence l'événement en supposant que l'autre s'en souvient. (Règle injectée dans le prompt de génération, `prompt.server.ts`.)

4. **P2 — la génération ne minimise pas l'interaction passée**
   **Given** un `idea` qui nomme une interaction réelle (un entretien)
   **When** le pipeline produit le message
   **Then** le texte nomme l'interaction au **bon niveau** (un entretien = un entretien), sans la diluer en « on s'était croisés » ni autre euphémisme qui sous-vend le lien.

5. **Deux axes distincts (distance sociale ≠ mémoire)**
   **Given** un `idea` indiquant « pas proches » **mais** un contact récent/concret
   **When** le pipeline produit le message
   **Then** « pas proches » n'entraîne **pas** « m'a oublié » : le ton peut rester mesuré (distance sociale) **sans** présumer l'amnésie (mémoire). Les deux axes sont traités séparément dans le prompt.

6. **`PROMPT_VERSION` incrémentée (traçabilité de la recette)**
   **Given** que P1/P2 changent de façon **observable** la fabrication du prompt de génération
   **When** la story est livrée
   **Then** `PROMPT_VERSION` passe de `3` à `4` dans [prompt.server.ts](../../plume/src/lib/prompt.server.ts), avec un commentaire de version (parité v2/v3) expliquant le changement (calibrage récence/mémoire). Les `generation_events` futurs portent `prompt_version=4` (SM-1 reste traçable par recette).

7. **« Améliorer » est absorbé par la boucle conversationnelle (pas de nouveau tool)**
   **Given** un brouillon déjà produit par le copilote
   **When** l'utilisateur demande un ajustement (« rends-le plus court », « moins formel »)
   **Then** le copilote **re-rédige** en rappelant `composeMessage` avec une `idea` affinée (l'itération conversationnelle EST l'amélioration) — **aucun** tool `improve` distinct n'est ajouté au copilote dans cette story. (Le mode `improve` déterministe reste celui du composeur, ré-évalué en 7-2.)

8. **Réutilisation stricte de l'infra Epic 3 (zéro réinvention)**
   **Given** le pipeline existant (`composeInVoice`, `sanitize()`/`finalizeText`, few-shot voix, `clampHistorique`, `generation_events`, `createDraft`)
   **When** la story est livrée
   **Then** **aucune** de ces briques n'est dupliquée ni réécrite : le copilote continue de les **consommer** via `composeMessage`. Pas de nouveau moteur de génération, pas de second chemin `sanitize`, **aucune migration de schéma**.

9. **Non-régression du pipeline partagé (composeur route + copilote)**
   **Given** que `prompt.server.ts` est partagé par le copilote (`composeMessage`) ET la route composeur (`/api/composer`)
   **When** P1/P2 sont ajoutés au prompt
   **Then** les deux surfaces bénéficient des corrections (P1/P2 améliorent aussi le composeur encore présent) ; le **mode `improve` reste inchangé** (P1/P2 ne touchent que la génération `generate`, là où l'IA ouvre/devine la relation — `improve` retravaille un texte déjà écrit par l'humain, l'IA n'y devine rien) ; la signature de `composeMessage` (`idea`/`canal`/`tone`/`contactId`) est **inchangée**.

10. **Évals de voix (story 3.9) re-baseline si nécessaire**
    **Given** que le bump `PROMPT_VERSION` + P1/P2 changent la recette de génération
    **When** la suite de tests tourne
    **Then** [tests/evals/voice-evals.test.ts](../../plume/tests/evals/voice-evals.test.ts) et [tests/composer/prompt.test.ts](../../plume/tests/composer/prompt.test.ts) sont **revus** : les assertions structurelles (Tells absents, longueur canal) restent vertes ; toute assertion qui fige une version/forme de prompt est mise à jour pour refléter v4 — **sans** affaiblir la garantie anti-Tells. (Les fixtures `claude-canned` restent déterministes.)

11. **`SYSTEM_PROMPT` du copilote : capacité reformulée, pas one-shot**
    **Given** le `SYSTEM_PROMPT` actuel qui décrit `composeMessage` comme « rédiger un BROUILLON »
    **When** la story est livrée
    **Then** l'énumération des capacités et les règles décrivent désormais la rédaction **conversationnelle** : capter le contexte relationnel par des questions ciblées AVANT `composeMessage`, calibrer sur la récence (P1/P2, deux axes), n'inventer aucun fait. La règle « tu RÉDIGES, tu n'ENVOIES JAMAIS » et le bloc LIENS (`/reseau/<contactId>`) restent **intacts**.

## Tasks / Subtasks

- [ ] **Task 1 — Porter P1/P2 dans le moteur de génération** (AC: #3, #4, #5, #6)
  - [ ] Dans [prompt.server.ts](../../plume/src/lib/prompt.server.ts), enrichir `SYSTEME_VOIX_BASE` (l.128) **OU** le tour utilisateur `consigne`/`adresse` (l.198-238) avec la règle P1/P2 : « Calibre la familiarité sur la RÉCENCE autant que sur la proximité. Un point de contact concret et récent implique que l'autre se souvient : NE présume PAS l'oubli (jamais "tu te souviens de moi ?", jamais s'excuser d'exister) ; référence l'événement en supposant qu'il s'en souvient. Nomme l'interaction au bon niveau (un entretien = un entretien), ne la minimise pas. Distance sociale (proches/pas proches) et mémoire (se souvient/a oublié) sont DEUX axes distincts : "pas proches" n'implique pas "m'a oublié". »
  - [ ] **Choix d'emplacement (à trancher par le dev, documenter) :** P1/P2 concerne l'**ouverture en `generate`** (où l'IA devine la relation). Le mettre dans `SYSTEME_VOIX_BASE` (préfixe cachable, stable) est le plus simple et profite au cache ; **vérifier** que ça ne pollue pas le mode `improve` (le système est partagé entre `generate` et `improve`, l.181-192). Si la règle gêne `improve` (où l'humain a déjà écrit), la cantonner au bloc `consigne` du mode `generate` uniquement (l.236-238). **Par défaut : bloc `generate` only**, pour ne pas risquer le mode `improve` (AC #9).
  - [ ] Incrémenter `PROMPT_VERSION` de `3` à `4` (l.41) + ajouter le commentaire de version « v4 (story 7.1) : calibrage récence/mémoire (P1/P2 dogfood) sur l'ouverture `generate` ». (AC #6)
- [ ] **Task 2 — Rendre le copilote conversationnel (SYSTEM_PROMPT)** (AC: #1, #2, #7, #11)
  - [ ] Dans [run.server.ts:63](../../plume/src/lib/agent/run.server.ts) (`SYSTEM_PROMPT`), reformuler la capacité `composeMessage` : ce n'est plus « rédige un brouillon » one-shot mais « rédige dans la voix de l'utilisateur APRÈS avoir capté le contexte relationnel ». Ajouter une **règle de cadrage** : « AVANT de rédiger un message (composeMessage), capte le contexte relationnel par des questions CIBLÉES si un élément clé manque ou est ambigu : comment l'utilisateur connaît ce contact, à quand remonte la dernière interaction (RÉCENCE), et l'objectif du message. Ne devine JAMAIS la relation ; pose la/les question(s), puis rédige. Calibre sur la récence : un contact récent n'a pas oublié l'utilisateur — ne présume pas l'oubli. N'invente aucun fait : n'utilise que ce que l'utilisateur a répondu. »
  - [ ] Préciser que l'**amélioration** se fait en re-rédigeant (rappel de `composeMessage` avec une idée affinée), pas via un outil séparé (AC #7).
  - [ ] **NE PAS toucher** : la règle « tu RÉDIGES, tu n'ENVOIES JAMAIS » (l.71-73), le bloc ARCHIVAGE (l.74-77), le bloc LIENS (l.81-87), la règle « traite uniquement le DERNIER message » (l.88-89). Garder le prompt concis (coût/cache).
- [ ] **Task 3 — Renforcer la description du tool `composeMessage`** (AC: #1, #2)
  - [ ] Dans `buildTools` ([tools.server.ts](../../plume/src/lib/agent/tools.server.ts), entrée `composeMessage` ~l.775-832), enrichir la `description` : « N'appelle ce tool qu'APRÈS avoir capté le contexte relationnel (relation, récence de la dernière interaction, objectif). Passe ces faits dans `idea`. Ne devine pas la relation ; si un élément clé manque, pose une question d'abord. » La description **pilote** le comportement de l'agent (parité `archiveContact`/`setContactHistorique` qui imposent une confirmation). Ne PAS changer l'`inputSchema` (AC #9).
- [ ] **Task 4 — Tests** (AC: #3, #4, #5, #6, #9, #10)
  - [ ] [tests/composer/prompt.test.ts](../../plume/tests/composer/prompt.test.ts) : nouveaux cas sur `buildPrompt` (fonction pure, déterministe) — en mode `generate`, un `idea` portant « récent »/« entretien » produit un tour utilisateur qui **contient** la consigne récence/mémoire ; le mode `improve` reste **identique** (non-régression P1/P2 hors `improve`, AC #9) ; `PROMPT_VERSION === 4` (AC #6).
  - [ ] [tests/evals/voice-evals.test.ts](../../plume/tests/evals/voice-evals.test.ts) : re-baseline si une assertion fige la version/forme du prompt ; **garder vertes** les garanties anti-Tells et longueur canal (AC #10). Utiliser les fixtures `claude-canned` existantes (déterministes).
  - [ ] Non-régression globale : `corepack pnpm test` vert, `corepack pnpm lint` + `corepack pnpm typecheck` propres (mode strict, 3 barrières ESLint). Le comportement conversationnel (AC #1) est piloté par prompt/description → **vérifié au dogfood**, pas testable unitairement (parité confirmation `archiveContact`).
- [ ] **Task 5 — Vérification dogfood manuelle (pilotée par prompt, non unitaire)** (AC: #1, #2, #3, #4, #5)
  - [ ] Rejouer le **tour 1** du dogfood (contact « Discord, ancien élève, entretien il y a qqs mois, pas proches ») : le copilote doit poser une question sur la relation/récence AVANT de rédiger, puis produire un message qui **ne présume pas l'oubli** et nomme l'entretien. Consigner le verdict dans le compte-rendu (F3 ligne 1 → « oui » attendu).

## Dev Notes

### Stratégie (lire avant de coder)
Cette story est **petite et surtout comportementale** : le copilote sait déjà rédiger (`composeMessage` branche le pipeline Composeur complet). On **ne touche ni le pipeline, ni `sanitize()`, ni `generation_events`, ni le schéma**. On change **trois textes** : (a) le `SYSTEM_PROMPT` du copilote (poser des questions avant de rédiger), (b) la `description` du tool `composeMessage` (même message, côté agent), (c) le prompt de génération `prompt.server.ts` (P1/P2 + bump version). Le reste est du test + une vérif dogfood.

### Le chemin de génération existant (à RÉUTILISER, ne pas réinventer)
- **`composeMessage`** ([tools.server.ts:327](../../plume/src/lib/agent/tools.server.ts)) : pure, résout le contact via `get` scopé (id inconnu/hors tenant → throw AVANT toute génération), choisit le canal (arg > préférence contact > défaut), appelle `deps.compose(...)` (= `composeInVoice`), injecte `clampHistorique(contact.historique)`, persiste un **brouillon** (`createDraft`, `statut="brouillon"`, journalisé). **Mode = `generate` implicite** (pas de `mode` passé → `composeInVoice` reçoit `undefined` → `buildPrompt` défaut `generate`). Signature `idea`/`canal`/`tone`/`contactId` — **inchangée** par cette story.
- **`composeInVoice`** ([pipeline.server.ts:197](../../plume/src/lib/composer/pipeline.server.ts)) : assemble le corpus voix (`assembleVoiceCorpus` = seeds + messages envoyés, top 5 récents), construit le prompt (`buildPrompt`), génère, **`finalizeText`** applique `sanitize()` en boucle re-validée (l.33-41). Inchangé.
- **`buildPrompt`** ([prompt.server.ts:178](../../plume/src/lib/prompt.server.ts)) : `system` = [`SYSTEME_VOIX_BASE`, few-shot (cache_control éphémère)] ; tour utilisateur = contrainte canal + adresse + historique (`generate` only) + `consigne` (`generate`/`improve`). **C'EST ICI que P1/P2 atterrissent.** Le `system` est **partagé** `generate`/`improve` (l.181) → si P1/P2 va dans `SYSTEME_VOIX_BASE`, il s'applique aussi à `improve` ; **par défaut, mettre P1/P2 dans le bloc `consigne` du mode `generate`** (l.236-238) pour cantonner la règle à l'ouverture devinée et préserver `improve` (AC #9).
- **`generation_events`** : écrits **à l'envoi** (`markSent`, [message-repositories.ts:374](../../plume/src/lib/db/message-repositories.ts)), pas à la génération du brouillon — `composeMessage` ne crée qu'un draft. Le bump `PROMPT_VERSION` se propage automatiquement via `composeInVoice` (l.83 `promptVersion: PROMPT_VERSION`). Rien à câbler. (SM-1 reste mesuré à l'envoi.)

### Pourquoi « full conversationnel » est piloté par le prompt, pas par du code
La décision « l'IA pose TOUJOURS des questions avant de rédiger » est un **comportement de l'agent**, obtenu par le `SYSTEM_PROMPT` + la `description` du tool (comme la confirmation obligatoire d'`archiveContact`/`setContactHistorique` est pilotée par texte, pas par une garde de code). On **n'ajoute pas** de machine à états « question→réponse→génération » : la boucle tool-use (`MAX_STEPS=8`, [run.server.ts:60](../../plume/src/lib/agent/run.server.ts)) laisse l'agent poser une question (tour texte sans tool-call), recevoir la réponse au tour suivant, puis appeler `composeMessage`. C'est exactement le flux conversationnel existant. **Ne pas sur-ingénier.**

### Frontière de scope — ce qui N'EST PAS dans 7-1 (anti-scope-creep)
- **Retrait du composeur one-shot / choix IA vs manuel par message** → **story 7-2** (FR-36). Tant que 7-2 n'a pas posé le chemin manuel dans l'app, **on ne supprime PAS** les boutons « Générer »/« Améliorer » du composeur ([ComposerSheet.tsx](../../plume/src/features/composer/ComposerSheet.tsx)) : le système doit rester fonctionnel de bout en bout. 7-1 **ajoute** le comportement conversationnel au copilote ; 7-2 **bascule** la surface. (P1/P2 profitent au composeur encore présent, AC #9 — pas un effet de bord, un bonus voulu.)
- **Capture du contexte à la création de contact** (questions à la création, alimente `historique`) → **story 7-3** (FR-38). 7-1 capte le contexte **au moment de rédiger** ; 7-3 le capte **une fois, à la création**, et le réutilise. Ne pas anticiper 7-3 ici.
- **Icône étincelle dupliquée (F12), label locuteur (F9), markdown réhydraté (F7), refresh fermé (F14)** → **story 7-8**. Hors 7-1.
- **Palier Sonnet / registre modèle** → **story 7-7** (F13). 7-1 ne touche pas la sélection de modèle.
- **Redéfinition SM-1 / Jalon R1** = **porte de décision PM/Architecte**, PAS une story de dev. 7-1 ne la traite pas (mais la rend possible : la voie conversationnelle qu'elle livre est celle sur laquelle R1 sera rejoué). [Source: sprint-status.yaml#GATE avant Epic 4]

### Invariants & barrières (NON négociables — project-context.md)
- **Appels Claude serveur-only** : `prompt.server.ts` et `run.server.ts` portent `import "server-only"` / `.server.ts` — la clé ne fuit jamais au client. Ne pas exposer le prompt côté client.
- **`sanitize()` reste le filet déterministe en aval** : P1/P2 sont des consignes de prompt ; elles **ne remplacent pas** `sanitize()` (Tells strippés en post-traitement). Ne pas relâcher la garde anti-Tells.
- **FR & commentaires de code en français.** Microcopy FR. Erreurs UI = teinte douce (n/a ici, logique serveur/prompt).
- **Scope tenant clos par closure** (SÉCU #3) : `composeMessage` résout déjà via `get` scopé ; `userId`/`turnId` jamais des arguments d'agent. Inchangé.
- **Prompt caching** : `SYSTEME_VOIX_BASE` + few-shot forment le préfixe cachable (césure `cache_control` l.190). Si P1/P2 va dans `SYSTEME_VOIX_BASE`, le préfixe change **une fois** (acceptable) ; s'il va dans `consigne` (tour user, volatil), le cache n'est pas affecté — **argument de plus pour le bloc `generate` only.**

### Fichiers à toucher
- **[plume/src/lib/prompt.server.ts](../../plume/src/lib/prompt.server.ts)** — P1/P2 dans la consigne `generate` (défaut) + `PROMPT_VERSION` 3→4 + commentaire version. NE PAS toucher au mode `improve`, à la césure cache, aux contraintes canal.
- **[plume/src/lib/agent/run.server.ts](../../plume/src/lib/agent/run.server.ts)** — `SYSTEM_PROMPT` : reformuler la capacité `composeMessage` + règle « poser des questions avant de rédiger / calibrer récence / ne rien inventer ». NE PAS toucher aux règles ENVOI/ARCHIVAGE/LIENS.
- **[plume/src/lib/agent/tools.server.ts](../../plume/src/lib/agent/tools.server.ts)** — `description` du tool `composeMessage` enrichie (capter le contexte avant d'appeler). NE PAS toucher l'`inputSchema`, la fonction pure, ni `WRITE_TOOL_NAMES`.
- **[plume/tests/composer/prompt.test.ts](../../plume/tests/composer/prompt.test.ts)** + **[plume/tests/evals/voice-evals.test.ts](../../plume/tests/evals/voice-evals.test.ts)** — couverture P1/P2 `generate`, non-régression `improve`, `PROMPT_VERSION===4`, re-baseline éval si besoin.
- **Lecture seule (comprendre, ne pas modifier)** : [pipeline.server.ts](../../plume/src/lib/composer/pipeline.server.ts) (`composeInVoice`, `finalizeText`/`sanitize`), [message-repositories.ts](../../plume/src/lib/db/message-repositories.ts) (`markSent`/`generation_events`), [ComposerSheet.tsx](../../plume/src/features/composer/ComposerSheet.tsx) (composeur one-shot — **ne pas retirer**, c'est 7-2).

### Testing standards
- Runner : **Vitest** (`corepack pnpm test` dans `plume/`). Tests db en mémoire, repos scopés injectés.
- **Frontière de test = la fonction pure `buildPrompt`** (déterministe, sans SDK) pour P1/P2 et `PROMPT_VERSION`. Les évals voix utilisent les **fixtures `claude-canned`** ([tests/fixtures/claude-canned/voice-basket.ts](../../plume/tests/fixtures/claude-canned/voice-basket.ts)) → pas d'appel réseau, déterministe.
- Le comportement **conversationnel** (AC #1 : poser des questions) est piloté par le `SYSTEM_PROMPT`/`description` → **non testable unitairement**, vérifié au **dogfood** (Task 5), parité de la confirmation `archiveContact`.
- **Definition of done** : nouveaux tests verts ; tous les tests existants restent verts (ou re-baseline justifié pour le bump version) ; `pnpm lint` + `pnpm typecheck` passent (strict, 3 barrières ESLint).

### Project Structure Notes
- Alignement OK : tout vit dans les frontières serveur existantes (`prompt.server.ts`, `run.server.ts`, `tools.server.ts`). **Aucune nouvelle table, aucune migration, aucun nouveau fichier de prod.** La story est additive (3 éditions de texte) + tests.
- Variance : `PROMPT_VERSION` passe à 4 — propagation automatique dans `generation_events.prompt_version` via `composeInVoice`. Pas de back-fill (les events passés gardent leur version, c'est le but de la traçabilité).

### References
- [Source: docs/planning-artifacts/epics.md#Story 7.1] — énoncé : router Générer/Améliorer/canal-aware/few-shot/sanitize/historique dans le flux conversationnel ; l'IA pose toujours des questions ; réutilise `composeInVoice`/sanitize/`generation_events` ; porte P1/P2 ; re-route FR-7/8/9/13/35.
- [Source: docs/planning-artifacts/sprint-change-proposal-2026-06-21-pivot-copilote.md] — décisions verrouillées (full conversationnel, copilote=IA/app=manuel), infra re-routée non jetée, P1/P2 à porter au prompt copilote au moment de 7-1 (§4.4), SM-1/R1 à redéfinir (porte, pas story).
- [Source: docs/implementation-artifacts/compte-rendu-test-dogfood-copilote.md#F3] — verdicts tour 1 (oubli présumé) vs tour 2 (relation claire) ; pistes P1 (récence ≠ oubli), P2 (ne pas minimiser), principe deux axes.
- [Source: docs/implementation-artifacts/compte-rendu-test-dogfood-copilote.md#Piste produit majeure] — full conversationnel, le copilote existe déjà (chat + tools + persistance), le pivot = router la rédaction, pas une nouvelle infra.
- [Source: plume/src/lib/agent/run.server.ts:63] — `SYSTEM_PROMPT` actuel (énumération capacités, règle ENVOI, ARCHIVAGE, LIENS) ; [:60] `MAX_STEPS=8` (boucle tool-use porte le tour question→génération).
- [Source: plume/src/lib/agent/tools.server.ts:327] — `composeMessage` (pure, résout contact, mode `generate` implicite, injecte historique, persiste brouillon) ; [:775] entrée `tool({...})` `composeMessage`.
- [Source: plume/src/lib/prompt.server.ts:41] — `PROMPT_VERSION=3` (à passer à 4) ; [:128] `SYSTEME_VOIX_BASE` ; [:178] `buildPrompt` (system partagé generate/improve, césure cache l.190) ; [:208-238] historique + `consigne` generate/improve (cible P1/P2).
- [Source: plume/src/lib/composer/pipeline.server.ts:197] — `composeInVoice` (corpus voix, `buildPrompt`, `finalizeText`/`sanitize`) ; [:83] `promptVersion: PROMPT_VERSION` propagé.
- [Source: plume/src/lib/db/message-repositories.ts:374] — `generation_events` écrits à `markSent` (envoi), SM-1 `editDistance`.
- [Source: docs/project-context.md] — moat « ta voix », sanitize post-traitement déterministe, Claude serveur-only, FR-only, scope `user_id`, anti look-IA.
- [Source: docs/implementation-artifacts/7-4-write-tool-updatecontact-handles-confirmation-rewind.md] — patron : comportement de confirmation piloté par description tool + SYSTEM_PROMPT, vérifié au dogfood (parité pour AC #1).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
