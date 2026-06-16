import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Icon } from "@/design/icons";
import { Plume } from "@/design/illustration/Plume";

// Page de connexion (UX-DR5). `auth()` est appelé à LA REQUÊTE ⇒ ce segment est dynamique :
// `next build` n'a pas besoin de secrets/DB. Déjà connecté ⇒ on file droit vers /aujourdhui.
export default async function LoginPage() {
  const session = await auth();
  if (session) {
    redirect("/aujourdhui");
  }

  // Server Action : `signIn` est server-only (lib/auth.ts). Le clic POST déclenche le flow
  // OAuth Google, puis retour vers /aujourdhui (écran par défaut de l'app).
  async function continueWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/aujourdhui" });
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-7 bg-surface-app px-margin-mobile text-center">
      <Plume name="feather" size={120} title="Plume" />

      <div className="flex flex-col items-center gap-3">
        <h1 className="font-display text-display-name font-semibold tracking-[-0.01em] text-ink">
          Bienvenue chez Plume
        </h1>
        <p className="max-w-xs font-body text-body text-ink-soft">
          Ton carnet vivant pour entretenir ton réseau, dans ta propre voix.
        </p>
      </div>

      <form action={continueWithGoogle}>
        <button
          type="submit"
          className="flex items-center gap-3 rounded-button border-[length:--border-width-ink] border-ink bg-surface-card px-6 py-3 font-body text-button font-bold text-ink shadow-[var(--shadow-button-secondary)] outline-accent outline-offset-2 focus-visible:outline-2"
        >
          <Icon name="sparkle" size={24} />
          Continuer avec Google
        </button>
      </form>
    </main>
  );
}
