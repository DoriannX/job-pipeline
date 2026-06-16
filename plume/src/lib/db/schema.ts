// Schéma Drizzle — tables SEULES (consomme src/lib/domain/enums).
// Source de vérité du schéma libSQL/Turso. Aucune logique, aucun env ici.
//
// TODO(story 1.3) : table `users` (id opaque cuid2, email attribut, timezone,
// voix_ton défaut neutre) + adapter Auth.js, puis `contacts`/`messages`/... au fil
// des epics. Reste vide tant que 1.1 ne pose que le socle + le check de migration CI.

export {};
