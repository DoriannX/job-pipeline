import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { forUser } from "@/lib/db";
import { coldness } from "@/lib/domain/cold-score";
import { now, systemClock } from "@/lib/domain/time";
import { ContactDetail } from "@/features/contacts/ContactDetail";
import type { ContactDetailView } from "@/features/contacts/contact-detail";

// Fiche Contact = timeline (story 2.4).
//
// Server component : `auth()` résout le tenant À LA REQUÊTE (segment dynamique, pas de
// secret requis au build — la config NextAuth est paresseuse). On lit le contact via la
// porte `db.forUser` (jamais le schéma ni Drizzle), AUTO-scopée au tenant.
//
// ISOLATION (invariant n°1) : `get` renvoie `undefined` pour un id INEXISTANT *ou* qui
// appartient à un AUTRE tenant — on ne distingue pas les deux et on ne fuite RIEN :
// `notFound()` dans les deux cas (jamais de 500, jamais de détail révélateur).
//
// Next.js 16 : `params` est asynchrone (Promise) — on l'attend.
export default async function ContactPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    // Garde d'auth : la coquille (app)/layout redirige déjà, on double la garde ici
    // pour ne jamais lire la DB sans tenant.
    redirect("/login");
  }

  const { contactId } = await params;

  const db = await forUser(userId);
  const contact = await db.contacts.get(contactId);

  // Inexistant OU contact d'autrui : `get` renvoie undefined (scopé). Aucune fuite.
  if (!contact) {
    notFound();
  }

  // Instant de référence figé : la froideur est DÉRIVÉE à la lecture (cold-score, jamais
  // stockée), avec un `now` INJECTÉ (jamais Date.now() hors time.ts).
  const maintenant = now(systemClock);
  const dernierContactAt = contact.dernierContactAt ?? null;

  // Projection client-safe (forme plate, sérialisable) — pas de fuite du schéma.
  const view: ContactDetailView = {
    id: contact.id,
    nom: contact.nom,
    entreprise: contact.entreprise ?? null,
    canalPrefere: contact.canalPrefere ?? null,
    handles: contact.handles ?? null,
    notes: contact.notes ?? null,
    dernierContactAt,
    coldness: coldness(dernierContactAt, maintenant),
  };

  return <ContactDetail contact={view} />;
}
