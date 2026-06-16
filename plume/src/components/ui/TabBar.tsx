"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/design/icons";
import { isTabActive } from "@/components/ui/tab-active";

// Barre d'onglets — 3 entrées (Aujourd'hui · Réseau · Réglages), ANCRÉE EN BAS.
// Apparence (DESIGN.md « Barre d'onglets ») : fond carte, bord supérieur encre épais.
// L'onglet ACTIF porte le langage mauve CUMULÉ — jamais la couleur seule (UX-DR4/DR5) :
//   1. label + icône en mauve profond (text-accent-deep) ;
//   2. pastille mauve-tint (bg-accent-tint) derrière le picto ;
//   3. soulignement mauve en HAUT de l'onglet (barre bg-accent) ;
//   4. aria-current="page" pour le lecteur d'écran.
// L'inactif est en text-ink-hint (décoratif, jamais seul vecteur d'info : le label le double).

interface Tab {
  /** Segment de route racine de l'onglet (sans slash final). */
  readonly href: string;
  /** Libellé visible ET libellé accessible (en clair, français). */
  readonly label: string;
  readonly icon: IconName;
}

// Ordre de lecture = ordre de focus (plancher a11y) : Aujourd'hui d'abord (écran par défaut).
const TABS: readonly Tab[] = [
  { href: "/aujourdhui", label: "Aujourd'hui", icon: "tab-aujourdhui" },
  { href: "/reseau", label: "Réseau", icon: "tab-reseau" },
  { href: "/reglages", label: "Réglages", icon: "tab-reglages" },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="sticky bottom-0 z-10 border-t-[length:--border-width-ink] border-ink bg-surface-card"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((tab) => {
          const active = isTabActive(pathname, tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="relative flex flex-col items-center gap-1 px-2 pb-2 pt-3 outline-accent outline-offset-2 focus-visible:outline-2"
              >
                {/* Soulignement mauve en HAUT de l'onglet actif (1er vecteur cumulé). */}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-4 top-0 h-1 rounded-full bg-accent"
                  />
                ) : null}
                {/* Pastille mauve-tint derrière le picto (2e vecteur cumulé). */}
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    active ? "bg-accent-tint text-accent-deep" : "text-ink-hint"
                  }`}
                >
                  <Icon name={tab.icon} size={24} />
                </span>
                {/* Label toujours présent : double l'info, jamais la couleur seule (3e vecteur). */}
                <span
                  className={`font-body text-label font-bold tracking-[0.04em] ${
                    active ? "text-accent-deep" : "text-ink-hint"
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default TabBar;
