// CONSTRAINT inc.4 : le REWIND n'est PAS un tool d'agent — c'est une affordance HUMAINE.
// « L'humain seul annule » (parité « l'humain seul envoie », Sécu #4) : donner un tool
// `rewind`/`undo` serait un footgun — un tour pourrait s'auto-annuler ou en annuler un autre.
//
// NUANCE (capacité delete réversible) : l'agent PEUT désormais ARCHIVER (archiveContact /
// archiveContacts / archiveDraft) à la demande de l'utilisateur. C'est un soft-delete RÉVERSIBLE
// (journalisé, défait par le rewind humain), distinct de l'auto-annulation interdite. La frontière
// verrouillée n'est donc plus « aucun delete », mais « aucun rewind/undo » : l'agent ne s'annule
// jamais lui-même ; seul l'humain rejoue les inverses.

import { describe, expect, it } from "vitest";

import { buildTools, WRITE_TOOL_NAMES } from "@/lib/agent/tools.server";

describe("le rewind/undo n'est jamais exposé à l'agent (Constraint inc.4)", () => {
  it("buildTools n'expose QUE les tools connus — aucun rewind/undo (auto-annulation interdite)", () => {
    const tools = buildTools("user-1", "turn-1");
    const names = Object.keys(tools);

    // Catalogue exact attendu (read + write-tools, archive inclus) — aucune surface en plus.
    expect(new Set(names)).toEqual(
      new Set([
        "queryContacts",
        "seedContacts",
        "createContact",
        "updateContact",
        "importContacts",
        "composeMessage",
        "setContactHistorique",
        "archiveContact",
        "archiveContacts",
        "archiveDraft",
      ]),
    );
    // Aucun tool d'AUTO-ANNULATION, sous aucune graphie : le rewind reste humain-only.
    expect(names.some((n) => /rewind|undo|annul/i.test(n))).toBe(false);
  });

  it("CAP-4 : le registre de sync n'a PAS gagné de write-tool pour le rewind (sync héritée)", () => {
    // Le rewind passe par une server action + l'invalidation héritée d'inc.2 ; il n'introduit
    // aucun write-tool. Les write-tools sont ceux d'inc.3 + les archive-tools (delete réversible).
    expect([...WRITE_TOOL_NAMES].sort()).toEqual([
      "archiveContact",
      "archiveContacts",
      "archiveDraft",
      "composeMessage",
      "createContact",
      "importContacts",
      "seedContacts",
      "setContactHistorique",
      "updateContact",
    ]);
    expect(WRITE_TOOL_NAMES.has("rewind")).toBe(false);
  });
});
