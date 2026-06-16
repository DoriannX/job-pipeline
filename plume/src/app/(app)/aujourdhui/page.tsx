import { EmptyState } from "@/components/ui/EmptyState";

// Onglet Aujourd'hui (FR-22..24) — écran par défaut de l'app.
// En story 1.4, sans deck à parcourir : état vide serein (jamais d'écran blanc).
// Le vrai SwipeDeck (relances du jour) arrive à l'Epic 4.
export default function AujourdhuiPage() {
  return (
    <EmptyState
      title="C'est tout pour aujourd'hui."
      message="Rien à relancer pour l'instant. Reviens demain, ta plume veille sur ton réseau."
    />
  );
}
