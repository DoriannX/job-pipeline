// Barrel du dossier db/ — façade d'accès aux données.
// N'expose JAMAIS le client, le schéma ni l'env (invariant n°1 / AR-2, AR-13) :
// tout accès passe par la porte scopée et les repositories d'entités.
//
// Deux surfaces :
//   1. `forUser(userId)` — CONVENANCE SERVEUR (server-only) : câble db serveur +
//      horloge système + repositories. C'est ce qu'utilisent les server actions :
//      `(await forUser(userId)).contacts.list()`.
//   2. `scopedDb` / `forUserDb` (db injectée) + `contactsRepository` — surface
//      GÉNÉRIQUE et testable, pour le harnais de tests (db en mémoire).

export { forUser, type UserGate } from "./server";
export { scopedDb, forUserDb, type ScopedDb } from "./scoped";
export {
  contactsRepository,
  type ContactsRepository,
  type Contact,
  type ContactCreate,
  type ContactUpdate,
  type BulkCreateItem,
  type BulkCreateResult,
} from "./repositories";
export {
  importJobsRepository,
  mergeCandidatesRepository,
  processCsvImport,
  resolveMergeCandidate,
  type ImportJobsRepository,
  type MergeCandidatesRepository,
  type ImportJob,
  type MergeCandidate,
  type ImportReport,
  type ImportProcessDeps,
  type ResolveMergeDeps,
  type MergeDecision,
} from "./import-repositories";
export {
  seedVoixRepository,
  type SeedVoixRepository,
  type SeedVoix,
} from "./voice-repositories";
export {
  messagesRepository,
  type MessagesRepository,
  type Message,
  type GenerationEventRow,
  type CreateDraftInput,
  type MarkSentInput,
  type MarkSentGeneration,
  type EditSentInput,
  type EditSentResult,
  type SetStatusInput,
  type SetStatusResult,
} from "./message-repositories";
export {
  actionLogRepository,
  type ActionLogRepository,
  type ActionLogEntry,
  type RecordActionInput,
} from "./action-log-repositories";
export {
  conversationsRepository,
  chatMessagesRepository,
  deriveTitre,
  MAX_CONTEXT_TURNS,
  TITRE_MAX_LENGTH,
  type ConversationsRepository,
  type ChatMessagesRepository,
  type Conversation,
  type ChatMessageRow,
  type AppendChatMessage,
} from "./conversation-repositories";
export type { JournalSink, MutationRecord, JournaledOp } from "./journal";
export type { ActionLogPrevState } from "./schema";
// Dev-only : création de session sans Google (cf. src/lib/auth-dev.ts). Server-only.
export { createDevSession, type DevSession } from "./dev-auth";
