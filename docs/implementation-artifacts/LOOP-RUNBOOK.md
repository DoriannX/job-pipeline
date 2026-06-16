# LOOP-RUNBOOK — cycle de dev autonome (Plume / job-pipeline)

> Définition durable du loop « create-story → dev → review → PR → merge → story suivante ».
> Source de vérité de l'ordre et de l'état : `sprint-status.yaml` (même dossier).
> Décidé avec Monsieur le 2026-06-16. Réutilisable : élargir = changer `SCOPE` ci-dessous.

## Paramètres de run (décisions actées)

| Param | Valeur |
|---|---|
| **MERGE** | Une branche + une PR par story → merge dans `main` (squash). |
| **ÉCHEC** | `stop + escalade` : tests rouges ou review rejetée → **halte le loop**, ping Monsieur, jamais de merge de code cassé. |
| **PERMISSIONS** | yolo ON (allows larges dans `~/.claude/settings.json`). Réversible : `/yolo-off`. |
| **SCOPE (run courant)** | **1 story** (`1-1`) puis stop = validation du harness. Élargir ensuite à `until-R1` puis `mvp`. |
| **REVIEW** | `bmad-code-review` lancé en **sous-agent isolé** (contexte frais ≈ reco BMad « autre contexte/modèle »). |
| **PARALLEL** | `auto` — le skill décide seul : stories indépendantes + surfaces disjointes → sous-agents isolés concurrents ; sinon série. `off` = toujours série. |
| **MAX_PARALLEL** | `3` — plafond de sous-agents dev concurrents. |

## Parallélisation (décision autonome du skill)

Le skill `story-loop` choisit seul parallèle vs série, **sans demander** :
- **Barrière d'epic dure** : parallélisme **uniquement intra-epic** (jamais franchir Epic N → N+1 en parallèle).
- **`1-1` solo et premier** : tout dépend du scaffold du starter.
- **Ready-set** = stories de l'epic actif dont toutes les deps sont `done`. Parmi elles, garde le sous-ensemble **mutuellement indépendant à surface disjointe** (doute de chevauchement de fichiers → sérialise). Batch = `min(taille, MAX_PARALLEL)`.
- **Dev en parallèle** = un sous-agent par story, `isolation: worktree` (copies isolées, zéro conflit). Chaque sous-agent = son propre contexte = satisfait « review en contexte frais ».
- **Merge toujours sérialisé** : rebase sur `main` à jour + tests, une PR à la fois → évite les races de merge. Conflit → stop+escalade.

## Ordre des stories (sprint-status.yaml)

Build : **Epic 1 → 2 → 3 → [Jalon R1 GO/PIVOT] → 4 → 5**. Epic 6 = hors MVP.
Intra-epic : `3.9` après `3.2/3.3/3.6` ; `4.3` étend `4.1`.
Prochaine story = 1ʳᵉ non-`done` dans cet ordre.

## Le cycle (par story)

1. **PICK** — lire `sprint-status.yaml`, prendre la prochaine story non-`done` selon l'ordre. Si toutes les stories d'Epic 3 sont `done` → **STOP gate R1** (voir Gates).
2. **BRANCH** — `git fetch origin` puis `git checkout -b story/<id> origin/main` (base = main à jour).
3. **CREATE STORY** — `bmad-create-story` (create) → écrit le fichier story dans `docs/implementation-artifacts/`. Statut story → `ready-for-dev`, epic → `in-progress`.
4. **VALIDATE** (option) — `bmad-create-story` (validate) si la story semble incomplète.
5. **DEV** — `bmad-dev-story` → implémente tâches + tests. Lancer la suite de tests. Rouge après tentative → **gate Échec**. Vert → statut → `review`.
6. **REVIEW** — `bmad-code-review` en **sous-agent isolé**. Rejet → **gate Échec** (stop+escalade). Approuvé → continuer.
7. **PR** — `git push -u origin story/<id>` puis `gh pr create --base main` (titre = id story, corps = résumé + lien story + issue #93).
8. **MERGE** — uniquement si tests verts **ET** review approuvée. `gh pr merge --squash --delete-branch`. *(1ʳᵉ story du run : pause eyeball avant merge.)*
9. **UPDATE** — story → `done` dans `sprint-status.yaml` ; epic → `done` si toutes ses stories `done`. Commentaire de statut sur l'issue #93 + carte board.
10. **NEXT** — si `SCOPE` atteint (1 story) → **STOP**. Sinon retour PICK.

## Gates qui STOPPENT le loop (escalade à Monsieur)

- **Tests rouges** (après politique de retry) → stop+escalade.
- **Review rejette** → stop+escalade.
- **Jalon R1 GO/PIVOT** (toutes stories Epic 3 `done`) → **stop humain obligatoire**. Mesurer SM-1 (Levenshtein normalisée médiane) sur 20-30 vrais messages → médiane < 20 % = GO (Epics 4-6) ; ≥ 20 % = PIVOT (rouvrir la Voix).
- **Conflit de merge / échec push / échec `gh`** → stop+escalade.
- **`SCOPE` atteint** → stop propre.

## Notes mécaniques

- `_bmad/` et `docs/` vivent dans le **repo principal** (untracked), absents des worktrees → lire/écrire via chemin absolu `C:\Users\P0ulpy\Documents\GitHub\job-pipeline\...`. Les fichiers story et `sprint-status.yaml` survivent aux changements de branche (hors git).
- Le **code** de la story va sur la branche `story/<id>` ; les **artefacts BMad** (story, sprint-status) restent dans le repo principal untracked.
- Stack cible = **Next.js + Turso/libSQL + API Claude** (PWA). Le `src/` Python actuel = ancien pipeline mail, hors périmètre Plume.
