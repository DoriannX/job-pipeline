// Factory de client Drizzle/libSQL — PURE et testable.
// ZÉRO lecture d'env au module-load, PAS de `import 'server-only'` ici : on doit
// pouvoir instancier une db en mémoire dans les tests sans toucher l'environnement.
//
// Le chemin serveur (singleton paresseux ci-dessous) lit l'env via env.ts à la
// 1ʳᵉ demande seulement.

import { createClient, type Config } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "./schema";

export type DbConfig = Config;
export type Db = LibSQLDatabase<typeof schema>;

/** Crée un client Drizzle à partir d'une config explicite (aucun env lu). */
export function createDb(config: DbConfig): Db {
  return drizzle(createClient(config), { schema });
}

// --- Singleton serveur paresseux ---
// Créé à la 1ʳᵉ demande, lit l'env via le chemin serveur (env.ts est server-only).
let serverDb: Db | undefined;

/**
 * Renvoie le client serveur partagé, instancié paresseusement.
 * L'import de env.ts est dynamique pour garder createDb() pur : tant que
 * personne n'appelle getServerDb(), aucune dépendance server-only n'est tirée.
 */
export function getServerDb(): Db {
  if (!serverDb) {
    // Import paresseux : evite de charger server-only tant que non nécessaire.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDbConfig } = require("./env") as typeof import("./env");
    serverDb = createDb(getDbConfig());
  }
  return serverDb;
}
