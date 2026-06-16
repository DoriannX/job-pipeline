import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isTabActive, TAB_HREFS } from "@/components/ui/tab-active";

// Coquille de navigation (story 1.4) — logique d'onglet actif + garde-fous structurels.

describe("onglet actif — logique pure", () => {
  it("marque actif sur la route exacte", () => {
    expect(isTabActive("/aujourdhui", "/aujourdhui")).toBe(true);
    expect(isTabActive("/reseau", "/reseau")).toBe(true);
    expect(isTabActive("/reglages", "/reglages")).toBe(true);
  });

  it("marque actif sur une sous-route (ex. fiche contact)", () => {
    expect(isTabActive("/reseau/abc123", "/reseau")).toBe(true);
  });

  it("ne marque jamais 2 onglets actifs pour un même chemin", () => {
    for (const pathname of ["/aujourdhui", "/reseau", "/reseau/xyz", "/reglages"]) {
      const actives = TAB_HREFS.filter((href) => isTabActive(pathname, href));
      expect(actives.length).toBe(1);
    }
  });

  it("ne déclenche pas de faux positif sur un préfixe partiel", () => {
    // Un chemin qui partage le préfixe textuel mais pas le segment ne doit pas matcher.
    expect(isTabActive("/reseaux-sociaux", "/reseau")).toBe(false);
  });
});

// Plancher : chaque onglet ouvre sur un état vide serein (jamais d'écran blanc).
describe("états vides sereins — présence", () => {
  const appDir = join(process.cwd(), "src/app/(app)");
  const pages = [
    "aujourdhui/page.tsx",
    "reseau/page.tsx",
    "reseau/[contactId]/page.tsx",
    "reglages/page.tsx",
  ];

  it("chaque page d'onglet rend un EmptyState", () => {
    for (const page of pages) {
      const src = readFileSync(join(appDir, page), "utf8");
      expect(src, `${page} doit rendre un EmptyState`).toContain("EmptyState");
    }
  });
});
