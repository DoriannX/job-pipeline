import { EmptyState } from "@/components/ui/EmptyState";

// Onglet Réseau — état d'AMORÇAGE léger en story 1.4.
// Le vrai écran « réseau vide / premier contact » (plume + CTA « Ajouter un premier
// contact ») appartient à la story 2.1, propriétaire unique de ce moment : on ne le
// sur-conçoit pas ici. Simple état serein en attendant les contacts.
export default function ReseauPage() {
  return (
    <EmptyState
      title="Ton réseau t'attend."
      message="Bientôt, tu retrouveras ici les visages que tu veux garder au chaud."
    />
  );
}
