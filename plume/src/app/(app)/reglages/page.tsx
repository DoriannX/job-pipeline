import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";
import { forUser } from "@/lib/db";
import { BTN_SECONDARY } from "@/design/buttons";
import { VoiceSection } from "@/features/voice/VoiceSection";
import type { VoiceSeedView } from "@/features/voice/actions";

// Onglet Réglages (FR-30..33). La gestion de la VOIX (seed optionnel, story 3.5) y vit au
// MVP — l'onboarding 5.5 viendra plus tard. Les autres réglages (export, suppression,
// transparence, push) arrivent à l'Epic 5.
//
// Server component : `auth()` résout le tenant À LA REQUÊTE (segment dynamique, pas de
// secret requis au build). On lit les seeds via la porte `db.forUser` (jamais le schéma
// ni Drizzle), on projette une vue PLATE, puis on délègue l'interactivité (ajout /
// suppression) au wrapper client `VoiceSection`.
export default async function ReglagesPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login");
  }

  const db = await forUser(userId);
  const rows = await db.seedVoix.list(); // ordonnés récent → ancien

  // Projection client-safe (formes plates, sérialisables) — pas de fuite du schéma.
  const seeds: VoiceSeedView[] = rows.map((s) => ({
    id: s.id,
    texte: s.texte,
    createdAt: s.createdAt ?? null,
  }));

  // Server Action : `signOut` est server-only (lib/auth.ts). Le clic POST détruit la
  // session (stratégie database) puis renvoie vers /login.
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex flex-col gap-6 px-margin-mobile py-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-display-title font-semibold tracking-[-0.01em] text-ink">
          Réglages
        </h1>
        <p className="font-body text-body text-ink-soft">
          Ton coin tranquille. Pour l&apos;instant, c&apos;est ici que tu
          amorces ta voix.
        </p>
      </header>

      <VoiceSection seeds={seeds} />

      <form action={logout} className="mt-2">
        <button type="submit" className={BTN_SECONDARY}>
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
