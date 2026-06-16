// Logique de DÉDUPLICATION pure (story 2.2), zone neutre `@/lib/domain/dedup`.
// On couvre : parsing du collage (« Nom, Entreprise », nom seul, lignes vides),
// normalisation (email, nom avec accents/espaces), et le calcul de clé
// email-vs-nom+entreprise (avec préfixe de type pour éviter les collisions).

import { describe, expect, it } from "vitest";

import {
  computeDedupKey,
  normalizeEmail,
  normalizeName,
  parseQuickAdd,
} from "@/lib/domain/dedup";

describe("parseQuickAdd — collage best-effort", () => {
  it("parse un nom seul par ligne", () => {
    expect(parseQuickAdd("Hervé Dupont")).toEqual([{ nom: "Hervé Dupont" }]);
  });

  it("parse « Nom, Entreprise »", () => {
    expect(parseQuickAdd("Léa Martin, Acme")).toEqual([
      { nom: "Léa Martin", entreprise: "Acme" },
    ]);
  });

  it("coupe sur la PREMIÈRE virgule (le reste = entreprise)", () => {
    expect(parseQuickAdd("Nour, Studio Bleu, Paris")).toEqual([
      { nom: "Nour", entreprise: "Studio Bleu, Paris" },
    ]);
  });

  it("ignore les lignes vides ou blanches", () => {
    const out = parseQuickAdd("Alice\n\n   \nBob, Globex\n");
    expect(out).toEqual([
      { nom: "Alice" },
      { nom: "Bob", entreprise: "Globex" },
    ]);
  });

  it("trim chaque champ", () => {
    expect(parseQuickAdd("  Léa  ,  Acme  ")).toEqual([
      { nom: "Léa", entreprise: "Acme" },
    ]);
  });

  it("entreprise vide après la virgule => nom seul (pas de champ vide)", () => {
    expect(parseQuickAdd("Hervé,")).toEqual([{ nom: "Hervé" }]);
  });

  it("ignore une ligne sans nom (« , Acme »)", () => {
    expect(parseQuickAdd(", Acme")).toEqual([]);
  });

  it("gère les retours chariot Windows (\\r\\n)", () => {
    expect(parseQuickAdd("Alice\r\nBob")).toEqual([
      { nom: "Alice" },
      { nom: "Bob" },
    ]);
  });

  it("renvoie [] sur un texte vide", () => {
    expect(parseQuickAdd("")).toEqual([]);
    expect(parseQuickAdd("   \n  ")).toEqual([]);
  });
});

describe("normalizeEmail / normalizeName", () => {
  it("normalise l'email (trim + lowercase)", () => {
    expect(normalizeEmail("  Jean.Dupont@Example.FR ")).toBe(
      "jean.dupont@example.fr",
    );
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail(null)).toBe("");
  });

  it("normalise le nom (trim, lowercase, espaces compressés, sans accents)", () => {
    expect(normalizeName("  Élise   Martin ")).toBe("elise martin");
    expect(normalizeName("ÉLISE martin")).toBe("elise martin");
    expect(normalizeName(undefined)).toBe("");
  });
});

describe("computeDedupKey — email d'abord, sinon nom+entreprise", () => {
  it("préfère l'email normalisé quand il est présent", () => {
    const key = computeDedupKey({
      nom: "Peu importe",
      entreprise: "Acme",
      email: " Jean@Example.FR ",
    });
    expect(key).toBe("email:jean@example.fr");
  });

  it("retombe sur nom+entreprise normalisés sans email", () => {
    const key = computeDedupKey({ nom: "Élise Martin", entreprise: "Acme" });
    expect(key).toBe("name:elise martin|acme");
  });

  it("préfixe le type : email et nom littéral identique ne collisionnent pas", () => {
    const byEmail = computeDedupKey({ nom: "x", email: "a@b.fr" });
    const byName = computeDedupKey({ nom: "a@b.fr" });
    expect(byEmail).not.toBe(byName);
    expect(byEmail).toBe("email:a@b.fr");
    expect(byName).toBe("name:a@b.fr|");
  });

  it("deux saisies équivalentes (casse/accents/espaces) donnent la MÊME clé", () => {
    const a = computeDedupKey({ nom: "Léa  MARTIN", entreprise: "ACME" });
    const b = computeDedupKey({ nom: "lea martin", entreprise: "acme" });
    expect(a).toBe(b);
  });

  it("entreprise absente vs présente => clés distinctes", () => {
    const sans = computeDedupKey({ nom: "Léa" });
    const avec = computeDedupKey({ nom: "Léa", entreprise: "Acme" });
    expect(sans).not.toBe(avec);
  });
});
