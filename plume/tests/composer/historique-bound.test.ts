// Borne d'INJECTION de l'historique (story 3.10, AC 5) — « clampé, pas honoré tel quel ».
//
// `clampHistorique` est le point UNIQUE de troncature serveur avant injection au prompt
// (coût NFR-5 / perf NFR-1). Pur, sans I/O : testable directement. On verrouille : vide/NULL
// → null (aucune injection) ; sous la borne → inchangé (trim) ; au-delà → tronqué à MAX.

import { describe, expect, it } from "vitest";

import { clampHistorique, MAX_HISTORIQUE } from "@/lib/composer/pipeline.server";

describe("clampHistorique — borne d'injection (story 3.10)", () => {
  it("NULL / undefined / vide → null (aucune injection)", () => {
    expect(clampHistorique(null)).toBeNull();
    expect(clampHistorique(undefined)).toBeNull();
    expect(clampHistorique("")).toBeNull();
    expect(clampHistorique("   \n\t ")).toBeNull();
  });

  it("sous la borne → renvoyé tel quel (trim des bords)", () => {
    expect(clampHistorique("  un échange court  ")).toBe("un échange court");
  });

  it("au-delà de MAX_HISTORIQUE → tronqué à la longueur max", () => {
    const long = "a".repeat(MAX_HISTORIQUE + 500);
    const clamped = clampHistorique(long);
    expect(clamped).not.toBeNull();
    expect(clamped!.length).toBe(MAX_HISTORIQUE);
  });

  it("tronque par la TÊTE → garde l'échange le PLUS RÉCENT (la queue)", () => {
    // Le plus ancien en tête, le plus récent en queue : la troncature doit conserver
    // la fin (« rebondir sur le dernier point »), jamais le début.
    const recent = "DERNIER POINT EN SUSPENS";
    const histo = "x".repeat(MAX_HISTORIQUE) + recent;
    const clamped = clampHistorique(histo)!;
    expect(clamped.length).toBe(MAX_HISTORIQUE);
    expect(clamped.endsWith(recent)).toBe(true);
    expect(clamped.startsWith("x")).toBe(true);
  });

  it("exactement à la borne → inchangé", () => {
    const exact = "b".repeat(MAX_HISTORIQUE);
    expect(clampHistorique(exact)).toBe(exact);
  });
});
