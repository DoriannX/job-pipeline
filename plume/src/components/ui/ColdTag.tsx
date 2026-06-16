// ColdTag — pastille de FROIDEUR doublée d'un libellé TEXTE (story 2.3, a11y).
// RÈGLE DURE : la couleur ne porte JAMAIS seule l'information (UX a11y / FR-4). La
// teinte de froideur est TOUJOURS accompagnée du libellé FR lisible + d'un `aria-label`
// explicite. Tokens uniquement (couleurs depuis @/design/tokens) — aucun hex ici.

import { colors, type ColdState } from "@/design/tokens";

/** Libellés FR des 4 états de froideur (le TEXTE qui double la couleur). */
const LIBELLE: Record<ColdState, string> = {
  never: "Jamais contacté",
  fresh: "Frais",
  warm: "Tiède",
  cold: "Froid",
};

interface ColdTagProps {
  state: ColdState;
  className?: string;
}

export function ColdTag({ state, className }: ColdTagProps) {
  const libelle = LIBELLE[state];
  return (
    <span
      // La teinte vient des tokens (variables CSS @theme), jamais d'un hex en dur.
      // On double SYSTÉMATIQUEMENT la couleur du libellé texte (a11y).
      style={{ "--cold-dot": colors.cold[state] } as React.CSSProperties}
      aria-label={`Froideur : ${libelle}`}
      className={`inline-flex items-center gap-1.5 rounded-full border-[length:--border-width-ink] border-line bg-surface-card px-2 py-0.5 font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft ${className ?? ""}`}
    >
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: "var(--cold-dot)" }}
      />
      {libelle}
    </span>
  );
}

export default ColdTag;
