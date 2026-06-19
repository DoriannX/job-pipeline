"use client";

// CopiloteSheet — première surface UI du copilote (incrément 2, CAP-1/2/3).
//
// POINT DE MONTAGE UNIQUE : monté UNE seule fois dans `(app)/layout.tsx`, à côté du
// ComposerSheet → présent sur les 3 onglets (Aujourd'hui · Réseau · Réglages) sans être
// un onglet (UX #1 « partout, jamais intrusif »). Icône flottante (mascotte plume) →
// popup chat. Conversation EN-SESSION seulement (aucune persistance — non-goal).
//
// FRONT « BÊTE » (brainstorm Archi #3) : ce composant POST vers `/api/agent/chat`, rend
// le flux, et applique le SIGNAL de sync. Zéro logique métier, zéro accès DB/scope tenant,
// la clé API ne le touche jamais (tout passe par `streamCopilote` → route serveur).
//
// CAP-2 (sync) : à la fin d'un tour, si le serveur signale `didWrite`, on appelle UN SEUL
// `router.refresh()` — exactement le levier des server actions (cf. ReseauClient). La page
// server-component relit `db.forUser` → la galerie reflète la mutation SANS reload.
// CAP-3 (erreur in-band) : une erreur mid-stream arrive comme une bulle d'erreur DOUCE
// (teinte de la famille, jamais rouge alarme), pas un flux tronqué pris pour un succès.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

import { Icon } from "@/design/icons";
import { BTN_PRIMARY } from "@/design/buttons";
import { Plume } from "@/design/illustration/Plume";
import { colors } from "@/design/tokens";

import { streamCopilote, type CopiloteTurn } from "./stream-client";

// Géométrie partagée icône ↔ panneau (la même boîte qui morphe). Largeur = pleine
// largeur mobile (marges 24px) plafonnée ; hauteur plafonnée → fenêtre de chat.
const PANEL_W = "min(calc(100vw - 3rem), 24rem)";
const PANEL_H = "min(70dvh, 34rem)";

// FSM minimale : au repos, ou un tour en cours (le champ se verrouille, plume « réfléchit »).
type Status = "idle" | "streaming";

// Un message affiché dans le chat. `kind` distingue la bulle d'erreur douce (CAP-3) des
// bulles de conversation. `pending` marque la bulle assistant qui reçoit le flux en direct.
type ChatItem =
  | { id: number; kind: "user"; content: string }
  | { id: number; kind: "assistant"; content: string; pending?: boolean }
  | { id: number; kind: "error"; content: string };

export function CopiloteSheet() {
  const router = useRouter();

  // Un SEUL élément `motion.div` (toujours monté) MORPHE entre l'icône et le panneau via
  // Motion `layout` (FLIP : Motion MESURE la boîte en pixels et anime par transform →
  // fluide, et compatible avec une largeur en `min()/calc()` qu'on ne pourrait pas
  // interpoler en brut). Pour obtenir un étirement SÉQUENTIEL (largeur PUIS hauteur, et
  // l'inverse à la fermeture) sans casser cette fluidité, on passe par un état à 3 phases :
  //   closed → wide → open   (ouverture)      open → wide → closed   (fermeture)
  // Chaque transition de phase est un FLIP `layout` autonome ; on enchaîne la 2ᵉ phase à la
  // fin de la 1ʳᵉ (`onLayoutAnimationComplete`).
  type Phase = "closed" | "wide" | "open";
  const [phase, setPhase] = useState<Phase>("closed");
  const [status, setStatus] = useState<Status>("idle");
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<ChatItem[]>([]);

  // Reduce Motion (plancher a11y, UX-DR4) : on coupe le ressort ET on saute la phase
  // intermédiaire (ouverture/fermeture nettes, instantanées).
  const reduceMotion = useReducedMotion();

  // Cap visé (la 2ᵉ phase enchaîne vers lui). Réf → pas de capture périmée dans le timer.
  const wantOpenRef = useRef(false);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Décalage entre les deux phases. PLUS COURT que le ressort (~0.32s) → la 2ᵉ phase
  // démarre AVANT que la 1ʳᵉ ait fini de rebondir → enchaînement continu, sans temps mort.
  const PHASE_GAP_MS = 140;

  // Enchaîne la 2ᵉ phase depuis l'intermédiaire `wide` vers le cap visé.
  const advancePhase = useCallback(() => {
    setPhase((p) => (p !== "wide" ? p : wantOpenRef.current ? "open" : "closed"));
  }, []);

  const openPanel = useCallback(() => {
    wantOpenRef.current = true;
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    if (reduceMotion) {
      setPhase("open");
      return;
    }
    setPhase("wide"); // phase 1 : largeur
    phaseTimerRef.current = setTimeout(advancePhase, PHASE_GAP_MS); // phase 2 : hauteur
  }, [reduceMotion, advancePhase]);
  const closePanel = useCallback(() => {
    wantOpenRef.current = false;
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    if (reduceMotion) {
      setPhase("closed");
      return;
    }
    setPhase("wide"); // phase 1 : hauteur retombe
    phaseTimerRef.current = setTimeout(advancePhase, PHASE_GAP_MS); // phase 2 : largeur
  }, [reduceMotion, advancePhase]);

  // États dérivés : `expanded` = au moins déplié (≠ icône) ; `isOpen` = pleinement ouvert.
  const expanded = phase !== "closed";
  const isOpen = phase === "open";

  // Identifiants stables et croissants (pas de Date.now/random → pas de souci d'hydratation).
  const nextId = useRef(1);
  const newId = () => nextId.current++;

  // Garde d'annulation : le démontage abandonne le flux en cours.
  const abortRef = useRef<AbortController | null>(null);
  // Garde de ré-entrance SYNCHRONE : `status` est une valeur de closure (mise à jour
  // asynchrone), donc deux `send()` dans le même tick la liraient tous deux à « idle ».
  // Ce drapeau bloque un second envoi (double-frappe Entrée) avant le re-render.
  const streamingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Nouvelle conversation : vide l'historique en-session (aucune persistance de toute façon),
  // coupe un flux en cours et réinitialise la saisie. Le popup reste ouvert.
  const newConversation = useCallback(() => {
    abortRef.current?.abort();
    streamingRef.current = false;
    setItems([]);
    setDraft("");
    setStatus("idle");
    inputRef.current?.focus();
  }, []);

  // Démontage : on coupe un flux éventuellement en cours + le timer de phase.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    };
  }, []);

  // Auto-défilement vers le bas à chaque nouveau contenu (réponse qui pousse).
  useEffect(() => {
    if (isOpen) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [items, isOpen]);

  // Focus du champ une fois PLEINEMENT ouvert.
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Fermeture clavier (Échap) — le flux en cours continue (réouvrir montre le résultat).
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded, closePanel]);

  const send = useCallback(() => {
    const content = draft.trim();
    // Garde SYNCHRONE de ré-entrance (cf. `streamingRef`) : bloque la double-frappe Entrée.
    if (content.length === 0 || streamingRef.current) return;
    streamingRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    const userItem: ChatItem = { id: newId(), kind: "user", content };
    const assistantId = newId();
    const assistantItem: ChatItem = {
      id: assistantId,
      kind: "assistant",
      content: "",
      pending: true,
    };

    // MONO-TOUR : on n'envoie QUE le message courant. Le serveur ne fait de toute façon
    // confiance qu'aux tours `user` (`selectTrustedTurns`, non négocié) et n'a aucune mémoire
    // serveur (non-goal). Renvoyer tous les anciens tours `user` (sans les réponses assistant
    // qui les "closent") faisait croire au modèle qu'ils étaient TOUS encore en attente → il
    // re-répondait aux précédents. Un seul tour `user` = il ne traite que la demande courante.
    // (Le vrai multi-tour avec contexte = incrément futur : historique signé côté serveur.)
    const history: CopiloteTurn[] = [{ role: "user", content }];

    setItems((prev) => [...prev, userItem, assistantItem]);
    setDraft("");
    setStatus("streaming");

    const finishTurn = () => {
      streamingRef.current = false;
      setStatus("idle");
    };

    void streamCopilote(
      history,
      {
        onDelta: (text) => {
          if (controller.signal.aborted) return;
          setItems((prev) =>
            prev.map((it) =>
              it.id === assistantId && it.kind === "assistant"
                ? { ...it, content: it.content + text }
                : it,
            ),
          );
        },
        onError: (message) => {
          if (controller.signal.aborted) return;
          // CAP-3 : on clôt la bulle assistant (en gardant un éventuel texte partiel
          // déjà streamé) et on pose une bulle d'erreur DOUCE à la suite — le tour est
          // clairement terminé sur une erreur, jamais figé sur une bulle tronquée.
          setItems((prev) => [
            ...prev.map((it) =>
              it.id === assistantId && it.kind === "assistant"
                ? { ...it, pending: false }
                : it,
            ),
            { id: newId(), kind: "error", content: message },
          ]);
          finishTurn();
        },
        onDone: () => {
          if (controller.signal.aborted) return;
          // Cas rare : aucun texte n'est revenu — bulle douce plutôt qu'un blanc muet.
          setItems((prev) =>
            prev.map((it) =>
              it.id === assistantId && it.kind === "assistant"
                ? {
                    ...it,
                    pending: false,
                    content:
                      it.content.length === 0
                        ? "(Aucune réponse cette fois. Réessaie ?)"
                        : it.content,
                  }
                : it,
            ),
          );
          finishTurn();
        },
        // CAP-2 : UN SEUL refresh, déclenché en fin de tour si le run a écrit (succès OU
        // erreur). La page server-component relit la vérité serveur → l'UI reflète la
        // mutation sans reload. `aborted` (démontage) ⇒ on ne touche plus au routeur.
        onWrite: () => {
          if (controller.signal.aborted) return;
          router.refresh();
        },
      },
      controller.signal,
    );
  }, [draft, router]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Entrée = envoyer ; Maj+Entrée = nouvelle ligne.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const streaming = status === "streaming";
  const sendDisabled = draft.trim().length === 0 || streaming;

  // Taille de la boîte PAR PHASE (Motion `layout` mesure ces px et anime le passage) :
  //   closed = icône (56px) · wide = pleine largeur, hauteur d'icône · open = pleine carte.
  const SIZE: Record<Phase, { width: string; height: string }> = {
    closed: { width: "3.5rem", height: "3.5rem" },
    wide: { width: PANEL_W, height: "3.5rem" },
    open: { width: PANEL_W, height: PANEL_H },
  };
  // Ressort « gluant » appliqué à CHAQUE FLIP de phase (rebond doux). Reduce Motion → net.
  const layoutTransition = reduceMotion
    ? { duration: 0 }
    : ({ type: "spring", visualDuration: 0.32, bounce: 0.32 } as const);
  // Mascotte : visible seulement à l'état `closed` (fond doux à l'étirement). Contenu :
  // visible seulement `open` ; il APPARAÎT en fondu court (après la 2ᵉ phase) et DISPARAÎT
  // NET (durée 0) → plus de flash du bouton Envoyer quand la boîte se replie sur son coin.
  const featherTransition = reduceMotion ? { duration: 0 } : { duration: 0.16 };
  const contentTransition = reduceMotion
    ? { duration: 0 }
    : isOpen
      ? { duration: 0.18, delay: 0.18 } // après que la hauteur se soit posée
      : { duration: 0 };

  return (
    <motion.div
      layout
      initial={false}
      transition={layoutTransition}
      onClick={expanded ? undefined : openPanel}
      onKeyDown={
        expanded
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openPanel();
              }
            }
      }
      role={expanded ? "dialog" : "button"}
      tabIndex={expanded ? -1 : 0}
      aria-label={expanded ? undefined : "Ouvrir le copilote"}
      aria-labelledby={expanded ? "copilote-title" : undefined}
      animate={{
        borderRadius: expanded ? 16 : 28,
        backgroundColor: expanded ? colors.surface.card : colors.accent,
      }}
      style={{
        position: "fixed",
        right: 24,
        bottom: 96,
        zIndex: 40,
        width: SIZE[phase].width,
        height: SIZE[phase].height,
        overflow: "hidden",
        // Valeur LITTÉRALE (depuis les tokens) et non `var(...)` : Motion ne sait corriger
        // la distorsion d'ombre pendant un `layout` que s'il peut PARSER la valeur. Sinon
        // l'ombre n'apparaît qu'à la fin + flicker entre phases. (= offsets.groupMint.)
        boxShadow: `5px 5px 0 0 ${colors.mint}`,
        cursor: expanded ? "default" : "pointer",
      }}
      className="border-[length:--border-width-ink] border-ink outline-accent outline-offset-2 focus-visible:outline-2"
    >
      {/* — Mascotte de l'icône (état fermé) : centrée, s'efface quand le panneau s'étire. — */}
      <motion.span
        aria-hidden
        animate={{ opacity: expanded ? 0 : 1 }}
        transition={featherTransition}
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <Plume name="feather" size={30} />
      </motion.span>

      {/* — Contenu du panneau (état ouvert), à la taille FINALE et épinglé bas-droite. Gated
          en opacité → jamais de demi-champ pendant l'étirement. `inert` tant que pas ouvert
          → invisible ET non focusable au clavier. — */}
      <motion.div
        animate={{ opacity: isOpen ? 1 : 0 }}
        transition={contentTransition}
        style={{ width: PANEL_W, height: PANEL_H }}
        className="absolute bottom-0 right-0 flex flex-col"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
            {/* — En-tête : mascotte + titre + fermeture. — */}
            <header className="flex items-center justify-between gap-3 px-margin-mobile pb-3 pt-4">
              <div className="flex items-center gap-3">
                <Plume name="feather" size={28} />
                <div className="flex flex-col">
                  <h2
                    id="copilote-title"
                    className="font-display text-display-title font-semibold leading-none tracking-[-0.01em] text-ink"
                  >
                    Copilote
                  </h2>
                  <span className="font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft">
                    Ton assistant prospection
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {/* Nouvelle conversation : vide l'historique (visible seulement s'il y en a). */}
                {items.length > 0 ? (
                  <button
                    type="button"
                    onClick={newConversation}
                    aria-label="Nouvelle conversation"
                    title="Nouvelle conversation"
                    className="rounded-button p-2 text-ink-soft outline-accent outline-offset-2 focus-visible:outline-2"
                  >
                    <Icon name="edit" size={20} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={closePanel}
                  aria-label="Fermer"
                  className="rounded-button p-2 text-ink-soft outline-accent outline-offset-2 focus-visible:outline-2"
                >
                  <Icon name="arrow-down" size={22} />
                </button>
              </div>
            </header>

            {/* — Fil de la conversation (scrollable). — */}
            <div
              ref={scrollRef}
              className="flex flex-1 flex-col gap-3 overflow-y-auto px-margin-mobile py-3"
            >
              {items.length === 0 ? (
                <p className="m-auto max-w-[18rem] text-center font-body text-body text-ink-soft">
                  Demande-moi de compter tes contacts, ou d&apos;en créer pour
                  essayer l&apos;app.
                </p>
              ) : (
                items
                  // La bulle assistant en attente (vide) n'apparaît pas : son état est
                  // porté par la ligne « La plume réfléchit… » ci-dessous (pas de boîte vide).
                  .filter(
                    (it) => !(it.kind === "assistant" && it.content.length === 0),
                  )
                  .map((it) => <Bubble key={it.id} item={it} />)
              )}

              {/* Ligne d'attente DOUCE (jamais un spinner) tant qu'aucun delta n'arrive. */}
              {streaming &&
              items.some((it) => it.kind === "assistant" && it.content.length === 0) ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-2 font-body text-label font-bold uppercase tracking-[0.12em] text-mint-deep"
                >
                  <Plume name="feather" size={28} className="plume-ecrit" />
                  La plume réfléchit…
                </p>
              ) : null}
            </div>

            {/* — Saisie + envoi (mauve = action). — */}
            <div className="flex items-end gap-2 border-t-[length:--border-width-ink] border-line px-margin-mobile pb-6 pt-3">
              <label className="flex flex-1 flex-col">
                <span className="sr-only">Message au copilote</span>
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={2}
                  placeholder="Écris ta demande…"
                  className="w-full resize-none rounded-button border-[length:--border-width-ink] border-ink bg-surface-note px-4 py-3 font-body text-body text-ink caret-accent outline-accent outline-offset-2 placeholder:text-ink-hint focus-visible:outline-2"
                />
              </label>
              <button
                type="button"
                onClick={send}
                disabled={sendDisabled}
                aria-label="Envoyer"
                className={BTN_PRIMARY}
              >
                <Icon name="arrow-up" size={20} />
              </button>
            </div>
      </motion.div>
    </motion.div>
  );
}

/** Une bulle du fil. Assistant à gauche (mascotte), user à droite, erreur DOUCE pleine largeur. */
function Bubble({ item }: { item: ChatItem }) {
  if (item.kind === "error") {
    // CAP-3 : erreur en teinte DOUCE de la famille (jamais rouge alarme), bien terminale.
    return (
      <p
        role="status"
        aria-live="polite"
        className="rounded-button border-[length:--border-width-ink] border-line bg-surface-note px-4 py-2 font-body text-label text-ink-soft"
      >
        {item.content}
      </p>
    );
  }

  if (item.kind === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] whitespace-pre-wrap rounded-button border-[length:--border-width-ink] border-line bg-surface-chip px-4 py-2 font-body text-body text-ink">
          {item.content}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <Plume name="feather" size={24} className="mt-1 shrink-0" />
      <p className="max-w-[80%] whitespace-pre-wrap rounded-button border-[length:--border-width-ink] border-line bg-surface-note px-4 py-2 font-body text-body text-ink">
        {item.content}
      </p>
    </div>
  );
}

export default CopiloteSheet;
