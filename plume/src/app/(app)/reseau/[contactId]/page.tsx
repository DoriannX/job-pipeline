import { EmptyState } from "@/components/ui/EmptyState";

// Fiche Contact (timeline) — PLACEHOLDER en story 1.4.
// Le vrai écran (fiche = timeline des Messages/Relances) arrive aux stories 2.x / Epic 4.
// Next.js 16 : `params` est asynchrone (Promise) — on l'attend même si on n'affiche
// pas encore le contactId, pour figer la signature dès maintenant.
export default async function ContactPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  await params;

  return (
    <EmptyState
      title="Bientôt, son histoire."
      message="La fiche de ce contact et vos échanges s'afficheront ici."
    />
  );
}
