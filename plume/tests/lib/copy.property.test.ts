// PROPERTY-TEST de `sanitize()` (story 3.2 — OBLIGATOIRE, architecture l.271/407).
//
// La table de vecteurs (copy.test.ts) prouve des cas NOMMÉS ; ici on prouve des
// INVARIANTS sur un large échantillon généré, y compris des chaînes truffées de
// Tells. fast-check « shrink » automatiquement vers le plus petit contre-exemple
// en cas d'échec — on a donc un mini-fuzzer reproductible (seed dans la sortie).
//
// Trois propriétés, dans l'ordre d'importance pour AR-3 :
//   1. IDEMPOTENCE   : sanitize(sanitize(x)) === sanitize(x)  (LA propriété centrale) ;
//   2. INVARIANT cadratin : la sortie ne contient aucun cadratin/cousin ;
//   3. INVARIANT emoji    : la sortie ne contient aucun \p{Extended_Pictographic}.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { sanitize } from "@/lib/copy";

// Tells injectés dans les générateurs pour stresser le nettoyage (pas seulement de
// l'ASCII aléatoire, qui ne déclencherait jamais les branches intéressantes).
const TELLS = [
  "—", // U+2014 cadratin
  "–", // U+2013 demi-cadratin
  "―", // U+2015 barre horizontale
  " ", // NBSP
  " ", // espace fine insécable
  "​", // ZWSP
  "‌", // ZWNJ
  "‍", // ZWJ
  "﻿", // BOM
  "\u{1F600}", // emoji simple
  "\u{1F44D}\u{1F3FF}", // emoji + skin-tone
  "\u{1F468}‍\u{1F469}‍\u{1F467}", // séquence ZWJ (famille)
  "\u{1F1EB}\u{1F1F7}", // drapeau (regional indicators)
  "❤️", // coeur + VS16
  "\n", // saut de ligne — doit être PRÉSERVÉ (pas un Tell)
  "\n\n", // double saut (frontière de paragraphe)
  "\t", // tabulation — collapse horizontal (mais pas le \n)
];

// Générateur de « texte réaliste sale » : alternance de fragments Unicode
// quelconques et de Tells piochés ci-dessus. En fast-check v4, `fc.string()` tire
// déjà des points de code arbitraires sur tout le plan Unicode (`unit: "binary"`
// pour inclure surrogates/astral) ; on y entremêle des Tells ciblés pour stresser
// chaque branche du nettoyage.
const arbDirtyText = fc
  .array(
    fc.oneof(
      fc.string(),
      fc.string({ unit: "binary" }),
      fc.constantFrom(...TELLS),
    ),
    { maxLength: 24 },
  )
  .map((parts) => parts.join(""));

describe("sanitize — propriétés (fast-check)", () => {
  it("idempotence : sanitize(sanitize(x)) === sanitize(x)", () => {
    fc.assert(
      fc.property(arbDirtyText, (x) => {
        const once = sanitize(x);
        expect(sanitize(once)).toBe(once);
      }),
      { numRuns: 1000 },
    );
  });

  it("invariant : la sortie ne contient aucun cadratin/cousin", () => {
    fc.assert(
      fc.property(arbDirtyText, (x) => {
        expect(/[–—―]/.test(sanitize(x))).toBe(false);
      }),
      { numRuns: 1000 },
    );
  });

  it("invariant : la sortie ne contient aucun \\p{Extended_Pictographic}", () => {
    fc.assert(
      fc.property(arbDirtyText, (x) => {
        expect(/\p{Extended_Pictographic}/u.test(sanitize(x))).toBe(false);
      }),
      { numRuns: 1000 },
    );
  });

  it("invariant : la sortie n'a ni espace double ni bord non trimé", () => {
    fc.assert(
      fc.property(arbDirtyText, (x) => {
        const out = sanitize(x);
        expect(out).toBe(out.trim());
        expect(/ {2,}/.test(out)).toBe(false);
      }),
      { numRuns: 1000 },
    );
  });

  it("invariant : la sortie ne contient aucun zero-width / BOM", () => {
    fc.assert(
      fc.property(arbDirtyText, (x) => {
        expect(/[​‌‍﻿]/.test(sanitize(x))).toBe(false);
      }),
      { numRuns: 1000 },
    );
  });

  // Texte multi-paragraphe DÉJÀ propre (mots de lettres ASCII reliés par "\n\n") :
  // sanitize() ne doit RIEN changer — preuve que les paragraphes ne sont JAMAIS
  // fusionnés (le collapse ne touche que l'espace horizontal, jamais les `\n`).
  const arbMot = fc
    .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz".split("")), {
      minLength: 1,
      maxLength: 6,
    })
    .map((lettres) => lettres.join(""));
  const arbParagraphes = fc
    .array(arbMot, { minLength: 2, maxLength: 5 })
    .map((mots) => mots.join("\n\n"));

  it("invariant : un texte multi-paragraphe propre est inchangé (paragraphes préservés)", () => {
    fc.assert(
      fc.property(arbParagraphes, (x) => {
        expect(sanitize(x)).toBe(x);
      }),
      { numRuns: 500 },
    );
  });
});
