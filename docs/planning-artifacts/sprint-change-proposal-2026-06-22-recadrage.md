# Sprint Change Proposal — Recadrage « où on en est » (2026-06-22)

**Date :** 2026-06-22
**Auteur :** Monsieur (via correct-course)
**Mode :** Incrémental
**Déclencheur :** « On a rajouté pas mal de choses un peu partout, je m'y retrouve plus — recadrage pour savoir exactement où on en est. »

---

## Section 1 — Résumé de l'enjeu

Aucune dérive de **dev** : Epic 7 (pivot copilote) avance proprement et linéairement. Le désordre est **documentaire** — des fils de planification ouverts en parallèle n'ont jamais été réintégrés dans les artefacts de suivi (`epics.md`, `sprint-status.yaml`), d'où la perte de repères :

1. **Epic 8 « Campagne »** vivait comme PRD `status: final` + brief, **absent de `epics.md` et de `sprint-status.yaml`**.
2. **Lignée `copilote-phase-N`** (5 specs/stories) toutes `done`, volontairement hors `sprint-status` mais sans pointeur visible → perçues comme orphelines.
3. **6 fichiers non commités** (stories Epic 7, brief+PRD Campagne, guide setup, sprint-status modifié).

## Section 2 — Analyse d'impact

- **Position build order :** Epic 1-3 ✅ · **Epic 7 en cours (5/10)** · ⛔ Jalon R1 (porte) · Epic 4 → 5 · Epic 6 différé · **Epic 8 planifié, non démarré**.
- **Epic 7 :** done = 7-1, 7-3, 7-4, 7-6, 7-8. Backlog = 7-2 (next), 7-5, 7-7, 7-9, 7-10.
- **Portes de décision ouvertes (pas des stories) :** Jalon R1 GO/PIVOT + redéfinition SM-1 pour la voie conversationnelle, avant d'investir Epic 4-6 et Epic 8.
- **Artefacts impactés :** `epics.md` (manquait Epic 8), `sprint-status.yaml` (manquait Epic 8 + pointeur lignée copilote).

## Section 3 — Approche recommandée

**Direct Adjustment** — aucune réouverture de story, aucun rollback. Réintégration documentaire pure :

1. Intégrer **Epic 8** à `epics.md` (Epic List + section détaillée, 8 stories-stubs mappant FR-40→55 / NFR-7→10).
2. Ajouter **Epic 8** à `sprint-status.yaml` (8 lignes `backlog` + bloc de cadrage + pré-requis de séquencement).
3. Documenter la **lignée `copilote-phase-N`** (toutes `done`) par un bloc-pointeur dans `sprint-status.yaml`.
4. Committer les artefacts non suivis.

## Section 4 — Changements détaillés

- `epics.md` : intro « 6 epics » → « 8 epics » ; entrée Epic 8 dans l'Epic List ; section `## Epic 8` complète (origine, garde-fous légal/coût, 8 stories-stubs).
- `sprint-status.yaml` : bloc commenté lignée copilote-phase-N ; bloc `epic-8` (8-1 → 8-8, tous `backlog`) ; note `last_updated`.
- Nouveau : ce document.

## Section 5 — Handoff

**Scope : Mineur → Modéré (réorg backlog documentaire).** Aucune action dev immédiate déclenchée.

- **Prochaine action dev :** story **7-2** (choix IA/manuel par message), puis suite de l'ordre Epic 7.
- **Avant Epic 8 :** clôturer Epic 7, passer le Jalon R1 GO, trancher les 2 Open Questions PRD (quota dur PDL NFR-7 ; intervalle re-check FR-43), traiter le garde-fou RGPD art. 14 avant tout SaaS.
- **Critère de succès du recadrage :** `git status` propre, `epics.md`/`sprint-status.yaml` reflètent l'intégralité du périmètre (Epic 1→8), zéro fil de planif hors suivi.
