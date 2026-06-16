import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { forUser } from "@/lib/db";
import { ReseauClient } from "@/features/contacts/ReseauClient";
import type { ContactView } from "@/features/contacts/types";

// Onglet Réseau (story 2.1) — propriétaire du moment « réseau vide / premier contact ».
//
// Server component : `auth()` résout le tenant À LA REQUÊTE (segment dynamique, pas de
// secret requis au build). On lit les contacts via la porte `db.forUser` (jamais le
// schéma ni Drizzle), puis on délègue l'orchestration (liste ↔ formulaire ↔ suppression)
// au client `ReseauClient`. Le tri par froideur + la recherche arrivent en story 2.3.
export default async function ReseauPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login");
  }

  const db = await forUser(userId);
  const rows = await db.contacts.list();

  // Projection client-safe (formes plates, sérialisables) — pas de fuite du schéma.
  const contacts: ContactView[] = rows.map((c) => ({
    id: c.id,
    nom: c.nom,
    canalPrefere: c.canalPrefere ?? null,
    handles: c.handles ?? null,
    notes: c.notes ?? null,
    dernierContactAt: c.dernierContactAt ?? null,
  }));

  return <ReseauClient contacts={contacts} />;
}
