# Spine Pair Review — Plume

## Overall verdict

La paire de spines est **prête à servir de contrat aval** : couverture mécanique quasi totale, tokens complets et résolvants, parcours nommés du PRD tous portés par un Key Flow avec climax, et discipline d'héritage propre (noms verbatim, glossaire fidèle, refs `EXPERIENCE → DESIGN` toutes vertes). Les deux seuls trous structurels à impact aval réel : les **mocks `.working/` ne sont liés inline nulle part** (EXPERIENCE.md ne référence que des noms de fichiers, sans dire ce que chaque mock illustre, et DESIGN.md n'en cite aucun), et **deux cibles de contraste annoncées (accessibilité) sont absentes** alors que les combinaisons porteuses existent. Le reste relève du polish. Aucune incohérence bloquante ; les lacunes sont honnêtement déclarées et non fabriquées.

## 1. Flow coverage — strong

Extrait des sources frontmatter (PRD §2.3, source-extract §3) : **UJ-1** (boucle quotidienne), **UJ-2** (améliorer un brouillon écrit à la main), **UJ-3** (rattrapage / relance zéro-fuite), + onboarding cold-start (FR-33). EXPERIENCE.md livre trois Key Flows avec protagoniste nommé (Camille), étapes numérotées, beat `[CLIMAX]` explicite et chemin d'échec :
- Flow 1 = UJ-1 (climax « le message sonne comme elle, pas comme un robot », échec réseau coupé / saisie préservée).
- Flow 2 = onboarding < 2 min (climax « Tout est prêt, Camille », découplage CSV).
- Flow 3 = UJ-3 zéro-fuite (climax compteur reste à zéro, variante « Oui »).

### Findings
- **medium** UJ-2 (« Améliorer un brouillon écrit à la main ») n'a pas son propre Key Flow numéroté. Son comportement clé — *Améliorer retravaille en place, garde idées et ton*, adaptation canal-email — est bien couvert en Component Patterns et State Patterns, mais le seul parcours où une personne *part d'un texte tapé à la main* (le cas « champ non vide → Améliorer ») n'est jamais déroulé bout en bout. Flow 1 mentionne Améliorer en passant (étape 7 « mais elle n'en a pas besoin »). *Fix :* ajouter un Flow 4 court dérivé de UJ-2, ou marquer explicitement que UJ-2 est absorbé dans Flow 1 pour qu'un consommateur ne le cherche pas.

## 2. Token completeness — strong

Extraction : tous les tokens du frontmatter DESIGN.md (`colors.*`, `typography.*`, `rounded.*`, `spacing.*`, `components.*`) sont définis ; chaque `{chemin.token}` cité en prose dans **les deux** fichiers résout vers une clé existante (vérifié exhaustivement, ~115 refs DESIGN + ~28 refs EXPERIENCE, zéro orpheline). Tous les tokens couleur portent un hex. Les `{colors.cold.*}` cités correspondent bien aux valeurs **corrigées** (#15/#16), pas aux valeurs alarmistes obsolètes de la décision #12.

### Findings
- **medium** Aucune **cible de contraste chiffrée** n'est annoncée pour les combinaisons porteuses, alors que l'Accessibility Floor d'EXPERIENCE.md renvoie le contraste à DESIGN.md (« Le contraste visuel vit dans `DESIGN.md` ») et que DESIGN.md dit lui-même « Cibles de contraste annoncées pour les combinaisons porteuses » par sa propre logique. Combinaisons à risque non vérifiées : `ink-soft #5F726D` et surtout `ink-hint #9DB5AD` sur `surface.app #E9F3EF` / `surface.card #FBFEFD` (placeholders, hints, onglets inactifs — `ink-hint` sur fond clair est probablement < 4.5:1) ; `accent-deep #876585` sur `accent-tint #ECE2EA` (texte de chip / valeur de stepper) ; `mint-deep #4E8978` sur `surface.chip #DCEFE9` (token-pill, segment idle). *Fix :* ajouter en section Colors (ou Components) un ratio cible AA pour ces paires texte-sur-fond, ou les déclarer explicitement comme « décoratif / non porteur de texte critique » si c'est le cas.
- **low** `pager.dot-idle: '#C7DDD5'` est un hex brut dans un token de composant (et répété en prose « idle en `#C7DDD5` ») plutôt qu'une couleur nommée du bloc `colors`. Idem dans Components. *Fix :* promouvoir en `colors.pager-dot-idle` (ou réutiliser `line`/`mint-offset`) pour que tous les hex porteurs vivent dans `colors`.
- **low** Les tokens `colors.cold.*-shade` (4) sont définis et utilisés (ombre interne du blob) mais référencés en prose seulement par le suffixe générique « (`-shade`) », jamais par chemin individuel. Résout quand même ; juste à noter que la traçabilité par token y est plus faible qu'ailleurs.

## 3. Component coverage — strong

Chaque composant nommé a une ligne **visuelle** dans DESIGN.Components ET une ligne **comportementale** dans EXPERIENCE.Component Patterns, avec règles réelles (pas de placeholder). Couplé verbatim : card-deck, button-primary/secondary, bouton intelligent Générer↔Améliorer, chip-relance, coldtag, bottom-sheet, field, channel-selector, segmented, token-pill, tabbar, toggle, stepper, pager, group-card, hints de gestes, état vide, avatar-blob, feather-mark.

### Findings
- **low** **Bloc Consommation** est documenté côté visuel (DESIGN.Components, « deux cartes-stats côte à côte… barre de progression ») mais n'a pas de ligne dédiée dans EXPERIENCE.Component Patterns ; son comportement vit dispersé dans la section produit « Coût & transparence ». Couvert, mais pas au même endroit que les autres composants. *Fix :* une ligne dans Component Patterns renvoyant à Coût & transparence, ou l'assumer comme contenu de surface (non-composant).
- **low** EXPERIENCE.md liste **Bouton + (icon-button accent)** et **Recherche** (en-tête Réseau) comme composants comportementaux ; DESIGN.md ne leur donne aucune ligne visuelle dédiée (l'icon-button n'est évoqué qu'indirectement dans Shapes « icon-buttons ~11 à 16px »). Mineur car ce sont des éléments d'en-tête simples, mais un consommateur dev n'a pas d'ancre visuelle pour le champ Recherche ni le bouton +. *Fix :* une ligne Components pour l'icon-button + / la barre de recherche, ou les marquer hérités d'un pattern field/button existant.

## 4. State coverage — adequate

Parcours des surfaces IA. State Patterns couvre : ouverture à froid, deck non vide / terminé, premier lancement réseau vide, composeur vide / génération en cours / texte généré / échec-hors-ligne, relance due, confirmation de relance, message après envoyé, tri froideur, import CSV, suppression. Les états réellement non rendus sont listés honnêtement en [Lacunes].

### Findings
- **medium** **Focus / hover / pressed / disabled** : aucun traitement, sur aucune surface. C'est déclaré en lacune (DESIGN [Lacunes] « États focus / hover / pressed / disabled » ; EXPERIENCE Accessibility Floor mentionne l'ordre de focus mais pas l'apparence du focus clavier). Pour un consommateur dev c'est un trou réel : le bouton intelligent passe par un état désactivé pendant « Génération en cours » (champ envoyé à l'API) sans apparence définie. *Fix :* a minima spécifier l'état désactivé du bouton primaire pendant la génération, et l'anneau de focus clavier (renvoyé en lacune mais à élicité avant dev).
- **medium** **Permission refusée (push)** n'a pas de ligne d'état propre. La garantie « in-app indépendante du push » est solide (State Patterns « relance due » + section Relances zéro-fuite), mais le *traitement de l'écran quand l'utilisateur refuse la permission de notification* (ré-invite ? silence ?) n'est ni couvert ni listé en lacune côté états (seulement effleuré en [Lacunes] notifications). *Fix :* ajouter une ligne State Pattern « permission push refusée » renvoyant au comportement zéro-fuite in-app, ou l'expliciter en lacune.
- **low** **Génération en cours** dit « traitement de chargement précis non spécifié (voir Lacunes) » — correctement déclaré, mais c'est un état très fréquent (chaque génération) laissé sans aucun indice visuel. Impact aval modéré car honnêtement signalé. *Fix :* à prioriser dans l'élicitation post-spine.

## 5. Visual reference coverage — broken

Fichiers `.working/` présents : `direction-encre-papier.html`, `direction-legerete-air.html`, `direction-minimal-chaleureux.html`, `direction-editorial-intime.html`, `directions-index.html`, `swipe-v1-clair-warm.html`, `swipe-v2-sombre-intime.html`, `swipe-v3-doux-colore.html`, `swipe-index.html`, `direction-craftee-v1.html`, `palette-menthe-vs-turquoise.html`, `plume-hero-final.html`, `plume-hero-v2.html`, `plume-composeur-v1.html`, `plume-composeur-v2.html`, `plume-reseau-v1.html`, `plume-onboarding-v1.html`, `plume-reglages-v1.html`.

### Findings
- **high** **Aucun mock n'est lié inline à la bonne section en nommant ce qu'il illustre.** EXPERIENCE.md liste les 5 mocks validés une seule fois, en bloc, à la fin de Information Architecture (« → Référence de composition : `plume-hero-v2.html`, … ») sans dire quel mock illustre quelle surface/composant ni les rattacher aux sections Component Patterns / Key Flows concernées. DESIGN.md ne référence **aucun** mock (ni dans Components, ni dans Colors/Shapes), alors que c'est lui qui porte l'apparence. Un consommateur ne peut pas sauter d'une ligne composant à son rendu. *Fix :* lier chaque mock inline à sa section en nommant ce qu'il illustre (ex. dans DESIGN.Components, `card-deck` → « cf. `plume-hero-v2.html` » ; bottom-sheet → `plume-composeur-v2.html` ; etc.).
- **medium** **« spines-win-on-conflict » est énoncé deux fois, pas une.** Une fois dans la blockquote d'en-tête d'EXPERIENCE.md (« En cas de conflit avec un mock, c'est cette spine et `.decision-log.md` qui gagnent ») et une seconde fois en bas d'Information Architecture (« La spine gagne en cas de conflit »). La règle de forme veut une affirmation unique. DESIGN.md, lui, ne l'énonce jamais. *Fix :* garder l'énoncé une seule fois (idéalement près des refs de mocks) et l'ajouter à DESIGN.md si DESIGN doit aussi référencer des mocks.
- **medium** **Orphelins non signalés** : 13 des 18 fichiers `.working/` ne sont référencés par aucune des deux spines — toutes les `direction-*`, `swipe-v*`, les index, `palette-menthe-vs-turquoise.html`, et surtout deux quasi-doublons des mocks retenus : `plume-hero-final.html` (vs `-v2` cité) et `plume-composeur-v1.html` (vs `-v2` cité). Les explorations rejetées sont normales en `.working/`, mais `plume-hero-final.html` portant « final » dans son nom alors que la spine cite `plume-hero-v2.html` est un piège pour un consommateur qui irait chercher « le » mock final. *Fix :* dans la note de référence, préciser que seuls les `*-v2` / `-v1` listés font foi et que `plume-hero-final.html` / `plume-composeur-v1.html` sont des itérations mortes (ou les déplacer/préfixer).

## 6. Bloat & over-specification — strong

DESIGN.md assume une voix éditoriale (légitime) ; EXPERIENCE.md reste sec et tabulaire. Pas de redite des personas/FR/scope au-delà du strict nécessaire de contexte (Foundation cite Camille en une ligne, correct). Les valeurs px apparaissent surtout là où un token n'existe pas encore (échelle relevée des mocks, déclarée non formalisée en [Lacunes]).

### Findings
- **low** Quelques px en prose là où un token existe : DESIGN.Colors/Shapes/Components citent « ~32px », « ~84px », « ~56px », « ~22px », « ~13px », « ~50px », « 2 à 2.5px ». Certains doublent un token déjà nommé (`card-deck` dit « coins ~32px » alors que `components.card-deck.rounded: 32px` existe ; `bottom-sheet` « ~34px » double `rounded.sheet`). Tolérable comme glose éditoriale, mais un dev pourrait hésiter entre la prose et le token. *Fix :* préférer le token nommé quand il existe ; réserver les px bruts aux dimensions sans token (tailles d'avatar, châssis).
- **low** EXPERIENCE.md « Le moat voix » / « Coût & transparence » / « Modèle de froideur » / « Relances zéro-fuite » / « Inspiration & Anti-patterns » sont des sections produit riches. Elles sont justifiées (portent des règles comportementales et le glossaire froideur), mais frôlent la redite des sources sur la partie *rationale* (ex. « Few-shot, pas de fine-tuning… La technologie disparaît »). Un consommateur dev lira surtout les règles, pas la narration. Acceptable ; à surveiller si la spine grossit.

## 7. Inheritance discipline — strong

Sources frontmatter : les 4 chemins relatifs sont cohérents avec l'arborescence (prd, prfaq, prfaq-distillate, brainstorming) ; `design_ref: ./DESIGN.md` correct. Noms d'UJ et d'entités **verbatim** du glossaire source-extract : Contact, Message, Canal, Statut, Voix, Few-shot, Seed, Tell d'IA, Score de froideur, File du jour, Relance, Zéro-fuite, « jamais contacté ». Noms de composants identiques entre les deux spines. Microcopy attestée reprise fidèlement (« Sofiane t'a répondu ? », « Relance due : Sofiane (Algolia) », « C'est tout pour aujourd'hui. »). Toutes les refs de tokens d'EXPERIENCE.md résolvent vers DESIGN.md.

### Findings
- **low** Divergence de protagoniste de microcopy entre source et spine : la confirmation de relance est « **Sofiane** t'a répondu ? » dans UJ-3/source-extract et reprise telle quelle dans Flow 3 / Relances zéro-fuite, mais devient « **Léa** t'a répondu ? » dans Voice and Tone et State Patterns. Les deux sont des exemples illustratifs cohérents (Léa = Flow 1, Sofiane = Flow 3), donc pas une vraie incohérence de contrat — juste à savoir que ce n'est pas un libellé figé. *Fix :* aucun requis ; éventuellement neutraliser en « {Prénom} t'a répondu ? » pour signaler que c'est un gabarit.
- **low** « Mode sans-IA » : correctement **absent** des spines (supprimé par #18/#19) alors qu'il reste dans le PRD/source-extract (FR-15, glossaire). La spine a raison (spines-win), et la tension est explicitement remontée en [Lacunes]/Tensions d'EXPERIENCE.md et décision #30. Discipline d'héritage *volontairement* divergente et tracée — c'est le bon comportement, noté ici pour le consommateur qui croiserait FR-15.

## 8. Form conformance — strong

DESIGN.md suit l'ordre canonique exact : Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts (+ section [Lacunes] justifiée). EXPERIENCE.md porte les défauts requis (Foundation, Information Architecture, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, Key Flows) et les sections déclenchées pertinentes (Responsive & Platform — PWA/iOS/Capacitor ; Inspiration & Anti-patterns — réfs réellement structurantes). Sections inventées (« Le moat voix », « Coût & transparence », « Modèle de froideur », « Relances zéro-fuite ») justifiées par le domaine produit.

### Findings
- **low** EXPERIENCE.md ajoute un sous-bloc « Tensions repérées entre décisions » sous [Lacunes]. Utile et honnête, mais c'est un contenu de *journal* (cf. décision #30) qui déborde un peu du rôle de contrat de la spine. *Fix :* OK de le garder s'il aide le consommateur aval ; sinon le rapatrier dans `.decision-log.md` dont il est la copie.

## Mechanical notes

- **Cross-refs de tokens** : 100 % résolvent. Aucune ref cassée `EXPERIENCE → DESIGN`. `design_ref` et les 4 `sources` frontmatter pointent vers des chemins cohérents.
- **Hex hors `colors`** : `pager.dot-idle '#C7DDD5'` (frontmatter + prose) est le seul hex porteur qui ne vit pas dans le bloc `colors`.
- **Froideur** : valeurs frontmatter = valeurs corrigées #15/#16 (`#C9C2D6 / #8FBCA8 / #CBA7C0 / #A7BCC6`), PAS les valeurs alarmistes obsolètes de la décision #12 (`#F4B266 / #E08A8A`). Cohérent.
- **Noms de composants** : identiques entre les deux spines (vérifié 1:1). Glossaire froideur identique entre EXPERIENCE.Modèle de froideur et DESIGN.Colors.
- **Liens de mocks** : EXPERIENCE.md ne lie pas les fichiers en Markdown (`[texte](chemin)`), il les cite en texte brut ; DESIGN.md n'en cite aucun. 13/18 fichiers `.working/` orphelins ; 2 doublons-pièges (`plume-hero-final.html`, `plume-composeur-v1.html`).
- **Complétude frontmatter** : DESIGN.md complet (name, description, status, updated, sources, colors, typography, rounded, spacing, components). EXPERIENCE.md complet (name, status, updated, design_ref, sources). `typography.display-name`/`display-title` définis mais la prose parle de « noms ~32px / titres ~30px » de façon cohérente avec eux.
