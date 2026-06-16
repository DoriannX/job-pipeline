> ⚠️ **OBSOLÈTE — pré-remédiation (décision #31, 2026-06-16).** Ce rapport décrit un état **antérieur** aux corrections : ses findings Critical/High (« illustration non reproductible », « aucun mock lié inline », « flou=0 pas un Don't », « couleur d'erreur à confirmer ») ont été **clos par #31** et sont **déjà corrigés** dans `DESIGN.md` / `EXPERIENCE.md` (`status: final`). Ne pas s'y fier comme contrat courant ; régénérer si une validation à jour est requise.

---

# UX Design Validation Report — Plume

- **DESIGN.md:** ../DESIGN.md
- **EXPERIENCE.md:** ./EXPERIENCE.md
- **Run at:** 2026-06-16

## Overall verdict

La paire de spines est **prête à servir de contrat aval** : couverture mécanique quasi totale, tokens complets et résolvants (100 % des cross-refs résolvent), parcours nommés du PRD tous portés par un Key Flow avec climax, et discipline d'héritage propre (noms verbatim, glossaire fidèle, refs `EXPERIENCE → DESIGN` toutes vertes). Les deux seuls trous structurels à impact aval réel : les mocks `.working/` ne sont liés inline nulle part (EXPERIENCE.md ne cite que des noms de fichiers en bloc, DESIGN.md n'en cite aucun) et deux cibles de contraste annoncées (accessibilité) sont absentes alors que les combinaisons porteuses existent. Le reste relève du polish. Aucune incohérence bloquante ; les lacunes sont honnêtement déclarées et non fabriquées.

La lentille craft **durcit ce tableau d'un cran et fait remonter le seul finding critique du lot** : l'illustration maison — la plume-mascotte et les avatars-blobs, déclarés « l'âme » du produit et antidote au look IA — n'est **pas reproductible depuis la seule spine**. DESIGN la décrit en mots, mais dans les mocks c'est un tracé SVG canonique réutilisé à l'identique sur 5 écrans ; un dev qui lit la spine redessinera une mascotte « clipart gentil » différente à chaque écran et perdra exactement le caractère fait-main visé. Ce critical recoupe et aggrave le *high* rubrique « aucun mock lié inline » : tant que les mocks restent des références non rattachées, l'asset SVG ne peut pas devenir source de vérité. La craft confirme par ailleurs que les **rejets durs sont remarquablement bien encodés** (ombre molle, dégradé, Inter, emoji, bleu LinkedIn, jaune vif, Mode sans-IA — tous tokens + prose + `Don't`) ; le risque résiduel n'est jamais dans le négatif banni mais dans le *positif difficile* non figé : épaisseur de trait et flou=0 non tokenisés, couleur d'erreur laissée « à confirmer » (porte entrouverte au rouge alarme banni).

## Category verdicts

- **Flow coverage** — strong
- **Token completeness** — strong
- **Component coverage** — strong
- **State coverage** — adequate
- **Visual reference coverage** — broken
- **Bloat & over-specification** — strong
- **Inheritance discipline** — strong
- **Form conformance** — strong

**Severity totals (fusion des 2 reviews) :** 1 Critical · 3 High · 9 Medium · 17 Low

## Findings by severity

### Critical

- **[Craft] L'illustration maison — l'« âme » — n'est PAS reproductible depuis la seule spine** (§ DESIGN.md l.248-250)
  - *Note :* DESIGN décrit la plume-mascotte et les avatars-blobs en mots. Mais dans les mocks c'est un tracé SVG canonique réutilisé à l'identique sur 5 écrans (même path de blob `M62 10 C88 10 108 26 …`, même géométrie cheveux/yeux/joues/sourire, même path de plume + rachis + barbes + étincelle). Un dev qui lit la spine va redessiner sa propre mascotte → « clipart gentil » différent à chaque écran, exactement le générique anti-âme fui par l'utilisateur. Régression la plus grave et la plus probable. Recoupe le high rubrique « aucun mock lié inline ».
  - *Fix :* la spine doit référencer les assets SVG canoniques comme source de vérité (les figer dans `assets/` ou pointer les paths des mocks), pas seulement les décrire ; poser la règle « la plume et le blob sont UN tracé partagé, pas redessiné par écran ». Exiger : trait encre `{colors.ink}` ~2.4-3px, blob organique non-circulaire, visage = 2 yeux arc + joues teintées + sourire courbe, plume = corps plein + rachis + barbes + étincelle mauve.

### High

- **[Visual reference coverage] Aucun mock n'est lié inline à sa section en nommant ce qu'il illustre** (§ EXPERIENCE.md · Information Architecture / DESIGN.md tout)
  - *Note :* EXPERIENCE.md liste les 5 mocks validés une seule fois en bloc, sans dire quel mock illustre quelle surface/composant. DESIGN.md ne référence aucun mock alors qu'il porte l'apparence. Un consommateur ne peut pas sauter d'une ligne composant à son rendu.
  - *Fix :* lier chaque mock inline à sa section en nommant ce qu'il illustre (ex. DESIGN.Components, `card-deck` → « cf. `plume-hero-v2.html` » ; bottom-sheet → `plume-composeur-v2.html`).

- **[Craft] « Hard offset net » : l'invariant flou=0 n'est pas un Don't isolé** (§ DESIGN.md l.227)
  - *Note :* D'excellents repères d'offset par composant existent (châssis `13px 14px 0 0`, bouton `0 6px 0 0`, sheet `0 -7px 0 0`). Mais l'invariant le plus important — flou = 0 — vit dans la prose (`Npx Npx 0 0`) sans être un `Don't` au même niveau que « zéro ombre molle ». Un dev pressé peut lire « offset » et mettre `4px 4px 8px` (avec flou).
  - *Fix :* élever « le 3e paramètre du box-shadow est TOUJOURS 0 (rayon de flou nul) » au rang de règle dure isolée, pas noyée dans le paragraphe.

- **[Craft] Épaisseur et couleur de contour non tokenisées** (§ DESIGN.md l.226 / components.*)
  - *Note :* Le « contour plein ~2 à 2.5px encre » est central à l'identité (tous les mocks : `2.5px solid var(--trait)`, `3px` sur les blobs SVG). C'est en prose mais pas un token (`border.width`, `border.color`) ni dans `components.*`. Risque : un dev met `1px` (retour au plat fin générique) ou une couleur de contour grise au lieu d'encre.
  - *Fix :* ajouter des tokens d'épaisseur de trait (UI ~2.5px, illustration ~3px) et rappeler que le contour est en encre, jamais gris.

### Medium

- **[Flow coverage] UJ-2 n'a pas son propre Key Flow numéroté** (§ EXPERIENCE.md · Key Flows)
  - *Note :* Le comportement clé (« Améliorer retravaille en place, garde idées et ton », adaptation canal-email) est couvert en Component/State Patterns, mais le seul parcours partant d'un texte tapé à la main n'est jamais déroulé bout en bout. Flow 1 ne le mentionne qu'en passant (étape 7).
  - *Fix :* ajouter un Flow 4 court dérivé de UJ-2, ou marquer explicitement que UJ-2 est absorbé dans Flow 1 pour qu'un consommateur ne le cherche pas.

- **[Token completeness] Aucune cible de contraste chiffrée pour les combinaisons porteuses** (§ DESIGN.md · Colors / EXPERIENCE.md · Accessibility Floor)
  - *Note :* L'Accessibility Floor renvoie le contraste à DESIGN.md, qui annonce des cibles sans les chiffrer. Combinaisons à risque non vérifiées : `ink-soft #5F726D` et surtout `ink-hint #9DB5AD` sur `surface.app #E9F3EF` / `surface.card #FBFEFD` (probablement < 4.5:1) ; `accent-deep #876585` sur `accent-tint #ECE2EA` ; `mint-deep #4E8978` sur `surface.chip #DCEFE9`.
  - *Fix :* ajouter en Colors (ou Components) un ratio cible AA pour ces paires texte-sur-fond, ou les déclarer explicitement « décoratif / non porteur de texte critique ».

- **[State coverage] Focus / hover / pressed / disabled non traités sur aucune surface** (§ DESIGN.md · [Lacunes] / EXPERIENCE.md · Accessibility Floor)
  - *Note :* Déclaré en lacune, mais trou réel pour un dev : le bouton intelligent passe par un état désactivé pendant « Génération en cours » (champ envoyé à l'API) sans apparence définie ; l'anneau de focus clavier n'a pas d'apparence.
  - *Fix :* a minima spécifier l'état désactivé du bouton primaire pendant la génération et l'anneau de focus clavier (à éliciter avant dev).

- **[State coverage] Permission push refusée sans ligne d'état propre** (§ EXPERIENCE.md · State Patterns)
  - *Note :* La garantie in-app indépendante du push est solide, mais le traitement de l'écran quand l'utilisateur refuse la permission (ré-invite ? silence ?) n'est ni couvert ni listé en lacune côté états (seulement effleuré en [Lacunes] notifications).
  - *Fix :* ajouter une ligne State Pattern « permission push refusée » renvoyant au comportement zéro-fuite in-app, ou l'expliciter en lacune.

- **[Visual reference coverage] « spines-win-on-conflict » énoncé deux fois, jamais dans DESIGN.md** (§ EXPERIENCE.md · en-tête + Information Architecture)
  - *Note :* La règle apparaît dans la blockquote d'en-tête et de nouveau en bas d'Information Architecture. La règle de forme veut une affirmation unique ; DESIGN.md, lui, ne l'énonce jamais.
  - *Fix :* garder l'énoncé une seule fois (idéalement près des refs de mocks) et l'ajouter à DESIGN.md si DESIGN doit aussi référencer des mocks.

- **[Visual reference coverage] Orphelins non signalés et deux doublons-pièges** (§ .working/)
  - *Note :* 13 des 18 fichiers ne sont référencés par aucune spine. Surtout deux quasi-doublons des mocks retenus : `plume-hero-final.html` (vs `-v2` cité) et `plume-composeur-v1.html` (vs `-v2` cité). Le « final » dans le nom est un piège pour qui chercherait « le » mock final.
  - *Fix :* préciser dans la note de référence que seuls les `*-v2` / `-v1` listés font foi et que `plume-hero-final.html` / `plume-composeur-v1.html` sont des itérations mortes (ou les déplacer/préfixer).

- **[Craft] Asymétrie / imperfection main encodée de façon molle** (§ DESIGN.md · Do's/Don'ts l.292-303)
  - *Note :* Le rejet de « l'absence de matière » / la « symétrie par défaut » (journal #7) est encodé mollement : le `Don't` dit « symétrie molle » / « cartes génériques » mais aucune règle positive n'impose l'asymétrie que les mocks portent (cartes `rotate(3.2deg)` / `rotate(-2deg)`, plume `rotate(-16)`, blob jamais centré).
  - *Fix :* ajouter une règle « légère rotation/désalignement volontaire des éléments illustrés et des cartes empilées ; jamais le centrage parfait par défaut » dans Shapes ou Elevation, avec les valeurs d'inclinaison des mocks comme repère.

- **[Craft] Aucune couleur d'erreur — la porte au rouge alarme banni reste entrouverte** (§ DESIGN.md · [Lacunes] l.310 / EXPERIENCE.md l.238)
  - *Note :* « Pas de couleur erreur, à confirmer » est cohérent avec le ton non alarmiste, mais tant que c'est « à confirmer » un dev face à un état d'erreur attrapera spontanément un rouge système = réintroduction frontale du rouge alarme banni.
  - *Fix :* transformer la lacune en règle provisoire ferme : « en attendant décision, tout signal d'erreur reste dans la palette existante (mauve mesuré / ink-soft), jamais un rouge ad hoc ». Idem dark mode (l.309) — flaguer « ne pas improviser ».

- **[Craft] Densité spatiale / respiration non opposable** (§ DESIGN.md l.216-218)
  - *Note :* Le bloat encodé est surtout textuel/composant. « 2 à 3 zones max par écran » est dit mais le « grand vide poétique / respiration » reste adjectival. Un dev peut respecter « pas de bloat texte » tout en tassant les composants (gouttières serrées) → perte du calme cozy.
  - *Fix :* poser un plancher de respiration : rendre opposables les marges/gouttières déjà tokenisées à 22-24px (« ne pas descendre sous `{spacing.gutter}` entre blocs majeurs »).

- **[Craft] Dispositif blob (fill froideur + ombre interne -shade + joues) lié aux tokens seulement verbalement** (§ DESIGN.md · avatar-blob l.250)
  - *Note :* « Froideur via couleur des gens » est bien spécifié (4 tokens + `-shade`). Mais un dev pourrait colorer le blob et oublier l'ombre interne `-shade` qui lui donne le volume fait-main (vs aplat plat enfantin).
  - *Fix :* dans `avatar-blob`, expliciter « le `fill` porte la froideur ; l'ombre interne utilise le token `-shade` correspondant ; joues teintées d'un ton proche » — déjà à moitié dit, à durcir.

- **[Craft] Signatures visuelles concrètes mocks↔spine (gap résiduel = asset illustration)** (§ DESIGN.md l.242-252 / EXPERIENCE.md l.78)
  - *Note :* La spine capture fidèlement la structure des 5 surfaces et le système couleur/typo/offset (châssis téléphone, fond app jamais blanc, timeline narrative à puce mauve, note en pointillés — tous captés). Le seul vrai gap mocks↔spine est l'asset illustration (cf. Critical).
  - *Fix :* couvert par le fix du Critical ; le reste est cohérent.

### Low

- **[Token completeness] Hex brut `pager.dot-idle: '#C7DDD5'` hors du bloc colors** (§ DESIGN.md · frontmatter + Components)
  - *Note :* Un hex porteur répété en prose plutôt qu'une couleur nommée du bloc `colors`.
  - *Fix :* promouvoir en `colors.pager-dot-idle` (ou réutiliser `line` / `mint-offset`).

- **[Token completeness] Tokens `colors.cold.*-shade` référencés seulement par suffixe générique** (§ DESIGN.md · Colors)
  - *Note :* Les 4 tokens `-shade` sont définis et utilisés (ombre interne du blob) mais cités en prose seulement par « (`-shade`) », jamais par chemin individuel. Résout quand même ; traçabilité par token plus faible.
  - *Fix :* aucun requis ; à noter pour le consommateur.

- **[Component coverage] Bloc Consommation sans ligne dédiée en Component Patterns** (§ EXPERIENCE.md · Component Patterns)
  - *Note :* Documenté côté visuel (DESIGN.Components) mais son comportement vit dispersé dans la section produit « Coût & transparence ».
  - *Fix :* une ligne en Component Patterns renvoyant à Coût & transparence, ou l'assumer comme contenu de surface.

- **[Component coverage] Bouton + et champ Recherche sans ancre visuelle dédiée** (§ DESIGN.md · Components)
  - *Note :* EXPERIENCE.md liste « Bouton + (icon-button accent) » et « Recherche » comme composants comportementaux ; DESIGN.md ne leur donne aucune ligne visuelle dédiée.
  - *Fix :* une ligne Components pour l'icon-button + / la barre de recherche, ou les marquer hérités d'un pattern field/button existant.

- **[State coverage] « Génération en cours » sans indice visuel de chargement** (§ EXPERIENCE.md · State Patterns)
  - *Note :* Correctement déclaré (« traitement de chargement précis non spécifié, voir Lacunes »), mais c'est un état très fréquent laissé sans indice. Impact aval modéré car honnêtement signalé.
  - *Fix :* à prioriser dans l'élicitation post-spine.

- **[Bloat & over-specification] Quelques px en prose là où un token existe déjà** (§ DESIGN.md · Colors / Shapes / Components)
  - *Note :* « ~32px », « ~84px » etc. ; certains doublent un token nommé (`card-deck` « coins ~32px » alors que `components.card-deck.rounded: 32px` existe ; bottom-sheet « ~34px » double `rounded.sheet`).
  - *Fix :* préférer le token nommé quand il existe ; réserver les px bruts aux dimensions sans token.

- **[Bloat & over-specification] Sections produit riches frôlant la redite des sources** (§ EXPERIENCE.md · Le moat voix / Coût & transparence / Modèle de froideur / Relances zéro-fuite)
  - *Note :* Justifiées (portent règles comportementales et glossaire froideur) mais frôlent la redite des sources sur la partie rationale. Acceptable ; à surveiller si la spine grossit.
  - *Fix :* aucun requis ; à surveiller.

- **[Inheritance discipline] Protagoniste de microcopy variable (Sofiane vs Léa)** (§ EXPERIENCE.md · Voice and Tone / State Patterns vs Flow 3)
  - *Note :* « Sofiane t'a répondu ? » dans UJ-3/source et Flow 3, mais « Léa t'a répondu ? » dans Voice and Tone et State Patterns. Les deux sont des exemples cohérents, pas une vraie incohérence de contrat.
  - *Fix :* aucun requis ; éventuellement neutraliser en « {Prénom} t'a répondu ? ».

- **[Inheritance discipline] « Mode sans-IA » volontairement absent (divergence tracée)** (§ EXPERIENCE.md · [Lacunes] / Tensions · décision #30)
  - *Note :* Correctement supprimé des spines (par #18/#19) alors qu'il reste dans le PRD/source (FR-15). La spine a raison (spines-win) et la tension est remontée explicitement. Bon comportement, noté pour qui croiserait FR-15.
  - *Fix :* aucun requis ; comportement correct.

- **[Form conformance] Sous-bloc « Tensions repérées entre décisions » déborde du rôle de contrat** (§ EXPERIENCE.md · [Lacunes])
  - *Note :* Utile et honnête, mais contenu de journal (cf. décision #30) qui déborde un peu du rôle de contrat de la spine.
  - *Fix :* OK de le garder s'il aide le consommateur aval ; sinon le rapatrier dans `.decision-log.md`.

- **[Craft] Tous les rejets durs principaux sont encodés en Don't opposable** (§ DESIGN.md · Do's/Don'ts l.292-303)
  - *Note :* Ombre molle/flou/dégradé/glassmorphism, Inter/système, emoji/lib d'icônes, bleu LinkedIn, liste dense/CRM, jaune vif/corail/rouge alarme, Mode sans-IA : tous en `Don't` ET en règle prose. Bien protégé.
  - *Fix :* aucun ; défense robuste à préserver.

- **[Craft] text-shadow de matière sur bouton primaire non mentionné** (§ mocks · button-primary)
  - *Note :* `text-shadow:0 1px 0 rgba(0,0,0,.12)` dans les 3 mocks de bouton mauve : détail mineur mais un des micro-tells « objet physique » vs « bouton plat ».
  - *Fix :* note optionnelle dans button-primary.

- **[Craft] Mauve déco toléré sur la mascotte non explicité comme exception unique** (§ DESIGN.md l.248 / mocks l.322,367)
  - *Note :* Discipline mauve excellente (liste blanche exhaustive + double interdiction). Seul angle mort : l'étincelle/joue mauve sur la mascotte (`ellipse fill="#B391AC"`) brouille un peu « action seulement » ; autorisée implicitement mais pas désignée comme exception réservée.
  - *Fix :* préciser que l'exception décorative au mauve est réservée à la mascotte/aux étincelles.

- **[Craft] Patron technique « .float + transform sur <g> séparés » bien préservé** (§ DESIGN.md l.248 / journal #26)
  - *Note :* Le piège d'implémentation réel (sinon la plume saute) est remonté dans DESIGN ET dans le journal. Bonne préservation.
  - *Fix :* aucun ; à garder.

- **[Craft] Tensions de réconciliation tracées en clair** (§ EXPERIENCE.md l.250-254 / journal #30)
  - *Note :* Gmail onboarding hors-MVP, Mode sans-IA résiduel dans le PRD, froideur #12 obsolète : tracées en clair, pas un risque de régression DA, bien signalées.
  - *Fix :* aucun ; bonne hygiène.

## Mechanical notes

- **Cross-refs de tokens :** 100 % résolvent. Aucune ref cassée `EXPERIENCE → DESIGN`. `design_ref` et les 4 `sources` frontmatter pointent vers des chemins cohérents.
- **Hex hors `colors` :** `pager.dot-idle '#C7DDD5'` (frontmatter + prose) est le seul hex porteur qui ne vit pas dans le bloc `colors`.
- **Froideur :** valeurs frontmatter = valeurs corrigées #15/#16 (`#C9C2D6 / #8FBCA8 / #CBA7C0 / #A7BCC6`), PAS les valeurs alarmistes obsolètes de la décision #12 (`#F4B266 / #E08A8A`). Cohérent.
- **Noms de composants :** identiques entre les deux spines (vérifié 1:1). Glossaire froideur identique entre EXPERIENCE.Modèle de froideur et DESIGN.Colors.
- **Liens de mocks :** EXPERIENCE.md cite les fichiers en texte brut, pas en Markdown ; DESIGN.md n'en cite aucun. 13/18 fichiers `.working/` orphelins ; 2 doublons-pièges (`plume-hero-final.html`, `plume-composeur-v1.html`).
- **Complétude frontmatter :** DESIGN.md complet (name, description, status, updated, sources, colors, typography, rounded, spacing, components). EXPERIENCE.md complet (name, status, updated, design_ref, sources).
- **Garde-fous quantitatifs non tokenisés (craft) :** épaisseur de trait (~2.5px UI / ~3px illustration), invariant flou=0, et l'asset SVG canonique de l'illustration restent en prose, pas en token/asset opposable.

## Reviewer files

- Rubric walker: `review-rubric.md`
- Craft fidelity / Anti-AI-look: `review-craft.md`
