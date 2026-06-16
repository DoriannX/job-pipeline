# Réconciliation — Brainstorming → PRD Plume + Addendum

*Date : 2026-06-15. Tâche : vérifier que le PRD MVP-profond (+ addendum + roadmap annexe) ne perd ni ne contredit la source de brainstorming (~55 features, phasage MVP/v1/v2/v3).*

**Sources comparées :**
- SOURCE : `docs/brainstorming/brainstorming-session-2026-06-15.md`
- PRD : `docs/planning-artifacts/prds/prd-job-pipeline-2026-06-15/prd.md`
- ADDENDUM : `docs/planning-artifacts/prds/prd-job-pipeline-2026-06-15/addendum.md`

**Règle de scope appliquée :** on NE signale PAS comme gap les features v1/v2/v3 résumées en annexe Roadmap (§14 PRD). On signale seulement : (a) une feature que la SOURCE place en MVP et qui est absente du PRD MVP, (b) un phasage incohérent (MVP source → repoussé PRD, ou l'inverse), (c) une idée qualitative/UX perdue (présente dans aucune des deux destinations).

---

## Méthode

La SOURCE définit son MVP de façon explicite (§ « Phasage », bloc « MVP (build d'abord) ») :

> - Contacts : ajout manuel + import LinkedIn CSV (#37 partiel).
> - Composeur : écrire / Améliorer / Générer (#2 #44), champ unique (#7), copier→envoyé (#7), log multicanal (#34 canal), statut (#8), verrou (#9).
> - File du jour basique (#1).
> - Relances zéro fuite (#23).
> - Coquille PWA mobile-first (#32) + auth + privacy de base (#39).

C'est cet ensemble qui sert de référence « MVP source ». Tout le reste (#16-19, #20-29, #65, #55, #68, #31, #67, #52, #51, #33, #53, #43, multi-user, #58, #69) est rangé par la SOURCE en v1/v2/v3 → couvert par l'annexe Roadmap du PRD (§14), donc hors gap par construction.

---

## 1. Mapping MVP source → PRD MVP (couverture feature par feature)

| Feature source (MVP) | # | Couvert PRD MVP ? | FR / §  |
|---|---|---|---|
| Ajout manuel de contact | — | Oui | FR-2 |
| Import LinkedIn CSV (#37 partiel) | 37 | Oui (en backfill async, optionnel) | FR-1 |
| Composeur : Écrire | 7 | Oui (champ unique) | FR-6 |
| Composeur : Améliorer | 2 | Oui | FR-8 |
| Composeur : Générer de 0 | 44 | Oui | FR-7 |
| Champ unique = source de vérité | 7 | Oui | FR-6 |
| Copier → Envoyé | 7 | Oui | FR-21 |
| Log multicanal (canal) | 34/10 | Oui (Canal sur Message) | FR-18, Glossaire Canal |
| Statut de message | 8 | Oui | FR-19 |
| Verrou après envoi | 9 | Oui | FR-20 |
| File du jour basique | 1 | Oui | FR-22, FR-23, FR-24 |
| Relances zéro-fuite | 23 | Oui | FR-25, FR-26, FR-27 |
| Coquille PWA mobile-first | 32 | Oui | FR-28 |
| Auth | 30 | Oui (Google OAuth, scopé user) | FR-29 |
| Privacy de base | 39 | Oui (export/suppr/transparence) | FR-30, FR-31, FR-32 |

**Conclusion couverture MVP :** toutes les features que la SOURCE liste explicitement en MVP sont présentes dans le PRD MVP. **Aucun gap de feature MVP manquante (type a).** Plusieurs sont même renforcées (voir §4 — surplus assumé).

---

## 2. Features source NON-MVP, correctement placées en Roadmap annexe (sanity check — PAS des gaps)

Vérifié que le PRD ne les a pas « oubliées » mais bien rangées en §14 / §6.2 / §5 :

- Opportunités/pipeline (#16 #18 #19 #64) → v1 (PRD §14, Glossaire « Opportunité (v1) », Non-Goals §5). OK.
- Analytics funnel + recettes + anti-vanity (#20 #21 #22 #62) → v1. OK.
- Gamification (#24-29 : streak, XP, achievements, heatmap, récap dimanche) → v1. OK.
- Style appris RAG complet (#73) → v1. (Le few-shot voix *minimal* est, lui, bien au MVP — FR-10/FR-16/FR-17. Distinction correcte.) OK.
- Auto-statut email (#65) → v1. OK.
- Expansion réseau (#55) + « l'app choisit qui » (#35) → v1. OK.
- Signaux de timing (#68, remonté v1 priorité haute) → v1. OK (et tension de faisabilité notée addendum §H).
- Notif push (#31) → **placée au MVP** dans le PRD (FR-26), alors que la SOURCE la met en v1. Voir §3 (incohérence bénigne mais réelle).
- Agent nocturne (#67), recherche avant écriture (#52), A/B test (#51), vocal (#33), séquences multi-étapes (#53), campagnes (#43) → v2. OK.
- Multi-user, social/squad (#69), billing, freelance (#58) → v3/SaaS. OK.
- Rejetées #61 (pré-génération), #66 (pitch transférable), #70 (prédiction), #71 (simulation) → reflétées en Non-Goals §5 / addendum §D. OK.
- Différées #49 (multilingue), #58 (freelance), #63 (planif à rebours) → §5 Non-Goals + tension addendum §H pour #63. OK.

---

## 3. Incohérences de phasage (type b)

### B-1. Notification push (#31) — SOURCE = v1 ; PRD = MVP. **[Incohérence réelle, assumée et justifiée]**
La SOURCE range explicitement « Notif push (#31) » dans **v1** (bloc v1 du phasage + onglet RÉGLAGES). Le PRD la fait passer au **MVP** : FR-26 (notification push de Relance) est dans §4.6 (features MVP), listée au périmètre §6.1, et SM-2 valide « la boucle MVP (FR-22..FR-27) » — donc FR-26 incluse.
- **Nature :** la SOURCE met aussi la PWA (#32) au MVP mais la notif (#31) en v1, ce qui est légèrement contradictoire en interne (le besoin fondateur de départ était « recevoir une notif sur mon téléphone »). Le PRD résout cette tension en rapatriant le push au MVP, cohérent avec le JTBD contextuel et UJ-3 (qui repose entièrement sur le push).
- **Verdict :** incohérence de phasage **réelle** mais **upgrade délibéré et cohérent** avec la vision. À acter explicitement (ce n'est pas une erreur de copie, c'est un choix). Pas un défaut bloquant.

### B-2. Ajout rapide multiple (#34 « import par lien ») — réinterprété, pas repoussé. **[Pas une incohérence, mais à noter]**
La SOURCE #34 = « Import contact par lien multi-canal (auto-remplissage best-effort) ». Le PRD crée FR-34 « Ajout rapide multiple » (coller une liste, N contacts d'un coup) — ce n'est PAS le même mécanisme que #34 source (URL → auto-fill). Le PRD a *renommé* FR-34 et changé sa nature (cold-start manuel-first), reléguant l'auto-remplissage par lien hors MVP sans le dire explicitement.
- **Verdict :** pas un repoussage de phase mais une **substitution de feature sous le même numéro**, ce qui peut prêter à confusion en traçabilité. L'auto-remplissage par URL (#34 source réel) n'apparaît nulle part (ni MVP ni roadmap §14). Voir aussi C-2.

**Aucune incohérence inverse** (feature que le PRD avancerait en MVP alors que la source la mettrait plus loin) autre que B-1. Aucune feature MVP-source repoussée par le PRD.

---

## 4. Surplus PRD (features MVP ajoutées vs source — pour info, pas des gaps)

Le PRD est plus riche que le MVP source sur plusieurs points (décisions de raffinage, traçables addendum §D) :
- **FR-34 Ajout rapide multiple** + **cold-start manuel-first / CSV en backfill async** (FR-1, FR-33) : absent de la source, ajouté pour ne pas bloquer l'onboarding sur l'export LinkedIn (24h). Bonne décision, mais voir C-2.
- **FR-9 canal-aware**, **FR-11 liste noire des Tells**, **FR-12 revue humaine**, **FR-15 mode sans-IA** : la SOURCE les range dans le COMPOSEUR (Phase 4) sans les nommer explicitement « MVP » dans le bloc phasage ; le PRD les promeut MVP. Cohérent avec « le composeur est le moat » — surplus justifié, pas un gap.
- **FR-14 choix du modèle (Haiku/Opus)** : raffinage technique absent de la source.
- **FR-4 Score de froideur** : la SOURCE le range onglet RÉSEAU (#4) sans le marquer MVP explicitement ; le PRD le met MVP. Surplus cohérent.

---

## 5. Idées qualitatives / UX potentiellement perdues (type c)

Revue fine des nuances comportementales de la source absentes des DEUX destinations (PRD + addendum) :

### C-1. « Améliorer en 3 variantes » (#5 : court / chaleureux / direct, choix en 1 clic). **[PERTE QUALITATIVE PARTIELLE]**
La SOURCE #5 est une idée UX précise : Améliorer propose **3 variantes** (court / chaleureux / direct) piquables en un clic. Le PRD réduit Améliorer (FR-8) à un retravail **en place** unique, sans la notion de variantes proposées. #5 n'apparaît ni en MVP, ni en roadmap §14, ni en addendum.
- La SOURCE liste #5 dans le COMPOSEUR (Phase 4) sans phase explicite ; le composeur étant MVP, #5 était plausiblement MVP-adjacent.
- **Verdict :** idée UX différenciante **perdue** (ou silencieusement reportée). À trancher : reporter explicitement en roadmap ou réintégrer comme option du Composeur. **Gap qualitatif n°1.**

### C-2. Auto-remplissage de contact par URL / lien multi-canal (#34 source réel) + import par lien. **[PERTE]**
Comme noté B-2 : le mécanisme « déposer l'URL du contact → auto-fill best-effort » a disparu (le numéro FR-34 a été réaffecté à l'ajout rapide par collage de liste). Il n'est ni au MVP, ni explicitement en roadmap.
- À noter : l'**extension navigateur pré-remplissant LinkedIn** (fast-follow) couvre une partie de l'intention côté *envoi*, pas côté *import de contact*.
- **Verdict :** intention « importer un contact depuis son URL » non tracée. **Gap qualitatif n°2** (au minimum : la reverser explicitement en roadmap pour ne pas la perdre).

### C-3. « Relance = nouvelle valeur » (#15 : la relance pousse à ajouter un article/update, pas un « alors ? »). **[Couverte narrativement, pas en FR — faible]**
Présente dans UJ-3 (« le composeur propose une relance qui apporte de la valeur (un angle nouveau) plutôt qu'un alors ? »). Mais aucun FR ne porte cette exigence comportementale du composeur en mode relance (FR-25/26/27 traitent la mécanique de relance, pas la qualité du contenu de relance).
- **Verdict :** idée préservée dans la narration UJ mais **non exigée en FR**. Risque de dilution à l'implémentation. Gap mineur (à élever en consequence testable de FR-8 ou FR-25 si on veut la garantir).

### C-4. « Clarté de l'ask » (#13 : Claude flag les asks vagues, suggère un ask précis). **[PERTE silencieuse au MVP]**
SOURCE #13 rangée au COMPOSEUR. Le PRD ne la mentionne nulle part (ni FR, ni Non-Goal, ni roadmap). C'est une feature qualité-du-message côté composeur, plausiblement MVP-adjacente (le composeur est le héros).
- **Verdict :** **Gap qualitatif n°3** — soit l'assumer hors scope explicitement, soit la reverser en roadmap. Actuellement silencieuse.

### C-5. « Détecteur ça pue le copier-coller » (#12 : score de perso 0-100 avant envoi). **[Partiellement absorbée]**
SOURCE #12 = score de personnalisation 0-100 + alerte si générique. Le PRD couvre l'**esprit** via FR-11 (liste noire des Tells) et SM-C1 (zéro Tell à l'envoi), mais **pas le score 0-100** ni l'alerte « générique » distincte des Tells.
- **Verdict :** intention principale préservée (anti-générique) ; la *métrique de personnalisation chiffrée* est perdue. Gap mineur / acceptable (le PRD a choisi la liste noire plutôt que le score). À noter pour ne pas le redécouvrir.

### C-6. « Temps de lecture calibré canal » (#14 : badge « lecture : Xs », seuil par canal). **[PERTE silencieuse]**
SOURCE #14, composeur. Absente du PRD (ni FR, ni roadmap). Micro-feature UX.
- **Verdict :** gap mineur. À reverser en roadmap ou Non-Goal explicite. Actuellement silencieuse.

### C-7. Granularité des canaux MVP (WhatsApp / SMS). **[Cohérent — pas une perte]**
La SOURCE liste WhatsApp API / SMS Twilio comme canaux (#10). Le PRD garde WhatsApp/SMS comme **Canaux** (Glossaire, FR-9, addendum) mais en copier→Envoyé (envoi direct API = v1). Cohérent et explicite. Pas un gap.

### C-8. Idées de fond UX bien préservées (contrôle positif) :
- #72 « architecture simple, 2-3 zones, onboarding 2 min » → PRD §9, §10, FR-33. Préservée.
- #7 « champ unique source de vérité, ton texte EST le message » → FR-6. Préservée fidèlement.
- #50 « garde-fou anti-robot + liste noire IA (tirets cadratins) » → FR-11, §7.1, §9, garde-fou rédactionnel du doc lui-même. Très bien préservée.
- #39 privacy (mode sans-IA, transparence, export/suppr) → FR-15, FR-30/31/32, §7.2. Préservée.
- Insight « composeur = moat, pipeline/relances = table stakes » → §1 Vision, §12 R1, R6. Préservé.
- Effet méta « dev qui livre un SaaS job-search = portfolio » → §1, §2.1 (JTBD Builder), R2. Préservé.

---

## 6. Synthèse des gaps (priorisés)

| # | Type | Élément | Gravité | Recommandation |
|---|---|---|---|---|
| G1 | c (UX perdue) | #5 Améliorer en 3 variantes (court/chaleureux/direct) | Moyenne | Trancher : option du Composeur MVP **ou** roadmap explicite. Ne pas laisser silencieux. |
| G2 | b (phasage) | #31 Notif push : source=v1, PRD=MVP | Faible | Upgrade délibéré et cohérent (UJ-3). Acter le choix, ce n'est pas une erreur. |
| G3 | c + b | #34 Import contact par URL (auto-fill) disparu ; n° FR-34 réaffecté à l'ajout rapide | Moyenne | Reverser l'auto-fill par lien en roadmap ; clarifier la traçabilité du n° 34. |
| G4 | c (UX perdue) | #13 Clarté de l'ask (flag asks vagues) | Faible-Moy | Reverser en roadmap ou Non-Goal explicite. Actuellement silencieuse. |
| G5 | c (UX perdue) | #12 score perso 0-100 + #14 temps de lecture | Faible | Acceptable (esprit #12 dans FR-11). Noter comme reportés pour mémoire. |

**Aucun gap de type (a) :** aucune feature que la SOURCE liste explicitement en MVP n'est absente du PRD MVP. La couverture du MVP source est complète, et même augmentée (cold-start, canal-aware, mode sans-IA, choix modèle).

**Bilan :** réconciliation saine. Le PRD est fidèle au MVP source, le surplus est justifié et traçable (addendum §D). Les seules vraies attentions : une incohérence de phasage bénigne et assumée (G2/notif push), et 3-4 idées UX du composeur (variantes, clarté de l'ask, import par URL, temps de lecture) silencieusement non tracées — à reverser explicitement en roadmap pour ne pas les perdre.
