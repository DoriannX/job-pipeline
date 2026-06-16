# Réconciliation — Distillat PRFAQ vs PRD + Addendum (Plume)

*Date : 2026-06-15. Méthode : comparaison ligne à ligne du distillat source contre le PRD final et son addendum. On cherche ce que le PRD a SILENCIEUSEMENT perdu, déformé, ou laissé non résolu alors que la source le soulevait. On vérifie aussi que les décisions de scope tranchées dans le distillat sont reflétées, et que les trous/ambiguïtés listés sont soit résolus, soit présents en Questions ouvertes.*

- SOURCE : `docs/planning-artifacts/prfaq-job-pipeline-distillate.md`
- PRD : `docs/planning-artifacts/prds/prd-job-pipeline-2026-06-15/prd.md`
- ADDENDUM : `docs/planning-artifacts/prds/prd-job-pipeline-2026-06-15/addendum.md`

Légende sévérité : **[CRITIQUE]** = décision/contenu load-bearing perdu ou déformé · **[MOYEN]** = nuance importante affaiblie · **[MINEUR]** = détail manquant à faible enjeu · **[OK]** = bien reflété (noté pour traçabilité).

---

## 1. Gaps — éléments perdus en silence

### G1. [CRITIQUE] Verdict actionnable « plan d'acquisition concret (2-3 canaux + boucle feedback) » dégradé en simple question ouverte
- **Source (l.83)** : "À remettre au feu : (3) plan d'acquisition concret (2-3 canaux + boucle feedback)." C'est listé comme un des trois items **actionnables** du verdict, au même niveau que le modèle économique et la faisabilité voix.
- **PRD** : §16 Q5 mentionne "Acquisition organique : canaux concrets (2-3 communautés tech, build in public) à définir." La **boucle de feedback** disparaît entièrement, et l'item passe d'« à remettre au feu / actionnable » à une simple question ouverte parmi sept.
- **Impact** : le distillat traite l'acquisition comme un chantier à instruire activement ; le PRD le relègue au rang de note non prioritaire. La dimension "boucle feedback" (instrumentation de l'acquisition) est silencieusement perdue.

### G2. [CRITIQUE] « Conversion organique : taux inconnu (acquisition build-in-public non chiffrée) » — inconnu source absent
- **Source (l.79)** : listé explicitement comme une **question ouverte / inconnue flaggée**.
- **PRD** : aucune trace de l'inconnu "taux de conversion organique non chiffré". La Q5 parle de définir des canaux, pas de l'incertitude sur le taux de conversion. SM-4 ("un inconnu l'utilise") touche le sujet de loin mais ne capture pas l'inconnu de conversion.
- **Impact** : une des quatre inconnues explicitement flaggées par la source n'apparaît ni résolue ni en Questions ouvertes. Disparition silencieuse.

### G3. [MOYEN] Fast-follower n°1 = Folk : la matrice concurrentielle de l'addendum le contredit / le dilue
- **Source (l.55)** : "Fast-follower n°1 = Folk (a déjà pipeline + AI workflow assistant ; manque voice-mimicry + template job-search)." Affirmation forte et nommée : Folk est LE menaçant.
- **PRD** : R6 cite bien "Folk = fast-follower" (OK). MAIS l'addendum §F décrit Folk comme "Personal CRM générique — Pas orienté job ; pas de voix **ni de pipeline d'opportunités**", ce qui **contredit** la source (qui dit que Folk a DÉJÀ le pipeline). Le tableau §F retire à Folk le pipeline que la source lui attribuait, affaiblissant le rationnel "fenêtre pas forteresse".
- **Impact** : déformation. Le risque Folk est sous-évalué dans l'addendum par rapport à la source.

### G4. [MOYEN] Beachhead / persona « profils tech/devs » et effet méta portfolio affaibli
- **Source (l.15)** : "Beachhead : profils tech/devs en recherche via réseau. Effet méta : un dev qui livre ce SaaS = portfolio qui sert sa propre recherche."
- **PRD** : la persona Camille est "dev en recherche" (OK pour le beachhead). L'effet portfolio est mentionné (§1, §2.1 JTBD Builder). MAIS le beachhead n'est jamais posé comme **stratégie de ciblage de marché explicite** ("on attaque d'abord les devs"). Il est dilué dans le persona narratif. La cible "profils tech/devs" comme segment d'entrée n'est pas nommée comme telle dans §2 ni §13.
- **Impact** : nuance stratégique (beachhead = choix de go-to-market) affaiblie en simple choix de protagoniste.

### G5. [MOYEN] Canal-aware : SMS comme canal distinct vs WhatsApp — la source les listait séparément
- **Source (l.32, l.46)** : composeur "canal-aware (LinkedIn court / email structuré / WhatsApp ultra court)" ; envoi "Email/WhatsApp/SMS : envoi direct prévu." SMS et WhatsApp sont listés comme canaux distincts.
- **PRD** : FR-9 traite SMS = WhatsApp via `[ASSUMPTION]` (l.152). C'est une décision raisonnable et taguée, donc **pas un gap silencieux** sur ce point précis. **[OK]** noté ici pour traçabilité ; signalé seulement parce que la source distinguait les deux.

### G6. [MINEUR] « WhatsApp ultra court » → PRD dit « WhatsApp court »
- **Source (l.32)** : "WhatsApp ultra court".
- **PRD (FR-9, Glossaire)** : "WhatsApp court". L'adjectif "ultra" est tombé. Nuance de registre canal légèrement affaiblie.

### G7. [MINEUR] Mode sans-IA : « échanges 100% locaux, rien n'est envoyé à l'API » — nuance « local » perdue
- **Source (l.20)** : "Mode sans-IA par contact (échanges 100% locaux, rien n'est envoyé à l'API)."
- **PRD (FR-15, Glossaire)** : "aucun appel à l'API ; le texte tapé est directement le Message." Le "rien envoyé à l'API" est bien capté. Le mot "**100% locaux**" (qui suggérait peut-être un traitement strictement côté client) n'est pas repris. Probablement OK puisque la garantie centrale est préservée, mais à noter si "local" portait une exigence d'architecture.

### G8. [MOYEN] Pièges techniques qui débordent (« import CSV/Gmail propre » + PWA/push) non remontés comme risque/NFR
- **Source (l.73)** : "Pièges qui débordent : PWA/push (service worker, contrainte iOS) + import CSV/Gmail propre."
- **PRD** : la contrainte iOS Web Push est bien présente (FR-26, §8). La résilience import est un NFR (§11). Mais le distillat les flagguait comme **pièges de planning / sous-estimation d'effort** (risque projet), pas seulement comme exigences fonctionnelles. Aucun risque type "ces deux chantiers débordent toujours, time-boxer" n'est dans §12 (alors que R5 burnout aurait été le bon endroit).
- **Impact** : avertissement d'estimation perdu. Le PRD ne dit pas que PWA/push et import propre sont les deux gouffres de temps connus.

### G9. [MINEUR] Build order « composeur EN PREMIER » (séquence de construction) absent du PRD
- **Source (l.74)** : build order explicite en 8 étapes, avec "5) composeur EN PREMIER (cœur de valeur, tester sur 5 vrais contacts)".
- **PRD** : aucune séquence de build. C'est défendable (un PRD n'est pas un plan d'implémentation), mais la **directive forte "composeur d'abord, testé sur 5 vrais contacts"** était un signal de priorisation produit, pas qu'un détail d'ingénierie. UJ-1 mentionne 5 touches, mais pas le "tester sur 5 vrais contacts" comme jalon. Frontière acceptable mais à conscientiser.

### G10. [MINEUR] « Score froideur du lien » + tri/dédup/flag liens froids — le « flag liens froids » au moment de l'import non explicité
- **Source (l.34)** : "Tri/dédup/flag liens froids" à l'import réseau.
- **PRD** : Score de froideur (FR-4) et tri (FR-5) couverts. Le "flag" actif des liens froids **au moment de l'import** (ex. signaler les contacts déjà froids dès le CSV) n'est pas explicité ; FR-4 calcule le score mais ne dit pas qu'on attire l'attention sur les froids importés. Nuance mineure.

---

## 2. Décisions de scope tranchées dans le distillat — vérification

| Décision actée (source) | Reflétée dans PRD/Addendum ? | Note |
|---|---|---|
| **Few-shot voix REMONTÉ du v1 au MVP** (l.60, l.33) | **OUI** — FR-10, §4.2, §4.3, §6.1, décision rationnelle explicite | [OK] bien porté, c'est central |
| **Composeur MVP ≠ Améliorer/Générer générique** (l.60) | **OUI** — FR-10 + FR-11 (voix + tells) le distinguent | [OK] |
| **Haiku par défaut, Opus option** (l.45) | **OUI** — FR-14, addendum §D | [OK] |
| **Opportunités hors MVP (v1)** (l.37, l.61) | **OUI** — Glossaire, §5, §6.2, addendum §A | [OK] |
| **Pas de scraping LinkedIn** (l.46, l.64) | **OUI** — §5, §7.4, FR-1 Out of Scope | [OK] |
| **Pas d'envoi auto LinkedIn ; copier→coller→envoyé** (l.46) | **OUI** — FR-21, FR-12, §7.4 | [OK] |
| **Scan Gmail différé en v1** (l.34 implicite, l.61) | **OUI** — §6.2, FR-1 Out of Scope, R3 | [OK] — NB : la source MVP (l.59) ne listait PAS Gmail au MVP ; cohérent |
| **Extension navigateur LinkedIn = fast-follow** (l.46) | **OUI** — §6.2, addendum §B | [OK] |
| **PWA + Web Push, contrainte iOS** (l.43) | **OUI** — FR-26, FR-28, §8 | [OK] |
| **Modèle data MVP = contacts/channels/messages/next_actions** (l.37) | **OUI + ENRICHI** — addendum §A ajoute `users` et `voice_samples` | [OK] — voir D1 ci-dessous |
| **Archi SaaS-ready mais single-user** (l.42) | **OUI** — §1, FR-29, §11 | [OK] |
| **Free tier SaaS DOIT être plafonné** (l.45) | **OUI** — §7.3, addendum §C | [OK] mais non chiffré (assumé, cf. Q1) |
| **Stat "85%" et "70% hidden job market" INTERDITES** (l.28, l.56) | **OUI** — addendum §G gouvernance explicite ; PRD §13 utilise les chiffres défendables | [OK] excellent |
| **Noms rejetés (Filon, Accroche, etc.)** (l.27) | **PARTIEL** — addendum §E liste Accroche, Amorce, Trame, Cordée, Filon. **Manquent** : Tisse, Reso, Lien (source l.27) | voir G-noms ci-dessous |
| **3 onglets max (Aujourd'hui/Réseau/Stats) + Réglages, composeur en flow** (l.47) | **OUI** — §10, FR-13 ; Stats différé v1 (assumé) | [OK] |
| **Pricing NON RÉSOLU** (l.66-69) | **OUI** — §16 Q1, R2, addendum §C | [OK] bien préservé comme non acté |

### D1. [OK→MINEUR] `voice_samples` : la source ne la nommait pas, l'addendum la crée — bonne décision, mais c'est un ajout
- La source listait le modèle data MVP sans `voice_samples` (l.37). L'addendum §A la modélise explicitement (cohérent avec le few-shot remonté au MVP). Ce n'est pas une perte, c'est un **comblement de trou** correct. Noté pour traçabilité : décision nouvelle non issue de la source, signalée comme `[ASSUMPTION]` FR-17. Bien géré.

### D2. [MINEUR] Noms rejetés incomplets
- **Source (l.27)** : Filon, Accroche, Amorce, Trame, Cordée, **Tisse/Reso/Lien**.
- **Addendum §E** : Accroche, Amorce, Trame, Cordée, Filon. **Tisse, Reso, Lien manquent.** Et le **rationale de rejet de Filon** (l.27 : "connotation opportuniste, contraire au positionnement humain") est perdu — l'addendum liste Filon comme simple écarté sans la raison, alors que c'était une décision de positionnement.

---

## 3. Trous / ambiguïtés du distillat — résolus ou en Questions ouvertes ?

| Inconnu/trou source | Statut dans PRD | Verdict |
|---|---|---|
| **Faisabilité voix (RISQUE N°1)** — combien d'exemples, Haiku suffit ? (l.77) | §12 R1 + §16 Q2 + SM-1 | **RÉSOLU en suivi** [OK] excellent |
| **Willingness to pay** réelle ? (l.78) | §16 Q1 + R2 + SM-5 | **EN QUESTIONS OUVERTES** [OK] |
| **Conversion organique** taux inconnu (l.79) | **ABSENT** | **PERDU** — voir G2 [CRITIQUE] |
| **RGPD base légale données tiers** (l.80) | §7.2 NOTE FOR PM + §16 Q3 + R4 | **EN QUESTIONS OUVERTES** [OK] |
| **Fissure : jalons de vérité SaaS** (un inconnu l'utilise / quelqu'un paie) (l.84) | SM-3, SM-4, SM-5 (jalons de vérité) | **RÉSOLU** [OK] très bien transposé |
| **Fissure : moat = fenêtre pas forteresse** (l.84) | R6 + §13 | **RÉSOLU** [OK] |
| **Fissure : RGPD avant ouverture** (l.84) | §7.2 + R4 | **RÉSOLU** [OK] |
| **Fissure : solo = point unique de défaillance, time-box** (l.84) | R5 | **RÉSOLU** [OK] mais voir G8 (pièges d'estimation) |
| **Segment SaaS durable = freelance/entretien réseau continu** (l.68) | §16 Q7 | **EN QUESTIONS OUVERTES** [OK] |
| **Tensions File infinie #54 vs Planif rebours #63, Signaux #68** | addendum §H | **EN SUSPENS DOCUMENTÉ** [OK] — bien que ce soit du v1, correctement parqué |

---

## 4. Déformations / glissements de sens

### S1. [MOYEN] « Au moins un nom » pour créer un Contact (FR-2) vs source « tri/dédup » — pas un conflit, mais FR-34 ASSUMPTION élargit le scope sans source
- FR-34 `[ASSUMPTION: "Nom, Entreprise" parsé best-effort]` introduit un format de collage que la source ne décrivait pas (la source parlait d'import CSV + scan Gmail, pas de "coller une liste Nom, Entreprise"). **L'ajout rapide multiple (FR-34) est une feature NOUVELLE non présente dans le distillat.** C'est une bonne réponse au cold-start (export LinkedIn 24h), correctement taguée assumption, mais à signaler : elle n'a pas d'ancrage source — c'est une invention du PRD justifiée en addendum §D (cold-start). Légitime mais à conscientiser comme décision nouvelle.

### S2. [MINEUR] « Apprentissage au fil des envois : chaque message édité+envoyé = nouvel exemple » bien capté, mais « style appris avancé (RAG complet) = v1 » : frontière MVP/v1 du RAG
- Source distingue "few-shot voix minimal (MVP)" vs "style appris avancé / RAG complet (v1)" (l.59-61). PRD respecte (FR-10 minimal, §14 RAG complet en v1). [OK]. Mais l'addendum §B mélange "Few-shot/RAG en contexte" comme si RAG était déjà MVP. Léger flou terminologique entre "few-shot minimal" (MVP) et "RAG" (v1) dans l'addendum.

### S3. [OK] One-liner / moat / positionnement anti-spam / honnêteté / paradoxe d'authenticité — « Forgé à conserver intact » (l.85)
- Tous préservés fidèlement : §1 (vision), §4.2 (héros), §5 (non-goals anti-automate), §7.1 (anti-robot), §9 (ton). Le "paradoxe d'authenticité désamorcé (fond du user + revue humaine + mode sans-IA)" est bien rendu par FR-10/FR-12/FR-15. Très bon.

---

## 5. Synthèse — top gaps par priorité

1. **[CRITIQUE] G2** — Inconnu source "taux de conversion organique non chiffré" totalement absent du PRD (ni résolu, ni en Questions ouvertes).
2. **[CRITIQUE] G1** — Item actionnable du verdict "plan d'acquisition (2-3 canaux + **boucle feedback**)" dégradé en simple Q5 ; la boucle de feedback disparaît.
3. **[MOYEN] G3** — Addendum §F retire à Folk le pipeline que la source lui attribuait ("fast-follower n°1 a DÉJÀ pipeline"), sous-évaluant le risque concurrentiel R6.
4. **[MOYEN] G8** — Pièges d'estimation flaggés par la source (PWA/push + import propre "débordent") non remontés comme risque projet/NFR de planning.
5. **[MOYEN] G4** — Beachhead "profils tech/devs" comme stratégie de go-to-market dilué en simple persona narratif.

**Mineurs à corriger au passage** : D2 (noms Tisse/Reso/Lien manquants + rationale Filon perdu), G6 (WhatsApp "ultra court"), G9 (jalon "tester composeur sur 5 vrais contacts"), S1/D1 (signaler FR-34 et `voice_samples` comme décisions nouvelles sans ancrage source — légitimes mais à conscientiser).

**Globalement** : le PRD est fidèle sur le cœur (moat voix remonté au MVP, scope, stats gouvernées, jalons de vérité, non-goals, pricing non acté). Les pertes se concentrent sur la couche **go-to-market / acquisition** (G1, G2, G4) et un **glissement concurrentiel** (G3). Aucune décision de scope tranchée n'a été inversée en silence.
