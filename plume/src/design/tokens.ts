// FOYER UNIQUE du design-system Plume — source de vérité unique (UX-DR1, UX-DR19).
// Valeurs figées d'après DESIGN.md (DA « Menthe d'eau × Mauve poussiéreux », 2026-06-16).
// Règle : AUCUNE couleur / rayon / espacement / offset codé en dur hors de ce fichier.
// `app/globals.css` (@theme Tailwind v4) miroite ces valeurs ; un test de parité
// (tests/design/tokens.test.ts) échoue à la moindre dérive.
//
// Thème CLAIR unique au MVP (UX-DR13) : `prefers-color-scheme` est ignoré. La structure
// est prête pour un thème sombre ultérieur (ajouter un mapping, sans réécrire les usages).
//
// Zone NEUTRE : importable client ET serveur (zéro infra). Voir architecture.md §frontières.

/** Palette — la menthe domine, le mauve ponctue l'action, la froideur appartient aux gens. */
export const colors = {
  // Surfaces (jamais blanc pur : ambiance carnet).
  surface: {
    app: "#E9F3EF",
    card: "#FBFEFD",
    note: "#EDF6F2",
    chip: "#DCEFE9",
  },
  // Encre = texte principal + contours + trait de TOUTE l'illustration (jamais noir pur).
  ink: "#2E3F3B",
  inkSoft: "#5F726D",
  inkHint: "#9DB5AD",
  line: "#CFE3DB",
  // Menthe = couleur de marque.
  mint: "#7FBEAF",
  mintDeep: "#4E8978",
  mintOffset: "#CADFD8",
  mintOffsetSoft: "#BFD9D0",
  // Mauve = fil rouge de l'action et des états actifs, et rien d'autre.
  accent: "#B391AC",
  accentDeep: "#876585",
  accentOn: "#FFFFFF",
  accentTint: "#ECE2EA",
  // Froideur — 4 états sémantiques portés par la COULEUR des avatars (jamais alarmiste).
  // Chaque teinte a une ombre interne `-shade` du même ton (modèle le blob, fait-main).
  cold: {
    never: "#C9C2D6", // jamais contacté — gris-lavande
    fresh: "#8FBCA8", // frais — menthe-vert doux
    warm: "#CBA7C0", // tiède — mauve-rosé doux
    cold: "#A7BCC6", // froid — bleu-gris poussiéreux
  },
  coldShade: {
    never: "#B3AAC6",
    fresh: "#73A28C",
    warm: "#B289A6",
    cold: "#8AA2AE",
  },
  // Divers ponctuels figés par DESIGN.md.
  pagerDotIdle: "#C7DDD5",
} as const;

/** Typographie — Fraunces (display) + Quicksand (corps). Jamais Inter ni police système. */
export const typography = {
  fontFamily: {
    display: "Fraunces",
    body: "Quicksand",
  },
  weight: {
    display: 600,
    body: 500,
    button: 700,
    label: 700,
  },
  // Ramp observée : 32 / 30 / 16 / 18-20 / 12 (UX-DR19).
  size: {
    displayName: "32px",
    displayTitle: "30px",
    body: "16px",
    button: "20px",
    label: "12px",
  },
  lineHeight: {
    displayName: 1.04,
    displayTitle: 1.05,
    body: 1.5,
  },
  letterSpacing: {
    display: "-0.01em",
    label: "0.12em",
  },
} as const;

/** Rayons — coins généreux, formes organiques, aucune arête vive. */
export const radii = {
  sm: "6px",
  md: "14px",
  card: "16px",
  sheet: "34px", // bottom-sheet : grand rayon en haut uniquement
  button: "22px",
  deck: "32px",
  full: "9999px",
} as const;

/** Espacement — échelle par pas de 4 (UX-DR19). Aucune valeur hors-pas. */
export const spacing = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "22px",
  6: "24px",
  gutter: "22px",
  marginMobile: "24px",
} as const;

/** Contours — épais, en encre, porteurs de caractère (jamais 1px gris générique). */
export const borders = {
  width: "2.5px",
  widthIllustration: "3px",
  color: colors.ink,
  offsetDistance: "4px",
} as const;

// RÈGLE DURE — flou = 0. Le 3e paramètre (rayon de flou) d'un box-shadow est TOUJOURS 0.
// La profondeur = contour plein + hard offset net teinté. Forme canonique : `Npx Npx 0 0 c`.
/** Offsets durs (profondeur sans ombre molle). Tous en `… 0 0 …` : blur ET spread nuls. */
export const offsets = {
  phone: `13px 14px 0 0 ${colors.mintOffset}`,
  buttonPrimary: `0 6px 0 0 ${colors.accentDeep}`,
  buttonSecondary: `0 6px 0 0 ${colors.mintOffsetSoft}`,
  groupMint: `5px 5px 0 0 ${colors.mint}`,
  groupAccent: `8px 8px 0 0 ${colors.accent}`,
  sheetTop: `0 -7px 0 0 ${colors.accent}`,
} as const;

export type ColdState = keyof typeof colors.cold;

const tokens = { colors, typography, radii, spacing, borders, offsets } as const;
export default tokens;
