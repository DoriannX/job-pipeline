// Galerie Réseau (story 2.3) — tri (froideur / nom) + recherche par nom, en logique
// PURE (sans React). On vérifie l'ordre « refroidit en premier » et le filtre insensible
// à la casse/aux accents.

import { describe, expect, it } from "vitest";

import {
  buildGallery,
  filterByName,
  sortContacts,
} from "@/features/contacts/gallery";
import type { ContactView } from "@/features/contacts/types";
import type { ColdState } from "@/design/tokens";

/** Fabrique minimale d'un ContactView (seuls nom + froideur importent ici). */
function contact(
  id: string,
  nom: string,
  cold: ColdState,
): ContactView {
  return {
    id,
    nom,
    canalPrefere: null,
    handles: null,
    notes: null,
    dernierContactAt: null,
    coldness: cold,
  };
}

const ECHANTILLON: ContactView[] = [
  contact("1", "Zoé", "fresh"),
  contact("2", "Amir", "cold"),
  contact("3", "Bao", "never"),
  contact("4", "Chloé", "warm"),
];

describe("sortContacts — tri par froideur (défaut)", () => {
  it("remonte les liens qui refroidissent : never, cold, warm, fresh", () => {
    const out = sortContacts(ECHANTILLON, "coldness").map((c) => c.coldness);
    expect(out).toEqual(["never", "cold", "warm", "fresh"]);
  });

  it("à froideur égale, départage par nom (ordre déterministe)", () => {
    const memeFroid: ContactView[] = [
      contact("a", "Bruno", "warm"),
      contact("b", "Alice", "warm"),
    ];
    expect(sortContacts(memeFroid, "coldness").map((c) => c.nom)).toEqual([
      "Alice",
      "Bruno",
    ]);
  });

  it("n'altère pas le tableau d'entrée (copie)", () => {
    const avant = ECHANTILLON.map((c) => c.id);
    sortContacts(ECHANTILLON, "coldness");
    expect(ECHANTILLON.map((c) => c.id)).toEqual(avant);
  });
});

describe("sortContacts — tri par nom", () => {
  it("ordonne alphabétiquement (FR, insensible accents/casse)", () => {
    expect(sortContacts(ECHANTILLON, "name").map((c) => c.nom)).toEqual([
      "Amir",
      "Bao",
      "Chloé",
      "Zoé",
    ]);
  });
});

describe("filterByName — recherche par nom", () => {
  it("requête vide ⇒ tout le réseau", () => {
    expect(filterByName(ECHANTILLON, "")).toHaveLength(4);
    expect(filterByName(ECHANTILLON, "   ")).toHaveLength(4);
  });

  it("filtre par sous-chaîne, insensible à la casse", () => {
    expect(filterByName(ECHANTILLON, "am").map((c) => c.nom)).toEqual(["Amir"]);
  });

  it("insensible aux accents (chloe ↔ Chloé)", () => {
    expect(filterByName(ECHANTILLON, "chloe").map((c) => c.nom)).toEqual([
      "Chloé",
    ]);
    expect(filterByName(ECHANTILLON, "zoe").map((c) => c.nom)).toEqual(["Zoé"]);
  });

  it("aucune correspondance ⇒ liste vide", () => {
    expect(filterByName(ECHANTILLON, "introuvable")).toEqual([]);
  });
});

describe("buildGallery — filtre puis tri", () => {
  it("combine recherche + tri par froideur", () => {
    const out = buildGallery(ECHANTILLON, { query: "o", sort: "coldness" });
    // « o » matche Zoé (fresh), Bao (never), Chloé (warm) → triés par froideur.
    expect(out.map((c) => c.nom)).toEqual(["Bao", "Chloé", "Zoé"]);
  });

  it("résultat indépendant de l'ordre d'entrée (déterministe)", () => {
    const melange = [...ECHANTILLON].reverse();
    const a = buildGallery(ECHANTILLON, { query: "", sort: "coldness" });
    const b = buildGallery(melange, { query: "", sort: "coldness" });
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });
});
