"use client";

// ComposerSheet — bottom-sheet du Composeur MANUEL (stories 3.1 + 3.6 ; pivot 7.2).
//
// POINT DE MONTAGE UNIQUE : ce composant est monté UNE seule fois dans `(app)/layout.tsx`,
// au-dessus des routes (jamais un onglet — overlay « en flow », FR-13). Il s'OUVRE quand
// l'URL porte `?compose=<contactId>` ; absent ⇒ il ne rend rien (point de montage inerte).
// Fermer = retirer ce seul param (en préservant les autres).
//
// PIVOT 7.2 (app = manuel, copilote = IA) : la génération one-shot du composeur est
// DÉPRÉCIÉE. Toute l'IA vit désormais dans le copilote (« Écrire avec l'IA » sur la fiche).
// Le composeur ne porte plus QUE la rédaction MANUELLE. Sont retirés : boutons Générer /
// Améliorer, pill de tokens, Annuler l'amélioration, micro-ligne de transparence API,
// message « La plume écrit », segment Rapide/Soigné (= choix de modèle IA), verrou du
// champ pendant le flux, et tout le code de streaming associé (`/api/composer`, FSM, undo).
//
// PÉRIMÈTRE CONSERVÉ : champ unique (source de vérité), sélecteur 4 canaux, brouillon
// immortel (getDraft/saveDraft/deleteDraft), contexte Contact ancré (« Écrire à [nom] »),
// Copier (commit MANUEL), Marquer Envoyé (un message tapé main n'a pas de `generation_event`
// → `event: null`), fermeture. AUCUN envoi automatique (FR-21 : l'envoi reste humain).

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Icon, type IconName } from "@/design/icons";
import { BTN_ICON } from "@/design/buttons";
import { CANAUX, type Canal } from "@/lib/domain/enums";
import {
  deleteDraft,
  getDraft,
  saveDraft,
} from "@/lib/offline/localStore";

import { markSentAction } from "@/features/messages/send";

import {
  loadComposerContextAction,
  type ComposerContext,
} from "./actions";

const COMPOSE_PARAM = "compose";

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

// Boutons d'action SECONDAIRES en icône — primitive partagée (`@/design/buttons`).
const ICON_BTN = BTN_ICON;

/**
 * Bouton d'action SECONDAIRE en icône + TOOLTIP au survol/focus clavier (a11y).
 * Le libellé est porté par `aria-label` (lecteur d'écran) ET une bulle visible au hover
 * et au focus. Bulle = encre pleine, offset net (flou=0, règle DA), neutralisée par
 * Reduce Motion. Position FIXE dans la barre d'actions (le layout ne saute jamais).
 */
function IconAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={ICON_BTN}
      >
        <Icon name={icon} size={20} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border-[length:--border-width-ink] border-ink bg-ink px-2 py-1 font-body text-label font-bold text-surface-card opacity-0 shadow-[var(--shadow-button-secondary)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
      >
        {label}
      </span>
    </span>
  );
}

/**
 * Lecture du param `?compose=` sous Suspense (exigence `useSearchParams`). Quand il est
 * présent → on monte la feuille pour ce contact ; sinon → rien (montage inerte).
 */
function ComposerGate() {
  const searchParams = useSearchParams();
  const contactId = searchParams.get(COMPOSE_PARAM);

  if (!contactId) return null;

  // `key` force un remontage propre quand on passe d'un contact à l'autre.
  return <ComposerSheetPanel key={contactId} contactId={contactId} />;
}

interface ComposerSheetPanelProps {
  contactId: string;
}

function ComposerSheetPanel({ contactId }: ComposerSheetPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [context, setContext] = useState<ComposerContext | null>(null);

  // — Champ unique (SOURCE DE VÉRITÉ) + canal. —
  const [text, setText] = useState("");
  const [canal, setCanal] = useState<Canal>("linkedin");

  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  // Envoi en cours (Marquer Envoyé) : verrouille le bouton le temps de l'écriture serveur.
  const [sending, setSending] = useState(false);
  // Échec doux du « Marquer Envoyé » (jamais rouge alarme) — le champ reste éditable.
  const [softError, setSoftError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // — Restauration À L'OUVERTURE : contexte serveur + brouillon local en parallèle. —
  // Le brouillon par-contact a la priorité (texte/canal). Sinon : canal = canal préféré
  // du contact. (Le registre Rapide/Soigné = concept IA, retiré du composeur en 7.2.)
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
      } else if (ctx?.canalPrefere) {
        setCanal(ctx.canalPrefere);
      }
      setHydrated(true);
    }

    void restaurer();
    return () => {
      actif = false;
    };
  }, [contactId]);

  // Focus initial : le champ unique reçoit le curseur dès l'ouverture.
  useEffect(() => {
    if (hydrated) textareaRef.current?.focus();
  }, [hydrated]);

  // — BROUILLON IMMORTEL : à chaque changement (frappe, canal), on persiste AVANT toute
  // autre chose. Champ VIDE ⇒ on efface le brouillon (pas de fantôme). Le `tone` n'est
  // plus pertinent (manuel-only) ; on conserve la valeur par défaut du store pour ne pas
  // casser la forme du brouillon partagée avec d'autres lectures. —
  useEffect(() => {
    if (!hydrated) return;
    if (text.trim().length === 0) {
      void deleteDraft(contactId);
      return;
    }
    void saveDraft({
      key: contactId,
      text,
      canal,
      tone: "rapide",
      updatedAt: Date.now(),
    });
  }, [hydrated, contactId, text, canal]);

  // Fermeture = retirer le SEUL param `compose`, en préservant les autres.
  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(COMPOSE_PARAM);
    const query = params.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
  }, [router, searchParams]);

  // Fermeture clavier (Échap).
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
      // Clipboard indisponible : on reste silencieux et doux (le texte demeure éditable).
    }
  }

  // Marquer Envoyé (FR-21/FR-18 « Copier PUIS Marquer Envoyé », tous canaux). On
  // n'envoie RIEN à un canal externe : on ENREGISTRE le Message (texte FIGÉ courant) dans
  // UNE transaction serveur (atomique). En composeur MANUEL-only, le message est toujours
  // tapé main → AUCUN `generation_event` (`event: null`). À succès : on efface le brouillon
  // (immortel jusqu'ici), on ferme le composeur, et on laisse la fiche se rafraîchir
  // (revalidatePath côté action). Échec = doux, champ gardé.
  async function marquerEnvoye() {
    if (sending) return;
    if (text.trim().length === 0) return;

    setSending(true);
    setSoftError(null);
    try {
      const result = await markSentAction({
        contactId,
        texte: text,
        canal,
        event: null,
      });
      if (!result.ok) {
        // Échec doux : message lisible, le texte reste éditable (aucune saisie perdue).
        setSoftError(result.error);
        setSending(false);
        return;
      }
      // Succès : le brouillon a vécu, on l'efface (plus de fantôme), puis on ferme.
      await deleteDraft(contactId).catch(() => {});
      close();
    } catch {
      setSoftError("L'enregistrement a échoué. Réessaie dans un instant.");
      setSending(false);
    }
  }

  const nom = context?.nom ?? "ce contact";
  const champVide = text.trim().length === 0;
  // « Marquer Envoyé » est dispo dès que le champ est non vide ⇒ un message TAPÉ MAIN est
  // envoyable directement (c'est le seul chemin d'envoi du composeur manuel).
  const sendDisabled = champVide || sending;

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

      <div
        ref={dialogRef}
        className="relative mt-auto flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-sheet border-[length:--border-width-ink] border-ink bg-surface-card px-margin-mobile pb-8 pt-3 shadow-[var(--shadow-sheet-top)]"
      >
        {/* Poignée grab. */}
        <div
          aria-hidden="true"
          className="mx-auto h-1.5 w-12 rounded-full bg-line"
        />

        {/* — Contexte Contact ANCRÉ au-dessus (FR-13). — */}
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

        {/* — Sélecteur 4 canaux (FR-2). — */}
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

        {/* — CHAMP UNIQUE (source de vérité). Saisie MANUELLE pure : pas de génération. — */}
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

        {/* — Bandeau d'erreur DOUX (jamais rouge alarme). Le champ reste éditable,
            aucune saisie perdue (UX-DR14). — */}
        {softError ? (
          <p
            role="status"
            aria-live="polite"
            className="rounded-button border-[length:--border-width-ink] border-line bg-surface-note px-4 py-2 font-body text-label text-ink-soft"
          >
            {softError}
          </p>
        ) : null}

        {/* — ACTIONS (manuel-only) : Copier + Marquer Envoyé. Aucune affordance IA. — */}
        <div className="flex flex-col gap-3">
          <span
            role="status"
            aria-live="polite"
            className="font-body text-label font-bold uppercase tracking-[0.12em] text-mint-deep"
          >
            {copied ? "Copié" : ""}
          </span>

          <div className="flex items-center justify-end gap-2">
            {/* Copier = commit presse-papier (FR-21). */}
            <IconAction
              icon="copy"
              label="Copier"
              onClick={copier}
              disabled={champVide}
            />
            {/* Marquer Envoyé : commit FINAL (FR-21/FR-18). Dispo dès que le champ est non
                vide — un message tapé main est envoyable directement. */}
            <IconAction
              icon="check"
              label="Marquer envoyé"
              onClick={marquerEnvoye}
              disabled={sendDisabled}
            />
          </div>
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
