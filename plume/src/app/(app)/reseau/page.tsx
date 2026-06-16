import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { forUser } from "@/lib/db";
import { coldness } from "@/lib/domain/cold-score";
import { now, systemClock } from "@/lib/domain/time";
import { ReseauClient } from "@/features/contacts/ReseauClient";
import type { ContactView } from "@/features/contacts/types";

// Onglet Réseau (stories 2.1 → 2.3) — propriétaire du moment « réseau vide / premier
// contact » ET de la galerie triée par froideur + recherche.
//
// Server component : `auth()` résout le tenant À LA REQUÊTE (segment dynamique, pas de
// secret requis au build). On lit les contacts via la porte `db.forUser` (jamais le
// schéma ni Drizzle), on DÉRIVE la froideur à la lecture (cold-score, non stockée) avec
// un `now` INJECTÉ (jamais `Date.now()` hors time.ts), puis on délègue l'orchestration
// (galerie ↔ formulaire ↔ suppression) au client `ReseauClient`.
export default async function ReseauPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login");
  }

  const db = await forUser(userId);
  const rows = await db.contacts.list();
  // Collisions ambiguës restant à trancher (story 2.5) : compté côté serveur via la
  // porte scopée, jamais le schéma. Sert le rappel doux + l'entrée vers la file de revue.
  const pendingMerges = (await db.mergeCandidates.listPending()).length;

  // Instant de référence figé pour TOUTE la page : la froideur de chaque contact est
  // calculée vis-à-vis du même `now` (cohérence des bandes au sein d'un rendu).
  const maintenant = now(systemClock);

  // Projection client-safe (formes plates, sérialisables) — pas de fuite du schéma.
  // La froideur est DÉRIVÉE ici (à la lecture), jamais une colonne en base.
  const contacts: ContactView[] = rows.map((c) => {
    const dernierContactAt = c.dernierContactAt ?? null;
    return {
      id: c.id,
      nom: c.nom,
      canalPrefere: c.canalPrefere ?? null,
      handles: c.handles ?? null,
      notes: c.notes ?? null,
      dernierContactAt,
      coldness: coldness(dernierContactAt, maintenant),
    };
  });

  return <ReseauClient contacts={contacts} pendingMerges={pendingMerges} />;
}
