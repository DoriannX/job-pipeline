# PRD Quality Review — Plume (job-pipeline)

## Overall verdict

Ce PRD est solide et atypiquement honnête pour un document solo-founder : il a une thèse nette (le composeur "ta voix" est le seul moat ; pipeline et relances sont des table stakes copiables), et cette thèse pilote réellement la priorisation, les métriques et les risques. Les FRs portent des conséquences testables, les omissions sont explicites, les hypothèses sont taguées et indexées sans fuite. Ce qui reste fragile tient à la dimension la plus chargée en aval — la done-ness : le cœur de valeur (FR-7/8/10/11, qualité de la Voix) repose sur des critères qualitatifs ("dans son ton", "trop lisse") dont la testabilité est déléguée à SM-1 sans seuil chiffré, et quelques adjectifs non bornés subsistent ("quasi instantané", "discret"). Rien de bloquant pour démarrer en mode perso ; les points à durcir le sont surtout en vue de la chaîne UX → archi → epics.

## Decision-readiness — strong

Le PRD se décide. Les arbitrages structurants sont posés comme des décisions, pas comme des "considérations", et la matrice §D de l'addendum trace chaque option retenue contre les alternatives écartées avec le rationale (cold-start manuel-first vs CSV-as-front-door, copier→Envoyé vs envoi direct, Haiku vs Opus, few-shot vs fine-tuning). Le compromis central est nommé sans fard en §1 : « plus tu veux bien faire, plus c'est lent ; plus tu vas vite, plus ça sonne faux ». Les trade-offs disent ce qui est sacrifié, pas seulement ce qui est choisi — ex. §4.1 explique pourquoi le CSV n'est *pas* la porte d'entrée (« l'export LinkedIn complet peut prendre jusqu'à 24h, ce qui casserait le cold-start »).

Les Open Questions (§16) sont réellement ouvertes, pas rhétoriques : pricing non arrêté, seuil d'exemples pour une Voix convaincante (« Haiku suffit-il ou faut-il Opus ? »), base légale RGPD. Les trois `[NOTE FOR PM]` tombent sur de vraies tensions (RGPD tiers avant SaaS en §7.2, quota non chiffré en §7.3, valeur d'import différée en §6.2), pas sur des checkpoints décoratifs. La §H de l'addendum ("Tensions non résolues") va jusqu'à exposer le pari de fond non résolu : « automatiser au maximum [...] tout en garantissant que rien ne sente l'automatisation ». C'est l'inverse d'un PRD qui lisse tout au neutre.

## Substance over theater — strong

Peu de meuble. Le différenciateur n'est pas un paragraphe de template : la §13 ("Pourquoi maintenant") fait un vrai pari daté — l'outreach IA générique en fin de cycle, les détecteurs et filtres plateforme qui font chuter les taux de réponse — et nomme le concurrent le plus proche en l'attaquant (« Careerflow s'en approche [...] mais reste sur des templates génériques, pas sur ta voix »). La §F (paysage concurrentiel) classe cinq familles d'acteurs et dit précisément ce qui manque à chacune ; ce n'est pas de l'innovation-theater.

Persona : un seul protagoniste nommé (Camille, §2.3) plus le builder/fondateur — sous le seuil de quatre, et chaque UJ porte une décision (UJ-1 fonde le cold-start et la File du jour, UJ-2 le verrou read-only, UJ-3 le push de relance). Pas de persona-meuble.

Les NFRs (§11) échappent en partie au boilerplate parce qu'ils renvoient à des FRs concrets (scoping par user FR-29, résilience import FR-1) ou à des chiffres en §7.3. Réserve : « Perf composeur [...] génération perçue comme quasi instantanée » est la formulation la plus proche du NFR-theater du document — adjectif sans borne (voir Done-ness). La §G (gouvernance des stats : stats autorisées vs « débunkées — ne pas réintroduire ») est un signe inhabituel de discipline anti-vanity.

## Strategic coherence — strong

C'est le point fort du PRD. La thèse est explicite et répétée comme une contrainte, pas comme un slogan : §1 « Le pipeline et les relances sont des table stakes, copiables ; le composeur est le moat ». La hiérarchie des features en découle — §4.2 est titrée « Composeur "ta voix" (le héros) » et marquée « Cœur du produit et seul moat », tandis que le pipeline et les relances sont assumés copiables.

Les Success Metrics valident la thèse plutôt que de mesurer l'activité : SM-1 (faisabilité de la Voix, « taux d'édition faible entre le texte généré et le texte envoyé ») est désigné « Proxy direct du moat (R1) » ; la métrique d'usage SM-2 est explicitement subordonnée. Les contre-métriques existent et sont bien orientées : SM-C1 (« Sonner IA » — zéro Tell), SM-C3 (« Volume de messages [...] ne pas optimiser [...] anti-spray ») contrebalance directement le réflexe de croissance. C'est exactement le « DAU/MAU tell » que la rubrique cherche, et il est évité.

Le MVP est un scope-kind cohérent de type problem-solving / expérience (la boucle perso d'outreach), et la logique de scope colle : SaaS-ready dans l'archi (§1, FR-29) mais exploitation mono-utilisateur, freelance explicitement repoussé en non-persona (§2.2) « pour ne pas le diluer ». Le risque R1 est numéroté n°1 et adressé par la métrique n°1 — l'arc tient de bout en bout.

## Done-ness clarity — adequate

C'est la dimension à durcir, et celle sur laquelle la création de stories s'appuiera le plus. La structure est bonne : chaque FR porte un bloc « Consequences (testable) », et la majorité sont effectivement vérifiables — FR-1 (« chaque ligne valide crée ou met à jour un Contact » ; « un compte-rendu N créés / N fusionnés / N ignorés est affiché »), FR-12 (« il n'existe aucun chemin produit qui envoie un Message sans action humaine explicite »), FR-22, FR-33 (« moins de deux minutes [...] sans étape bloquante »). Pour celles-là, un ingénieur sait ce que "fait" veut dire.

La faiblesse est concentrée là où ça compte le plus — le moat. La done-ness de FR-7/FR-8/FR-10 est portée par des formulations qualitatives : FR-10 « le texte généré reflète le ton de l'utilisateur (évalué qualitativement via SM-1) », FR-8 « sans le remplacer par un texte hors-sujet ». "Reflète le ton" et "hors-sujet" ne sont pas testables en l'état ; le PRD le sait et délègue à SM-1 — mais SM-1 lui-même est non chiffré (« taux d'édition faible », sans seuil). La done-ness du cœur de valeur est donc une chaîne de renvois qualitatifs sans plancher mesurable. Pour un MVP perso de validation c'est acceptable (la faisabilité de la Voix EST l'expérience à mener, cf. R1/SM-1) ; pour alimenter une story d'acceptation, il manque un critère opérationnel, même provisoire.

FR-11 est mieux loti — « Aucun tiret cadratin dans un texte généré » est binaire et testable — mais sa seconde conséquence retombe dans le flou : « Les formules de la liste noire sont absentes ou signalées avant envoi » suppose une liste noire qui n'est jamais énumérée ni dans le PRD ni dans l'addendum (le contenu de la "Liste noire des Tells" reste implicite au-delà des exemples du Glossaire).

### Findings
- **medium** Critère d'acceptation du moat sans plancher mesurable (§15 / SM-1, renvoyé par FR-7, FR-8, FR-10) — SM-1 (« taux d'édition faible entre le texte généré et le texte envoyé ») est le seul critère de done-ness du cœur de valeur, mais "faible" n'est pas chiffré ; FR-10 le formalise en « reflète le ton [...] évalué qualitativement », ce qui n'est pas vérifiable seul. La chaîne FR → SM est correcte mais le maillon final manque d'un seuil. *Fix :* fixer un seuil cible provisoire pour SM-1 (ex. « distance d'édition < X % sur Y messages » ou « N/20 messages envoyés sans réécriture majeure »), quitte à le réviser après le premier run — c'est de toute façon l'expérience R1.
- **low** Adjectifs non bornés résiduels — « génération perçue comme quasi instantanée » (§11, repris §7.3), « bouton Modifier discret » (FR-20, §4.4), « gestes rapides » (FR-24). *Fix :* borner la perf (ex. premier token < 2 s, ou « pas de spinner bloquant ») ; pour FR-20/FR-24 c'est cosmétique, à laisser à l'UX.
- **low** Contenu de la Liste noire des Tells non énuméré (FR-11, Glossaire §3) — la conséquence « formules de la liste noire absentes ou signalées » est invérifiable sans la liste. *Fix :* annexer la liste de départ (même courte) en addendum, comme corpus testable et versionnable.

## Scope honesty — strong

Les omissions sont explicites, pas inférées. La §5 (Non-Goals) fait un vrai travail : elle exclut nommément l'automate d'envoi, le scraping, l'humanizer anti-détecteur, le multi-utilisateur, le pipeline d'Opportunités, et même des choix de design « pas de brouillon toujours pré-généré (champ vide par défaut) » — décision que l'addendum §D relie à une idée explicitement rejetée au brainstorming (idée #61). La §6.2 ("Hors périmètre MVP") double avec le rattachement de version (v1/v2/v3). Le de-scoping est proposé, pas fait en silence : le CSV est dégradé en backfill async avec justification, le scan Gmail est repoussé avec un `[NOTE FOR PM]` sur sa valeur différée.

Les `[ASSUMPTION]` taguent bien des inférences non confirmées par l'utilisateur (seuils de froideur, cadence J+5, SMS≈WhatsApp, navigation à 3 onglets) et tous sont indexés en §17. Densité open-items : 11 assumptions + 3 NOTE FOR PM + 7 Open Questions, pour un PRD MVP solo en amont de la chaîne — c'est proportionné aux stakes (validation, pas green-light-to-ship), et les items portent sur des valeurs à calibrer à l'usage, pas sur des trous de conception. Aucune assumption ne masque une décision qui aurait dû être prise. Bon réflexe : chaque assumption est circonscrite (« Seuils à ajuster », « valeur ajustable ») plutôt que présentée comme un fait.

## Downstream usability — strong

Le PRD est conçu pour être source-extrait. Le Glossaire (§3) est présent, normatif (« Termes à utiliser verbatim [...] pas de synonyme ailleurs »), et les nouns y sont définis avec leurs cardinalités (Contact 1—N Messages, etc.), ce que l'addendum §A reprend en entités. Les termes-clés (Contact, Message, Canal, Statut, Composeur, Voix, Few-shot voix, Relance, Score de froideur, File du jour) sont employés de façon cohérente d'un FR à l'autre.

Traçabilité des IDs : FR-1..FR-33 contigus, FR-34 ajouté hors séquence (choix de stabilité d'ID assumé, non problématique). Toutes les références croisées résolvent — vérifié sur l'ensemble des FR-/UJ-/SM- : aucun renvoi pendant. Les UJ ont un protagoniste nommé (Camille) qui porte le contexte inline ; pas d'UJ flottant. Les SMs renvoient aux FRs qu'ils valident (SM-1 → FR-7/8/10/11). L'addendum est correctement positionné comme non-normatif (« le PRD reste la source de vérité produit ») et fléché vers archi/UX, ce qui évite l'ambiguïté de double source. Chaque section se tient extraite seule, les renvois passant par des termes du Glossaire et des IDs plutôt que par « voir ci-dessus ». Pour une chaîne UX → architecture → epics, c'est du matériel propre.

## Shape fit — strong

La forme correspond au produit. C'est un produit grand public à UX significative et mobile-first : les UJs à protagoniste nommé sont load-bearing ici, et le PRD les a (3 UJs, denses, qui pilotent des FRs concrets) — ni sur- ni sous-formalisé. La densité d'UJ est juste : trois parcours qui couvrent la boucle (file du jour, amélioration de brouillon, rattrapage de relance) sans inflation.

Le PRD assume sa double nature solo/SaaS-ready sans se tordre : rigueur calibrée "léger mais substantiel" (cohérent avec un MVP perso), tout en gardant la traçabilité dont la chaîne aval a besoin (chain-top). La séparation PRD produit / addendum technique est le bon découpage pour ce stade : le PRD ne se noie pas dans les entités et le transport, qui vivent en §A/§B de l'addendum. Le rattachement explicite « architecture SaaS-ready dès le départ [...] exploitation mono-utilisateur » (§1, §11) est traité comme une contrainte de forme, pas comme une ambiguïté. Aucune sur-formalisation (pas d'appareil de gouvernance lourd inutile) ni sous-formalisation (un produit UX sans UJs). La forme sert le fond.

## Mechanical notes

- **ID continuity** — FR-1..FR-33 contigus ; FR-34 hors séquence par choix de stabilité d'ID (connu, non signalé comme défaut). Aucun doublon. UJ-1..3, SM-1..5, SM-C1..3 uniques et définis.
- **Cross-refs** — Toutes les références FR-/UJ-/SM- résolvent vers une cible définie ; aucun renvoi pendant détecté (vérifié exhaustivement).
- **Assumptions Index roundtrip** — Propre. 11 tags `[ASSUMPTION]` inline ↔ 11 entrées en §17, correspondance exacte. À noter : le tag de §10 (ligne 390) est un `[ASSUMPTION]` nu dont le contenu est porté par l'occurrence jumelle de §6.2 (ligne 346) ; les deux mappent l'unique entrée « §6.2 / §10 » de l'index — cohérent mais le tag nu pourrait recopier sa formulation pour être auto-portant hors contexte.
- **Glossary drift** — Très faible. Usage verbatim des termes du Glossaire dans les FRs/UJs/SMs. Micro-écart : le Glossaire et le PRD parlent de « Relance » alors que l'addendum §A nomme l'entité `next_actions` (Relances) — alignement explicite entre parenthèses, donc pas une dérive réelle, mais à conserver tel quel pour l'archi.
- **NOTE FOR PM** — 3 callouts, tous sur de vraies tensions (RGPD tiers, quota SaaS, valeur d'import différée). Pas de `[NON-GOAL]` inline, mais la §5 Non-Goals couvre le besoin ; aucune omission silencieuse repérée.
- **Sections requises** — Toutes présentes pour le type/stakes (Vision, Utilisateur/JTBD, Glossaire, Features+FRs, Non-Goals, Périmètre, Contraintes, Risques, Métriques+contre-métriques, Open Questions, Index hypothèses, Roadmap, addendum technique). Aucune section attendue manquante.
