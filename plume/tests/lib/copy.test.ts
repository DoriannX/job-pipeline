// TABLE DE VECTEURS entrée→sortie pour `sanitize()` (story 3.2, AR-3, FR-11).
//
// Un cas EXPLICITE par catégorie de Tell, avec la sortie EXACTE attendue. Cette
// table est la spec exécutable du mapping : si un comportement change, un vecteur
// casse (et `SANITIZE_VERSION` doit être incrémenté). Les caractères « Tell » sont
// écrits en échappements `\u{...}` pour rester lisibles et sans ambiguïté visuelle.

import { describe, expect, it } from "vitest";

import {
  MAX_SANITIZE_RETRIES,
  SANITIZE_VERSION,
  hasTells,
  sanitize,
} from "@/lib/copy";

describe("sanitize — constantes versionnées (AR-3)", () => {
  it("expose une version de nettoyage stable (entier)", () => {
    expect(SANITIZE_VERSION).toBe(1);
    expect(Number.isInteger(SANITIZE_VERSION)).toBe(true);
  });

  it("fixe la borne MAX_SANITIZE_RETRIES = 2", () => {
    expect(MAX_SANITIZE_RETRIES).toBe(2);
  });
});

describe("sanitize — table de vecteurs (un cas par catégorie de Tell)", () => {
  // [description, entrée, sortie attendue]
  const vecteurs: Array<[string, string, string]> = [
    // --- Tirets cadratin & cousins ----------------------------------------
    [
      "cadratin U+2014 (em dash) → séparateur ASCII",
      "Paris—Lyon",
      "Paris - Lyon",
    ],
    [
      "demi-cadratin U+2013 (en dash) → séparateur ASCII",
      "Paris–Lyon",
      "Paris - Lyon",
    ],
    [
      "barre horizontale U+2015 → séparateur ASCII",
      "Paris―Lyon",
      "Paris - Lyon",
    ],
    [
      "cadratin déjà entouré d'espaces (collapse absorbe les doublons)",
      "Paris — Lyon",
      "Paris - Lyon",
    ],

    // --- Espaces exotiques -------------------------------------------------
    ["NBSP U+00A0 → espace normale", "bonjour Théo", "bonjour Théo"],
    [
      "espace fine insécable U+202F → espace normale",
      "12 345",
      "12 345",
    ],
    ["espace fine U+2009 → espace normale", "a b", "a b"],
    ["espace idéographique U+3000 → espace normale", "a　b", "a b"],

    // --- Caractères invisibles (zero-width / BOM) -------------------------
    ["ZWSP U+200B supprimé", "in​visible", "invisible"],
    ["ZWNJ U+200C supprimé", "in‌visible", "invisible"],
    ["ZWJ U+200D supprimé (hors emoji)", "in‍visible", "invisible"],
    ["BOM U+FEFF supprimé", "﻿début", "début"],

    // --- Emojis ------------------------------------------------------------
    ["emoji simple supprimé", "Bravo \u{1F600}", "Bravo"],
    [
      "emoji + modificateur de teinte (skin-tone) — séquence entière",
      "Salut \u{1F44D}\u{1F3FF}",
      "Salut",
    ],
    [
      "séquence ZWJ (famille) — aucun demi-emoji résiduel",
      "Famille \u{1F468}‍\u{1F469}‍\u{1F467}",
      "Famille",
    ],
    [
      "drapeau regional-indicator (FR) supprimé",
      "Vive la \u{1F1EB}\u{1F1F7}",
      "Vive la",
    ],
    [
      "emoji avec variation selector VS16",
      "Coeur ❤️",
      "Coeur",
    ],

    // --- Texte déjà propre = inchangé -------------------------------------
    [
      "texte ASCII propre inchangé",
      "Bonjour, comment vas-tu ?",
      "Bonjour, comment vas-tu ?",
    ],
    [
      "accents français (NFC) préservés",
      "Élise a déménagé à Châteauroux",
      "Élise a déménagé à Châteauroux",
    ],
    ["chaîne vide → chaîne vide", "", ""],

    // --- Mix : idempotence sur un cocktail de Tells -----------------------
    [
      "mix cadratin + NBSP + zero-width + emoji",
      "Salut Théo—​bientôt \u{1F600}",
      "Salut Théo - bientôt",
    ],

    // --- Structure multi-paragraphe PRÉSERVÉE (les \n significatifs survivent) ---
    [
      "paragraphes préservés (seuls les espaces horizontaux sont collapsés)",
      "Bonjour,\n\nMerci pour l'appel.\n\nÀ bientôt,\nThéo",
      "Bonjour,\n\nMerci pour l'appel.\n\nÀ bientôt,\nThéo",
    ],
    [
      "espaces en bord de ligne nettoyés, saut de ligne gardé",
      "Ligne un   \n   Ligne deux",
      "Ligne un\nLigne deux",
    ],
    [
      "sauts de ligne multiples bornés à une ligne blanche",
      "A\n\n\n\nB",
      "A\n\nB",
    ],

    // --- Keycap : pas de combining orphelin (U+20E3) ----------------------
    [
      "keycap 1️⃣ → chiffre seul, aucun U+20E3 résiduel",
      "Option \u{31}\u{FE0F}\u{20E3} dispo",
      "Option 1 dispo",
    ],
  ];

  it.each(vecteurs)("%s", (_desc, input, expected) => {
    expect(sanitize(input)).toBe(expected);
  });

  it.each(vecteurs)("idempotent — %s", (_desc, input) => {
    const once = sanitize(input);
    expect(sanitize(once)).toBe(once);
  });
});

describe("sanitize — invariants de sortie", () => {
  const echantillons = [
    "Paris—Lyon–Marseille―Nice",
    "tout plein​de‌marqueurs\u{1F600}\u{1F1EB}\u{1F1F7}",
    "rien à nettoyer ici",
  ];

  it("aucun cadratin/cousin ne subsiste", () => {
    for (const s of echantillons) {
      expect(/[–—―]/.test(sanitize(s))).toBe(false);
    }
  });

  it("aucun Extended_Pictographic ne subsiste", () => {
    for (const s of echantillons) {
      expect(/\p{Extended_Pictographic}/u.test(sanitize(s))).toBe(false);
    }
  });

  it("aucun zero-width / BOM ne subsiste", () => {
    for (const s of echantillons) {
      expect(/[​‌‍﻿]/.test(sanitize(s))).toBe(false);
    }
  });

  it("aucune espace double ni bord non trimé", () => {
    for (const s of echantillons) {
      const out = sanitize(s);
      expect(out).toBe(out.trim());
      expect(/ {2,}/.test(out)).toBe(false);
    }
  });
});

describe("hasTells — détecteur pour la boucle bornée (3.3)", () => {
  it("détecte cadratin, invisible, emoji", () => {
    expect(hasTells("a—b")).toBe(true);
    expect(hasTells("a​b")).toBe(true);
    expect(hasTells("a\u{1F600}b")).toBe(true);
  });

  it("renvoie false sur un texte propre", () => {
    expect(hasTells("Bonjour, ça va ?")).toBe(false);
    expect(hasTells("")).toBe(false);
  });

  it("conséquence de l'idempotence : hasTells(sanitize(x)) est toujours false", () => {
    const sale = "Salut Théo—​ \u{1F600}\u{1F1EB}\u{1F1F7}";
    expect(hasTells(sanitize(sale))).toBe(false);
  });
});
