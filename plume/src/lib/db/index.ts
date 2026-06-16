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
