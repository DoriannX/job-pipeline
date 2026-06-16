// ZONE NEUTRE (domain/) — logique de DÉDUPLICATION pure (story 2.2). Zéro infra,
// zéro env, zéro I/O. Importable des DEUX côtés sans casser les barrières :
//   - par la porte de données (src/lib/db/repositories.ts) pour calculer `dedup_key` ;
//   - par la feature Contacts (parsing du collage, validation) côté frontière.
//
// La clé de dédup borne l'unicité PAR TENANT (l'index unique SQL est sur
// `(user_id, dedup_key)`) : deux users peuvent partager la même clé sans collision.
//
// Règle métier (AR-9) : clé = email normalisé s'il existe, sinon nom + entreprise
// normalisés. Le type est préfixé (`email:` vs `name:`) pour qu'un email « jean@x.fr »
// ne puisse jamais entrer en collision avec un nom littéral identique.

/** Entrée minimale pour calculer une clé de dédup. */
export type DedupInput = {
  nom: string;
  entreprise?: string | null;
  email?: string | null;
};

/** Une ligne d'ajout rapide parsée (best-effort « Nom, Entreprise »). */
export type QuickAddEntry = {
  nom: string;
  entreprise?: string;
};

/**
 * Normalise un email : trim + lowercase. Suffisant au MVP (pas de canonicalisation
 * Gmail-style des points/+, volontairement, pour rester prévisible et sans surprise).
 * Renvoie une chaîne vide si l'entrée est vide/espace.
 */
export function normalizeEmail(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/**
 * Normalise un nom (ou une entreprise) pour la comparaison : trim, lowercase,
 * espaces internes compressés, accents simples retirés (NFD + suppression des
 * diacritiques). « Élise  Martin » et « elise martin » deviennent la même clé.
 */
export function normalizeName(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    // Retire les diacritiques combinants (accents simples) ; le reste est conservé.
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Calcule la clé de dédup d'un contact (AR-9) :
 *   - email normalisé s'il est présent → `email:<email>` ;
 *   - sinon nom + entreprise normalisés → `name:<nom>|<entreprise>`.
 * Le préfixe de type évite toute collision entre les deux espaces de clés.
 */
export function computeDedupKey(input: DedupInput): string {
  const email = normalizeEmail(input.email);
  if (email) {
    return `email:${email}`;
  }
  const nom = normalizeName(input.nom);
  const entreprise = normalizeName(input.entreprise);
  return `name:${nom}|${entreprise}`;
}

/**
 * Parse le texte collé en N entrées (FR-34), best-effort :
 *   - une entrée par ligne ; les lignes vides (ou blanches) sont ignorées ;
 *   - « Nom, Entreprise » → { nom, entreprise } (on coupe sur la PREMIÈRE virgule,
 *     le reste de la ligne formant l'entreprise) ;
 *   - sinon la ligne entière est le nom ;
 *   - une entrée dont le nom est vide après trim est ignorée (ex. « , Acme »).
 */
export function parseQuickAdd(text: string): QuickAddEntry[] {
  const entries: QuickAddEntry[] = [];
  for (const rawLine of (text ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const comma = line.indexOf(",");
    if (comma === -1) {
      entries.push({ nom: line });
      continue;
    }

    const nom = line.slice(0, comma).trim();
    const entreprise = line.slice(comma + 1).trim();
    if (!nom) continue; // « , Entreprise » sans nom : on ignore (best-effort).
    entries.push(entreprise ? { nom, entreprise } : { nom });
  }
  return entries;
}
