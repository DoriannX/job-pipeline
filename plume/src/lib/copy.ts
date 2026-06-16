import "server-only";

// POINT UNIQUE DE NETTOYAGE DES « TELLS » D'IA (story 3.2, FR-11, AR-3).
//
// `sanitize()` est le SEUL endroit où l'on retire les marqueurs qui « sentent le
// robot » (tirets cadratins, espaces exotiques, caractères invisibles, emojis).
// La génération (3.3) ET l'import de voix (3.5) le réutiliseront tel quel : aucun
// `text.replace('—','-')` ad-hoc ailleurs dans la base (anti-pattern archi l.312).
//
// `server-only` : ce module est volontairement gardé côté serveur. Le nettoyage
// est déterministe et n'a rien d'infra, mais on le tient hors du bundle client
// pour qu'il n'existe qu'UN chemin de nettoyage (côté serveur, où Claude répond),
// et que la frontière soit vérifiable par ESLint (cf. eslint.config.mjs).
//
// Propriétés garanties (AR-3), prouvées par les tests (table de vecteurs + property) :
//   - DÉTERMINISTE  : même entrée → même sortie, sans état ni horloge ;
//   - IDEMPOTENT    : sanitize(sanitize(x)) === sanitize(x) pour TOUT x ;
//   - ORDONNÉ       : étapes appliquées dans un ordre fixe et documenté (voir plus bas) ;
//   - BORNÉ         : O(n) sur la longueur de l'entrée, pas de boucle non bornée.

/**
 * Version du nettoyage. On choisit un ENTIER monotone (et non une chaîne sémantique)
 * parce qu'il sera persisté tel quel dans `generation_events.sanitize_version` (3.3) :
 * un entier se compare/indexe trivialement et trace sans ambiguïté quelle passe de
 * nettoyage a produit un texte. À INCRÉMENTER à chaque changement observable du mapping
 * (un nouveau cousin de cadratin, un autre invisible, etc.), jamais autrement.
 */
export const SANITIZE_VERSION = 1;

/**
 * Borne de la future boucle `sanitize → re-valide` (génération 3.3, archi l.293).
 * La boucle elle-même vit dans la génération ; ici on FIXE seulement la constante
 * pour qu'elle ait une source unique. `sanitize()` étant idempotent, un 2e passage
 * est déjà un no-op : cette borne protège la *re-validation* (détection de Tells
 * résiduels après un appel modèle), pas le nettoyage lui-même.
 */
export const MAX_SANITIZE_RETRIES = 2;

// --- Mappings et classes de caractères --------------------------------------
//
// ORDRE DES ÉTAPES (décidé et figé — garantit l'idempotence) :
//   1. NORMALISATION NFC d'abord. On stabilise la représentation Unicode (formes
//      composées) AVANT toute substitution : ainsi les étapes suivantes voient une
//      seule forme canonique, et un 2e passage retrouve exactement le même point de
//      départ (NFC est idempotent : NFC(NFC(x)) === NFC(x)).
//   2. MAPPING des tirets « cadratin & cousins » → séparateur ASCII déterministe.
//   3. NBSP / espaces exotiques → espace ASCII normale.
//   4. SUPPRESSION des caractères invisibles (zero-width, BOM).
//   5. SUPPRESSION des emojis (pictogrammes étendus, modificateurs de teinte,
//      regional indicators, keycap, et les ZWJ internes déjà retirés à l'étape 4).
//   6. COLLAPSE des seuls espaces HORIZONTAUX (les sauts de ligne sont PRÉSERVÉS) :
//      espaces/tabs multiples → une espace ; espaces en bord de ligne retirés ;
//      lignes blanches bornées (3+ sauts → 1 ligne blanche) ; trim des bords.
//      On NE fusionne PAS les paragraphes : la structure d'un message (et d'un corpus
//      de voix) fait partie de « ta voix » — l'aplatir trahirait l'intention (3.3/3.5).
//
// Pourquoi cet ordre est idempotent : aucune étape ne RÉINTRODUIT un caractère
// qu'une étape précédente cible. Les tirets deviennent de l'ASCII (jamais re-cadratiné) ;
// les remplacements d'espaces produisent une espace ASCII (re-collapsée sans dommage) ;
// les suppressions sont stables ; le collapse horizontal et le bornage des lignes
// blanches sont stables (une 2e passe ne change rien). Donc sanitize(sanitize(x)) === sanitize(x).

/**
 * Tirets « cadratin et cousins » remplacés par un séparateur ASCII.
 *   - U+2014 — tiret cadratin (em dash), LE Tell d'IA emblématique ;
 *   - U+2013 – tiret demi-cadratin (en dash) ;
 *   - U+2015 ― barre horizontale (horizontal bar).
 * Remplacement choisi : `" - "` (espace, trait d'union ASCII, espace). On préfère
 * un séparateur entouré d'espaces au simple `-` car ces tirets servent d'incise
 * en français (« X — Y » → « X - Y ») ; l'étape 6 (collapse) absorbe les espaces
 * surnuméraires si le cadratin était déjà entouré d'espaces. Le résultat ne contient
 * plus AUCUN cadratin ni cousin (invariant testé).
 */
const EM_DASH_AND_KIN = /[—–―]/g;
const ASCII_DASH = " - ";

/**
 * Espaces « exotiques » ramenées à l'espace ASCII U+0020.
 *   - U+00A0 NBSP (insécable) ;
 *   - U+202F espace fine insécable (NNBSP) ;
 *   - U+2007 espace figure, U+2009 espace fine, U+200A espace ultra-fine ;
 *   - U+2002..U+2006, U+2008 (cadratin/demi-cadratin et autres espaces typographiques) ;
 *   - U+205F espace mathématique moyenne, U+3000 espace idéographique.
 * Toutes deviennent une espace normale, que l'étape 6 collapse si besoin.
 * (On NE touche pas aux \t/\n : le collapse final s'en charge via \s.)
 */
const EXOTIC_SPACES = /[  -   　]/g;

/**
 * Caractères INVISIBLES purement supprimés (aucun remplacement) :
 *   - U+200B ZWSP (zero-width space) ;
 *   - U+200C ZWNJ (zero-width non-joiner) ;
 *   - U+200D ZWJ (zero-width joiner) — aussi le « ciment » des séquences emoji ;
 *   - U+FEFF BOM / zero-width no-break space.
 * Retirer le ZWJ AVANT le strip emoji « casse » les séquences ZWJ (famille,
 * drapeaux de profession…) en pictogrammes isolés, que l'étape 5 supprime ensuite :
 * aucun demi-emoji résiduel.
 */
const ZERO_WIDTH = /[​‌‍﻿]/g;

/**
 * Tout ce qui relève de l'emoji, supprimé en bloc :
 *   - \p{Extended_Pictographic} : pictogrammes étendus (emojis « de base ») ;
 *   - U+1F3FB..U+1F3FF : modificateurs de teinte de peau (skin-tone) ;
 *   - U+1F1E6..U+1F1FF : regional indicators (les drapeaux = 2 indicateurs).
 * Les ZWJ internes ayant déjà été retirés (étape 4), une séquence emoji est ici une
 * suite de pictogrammes/modificateurs/indicateurs adjacents : tous matchés, donc
 * AUCUN demi-emoji ne subsiste. Flag `u` obligatoire pour `\p{...}`.
 */
const EMOJI = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}]/gu;

/** Variation selectors (U+FE00..U+FE0F) : « VS16 » force le rendu emoji d'un
 * caractère ; sans son pictogramme associé (déjà supprimé) il ne doit pas rester. */
const VARIATION_SELECTORS = /[︀-️]/g;

/** Combining enclosing keycap U+20E3 : « ciment » des emojis keycap (ex. `1️⃣` =
 * chiffre + VS16 + U+20E3). La VS16 et le pictogramme retirés, ce combining orphelin
 * doit aussi disparaître pour ne laisser AUCUN demi-emoji (le chiffre, lui, reste). */
const KEYCAP = /⃣/g;

/** Espaces HORIZONTAUX multiples (espaces, tabs, CR, NBSP résiduel… mais PAS `\n`)
 * compressés en une seule espace ASCII. `[^\S\n]` = « blanc qui n'est pas un saut de
 * ligne » : on collapse l'horizontal SANS jamais toucher aux `\n`. */
const HORIZONTAL_WS = /[^\S\n]+/g;
/** Espaces résiduelles en bord de ligne (avant/après un `\n`) → retirées. */
const SPACES_AROUND_NEWLINE = / *\n */g;
/** Lignes blanches en excès : 3 sauts ou plus → une seule ligne blanche (`\n\n`). */
const EXTRA_BLANK_LINES = /\n{3,}/g;

/**
 * Nettoie un texte de tout « Tell » d'IA (FR-11, AR-3) — point UNIQUE de nettoyage.
 *
 * Déterministe, idempotent, ordonné, borné. Voir le bloc « ORDRE DES ÉTAPES »
 * ci-dessus pour le détail et la justification de l'idempotence.
 *
 * @param input texte brut (sortie modèle, corpus importé, libellé…).
 * @returns le texte nettoyé ; chaîne vide si l'entrée est vide.
 */
export function sanitize(input: string): string {
  // 1. NFC d'abord : représentation Unicode canonique stable.
  let out = input.normalize("NFC");

  // 2. Tirets cadratin & cousins → séparateur ASCII.
  out = out.replace(EM_DASH_AND_KIN, ASCII_DASH);

  // 3. Espaces exotiques → espace ASCII.
  out = out.replace(EXOTIC_SPACES, " ");

  // 4. Invisibles (zero-width + BOM) → supprimés (ce qui casse les séquences ZWJ).
  out = out.replace(ZERO_WIDTH, "");

  // 5. Emojis (pictogrammes + skin-tone + regional indicators + variation selectors + keycap).
  out = out.replace(EMOJI, "");
  out = out.replace(VARIATION_SELECTORS, "");
  out = out.replace(KEYCAP, "");

  // 6. Collapse des espaces HORIZONTAUX en PRÉSERVANT les sauts de ligne (structure des
  //    paragraphes conservée), nettoyage des bords de ligne, bornage des lignes blanches, trim.
  out = out.replace(HORIZONTAL_WS, " ");
  out = out.replace(SPACES_AROUND_NEWLINE, "\n");
  out = out.replace(EXTRA_BLANK_LINES, "\n\n");
  out = out.trim();

  return out;
}

/**
 * Détecte la présence d'au moins un « Tell » résiduel — utilitaire pour la future
 * boucle bornée `sanitize → re-valide` (3.3) qui re-valide la sortie modèle.
 * Conséquence directe de l'idempotence : `hasTells(sanitize(x))` est toujours `false`.
 *
 * Minimal et déterministe : `true` dès qu'un cadratin/cousin, un invisible, ou un
 * emoji est présent. (On ne signale PAS les espaces exotiques : elles sont
 * cosmétiques et toujours absorbées par le collapse — pas un Tell « robot ».)
 */
export function hasTells(input: string): boolean {
  const text = input.normalize("NFC");
  // `.test()` sur des regex globales porte un `lastIndex` : on teste via re-création
  // locale (ou reset) pour rester sans état. Ici on recrée des regex non globales.
  return (
    /[—–―]/.test(text) ||
    /[​‌‍﻿]/.test(text) ||
    /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}]/u.test(text)
  );
}
