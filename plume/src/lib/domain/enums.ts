// ZONE NEUTRE (domain/) — source UNIQUE des énumérations métier. Zéro infra, zéro
// env, zéro I/O. Le schéma Drizzle (src/lib/db/schema.ts) consomme ces unions pour
// typer les colonnes `canal_prefere` / `source`, et la validation Zod à la frontière
// s'appuie dessus. Aucune valeur littérale d'enum ne doit être ré-écrite ailleurs.

/**
 * Canal de contact préféré — 4 canaux supportés au MVP (FR-2).
 * Chaque valeur correspond 1:1 à une icône maison (`@/design/icons`).
 */
export const CANAUX = ["linkedin", "email", "whatsapp", "sms"] as const;
export type Canal = (typeof CANAUX)[number];

/** Garde de type : `v` est-il un canal connu ? */
export function isCanal(v: unknown): v is Canal {
  return typeof v === "string" && (CANAUX as readonly string[]).includes(v);
}

/**
 * Provenance d'un Contact (AR-9, AR-16). 'manuel' par défaut (story 2.1) ;
 * 'rapide' (collage multiple, story 2.2) et 'import_csv' (backfill LinkedIn,
 * story 2.4+) sont déjà déclarés pour figer l'union dès maintenant.
 */
export const SOURCES = ["manuel", "rapide", "import_csv"] as const;
export type Source = (typeof SOURCES)[number];

/** Valeur par défaut de `source` quand un Contact est saisi à la main. */
export const SOURCE_DEFAUT: Source = "manuel";
