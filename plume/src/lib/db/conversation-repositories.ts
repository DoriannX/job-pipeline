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

import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";

import { chatMessages, conversations } from "./schema";
import type { ScopedDb } from "./scoped";
import { now } from "../domain/time";

/** Ligne `conversations` telle que lue en base (typée par le schéma). */
export type Conversation = typeof conversations.$inferSelect;
/** Ligne `chat_messages` telle que lue en base (typée par le schéma). */
export type ChatMessageRow = typeof chatMessages.$inferSelect;

/** Projection LÉGÈRE d'un fil pour la liste multi-fils (CAP-4) : id + titre + récence. */
export type ConversationSummary = {
  id: string;
  titre: string | null;
  updatedAt: number | null;
};

/**
 * RÉTENTION bornée (CAP-6) : plafond de fils ACTIFS par tenant — constante serveur explicite et
 * nommée (parité `MAX_MESSAGES`/`MAX_CONTEXT_TURNS` : borne nommée, pas magique). Au-delà, les fils
 * les plus anciens (par `updated_at`) passent en SOFT-delete (`archived_at`) — jamais de `DELETE`.
 * Valeur = réglage produit/coût, ajustable ; le contrat exige seulement qu'une borne EXISTE.
 */
export const MAX_CONVERSATIONS_PER_TENANT = 30;

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
   * `user_id`/horodatages imposés par la porte/horloge. Déclenche la PURGE de rétention (CAP-6) :
   * un nouveau fil au-delà du seuil archive (soft) les plus vieux.
   */
  create: (input: { firstUserMessage: string }) => Promise<Conversation>;
  /** Lit un fil ACTIF par id ; `null` s'il n'est pas au tenant courant ou est archivé (scopé). */
  findById: (id: string) => Promise<Conversation | null>;
  /** Bump `updated_at` (dernière activité) du fil ; no-op silencieux hors tenant. */
  touch: (id: string) => Promise<void>;
  /**
   * Liste les fils ACTIFS du tenant (la porte exclut déjà `archived_at IS NULL`), du plus récent
   * au plus ancien (`updated_at` desc), en projection LÉGÈRE (CAP-4 — liste des conversations).
   */
  listActive: () => Promise<ConversationSummary[]>;
  /**
   * Renomme un fil : écrase `titre` (déjà borné/validé par l'action ; PAS de `sanitize()` —
   * frontière moat). Scopé → no-op silencieux si le fil n'est pas au tenant. Renvoie `true` si une
   * ligne a été modifiée. NE bumpe PAS `updated_at` (un renommage n'est pas une activité de fil →
   * il ne doit pas réordonner la liste ni sauver un fil de la purge).
   */
  rename: (id: string, titre: string) => Promise<boolean>;
  /**
   * Archive un fil — SOFT-delete (`archived_at`), JAMAIS de `DELETE`. Scopé + idempotent (un fil
   * déjà archivé ⇒ `false`, aucune écriture). Le fil sort de TOUTES les lectures de la porte.
   */
  archive: (id: string) => Promise<boolean>;
  /**
   * RÉTENTION (CAP-6) : si le nombre de fils ACTIFS du tenant dépasse `MAX_CONVERSATIONS_PER_TENANT`,
   * archive (SOFT) les plus vieux (par `updated_at` croissant) jusqu'au seuil — jamais de `DELETE`,
   * jamais un fil sous le seuil. Idempotent (rejouer sous le seuil = no-op). Renvoie le nombre de
   * fils archivés par cet appel.
   */
  purgeBeyondThreshold: () => Promise<number>;
};

/**
 * PURGE de rétention (CAP-6), extraite pour être appelée à la création d'un fil ET exposée comme
 * méthode (balayage). Archive en SOFT les fils ACTIFS excédentaires les PLUS ANCIENS (`updated_at`
 * croissant), sans jamais toucher un fil sous le seuil ni hard-delete. Idempotent par construction.
 */
async function purgeBeyond(scoped: ScopedDb): Promise<number> {
  // La porte exclut déjà les archivés : on lit les ACTIFS du plus ancien au plus récent.
  const active = await scoped.findMany(conversations, undefined, [
    asc(conversations.updatedAt),
  ]);
  const excess = active.length - MAX_CONVERSATIONS_PER_TENANT;
  if (excess <= 0) return 0;
  const ts = now(scoped.now);
  const oldest = active.slice(0, excess);
  for (const convo of oldest) {
    await scoped.update(
      conversations,
      { archivedAt: ts },
      eq(conversations.id, convo.id),
    );
  }
  return oldest.length;
}

/**
 * Bilan d'un `editAndTruncate` (F6, story 7-9) : le fil tronqué (du plus ancien au plus récent,
 * message édité INCLUS, comme `listForConversation`) + les tours `assistant` SUPPRIMÉS qui
 * portaient un `turnId` (= avaient écrit via write-tools) — à rewinder AVANT cet appel pour ne pas
 * laisser de mutations orphelines (l'action s'en charge ; le repo ne touche QUE le transcript).
 */
export type EditAndTruncateResult = {
  /** Fil après troncature (created_at croissant), ou `[]` si le message ciblé est introuvable. */
  remaining: ChatMessageRow[];
  /** `turn_id` des tours `assistant` postérieurs SUPPRIMÉS (mutations à défaire en amont). */
  truncatedTurnIds: string[];
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
  /**
   * F6 (story 7-9) — ÉDITION + RÉÉCRITURE DU FIL AVAL (pas de fork), dans UNE transaction scopée :
   *   1. met à jour le `content` du message `messageId` ;
   *   2. HARD-delete (jamais d'`archived_at` — la table n'en a pas) tous les tours POSTÉRIEURS du
   *      même fil (`created_at > ref.created_at`).
   * Scopé `forUser` : un message/fil d'un autre tenant est invisible (no-op, `remaining: []`). Le
   * message ciblé doit appartenir au fil donné. Renvoie le fil tronqué + les `turnId` des tours
   * `assistant` supprimés (l'appelant les a déjà rewindés AVANT — cohérence des mutations).
   */
  editAndTruncate: (
    conversationId: string,
    messageId: string,
    newContent: string,
  ) => Promise<EditAndTruncateResult>;
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
      // RÉTENTION (CAP-6) : la borne s'applique à l'écriture d'un nouveau fil. Le fil qu'on vient
      // de créer est le plus récent (`updated_at = ts`) → jamais parmi les plus vieux archivés.
      await purgeBeyond(scoped);
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

    async listActive() {
      const rows = await scoped.findMany(conversations, undefined, [
        desc(conversations.updatedAt),
      ]);
      return rows.map((r) => ({
        id: r.id,
        titre: r.titre,
        updatedAt: r.updatedAt,
      }));
    },

    async rename(id, titre) {
      // Scopé (where = tenant ∧ id) → un fil d'un autre tenant ne matche pas (no-op silencieux).
      // PAS de `sanitize()` (frontière moat) ; pas de bump `updated_at` (un renommage ne réordonne
      // pas la liste). Renvoie `true` si une ligne a changé.
      const rows = await scoped.update(
        conversations,
        { titre },
        eq(conversations.id, id),
      );
      return rows.length > 0;
    },

    async archive(id) {
      // SOFT-delete : pose `archived_at`, jamais de `DELETE`. Idempotent — on ne cible qu'un fil
      // ACTIF (`archived_at IS NULL`) → un fil déjà archivé matche 0 ligne → `false`.
      const [row] = await scoped.update(
        conversations,
        { archivedAt: now(scoped.now) },
        and(eq(conversations.id, id), isNull(conversations.archivedAt)),
      );
      return row !== undefined;
    },

    async purgeBeyondThreshold() {
      return purgeBeyond(scoped);
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

    async editAndTruncate(conversationId, messageId, newContent) {
      // ATOMICITÉ (F6) : édition + troncature du fil aval dans UNE transaction scopée — tout-ou-rien
      // (parité rewind). Le handle tx est re-scopé au MÊME tenant : un message/fil d'autrui reste
      // invisible (no-op). Hard-delete assumé (la table n'a pas d'`archived_at` ; la troncature EST
      // une suppression voulue du transcript). Les mutations des tours supprimés sont rewindées EN
      // AMONT par l'action — ici on ne touche QUE le transcript (séparation transcript ↔ journal).
      return scoped.transaction(async (tx) => {
        // Référence : le message ciblé DANS ce fil (scopé tenant ∧ fil ∧ id). Introuvable
        // (id inconnu, autre fil, autre tenant) ⇒ no-op honnête, fil inchangé.
        const ref = await tx.findFirst(
          chatMessages,
          and(
            eq(chatMessages.conversationId, conversationId),
            eq(chatMessages.id, messageId),
          ),
        );
        if (!ref) return { remaining: [], truncatedTurnIds: [] };

        // Tours POSTÉRIEURS (created_at strictement supérieur) — à supprimer. On les LIT d'abord
        // pour remonter les `turnId` des tours `assistant` ayant écrit (rewind en amont, déjà fait).
        const refTs = ref.createdAt ?? 0;
        const deleted = await tx.delete(
          chatMessages,
          and(
            eq(chatMessages.conversationId, conversationId),
            gt(chatMessages.createdAt, refTs),
          ),
        );
        const truncatedTurnIds = deleted
          .filter((m) => m.role === "assistant" && m.turnId)
          .map((m) => m.turnId as string);

        // Édition du contenu du message ciblé (scopé). PAS de `sanitize()` (frontière moat).
        await tx.update(
          chatMessages,
          { content: newContent },
          eq(chatMessages.id, messageId),
        );

        // Fil tronqué relu (created_at croissant), message édité inclus — forme `listForConversation`.
        const remaining = await tx.findMany(
          chatMessages,
          eq(chatMessages.conversationId, conversationId),
          [asc(chatMessages.createdAt)],
        );
        return { remaining, truncatedTurnIds };
      });
    },
  };
}
