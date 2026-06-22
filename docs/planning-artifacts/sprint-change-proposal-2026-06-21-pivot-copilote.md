# Sprint Change Proposal — Pivot copilote conversationnel (copilote = IA, app = manuel)

**Date :** 2026-06-21
**Auteur :** Monsieur (via correct-course)
**Mode :** Batch
**Profondeur retenue :** Cadrage + stubs (proposal + dépréciation FR + nouvel epic backlog avec stories-stubs ; re-spec détaillé différé story par story)
**Source :** [compte-rendu-test-dogfood-copilote.md](../implementation-artifacts/compte-rendu-test-dogfood-copilote.md) §« Piste produit majeure » + Synthèse
**Mémoire liée :** `copilote-pivot-conversationnel` (décisions verrouillées 2026-06-21)

---

## Section 1 — Résumé de l'enjeu

**Problème / opportunité :** au dogfood, la génération one-shot du composeur a échoué là où elle devait **deviner la relation** (tour 1 F3 : a présumé l'oubli sur un contact récent → message froid, non envoyable). Elle marche quand la relation est claire (tour 2). Constat central : **ne pas laisser l'IA deviner → lui faire poser les questions**.

**Déclencheur :** pivot stratégique émergé du test réel (pas un échec d'implémentation, pas un malentendu de specs). Catégorie checklist 1.2 = **strategic pivot**.

**Décisions VERROUILLÉES par Monsieur (2026-06-21) — ne pas re-litiguer :**
1. **Choix IA / manuel par message** — l'utilisateur décide à chaque message s'il veut l'IA ou pas. Pas d'imposition.
2. **Si IA → FULL conversationnel** (pas adaptatif) : l'IA pose **toujours** des questions avant de rédiger, et **à la création d'un contact**. Qualité/personnalisation > vitesse quand l'utilisateur a choisi l'IA.
3. **Frontière des surfaces :** le **copilote gère TOUTE la partie IA** ; l'**application gère TOUT le manuel** (écrire soi-même, sans IA).
4. **Conséquence :** le composeur one-shot « Générer » **disparaît comme concept**. La rédaction assistée vit dans le copilote (conversationnel) ; la rédaction manuelle dans l'app.

**Valeur :** le moat (différenciation anti-robot) repose sur la personnalisation. Une étape de questions ciblées capte le contexte relationnel que la génération one-shot devinait mal → supprime la classe de bugs « ton faux car relation mal devinée ».

---

## Section 2 — Analyse d'impact (checklist §2-3)

### Impact epics (§2)

- **Epic 3 « Le moat, bout en bout » (`done`)** — **conceptuellement amputé** de sa surface IA one-shot, mais **pas jeté** : l'infra reste et se **re-route** dans le copilote.
  - **Migre vers le copilote :** FR-7 (Générer), FR-8 (Améliorer), FR-9 (canal-aware), FR-13 (composeur en flow comme surface de génération), FR-14 (choix modèle), FR-35 (historique injecté).
  - **Reste partagé / réutilisé tel quel :** FR-11 `sanitize()` (AR-3), few-shot voix (FR-10, FR-16, FR-17), `generation_events`/SM-1 (AR-8), envoi+timeline (FR-18→FR-21). Le copilote **branche** ces briques au lieu de les refaire.
  - **Statut :** Epic 3 **n'est pas rouvert** (le shipped reste shipped) ; la dépréciation est portée par le PRD + le nouvel epic.
- **Nouvel Epic 7 « Copilote — surface IA unique »** (backlog) — absorbe la rédaction assistée conversationnelle + les write-tools manquants + les fixes UI/UX du dogfood. **Le copilote n'était dans AUCUN epic** (construit hors-epics via `docs/specs/spec-copilote-phase-1/2/3`) → cet epic l'**intègre officiellement** à la structure BMad.
- **Epic 4 (Aujourd'hui) / 5 (PWA) / 6 (push)** — pas d'impact fonctionnel direct. **Séquencement à trancher au sprint-planning** : le pivot redéfinit la boucle produit centrale et **conditionne le Jalon R1** (cf. ci-dessous) → recommandation = traiter Epic 7 **avant** d'investir Epic 4-6.

### Conflits artefacts (§3)

- **PRD (§3.1)** — impact cœur :
  - **Déprécier** la nature *one-shot* de FR-6→FR-14 / FR-35 : leur réalisation migre vers une surface **conversationnelle** (copilote). Le *quoi* (générer/améliorer dans la voix, canal-aware, sanitize, few-shot, choix modèle) **survit** ; le *comment* (bouton « Générer » one-shot dans le composeur) est remplacé.
  - **Nouveaux FR** à formaliser (re-spec ultérieur) : `FR-36` choix IA/manuel par message ; `FR-37` rédaction assistée = flux conversationnel full (l'IA pose toujours des questions) ; `FR-38` capture conversationnelle du contexte à la création de contact ; `FR-39` write-tools copilote d'édition de fiche (`updateContact` + `handles`, `duplicateContact`) avec confirmation + rewind. (Numéros provisoires.)
  - **MVP toujours atteignable** — on **redéfinit le mécanisme du moat**, on ne réduit pas le scope.
- **Architecture (§3.2)** — réutilise l'existant, pas de rupture stack :
  - `sanitize()` (AR-3), few-shot (AR-7), `generation_events` (AR-8), machine d'états messages (AR-5) → **inchangés, consommés par le copilote**.
  - Write-tools copilote : nouveaux `updateContact` / `duplicateContact` dans `tools.server.ts`, ajout à `WRITE_TOOL_NAMES` (déclenche `didWrite` → `router.refresh`), journalisation `action_log` (`prev_state`) pour parité **rewind**. Résolution via `queryContacts` (id réel, jamais inventé) + **confirmation utilisateur obligatoire** avant écriture.
  - Dédup : `duplicateContact` en tension avec `uq_contacts_user_dedup` → forcer `dedup_key` distincte ou refuser la copie pure (à trancher en spec). `createContact` à durcir (idempotence, cf. F11).
  - Registre modèle (F13 Sonnet) **migre du composeur vers le copilote**.
- **UX (§3.3)** — UX-DR8 (« Composeur : bouton intelligent Générer↔Améliorer ») **devient caduc** dans sa forme one-shot ; la génération assistée passe en chat conversationnel (copilote). UX-DR13→24 inchangés. Fixes UI dogfood : F7 (markdown réhydraté), F9 (label locuteur), F12 (bouton dupliqué → retrait), F14 (refresh fermé/vide).
- **Secondaires (§3.4)** — tests cross-tenant à étendre aux nouveaux write-tools ; evals voix (3.9) à **réviser** (la génération conversationnelle change la forme du couple généré→envoyé).

### ⚠️ Action-needed — Jalon R1 GO/PIVOT & SM-1

Le Jalon R1 mesure **SM-1 = distance d'édition médiane généré→envoyé** sur la génération **one-shot**. En conversationnel full, le message final émerge d'un dialogue → la métrique « edit distance » perd son sens littéral. **À trancher au re-spec :** redéfinir SM-1 pour la voie conversationnelle (ex. % de messages envoyés sans réécriture manuelle après le dialogue), et **rejouer R1 sur la nouvelle voie** avant d'investir Epic 4-6. R1 reste le risque n°1.

---

## Section 3 — Chemin recommandé

**Option retenue : Hybride — Option 3 (PRD MVP review : redéfinition du mécanisme du moat) + Option 1 (Direct Adjustment : nouvel epic + stories dans la structure existante).**

- **Option 2 (Rollback) — rejetée :** rien à défaire. Le composeur one-shot shippé reste accessible le temps de la migration ; on ne revert pas de code.
- **Effort :** High (refonte structurante de la surface IA). **Risque :** Medium — atténué car l'infra (sanitize, few-shot, events, persistance copilote phases 1-3) est **déjà là** ; le pivot **re-route**, ne reconstruit pas.
- **Rationale :** le copilote conversationnel existe déjà (chat, tools, persistance Phase 3). Le pivot ≈ router la rédaction à travers le flux conversationnel + ajouter les write-tools manquants. On **capitalise** sur le shipped au lieu de le jeter.
- **Profondeur de CETTE session = Cadrage + stubs** : on pose l'epic + les stories-stubs en backlog + les dépréciations PRD. Les AC détaillés viennent **story par story** (bmad-create-story / bmad-spec), au sprint-planning.

---

## Section 4 — Propositions d'édition détaillées

### 4.1 — `sprint-status.yaml` : nouvel Epic 7 (backlog)

```yaml
  # ---- Epic 7: Copilote — surface IA unique (PIVOT dogfood 2026-06-21) ----
  # Le copilote absorbe TOUTE la redaction assistee (conversationnel full) ;
  # l'app garde TOUT le manuel. Composeur one-shot "Generer" deprecie.
  # Stories-stubs : AC detailles via create-story/spec au sprint-planning.
  epic-7: backlog
  7-1-rediger-en-conversationnel-full-migrer-la-generation-dans-le-copilote: backlog
  7-2-choix-ia-manuel-par-message: backlog
  7-3-capter-le-contexte-relationnel-a-la-creation-de-contact: backlog
  7-4-write-tool-updatecontact-handles-confirmation-rewind: backlog   # F2 / F8
  7-5-write-tool-duplicatecontact-dedup: backlog                       # F4
  7-6-durcir-idempotence-createcontact: backlog                        # F11 (bug)
  7-7-migrer-le-registre-modele-sonnet-vers-le-copilote: backlog       # F13
  7-8-quick-wins-ui-copilote: backlog                                  # F7 F9 F12 F14
  7-9-controle-du-tour-stop-edition-message: backlog                   # F5 F6
  7-10-canal-discord: backlog                                          # F10
  epic-7-retrospective: optional
```

### 4.2 — PRD : encart de dépréciation (à ajouter §4.2 Composeur)

> **PIVOT 2026-06-21 (dogfood).** La rédaction assistée par IA **quitte le composeur one-shot** pour le **copilote conversationnel** (l'IA pose toujours des questions avant de rédiger). FR-6→FR-14 / FR-35 : le *quoi* est préservé, le *comment one-shot* est déprécié. Le composeur « Générer » disparaît comme concept ; l'app ne porte plus que la rédaction **manuelle**. Nouveaux FR-36→FR-39 (choix IA/manuel par message · conversationnel full · capture contexte à la création · write-tools d'édition de fiche). Voir [sprint-change-proposal-2026-06-21-pivot-copilote.md](sprint-change-proposal-2026-06-21-pivot-copilote.md).

### 4.3 — `epics.md` : note de tête Epic 3 + section Epic 7

- **Epic 3** — ajouter un bandeau : « **Surface IA one-shot dépréciée (PIVOT 2026-06-21)** — la génération migre vers le copilote conversationnel (Epic 7). Infra (sanitize, few-shot, generation_events, envoi) **réutilisée**, pas jetée. »
- **Epic 7** — ajouter la section epic (titre + résumé + FRs couverts FR-36→FR-39 + ré-route FR-7/8/9/13/14/35), stories-stubs listées sans AC (renvoi create-story).

### 4.4 — Hors scope de cette session (traçé ailleurs, pas dans l'epic)

- **F1 (process)** — garde-fou migrations (apply/check au boot dev OU check CI schéma↔migrations) → reste dans `deferred-work.md` / Suivi du compte-rendu. Non lié au pivot.
- **P1/P2 (prompt composeur)** — récence ≠ oubli / ne pas minimiser l'interaction → réutilisés par le copilote conversationnel (même moteur de génération) ; à porter dans le prompt copilote au moment de 7-1.
- **F3** — compléter le tableau verdicts composeur → matière à itération prompt, pas une story.

---

## Section 5 — Plan d'implémentation & handoff

**Classification du changement : MAJOR** (replan partiel : redéfinition du mécanisme du moat + nouvel epic).

| Rôle | Responsabilité |
|------|----------------|
| **PM (John)** | Formaliser FR-36→FR-39 + encart dépréciation dans le PRD ; redéfinir SM-1/R1 pour la voie conversationnelle. |
| **Architecte (Winston)** | Trancher : contrat write-tools (`updateContact`/`duplicateContact`) + `action_log`/rewind ; politique dédup duplication ; migration registre modèle vers copilote. |
| **Dev (Amelia) via create-story** | Détailler puis implémenter les stories 7-x. **Priorité dogfood :** 7-6 (F11 bug) → 7-4 (F2/F8 friction confirmée) → 7-1 (cœur du pivot) → 7-8 quick-wins. |

**Séquencement recommandé :** Epic 7 **avant** Epic 4-6 (conditionne R1). À confirmer au prochain **sprint-planning**.

**Critères de succès :**
- Le composeur one-shot « Générer » n'existe plus comme chemin produit ; la rédaction IA passe 100 % par le copilote conversationnel.
- Le copilote peut éditer une fiche (champs + handles) et dupliquer un contact, avec confirmation + rewind.
- F11 (double-création) ne se reproduit pas (idempotence `createContact`).
- R1/SM-1 redéfini et mesurable sur la voie conversationnelle.

---

## Section 6 — Prochaines étapes

1. **Valider ce proposal** (ci-dessous).
2. Sur accord → MAJ `sprint-status.yaml` (Epic 7 backlog) + encarts dépréciation PRD/epics.
3. **Sprint-planning** pour trancher le séquencement Epic 7 vs Epic 4.
4. **create-story** sur 7-6 puis 7-4 (priorités dogfood), en contexte frais.
5. Re-spec PM/Architecte pour FR-36→FR-39 + redéfinition R1/SM-1.
