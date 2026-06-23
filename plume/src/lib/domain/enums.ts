// ZONE NEUTRE (domain/) — source UNIQUE des énumérations métier. Zéro infra, zéro
// env, zéro I/O. Le schéma Drizzle (src/lib/db/schema.ts) consomme ces unions pour
// typer les colonnes `canal_prefere` / `source`, et la validation Zod à la frontière
// s'appuie dessus. Aucune valeur littérale d'enum ne doit être ré-écrite ailleurs.

/**
 * Canal de contact préféré — 5 canaux (FR-2 ; + Discord story 7.10/F10).
 * Chaque valeur correspond 1:1 à une icône maison (`@/design/icons`).
 */
export const CANAUX = ["linkedin", "email", "whatsapp", "sms", "discord"] as const;
export type Canal = (typeof CANAUX)[number];

/** Garde de type : `v` est-il un canal connu ? */
export function isCanal(v: unknown): v is Canal {
  return typeof v === "string" && (CANAUX as readonly string[]).includes(v);
}

/**
 * Statut d'un Message dans sa machine à états (AR-5). Valeurs NON traduites
 * (clé stable, stockée en `text` ; le libellé FR vit dans `lib/copy.ts`).
 *
 * La story 3.6 n'écrit que la transition `brouillon → envoye` (Marquer Envoyé) ;
 * le RESTE du cycle (`vu`/`repondu`/`ignore`) est consommé par les Relances en
 * Epic 4 (story 3.8). On fige l'union COMPLÈTE dès maintenant pour que les
 * timestamps/états que les Relances liront soient conçus d'emblée (AR-5).
 */
export const MESSAGE_STATUS = [
  "brouillon",
  "envoye",
  "vu",
  "repondu",
  "ignore",
] as const;
export type MessageStatut = (typeof MESSAGE_STATUS)[number];

/** Garde de type : `v` est-il un statut de Message connu ? */
export function isMessageStatut(v: unknown): v is MessageStatut {
  return (
    typeof v === "string" && (MESSAGE_STATUS as readonly string[]).includes(v)
  );
}

/**
 * Provenance d'un Contact (AR-9, AR-16). 'manuel' par défaut (story 2.1) ;
 * 'rapide' (collage multiple, story 2.2) et 'import_csv' (backfill LinkedIn,
 * story 2.4+) sont déjà déclarés pour figer l'union dès maintenant.
 *
 * 'seed' (copilote Phase 2) tague la donnée de TEST fabriquée par le write-tool
 * `seedContacts` : taguée par cette valeur (pas de nouvelle colonne), elle ne peut
 * JAMAIS être confondue avec une vraie donnée et se nettoie par un prédicat unique
 * (`where source = 'seed'`).
 */
export const SOURCES = ["manuel", "rapide", "import_csv", "seed"] as const;
export type Source = (typeof SOURCES)[number];

/** Valeur par défaut de `source` quand un Contact est saisi à la main. */
export const SOURCE_DEFAUT: Source = "manuel";
