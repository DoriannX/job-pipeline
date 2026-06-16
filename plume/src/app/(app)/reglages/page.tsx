import { EmptyState } from "@/components/ui/EmptyState";

// Onglet Réglages (FR-30..33) — état serein en story 1.4.
// Les vrais réglages (export, suppression, transparence, voix, push) arrivent à l'Epic 5.
export default function ReglagesPage() {
  return (
    <EmptyState
      title="Ton coin tranquille."
      message="Les réglages de Plume — ta voix, tes données, tes rappels — prendront place ici."
    />
  );
}
