// Façade DÉDUP de la feature Contacts (story 2.2).
//
// La logique PURE (parsing du collage, normalisation, calcul de clé) vit en ZONE
// NEUTRE `@/lib/domain/dedup` : elle est importée des DEUX côtés (la porte de données
// pour calculer `dedup_key`, et la feature pour le parsing/validation) sans qu'une
// feature ne soit jamais importée par `lib/db` (barrières ESLint préservées).
//
// Ce module ré-expose simplement ces utilitaires sous le chemin attendu par la
// feature, pour garder les imports de l'UI/action locaux et lisibles.

export {
  normalizeEmail,
  normalizeName,
  computeDedupKey,
  parseQuickAdd,
  type DedupInput,
  type QuickAddEntry,
} from "@/lib/domain/dedup";
