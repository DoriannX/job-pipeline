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
import { rewindTurnAction } from "./rewind.actions";
import { CopiloteMarkdown } from "./CopiloteMarkdown";

// Libellés FR des outils, affichés en petit (façon Claude) quand l'agent agit. Le front
// montre le NOM lisible, jamais les arguments (il reste « bête »). Un tool inconnu retombe
// sur son nom technique.
const TOOL_LABELS: Record<string, string> = {
  queryContacts: "Recherche dans le réseau",
  createContact: "Ajout d'un contact",
  importContacts: "Import de contacts",
  composeMessage: "Rédaction d'un brouillon",
  seedContacts: "Création de contacts de test",
};

// Géométrie partagée icône ↔ panneau (la même boîte qui morphe). Largeur = pleine
// largeur mobile (marges 24px) plafonnée ; hauteur plafonnée → fenêtre de chat.
const PANEL_W = "min(calc(100vw - 3rem), 24rem)";
const PANEL_H = "min(70dvh, 34rem)";

// FSM minimale : au repos, ou un tour en cours (le champ se verrouille, plume « réfléchit »).
type Status = "idle" | "streaming";

// Un message affiché dans le chat. `kind` distingue la bulle d'erreur douce (CAP-3) des
// bulles de conversation. `pending` marque la bulle assistant qui reçoit le flux en direct.
type ToolStatus = "running" | "done" | "error";
// État de l'affordance de rewind (inc.4) : au repos, en cours, annulé, RIEN à annuler (no-op
// honnête — ex. un write-tool qui a échoué/n'a rien commis, ou un tour déjà annulé), ou échec.
type RewindStatus = "idle" | "running" | "done" | "noop" | "error";
type ChatItem =
  | { id: number; kind: "user"; content: string }
  | { id: number; kind: "assistant"; content: string; pending?: boolean }
  | { id: number; kind: "error"; content: string }
  // Chip d'outil (façon Claude) : `toolCallId` corrèle début ↔ fin du flux.
  | { id: number; kind: "tool"; toolCallId: string; name: string; status: ToolStatus }
  // Affordance de REWIND (inc.4) : posée en fin d'un tour AYANT ÉCRIT ; porte le `turnId`
  // rewindable (retenu en-session). « Annuler ce tour » = action humaine → mauve.
  | { id: number; kind: "rewind"; turnId: string; status: RewindStatus };

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
  // Segment assistant COURANT : la bulle qui reçoit les deltas. Remis à `null` à chaque
  // outil → le texte qui SUIT l'outil ouvre une NOUVELLE bulle, intercalée au point réel
  // d'utilisation (timeline : texte → action → texte, comme l'app Claude).
  const currentAssistantIdRef = useRef<number | null>(null);
  // A-t-on produit au moins une bulle assistant ce tour ? (sinon : note douce en fin).
  const producedAssistantRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Nouvelle conversation : vide l'historique en-session (aucune persistance de toute façon),
  // coupe un flux en cours et réinitialise la saisie. Le popup reste ouvert.
  const newConversation = useCallback(() => {
    abortRef.current?.abort();
    streamingRef.current = false;
    currentAssistantIdRef.current = null;
    producedAssistantRef.current = false;
    setItems([]);
    setDraft("");
    setStatus("idle");
    inputRef.current?.focus();
  }, []);

  // REWIND d'un tour (inc.4) : affordance HUMAINE (jamais un tool d'agent). On appelle la server
  // action `rewindTurnAction(turnId)` qui rejoue les inverses (soft, jamais hard-delete) puis
  // hérite de la sync d'inc.2 (`revalidatePath`) ; côté client on refait UN `router.refresh()`
  // (même levier que `onWrite`) — AUCUN nouveau mécanisme de sync.
  const rewindTurn = useCallback(
    (turnId: string, itemId: number) => {
      setItems((prev) =>
        prev.map((it) =>
          it.kind === "rewind" && it.id === itemId
            ? { ...it, status: "running" }
            : it,
        ),
      );
      void rewindTurnAction(turnId)
        .then((res) => {
          // Retour HONNÊTE : si l'action a réussi mais n'a RIEN inversé (run qui n'a finalement
          // rien commis, ou tour déjà annulé), on n'affiche pas un faux « Tour annulé » et on
          // ne déclenche pas de refresh inutile.
          const reversed = res.ok && res.summary.reversed > 0;
          setItems((prev) =>
            prev.map((it) =>
              it.kind === "rewind" && it.id === itemId
                ? {
                    ...it,
                    status: res.ok ? (reversed ? "done" : "noop") : "error",
                  }
                : it,
            ),
          );
          if (reversed) router.refresh();
        })
        .catch(() => {
          setItems((prev) =>
            prev.map((it) =>
              it.kind === "rewind" && it.id === itemId
                ? { ...it, status: "error" }
                : it,
            ),
          );
        });
    },
    [router],
  );

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

    // MULTI-TOUR (inc.3) : on envoie l'HISTORIQUE de la conversation en-session pour donner
    // au copilote le CONTEXTE des tours précédents (« écris-LUI un message » réfère au contact
    // nommé au tour d'avant). On inclut les tours assistant pour former une conversation BIEN
    // FORMÉE (alternance user/assistant) lisible par le modèle — mais le serveur ne fait
    // TOUJOURS confiance qu'aux tours `user` (`selectTrustedTurns`, CAP-3 préservé) : les tours
    // assistant ne portent jamais d'autorité, ils ne servent qu'à situer la demande courante.
    // Une réponse peut s'être découpée en PLUSIEURS bulles assistant (texte → outil → texte) :
    // on COALESCE les segments assistant consécutifs en un seul tour (les outils sont UI-only,
    // jamais renvoyés au modèle). On exclut bulles d'erreur et chips d'outil.
    const history: CopiloteTurn[] = [];
    const pushTurn = (role: CopiloteTurn["role"], text: string) => {
      const last = history[history.length - 1];
      if (last && last.role === role) last.content += `\n\n${text}`;
      else history.push({ role, content: text });
    };
    for (const it of items) {
      if (it.kind === "user") pushTurn("user", it.content);
      else if (it.kind === "assistant" && it.content.length > 0)
        pushTurn("assistant", it.content);
    }
    pushTurn("user", content);

    // Nouveau tour : aucune bulle assistant encore ouverte, rien de produit.
    currentAssistantIdRef.current = null;
    producedAssistantRef.current = false;

    setItems((prev) => [...prev, userItem]);
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
          // Pas de segment ouvert (début de tour, ou juste après un outil) → on OUVRE une
          // nouvelle bulle assistant. Sinon on appende au segment courant.
          if (currentAssistantIdRef.current === null) {
            const id = newId();
            currentAssistantIdRef.current = id;
            producedAssistantRef.current = true;
            setItems((prev) => [
              ...prev,
              { id, kind: "assistant", content: text, pending: true },
            ]);
          } else {
            const id = currentAssistantIdRef.current;
            setItems((prev) =>
              prev.map((it) =>
                it.id === id && it.kind === "assistant"
                  ? { ...it, content: it.content + text }
                  : it,
              ),
            );
          }
        },
        // Outil qui DÉMARRE : chip « en cours » AJOUTÉ À LA FIN (au point réel d'utilisation),
        // puis on FERME le segment assistant courant → le texte qui suit ouvrira une nouvelle
        // bulle SOUS le chip (timeline : texte → action → texte, comme l'app Claude).
        onTool: ({ id: toolCallId, name }) => {
          if (controller.signal.aborted) return;
          const id = newId();
          setItems((prev) => [
            ...prev,
            { id, kind: "tool", toolCallId, name, status: "running" },
          ]);
          currentAssistantIdRef.current = null;
        },
        // Outil TERMINÉ/échoué : on clôt le chip correspondant (par `toolCallId`).
        onToolDone: ({ id: toolCallId, error }) => {
          if (controller.signal.aborted) return;
          setItems((prev) =>
            prev.map((it) =>
              it.kind === "tool" && it.toolCallId === toolCallId
                ? { ...it, status: error ? "error" : "done" }
                : it,
            ),
          );
        },
        onError: (message) => {
          if (controller.signal.aborted) return;
          // CAP-3 : on clôt les bulles assistant (texte partiel conservé) et on pose une
          // bulle d'erreur DOUCE à la suite — tour clairement terminé, jamais figé.
          setItems((prev) => [
            ...prev.map((it) =>
              it.kind === "assistant" ? { ...it, pending: false } : it,
            ),
            { id: newId(), kind: "error", content: message },
          ]);
          finishTurn();
        },
        onDone: () => {
          if (controller.signal.aborted) return;
          // Clôt les bulles assistant en cours. Si AUCUN texte n'est revenu (que des outils,
          // ou rien), on pose une note douce plutôt qu'un blanc muet.
          setItems((prev) =>
            prev.map((it) =>
              it.kind === "assistant" ? { ...it, pending: false } : it,
            ),
          );
          if (!producedAssistantRef.current) {
            const id = newId();
            setItems((prev) => [
              ...prev,
              {
                id,
                kind: "assistant",
                content: "(Aucune réponse cette fois. Réessaie ?)",
              },
            ]);
          }
          finishTurn();
        },
        // CAP-2 : UN SEUL refresh, déclenché en fin de tour si le run a écrit (succès OU
        // erreur). La page server-component relit la vérité serveur → l'UI reflète la
        // mutation sans reload. `aborted` (démontage) ⇒ on ne touche plus au routeur.
        // inc.4 : ce tour a écrit → on pose l'affordance de rewind (porte le `turnId` retenu
        // en-session), pour que l'humain puisse annuler exactement ce tour.
        onWrite: (turnId) => {
          if (controller.signal.aborted) return;
          router.refresh();
          if (turnId) {
            setItems((prev) => [
              ...prev,
              { id: newId(), kind: "rewind", turnId, status: "idle" },
            ]);
          }
        },
      },
      controller.signal,
    );
  }, [draft, items, router]);

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
                items.map((it) =>
                  it.kind === "rewind" ? (
                    <RewindAffordance
                      key={it.id}
                      item={it}
                      onRewind={() => rewindTurn(it.turnId, it.id)}
                    />
                  ) : (
                    <Bubble key={it.id} item={it} />
                  ),
                )
              )}

              {/* Ligne d'attente DOUCE (jamais un spinner) tant qu'aucun texte n'arrive pour
                  le segment courant : au tout début, ou JUSTE APRÈS un outil (le dernier item
                  n'est pas une bulle assistant en train de grossir). */}
              {streaming &&
              items.length > 0 &&
              items[items.length - 1]?.kind !== "assistant" ? (
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

/** Une bulle du fil. Assistant à gauche (mascotte, markdown), user à droite, chip d'outil, erreur douce. */
function Bubble({ item }: { item: Exclude<ChatItem, { kind: "rewind" }> }) {
  if (item.kind === "tool") {
    return <ToolChip item={item} />;
  }

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

  // Assistant : mascotte + bulle markdown (l'agent structure ses réponses en markdown).
  return (
    <div className="flex items-start gap-2">
      <Plume name="feather" size={24} className="mt-1 shrink-0" />
      <div className="max-w-[80%] rounded-button border-[length:--border-width-ink] border-line bg-surface-note px-4 py-2">
        <CopiloteMarkdown content={item.content} />
      </div>
    </div>
  );
}

/**
 * Affordance de REWIND (inc.4) — « Annuler ce tour ». Geste HUMAIN (jamais un tool d'agent) qui
 * annule exactement les mutations du tour. Le rewind peut défaire des effets lourds : l'affordance
 * est LISIBLE et DÉLIBÉRÉE (un bouton plein, pas un clic accidentel), mauve (= action), erreur en
 * teinte DOUCE (jamais rouge alarme), conforme `project-context.md`.
 */
function RewindAffordance({
  item,
  onRewind,
}: {
  item: Extract<ChatItem, { kind: "rewind" }>;
  onRewind: () => void;
}) {
  const done = item.status === "done";
  const running = item.status === "running";
  const noop = item.status === "noop";
  const error = item.status === "error";
  const label = done
    ? "Tour annulé"
    : noop
      ? "Rien à annuler"
      : running
        ? "Annulation…"
        : "Annuler ce tour";
  return (
    <div className="flex flex-col gap-1 self-start">
      <button
        type="button"
        onClick={onRewind}
        disabled={running || done || noop}
        aria-label="Annuler ce tour"
        className="flex items-center gap-2 self-start rounded-button border-[length:--border-width-ink] border-ink bg-surface-note px-3 py-1.5 font-body text-label font-bold uppercase tracking-[0.12em] text-accent outline-accent outline-offset-2 focus-visible:outline-2 disabled:cursor-default disabled:border-line disabled:text-ink-hint"
      >
        <Icon name={done || noop ? "check" : "arrow-left"} size={14} />
        {label}
      </button>
      {error ? (
        <span
          role="status"
          aria-live="polite"
          className="font-body text-label text-ink-soft"
        >
          L&apos;annulation a échoué. Réessaie.
        </span>
      ) : null}
    </div>
  );
}

/** Chip d'OUTIL — petit, discret, façon Claude : icône d'état + libellé FR de l'action. */
function ToolChip({
  item,
}: {
  item: Extract<ChatItem, { kind: "tool" }>;
}) {
  const label = TOOL_LABELS[item.name] ?? item.name;
  return (
    <div className="flex items-center gap-2 self-start rounded-button border-[length:--border-width-ink] border-line bg-surface-note px-3 py-1.5">
      {item.status === "running" ? (
        // En cours : mascotte qui « écrit » (jamais un spinner générique).
        <Plume name="feather" size={16} className="plume-ecrit shrink-0" />
      ) : (
        <Icon
          name="double-sparkle"
          size={14}
          className={item.status === "error" ? "text-ink-hint" : "text-mint-deep"}
        />
      )}
      <span className="font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft">
        {label}
        {item.status === "running" ? "…" : ""}
      </span>
    </div>
  );
}

export default CopiloteSheet;
