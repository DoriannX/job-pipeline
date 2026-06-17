// ZONE NEUTRE (domain/) — métrique SM-1 : distance d'édition NORMALISÉE.
// Zéro infra, zéro env, zéro I/O, zéro horloge. Pure et testable.
//
// SM-1 (archi l.80-84) : « distance d'édition médiane généré→envoyé < 20% sur 20-30
// messages réels ». Pour comparer des textes de longueurs différentes, on NORMALISE la
// distance de Levenshtein (nombre minimal d'insertions/suppressions/substitutions) par
// la longueur du plus long des deux textes : on obtient un nombre ∈ [0, 1].
//   - 0 = textes identiques (l'utilisateur a envoyé tel quel — le moat « marche ») ;
//   - 1 = textes totalement différents (tout réécrit).
//
// Cette valeur est gardée TRANSACTIONNELLEMENT À L'ENVOI (impossible à rétro-calculer),
// d'où une fonction pure réutilisée par le repository `messages`.

/**
 * Distance de Levenshtein BRUTE entre deux chaînes (nombre minimal d'éditions
 * caractère-à-caractère). Implémentation à deux lignes roulantes : O(n·m) temps,
 * O(min(n,m)) espace. Compare par UNITÉ DE CODE (suffisant et déterministe ici).
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // On itère sur la chaîne la plus longue en colonnes, la plus courte en lignes,
  // pour borner la mémoire de la ligne roulante à min(len).
  const [court, long] = a.length <= b.length ? [a, b] : [b, a];

  let prev = Array.from({ length: court.length + 1 }, (_, i) => i);
  const curr = new Array<number>(court.length + 1);

  for (let i = 1; i <= long.length; i += 1) {
    curr[0] = i;
    const longChar = long.charCodeAt(i - 1);
    for (let j = 1; j <= court.length; j += 1) {
      const cost = longChar === court.charCodeAt(j - 1) ? 0 : 1;
      // min(suppression, insertion, substitution)
      const del = prev[j] + 1;
      const ins = curr[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      curr[j] = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
    }
    // Échange des lignes (prev devient la ligne courante pour l'itération suivante).
    prev = curr.slice();
  }

  return prev[court.length];
}

/**
 * Distance d'édition NORMALISÉE ∈ [0, 1] = Levenshtein(a, b) / max(len(a), len(b)).
 *
 * Cas limites (métrique SM-1) :
 *   - deux chaînes VIDES → 0 (rien à éditer = identiques) ;
 *   - une seule vide → 1 (tout est à insérer/supprimer = totalement différent) ;
 *   - identiques → 0 ; totalement différentes (même longueur) → 1.
 *
 * Pure : aucun I/O, aucune horloge.
 */
export function normalizedLevenshtein(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  // Deux vides : aucune édition nécessaire → 0 (évite la division par zéro).
  if (maxLen === 0) return 0;
  return levenshtein(a, b) / maxLen;
}
