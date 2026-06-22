---
title: "PRD — Campagne (Plume, Epic 8)"
status: final
created: 2026-06-22
updated: 2026-06-22
---

# PRD : Campagne

> Copilote de sourcing piloté par objectif. Territoire **Epic 8** de Plume, après la clôture d'Epic 7.
> Brief source : [`brief-campagne-2026-06-22/brief.md`](../../briefs/brief-campagne-2026-06-22/brief.md).
> Décisions amont D1→D16 : decision-log du brief. Décisions PRD P0→P11 : [`.decision-log.md`](.decision-log.md).
> **Numérotation FR : démarre à FR-40** (FR-1→35 = PRD app `prd-job-pipeline-2026-06-15` ; FR-36→39 = Epic 7 copilote). NFR à partir de **NFR-7**.

---

## 1. Contexte & problème

Plume sait **écrire** un message dans ta voix et **suivre** tes relances. Il ne répond jamais à la question qui vient *avant* : **qui contacter, et quand ?** Le réseau est là, trié par froideur, mais une galerie froide ne dit ni par où commencer ni pourquoi maintenant.

Le mal n'est **pas l'inaction** — le founder agit déjà. C'est un problème de **précision** : il agit mal (D9).

- **Il rate le bon moment.** Un contact change de poste ou de boîte — la fenêtre idéale pour reprendre contact — et il l'apprend trop tard, ou jamais.
- **Il part au hasard.** Sans stratégie reliée à un objectif concret, il contacte sans angle ; le taux de réponse en souffre.

Coût du statu quo : outreach gaspillé (messages sans angle) + fenêtres d'opportunité manquées. Trier par froideur (ce que fait déjà la galerie, Epic 2/4) ne résout ni l'un ni l'autre : la froideur dit *qui est négligé*, pas *qui vaut la peine maintenant ni pourquoi*.

**Campagne** transforme un objectif en langage naturel en une routine de contact ciblée : objectif → courte liste du jour de qui contacter, chacun avec son *pourquoi* → message pré-chargé dans ta voix. **Sourcing et rédaction en un seul geste.**

### Ce qui le rend différent

- **Ni CRM, ni liste froide.** Campagne dit *qui vaut la peine maintenant, et pourquoi* — relié à un objectif réel, pas à une date.
- **L'objectif = un levier à triple emploi.** Il filtre la pertinence, **borne le coût** (on n'enrichit que les contacts liés au but) et **borne l'exposition privacy** (moins de données partagées). Un seul réglage, trois problèmes résolus.
- **Le moat n'est pas la donnée** (achetable par tous) **mais l'intégration dans un outil grand public** : objectif → sourcing → message **dans ta voix, sans sonner comme un robot**, en un seul flux conversationnel. La fusion sourcing × rédaction que les outils de sales ne font pas.
- **La privacy comme posture, pas slogan.** Les outils de sales (Apollo, UserGems) **aspirent tout par défaut**. Campagne fait l'inverse : enrichment en opt-in explicite, borné par l'objectif, sur ton seul réseau — jamais de scraping (cf. mort de Proxycurl, D6). Défendable là où le marché du sourcing ne l'est pas.

---

## 2. User Journeys

Protagoniste : **le founder** (dogfood — chercheur d'emploi via son réseau personnel). Persona porté inline ; pas de section persona séparée (cf. addendum pour l'horizon SaaS).

### UJ-1 — Donner un objectif, recevoir la liste du jour

Le founder ouvre Plume, va au copilote et tape *« je cherche un lead data à Lyon »*. Le copilote **pose 1-2 questions de cadrage** (séniorité ? Lyon strict ou région ?) puis **enregistre l'objectif comme campagne active** (P3). En fond, l'app score la pertinence de chaque contact vs l'objectif, enrichit (job-change PDL) les **seuls** contacts liés, croise froideur + relances en suspens. Le lendemain, le founder ouvre **la liste du jour dans le copilote** : 3-5 personnes (P7), chacune en **carte structurée inline** avec son *pourquoi* en langage naturel (« Léa est passée Head of Data chez X, pas relancée depuis 5 mois », P4). Il en choisit une → l'objectif **pré-charge l'angle** → le copilote bascule en rédaction dans sa voix.

### UJ-2 — Dialoguer, demander pourquoi, écarter

Dans la liste, le copilote propose **Marc**, un dormant. Le founder : *« pourquoi lui ? »*. Le copilote **détaille le signal** : *« pas de changement de poste, mais lié à ton objectif (data, Lyon) et pas contacté depuis 8 mois — froid mais pertinent »* (transparence, D11 : dormant remonte si *lié à l'objectif **OU** signal*). Le founder écarte : *« pas lui, il a quitté la data. »* Le copilote retire Marc, et ce **rejet nourrit le scoring** (signal négatif) ; le fait « a quitté la data » est conservé **sur la fiche contact** (P6, P10). **Léa** porte un vrai signal job-change : *« écris à Léa »* → bascule rédaction, angle pré-chargé.

### UJ-3 — Consentement, cycle de vie de la campagne

La **première fois** qu'un enrichment est nécessaire, le copilote demande le **consentement explicite, juste-à-temps** : *« Pour repérer les changements de poste, j'interroge People Data Labs sur les contacts liés à ton objectif — uniquement eux. OK ? »* (P11, opt-in OFF par défaut). Le founder accepte ; mémorisé, plus jamais redemandé. Plus tard il veut lancer *« freelance React »* alors que « lead data Lyon » tourne — le copilote signale qu'**une seule campagne est active à la fois** (D15) et **met l'actuelle en pause** (reprenable, garde son apprentissage, P9) pour basculer.

---

## 3. Features & exigences fonctionnelles (FR-40+)

### 3.1 Objectif & campagne

- **FR-40 — Objectif en langage naturel + cadrage.** Le founder donne un objectif au **copilote** en NL (pas de champ structuré, D4). Le copilote pose **1-2 questions de cadrage** (séniorité, périmètre géo, intention) **avant** d'activer la campagne (P3) ; il n'active jamais sans ce mini-cadrage.
- **FR-41 — Campagne active persistante.** L'objectif cadré devient une **campagne active**, persistante. **Une seule campagne active à la fois** au v1 (D15). États : `active | en_pause | close`, transitions nommées et idempotentes (NFR-10). Lancer une nouvelle campagne **met l'actuelle en pause** (P9), reprenable sans perte (objectif, apprentissage). **Trous d'état tranchés :** (i) un batch en cours lors d'une mise en pause **se termine ou s'annule proprement**, sans laisser d'enrichment orphelin ; (ii) `close` est **terminal** (pas de reprise — une campagne close ne se rouvre pas, on en crée une nouvelle) ; (iii) `en_pause` ne déclenche aucun batch ni appel PDL. *Testable :* aucune transition ne crée de doublon de campagne active ; pause à mi-batch ne facture pas d'appel PDL au-delà du quota.

### 3.2 Signaux & scoring

- **FR-42 — Scoring de pertinence vs objectif.** Chaque contact du réseau reçoit un score de pertinence relatif à l'objectif actif, calculé par **LLM** (clé Claude déjà en place, serveur-only). Le scoring est **borné par la campagne active**. *Testable :* étant donné un objectif et un réseau seedé, le scoring produit un ordre de pertinence reproductible **à seed/prompt fixés** (le LLM est non-déterministe par nature, cf. NFR-9 — la reproductibilité s'évalue sur la stabilité du classement, pas l'égalité bit-à-bit).
- **FR-43 — Signal job-change (enrichment PDL).** Détection du changement de poste via **People Data Labs** (D5), **uniquement sur les contacts liés à l'objectif** (l'objectif borne le coût ET l'exposition, FR-52). Soumis à l'opt-in (FR-51). **Résultat caché** : un contact enrichi n'est pas ré-interrogé à chaque batch — re-check à intervalle (le job-change est lent ; intervalle à fixer, esprit mensuel), jamais quotidien (NFR-7). *Testable :* deux batchs consécutifs sur le même contact non-modifié ne déclenchent qu'un seul appel PDL.
- **FR-44 — Signaux internes gratuits.** Froideur (Score de froideur, Epic 2) + relance en suspens (Epic 4) sont des signaux **zéro API** entrant dans le calcul de la liste. Réutilisent l'existant, aucun coût.

### 3.3 Liste du jour

- **FR-45 — Liste du jour dans le copilote.** Liste **courte (3-5, P7)** présentée conversationnellement par le copilote, chaque entrée en **carte structurée inline** (nom + froideur + *pourquoi* + bouton Écrire, P4). **Split hybride (D3)** : l'app calcule le signal brut (déterministe), le copilote le met en mots. Jamais une galerie infinie.
- **FR-46 — Cadence 1x/jour + à la demande.** La liste est (re)générée une fois par jour (batch : enrichment/signaux recalculés) et **à la demande** quand le founder demande « qui aujourd'hui ? » (P8). Pas de temps réel.
- **FR-47 — Dialogue sur la liste.** Le founder peut, en conversation : **demander pourquoi** (le copilote détaille le signal — transparence), **écarter** un contact, répondre. Cohérent avec la surface copilote (FR-45).
- **FR-48 — Écarter nourrit le scoring.** Écarter un contact le retire de la liste **et** réinjecte un **signal négatif** au scoring futur (feedback, P6). Cadrage v1 : exemple négatif borné par campagne dans le contexte de scoring LLM, **pas un modèle entraîné** (mécanisme → addendum). Un fait durable exprimé par le founder (« a quitté la data ») est conservé **au niveau du contact** (P10). *Limite assumée v1 :* l'exemple-en-contexte ne **généralise pas** au-delà des contacts proches du cas écarté ; c'est un garde-fou « ne me re-propose pas **lui** / les évidents voisins », pas un vrai apprentissage. Suffit au dogfood ; vrai feedback loop = hors v1 (cf. §8.3, addendum). *Testable :* un contact écarté ne réapparaît pas dans la même campagne sans nouveau signal.

### 3.4 Dormants

- **FR-49 — Réintégration des dormants.** Un contact dormant **remonte** dans la liste s'il est **lié à l'objectif actif OU porteur d'un signal de timing** (D11, D2-bis) — jamais « ET » (ne pas rater un dormant pertinent sans signal), jamais « tous » (éviter la liste froide brute = Epic 4).

### 3.5 Pont sourcing → rédaction

- **FR-50 — Pré-chargement de l'angle.** Choisir un contact dans la liste (« écris à X ») **bascule le copilote en rédaction** avec l'**angle pré-chargé par l'objectif** : sourcing et rédaction en un seul geste. Réutilise le moat rédaction (Epic 7 copilote : FR-36→39, few-shot voix, sanitize, generation_events).

### 3.6 Privacy & consentement

- **FR-51 — Opt-in enrichment juste-à-temps.** L'enrichment PDL est **OFF par défaut**. Le copilote demande le consentement explicite **pile avant le 1er appel PDL**, en contexte (P11). Accepté → mémorisé, plus jamais redemandé. **Révocable** dans Réglages > Confidentialité — la révocation **arrête tout appel PDL futur** ; obligation RGPD (consentement retirable), pas optionnel. *Testable :* opt-in OFF → zéro appel réseau PDL ; révocation après opt-in → plus aucun appel.
- **FR-52 — Enrichment borné par l'objectif.** Seuls les contacts **liés à l'objectif actif** sont enrichis — jamais tout le réseau (coût + exposition privacy, le triple-emploi de l'objectif).
- **FR-53 — Provenance & transparence.** Tout contact enrichi porte sa provenance / base légale (`source`, `imported_at`, `legal_basis`, AR-16). L'app explicite **ce qui est transmis et à qui** (PDL pour l'enrichment, Claude pour le scoring/la rédaction) — extension de la transparence API (FR-32/UX-DR21).

### 3.7 Mesure (north star)

- **FR-54 — Instrumentation réponse × timing.** Le système horodate **le signal détecté** et **l'envoi** du message, calcule si le message est **« bien timé »** (parti dans les **N jours** d'un signal, N = paramètre PRD candidats 7/14, D12), et permet de comparer le **taux de réponse des messages bien timés vs la baseline** (messages hors signal). North star D10. *Testable :* chaque message porte `signal_detecte_at`, `envoye_at`, un booléen `bien_time` dérivé, et un lien au statut `répondu` ; les deux taux sont calculables sur requête.

---

## 4. Exigences non-fonctionnelles (NFR-7+)

*En complément des NFR-1→6 du PRD app (perf composeur, archi SaaS-ready, mobile-first, privacy, coût, résilience), qui restent valides.*

- **NFR-7 — Coût enrichment borné (3 garde-fous cumulatifs).** (a) set éligible borné par l'objectif (FR-52) ; (b) **cache + re-check à intervalle** — pas de ré-enrichment d'un contact déjà enrichi à chaque batch (FR-43) ; (c) **quota dur numérique par campagne** — plafond d'appels PDL, **refus au-delà** (jamais best-effort silencieux). Respect du palier gratuit (100/mo) ; valeur du quota à fixer (Open Q) mais le **plafond dur est requis**. Cible : l'enrichment ne mange pas la marge (esprit NFR-5).
- **NFR-8 — Privacy enrichment first-class.** Opt-in explicite (FR-51), **réseau-only** (FR-55/scope), **jamais de scraping** (D6), effacement cross-user (RGPD, AR-16). Toute ouverture SaaS exige consentement + legal_basis + DPA (D7) — **reportée**.
- **NFR-9 — Split hybride, signaux testables.** Deux natures de signal : (a) **signaux déterministes** — froideur (Epic 2) et job-change (booléen PDL) — calculés par l'app, testables à l'identique ; (b) **score de pertinence LLM** (FR-42) — **non-déterministe par nature**, évalué sur la **stabilité du classement** (pas l'égalité exacte), via un panier d'évals figé (esprit Story 3.9). La **mise en mots** et le dialogue passent par le copilote (D3). Une régression d'un signal déterministe ne doit jamais être masquée par la couche conversationnelle ; une dérive du score LLM est attrapée par les evals.
- **NFR-10 — État de campagne cohérent.** L'unicité « une campagne active » (D15) et les transitions `active ↔ en_pause → close` sont idempotentes et scopées `user_id` (AR-2). Horloge injectée pour le batch quotidien (AR-6).

---

## 5. Privacy & RGPD (concern n°1)

La tension est explicite (D7) : Campagne introduit un appel tiers (PDL) dans un produit dont la doctrine est *« zéro partage tiers »* (NFR-4, project-context). Résolution :

1. **MVP = dogfood founder seul.** PDL n'est activé que pour le founder, en validation. Pas d'exposition d'autrui non maîtrisée.
2. **Opt-in explicite, juste-à-temps, OFF par défaut** (FR-51) — la marque tient « privacy par défaut, enrichissement = choix ».
3. **Borné par l'objectif** (FR-52) — surface de données partagées minimale.
4. **Réseau-only** (FR-55) — jamais de sourcing d'inconnus, jamais de scraping (D6, mort de Proxycurl).
5. **Provenance tracée** (FR-53, AR-16) — `legal_basis` par contact, effacement cross-user prêt.
6. **SaaS = décision reportée** (D7) — ne PAS shipper l'enrichment en core multi-user ; premium opt-in ultra-cadré (consentement + DPA) ou rien.

> **[NOTE FOR PM] — Le sujet de données protégé est le mauvais.** L'opt-in (FR-51) protège le **founder**, mais le **contact enrichi** est un **tiers qui n'a jamais consenti** à une requête PDL le concernant (RGPD **art. 14** : information de la personne dont les données ne sont pas collectées auprès d'elle). Au MVP dogfood single-user, l'exposition est minimale (réseau perso du founder, un seul user, pas de diffusion) et le risque est porté/assumé par le founder — mais l'obligation art. 14 **existe déjà**. **Avant SaaS** : mécanisme d'information du tiers + base légale documentée (`legal_basis`, AR-16) + DPA. C'est le vrai garde-fou légal, pas l'opt-in founder. Posture marque honnête : « privacy défendable **pour ce que je contrôle** » — ne pas sur-vendre la protection du tiers.

---

## 6. Coût & quotas PDL (concern n°2)

Trois garde-fous **cumulatifs** (l'un seul ne suffit pas — l'adversarial avait raison : « borné » sans chiffre est une incantation) :

1. **Borne objectif** (FR-52) — seuls les contacts liés à l'objectif actif sont éligibles.
2. **Cache + intervalle** (FR-43) — un contact déjà enrichi n'est **pas** ré-interrogé à chaque batch ; re-check à intervalle (job-change lent). Tue le coût récurrent du « re-enrich quotidien ».
3. **Quota dur par campagne** (NFR-7) — plafond **numérique** d'appels PDL/campagne, refus au-delà (pas best-effort). Valeur à fixer (Open Q), mais le **mécanisme de plafond dur est requis**, pas optionnel.

- Palier gratuit PDL = **100 matchs/mois** ; au-delà ~**$0,28/match** (D5). Le set éligible étant défini par un score LLM (FR-42, non-déterministe), c'est le **quota dur (garde-fou 3)** qui borne réellement, pas le score.
- Cadence **1x/jour + à la demande** (FR-46) s'applique au *recalcul de la liste*, pas à un ré-enrichment systématique (cf. garde-fou 2).
- Modèle de coût au-delà du palier gratuit (seuil, quota, alerte) = **Open Question**.

---

## 7. Success metrics

**North star — composite « réponse × timing » (D10).** Un message est *bien timé* s'il part dans les **N jours** d'un signal détecté (N à fixer, 7/14, D12). Métrique principale = **taux de réponse des messages bien timés vs baseline** (taux de réponse hors signal). Si Campagne marche, le premier **bat nettement** le second. *Remplace SM-1* (distance d'édition, caduque en conversationnel).

**Contre-métriques / garde-fous :**
- **Volume d'enrichment** (anti-dérive coût) — nombre d'appels PDL par campagne ≤ quota.
- **Sur-sollicitation** — la liste reste courte (3-5) ; ne pas regonfler vers la galerie froide.

**Métriques secondaires (support, jamais arbitre) :**
- **Réactivation de dormants** — nb de dormants pertinents repris grâce à une suggestion (pas spontanément).
- **Adhésion** — le founder fait réellement ses N contacts ciblés du jour (mesure l'usage, pas la valeur ; détecte l'abandon).

**Garde-fou de mesure :** validation en dogfood founder, sur un volume réel (esprit R1, 20-30 messages ; à dimensionner — Open Q).

> **[NOTE FOR PM] — Le north star est directionnel au stade dogfood, pas un test statistique.** À 20-30 messages solo (≈ 10 bien-timés vs 15 hors-signal), il n'y a **aucune puissance statistique** : « bat nettement le hasard » est un **signal qualitatif de GO/PIVOT**, pas une preuve. Le founder est juge et partie. C'est **acceptable et assumé** pour une décision dogfood (le but = sentir si ça marche, pas publier), mais la **validation statistique réelle exige l'échelle SaaS** (N élevé, multi-user). Ne pas confondre les deux : le dogfood tranche la continuation, pas la vérité. Le seuil de GO (combien de messages, quel écart) reste une Open Question — le fixer **avant** de mesurer, pas après (anti-biais de confirmation).

---

## 8. Scope

### 8.1 Frontière dure

- **FR-55 — Réseau existant uniquement.** Campagne opère sur les contacts **déjà dans Plume** (+ enrichment dessus). Sourcer des inconnus hors réseau est **hors périmètre** (D13).

### 8.2 Dans le v1 (dogfood founder)

Objectif NL + cadrage (FR-40) · campagne active unique, pausable (FR-41) · scoring pertinence LLM (FR-42) · signal job-change PDL borné (FR-43) · signaux internes gratuits (FR-44) · liste du jour 3-5 dans le copilote, cartes inline (FR-45-47) · écarter→apprentissage (FR-48) · dormants réintégrés (FR-49) · pré-chargement rédaction (FR-50) · opt-in juste-à-temps + borné + provenance (FR-51-53) · instrumentation north star (FR-54).

### 8.3 Explicitement hors v1

- **Sourcing net-new externe** (inconnus hors réseau) — D13.
- **Scraping LinkedIn** — banni définitivement (D6).
- **News par boîte** (levée/recrutement) → **v2**, 2e source externe, signal plus faible (D14).
- **Enrichment de tout le réseau** — seuls les contacts liés à l'objectif (FR-52).
- **Multi-campagnes parallèles** — une active à la fois au v1 (D15).
- **Écran app dédié** à la liste du jour → v2 si besoin de scannabilité (P5).
- **Ouverture SaaS de l'enrichment** — décision reportée (D7).
- **Apprentissage = modèle entraîné** — v1 = signal négatif en contexte LLM, pas de training (P6).

---

## 9. Vision

Aujourd'hui Plume t'aide à écrire et à ne rien oublier. Si Campagne marche, il t'aide aussi à **décider où mettre ton énergie** — et la boucle devient complète : *un objectif → les bonnes personnes au bon moment → un message dans ta voix → un suivi sans fuite.* La campagne pilotée par objectif devient la colonne vertébrale de Plume.

À 2-3 ans, si l'ouverture SaaS se confirme : **le copilote d'outreach relationnel qui respecte la vie privée** — celui qui aide chacun à activer son réseau vers un but, **sans aspirer le monde ni sonner comme un robot**. Positionnement défendable là où le marché du sourcing ne l'est pas. Conditionné à une preuve simple : que le north star (réponse × timing) batte nettement le hasard, en dogfood.

---

## 10. Open Questions

- **N (fenêtre « bien timé »)** : 7 ou 14 jours ? À fixer au 1er jeu de données (D12).
- **Volume de validation dogfood** : combien de messages avant GO sur le north star (esprit R1, 20-30) ?
- **Modèle de coût PDL au-delà du palier gratuit** : seuil / quota par campagne (NFR-7).
- **Déclencheur d'ouverture SaaS de l'enrichment** : conditions + cadrage RGPD/DPA (D7).
- **Séquencement vs roadmap** : Epic 8, après clôture Epic 7 et jalon R1 redéfini.
- **Heure/fuseau du batch quotidien** : fenêtre exacte du recalcul 1x/jour (AR-6 horloge injectée, P8).
- **Intervalle de re-check enrichment** : tous les combien ré-interroger PDL sur un contact déjà enrichi (FR-43, esprit mensuel — à caler sur la vélocité réelle des job-changes).
- **Seuil de GO du north star** : combien de messages + quel écart bien-timé/baseline déclenche GO — **à fixer avant de mesurer** (anti-biais, cf. NOTE PM §7).
- **Mécanisme art. 14 RGPD (tiers enrichi)** : avant SaaS, comment informer la personne enrichie (cf. NOTE PM §5).

---

## 11. Couverture FR & rattachement archi

- **FR-40→55** (16 FR nouveaux) · **NFR-7→10** (4 NFR nouveaux).
- Réutilise : copilote Epic 7 (FR-36→39, surface IA unique) · moat rédaction (few-shot, sanitize AR-3, generation_events AR-8) · froideur Epic 2 · relances Epic 4 · porte `db.forUser` AR-2 · provenance AR-16 · horloge injectée AR-6.
- Net-new infra (→ architecture) : intégration PDL serveur-only (clé secrète, NFR-8) · table `campagnes` (état, objectif, opt-in) · scoring LLM borné · instrumentation timing (FR-54) · feedback négatif (FR-48).
