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

import {
  forUser,
  MAX_CONTEXT_TURNS,
  type ChatMessagesRepository,
  type ConversationsRepository,
} from "@/lib/db";

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
export type CopiloteMetadata = {
  didWrite: boolean;
  turnId?: string;
  /**
   * Phase 3 (CAP-3) : id du fil persisté, porté IN-BAND sur la part `finish`. Pour un fil neuf
   * (création paresseuse au 1er message), c'est le SEUL canal qui rend le nouveau `conversationId`
   * au client — qui le RETIENT puis le RENVOIE aux tours suivants (le serveur le valide à chaque
   * appel). Toujours présent (le serveur connaît l'id avant même de streamer).
   */
  conversationId?: string;
};

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
  "structures toi-même (importContacts) ; MODIFIER une fiche existante — entreprise, canal",
  "préféré, notes, coordonnées (handles) (updateContact, fusion non destructive des coordonnées ;",
  "ni le nom ni l'historique) ; rédiger un message dans la voix de l'utilisateur, APRÈS avoir",
  "capté le contexte relationnel (composeMessage) ; à sa demande, peupler son réseau de contacts de",
  "TEST (seedContacts) pour essayer l'app ; et ARCHIVER (retirer) à sa demande un contact",
  "(archiveContact), plusieurs contacts en bloc (archiveContacts) ou un brouillon (archiveDraft).",
  "RÈGLE ABSOLUE : tu RÉDIGES, tu n'ENVOIES JAMAIS. composeMessage ne crée qu'un brouillon ;",
  "l'envoi reste l'action de l'utilisateur depuis l'app. N'invente jamais de contacts ni de",
  "faits ; n'enregistre que ce que l'utilisateur a réellement dicté.",
  "ARCHIVAGE (delete) : c'est un retrait RÉVERSIBLE (soft-delete, l'utilisateur peut annuler le",
  "tour). Mais CONFIRME TOUJOURS LA CIBLE AVANT d'archiver : retrouve d'abord le(s) contact(s) via",
  "queryContacts, annonce le NOM (et le nombre, pour un bloc) de ce que tu vas retirer, et n'agis",
  "que sur une demande claire — jamais sur une instruction ambiguë, jamais un id non résolu.",
  "MODIFICATION (updateContact) : même règle que l'archivage — résous d'abord le contact via",
  "queryContacts, ANNONCE le NOM (et l'entreprise) ET le(s) champ(s) que tu vas modifier, et",
  "n'écris qu'après accord. Les coordonnées (handles) sont fusionnées : tu n'effaces jamais un",
  "canal déjà rempli en en ajoutant un autre.",
  "Appuie chaque réponse factuelle sur les outils. Quand l'utilisateur fait référence à un",
  "contact mentionné plus tôt (« écris-lui », « ce contact »), retrouve-le d'abord avec",
  "queryContacts pour obtenir son id avant composeMessage.",
  "CRÉATION DE CONTACT (createContact) : capte le contexte relationnel AVANT de créer. Si un",
  "élément clé manque ou est ambigu — comment l'utilisateur connaît la personne, à quand remonte",
  "la dernière interaction (RÉCENCE), le ton/l'objectif — pose une ou des questions CIBLÉES,",
  "attends la réponse, puis crée en passant ces faits dans l'argument `historique` (il nourrira",
  "la génération future, en continuité). Ne DEVINE JAMAIS la relation et n'invente AUCUN fait :",
  "n'enregistre que ce que l'utilisateur a dit. La capture est OPPORTUNISTE, jamais bloquante : si",
  "l'utilisateur ne veut rien préciser, crée sans `historique`. Pour COMPLÉTER l'historique d'un",
  "contact DÉJÀ existant, utilise setContactHistorique (append), pas createContact.",
  "RÉDACTION (composeMessage) : tu rédiges TOUJOURS en conversationnel. AVANT d'appeler",
  "composeMessage, capte le contexte relationnel par des questions CIBLÉES si un élément clé",
  "manque ou est ambigu : comment l'utilisateur connaît ce contact, à quand remonte la dernière",
  "interaction (RÉCENCE) et l'objectif du message. Ne DEVINE JAMAIS la relation : pose la ou les",
  "questions, attends la réponse, puis rédige. Calibre sur la récence — un contact récent n'a pas",
  "oublié l'utilisateur, ne présume pas l'oubli ni ne minimise une interaction réelle (un entretien",
  "est un entretien). N'invente AUCUN fait : n'utilise que ce que l'utilisateur a répondu, et passe",
  "ces faits dans l'argument `idea`. Pour AMÉLIORER un brouillon déjà produit (« plus court »,",
  "« moins formel »), re-rédige en rappelant composeMessage avec une idée affinée : l'itération",
  "conversationnelle EST l'amélioration, il n'y a pas d'outil séparé.",
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
 * DÉFENSE RÉSIDUELLE NON CÂBLÉE (Phase 3, CAP-3) — anciennement le filtre du contexte multi-tour
 * reconstruit depuis le body client (inc.3). Le serveur est DÉSORMAIS la source de vérité du
 * contexte (chargé depuis le fil persisté, scopé tenant), donc le body ne porte plus l'historique
 * `assistant` : `runAgentChat` n'appelle PLUS cette fonction. On la conserve, pure et testée,
 * comme défense résiduelle (forme bien formée d'une conversation), mais on ne RECRÉE JAMAIS une
 * dépendance au passé `assistant` fourni par le client (Constraint SPEC). Fonction pure → testable.
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

/** Repositories de persistance injectés dans `runAgentChat` (défaut = porte `forUser`). */
export type RunAgentChatRepos = {
  conversations: ConversationsRepository;
  chatMessages: ChatMessagesRepository;
};

/**
 * Lance la boucle tool-use pour un tenant et renvoie un FLUX UI MESSAGE du SDK
 * (`toUIMessageStreamResponse`). Ce format porte les signaux de sync que `toTextStreamResponse`
 * ne pouvait pas :
 *   - CAP-3 (inc.2) : une erreur mid-stream devient une part `error` TERMINALE (via `onError`),
 *     rendue en teinte douce côté client — plus de flux tronqué pris pour un succès.
 *   - CAP-2 (inc.2) : la part `finish` porte `messageMetadata.didWrite` — le SEUL fait dont le
 *     client a besoin pour déclencher UN `router.refresh()` si le run a écrit ; + `turnId` (inc.4)
 *     si le run a écrit (réhydrate le rewind) ; + `conversationId` (Phase 3, in-band).
 *
 * PHASE 3 — le SERVEUR est la source de vérité du contexte multi-tour (CAP-1/2/3) :
 *   - le contexte envoyé au modèle est CHARGÉ depuis le fil persisté (porte scopée, borné à
 *     `MAX_CONTEXT_TURNS`), JAMAIS depuis le body client ;
 *   - le tour `user` est persisté AVANT `streamText`, le texte `assistant` FINAL en fin de run
 *     (`onFinish`), tous deux rattachés au même `conversationId`, scopés tenant ;
 *   - `conversationId === null` ⇒ création PARESSEUSE d'un fil neuf (titre = troncature du 1er
 *     message `user`) ; son id voyage in-band pour que le client le retienne.
 *
 * `userId` vient de la session next-auth (jamais du client) → tools ET persistance scopés à ce
 * tenant (SÉCU #3). L'APPARTENANCE d'un `conversationId` FOURNI est vérifiée PAR LA ROUTE avant
 * cet appel (404 sinon) ; ici on ne reçoit qu'un id validé ou `null`. `model`/`tools`/`repos` sont
 * injectables pour les tests. Peut rejeter avec `AgentConfigError` (clé absente) : l'appelant
 * l'attrape (erreur douce). Async : le chargement/la persistance du contexte sont des I/O.
 */
export async function runAgentChat(opts: {
  userId: string;
  /** Fil ciblé (validé par la route) ou `null` = créer un fil neuf au 1er message. */
  conversationId: string | null;
  /** NOUVEAU message `user` (le SEUL contenu venant du client — jamais l'historique). */
  message: string;
  /** Injection test : modèle mocké. Défaut = provider réel (clé serveur). */
  model?: LanguageModel;
  /** Injection test : catalogue de tools. Défaut = tools scopés au tenant. */
  tools?: ToolSet;
  /** Injection test : repos de persistance. Défaut = porte `forUser(userId)`. */
  repos?: RunAgentChatRepos;
}): Promise<Response> {
  // Résolu AVANT `streamText` : un `AgentConfigError` (clé absente) doit remonter pour être
  // attrapé par l'appelant (erreur douce), pas se perdre dans le flux. Async ⇒ rejet de la
  // promesse, attrapé par le `await` de la route.
  const model = opts.model ?? getAgentModel();

  // Porte de persistance scopée au tenant (source de vérité du contexte). En prod = `forUser`
  // (un seul gate sert conversations + chatMessages) ; en test = repos en mémoire injectés.
  const repos = opts.repos ?? (await forUser(opts.userId));
  const { conversations, chatMessages } = repos;

  // Création PARESSEUSE d'un fil neuf (CAP-2/4) : au 1er message sans `conversationId`, le serveur
  // pose le fil (titre = troncature déterministe du 1er message `user`, AUCUN appel IA) et en
  // retient l'id — porté in-band pour que le client le RETIENNE et le RENVOIE ensuite.
  const conversationId =
    opts.conversationId ??
    (await conversations.create({ firstUserMessage: opts.message })).id;

  // Persistance du tour `user` AVANT la génération (CAP-1), rattaché au fil, scopé tenant.
  await chatMessages.append({
    conversationId,
    role: "user",
    content: opts.message,
  });

  // CONTEXTE = SOURCE DE VÉRITÉ SERVEUR (CAP-3) : on charge la fenêtre BORNÉE des tours récents
  // du fil DEPUIS LA DB scopée (jamais le body) — y compris le tour `user` qu'on vient d'écrire,
  // en dernière position. Un faux passé `assistant` fabriqué dans un body client ne peut donc plus
  // entrer dans le contexte.
  const history = await chatMessages.listForConversation(conversationId, {
    limit: MAX_CONTEXT_TURNS,
  });
  const messages: ModelMessage[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

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
    // PERSISTANCE du tour `assistant` FINAL (CAP-1) : le texte agrégé est connu en fin de run.
    // On rattache le `turnId` UNIQUEMENT si le run a écrit (LIEN rewind, CAP-5) ; un tour read-only
    // le laisse NULL. Puis on bumpe `updated_at` du fil (reprise « dernier fil actif », CAP-2). Le
    // SDK AWAIT ce callback avant de clore le flux → la persistance est garantie terminée à la fin
    // du tour. Une persistance qui échouerait ne doit pas tuer le flux déjà rendu : on la protège.
    onFinish: async ({ text }) => {
      try {
        await chatMessages.append({
          conversationId,
          role: "assistant",
          content: text,
          turnId: didWrite ? turnId : null,
        });
        await conversations.touch(conversationId);
      } catch (err) {
        console.error("[agent] persistance du tour assistant échouée :", err);
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
    // le `turnId` UNIQUEMENT si le run a écrit (un tour read-only n'offre pas de rewind). Phase 3 :
    // le `conversationId` voyage TOUJOURS in-band (le client retient/renvoie un fil neuf).
    messageMetadata: ({ part }) =>
      part.type === "finish"
        ? didWrite
          ? { didWrite, turnId, conversationId }
          : { didWrite, conversationId }
        : undefined,
    // CAP-3 : transforme une erreur mid-stream en part `error` terminale lisible.
    // Détail déjà journalisé par `onError` de `streamText` ; ici on ne renvoie au
    // client qu'un texte doux (jamais de stack).
    onError: () => STREAM_ERROR_MESSAGE,
  });
}
