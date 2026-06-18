// Classes utilitaires des BOUTONS du design-system (primitives partagées).
// Plutôt que de retaper la même chaîne Tailwind dans chaque écran (et la voir diverger
// au premier tweak de DA), on centralise ici les 3 variantes employées par le composeur
// et les réglages. Aucune couleur hex : uniquement des tokens design (border-ink,
// bg-accent, shadow-button-*, outline-accent…). Importer la constante, pas la chaîne.

/** Bouton-ICÔNE carré (libellé porté par `aria-label`/tooltip), contour léger. */
export const BTN_ICON =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-button border-[length:--border-width-ink] border-line bg-surface-card text-ink-soft outline-accent outline-offset-2 focus-visible:outline-2 disabled:opacity-60";

/** Bouton PRIMAIRE chunky mauve, libellé jamais coupé (`whitespace-nowrap`). */
export const BTN_PRIMARY =
  "inline-flex shrink-0 items-center gap-2 rounded-button border-[length:--border-width-ink] border-ink bg-accent px-5 py-3 font-body text-button font-bold whitespace-nowrap text-accent-on shadow-[var(--shadow-button-primary)] outline-accent outline-offset-2 focus-visible:outline-2 disabled:opacity-70";

/** Bouton SECONDAIRE encre sur carte (ombre secondaire), pour actions neutres. */
export const BTN_SECONDARY =
  "rounded-button border-[length:--border-width-ink] border-ink bg-surface-card px-6 py-3 font-body text-button font-bold text-ink shadow-[var(--shadow-button-secondary)] outline-accent outline-offset-2 focus-visible:outline-2";
