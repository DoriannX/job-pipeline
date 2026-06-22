# Revue adversariale — PRD Campagne (2026-06-22)

> Revue cynique. Aucun éloge. Une trouvaille par ligne, taguée severity. Localisation citée.
> Cible : prd.md + addendum.md. Reviewer : on suppose l'auteur se ment jusqu'à preuve du contraire.

## Verdict

Le PRD est bien écrit et stratégiquement cohérent, mais **sa pierre angulaire — le north star « réponse × timing »** — n'est pas mesurable au volume revendiqué (20-30 messages solo). C'est du théâtre statistique qui flattera l'auteur quoi qu'il arrive. La posture privacy est défendable côté *consentement du founder*, mais **élude entièrement le consentement de la personne enrichie** (le contact n'a jamais consenti à PDL), ce qui est le vrai risque RGPD et la faille du « moat privacy ». Plusieurs éléments tagués « bornés / done » ne le sont pas (coût PDL, état de campagne, feedback LLM).

---

## CRITICAL

- **prd.md:93 / 133 (FR-54, north star) — invalidité statistique.** 20-30 messages, dont une fraction « bien timés », l'autre « baseline » : on parle de deux sous-échantillons de ~10-15. Une différence de taux de réponse sur n=10 vs n=15 n'a aucune puissance statistique. Tout écart observé est dans le bruit. La comparaison « bat nettement » est un seuil émotionnel, pas un test. Le north star est **inmesurable par construction au volume revendiqué.**
- **prd.md:35 / 108-118 (privacy) — le contact enrichi n'a jamais consenti.** Tout le dispositif « opt-in juste-à-temps » concerne le consentement du *founder* à utiliser PDL. La personne dont on achète le job-change chez un data broker (PDL) n'a donné aucun consentement, n'est pas informée, et ne peut pas s'opposer. C'est *son* RGPD (base légale, droit d'information art. 14, droit d'opposition) qui est le risque réel — et le PRD ne le traite nulle part. Le « moat privacy » protège le mauvais sujet de données. **La revendication « privacy comme posture défendable » est, sur ce point précis, du marketing.**
- **prd.md:101 / 121-127 / NFR-7 — coût PDL NON borné, contrairement à la revendication.** Le PRD affirme « coût borné » (FR-52, ligne 33 « borne le coût ») mais (a) le quota par campagne est une Open Question non chiffrée (ligne 125, 182), (b) le batch 1x/jour ré-enrichit potentiellement le même set chaque jour → 100 matchs/mois épuisés en ~3-30 jours selon la taille du set, (c) « lié à l'objectif » est défini par un score LLM non déterministe (voir plus bas) donc la taille du set enrichi est elle-même non bornée. « Borné par l'objectif » est une incantation, pas un garde-fou chiffré. **Tagué borné, ne l'est pas.**

## HIGH

- **prd.md:75 / addendum:20-25 (FR-48, feedback négatif) — « signal négatif en contexte LLM » est du hand-waving.** Réinjecter « le founder a écarté X parce que… » dans le prompt de scoring : (a) ne se généralise pas (rejeter Marc n'apprend rien sur Yann), (b) gonfle le contexte linéairement avec les rejets → coût + dilution, (c) aucun mécanisme pour que le LLM *pondère* le négatif vs le positif. L'addendum admet à demi-mot « à rouvrir si l'exemple-en-contexte ne suffit pas » (ligne 25) — c.-à-d. on sait déjà que ça peut ne pas marcher. Ce n'est pas de l'apprentissage, c'est un post-it dans le prompt.
- **prd.md:66 / 79 / 88 — la non-déterminisme du score LLM contamine tout ce qui se dit « borné ».** FR-52 borne l'enrichment aux « contacts liés à l'objectif » ; or « lié à l'objectif » = score de pertinence LLM (FR-42), non déterministe, sans seuil défini. NFR-9 (ligne 103) prétend que les « signaux bruts » sont déterministes — mais le score LLM EST un signal d'entrée et il n'est pas déterministe. Donc le set enrichi (et donc le coût, et donc l'exposition privacy) dépend d'un jugement LLM flou. **Le « triple-emploi de l'objectif » (ligne 33) repose sur une vis sans tête.**
- **prd.md:53 / 62 / NFR-10:104 / addendum:27-31 — trous d'état campagne.** (a) Que devient l'enrichment/scoring *en cours* quand on met une campagne en pause à mi-batch ? (b) Reprendre une campagne « sans perte d'apprentissage » : l'apprentissage est dans le prompt LLM (éphémère) — où est-il persisté pour survivre à une pause de plusieurs semaines ? (c) `close` est-il réversible ? Non spécifié. (d) Que se passe-t-il si l'opt-in PDL est révoqué (FR-51, « à confirmer ») pendant qu'une campagne active en dépend ? Aucune transition décrite. La machine à états est sous-spécifiée malgré le tag « idempotent / cohérent ».
- **prd.md:87 (FR-51) — révocation de l'opt-in marquée « à confirmer ».** Sous RGPD, le retrait du consentement n'est pas optionnel ni « à confirmer » : il est obligatoire (art. 7-3). Le marquer Open Question (ligne 185) trahit que la conformité est traitée comme un nice-to-have. Pour une feature qui se vend sur la privacy, c'est une inversion de priorité.
- **prd.md:143 / 181 — le « garde-fou de mesure » est circulaire.** Valider le north star « en dogfood founder sur 20-30 messages » alors que le founder est juge et partie, connaît l'hypothèse, et choisit lui-même qui contacter (biais de sélection massif : il écrit aux « bien timés » qu'il juge déjà prometteurs). La baseline « hors signal » n'est pas un groupe contrôle — ce sont les contacts qu'il a jugés *moins* prometteurs. Comparer les deux mesure surtout son propre tri a priori. **Auto-confirmation déguisée en métrique.**

## MEDIUM

- **prd.md:93 / 133 (FR-54) — pas de définition de « réponse ».** Qu'est-ce qu'une réponse ? Un accusé poli ? Un « pas intéressé » ? Un RDV ? Sans définition, le numérateur du north star est arbitraire et manipulable a posteriori.
- **prd.md:93 / 180 — N (7/14 j) « à caler sur le 1er jeu de données ».** Choisir le paramètre de succès APRÈS avoir vu les données = p-hacking. On choisira le N qui rend le résultat le plus flatteur. Le seuil de succès doit être pré-enregistré, pas optimisé ex post.
- **prd.md:49 / 79 (FR-49, dormants OU) — explosion de la liste.** « Lié à l'objectif OU signal de timing » : avec un OU large et un score LLM permissif, presque tout dormant « pertinent » remonte. Le garde-fou est le cap 3-5 (FR-45), mais alors le critère de *priorisation* dans le OU n'est jamais défini : qui gagne entre deux candidats, le pertinent-sans-signal ou le signal-sans-pertinence ? Non spécifié → comportement émergent du LLM.
- **prd.md:101 — palier gratuit PDL « 100/mo » pris pour acquis.** Aucune vérification que le plan gratuit PDL autorise un usage commercial/produit, ni que le job-change est dispo au palier gratuit, ni les conditions de rate-limit. Hypothèse de coût bâtie sur une CGU non citée.
- **addendum:9 — match PDL « email normalisé, nom+entreprise ».** Le taux de match PDL sur ces handles n'est pas estimé. Si le match rate est faible (réaliste : 30-60% sur des contacts perso vs corporate), le signal job-change est creux pour la majorité du réseau, et le north star repose sur encore moins de cas. Le risque de couverture n'est pas adressé.
- **prd.md:35 / addendum:36 (D6, Proxycurl) — date de fermeture future suspecte.** L'addendum cite « fermé 2026-07-04 » alors que le PRD est daté 2026-06-22. On justifie une décision par un événement *futur*. Soit la date est inventée/erronée, soit c'est une prédiction présentée comme un fait. Crédibilité de la traçabilité entamée.
- **prd.md:174 / 47-51 addendum — persona SaaS « gardé large » = non décidé.** « Tout networker actif » n'est pas un persona, c'est l'absence de persona. La vision SaaS (ligne 174) se vend sur un marché qu'on refuse de définir. Acceptable en v1 dogfood, mais ne pas prétendre que l'horizon SaaS est « défendable » sans cible.
- **prd.md:46 (FR-46) — batch 1x/jour : heure/fuseau Open Question (ligne 186), mais aussi : que se passe-t-il si le founder ne lit pas la liste pendant 5 jours ?** Cinq batchs = 5× l'enrichment ? Ou idempotent ? Lié au trou de coût ci-dessus.

## LOW

- **prd.md:13 — numérotation FR/NFR héritée fragile.** « FR démarre à FR-40 » avec dépendance à 2 PRD antérieurs : toute renumérotation amont casse les références. Dette de traçabilité.
- **prd.md:133 — « Remplace SM-1 (distance d'édition, caduque) ».** On abandonne l'ancienne métrique sans confirmer que la nouvelle est mesurable (cf. CRITICAL). On remplace une métrique faible par une métrique inmesurable.
- **prd.md:140-141 — métriques secondaires « jamais arbitre ».** « Adhésion » (le founder fait ses N contacts) est présentée comme support, mais en dogfood c'est probablement la SEULE chose réellement mesurable. La rétrograder « jamais arbitre » écarte la seule métrique honnête au profit d'un north star fantôme.
- **prd.md:89 (FR-53) — `legal_basis` par contact, mais quelle base légale ?** Le champ existe ; sa valeur (intérêt légitime ? consentement ?) n'est jamais tranchée — or pour de la donnée tierce achetée, c'est LA question. Champ-placeholder vendu comme conformité.
- **addendum:18 — « prompt caching si le coût le justifie ».** Conditionnel non décidé ; OK en addendum, mais c'est encore un coût non chiffré qui s'ajoute au flou PDL.
- **prd.md:45 — « le lendemain, le founder ouvre la liste du jour ».** Le UJ suppose un cycle J→J+1 fluide ; mais le 1er jour il n'y a aucune liste (batch pas encore tourné). L'amorçage (cold start, jour zéro) n'est pas raconté.

---

## Synthèse des angles attaqués

| Angle | Verdict |
|---|---|
| North star mesurable (FR-54) ? | **Non.** n trop faible, founder juge et partie, N choisi ex post, « réponse » indéfinie. Théâtre auto-flatteur. |
| Privacy défendable ? | **À moitié.** Consentement founder OK ; consentement/information du contact enrichi = absent. C'est le vrai trou RGPD. |
| FR-48 feedback marche ? | **Hand-waving.** Post-it dans le prompt, pas d'apprentissage, ne généralise pas, l'addendum doute déjà. |
| Coût PDL borné ? | **Non.** Quota non chiffré, ré-enrichment quotidien, set défini par LLM non déterministe. |
| État campagne sans trou ? | **Non.** Pause mi-batch, persistance de l'apprentissage, close réversible, révocation opt-in : non spécifiés. |
| « Borné/done » honnête ? | **Non** sur coût, set enrichi, et déterminisme NFR-9 (contaminé par le score LLM). |

Fichier : `C:\Users\P0ulpy\Documents\GitHub\job-pipeline\docs\planning-artifacts\prds\prd-campagne-2026-06-22\review-adversarial.md`
