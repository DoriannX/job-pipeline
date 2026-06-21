// Repositories du TRANSCRIPT copilote (Phase 3) — ZONE AUTORISÉE (src/lib/db/**). C'est ICI,
// et seulement ici, qu'on touche au schéma Drizzle de `conversations`/`chat_messages` ; les
// features, la route et `runAgentChat` n'écrivent AUCUNE logique BDD directe (barrière n°1 /
// AR-2, AR-13). Patron = `action-log-repositories.ts`/`repositories.ts` : factory
// `(scoped: ScopedDb) => …`, lectures/écritures déjà bornées au tenant par la porte.
//
// Le serveur devient la SOURCE DE VÉRITÉ du contexte multi-tour : le fil persisté est rechargé
// depuis la DB scopée (plus depuis le body client). FRONTIÈRES (data-model.md) : ce transcript
// n'est NI `action_log` (mutations, pont = `turn_id`) NI `messages` (outreach du moat) ; PAS de
// `sanitize()` sur `content`/`titre` (réservé au corpus d'outreach).

import { asc, desc, eq } from "drizzle-orm";

import { chatMessages, conversations } from "./schema";
import type { ScopedDb } from "./scoped";
import { now } from "../domain/time";

/** Ligne `conversations` telle que lue en base (typée par le schéma). */
export type Conversation = typeof conversations.$inferSelect;
/** Ligne `chat_messages` telle que lue en base (typée par le schéma). */
export type ChatMessageRow = typeof chatMessages.$inferSelect;

/**
 * Borne du CONTEXTE modèle (anti-coût/anti-DoS, parité `MAX_MESSAGES = 50`). Un fil long n'est
 * JAMAIS envoyé intégralement au modèle : seuls les `MAX_CONTEXT_TURNS` tours les plus récents
 * alimentent la génération (fenêtre glissante). La PERSISTANCE garde tout le fil — seul le
 * contexte modèle est tronqué. C'est aussi la borne de réhydratation du popup (CAP-2).
 */
export const MAX_CONTEXT_TURNS = 40;

/** Longueur de troncature du titre déterministe (début du 1er message `user`). AUCUN appel IA. */
export const TITRE_MAX_LENGTH = 60;

/**
 * Titre d'un fil = début du 1er message `user`, tronqué — DÉTERMINISTE, jamais de génération IA
 * (Constraint SPEC). Espace normalisé puis coupé à `TITRE_MAX_LENGTH` ; on ajoute une ellipse si
 * le texte dépassait. Fonction pure → testable.
 */
export function deriveTitre(firstUserMessage: string): string {
  const normalized = firstUserMessage.trim().replace(/\s+/g, " ");
  if (normalized.length <= TITRE_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, TITRE_MAX_LENGTH).trimEnd()}…`;
}

/** Tour de dialogue persisté (rôle + contenu + lien rewind éventuel). */
export type AppendChatMessage = {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  /** LIEN `action_log.turn_id` — sur un tour `assistant` AYANT écrit (réhydrate le rewind, CAP-5). */
  turnId?: string | null;
};

/** Contrat du repository des FILS (auto-scopé par tenant). */
export type ConversationsRepository = {
  /** Le fil non archivé au `updated_at` le plus récent, ou `null` (reprise — CAP-2). */
  findLatestActive: () => Promise<Conversation | null>;
  /**
   * Crée un fil neuf : `titre` = troncature déterministe du 1er message `user` (AUCUN appel IA).
   * `user_id`/horodatages imposés par la porte/horloge.
   */
  create: (input: { firstUserMessage: string }) => Promise<Conversation>;
  /** Lit un fil ACTIF par id ; `null` s'il n'est pas au tenant courant ou est archivé (scopé). */
  findById: (id: string) => Promise<Conversation | null>;
  /** Bump `updated_at` (dernière activité) du fil ; no-op silencieux hors tenant. */
  touch: (id: string) => Promise<void>;
};

/** Contrat du repository des TOURS de dialogue (auto-scopé par tenant). */
export type ChatMessagesRepository = {
  /** Persiste UN tour (`user` ou texte `assistant` FINAL) rattaché au fil. */
  append: (input: AppendChatMessage) => Promise<ChatMessageRow>;
  /**
   * Tours d'un fil, ordonnés `created_at` croissant. `limit` BORNE la lecture aux N tours les
   * plus récents (fenêtre glissante — alimente le modèle ET le popup) ; la table garde tout.
   */
  listForConversation: (
    conversationId: string,
    opts?: { limit?: number },
  ) => Promise<ChatMessageRow[]>;
};

/** Construit le repository des fils au-dessus d'une porte scopée. */
export function conversationsRepository(
  scoped: ScopedDb,
): ConversationsRepository {
  return {
    async findLatestActive() {
      // La porte exclut déjà `archived_at IS NULL` ; on prend le plus récemment mis à jour.
      const rows = await scoped.findMany(conversations, undefined, [
        desc(conversations.updatedAt),
      ]);
      return rows[0] ?? null;
    },

    async create({ firstUserMessage }) {
      const ts = now(scoped.now);
      const [row] = await scoped.insert(conversations, {
        titre: deriveTitre(firstUserMessage),
        archivedAt: null,
        createdAt: ts,
        updatedAt: ts,
      });
      return row;
    },

    async findById(id) {
      // Scopé par la porte (et `archived_at IS NULL`) : un fil d'un autre tenant — ou archivé —
      // est INVISIBLE → `null`, jamais une fuite. C'est la garantie d'appartenance de la route.
      const row = await scoped.findFirst(conversations, eq(conversations.id, id));
      return row ?? null;
    },

    async touch(id) {
      await scoped.update(
        conversations,
        { updatedAt: now(scoped.now) },
        eq(conversations.id, id),
      );
    },
  };
}

/** Construit le repository des tours de dialogue au-dessus d'une porte scopée. */
export function chatMessagesRepository(
  scoped: ScopedDb,
): ChatMessagesRepository {
  return {
    async append({ conversationId, role, content, turnId }) {
      const [row] = await scoped.insert(chatMessages, {
        conversationId,
        role,
        content,
        turnId: turnId ?? null,
        createdAt: now(scoped.now),
      });
      return row;
    },

    async listForConversation(conversationId, opts) {
      // Lecture ORDONNÉE (created_at croissant) du fil scopé. On lit le fil (borné par la
      // rétention) puis on garde la FENÊTRE des `limit` tours les plus récents — la persistance
      // conserve tout, seul le contexte modèle / la réhydratation est plafonné.
      const rows = await scoped.findMany(
        chatMessages,
        eq(chatMessages.conversationId, conversationId),
        [asc(chatMessages.createdAt)],
      );
      const limit = opts?.limit;
      return limit != null && rows.length > limit
        ? rows.slice(rows.length - limit)
        : rows;
    },
  };
}
