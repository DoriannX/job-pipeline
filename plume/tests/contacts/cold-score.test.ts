// Score de FROIDEUR (story 2.3) — bandes + BORNES exactes avec un `now` FIGÉ injecté,
// et ordre de tri (coldnessRank). Tout est pur : aucune horloge système, aucune infra.

import { describe, expect, it } from "vitest";

import {
  coldness,
  coldnessRank,
  SEUIL_FRAIS_JOURS,
  SEUIL_FROID_JOURS,
} from "@/lib/domain/cold-score";
import type { ColdState } from "@/design/tokens";

const JOUR = 24 * 60 * 60 * 1000;
// `now` fixe et arbitraire (déterminisme) : 2026-06-16T00:00:00Z.
const NOW = Date.UTC(2026, 5, 16);

/** Construit un `dernier_contact_at` situé `jours` avant `NOW`. */
const ilYa = (jours: number) => NOW - jours * JOUR;

describe("coldness — bandes & bornes exactes (now injecté)", () => {
  it("null ⇒ jamais contacté (never)", () => {
    expect(coldness(null, NOW)).toBe<ColdState>("never");
  });

  it("0 j (à l'instant) ⇒ frais", () => {
    expect(coldness(NOW, NOW)).toBe<ColdState>("fresh");
  });

  it("29 j ⇒ frais (borne haute du frais)", () => {
    expect(coldness(ilYa(29), NOW)).toBe<ColdState>("fresh");
  });

  it("30 j ⇒ tiède (bascule frais → tiède)", () => {
    expect(coldness(ilYa(30), NOW)).toBe<ColdState>("warm");
  });

  it("90 j ⇒ tiède (borne haute du tiède)", () => {
    expect(coldness(ilYa(90), NOW)).toBe<ColdState>("warm");
  });

  it("91 j ⇒ froid (bascule tiède → froid)", () => {
    expect(coldness(ilYa(91), NOW)).toBe<ColdState>("cold");
  });

  it("très ancien (365 j) ⇒ froid", () => {
    expect(coldness(ilYa(365), NOW)).toBe<ColdState>("cold");
  });

  it("ignore les fractions de jour sous le seuil (29 j + 23 h ⇒ encore frais)", () => {
    expect(coldness(NOW - (29 * JOUR + 23 * 60 * 60 * 1000), NOW)).toBe<ColdState>(
      "fresh",
    );
  });

  it("expose les seuils nommés (30 / 90 jours)", () => {
    expect(SEUIL_FRAIS_JOURS).toBe(30);
    expect(SEUIL_FROID_JOURS).toBe(90);
  });
});

describe("coldnessRank — ordre « refroidit en premier »", () => {
  it("ordonne never < cold < warm < fresh (plus petit = remonte)", () => {
    expect(coldnessRank("never")).toBeLessThan(coldnessRank("cold"));
    expect(coldnessRank("cold")).toBeLessThan(coldnessRank("warm"));
    expect(coldnessRank("warm")).toBeLessThan(coldnessRank("fresh"));
  });

  it("trie une liste d'états : never, cold, warm, fresh", () => {
    const melange: ColdState[] = ["fresh", "warm", "never", "cold"];
    const trie = [...melange].sort((a, b) => coldnessRank(a) - coldnessRank(b));
    expect(trie).toEqual(["never", "cold", "warm", "fresh"]);
  });
});
