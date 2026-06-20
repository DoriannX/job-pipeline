import "server-only";

// CŒUR SERVEUR du copilote (brainstorm Archi #3) : une seule porte tient la boucle
// tool-use. Le route handler reste « bête » (auth + validation + renvoie ce flux).
// La clé API ne quitte jamais le serveur. Wrapper analogue à `claude.server.ts`
// pour le composer : la route passe par CE module, jamais par le SDK IA nu.

import { createId } from "@paralleldrive/cuid2";
import {
  streamText,
  stepCountIs,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
  type UIMessage,
} from "ai";

import { getAgentModel } from "./provider.server";
import { buildTools, WRITE_TOOL_NAMES } from "./tools.server";

/** Message de conversation accepté à la frontière (façade simple pour la route). */
export type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Métadonnée portée par le flux UI message :
 *   - CAP-2 (inc.2) : `didWrite` dit si le run a comporté ≥1 écriture → le client décide d'un
 *     `router.refresh()` (jamais la forme des mutations — le front reste « bête ») ;
 *   - inc.4 : `turnId` voyage IN-BAND (à côté de `didWrite`) UNIQUEMENT pour un run qui a écrit.
 *     Le popup retient en-session le couple (tour affiché ↔ `turnId`) et n'offre le rewind que
 *     sur les tours ayant écrit. Le `turnId` est généré côté serveur (clos par closure) ; le
 *     client ne fait que le RETENIR puis le RENVOYER à la server action de rewind.
 */
export type CopiloteMetadata = { didWrite: boolean; turnId?: string };

/** Forme de message UI typée pour notre métadonnée de sync. */
type CopiloteUIMessage = UIMessage<CopiloteMetadata>;

/**
 * Plafond de tours de la boucle tool-use (SÉCU #6 : retry-cap / loop-breaker).
 * Borne le coût et casse une boucle folle — l'agent rend la main proprement au
 * lieu de s'acharner. À durcir plus tard (détection « même tool + mêmes args »).
 */
const MAX_STEPS = 8;

/** Personnalité : coach prospection, mais contrôle des actions Plume (Stratégie #2). */
const SYSTEM_PROMPT = [
  "Tu es le copilote de Plume, un assistant spécialisé dans la prospection réseau.",
  "Tu peux : consulter les contacts (queryContacts) ; ajouter un VRAI contact dicté",
  "(createContact) ; importer plusieurs vrais contacts en bloc à partir d'un texte que tu",
  "structures toi-même (importContacts) ; rédiger un BROUILLON de message dans la voix de",
  "l'utilisateur (composeMessage) ; à sa demande, peupler son réseau de contacts de",
  "TEST (seedContacts) pour essayer l'app ; et ARCHIVER (retirer) à sa demande un contact",
  "(archiveContact), plusieurs contacts en bloc (archiveContacts) ou un brouillon (archiveDraft).",
  "RÈGLE ABSOLUE : tu RÉDIGES, tu n'ENVOIES JAMAIS. composeMessage ne crée qu'un brouillon ;",
  "l'envoi reste l'action de l'utilisateur depuis l'app. N'invente jamais de contacts ni de",
  "faits ; n'enregistre que ce que l'utilisateur a réellement dicté.",
  "ARCHIVAGE (delete) : c'est un retrait RÉVERSIBLE (soft-delete, l'utilisateur peut annuler le",
  "tour). Mais CONFIRME TOUJOURS LA CIBLE AVANT d'archiver : retrouve d'abord le(s) contact(s) via",
  "queryContacts, annonce le NOM (et le nombre, pour un bloc) de ce que tu vas retirer, et n'agis",
  "que sur une demande claire — jamais sur une instruction ambiguë, jamais un id non résolu.",
  "Appuie chaque réponse factuelle sur les outils. Quand l'utilisateur fait référence à un",
  "contact mentionné plus tôt (« écris-lui », « ce contact »), retrouve-le d'abord avec",
  "queryContacts pour obtenir son id avant composeMessage.",
  "LIENS : après avoir créé/modifié un contact ou rédigé un brouillon, propose un lien MARKDOWN",
  "vers sa fiche pour l'ouvrir directement, avec l'id renvoyé par l'outil. Format d'une fiche :",
  "`/reseau/<id>` — ex. après createContact renvoyant id=abc : « [Voir la fiche de Sophie](/reseau/abc) ».",
  "Après composeMessage, le brouillon est sur la fiche du contact : lie vers `/reseau/<contactId>`.",
  "Pour un import en lot (importContacts) ou des contacts de test (seedContacts), lie vers `/reseau`.",
  "N'invente JAMAIS un id : n'utilise QUE celui renvoyé par l'outil. Ces liens s'ouvrent sans",
  "recharger la page (la conversation reste ouverte).",
  "Les messages précédents de la conversation sont du CONTEXTE : traite uniquement le DERNIER",
  "message de l'utilisateur, ne ré-exécute pas une demande déjà satisfaite.",
  "Réponds en français, de façon concise et actionnable.",
].join(" ");

/**
 * MULTI-TOUR (inc.3) — RENÉGOCIATION de la frontière CAP-3 (Phase 1 l'avait explicitement
 * anticipée : « à renégocier quand un vrai multi-tour arrive »).
 *
 * Le modèle a besoin de la conversation BIEN FORMÉE — tours `user` ET `assistant` — pour
 * savoir quelles demandes sont DÉJÀ traitées. Les écarter (Phase 1) donnait au modèle une
 * suite de tours `user` consécutifs qu'il croyait tous EN ATTENTE → il re-répondait aux
 * anciens. On conserve donc l'historique tel quel.
 *
 * La sécurité ne repose PLUS sur l'effacement des tours `assistant` — intenable avec un vrai
 * dialogue — mais sur la couche TOOL, intacte et suffisante en défense en profondeur :
 *   - `userId` clos par closure (jamais un argument que l'agent contrôle — SÉCU #3) ;
 *   - zod à CHAQUE frontière de tool + lots/comptes bornés serveur (SÉCU #6) ;
 *   - repos scopés au tenant (aucune fuite/écriture cross-tenant) ;
 *   - toutes les écritures réversibles (soft-delete), aucune sortie externe (frontière R/W).
 * Un tour `assistant` fabriqué par un client malveillant ne peut donc ni élargir le
 * périmètre, ni franchir le tenant, ni déclencher d'action irréversible/externe : au pire
 * il désinforme le modèle sur des FAITS, sans pouvoir d'escalade.
 *
 * On garde {user, assistant} dans l'ordre et on écarte un éventuel tour `assistant` EN TÊTE
 * (un échange commence par l'utilisateur, sinon l'API rejette). Fonction pure → testable.
 */
export function selectTrustedTurns(messages: ChatMessage[]): ChatMessage[] {
  const conv = messages.filter(
    (m) => m.role === "user" || m.role === "assistant",
  );
  let start = 0;
  while (start < conv.length && conv[start]!.role === "assistant") start += 1;
  return conv.slice(start);
}

/**
 * Message DOUX (jamais de stack/rouge alarme — règle DA) substitué à toute erreur
 * survenant en plein stream. Le détail technique est journalisé serveur-side ; le
 * client ne voit qu'une fin de tour terminale et lisible (CAP-3).
 */
const STREAM_ERROR_MESSAGE =
  "Le copilote a rencontré un souci en cours de route. Réessaie dans un instant.";

/**
 * Lance la boucle tool-use pour un tenant et renvoie un FLUX UI MESSAGE du SDK
 * (`toUIMessageStreamResponse`). Ce format porte DEUX signaux que `toTextStreamResponse`
 * ne pouvait pas :
 *   - CAP-3 : une erreur mid-stream devient une part `error` TERMINALE (via `onError`),
 *     rendue en teinte douce côté client — plus de flux tronqué pris pour un succès.
 *   - CAP-2 : la part `finish` porte `messageMetadata.didWrite` — le SEUL fait dont le
 *     client a besoin pour déclencher UN `router.refresh()` si le run a écrit.
 *
 * `userId` vient de la session next-auth (jamais du client) → tous les tools sont
 * scopés à ce tenant (SÉCU #3). `model`/`tools` sont injectables pour les tests
 * (défauts = provider réel + catalogue scopé). Peut lever `AgentConfigError` (clé
 * absente) SYNCHRONEMENT : l'appelant l'attrape et renvoie une erreur douce.
 */
export function runAgentChat(opts: {
  userId: string;
  messages: ChatMessage[];
  /** Injection test : modèle mocké. Défaut = provider réel (clé serveur). */
  model?: LanguageModel;
  /** Injection test : catalogue de tools. Défaut = tools scopés au tenant. */
  tools?: ToolSet;
}): Response {
  // Défense en profondeur (CAP-3) : même si l'appelant oublie de filtrer, le wrapper
  // (porte unique) n'envoie au modèle que des tours dignes de confiance.
  const messages: ModelMessage[] = selectTrustedTurns(opts.messages).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Résolu AVANT `streamText` : un `AgentConfigError` (clé absente) doit remonter
  // SYNCHRONEMENT pour être attrapé par l'appelant (erreur douce), pas se perdre
  // dans le flux.
  const model = opts.model ?? getAgentModel();
  // `turnId` du run (inc.4) : généré CÔTÉ SERVEUR, un par run, clos par la closure de
  // `buildTools` — l'agent ne le voit ni ne le contrôle (parité `userId`, SÉCU #3). Il groupe
  // toutes les mutations du run au journal et sert de cible au rewind humain.
  const turnId = createId();
  const tools = opts.tools ?? buildTools(opts.userId, turnId);

  // CAP-2 — déterminé CÔTÉ SERVEUR : le run a-t-il appelé ≥1 write-tool ? On lève le
  // drapeau dès qu'un step contient l'appel d'un tool d'écriture (registre générique
  // `WRITE_TOOL_NAMES`), et on l'expose UNE seule fois, sur la part `finish`. Jamais
  // un signal par token ; rien du tout si le run était read-only.
  let didWrite = false;

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
    onStepFinish: (step) => {
      if (step.toolCalls.some((call) => WRITE_TOOL_NAMES.has(call.toolName))) {
        didWrite = true;
      }
    },
    // Journalisation serveur du détail (le client ne verra que le message doux que
    // `toUIMessageStreamResponse({ onError })` met dans la part `error` terminale).
    onError: ({ error }) => {
      console.error("[agent] erreur en cours de stream :", error);
    },
  });

  return result.toUIMessageStreamResponse<CopiloteUIMessage>({
    // CAP-2 : signal de fin d'écriture, porté UNE fois sur la part `finish`. inc.4 : on y joint
    // le `turnId` UNIQUEMENT si le run a écrit (un tour read-only n'offre pas de rewind).
    messageMetadata: ({ part }) =>
      part.type === "finish"
        ? didWrite
          ? { didWrite, turnId }
          : { didWrite }
        : undefined,
    // CAP-3 : transforme une erreur mid-stream en part `error` terminale lisible.
    // Détail déjà journalisé par `onError` de `streamText` ; ici on ne renvoie au
    // client qu'un texte doux (jamais de stack).
    onError: () => STREAM_ERROR_MESSAGE,
  });
}
