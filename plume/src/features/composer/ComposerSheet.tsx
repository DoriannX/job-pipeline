"use client";

// ComposerSheet — bottom-sheet du Composeur (stories 3.1 + 3.3 + 3.4).
//
// POINT DE MONTAGE UNIQUE : ce composant est monté UNE seule fois dans `(app)/layout.tsx`,
// au-dessus des routes (jamais un onglet — overlay « en flow », FR-13). Il s'OUVRE quand
// l'URL porte `?compose=<contactId>` ; absent ⇒ il ne rend rien (point de montage inerte).
// Fermer = retirer ce seul param (en préservant les autres).
//
// PÉRIMÈTRE 3.1 (acquis) : champ unique (source de vérité) + sélecteur 4 canaux + segment
// Rapide/Soigné + brouillon immortel + Copier (commit MANUEL).
// PÉRIMÈTRE 3.3 (ajouté) : bouton GÉNÉRER → `POST /api/composer` en streaming, deltas
// appendus dans le champ en direct, remplacement par le texte sanitizé final, FSM
// `idle|generating|ok|error|offline` (plume « écrit », Reduce Motion respecté, spinner
// INTERDIT, timeout doux 5 s), régénérer, pill de tokens (tappable), micro-ligne de
// transparence API one-time, registre par défaut persistant.
// PÉRIMÈTRE 3.4 (ajouté) : bouton intelligent « Améliorer » câblé (mode `improve`, même
// flux/FSM que Générer — seule l'instruction du prompt change côté serveur) ; UNDO d'un
// niveau (snapshot du texte d'avant + « Annuler l'amélioration »). Pas de « Envoyé » (3.6).
//
// La clé Claude reste server-only : ce composant ne fait que `fetch("/api/composer")`.

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Icon, type IconName } from "@/design/icons";
import { BTN_ICON, BTN_PRIMARY } from "@/design/buttons";
import { Plume } from "@/design/illustration/Plume";
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
import {
  ideaRequired,
  type GenerationEvent,
  type GenerationMode,
  type Tone,
} from "./generation";
import { streamGeneration } from "./stream-client";
import {
  getDefaultTone,
  hasSeenApiNotice,
  markApiNoticeSeen,
  setDefaultTone,
} from "./prefs";

const COMPOSE_PARAM = "compose";

// FSM du Composeur (archi l.292) : un seul état à la fois, jamais de spinner infini.
type ComposerState = "idle" | "generating" | "ok" | "error" | "offline";

// Premier token perçu < 5 s (NFR-1) : au-delà sans 1er delta, on bascule sur un message
// doux (jamais une attente muette). 5 000 ms = la borne UX-DR15.
const FIRST_TOKEN_TIMEOUT_MS = 5000;

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

// Segment de registre. Les alias Haiku/Opus restent des indices VISUELS discrets ; en 3.3
// ils pilotent RÉELLEMENT le choix de modèle côté serveur (Rapide→Haiku, Soigné→Opus).
const TONES: { value: Tone; label: string; alias: string }[] = [
  { value: "rapide", label: "Rapide", alias: "Haiku" },
  { value: "soigne", label: "Soigné", alias: "Opus" },
];

// Boutons d'action du composeur — primitives partagées (`@/design/buttons`) pour garder
// UNE seule ligne (vérifié mobile 375px) et éviter de re-typer/diverger les chaînes :
//   - secondaires = boutons-ICÔNES carrés (libellé porté par aria-label/tooltip) ;
//   - primaire = chunky mauve avec `whitespace-nowrap` (libellé jamais coupé ni wrappé).
const ICON_BTN = BTN_ICON;
const PRIMARY_BTN = BTN_PRIMARY;

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

  // — Champ unique (SOURCE DE VÉRITÉ) + canal + registre. —
  const [text, setText] = useState("");
  const [canal, setCanal] = useState<Canal>("linkedin");
  const [tone, setTone] = useState<Tone>("rapide");

  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  // Envoi en cours (Marquer Envoyé) : verrouille le bouton le temps de l'écriture moat.
  const [sending, setSending] = useState(false);

  // — État 3.3 : FSM + flux + résultat + transparence + détail tokens. —
  const [state, setState] = useState<ComposerState>("idle");
  const [softError, setSoftError] = useState<string | null>(null);
  // UNDO d'amélioration (AR-12, story 3.4) : snapshot du texte AVANT qu'« Améliorer »
  // ne le remplace. `null` ⇒ pas d'undo disponible. Un SEUL niveau d'undo. On le vide
  // dès qu'il devient caduc : fermeture/changement de contact (remontage via `key`),
  // nouvelle frappe manuelle, génération, ou nouvelle amélioration.
  const [undoSnapshot, setUndoSnapshot] = useState<string | null>(null);
  // GenerationEvent du dernier flux réussi — CONSERVÉ pour l'envoi (story 3.6).
  const [lastEvent, setLastEvent] = useState<GenerationEvent | null>(null);
  const [showApiNotice, setShowApiNotice] = useState(false);
  const [showTokenDetail, setShowTokenDetail] = useState(false);
  // État réseau réactif : Générer se re-grise tout seul si on passe hors-ligne, même
  // feuille ouverte et inerte (FR-7/UX-DR14). Init = état courant côté navigateur.
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Garde d'annulation (régénérer/fermeture) : ignore le flux abandonné.
  const abortRef = useRef<AbortController | null>(null);
  // Timer du timeout doux 1er token.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // — Restauration À L'OUVERTURE : contexte serveur + brouillon local en parallèle. —
  // Le brouillon par-contact a la priorité (texte/canal/tone). Sinon : canal = canal
  // préféré du contact ; tone = DÉFAUT GLOBAL persistant (localStorage), pas « rapide » dur.
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
      } else {
        if (ctx?.canalPrefere) setCanal(ctx.canalPrefere);
        setTone(getDefaultTone());
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

  // — BROUILLON IMMORTEL : à chaque changement (frappe, canal, tone), on persiste AVANT
  // tout réseau. Champ VIDE ⇒ on efface le brouillon (pas de fantôme). —
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
      tone,
      updatedAt: Date.now(),
    });
  }, [hydrated, contactId, text, canal, tone]);

  // Nettoyage : à la fermeture/démontage, on annule un flux en cours et le timer.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Réactivité réseau : on suit online/offline pour re-griser Générer sans attendre un clic.
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  // Fermeture = retirer le SEUL param `compose`, en préservant les autres.
  const close = useCallback(() => {
    abortRef.current?.abort();
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

  // Changement de registre : met à jour l'état ET le défaut global persistant (FR-14).
  function changerTone(value: Tone) {
    setTone(value);
    setDefaultTone(value);
  }

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
  // n'envoie RIEN à un canal externe : on ENREGISTRE le Message (texte FIGÉ courant) +
  // on instrumente le moat dans UNE transaction serveur (atomique). Le `lastEvent` (le
  // GenerationEvent du dernier flux) est passé s'il existe, sinon `null` (texte tapé main).
  // À succès : on efface le brouillon (immortel jusqu'ici), on ferme le composeur, et on
  // laisse la fiche se rafraîchir (revalidatePath côté action). Échec = doux, champ gardé.
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
        event: lastEvent ?? null,
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

  // — FLUX EN PLACE (cœur 3.3, factorisé pour 3.4). Le champ reste la SOURCE DE VÉRITÉ :
  // on y APPEND les deltas en direct, puis on REMPLACE par le texte sanitizé final. Toute
  // erreur = message doux + restauration du texte d'entrée (AUCUNE saisie perdue, FR-7).
  // Hors-ligne = on ne lance même pas (boutons grisés). Le `mode` choisit la recette :
  //   - `generate` : `text` = idée brute à mettre en forme (Générer/Régénérer) ;
  //   - `improve`  : `text` = message à retravailler en place (Améliorer), avec UNDO. —
  const runStream = useCallback(
    (mode: GenerationMode) => {
      if (!online) {
        setState("offline");
        setSoftError(
          mode === "improve"
            ? "Tu es hors-ligne : l'amélioration reprendra dès le retour du réseau. Ton texte reste éditable."
            : "Tu es hors-ligne : la génération reprendra dès le retour du réseau. Ton texte reste éditable.",
        );
        return;
      }
      // AMÉLIORER exige un texte ; GÉNÉRER accepte un champ vide (brouillon de prise de
      // contact). Règle partagée client/serveur via `ideaRequired` (une seule source).
      if (ideaRequired(mode) && text.trim().length === 0) return;

      // Transparence API one-time (FR-32) : à la 1re sollicitation de l'API seulement
      // (génération OU amélioration — même point de contact).
      if (!hasSeenApiNotice()) {
        setShowApiNotice(true);
        markApiNoticeSeen();
      }

      // Annule un éventuel flux précédent (régénérer/réaméliorer).
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // UNDO (AR-12) : en mode `improve`, on SNAPSHOTE le texte d'AVANT amélioration —
      // mais on GARDE le snapshot le PLUS ANCIEN d'une CHAÎNE d'améliorations (prev ??
      // input). Ainsi « Annuler l'amélioration » revient à la version ORIGINALE (celle
      // d'avant la 1ʳᵉ amélioration), pas seulement à l'avant-dernière. Le snapshot est
      // remis à zéro par une frappe manuelle, une génération, ou l'annulation elle-même.
      // En mode `generate`, pas d'undo d'amélioration : on purge un snapshot caduc.
      const input = text;
      setUndoSnapshot((prev) => (mode === "improve" ? prev ?? input : null));

      setState("generating");
      setSoftError(null);
      setShowTokenDetail(false);
      setLastEvent(null);

      // Le champ devient le réceptacle du flux : on le vide pour accueillir les deltas.
      setText("");

      // Timeout DOUX 1er token : si rien n'arrive sous 5 s, message doux (pas d'annulation
      // du flux — il peut encore aboutir ; on prévient juste l'attente muette).
      timeoutRef.current = setTimeout(() => {
        setSoftError(
          "C'est un peu long… la plume réfléchit. Tu peux patienter ou réessayer.",
        );
      }, FIRST_TOKEN_TIMEOUT_MS);

      const clearTimer = () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };

      void streamGeneration(
        // `contactId` (story 3.10) : le serveur charge le contact (scopé) et injecte son
        // historique au prompt pour écrire en continuité. Le contact est déjà en contexte UI.
        { idea: input, canal, tone, mode, contactId },
        {
          onFirstDelta: () => {
            clearTimer();
            setSoftError(null);
          },
          onDelta: (delta) => {
            if (controller.signal.aborted) return;
            setText((prev) => prev + delta);
          },
          onDone: ({ text: finalText, event }) => {
            if (controller.signal.aborted) return;
            clearTimer();
            // Cas rare : rien d'exploitable n'est revenu (vide après sanitize). On ne
            // laisse pas un cul-de-sac muet : message doux + texte d'entrée restauré (FR-7).
            // L'undo devient caduc (le texte d'avant est déjà de retour dans le champ).
            if (finalText.trim().length === 0) {
              setText(input);
              setUndoSnapshot(null);
              setSoftError("Rien n'est revenu cette fois. Réessaie ?");
              setState("error");
              return;
            }
            // REMPLACEMENT par le texte sanitizé final (le champ redevient autoritaire).
            setText(finalText);
            setLastEvent(event);
            setState("ok");
          },
          onError: (message) => {
            if (controller.signal.aborted) return;
            clearTimer();
            // Échec doux : on restaure le texte d'entrée (AUCUNE saisie perdue, FR-7).
            // L'undo devient caduc (rien n'a remplacé le texte).
            setText((prev) => (prev.length === 0 ? input : prev));
            setUndoSnapshot(null);
            setSoftError(message);
            setState("error");
          },
        },
        controller.signal,
      );
    },
    [text, canal, tone, online, contactId],
  );

  // Générer / Régénérer (story 3.3) et Améliorer (story 3.4) : même flux, mode distinct.
  const generer = useCallback(() => runStream("generate"), [runStream]);
  const ameliorer = useCallback(() => runStream("improve"), [runStream]);

  // UNDO d'amélioration (AR-12) : restaure EXACTEMENT le texte d'avant l'amélioration,
  // puis retire l'offre d'undo (un seul niveau). On repasse en `idle` : le résultat
  // restauré reste éditable, mais ce n'est plus « un texte fraîchement amélioré ».
  const annulerAmelioration = useCallback(() => {
    if (undoSnapshot === null) return;
    abortRef.current?.abort();
    setText(undoSnapshot);
    setUndoSnapshot(null);
    setLastEvent(null);
    setShowTokenDetail(false);
    setSoftError(null);
    setState("idle");
  }, [undoSnapshot]);

  // Frappe MANUELLE dans le champ : invalide l'undo (le texte d'avant n'est plus le bon
  // point de retour dès que l'utilisateur édite). Les deltas du flux passent par
  // `setText` directement (pas par ce handler), donc le snapshot survit au streaming.
  const onTextChange = useCallback((value: string) => {
    setText(value);
    setUndoSnapshot(null);
  }, []);

  const nom = context?.nom ?? "ce contact";
  const generating = state === "generating";
  const champVide = text.trim().length === 0;
  // GÉNÉRER : autorisé même CHAMP VIDE (produit un brouillon de prise de contact dans la
  // voix). Grisé seulement pendant un flux ou hors-ligne. (Champ vide ≠ blocage.)
  const generateDisabled = generating || !online;
  // AMÉLIORER : besoin d'un texte à retravailler — grisé si le champ est vide (en plus
  // des gardes flux/hors-ligne). C'est la SEULE différence avec Générer.
  const improveDisabled = generating || champVide || !online;
  // Pill de tokens : visible après une génération réussie (état ok + event).
  const showTokenPill = state === "ok" && lastEvent !== null && !champVide;
  // LAYOUT TOUT-FIXE (choix utilisateur) : « Générer » est le primaire à droite, STATIQUE
  // (ne bouge jamais, ne se transforme jamais). Les actions secondaires — Améliorer, Copier,
  // Marquer Envoyé — sont des icônes FIXES à gauche, simplement activées/grisées. « Marquer
  // Envoyé » est dispo dès que le champ est non vide ⇒ un message TAPÉ MAIN est envoyable
  // directement, sans passer par une génération.
  const sendDisabled = champVide || sending;
  // Offre d'undo : un snapshot existe et aucun flux n'est en cours.
  const canUndo = undoSnapshot !== null && !generating;

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

        {/* — Segment Rapide / Soigné : choix persistant (défaut global). — */}
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
                  onClick={() => changerTone(value)}
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

        {/* — CHAMP UNIQUE (source de vérité). Pendant la génération, la plume « écrit »
            en superposition douce (jamais de spinner) ; le champ reste éditable. — */}
        <label className="relative flex flex-col gap-2">
          <span className="sr-only">Message</span>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            rows={7}
            // VERROU pendant la génération (item retour 2026) : le champ devient
            // read-only le temps du flux — le texte streame, l'utilisateur n'écrase pas
            // les deltas par accident. Il redevient éditable dès la fin (ok/erreur).
            readOnly={generating}
            aria-busy={generating}
            placeholder="Écris ton idée, ou touche Générer…"
            className={`w-full resize-none rounded-button border-[length:--border-width-ink] border-ink bg-surface-note px-4 py-3 font-body text-body text-ink caret-accent outline-accent outline-offset-2 placeholder:text-ink-hint focus-visible:outline-2 ${
              generating ? "cursor-not-allowed opacity-90" : ""
            }`}
          />
          {generating ? (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute right-3 top-3 flex items-center gap-2"
            >
              {/* « La plume écrit » : animation douce, neutralisée par Reduce Motion. */}
              <Plume name="feather" size={40} className="plume-ecrit" />
              <span className="sr-only">La plume écrit ton message…</span>
            </div>
          ) : null}
        </label>

        {/* Message VISIBLE de génération en cours (verrou du champ). Doux, pas un spinner. */}
        {generating ? (
          <p className="font-body text-label font-bold uppercase tracking-[0.12em] text-mint-deep">
            La plume écrit ton message…
          </p>
        ) : null}

        {/* — Micro-ligne de transparence API one-time (FR-32, UX-DR21). Quand le contact a
            un historique (story 3.10), on EXPLICITE qu'il fait partie du contexte envoyé à
            Claude (extension FR-32, AC 4) — sinon, la formulation 3.3 d'origine est gardée. — */}
        {showApiNotice ? (
          <p className="font-body text-label text-ink-hint">
            {context?.hasHistorique
              ? "Pour générer, ton texte et l’historique de ce contact sont envoyés à l’API Claude."
              : "Pour générer, ton texte est envoyé à l’API Claude."}
          </p>
        ) : null}

        {/* — Bandeau d'erreur / hors-ligne DOUX (jamais rouge alarme). Le champ reste
            éditable, aucune saisie perdue (UX-DR14). — */}
        {softError ? (
          <p
            role="status"
            aria-live="polite"
            className="rounded-button border-[length:--border-width-ink] border-line bg-surface-note px-4 py-2 font-body text-label text-ink-soft"
          >
            {softError}
          </p>
        ) : null}

        {/* — Pill de TOKENS (tappable → détail input/output). Apparaît après succès. — */}
        {showTokenPill && lastEvent ? (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setShowTokenDetail((v) => !v)}
              aria-expanded={showTokenDetail}
              className="inline-flex w-fit items-center gap-1.5 rounded-button border-[length:--border-width-ink] border-line bg-surface-chip px-3 py-1 font-body text-label font-bold text-ink-soft outline-accent outline-offset-2 focus-visible:outline-2"
            >
              <Icon name="sparkle" size={16} />
              {lastEvent.tokens.input + lastEvent.tokens.output} tokens
            </button>
            {showTokenDetail ? (
              <p className="font-body text-label text-ink-hint">
                Entrée : {lastEvent.tokens.input} · Sortie :{" "}
                {lastEvent.tokens.output} · Modèle : {lastEvent.tone === "rapide"
                  ? "Rapide"
                  : "Soigné"}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* — ACTIONS. Avant génération : Générer (primaire). Après succès : Copier +
            Améliorer (câblé, mode `improve`) + Régénérer. — */}
        <div className="flex flex-col gap-3">
          <span
            role="status"
            aria-live="polite"
            className="font-body text-label font-bold uppercase tracking-[0.12em] text-mint-deep"
          >
            {copied ? "Copié" : ""}
          </span>

          {/* — UNDO d'amélioration (AR-12) : un seul niveau, restaure le texte d'avant.
              Visible dès qu'un snapshot existe (post-amélioration), hors flux. — */}
          {canUndo ? (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={annulerAmelioration}
                className="inline-flex items-center gap-2 rounded-button border-[length:--border-width-ink] border-line bg-surface-card px-4 py-2 font-body text-label font-bold text-ink-soft outline-accent outline-offset-2 focus-visible:outline-2"
              >
                <Icon name="arrow-down" size={16} />
                Annuler l&apos;amélioration
              </button>
            </div>
          ) : null}

          {/* LAYOUT TOUT-FIXE (choix utilisateur) : 3 icônes secondaires à gauche (ordre
              fixe : Améliorer · Copier · Marquer Envoyé), grisées tant qu'elles ne servent
              à rien ; « Générer » primaire à droite, STATIQUE. Rien ne bouge ni ne se
              transforme. « Marquer Envoyé » dispo dès qu'il y a du texte ⇒ tap-main envoyable. */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {/* Améliorer : retravaille le texte courant en place (story 3.4). */}
              <IconAction
                icon="double-sparkle"
                label="Améliorer"
                onClick={ameliorer}
                disabled={improveDisabled}
              />
              {/* Copier = commit presse-papier (FR-21). */}
              <IconAction
                icon="copy"
                label="Copier"
                onClick={copier}
                disabled={champVide}
              />
              {/* Marquer Envoyé : commit FINAL (FR-21/FR-18). Dispo dès que le champ est non
                  vide — un message tapé main est envoyable sans génération préalable. */}
              <IconAction
                icon="check"
                label="Marquer envoyé"
                onClick={marquerEnvoye}
                disabled={sendDisabled}
              />
            </div>
            {/* Générer : primaire STATIQUE. Grisé pendant flux / champ vide / hors-ligne. Le
                feedback « en cours » est porté par le verrou du champ + la ligne
                « La plume écrit ton message… » (libellé et largeur stables). */}
            <button
              type="button"
              onClick={generer}
              disabled={generateDisabled}
              className={PRIMARY_BTN}
            >
              <Icon name="sparkle" size={20} />
              Générer
            </button>
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
