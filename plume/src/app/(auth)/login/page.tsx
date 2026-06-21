import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { devSignIn, isDevAuthEnabled } from "@/lib/auth-dev";
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

  // DEV ONLY : connexion sans Google (preview/localhost). La garde côté serveur (`devSignIn`
  // re-vérifie `isDevAuthEnabled`) double celle du rendu : impossible en production.
  const devAuth = isDevAuthEnabled();
  async function continueAsDev() {
    "use server";
    await devSignIn();
    redirect("/aujourdhui");
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

      {devAuth ? (
        <form action={continueAsDev}>
          <button
            type="submit"
            className="rounded-button border border-dashed border-ink-soft px-4 py-2 font-body text-button text-ink-soft outline-accent outline-offset-2 focus-visible:outline-2"
          >
            Connexion dev (sans Google)
          </button>
        </form>
      ) : null}
    </main>
  );
}
