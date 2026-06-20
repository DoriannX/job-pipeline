// CONSTRAINT inc.4 : le rewind n'est PAS un tool d'agent — c'est une affordance HUMAINE.
// CAP-4 : la sync du rewind est HÉRITÉE (aucun nouveau write-tool ajouté au registre de sync).
//
// On verrouille par construction : le catalogue exposé à l'agent ne contient AUCUN tool
// `rewind`/`undo`/`delete*` (donner un tel tool serait un footgun — un tour pourrait s'auto-
// annuler ou en annuler un autre, et frôler la frontière R/W destructive). « L'humain seul
// annule » (parité « l'humain seul envoie », Sécu #4).

import { describe, expect, it } from "vitest";

import { buildTools, WRITE_TOOL_NAMES } from "@/lib/agent/tools.server";

describe("rewind n'est jamais exposé à l'agent (Constraint inc.4)", () => {
  it("buildTools n'expose QUE les tools connus — aucun rewind/undo/delete", () => {
    const tools = buildTools("user-1", "turn-1");
    const names = Object.keys(tools);

    // Catalogue exact attendu (read + 4 write-tools) — aucune surface destructive en plus.
    expect(new Set(names)).toEqual(
      new Set([
        "queryContacts",
        "seedContacts",
        "createContact",
        "importContacts",
        "composeMessage",
      ]),
    );
    // Aucun tool d'annulation/suppression, sous aucune graphie.
    expect(names.some((n) => /rewind|undo|annul|delete|remove|archive/i.test(n))).toBe(
      false,
    );
  });

  it("CAP-4 : le registre de sync n'a PAS gagné de write-tool pour le rewind (sync héritée)", () => {
    // Le rewind passe par une server action + l'invalidation héritée d'inc.2 ; il n'introduit
    // aucun write-tool. Le registre reste exactement celui d'inc.3.
    expect([...WRITE_TOOL_NAMES].sort()).toEqual([
      "composeMessage",
      "createContact",
      "importContacts",
      "seedContacts",
    ]);
    expect(WRITE_TOOL_NAMES.has("rewind")).toBe(false);
  });
});
