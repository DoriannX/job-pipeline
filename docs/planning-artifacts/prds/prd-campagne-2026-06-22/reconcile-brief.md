# Réconciliation d'input — Brief → PRD Campagne

> Vérifie que rien du brief source (`brief-campagne-2026-06-22/brief.md`) ni du decision-log (D1→D16) n'a été silencieusement perdu dans le PRD (`prd.md`) ou l'addendum (`addendum.md`).
> Date : 2026-06-22.

## Couverture des décisions D1→D16

Toutes les décisions sont tracées au moins une fois. Vérification :

| Déc. | Tracée où | OK |
|------|-----------|----|
| D1 (problème = sourcing) | PRD §1 (contexte) | ✅ |
| D2 (concept Campagne) | PRD §1, UJ | ✅ |
| D2-bis (réouverture dormants) | PRD FR-49 | ✅ |
| D3 (split hybride) | PRD FR-45, NFR-9, addendum | ✅ |
| D4 (objectif NL au copilote) | PRD FR-40 | ✅ |
| D5 (PDL, rejet diff CSV) | PRD FR-43, §6, addendum | ✅ |
| D6 (scraping banni) | PRD §1, §5, NFR-8, addendum | ✅ |
| D7 (tension privacy, SaaS reporté) | PRD §5, NFR-8 | ✅ |
| D8 (dogfood + SaaS) | PRD §2, addendum persona | ✅ |
| D9 (problème = précision) | PRD §1 | ✅ |
| D10 (north star réponse×timing) | PRD FR-54, §7 | ✅ |
| D11 (dormant OU) | PRD FR-49, UJ-2 | ✅ |
| D12 (bien-timé, N=7/14) | PRD FR-54, §7, §10 | ✅ |
| D13 (réseau-only) | PRD FR-55, §8.1 | ✅ |
| D14 (signaux v1, news→v2) | PRD FR-43/44, §8.3, addendum | ✅ |
| D15 (1 campagne active) | PRD FR-41, NFR-10 | ✅ |
| D16 (persona large) | PRD §2 (renvoi addendum), addendum persona | ✅ |

**Aucune décision manquante.** La traçabilité D1→D16 est complète. Les gaps ci-dessous sont des **nuances qualitatives** et **garde-fous** présents dans le brief mais dilués ou absents du PRD.

## Gaps

### G1 — Garde-fou « anti-robot » / « sans sonner comme un robot » disparu (qualitatif)
- **Ce qui manque :** la vision du brief (l.92) et le positionnement SaaS définissent Campagne par deux promesses jumelles : *« sans aspirer le monde NI sonner comme un robot »*. Le PRD §9 ne reprend que la moitié privacy (« respecte la vie privée ») et **laisse tomber l'anti-robot / la voix**. Or c'est l'ADN de Plume et le lien avec le moat rédaction (FR-50). La fusion sourcing × rédaction perd sa raison d'être qualitative si on n'écrit nulle part que le message final doit rester dans la voix, pas robotique.
- **Où ça devrait aller :** PRD §9 (Vision) — restaurer la formule complète ; éventuellement FR-50 (note : l'angle pré-chargé alimente la rédaction *dans la voix*, anti-robot).
- **Sévérité : notable.**

### G2 — Posture « le moat n'est pas la donnée » : la nuance « grand public » perdue
- **Ce qui manque :** le brief (l.43) insiste — la fusion sourcing × rédaction est ce que *« personne ne fait dans un outil grand public »*. Le PRD §1 garde « le moat est l'intégration » mais coupe le **« grand public »**, qui est précisément ce qui distingue Campagne des outils sales (Apollo/UserGems cités au brief l.44, **eux aussi absents du PRD**). Le contraste concurrentiel explicite (UserGems, Apollo « aspirent tout par défaut ») a disparu.
- **Où ça devrait aller :** PRD §1 « Ce qui le rend différent » (ajouter le contraste concurrentiel + « grand public ») ; ou addendum (section concurrence).
- **Sévérité : notable.**

### G3 — Métrique secondaire « adhésion » : la mise en garde « jamais arbitre » bien présente, mais le risque de proxy-gaming pas explicité
- **Ce qui manque :** brief l.61 et PRD §7 disent tous deux « mesure l'usage, pas la valeur ; jamais pour déclarer le succès » — **c'est bien tracé**. Gap mineur : le brief insiste sur le fait que l'adhésion sert *« à détecter l'abandon »* ; le PRD le garde. Pas de perte réelle ici. (Listé pour complétude — non-gap.)
- **Où ça devrait aller :** n/a.
- **Sévérité : mineur (quasi non-gap).**

### G4 — « courte liste du jour, pas une galerie infinie » : intention préservée mais le « quota tenable » humain dilué en chiffre
- **Ce qui manque :** le brief parle d'un *« quota tenable »* (l.35, 75) — une notion d'**ergonomie / charge humaine soutenable**, pas seulement d'un nombre. Le PRD fige 3-5 (P7, FR-45) et justifie « une décision de moins » (addendum), mais **perd le « pourquoi humain »** : la liste est courte pour rester *tenable au quotidien* (anti-burnout d'outreach), pas par simple choix d'implémentation. La contre-métrique « sur-sollicitation » (§7) touche ce point mais ne le nomme pas.
- **Où ça devrait aller :** PRD FR-45 ou §7 (contre-métrique sur-sollicitation) — une ligne reliant 3-5 à la soutenabilité humaine.
- **Sévérité : mineur.**

### G5 — Open Question « Déclencheur d'ouverture SaaS » : le cadrage « ou rien » du brief atténué
- **Ce qui manque :** D7 et brief scope (l.86) sont catégoriques : SaaS enrichment = *« premium opt-in ultra-cadré (consentement + legal_basis + DPA) **OU RIEN** »* — le « ou rien » est un garde-fou fort (option de ne jamais shipper). Le PRD le reprend en §5.6 et NFR-8 (« ou rien » présent ✅), mais l'Open Question §10 (« Déclencheur d'ouverture SaaS… conditions + cadrage ») **présuppose une ouverture** et ne rappelle pas que « ne jamais ouvrir » reste une issue valide. Nuance d'intention : reporté ≠ acquis.
- **Où ça devrait aller :** PRD §10 (Open Question SaaS) — ajouter « …ou décision de ne pas ouvrir ».
- **Sévérité : mineur.**

### G6 — « le persona définit le problème » (vécu founder) : raison d'être du dogfood affaiblie
- **Ce qui manque :** brief l.48 — *« son vécu définit le problème (rater le bon moment, partir au hasard) »*. C'est l'argument qui légitime le dogfood comme méthode de validation (le founder n'est pas qu'un cobaye, son expérience **est** la source du problème). Le PRD §2 le mentionne en une parenthèse mince ; l'addendum persona le garde (l.49). Couvert, mais l'intention « le dogfood est valide parce que le validateur EST le problème » est sous-pondérée vs le brief. Faible gap.
- **Où ça devrait aller :** addendum persona (déjà partiellement là) — non bloquant.
- **Sévérité : mineur.**

## Verdict

Pas de gap **bloquant**. Traçabilité décisionnelle D1→D16 intègre à 100 %. Les pertes sont **qualitatives** : la structure FR a dilué l'ADN « anti-robot / voix » (G1, le plus important), le contraste concurrentiel grand-public (G2), et quelques nuances de garde-fou (quota tenable, « ou rien » SaaS). Recommandation : corriger G1 et G2 dans le PRD ; G4–G6 sont des polish optionnels.
