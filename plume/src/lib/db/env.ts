import "server-only";

// SEUL lecteur de la config DB depuis l'environnement. Server-only : ce module
// ne doit jamais fuiter côté client. Zéro autre rôle que d'exposer la config.
//
// Les autres modules db/ (client.ts factory, schema.ts) restent purs et
// testables : ils ne lisent JAMAIS process.env directement.

export type DbConfig = {
  url: string;
  authToken?: string;
};

/**
 * Lit la config Turso/libSQL depuis l'environnement serveur.
 * Lève si l'URL est absente : on échoue tôt plutôt que de tomber sur une
 * connexion silencieusement cassée.
 */
export function getDbConfig(): DbConfig {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL manquant : renseigne-le dans .env.local (cf. .env.example).",
    );
  }
  return {
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  };
}
