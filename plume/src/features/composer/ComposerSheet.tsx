"use client";

// ComposerSheet — POINT DE MONTAGE UNIQUE du composeur (story 1.4).
//
// Ici, simple PLACEHOLDER : ce composant est monté UNE seule fois dans
// `(app)/layout.tsx`, au-dessus des routes (jamais un onglet). Il ne rend RIEN de
// visible pour l'instant.
//
// La vraie bottom-sheet montante (ouverture via ?compose=, FSM de génération, draft-store,
// statut online/offline…) arrive à l'Epic 3. On fige dès maintenant l'emplacement de montage
// pour que l'ouverture réelle n'ait pas à toucher la coquille de navigation.
export function ComposerSheet() {
  // Aucun rendu visible au MVP de la coquille. `null` = point de montage inerte.
  return null;
}

export default ComposerSheet;
