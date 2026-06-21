import "server-only";

// Convenance SERVEUR de la porte de données : `forUser(userId)`.
//
// C'est l'entrée que les server actions des features utilisent. Elle câble le client
// Drizzle serveur (getServerDb, lit l'env paresseusement) + l'horloge système, puis
// expose les repositories d'entités auto-scopés par tenant. Les features appellent
// `(await forUser(userId)).contacts.list()` etc. — SANS jamais voir le schéma ni Drizzle
// (barrière ESLint n°1 / AR-2, AR-13).
//
// `server-only` : ce module touche env + db serveur, il ne doit jamais fuiter côté client.
// `userId` est fourni par l'appelant (résolu via `auth()` dans chaque action) : on ne lit
// PAS la session ici, pour garder ce module pur vis-à-vis du framework et testable au besoin.

import {
  actionLogRepository,
  type ActionLogRepository,
} from "./action-log-repositories";
import { getServerDb } from "./client";
import {
  chatMessagesRepository,
  conversationsRepository,
  type ChatMessagesRepository,
  type ConversationsRepository,
} from "./conversation-repositories";
import {
  importJobsRepository,
  mergeCandidatesRepository,
  type ImportJobsRepository,
  type MergeCandidatesRepository,
} from "./import-repositories";
import {
  messagesRepository,
  type MessagesRepository,
} from "./message-repositories";
import { contactsRepository, type ContactsRepository } from "./repositories";
import { scopedDb, type ScopedDb } from "./scoped";
import {
  seedVoixRepository,
  type SeedVoixRepository,
} from "./voice-repositories";
import { systemClock } from "../domain/time";

/** Repositories scopés (un par entité) — la surface commune à la porte et à ses transactions. */
export type ScopedRepositories = {
  contacts: ContactsRepository;
  importJobs: ImportJobsRepository;
  mergeCandidates: MergeCandidatesRepository;
  seedVoix: SeedVoixRepository;
  messages: MessagesRepository;
  /** Journal d'actions du copilote (inc.4) : écriture atomique + lecture pour le rewind. */
  actionLog: ActionLogRepository;
  /** Fils de conversation copilote (Phase 3) : reprise, multi-fils, rétention soft. */
  conversations: ConversationsRepository;
  /** Tours de dialogue persistés (Phase 3) : source de vérité serveur du contexte multi-tour. */
  chatMessages: ChatMessagesRepository;
};

/** Surface de données scopée exposée aux features (repos + transaction scopée). */
export type UserGate = ScopedRepositories & {
  /**
   * Exécute `fn` dans UNE transaction scopée au MÊME tenant, en lui passant des repositories
   * re-scopés sur le handle transactionnel. Tout réussit ENSEMBLE ou rien (rollback total).
   * Socle de l'atomicité du REWIND (inc.4) : tous les inverses + l'entrée d'audit `rewind`
   * vivent dans une seule transaction (parité avec l'écriture atomique du journal côté mutation).
   */
  transaction: <T>(fn: (tx: ScopedRepositories) => Promise<T>) => Promise<T>;
};

/** Câble les repositories d'entités au-dessus d'une porte scopée (db serveur OU handle tx). */
function buildRepositories(scoped: ScopedDb): ScopedRepositories {
  return {
    contacts: contactsRepository(scoped),
    importJobs: importJobsRepository(scoped),
    mergeCandidates: mergeCandidatesRepository(scoped),
    seedVoix: seedVoixRepository(scoped),
    messages: messagesRepository(scoped),
    actionLog: actionLogRepository(scoped),
    conversations: conversationsRepository(scoped),
    chatMessages: chatMessagesRepository(scoped),
  };
}

/**
 * Porte scopée serveur pour un tenant donné. Async pour figer une signature stable
 * (les futurs repos pourraient initialiser de l'I/O), même si rien n'attend ici.
 */
export async function forUser(userId: string): Promise<UserGate> {
  if (!userId) {
    throw new Error("forUser: userId requis (session absente ?).");
  }
  const scoped = scopedDb(getServerDb(), {
    tenantId: userId,
    now: systemClock,
  });
  return {
    ...buildRepositories(scoped),
    // La transaction re-scope la porte au même tenant (AR-8) et câble des repos sur le handle tx.
    transaction: (fn) =>
      scoped.transaction((tx) => fn(buildRepositories(tx))),
  };
}
