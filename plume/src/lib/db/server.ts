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

import { getServerDb } from "./client";
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
import { scopedDb } from "./scoped";
import {
  seedVoixRepository,
  type SeedVoixRepository,
} from "./voice-repositories";
import { systemClock } from "../domain/time";

/** Surface de données scopée exposée aux features (un repo par entité). */
export type UserGate = {
  contacts: ContactsRepository;
  importJobs: ImportJobsRepository;
  mergeCandidates: MergeCandidatesRepository;
  seedVoix: SeedVoixRepository;
  messages: MessagesRepository;
};

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
    contacts: contactsRepository(scoped),
    importJobs: importJobsRepository(scoped),
    mergeCandidates: mergeCandidatesRepository(scoped),
    seedVoix: seedVoixRepository(scoped),
    messages: messagesRepository(scoped),
  };
}
