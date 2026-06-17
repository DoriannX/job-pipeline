// Stratégie de sélection few-shot bornée (story 3.5, AR-7, NFR-1).
// « N seeds les plus récents » : la liste d'entrée est supposée ordonnée récent → ancien.

import { describe, expect, it } from "vitest";

import { MAX_FEW_SHOT, selectFewShot } from "@/lib/composer/voice";

describe("selectFewShot — N seeds les plus récents, borné", () => {
  it("liste vide → [] (ton neutre, FR-16)", () => {
    expect(selectFewShot([])).toEqual([]);
  });

  it("liste < N → renvoie tout (dans l'ordre reçu = récent → ancien)", () => {
    const seeds = ["récent", "ancien"];
    expect(selectFewShot(seeds)).toEqual(["récent", "ancien"]);
  });

  it("liste = N → renvoie exactement N", () => {
    const seeds = Array.from({ length: MAX_FEW_SHOT }, (_, i) => `s${i}`);
    expect(selectFewShot(seeds)).toHaveLength(MAX_FEW_SHOT);
  });

  it("liste > N → borne à MAX_FEW_SHOT en gardant les PREMIERS (les plus récents)", () => {
    const seeds = Array.from({ length: MAX_FEW_SHOT + 10 }, (_, i) => `s${i}`);
    const chosen = selectFewShot(seeds);
    expect(chosen).toHaveLength(MAX_FEW_SHOT);
    // Les premiers (les plus récents) sont gardés, dans l'ordre.
    expect(chosen).toEqual(seeds.slice(0, MAX_FEW_SHOT));
  });

  it("respecte un `max` explicite", () => {
    const seeds = ["a", "b", "c", "d"];
    expect(selectFewShot(seeds, 2)).toEqual(["a", "b"]);
  });

  it("max <= 0 → [] (jamais d'index négatif)", () => {
    expect(selectFewShot(["a", "b"], 0)).toEqual([]);
    expect(selectFewShot(["a", "b"], -3)).toEqual([]);
  });

  it("ne mute pas la liste d'entrée", () => {
    const seeds = ["a", "b", "c"];
    const copy = [...seeds];
    selectFewShot(seeds, 1);
    expect(seeds).toEqual(copy);
  });
});
