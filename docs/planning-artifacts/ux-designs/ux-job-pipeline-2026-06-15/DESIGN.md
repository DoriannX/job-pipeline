---
name: Plume
description: Carnet vivant illustré pour entretenir son réseau, écrit dans sa propre voix. Warm, sobre, intime, anti-template et anti look-IA. L'illustration maison en est l'âme.
status: final
updated: 2026-06-16
sources:
  - ../../prds/prd-job-pipeline-2026-06-15/prd.md
  - ../../prfaq-job-pipeline.md
  - ../../prfaq-job-pipeline-distillate.md
  - ../../../brainstorming/brainstorming-session-2026-06-15.md
colors:
  surface.app: '#E9F3EF'
  surface.card: '#FBFEFD'
  surface.note: '#EDF6F2'
  surface.chip: '#DCEFE9'
  ink: '#2E3F3B'
  ink-soft: '#5F726D'
  ink-hint: '#9DB5AD'
  line: '#CFE3DB'
  mint: '#7FBEAF'
  mint-deep: '#4E8978'
  mint-offset: '#CADFD8'
  mint-offset-soft: '#BFD9D0'
  accent: '#B391AC'
  accent-deep: '#876585'
  accent-on: '#FFFFFF'
  accent-tint: '#ECE2EA'
  cold.never: '#C9C2D6'
  cold.fresh: '#8FBCA8'
  cold.warm: '#CBA7C0'
  cold.cold: '#A7BCC6'
  cold.never-shade: '#B3AAC6'
  cold.fresh-shade: '#73A28C'
  cold.warm-shade: '#B289A6'
  cold.cold-shade: '#8AA2AE'
typography:
  display:
    fontFamily: Fraunces
    fontWeight: '600'
    letterSpacing: -0.01em
    note: 'Titres, noms de personnes, chiffres clés. Italique disponible pour citations et libellés de contexte.'
  body:
    fontFamily: Quicksand
    fontWeight: '500'
    lineHeight: '1.5'
    note: 'Corps de texte, boutons (700), labels.'
  display-name:
    fontFamily: Fraunces
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.04'
  display-title:
    fontFamily: Fraunces
    fontSize: 30px
    fontWeight: '600'
    lineHeight: '1.05'
  body-base:
    fontFamily: Quicksand
    fontSize: 16px
    fontWeight: '500'
    lineHeight: '1.5'
  button:
    fontFamily: Quicksand
    fontSize: 20px
    fontWeight: '700'
  label-caps:
    fontFamily: Quicksand
    fontSize: 12px
    fontWeight: '700'
    letterSpacing: 0.12em
    note: 'Capitales pour kickers, libellés de section, états (UPPERCASE).'
rounded:
  sm: 6px
  md: 14px
  card: 16px
  sheet: 34px
  button: 22px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 22px
  '6': 24px
  gutter: 22px
  margin-mobile: 24px
borders:
  width: 2.5px
  width-illustration: 3px
  color: '{colors.ink}'
  offset-distance: 4px
components:
  feather-mark:
    fill: '{colors.mint}'
    stroke: '{colors.ink}'
    accent-detail: '{colors.accent}'
  avatar-blob:
    stroke: '{colors.ink}'
    fill-never: '{colors.cold.never}'
    fill-fresh: '{colors.cold.fresh}'
    fill-warm: '{colors.cold.warm}'
    fill-cold: '{colors.cold.cold}'
  card-deck:
    background: '{colors.surface.card}'
    border: '{colors.ink}'
    rounded: 32px
    selected-ring: '{colors.accent}'
  button-primary:
    background: '{colors.accent}'
    color: '{colors.accent-on}'
    border: '{colors.ink}'
    offset: '{colors.accent-deep}'
    rounded: '{rounded.button}'
    font: '{typography.button}'
  button-secondary:
    background: transparent
    color: '{colors.mint-deep}'
    border: '{colors.mint}'
    offset: '{colors.mint-offset-soft}'
    rounded: '{rounded.button}'
  chip-relance:
    background: '{colors.accent-tint}'
    color: '{colors.accent-deep}'
    border: '{colors.accent}'
    rounded: '{rounded.full}'
  coldtag:
    color: '{colors.ink-soft}'
    swatch: '{colors.cold.warm}'
    border: '{colors.line}'
  bottom-sheet:
    background: '{colors.surface.card}'
    border: '{colors.ink}'
    rounded-top: '{rounded.sheet}'
    offset-top: '{colors.accent}'
  field:
    background: '{colors.surface.note}'
    border: '{colors.ink}'
    rounded: '{rounded.button}'
    placeholder: '{colors.ink-hint}'
    caret: '{colors.accent}'
  channel-selector:
    active-background: '{colors.accent}'
    active-color: '{colors.accent-on}'
    idle-border: '{colors.line}'
    idle-color: '{colors.ink-soft}'
  segmented:
    track-background: '{colors.surface.chip}'
    track-border: '{colors.line}'
    active-background: '{colors.accent}'
    active-color: '{colors.accent-on}'
    idle-color: '{colors.ink-soft}'
  token-pill:
    background: '{colors.surface.chip}'
    color: '{colors.mint-deep}'
    border: '{colors.line}'
    qualifier: '{colors.accent-deep}'
  tabbar:
    background: '{colors.surface.card}'
    border-top: '{colors.ink}'
    active-color: '{colors.accent-deep}'
    active-underline: '{colors.accent}'
    active-pill: '{colors.accent-tint}'
    idle-color: '{colors.ink-hint}'
  toggle:
    track-off: '{colors.surface.chip}'
    track-on: '{colors.accent}'
    knob: '{colors.surface.card}'
    border: '{colors.ink}'
  stepper:
    border: '{colors.ink}'
    value-background: '{colors.accent-tint}'
    sign-color: '{colors.accent-deep}'
  pager:
    dot-idle: '#C7DDD5'
    dot-active: '{colors.accent}'
  group-card:
    background: '{colors.surface.card}'
    border: '{colors.ink}'
    offset-mint: '{colors.mint}'
    offset-accent: '{colors.accent}'
    rounded: 22px
---

<!-- Spine distillée au Finalize depuis .decision-log.md, .working/, imports/, sources. Ne pas éditer à la main pendant la Discovery. -->

## Brand & Style

Plume est un **carnet vivant illustré**. Le registre cible est warm, sobre et intime : un carnet à soi, jamais un produit léché-vendable, jamais un tableur de CRM. La promesse comportementale est zéro courbe d'apprentissage. L'utilisatrice comprend instantanément où elle est, quoi faire et comment, et ne se sent jamais perdue.

L'identité se construit en réaction frontale au « look IA ». Les marqueurs d'une app générée (cartes arrondies génériques noyées d'ombres molles, dégradés pastel, police système, emojis en guise d'icônes, symétrie par défaut, absence de matière) sont bannis. L'antidote est l'**illustration maison** : une plume-mascotte récurrente et des avatars en blobs organiques, tracés à la main en SVG. Cette illustration est l'âme du produit ; tout le reste sert à la mettre en valeur. Le tracé canonique vit dans [`mockups/plume-illustration-assets.svg`](plume-illustration-assets.svg) : c'est **l'asset SVG de référence à réutiliser tel quel**, jamais une version générique redessinée à la main écran par écran.

La couleur de base est la **menthe d'eau**, une famille vert-bleu douce et désaturée, calme et chaude à la fois. Une seule pointe d'énergie traverse l'app : le **mauve poussiéreux**, fil rouge délibéré de l'action. La profondeur ne vient jamais d'une ombre floue mais d'un contour plein et d'un décalage net teinté, dans une logique de gros boutons « chunky » à caractère fait-main. Anti-références assumées : le bleu corporate de LinkedIn, la froideur d'un tableur, le jaune vif criard.

## Colors

La palette est **Menthe d'eau × Mauve poussiéreux**. La menthe domine, le mauve ponctue, la froideur appartient aux gens.

- **Fond app `{colors.surface.app}` (`#E9F3EF`)** est le canevas de toutes les surfaces. Une menthe très claire, jamais blanche, qui pose l'ambiance carnet.
- **Surface carte `{colors.surface.card}` (`#FBFEFD`)** est le presque-blanc des cartes, bottom-sheets, tab bar et groupes de réglages. Distinct du fond par la teinte, jamais par une ombre.
- **Surface note `{colors.surface.note}` (`#EDF6F2`)** est le fond des champs de saisie et des encarts internes, à peine plus profond que la carte.
- **Encre `{colors.ink}` (`#2E3F3B`)** est le texte principal, les contours pleins, et **le trait de toute l'illustration**. C'est une encre douce, jamais du noir pur.
- **Texte doux `{colors.ink-soft}` (`#5F726D`)** porte le texte secondaire, les sous-titres, les méta. **Indice `{colors.ink-hint}` (`#9DB5AD`)** est réservé aux placeholders, hints de gestes et états inactifs.
- **Menthe base `{colors.mint}` (`#7FBEAF`)** est la couleur de marque : contours de cartes, offsets menthe, edges, plume-logo. **Menthe profonde `{colors.mint-deep}` (`#4E8978`)** est le texte et les détails posés sur la menthe (libellés, boutons secondaires, picto). `{colors.mint-offset}` (`#CADFD8`) est l'offset dur du châssis téléphone ; `{colors.mint-offset-soft}` (`#BFD9D0`) celui des boutons secondaires.
- **Accent mauve `{colors.accent}` (`#B391AC`)** est le **fil rouge de l'action et des états actifs**, et rien d'autre : bouton primaire, onglet actif, chip de relance, point de pager actif, canal/segment actif, toggle activé, caret du champ, étincelles. Désaturé et réchauffé pour s'accorder à la menthe au lieu de jurer. **Mauve profond `{colors.accent-deep}` (`#876585`)** est l'offset dur du mauve et le texte mauve sur tint. **Mauve tint `{colors.accent-tint}` (`#ECE2EA`)** est le fond doux des chips, pastilles d'onglet et valeurs de stepper. Le mauve ne doit jamais s'étaler hors de ses points d'accent.
- **Froideur (4 états, jamais alarmiste)** : c'est une échelle sémantique portée par **la couleur des avatars**, pas par du texte ni des icônes. **Jamais contacté `{colors.cold.never}` (`#C9C2D6`)** gris-lavande · **Frais `{colors.cold.fresh}` (`#8FBCA8`)** menthe-vert doux · **Tiède `{colors.cold.warm}` (`#CBA7C0`)** mauve-rosé doux · **Froid `{colors.cold.cold}` (`#A7BCC6`)** bleu-gris poussiéreux. Chaque teinte a une ombre interne plus profonde du même ton (`-shade`) pour modeler le blob. Tous restent doux et désaturés ; aucune froideur n'est « chaude » (pas de jaune, pas de corail, pas de rouge alarme).

**Cibles de contraste (WCAG).** Les combinaisons porteuses de texte visent **AA** : ratio ≥ **4.5:1** pour le texte normal (≥ 3:1 pour le texte large ≥ 24px ou 18.66px gras). Paires à garantir : texte `{colors.ink}` (`#2E3F3B`) et `{colors.ink-soft}` (`#5F726D`) sur `{colors.surface.app}` (`#E9F3EF`) et `{colors.surface.card}` (`#FBFEFD`) ; `{colors.accent-on}` (`#FFFFFF`) sur `{colors.accent}` (`#B391AC`). Les teintes claires non porteuses de texte critique (`{colors.ink-hint}` pour placeholders/hints/onglets inactifs, swatchs de froideur) sont **décoratives ou redoublées** par un libellé : si elles tombent sous 4.5:1, elles ne doivent jamais être le seul vecteur d'une information de texte. À vérifier au build (mesure réelle non faite ici).

→ Rendu de la palette en contexte : [`mockups/plume-hero-v2.html`](plume-hero-v2.html) (Aujourd'hui + état vide), [`mockups/plume-reseau-v1.html`](plume-reseau-v1.html) (l'échelle de froideur portée par les avatars).

## Typography

Deux familles, jamais Inter ni police système.

- **Fraunces** (`{typography.display}`) est la voix display : titres, noms de personnes, chiffres clés, kickers de carte. Son caractère légèrement littéraire porte l'intimité « carnet ». Le **600** est le poids courant ; l'**italique** sert aux citations (« Un petit mot pour reprendre le fil ? »), aux libellés de contexte et aux étiquettes d'écran.
- **Quicksand** (`{typography.body}`) est la voix fonctionnelle : corps de texte (500), boutons (700), libellés de section et labels en capitales (700, tracking `0.12em`).

Échelle observée : noms de carte ~32px et titres d'écran ~30px en Fraunces ; corps ~16px et boutons ~18 à 20px en Quicksand. Les libellés de section et kickers sont en capitales tracées (`{typography.label-caps}`). Les titres tirent un léger `letter-spacing` négatif (`-0.01em`) pour resserrer le bloc. Pas d'emoji dans le texte.

## Layout & Spacing

Strictement **mobile-first, utilisable au pouce**, PWA installable. Échelle de base par pas de 4 (`4 / 8 / 12 / 16 / 22 / 24`), gouttière et marge latérale d'écran à ~22 à 24px (`{spacing.gutter}`, `{spacing.margin-mobile}`).

L'architecture est volontairement pauvre en zones : 2 à 3 zones maximum par écran, une action à la fois, peu de menus. Le squelette d'app est constant : une zone de contenu plein écran surmontant une **barre d'onglets à 3 entrées** (Aujourd'hui · Réseau · Réglages) ancrée en bas. Le composeur s'ouvre **en flow** par-dessus le contexte (bottom-sheet montant), jamais comme un onglet.

Les écrans respirent : grand vide poétique sur l'état vide, colonne unique, jamais de listes denses ni de grilles de données. Le Réseau est une **galerie d'avatars en grille de 3 colonnes** (gap ~12 à 18px), pas un tableau. Les boutons d'action principaux occupent toute la largeur ou la part dominante d'une rangée d'actions.

## Elevation & Depth

Règle dure et centrale de l'identité : **zéro ombre molle, zéro flou, zéro dégradé, zéro glassmorphism.**

**RÈGLE DURE — flou = 0.** Le 3e paramètre (rayon de flou) d'un `box-shadow` est **TOUJOURS 0**, sans exception. La profondeur = contour plein + hard offset net teinté ; **jamais de blur, jamais de spread diffus**. Forme canonique : `Npx Npx 0 0 couleur`. Tout `box-shadow` dont le blur n'est pas `0` est une violation (cf. Don't).

La profondeur se construit par deux moyens seulement :

1. **Contour plein** : épaisseur `{borders.width}` (~2.5px) en encre `{borders.color}` = `{colors.ink}` (ou en menthe `{colors.mint}` pour les surfaces secondaires, en mauve `{colors.accent}` pour les éléments actifs). Le trait illustration est plus épais (`{borders.width-illustration}` ~3px). Le contour est **toujours en encre** (ou menthe/mauve), **jamais gris générique** : un trait de ~2.5px encre est porteur de caractère, là où un 1px gris ramène au plat fin sans âme.
2. **Hard offset net teinté** : un `box-shadow` à décalage franc et **rayon de flou nul** (`Npx Npx 0 0 couleur`, distance de référence `{borders.offset-distance}` ~4px). Le châssis téléphone porte un offset menthe `13px 14px 0 0 {colors.mint-offset}` ; les boutons un offset vertical `0 6px 0 0` (mauve profond pour le primaire, menthe douce pour le secondaire) ; les groupes et encarts un offset diagonal `5px 5px` à `8px 8px` ; le bottom-sheet un offset vers le haut `0 -7px 0 0 {colors.accent}`.

La hiérarchie vient donc du contour, de l'offset et de la typographie, jamais d'une élévation diffuse. Les boutons sont « chunky » : épais, contournés, posés sur leur offset comme des objets physiques.

→ Profondeur en contexte : [`mockups/plume-reglages-v1.html`](plume-reglages-v1.html) (cartes groupées sur offset), [`mockups/plume-composeur-v2.html`](plume-composeur-v2.html) (bottom-sheet sur offset mauve vers le haut).

## Shapes

Coins arrondis généreux, formes organiques, aucune arête vive.

- **Cartes et groupes** : ~16 à 22px (`{rounded.card}`, deck de carte jusqu'à 32px).
- **Boutons** chunky : jusqu'à ~22px (`{rounded.button}`).
- **Chips, pills, toggles, points de pager** : pleinement arrondis (`{rounded.full}`).
- **Bottom-sheet** : grand rayon en haut uniquement (~34px, `{rounded.sheet}`), bord bas droit.
- **Petits conteneurs** (icon-buttons, canaux, mini-segments) : ~11 à 16px (`{rounded.md}`).
- **Blobs d'avatars et plume-mascotte** : formes libres, tracées main, jamais des cercles parfaits ni des rectangles. Le tracé exact est **figé** dans [`mockups/plume-illustration-assets.svg`](plume-illustration-assets.svg), source de vérité à réutiliser telle quelle (voir Components).

Les SVG d'illustration suivent leur propre géométrie organique ; les conteneurs UI suivent l'échelle de rayons. Le châssis téléphone (~50px) signe le côté « objet doux ».

**Asymétrie main (Do).** Une légère rotation / asymétrie **volontaire** porte le caractère fait-main : les cartes empilées du deck sont inclinées (`rotate(3.2deg)` / `rotate(-2deg)`), la plume-mascotte tourne (`rotate(-14)` à `-16`), le blob n'est jamais centré en symétrie parfaite. Préférer ce léger décalage assumé au re-centrage symétrique parfait, qui ramène au template générique.

→ Formes en contexte : [`mockups/plume-hero-v2.html`](plume-hero-v2.html) (deck incliné, plume, blob), [`mockups/plume-composeur-v2.html`](plume-composeur-v2.html) (bottom-sheet à grand rayon haut).

## Components

DESIGN documente l'apparence (« à quoi ça ressemble »). Le comportement (gestes, transitions, états logiques) appartient à EXPERIENCE.md. Les mocks de `mockups/` sont liés ci-dessous comme référence de rendu ; **en cas de conflit entre un mock et cette spine (ou `.decision-log.md`), les spines gagnent.**

> **Asset CANONIQUE.** La plume-mascotte et l'avatar-blob ci-dessous ne sont **pas à redessiner** : leur tracé exact est figé dans [`mockups/plume-illustration-assets.svg`](plume-illustration-assets.svg), **source de vérité à réutiliser telle quelle** sur tous les écrans. La plume et le blob sont **UN tracé partagé**, pas une version générique recréée par écran (sinon perte du caractère fait-main = retour au look IA). Le blob se **recolore** seulement (corps + ombre interne + joues), il ne se redessine pas.

- **Plume-mascotte / logo (`{components.feather-mark}`)** — une plume dessinée à la main, corps menthe `{colors.mint}`, trait encre `{colors.ink}` (épaisseur `{borders.width-illustration}`), avec un petit détail étincelle mauve `{colors.accent}`. Récurrente : logo d'en-tête, topbars, état vide, onboarding, pied de Réglages. Tracé canonique = [`mockups/plume-illustration-assets.svg`](plume-illustration-assets.svg). La micro-touche mauve décorative (joue, étincelle) est **tolérée uniquement sur l'illustration maison**, jamais ailleurs. Note technique : pour l'animer, la **position** (`transform="translate()"`) va sur un `<g>` parent et l'**animation CSS** (`.float`) sur un `<g>` enfant ; sinon la plume saute à l'origine. Cf. [`mockups/plume-hero-v2.html`](plume-hero-v2.html) (état vide, plume qui plane).

- **Avatar-blob illustré (`{components.avatar-blob}`)** — visage en blob organique, trait encre (`{borders.width-illustration}`), **rempli selon la froideur** : le `fill` du corps porte la froideur (`fill-never` / `fill-fresh` / `fill-warm` / `fill-cold`), l'**ombre interne** utilise le token `-shade` correspondant (ce qui donne le volume fait-main, vs un aplat plat enfantin), les **joues** sont teintées d'un ton proche. C'est le porteur visuel principal de l'information de froideur. Tracé canonique = [`mockups/plume-illustration-assets.svg`](plume-illustration-assets.svg) (recolorer, ne pas redessiner). Décliné en grande taille (fiche, carte de deck, onboarding), moyenne (galerie ~84px) et petite (contexte composeur ~56px). Cf. [`mockups/plume-reseau-v1.html`](plume-reseau-v1.html) (galerie + fiche).

- **Carte de deck swipe (`{components.card-deck}`)** — carte plein écran, fond `{colors.surface.card}`, contour encre épais, coins ~32px ; pile de 2 cartes décalées et inclinées derrière elle pour signifier le paquet. La carte sélectionnée porte un fin liseré intérieur mauve `{colors.accent}` à faible opacité. Anatomie verticale : rangée de chips en haut (chip relance + coldtag), avatar-blob centré, identité en Fraunces (nom 32px / rôle / org), encart de note en pointillés, hints de gestes en pied. Cf. [`mockups/plume-hero-v2.html`](plume-hero-v2.html).

- **Bouton chunky primaire (`{components.button-primary}`)** — aplat plein mauve `{colors.accent}`, texte blanc, contour encre, offset dur `0 6px 0 0 {colors.accent-deep}`, coins ~22px. C'est l'action principale partout (« Écrire », « Générer », « Copier », « Ajouter », CTA d'onboarding).

- **Bouton chunky secondaire (`{components.button-secondary}`)** — ghost : fond transparent, texte et contour menthe, offset menthe doux. Repousse sans culpabiliser (« Plus tard », « Améliorer »). Variante mini carrée (~56px) très discrète pour régénérer.

- **Bouton intelligent Générer ↔ Améliorer** — visuellement, c'est le bouton primaire dont seul le **libellé et le picto** changent (étincelle pour Générer, double-étincelle pour Améliorer). Même aplat mauve, même offset.

- **Chip / badge de relance (`{components.chip-relance}`)** — pill mauve-tint : fond `{colors.accent-tint}`, contour mauve, texte mauve profond, point coloré reprenant la **froideur** de la personne (« Relance · 5 j »).

- **Coldtag (`{components.coldtag}`)** — petite étiquette de froideur en texte doux avec une pastille carrée ou ronde teintée de l'état (« Tiède »). Discrète ; la couleur de l'avatar reste le signal premier.

- **Bottom-sheet composeur (`{components.bottom-sheet}`)** — feuille qui monte du bas, fond carte, contour encre, grand rayon en haut (~34px), offset dur **vers le haut** `0 -7px 0 0 {colors.accent}`, poignée (grab) en `{colors.line}`. Le contexte du contact (blob + nom + canal) reste visible au-dessus. Cf. [`mockups/plume-composeur-v2.html`](plume-composeur-v2.html).

- **Champ unique (`{components.field}`)** — grand champ héros, fond note `{colors.surface.note}`, contour encre épais, coins ~22px, placeholder en `{colors.ink-hint}`, caret mauve `{colors.accent}` clignotant. Vide par défaut ; le texte affiché EST le message.

- **Sélecteur de canal (`{components.channel-selector}`)** — rangée de 4 segments (LinkedIn / Email / WhatsApp / SMS) avec picto SVG tracé main. Le canal actif est en **aplat mauve plein** (texte blanc, petit offset dur) ; les autres en contour `{colors.line}` doux. Le canal de prédilection est pré-sélectionné.

- **Segmented Rapide / Soigné (`{components.segmented}`)** — contrôle compact pill : piste mauve-tint/chip, contour `{colors.line}` ; le segment actif en aplat mauve plein avec petit offset. Alias discrets (Haiku / Opus) en plus petit, plus pâles. Présent dans le composeur et dans Réglages (où il est en variante rectangulaire à coins ~13px).

- **Pill de tokens (`{components.token-pill}`)** — pill menthe discret : fond chip, contour `{colors.line}`, texte menthe profond, mini-picto, avec un qualificatif éventuel en mauve profond. Apparaît une fois le texte généré (« 1 180 tokens »).

- **Barre d'onglets (`{components.tabbar}`)** — 3 entrées, fond carte, bord supérieur encre épais. L'onglet **actif** porte le langage mauve cumulé : icône et label en mauve profond, pastille mauve-tint derrière le picto, **soulignement mauve** en haut de l'onglet. Les inactifs sont en `{colors.ink-hint}`. Picto SVG tracé main, jamais une lib d'icônes.

- **Toggle (`{components.toggle}`)** — interrupteur dessiné main : piste contournée encre, knob blanc contourné. **Activé = piste mauve** `{colors.accent}`, knob glissé à droite.

- **Stepper (`{components.stepper}`)** — trois cases jointes (− / valeur / +), contour encre, valeur centrale sur fond mauve-tint, signes en mauve profond. Sert au délai de relance (« 5 jours »).

- **Pager (`{components.pager}`)** — points ronds, idle en `#C7DDD5` ; le point **actif** s'allonge en pilule mauve `{colors.accent}`. Utilisé sous le deck et en haut de l'onboarding.

- **Hints de gestes** — micro-indications en texte `{colors.ink-hint}` accompagnées d'une flèche SVG fine (haut = écrire, latéral = feuilleter, bas = plus tard). Toujours discrètes, en pied de carte.

- **État vide** — grand vide serein : ciel, petits nuages plats qui dérivent, trajectoire de vol pointillée, **étincelles mauves** scintillantes, et la **plume-mascotte qui plane**, surmontant un titre Fraunces et une ligne douce (« C'est tout pour aujourd'hui. »). Jamais un écran blanc.

- **Carte de groupe / réglages (`{components.group-card}`)** — bloc de lignes groupées, fond carte, contour encre, coins ~22px, offset dur menthe par défaut (`offset-mint`) ou mauve (`offset-accent`) pour les groupes « voix » et « confidentialité ». Lignes séparées par un filet `{colors.line}`, chevrons en `{colors.ink-hint}`, valeurs en mauve profond. Le destructif (« Supprimer mon compte ») reste **soft** : teinte mauve mesurée, jamais de rouge alarme. Cf. [`mockups/plume-reglages-v1.html`](plume-reglages-v1.html).

- **Bloc Consommation** — deux cartes-stats côte à côte (chiffre Fraunces + libellé), l'une accentuée en mauve pour les tokens, surmontant une barre de progression mauve sur piste chip. Transparence du coût, ton rassurant.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Faire de l'illustration maison (plume-mascotte, blobs) l'âme de chaque écran | Tomber dans le look « app générée par IA » (cartes génériques, symétrie molle) |
| Couleur plate et confiante, aplats francs | Dégradés, ombres molles, flou, glassmorphism |
| Profondeur par contour plein + hard offset net teinté | Élévation par ombre diffuse pour hiérarchiser |
| **Flou = 0** : le 3e paramètre de tout `box-shadow` est TOUJOURS `0` (`Npx Npx 0 0 couleur`) | Un `box-shadow` avec rayon de flou ou spread non nul (ex. `4px 4px 8px`) |
| Légère rotation / asymétrie volontaire (cartes empilées, plume) pour le caractère fait-main | Re-centrage symétrique parfait par défaut |
| Contour en encre `{borders.color}` ~2.5px, porteur | Contour 1px gris générique (retour au plat fin sans âme) |
| État d'erreur en teinte douce de la famille (jamais alarmiste) | Rouge alarme / rouge système improvisé pour une erreur |
| Boutons chunky, posés sur leur offset comme des objets | Boutons plats fins sans matière |
| Texte minimal, le message (ou la personne) est le héros | Bloat, texte explicatif superflu, badges décoratifs, listes denses / tableur |
| Mauve `{colors.accent}` = couleur de l'action et des états actifs, ponctuelle | Étaler le mauve hors de ses points d'accent ; le diluer en décoration |
| Froideur portée par **la couleur des gens** (avatars), douce et désaturée | Jaune vif / froideur « chaude » / corail ; rouge alarme pour le destructif |
| Typo à caractère : Fraunces (display) + Quicksand (corps) | Inter, police système, all-caps généralisé |
| Picto SVG tracés main, sobres | Emojis en guise d'icônes, librairies d'icônes |
| Menthe d'eau dominante, warm et intime ; grand vide serein | Bleu corporate, froideur de CRM, densité anxiogène |

## [Décisions tranchées — 2026-06-16]

Lacunes esthétiques tranchées lors de la création des epics/stories (validées par Monsieur). Référence canonique testable : `epics.md` (UX-DR13..UX-DR24).

- **Dark mode → HORS MVP** (UX-DR13) : thème clair unique, `prefers-color-scheme` ignoré (forcé clair). Tokens structurés pour un thème sombre ultérieur sans réécriture.
- **États d'erreur / hors-ligne visuels → TRANCHÉ** (UX-DR14) : bandeau **inline** sous le champ (jamais modale ni toast éphémère), teinte douce désaturée (dérivé de `{colors.ink-soft}`) + picto maison (plume posée), microcopy warm. Bouton Générer/Améliorer grisé (disabled). **RÈGLE FERME maintenue : aucun rouge alarme / rouge système**, jamais.
- **Iconographie → mini-set canonique** (UX-DR24) : stroke 2.5px encre (`{colors.ink}`), grille 24px, style fait-main, dans `src/design/` ; couvre 4 canaux, onglets, `+`, recherche, étincelle/double-étincelle, flèches de gestes, chevron, copier, modifier. **Aucune lib d'icônes.**
- **États focus / hover / pressed / disabled → TRANCHÉ** (UX-DR11, détaillé dans `EXPERIENCE.State Patterns`) : focus = anneau net `{colors.accent}` (flou=0) ; hover = renforcement discret du contour / offset raccourci ; pressed = offset réduit voire annulé (pas de ripple, pas de flou) ; disabled = opacité réduite + offset supprimé + libellé `{colors.ink-hint}`.
- **Compte-rendu d'import CSV et résolution de doublons → TRANCHÉ** (UX-DR16) : carte-bilan non bloquante dans Réseau (« N ajoutés · N fusionnés · N à vérifier ») ; doublons ambigus = file de revue 1-par-1 (esprit deck) → Fusionner / Garder séparés.
- **Confirmation de relance « X t'a répondu ? » → TRANCHÉ** (UX-DR17) : variante de la carte courante du deck (pas d'interstitiel), Oui/Non au-dessus des actions.
- **Compteur zéro-fuite → TRANCHÉ** (UX-DR18) : cadrage positif (« Tout est repris, rien d'oublié »), chip mauve discret en cas de retard. **Jamais de badge rouge.**
- **Échelle typographique + tokens d'espacement → FORMALISÉS** (UX-DR19) : figés dans `src/design/tokens.ts` (display 32/30, body 16, bouton 18-20, label-caps 12 ; espacement `4/8/12/16/22/24`). Aucune valeur hors-pas.
