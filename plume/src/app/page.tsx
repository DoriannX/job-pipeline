import { Plume } from "@/design/illustration/Plume";

// Placeholder du design-system (story 1.2). Les écrans réels et la coquille 3 onglets
// arrivent en 1.4 ; ici on prouve seulement que tokens + illustration + polices tiennent.
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-surface-app px-margin-mobile text-center">
      <Plume name="feather" size={120} title="Plume" />
      <h1 className="font-display text-display-title font-semibold tracking-[-0.01em] text-ink">
        Plume
      </h1>
      <p className="max-w-xs font-body text-body text-ink-soft">
        Le carnet est prêt. Le design-system est posé&nbsp;; les écrans arrivent.
      </p>
    </main>
  );
}
