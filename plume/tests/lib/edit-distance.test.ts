// Métrique SM-1 — distance d'édition NORMALISÉE (zone neutre, pure).
// On vérifie les cas charnières exigés par l'AC : identique → 0, totalement
// différent → 1, partiel (entre 0 et 1, monotone), et les chaînes vides.

import { describe, expect, it } from "vitest";

import { normalizedLevenshtein } from "@/lib/domain/edit-distance";

describe("normalizedLevenshtein — métrique SM-1", () => {
  it("textes IDENTIQUES → 0 (l'utilisateur a envoyé tel quel)", () => {
    expect(normalizedLevenshtein("Bonjour Léa", "Bonjour Léa")).toBe(0);
    expect(normalizedLevenshtein("a", "a")).toBe(0);
  });

  it("totalement DIFFÉRENTS (même longueur, aucun caractère commun) → 1", () => {
    expect(normalizedLevenshtein("abc", "xyz")).toBe(1);
    expect(normalizedLevenshtein("aaaa", "bbbb")).toBe(1);
  });

  it("DEUX chaînes vides → 0 (rien à éditer, pas de division par zéro)", () => {
    expect(normalizedLevenshtein("", "")).toBe(0);
  });

  it("UNE seule vide → 1 (tout est à insérer/supprimer)", () => {
    expect(normalizedLevenshtein("", "salut")).toBe(1);
    expect(normalizedLevenshtein("salut", "")).toBe(1);
  });

  it("édition PARTIELLE → valeur strictement entre 0 et 1", () => {
    // "chat" → "chats" : 1 insertion sur max(4,5)=5 → 0.2.
    const d = normalizedLevenshtein("chat", "chats");
    expect(d).toBeCloseTo(0.2, 5);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(1);
  });

  it("SYMÉTRIQUE (la distance ne dépend pas de l'ordre des arguments)", () => {
    expect(normalizedLevenshtein("kitten", "sitting")).toBeCloseTo(
      normalizedLevenshtein("sitting", "kitten"),
      10,
    );
  });

  it("borne le résultat dans [0, 1] sur un cas réel", () => {
    const genere = "Bonjour Léa, ravi de te recontacter après tout ce temps.";
    const envoye = "Salut Léa ! Content de te recontacter après tout ce temps.";
    const d = normalizedLevenshtein(genere, envoye);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(1);
  });

  it("Levenshtein classique kitten/sitting = 3 ⇒ 3/7 normalisé", () => {
    expect(normalizedLevenshtein("kitten", "sitting")).toBeCloseTo(3 / 7, 10);
  });
});
