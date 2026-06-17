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

  // Onglets encore en placeholder (story 1.4) : ils rendent l'EmptyState générique.
  // NB : la fiche Contact (reseau/[contactId]) n'est PLUS un placeholder depuis la
  // story 2.4 ; Réglages ne l'est PLUS depuis la story 3.5 (gestion de la Voix) —
  // chacun rend sa propre coquille, couverte par une assertion dédiée plus bas.
  const genericEmptyPages = ["aujourdhui/page.tsx"];

  it("les onglets placeholder rendent un EmptyState générique", () => {
    for (const page of genericEmptyPages) {
      const src = readFileSync(join(appDir, page), "utf8");
      expect(src, `${page} doit rendre un EmptyState`).toContain("EmptyState");
    }
  });

  it("Réglages possède sa PROPRE section « Ta voix » (story 3.5)", () => {
    // Depuis 3.5, Réglages n'est plus un placeholder : il rend la section de gestion du
    // seed de voix (VoiceSection) — jamais un écran blanc. Le seed reste optionnel (FR-16).
    const src = readFileSync(join(appDir, "reglages/page.tsx"), "utf8");
    expect(src, "reglages/page.tsx doit rendre VoiceSection").toContain(
      "VoiceSection",
    );
  });

  it("la fiche Contact (story 2.4) rend sa coquille (jamais un écran blanc)", () => {
    // La fiche délègue au composant ContactDetail (identité Fraunces + froideur +
    // canaux + bouton Écrire + timeline narrative). Un id inexistant/d'autrui passe
    // par notFound() — jamais de fuite, jamais de blanc.
    const src = readFileSync(
      join(appDir, "reseau/[contactId]/page.tsx"),
      "utf8",
    );
    expect(src, "la fiche doit rendre ContactDetail").toContain("ContactDetail");
    expect(src, "la fiche gère l'absence via notFound").toContain("notFound");
  });

  it("Réseau possède son PROPRE état vide d'amorçage (story 2.1)", () => {
    // La story 2.1 est propriétaire du moment « réseau vide / premier contact » :
    // la page délègue au client qui rend EmptyNetwork (plume + CTA) — jamais un blanc.
    const src = readFileSync(join(appDir, "reseau/page.tsx"), "utf8");
    expect(src, "reseau/page.tsx doit déléguer au ReseauClient").toContain(
      "ReseauClient",
    );
    const client = readFileSync(
      join(process.cwd(), "src/features/contacts/ReseauClient.tsx"),
      "utf8",
    );
    expect(client, "ReseauClient doit rendre EmptyNetwork sur réseau vide").toContain(
      "EmptyNetwork",
    );
  });
});
