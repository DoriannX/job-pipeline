import type { ReactNode } from "react";
import { Plume } from "@/design/illustration/Plume";

// État vide SEREIN — jamais d'écran blanc (UX-DR23, plancher a11y story 1.4).
// Composition canonique : plume-mascotte + titre Fraunces + ligne douce en encre adoucie.
// Centré dans la zone de contenu, au-dessus de la tabbar. Sert tous les onglets sans contenu.

interface EmptyStateProps {
  /** Titre serein en Fraunces (ex. « C'est tout pour aujourd'hui. »). */
  title: string;
  /** Ligne d'accompagnement douce, en encre adoucie. */
  message: string;
  /** Slot optionnel sous le message (CTA léger, etc.). Vide ici en story 1.4. */
  children?: ReactNode;
}

export function EmptyState({ title, message, children }: EmptyStateProps) {
  return (
    <section className="flex min-h-full flex-col items-center justify-center gap-5 px-margin-mobile py-12 text-center">
      {/* Illustration purement décorative : le texte porte le sens (titre absent ⇒ aria-hidden). */}
      <Plume name="feather" size={108} />
      <h1 className="font-display text-display-title font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h1>
      <p className="max-w-xs font-body text-body text-ink-soft">{message}</p>
      {children}
    </section>
  );
}

export default EmptyState;
