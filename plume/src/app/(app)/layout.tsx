import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TabBar } from "@/components/ui/TabBar";
import { ComposerSheet } from "@/features/composer/ComposerSheet";

// Coquille de l'app connectée (story 1.4).
//
// GARDE D'AUTH (UX-DR5 ; amorce FR-22) : `auth()` résout la session à LA REQUÊTE
// (jamais au chargement du module — la config NextAuth est paresseuse, cf. lib/auth.ts).
// Sans session ⇒ redirection vers /login. `auth()` étant appelé ici, ce segment est rendu
// dynamiquement : `next build` n'a donc pas besoin de secrets/DB pour collecter les routes.
//
// Structure : zone de contenu plein écran (scrollable) surmontant une TabBar 3 entrées
// ancrée en bas, plus le ComposerSheet monté UNE seule fois au-dessus des routes (pas un onglet).
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface-app">
      {/* Zone de contenu : grandit et défile ; ordre de lecture = ordre du DOM. */}
      <main className="flex flex-1 flex-col">{children}</main>

      {/* TabBar ancrée en bas (landmark <nav>), commune à tous les onglets. */}
      <TabBar />

      {/* Point de montage UNIQUE du composeur (placeholder inerte ; ouverture réelle = Epic 3). */}
      <ComposerSheet />
    </div>
  );
}
