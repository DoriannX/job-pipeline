// Validation Zod à la frontière de la feature Contacts (story 2.1).
// On vérifie l'invariant dur (« nom requis ») et le comportement tolérant attendu :
// trim, vide => undefined, canal hors-liste rejeté, handles optionnels.

import { describe, expect, it } from "vitest";

import {
  contactInputSchema,
  isHandlesEmpty,
} from "@/features/contacts/validation";

describe("contactInputSchema — frontière Zod", () => {
  it("accepte un contact avec le seul nom requis", () => {
    const r = contactInputSchema.safeParse({ nom: "Hervé" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.nom).toBe("Hervé");
  });

  it("rejette un nom vide / blanc", () => {
    expect(contactInputSchema.safeParse({ nom: "" }).success).toBe(false);
    expect(contactInputSchema.safeParse({ nom: "   " }).success).toBe(false);
    expect(contactInputSchema.safeParse({}).success).toBe(false);
  });

  it("trim le nom", () => {
    const r = contactInputSchema.safeParse({ nom: "  Léa  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.nom).toBe("Léa");
  });

  it("accepte un canal valide et rejette un canal inconnu", () => {
    expect(
      contactInputSchema.safeParse({ nom: "A", canalPrefere: "email" }).success,
    ).toBe(true);
    expect(
      contactInputSchema.safeParse({ nom: "A", canalPrefere: "fax" }).success,
    ).toBe(false);
  });

  it("canal vide est traité comme absent", () => {
    const r = contactInputSchema.safeParse({ nom: "A", canalPrefere: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.canalPrefere).toBeUndefined();
  });

  it("normalise les handles (trim, vide => undefined)", () => {
    const r = contactInputSchema.safeParse({
      nom: "A",
      handles: { email: "  a@b.fr ", linkedin: "", phone: "0600", whatsapp: "" },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.handles?.email).toBe("a@b.fr");
      expect(r.data.handles?.linkedin).toBeUndefined();
      expect(r.data.handles?.phone).toBe("0600");
    }
  });

  it("isHandlesEmpty détecte l'absence totale de coordonnées", () => {
    expect(isHandlesEmpty(undefined)).toBe(true);
    expect(isHandlesEmpty({})).toBe(true);
    expect(
      isHandlesEmpty({
        linkedin: undefined,
        email: undefined,
        phone: undefined,
        whatsapp: undefined,
      }),
    ).toBe(true);
    expect(isHandlesEmpty({ email: "a@b.fr" })).toBe(false);
  });
});
