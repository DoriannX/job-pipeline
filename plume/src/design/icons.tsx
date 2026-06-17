import type { ReactNode } from "react";

// Mini-set d'icônes MAISON (UX-DR24). Tracé fait-main, grille 24px, stroke 2.5px en
// `currentColor` (= encre par défaut, mauve quand l'élément est actif). Caps/joins ronds
// pour la douceur. AUCUNE librairie d'icônes, AUCUN emoji. Couvre : 4 canaux, onglets,
// +, recherche, étincelle / double-étincelle, flèches de gestes, chevron, copier, modifier.

export type IconName =
  | "linkedin"
  | "email"
  | "whatsapp"
  | "sms"
  | "tab-aujourdhui"
  | "tab-reseau"
  | "tab-reglages"
  | "plus"
  | "search"
  | "sparkle"
  | "double-sparkle"
  | "arrow-up"
  | "arrow-down"
  | "arrow-left"
  | "arrow-right"
  | "chevron"
  | "copy"
  | "edit"
  | "trash"
  | "check";

const PATHS: Record<IconName, ReactNode> = {
  // — Canaux —
  linkedin: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <path d="M7.5 10.5 V16.5" />
      <path d="M7.5 7.4 v0.01" />
      <path d="M11.5 16.5 V10.5" />
      <path d="M11.5 13.2 a2.7 2.7 0 0 1 5.4 0 V16.5" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="3.5" />
      <path d="M4.5 8 L12 13.5 L19.5 8" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M12 3.5 a8.5 8.5 0 0 0 -7.4 12.7 L3.5 20.5 l4.4 -1.1 A8.5 8.5 0 1 0 12 3.5 Z" />
      <path d="M9 9.2 c-0.6 1.8 1.2 4.2 3 5.4 c1.4 0.9 3 0.6 3.3 -0.4 c0.1 -0.4 -0.2 -0.7 -0.7 -1 l-1.3 -0.7 c-0.4 -0.2 -0.7 0 -1 0.3 c-0.8 -0.4 -1.4 -1 -1.8 -1.8 c0.3 -0.3 0.5 -0.6 0.3 -1 l-0.7 -1.3 c-0.3 -0.5 -0.6 -0.8 -1 -0.7 c-0.2 0.1 -0.3 0.2 -0.4 0.4 Z" />
    </>
  ),
  sms: (
    <>
      <path d="M4 6.5 a3 3 0 0 1 3 -3 h10 a3 3 0 0 1 3 3 v6 a3 3 0 0 1 -3 3 H10 l-4 4 v-4 a3 3 0 0 1 -2 -3 Z" />
      <path d="M8.5 9.5 v0.01 M12 9.5 v0.01 M15.5 9.5 v0.01" />
    </>
  ),
  // — Onglets — (Aujourd'hui · Réseau · Réglages)
  "tab-aujourdhui": (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3 v2.5 M12 18.5 V21 M3 12 h2.5 M18.5 12 H21 M5.6 5.6 l1.8 1.8 M16.6 16.6 l1.8 1.8 M18.4 5.6 l-1.8 1.8 M7.4 16.6 l-1.8 1.8" />
    </>
  ),
  "tab-reseau": (
    <>
      <circle cx="8" cy="9" r="3" />
      <circle cx="16.5" cy="10.5" r="2.5" />
      <path d="M3.5 19 c0.4 -3 2.3 -4.6 4.5 -4.6 c1.7 0 3.2 1 4.1 2.8" />
      <path d="M13.5 18.5 c0.5 -2.2 1.8 -3.3 3.2 -3.3 c1.6 0 3 1.3 3.4 3.6" />
    </>
  ),
  "tab-reglages": (
    <>
      <path d="M4 8 H13 M17 8 H20" />
      <path d="M4 16 H8 M12 16 H20" />
      <circle cx="15" cy="8" r="2.3" />
      <circle cx="10" cy="16" r="2.3" />
    </>
  ),
  // — Actions —
  plus: <path d="M12 5.5 V18.5 M5.5 12 H18.5" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15 L20 20" />
    </>
  ),
  sparkle: (
    <path d="M12 3.5 c0.6 4 1.5 4.9 5.5 5.5 c-4 0.6 -4.9 1.5 -5.5 5.5 c-0.6 -4 -1.5 -4.9 -5.5 -5.5 c4 -0.6 4.9 -1.5 5.5 -5.5 Z" />
  ),
  "double-sparkle": (
    <>
      <path d="M9.5 3.5 c0.5 3.2 1.2 3.9 4.4 4.4 c-3.2 0.5 -3.9 1.2 -4.4 4.4 c-0.5 -3.2 -1.2 -3.9 -4.4 -4.4 c3.2 -0.5 3.9 -1.2 4.4 -4.4 Z" />
      <path d="M17 12.5 c0.3 2 0.8 2.5 2.8 2.8 c-2 0.3 -2.5 0.8 -2.8 2.8 c-0.3 -2 -0.8 -2.5 -2.8 -2.8 c2 -0.3 2.5 -0.8 2.8 -2.8 Z" />
    </>
  ),
  // — Flèches de gestes — (haut = écrire, latéral = feuilleter, bas = plus tard)
  "arrow-up": <path d="M12 19 V6 M6.5 11.5 L12 6 L17.5 11.5" />,
  "arrow-down": <path d="M12 5 V18 M6.5 12.5 L12 18 L17.5 12.5" />,
  "arrow-left": <path d="M19 12 H6 M11.5 6.5 L6 12 L11.5 17.5" />,
  "arrow-right": <path d="M5 12 H18 M12.5 6.5 L18 12 L12.5 17.5" />,
  chevron: <path d="M9.5 5.5 L16 12 L9.5 18.5" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="3" />
      <path d="M15 9 V7 a3 3 0 0 0 -3 -3 H7 a3 3 0 0 0 -3 3 v5 a3 3 0 0 0 3 3 h2" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20 l1 -4 L16.5 4.5 a2 2 0 0 1 3 3 L8 19 Z" />
      <path d="M14 7 L17 10" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7 H19" />
      <path d="M9.5 7 V5.3 a1.3 1.3 0 0 1 1.3 -1.3 h2.4 a1.3 1.3 0 0 1 1.3 1.3 V7" />
      <path d="M6.5 7 L7.4 18.7 a1.9 1.9 0 0 0 1.9 1.8 h5.4 a1.9 1.9 0 0 0 1.9 -1.8 L18.5 7" />
      <path d="M10 10.5 V17 M14 10.5 V17" />
    </>
  ),
  // — Marquage « Envoyé » (story 3.6) : coche douce. —
  check: <path d="M5 12.5 L10 17.5 L19 6.5" />,
};

export const ICON_NAMES = Object.keys(PATHS) as IconName[];

interface IconProps {
  name: IconName;
  /** Taille en px (carré, grille 24). */
  size?: number;
  className?: string;
  /** Libellé accessible. Absent ⇒ icône décorative (aria-hidden). */
  title?: string;
}

export function Icon({ name, size = 24, className, title }: IconProps) {
  const decorative = !title;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}

export default Icon;
