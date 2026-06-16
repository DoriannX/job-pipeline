// Barrel client-safe du dossier db/.
// N'expose QUE la porte scopée `forUser` : ni client, ni schema, ni env.
// Tout accès aux données passe par cette porte (invariant n°1 / AR-2, AR-13).

export { forUser, type ScopedDb } from "./scoped";
