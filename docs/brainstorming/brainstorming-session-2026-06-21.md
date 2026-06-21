---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: "Attacher l'historique de conversation d'un contact pour personnaliser la génération de message"
session_goals: "Couvrir UX de saisie, architecture/données, flux complet (saisie → stockage → génération), et onboarding"
selected_approach: 'progressive-flow'
techniques_used: ['What If Scenarios', 'Mind Mapping', 'SCAMPER Method', 'Resource Constraints']
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Monsieur
**Date:** 2026-06-21

## Session Overview

**Topic:** Attacher l'historique de conversation d'un contact pour personnaliser la génération de message — l'utilisateur ajoute facilement les échanges passés, le copilote/composeur génère un message qui en tient compte et y répond juste.

**Goals:** Couvrir 4 angles — UX de saisie (coller/importer sans friction), architecture/données (où stocker, comment l'injecter dans la génération), flux complet (saisie → stockage → génération personnalisée), et onboarding.

### Session Setup

_Session 2026-06-21. Sujet né d'une idée spontanée pendant le dev des archive-tools du copilote. S'inscrit dans le pivot Plume : composeur IA anti-robot pour outreach réseau._

## Technique Selection

**Approach:** Progressive Technique Flow (large → resserré)

**Progressive Techniques:**

- **Phase 1 — Exploration :** What If Scenarios (divergence max, tous angles)
- **Phase 2 — Reconnaissance de motifs :** Mind Mapping (clustering dans UX/archi/flux/onboarding)
- **Phase 3 — Développement :** SCAMPER Method (musculation des concepts retenus)
- **Phase 4 — Plan d'action :** Resource Constraints (force le MVP + séquencement)

**Journey Rationale:** 4 angles à couvrir → divergence d'abord pour éviter de figer une solution technique trop tôt, puis convergence systématique vers un premier incrément shippable.

## Phase 1 — Exploration expansive (What If Scenarios)

_Idées générées en dialogue, append au fil de l'eau._

### Vague 1 — réactions

**Retenues :**
- **I3** — Auto-archivage des messages envoyés DEPUIS Plume ; l'utilisateur n'importe à la main que l'historique « d'avant ». _(jugé évident → socle)_
- **I5** — Le message généré cite littéralement un détail de l'échange passé (« tu m'avais parlé de Lyon ») → preuve qu'il a lu, effet perso fort. _(coup de cœur)_
- **I7** — À la création d'un contact, l'app demande « vous vous connaissez déjà ? » et ouvre direct le collage d'historique. _(onboarding)_
- **I4-bis** — Avant rédaction, montrer « voilà ce que j'ai compris de votre relation » pour validation. ⚠️ **Correction archi : c'est le COMPOSEUR qui génère le message, PAS le copilote.** L'historique doit nourrir le pipeline composeur.

**Écartées :**
- **I1** — Coller un bloc brut et démêler qui-a-dit-quoi : possible mais **exige l'IA** pour détecter le format de chaque source (WhatsApp/LinkedIn/mail diffèrent). _(coût/complexité notés)_
- **I2** — Screenshot → OCR : exige l'IA **et** jugé « nul ». _(rejet net)_
- **I6** — Stockage résumé vectoriel pour vie privée : **non**, il faut l'historique brut. Parade vie privée = **l'utilisateur censure lui-même** ce qu'il colle ; il accepte que tout ce qui entre dans l'app est vulnérable. _(principe produit : pas de chiffrement spécial, responsabilité utilisateur)_

**Contraintes durcies (deviennent des règles du projet) :**
- C1 — Séparation nette : **Composeur = génère le message**. Copilote ≠ générateur de message.
- C2 — Historique **stocké brut**, pas de transformation vie-privée côté app ; curation = responsabilité utilisateur.

### Vague 2 — réactions

**Retenues :**
- **I9** — Coller le bloc **tel quel**, sans structurer qui-a-dit-quoi ; le composeur (déjà de l'IA) l'avale comme « contexte de la relation ». _(évite la friction ET le parsing format)_
- **I10** — Ajouter une **timeline de notes libres** (« vu à un meetup en mars », « cherche un dev React ») **EN PLUS** de l'historique brut, pas en remplacement. _(complément, pas substitut)_
- **I11** — L'historique = **nouveau champ injecté dans le prompt du composeur**, au même rang que le corpus de voix + l'idée. _(branchement archi)_
- **I12** — L'utilisateur règle le **poids de l'historique** : « réponds surtout à son dernier message » vs « inspire-toi juste du ton ». _(contrôle)_
- **I13** — Un contact peut avoir **plusieurs fils par canal** (LinkedIn + mail + WhatsApp) ; le composeur génère pour LE canal choisi en connaissant les autres. _(jugé obligatoire)_
- **I14** — Détecter un historique **vieux** (« dernier échange il y a 8 mois ») → adapter pour **casser la glace** au lieu de foncer. _(hyper bien)_

**Écartées :**
- **I8** — Deux zones « vous »/« lui » ou toggle par ligne : **trop de friction** utilisateur. _(rejet, renforce I9)_

### Vague 3 — réactions (toutes retenues)

- **I15** — Historique **éditable à tout moment** depuis la fiche contact (pas seulement à la création).
- **I16** — Après le 1er message envoyé via Plume, proposer « j'ajoute la réponse reçue à l'historique ? » → garder l'historique vivant.
- **I17** — Onboarding avec **exemple avant/après** (même contact, message sans vs avec historique) → montre la valeur, donne envie de coller.
- **I18** — Le composeur affiche **quels bouts d'historique** il a utilisés (surlignage) → confiance + sait quoi enrichir.
- **I19** — ⭐ **Forward d'un mail vers une adresse Plume** → l'historique s'attache au bon contact tout seul. _(« incroyable » — mais attention parsing/matching contact, à challenger en Phase 3)_
- **I20** — Coller l'historique débloque un **score « niveau de perso »** (jauge) → pousse à en mettre plus. _(gamification onboarding)_

## Phase 2 — Reconnaissance de motifs (Mind Mapping)

**Clusters :**
- 🟦 Saisie/UX : I9 (coller brut), I10 (timeline notes), I15 (éditable), I16 (ajouter réponse), I7 (prompt création), I19 (forward mail)
- 🟩 Archi/données : I11 (champ injecté composeur), I13 (multi-fils par canal), I3 (auto-archive sortants), C2 (brut)
- 🟧 Flux/génération : I5 (citation littérale), I12 (poids réglable), I14 (détection ancienneté), I4b (résumé validation), I18 (surlignage utilisé)
- 🟪 Onboarding : I17 (avant/après), I20 (jauge perso), I7 (pont)

**Motifs / tensions :**
- 🔗 Épine dorsale = `I9 → I11 → I5` (chemin minimal qui livre la valeur).
- ⚠️ Hors-MVP lourds = I19 (forward mail, matching contact) + I13 (multi-fils, modèle de données) → adorés mais reportés.
- 🛡️ Cluster confiance = I4b + I18 + I12 (contrôle utilisateur) → aligné positionnement anti-robot.

**Directions retenues pour Phase 3 :**
- **[A] Épine dorsale** `I9→I11→I5` — le MVP qui livre la valeur.
- **[B] Cluster confiance** `I4b+I18+I12` — différenciateur, pas cher une fois [A] en place.
- Reporté : [C] onboarding (polish post-moteur), [D] gros morceaux (à dérisquer en Phase 4).

## Phase 3 — Développement (SCAMPER) sur A + B

_Concept travaillé : « l'historique brut, injecté au prompt du composeur, génère un message qui cite le passé — et l'utilisateur voit/contrôle ce que l'IA en fait »._

- **S (Substituer)** ✅ — Le « poids de l'historique » (I12) devient **3 boutons-intentions** au lieu d'un slider abstrait : `Répondre à son dernier message` / `Reprendre contact après longtemps` / `M'inspirer juste du ton`. _(boutons retenus, slider abandonné)_
- **C (Combiner)** ✅ — Fusion **I4b + I18** en UN écran de confiance : le brouillon s'affiche **avec les passages d'historique réutilisés surlignés dedans**. Une seule étape au lieu de deux.
- **A (Adapter)** ✅ — La **détection d'ancienneté (I14)** réutilise la date du dernier message archivé (I3) pour **basculer auto** sur le mode « reprendre contact ». Zéro réglage ; l'utilisateur peut toujours changer de bouton à la main.
- **M (Modifier/amplifier)** ⭐ — Pousser I5 plus loin que la citation : **accrocher le message au dernier point laissé en suspens** (« tu cherchais un dev React, du coup… »). La perso devient **CONTINUITÉ**, pas simple rappel. _(jugé « hyper important » — cœur de la valeur)_
- **E (Éliminer)** ❌ — Ne PAS supprimer le champ intention/consigne. Il est **déjà optionnel** aujourd'hui et doit le rester : l'utilisateur peut vouloir parler d'un sujet précis ou faire une demande particulière → l'intention reste indispensable, juste pas obligatoire.
- **R (Inverser)** 🔶 — L'historique se saisit **à la création du contact** (cas nominal). MAIS quand un contact **n'a pas encore d'historique**, basculer sur l'inversion : générer un 1er jet sans historique, puis proposer « colle ton échange passé → je rends ça 10× plus perso ». _(fallback + moteur d'onboarding I17/I20)_

### Synthèse Phase 3 — concept consolidé

Le concept « historique → message » se stabilise en un parcours :
1. **Saisie** à la création du contact (I7) : coller le bloc brut (I9), éditable ensuite (I15). Notes libres en bonus (I10).
2. **Génération** par le composeur : historique injecté au prompt (I11) + intention optionnelle (E) + bouton-intention (S, auto-détecté par ancienneté A/I14).
3. **Valeur** : message en CONTINUITÉ qui relance le dernier point en suspens (M/I5).
4. **Confiance** : écran unique brouillon + passages d'historique surlignés (C = I4b+I18).
5. **Fallback sans historique** : 1er jet → nudge « ajoute l'historique pour 10× plus perso » (R → I17/I20).

## Phase 4 — Plan d'action (Resource Constraints : « un week-end »)

**Décision modèle de données :** l'historique = **un seul textarea (colonne texte sur le contact)**, PAS une table de messages. Choix assumé pour alléger le MVP ; le multi-fils (I13) reste une refonte future séparée.

### 🟢 MVP week-end — moteur de valeur (validé)
1. **Champ historique sur la fiche contact** : textarea brut, éditable (I9 + I15), saisissable à la création (I7).
2. **Injection au prompt composeur** (I11) : bloc de contexte à côté de l'intention (optionnelle, E) + corpus de voix.
3. **Génération en continuité** (M/I5) : le prompt demande de rebondir sur le dernier point en suspens.

### 🟡 Incrément 2
4. **3 boutons-intentions** (S) + **auto-détection ancienneté** (A/I14 via date dernier message I3).
5. **Écran de confiance** : brouillon + surlignage des bouts utilisés (C = I4b+I18).

### 🟠 Incrément 3 (moteur prouvé)
6. **Fallback sans historique** → nudge avant/après (R/I17) + **jauge perso** (I20).
7. **Garder vivant** : « ajouter la réponse reçue ? » après envoi (I16).

### 🔵 Plus tard / à dérisquer
8. **Multi-fils par canal** (I13) — refonte modèle de données.
9. **Forward mail → adresse Plume** (I19) — matching contact + parsing.
10. **Notes libres timeline** (I10) — si la demande émerge.

## Synthèse & prochaines étapes

**Concept retenu :** un champ historique (textarea brut) sur le contact, injecté au prompt du composeur, produisant un message en **continuité** qui rebondit sur le dernier échange — avec, par incréments, des contrôles de confiance (boutons d'intention, surlignage) et un onboarding qui montre la valeur.

**Décisions structurantes :**
- C1 — Génération = **Composeur**, pas Copilote.
- C2 — Historique **brut**, curation/vie privée = responsabilité utilisateur.
- C3 — **Textarea unique**, pas de table messages (MVP).
- C4 — Champ **intention reste optionnel** (jamais supprimé).
- C5 — Pas d'IA de parsing de format au MVP (le composeur avale le brut).

**Question ouverte pour la spec :**
- Où vit le textarea dans le schéma (`contacts.historique` ?) et son plafond de taille (tokens injectés → coût). À border comme les autres bornes SÉCU du projet.

**Prochaine étape suggérée :** transformer le MVP (1-2-3) en spec/story BMad — `bmad-create-story` ou ta skill `story-loop`.






