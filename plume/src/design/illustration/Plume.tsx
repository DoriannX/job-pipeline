import type { CSSProperties } from "react";
import { colors, type ColdState } from "@/design/tokens";

// <Plume name tint/> — wrapper de l'illustration maison. Référence le sprite canonique
// (PlumeSprite, monté une fois) via <use href="#plume-…"> : la plume et le blob sont UN
// tracé partagé, jamais redessinés. Le blob se RECOLORE selon la froideur (fill corps +
// ombre -shade + joues), piloté par variables CSS — aucun re-dessin.

type PlumeName = "feather" | "blob";

interface PlumeProps {
  name: PlumeName;
  /** Recolore le blob selon la froideur (sans effet sur la plume-mascotte). */
  tint?: ColdState;
  /** Largeur en px (la hauteur suit le ratio du tracé). */
  size?: number;
  className?: string;
  /** Libellé accessible. Absent ⇒ illustration purement décorative (aria-hidden). */
  title?: string;
}

const VIEWBOX: Record<PlumeName, string> = {
  feather: "-30 -82 96 116",
  blob: "0 0 124 124",
};

// feather : 96×116 (ratio conservé) ; blob : carré 124×124.
const HEIGHT_RATIO: Record<PlumeName, number> = {
  feather: 116 / 96,
  blob: 1,
};

export function Plume({ name, tint, size = 96, className, title }: PlumeProps) {
  const recolor =
    name === "blob" && tint
      ? ({
          "--plume-cold": colors.cold[tint],
          "--plume-cold-shade": colors.coldShade[tint],
          "--plume-cheek": colors.coldShade[tint],
        } as CSSProperties)
      : undefined;

  const decorative = !title;

  return (
    <svg
      viewBox={VIEWBOX[name]}
      width={size}
      height={Math.round(size * HEIGHT_RATIO[name])}
      className={className}
      style={recolor}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <use href={`#plume-${name}`} />
    </svg>
  );
}

export default Plume;
