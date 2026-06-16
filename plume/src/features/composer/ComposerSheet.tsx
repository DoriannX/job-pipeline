"use client";

// ComposerSheet — bottom-sheet du Composeur (story 3.1).
//
// POINT DE MONTAGE UNIQUE : ce composant est monté UNE seule fois dans `(app)/layout.tsx`,
// au-dessus des routes (jamais un onglet — overlay « en flow », FR-13). Il s'OUVRE quand
// l'URL porte `?compose=<contactId>` ; absent ⇒ il ne rend rien (point de montage inerte).
// Fermer = retirer ce seul param (en préservant les autres).
//
// PÉRIMÈTRE 3.1 STRICT : champ unique (source de vérité) + sélecteur 4 canaux + segment
// Rapide/Soigné + brouillon immortel (persisté À CHAQUE frappe avant tout réseau, restauré
// à la réouverture) + Copier (commit MANUEL ; aucun auto-send, FR-12). PAS de génération IA
// ni de streaming (stories 3.3/3.4), PAS de marquage « Envoyé » (story 3.6) — hors périmètre.
//
// État LOCAL React (pas de Zustand : non installé, inutile à ce stade). `useSearchParams`
// impose une frontière `<Suspense>` côté prerender (cf. docs Next) : on isole donc la lecture
// du param dans un composant enfant, monté sous Suspense.

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Icon, type IconName } from "@/design/icons";
import { CANAUX, type Canal } from "@/lib/domain/enums";
import {
  deleteDraft,
  getDraft,
  saveDraft,
  type Draft,
} from "@/lib/offline/localStore";

import {
  loadComposerContextAction,
  type ComposerContext,
} from "./actions";

// Query param d'ouverture (camelCase pour les query params, cf. conventions). Sa valeur
// = l'id du Contact ciblé, qui sert aussi de CLÉ de brouillon (un brouillon par contact).
const COMPOSE_PARAM = "compose";

type Tone = Draft["tone"];

// Libellés FR + icônes maison des 4 canaux (mêmes valeurs que le formulaire Contact).
const CANAL_LABEL: Record<Canal, string> = {
  linkedin: "LinkedIn",
  email: "E-mail",
  whatsapp: "WhatsApp",
  sms: "SMS",
};
const CANAL_ICON: Record<Canal, IconName> = {
  linkedin: "linkedin",
  email: "email",
  whatsapp: "whatsapp",
  sms: "sms",
};

// Segment de registre. Les alias Haiku/Opus sont PUREMENT VISUELS (indices discrets) :
// le choix réel de modèle est branché plus tard (story 3.3), hors périmètre ici.
const TONES: { value: Tone; label: string; alias: string }[] = [
  { value: "rapide", label: "Rapide", alias: "Haiku" },
  { value: "soigne", label: "Soigné", alias: "Opus" },
];

/**
 * Lecture du param `?compose=` sous Suspense (exigence `useSearchParams`). Quand il est
 * présent → on monte la feuille pour ce contact ; sinon → rien (montage inerte).
 */
function ComposerGate() {
  const searchParams = useSearchParams();
  const contactId = searchParams.get(COMPOSE_PARAM);

  if (!contactId) return null;

  // `key` force un remontage propre quand on passe d'un contact à l'autre : l'état local
  // (texte/canal/tone) repart du brouillon du nouveau contact, pas de l'ancien.
  return <ComposerSheetPanel key={contactId} contactId={contactId} />;
}

interface ComposerSheetPanelProps {
  contactId: string;
}

/**
 * La feuille proprement dite, montée seulement quand un contact est ciblé. Charge le
 * contexte serveur + le brouillon local, puis gère le champ unique, le sélecteur de
 * canal, le segment et la copie. `contactId` est aussi la clé de brouillon.
 */
function ComposerSheetPanel({ contactId }: ComposerSheetPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Contexte du Contact (nom + canal préféré), ancré en tête. `null` tant que non chargé
  // ou si introuvable (la feuille reste utilisable : champ + brouillon fonctionnent).
  const [context, setContext] = useState<ComposerContext | null>(null);

  // — État du champ unique (SOURCE DE VÉRITÉ) + canal + registre. —
  const [text, setText] = useState("");
  const [canal, setCanal] = useState<Canal>("linkedin");
  const [tone, setTone] = useState<Tone>("rapide");

  // Garde de restauration : on ne persiste PAS tant que le brouillon n'a pas été restauré
  // (sinon le 1er effet écraserait un brouillon existant avec les défauts vides).
  const [hydrated, setHydrated] = useState(false);

  // Confirmation discrète de copie (message éphémère, ton doux).
  const [copied, setCopied] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // — Restauration À L'OUVERTURE : contexte serveur + brouillon local en parallèle. —
  // Si un brouillon existe, il a la priorité (texte/canal/tone) ; sinon, défauts =
  // texte vide, canal = canal préféré du contact, tone = rapide.
  useEffect(() => {
    let actif = true;

    async function restaurer() {
      const [ctx, draft] = await Promise.all([
        loadComposerContextAction(contactId).catch(() => null),
        getDraft(contactId).catch(() => undefined),
      ]);
      if (!actif) return;

      setContext(ctx);

      if (draft) {
        setText(draft.text);
        setCanal(draft.canal);
        setTone(draft.tone);
      } else if (ctx?.canalPrefere) {
        // Pas de brouillon : on pré-sélectionne le canal préféré (changeable en 1 tap).
        setCanal(ctx.canalPrefere);
      }
      setHydrated(true);
    }

    void restaurer();
    return () => {
      actif = false;
    };
  }, [contactId]);

  // Focus initial : le champ unique reçoit le curseur dès l'ouverture (écrire sans friction).
  useEffect(() => {
    if (hydrated) textareaRef.current?.focus();
  }, [hydrated]);

  // — BROUILLON IMMORTEL : à chaque changement (frappe, canal, tone), on persiste AVANT
  // tout réseau. La persistance est locale (IndexedDB) : aucune dépendance au réseau.
  // Champ VIDE ⇒ rien à protéger : on n'écrit pas de brouillon fantôme (et on efface un
  // brouillon vidé), pour ne pas « ressusciter » du vide à la réouverture. —
  useEffect(() => {
    if (!hydrated) return; // n'écrase pas le brouillon restauré avec un état pré-hydratation
    if (text.trim().length === 0) {
      void deleteDraft(contactId);
      return;
    }
    void saveDraft({
      key: contactId,
      text,
      canal,
      tone,
      updatedAt: Date.now(),
    });
  }, [hydrated, contactId, text, canal, tone]);

  // Fermeture = retirer le SEUL param `compose`, en préservant les autres (router.replace
  // pour ne pas empiler une entrée d'historique vide). On reste sur le même chemin.
  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(COMPOSE_PARAM);
    const query = params.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
  }, [router, searchParams]);

  // Fermeture clavier (Échap) — la feuille = dialog modal.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  // Copier = commit MANUEL (FR-12). Aucun envoi automatique, aucun marquage « Envoyé ».
  async function copier() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard indisponible (permission / contexte non sécurisé) : on reste silencieux
      // et doux — le texte demeure dans le champ, l'utilisateur peut le sélectionner.
    }
  }

  const nom = context?.nom ?? "ce contact";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="composer-title"
      className="fixed inset-0 z-30 flex items-end justify-center"
    >
      {/* Backdrop : ferme au clic hors feuille (équivalent non-gestuel à l'Échap). */}
      <button
        type="button"
        aria-label="Fermer le composeur"
        onClick={close}
        className="absolute inset-0 bg-ink/30"
      />

      {/* Feuille : monte du bas, grand rayon en haut, offset dur VERS LE HAUT (accent),
          poignée grab. `mt-auto` la colle en bas ; `max-h` la garde scrollable. */}
      <div
        ref={dialogRef}
        className="relative mt-auto flex max-h-[92dvh] w-full max-w-md flex-col gap-4 rounded-t-sheet border-[length:--border-width-ink] border-ink bg-surface-card px-margin-mobile pb-8 pt-3 shadow-[var(--shadow-sheet-top)]"
      >
        {/* Poignée grab (affordance « feuille tirable »), purement visuelle. */}
        <div
          aria-hidden="true"
          className="mx-auto h-1.5 w-12 rounded-full bg-line"
        />

        {/* — Contexte Contact ANCRÉ au-dessus (FR-13) : nom + canal, jamais un onglet. — */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft">
              Écrire à
            </span>
            <h2
              id="composer-title"
              className="truncate font-display text-display-title font-semibold tracking-[-0.01em] text-ink"
            >
              {nom}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Fermer"
            className="shrink-0 rounded-button p-2 text-ink-soft outline-accent outline-offset-2 focus-visible:outline-2"
          >
            <Icon name="arrow-down" size={22} />
          </button>
        </header>

        {/* — Sélecteur 4 canaux (FR-2) : actif = aplat mauve plein ; inactifs = contour doux.
            Le canal préféré est pré-sélectionné ; changeable en 1 tap. — */}
        <fieldset className="flex flex-col gap-2">
          <legend className="font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft">
            Canal
          </legend>
          <div className="flex flex-wrap gap-2">
            {CANAUX.map((c) => {
              const active = canal === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCanal(c)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-2 rounded-button border-[length:--border-width-ink] px-4 py-2 font-body text-body font-bold outline-accent outline-offset-2 focus-visible:outline-2 ${
                    active
                      ? "border-ink bg-accent text-accent-on shadow-[var(--shadow-button-primary)]"
                      : "border-line bg-surface-card text-ink-soft"
                  }`}
                >
                  <Icon name={CANAL_ICON[c]} size={20} />
                  {CANAL_LABEL[c]}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* — Segment Rapide / Soigné : piste chip, segment actif en aplat mauve. Alias
            Haiku/Opus discrets (purement visuels). — */}
        <fieldset className="flex flex-col gap-2">
          <legend className="font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft">
            Registre
          </legend>
          <div className="inline-flex w-fit gap-1 rounded-button border-[length:--border-width-ink] border-line bg-surface-chip p-1">
            {TONES.map(({ value, label, alias }) => {
              const active = tone === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTone(value)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-[14px] px-4 py-1.5 font-body text-body font-bold outline-accent outline-offset-2 focus-visible:outline-2 ${
                    active
                      ? "bg-accent text-accent-on shadow-[var(--shadow-button-primary)]"
                      : "text-ink-soft"
                  }`}
                >
                  {label}
                  <span
                    aria-hidden="true"
                    className={`text-label font-bold uppercase tracking-[0.12em] ${
                      active ? "text-accent-on/70" : "text-ink-hint"
                    }`}
                  >
                    {alias}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* — CHAMP UNIQUE (source de vérité) : le texte affiché EST le Message (FR-6). Vide
            par défaut, éditable. Fond note, contour encre, caret mauve. — */}
        <label className="flex flex-col gap-2">
          <span className="sr-only">Message</span>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder="Écris ton message…"
            className="w-full resize-none rounded-button border-[length:--border-width-ink] border-ink bg-surface-note px-4 py-3 font-body text-body text-ink caret-accent outline-accent outline-offset-2 placeholder:text-ink-hint focus-visible:outline-2"
          />
        </label>

        {/* — Copier = COMMIT MANUEL (FR-12). Bouton primaire chunky ; jamais d'auto-send.
            Désactivé si le champ est vide (rien à copier). — */}
        <div className="flex items-center justify-between gap-3">
          <span
            role="status"
            aria-live="polite"
            className="font-body text-label font-bold uppercase tracking-[0.12em] text-mint-deep"
          >
            {copied ? "Copié" : ""}
          </span>
          <button
            type="button"
            onClick={copier}
            disabled={text.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-button border-[length:--border-width-ink] border-ink bg-accent px-6 py-3 font-body text-button font-bold text-accent-on shadow-[var(--shadow-button-primary)] outline-accent outline-offset-2 focus-visible:outline-2 disabled:opacity-70"
          >
            <Icon name="copy" size={20} />
            Copier
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Coquille montée UNE fois dans le layout. La lecture du param `?compose=` vit sous
 * `<Suspense>` (exigence `useSearchParams`) ; `fallback={null}` = montage inerte tant
 * qu'aucun contact n'est ciblé.
 */
export function ComposerSheet() {
  return (
    <Suspense fallback={null}>
      <ComposerGate />
    </Suspense>
  );
}

export default ComposerSheet;
