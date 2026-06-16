---
name: story-loop
description: Pilote autonome du cycle de dev BMad pour Plume/job-pipeline — create-story → dev → review → PR → merge → story suivante. Décide seul de paralléliser les stories indépendantes via sous-agents isolés, sinon série. Conçu pour tourner sous /loop dans une conv fraîche. Triggers — /story-loop, story-loop, loop dev autonome, enchaîne les stories, dev les stories en boucle.
---

# story-loop — pilote autonome du cycle de dev

Tu es l'orchestrateur d'un cycle de dev BMad **sans intervention humaine**. À **chaque tick** : lis l'état, fais avancer le travail d'un cran (1 story, ou un batch de stories parallèles), mets l'état à jour, puis **soit continue, soit stoppe** à un gate. L'état canonique vit dans `sprint-status.yaml` → tout est **reprenable** si coupé.

## Modes d'invocation (aucun `/` requis)

Ce skill se déclenche de **3 façons équivalentes** — pas besoin de slash commands :
- **Langage naturel** : Monsieur écrit « lance story-loop », « enchaîne les stories en autonomie », « dev les stories en boucle » → tu invoques ce skill.
- **Boucle interne (défaut sans `/loop`)** : une fois invoqué, **enchaîne les ticks toi-même** dans le même run — fais story après story (ou batch après batch) **jusqu'à un gate ou la fin du `SCOPE`**. Ne rends la main que sur un gate. C'est le mode normal quand `/loop` n'est pas disponible.
- **Sous `/loop /story-loop`** (si dispo) : le harness te ré-invoque ; chaque ré-invocation = un tick. Même comportement, juste piloté de l'extérieur.

Dans tous les cas la logique ci-dessous est identique : l'état dans `sprint-status.yaml` rend le travail reprenable quel que soit le mode.

## 0. Pré-vol (à chaque tick)

1. **Où suis-je ?** Idéalement lancé depuis le **repo principal** `C:\Users\P0ulpy\Documents\GitHub\job-pipeline` (là où vivent `_bmad/`, `docs/`, `.claude/` — tous gitignored, absents des worktrees). Si `cwd` est un worktree, utilise les **chemins absolus** ci-dessous pour tout artefact BMad.
2. **Charge la config** depuis `docs\implementation-artifacts\LOOP-RUNBOOK.md` (table des params : `MERGE`, `FAIL`, `SCOPE`, `REVIEW`, `PARALLEL`, `MAX_PARALLEL`). Si absent → defaults : `MERGE=PR/story→main(squash)`, `FAIL=stop+escalade`, `SCOPE=1-story`, `REVIEW=sous-agent isolé`, `PARALLEL=auto`, `MAX_PARALLEL=3`.
3. **Charge l'état** : lis **tout** `docs\implementation-artifacts\sprint-status.yaml` (du début à la fin, dans l'ordre — l'ordre = l'ordre de build).
4. **Vérifie git/gh** : `git fetch origin`, `gh auth status`. Échec gh/git → **gate Échec**.

### Chemins absolus (repo principal)
- sprint-status : `C:\Users\P0ulpy\Documents\GitHub\job-pipeline\docs\implementation-artifacts\sprint-status.yaml`
- runbook : `C:\Users\P0ulpy\Documents\GitHub\job-pipeline\docs\implementation-artifacts\LOOP-RUNBOOK.md`
- epics : `C:\Users\P0ulpy\Documents\GitHub\job-pipeline\docs\planning-artifacts\epics.md`
- architecture : `C:\Users\P0ulpy\Documents\GitHub\job-pipeline\docs\planning-artifacts\architecture.md`
- config BMad : `C:\Users\P0ulpy\Documents\GitHub\job-pipeline\_bmad\config.toml`
- repo : `https://github.com/DoriannX/job-pipeline`, base merge = `main`, issue de suivi = `#93`.

## 1. Calculer le ready-set + décider parallèle vs série (le cœur de l'autonomie)

Statuts story possibles : `backlog → ready-for-dev → in-progress → review → done`.

1. **Epic actif** = l'epic non-`done` le plus haut dans l'ordre de build (`1 → 2 → 3 → [R1] → 4 → 5` ; Epic 6 hors MVP). **Ne franchis jamais une frontière d'epic en parallèle** — barrière dure entre epics.
2. **Construis le graphe de dépendances** de l'epic actif depuis :
   - les notes d'ordre en tête de `sprint-status.yaml` (ex. « `3.9` après `3.2/3.3/3.6` ; `4.3` étend `4.1` »),
   - les indices « depends on / prérequis » dans `epics.md`,
   - **règle dure** : `1-1` (scaffold du starter) est prérequis de **tout** — rien d'autre ne tourne tant que `1-1` n'est pas `done`.
3. **Ready-set** = stories de l'epic actif au statut `backlog` ou `ready-for-dev` dont **toutes** les deps sont `done`.
4. **Décision parallèle (tu la prends seul)** :
   - Si `PARALLEL=off` ou `SCOPE=1-story` → **batch = 1** (série).
   - Si `1-1` pas encore `done` → **batch = 1** (solo, tout en dépend).
   - Sinon, parmi le ready-set, garde un sous-ensemble **mutuellement indépendant** *et* **à surface disjointe** (estime les fichiers/dossiers touchés depuis `epics.md`/architecture ; en cas de doute de chevauchement → **sérialise**, ne devine pas). Batch = `min(taille de ce sous-ensemble, MAX_PARALLEL)`.
   - `log` ta décision : quelles stories, pourquoi parallèle ou série, surfaces estimées.
5. **Rien dans le ready-set** mais epic actif a des stories `review`/`in-progress` → reprends celles-là (résumé du tick précédent). Toutes les stories de l'epic `done` → **avance l'epic** (ou gate R1, cf. §4).

## 2. Exécuter le batch

Pour **chaque** story du batch, le cycle complet est : `BRANCH → CREATE STORY → DEV+tests → REVIEW`. La phase exécutée dépend du statut courant (reprenable) :
- `backlog` → CREATE STORY (`bmad-create-story` create) → statut `ready-for-dev`, epic → `in-progress`.
- `ready-for-dev` → DEV (`bmad-dev-story`) : implémente tâches + tests, lance la suite. Rouge → **gate Échec**. Vert → statut `review`.
- `review` → REVIEW (cf. ci-dessous). Approuvé → prêt à merger. Rejeté → **gate Échec**.

### Batch = 1 (série)
Exécute les phases inline dans ce contexte. Branche : `git checkout -b story/<id> origin/main`.

### Batch > 1 (parallèle) — sous-agents isolés
Lance **un sous-agent par story**, **en parallèle dans le même message** (plusieurs appels `Agent`), avec **`isolation: "worktree"`** (chaque story édite sa propre copie → zéro conflit de fichiers concurrents). Brief de chaque sous-agent :
- « Implémente la story `<id>` de Plume de bout en bout : lis le spec via `bmad-create-story` (ou le fichier story s'il existe), implémente le code + tests sur une branche `story/<id>` basée sur `origin/main`, lance les tests jusqu'au vert. Utilise les chemins absolus du repo principal pour les artefacts BMad. **Ne merge pas, ne crée pas de PR.** Retourne : `{id, branch, files_touched, tests: pass|fail, summary, blockers}`. »
- Le sous-agent étant son **propre contexte**, il satisfait l'exigence BMad « review en contexte frais » pour sa propre boucle dev.
- Récupère les résultats. Toute story `tests: fail` ou avec `blockers` → exclue du merge → **gate Échec** pour celle-là (les autres peuvent continuer).

### REVIEW (toujours en contexte isolé)
Lance `bmad-code-review` **OU** un sous-agent `Agent` dédié (lens adversarial : ACs respectées ? régressions ? invariants archi — scoping `user_id`, `sanitize()` idempotent, machine à états, horloge injectée — cf. `architecture.md`). Le sous-agent retourne `{verdict: approve|reject, findings[]}`. `reject` → **gate Échec** (selon `FAIL`).

## 3. Merge — **toujours sérialisé** (point de synchronisation)

Même si plusieurs stories ont été dev'd en parallèle, **merge une par une** pour éviter les races :
1. Pour chaque story prête (tests verts + review `approve`), dans l'ordre de dépendance :
   - `git fetch origin && git rebase origin/main` sur la branche `story/<id>` (rejoue sur le main à jour).
   - Conflit de rebase → **gate Échec** (stop+escalade ; ne devine pas une résolution sémantique).
   - Re-lance les tests après rebase. Rouge → **gate Échec**.
   - `git push -u origin story/<id>` ; `gh pr create --base main --title "<id> <slug>" --body "<résumé + lien story + refs #93>"`.
   - `gh pr merge --squash --delete-branch`.
   - **Exception 1ʳᵉ story du tout premier run (`SCOPE=1-story`)** : **pause eyeball** — crée la PR, **ne merge pas**, rapporte à Monsieur et **stoppe** (il valide le harness avant qu'on élargisse).
2. Après chaque merge : `sprint-status.yaml` story → `done` ; si toutes les stories de l'epic `done` → epic → `done`. `last_updated` = date courante.

## 4. Mettre à jour le suivi + gates de fin

1. **Issue #93** (skill `updating-github-issues`) : commentaire de statut court (stories mergées ce tick, prochaine, ou gate atteint) ; carte board → colonne adéquate (In progress / In review / Done). Non bloquant.
2. **Gates qui STOPPENT la boucle** (rapporte clairement à Monsieur et **n'enchaîne pas** — pour /loop, signale que le travail est en pause) :
   - **Tests rouges** (selon `FAIL`, défaut stop+escalade ; si `FAIL=retry-1×` : relance `bmad-dev-story` une fois, encore rouge → stop).
   - **Review rejette**.
   - **Conflit de rebase/merge, échec push/`gh`**.
   - **Jalon R1 GO/PIVOT** — déclenché quand **toutes** les stories d'Epic 3 sont `done`. **Stop humain obligatoire** : Monsieur mesure SM-1 (Levenshtein normalisée médiane) sur 20-30 vrais messages → médiane < 20 % = GO (ouvre Epics 4-6) ; ≥ 20 % = PIVOT (rouvrir le mécanisme de Voix). La boucle **ne franchit jamais R1 seule**.
   - **`SCOPE` atteint** (`1-story` après 1 story ; `until-R1` au gate R1 ; `mvp` quand Epic 5 `done`).
3. **Sinon** → il reste du travail dans le scope → **enchaîne directement le tick suivant** (boucle interne : retour au §1 PICK pour le prochain ready-set). Sous `/loop`, laisse le harness ré-invoquer à la place. Ne t'arrête jamais « parce que le tick est fini » — seulement sur un gate.

## Paramètres (édités dans LOOP-RUNBOOK.md, lus à chaque tick)

| Param | Défaut | Effet |
|---|---|---|
| `SCOPE` | `1-story` | `1-story` (valide le harness) → `until-R1` → `mvp`. Élargir = changer ici. |
| `FAIL` | `stop+escalade` | ou `retry-1×` (1 relance dev avant stop). Jamais de merge de code rouge. |
| `MERGE` | `PR/story→main (squash)` | porte de merge sérialisée, rebase sur main à jour. |
| `PARALLEL` | `auto` | `auto` = décide seul (deps + surfaces disjointes) ; `off` = toujours série. |
| `MAX_PARALLEL` | `3` | plafond de sous-agents concurrents. |
| `REVIEW` | `sous-agent isolé` | review en contexte frais (reco BMad). |

## Invariants à ne jamais violer

- **Une story de l'Epic N+1 ne démarre pas tant que l'Epic N n'est pas `done`** (barrière d'epic). Parallélisme **uniquement intra-epic**.
- **`1-1` solo et en premier** (tout dépend du starter).
- **Merge sérialisé**, jamais de merge parallèle vers `main`.
- **Jamais franchir R1** sans décision humaine GO/PIVOT.
- **Jamais merger** des tests rouges ou une review `reject`.
- Stack cible = **Next.js + Turso/libSQL + API Claude** (PWA). `src/` Python actuel = ancien pipeline mail, hors périmètre.
