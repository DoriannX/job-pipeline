// MACHINE À ÉTATS NOMMÉE des Messages (story 3.8, AR-5) — purement logique, sans infra.
//
// On prouve la LÉGALITÉ exhaustive du cycle `brouillon → envoye → vu → repondu/ignore` :
//   • transitions légales acceptées (canTransition true) ;
//   • transitions ILLÉGALES refusées (retour en arrière, sauts interdits, sorties d'un
//     terminal) — canTransition false ;
//   • `availableTransitions` exhaustif par statut ;
//   • `manualTransitions` = sortantes légales privées de l'envoi (ce que le mini-sheet
//     propose).

import { describe, expect, it } from "vitest";

import { MESSAGE_STATUS, type MessageStatut } from "@/lib/domain/enums";
import {
  TRANSITIONS,
  availableTransitions,
  canTransition,
  manualTransitions,
} from "@/lib/domain/message-status";

describe("machine à états des Messages — transitions LÉGALES (AR-5)", () => {
  it("brouillon → envoye est la seule sortie du brouillon (envoi, story 3.6)", () => {
    expect(canTransition("brouillon", "envoye")).toBe(true);
    expect(availableTransitions("brouillon")).toEqual(["envoye"]);
  });

  it("envoye → vu | repondu | ignore (toutes légales)", () => {
    expect(canTransition("envoye", "vu")).toBe(true);
    expect(canTransition("envoye", "repondu")).toBe(true);
    expect(canTransition("envoye", "ignore")).toBe(true);
    expect(availableTransitions("envoye").sort()).toEqual(
      ["ignore", "repondu", "vu"].sort(),
    );
  });

  it("vu → repondu | ignore (légales), mais PAS de retour vers envoye", () => {
    expect(canTransition("vu", "repondu")).toBe(true);
    expect(canTransition("vu", "ignore")).toBe(true);
    expect(canTransition("vu", "envoye")).toBe(false);
    expect(availableTransitions("vu").sort()).toEqual(
      ["ignore", "repondu"].sort(),
    );
  });

  it("repondu et ignore sont TERMINAUX (aucune transition sortante)", () => {
    expect(availableTransitions("repondu")).toEqual([]);
    expect(availableTransitions("ignore")).toEqual([]);
    // Aucune cible n'est atteignable depuis un terminal.
    for (const to of MESSAGE_STATUS) {
      expect(canTransition("repondu", to)).toBe(false);
      expect(canTransition("ignore", to)).toBe(false);
    }
  });
});

describe("machine à états des Messages — transitions ILLÉGALES refusées", () => {
  it("aucun retour en arrière : envoye → brouillon, vu → envoye, repondu → vu", () => {
    expect(canTransition("envoye", "brouillon")).toBe(false);
    expect(canTransition("vu", "envoye")).toBe(false);
    expect(canTransition("vu", "brouillon")).toBe(false);
    expect(canTransition("repondu", "vu")).toBe(false);
    expect(canTransition("ignore", "vu")).toBe(false);
    expect(canTransition("repondu", "ignore")).toBe(false);
    expect(canTransition("ignore", "repondu")).toBe(false);
  });

  it("aucun saut interdit : brouillon → vu / repondu / ignore", () => {
    expect(canTransition("brouillon", "vu")).toBe(false);
    expect(canTransition("brouillon", "repondu")).toBe(false);
    expect(canTransition("brouillon", "ignore")).toBe(false);
  });

  it("une auto-transition (statut → lui-même) n'est jamais légale", () => {
    for (const s of MESSAGE_STATUS) {
      expect(canTransition(s, s)).toBe(false);
    }
  });
});

describe("machine à états des Messages — exhaustivité de la table", () => {
  it("TRANSITIONS couvre EXACTEMENT l'union des statuts (aucun orphelin)", () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...MESSAGE_STATUS].sort());
  });

  it("toute cible listée est elle-même un statut connu (table fermée)", () => {
    const known = new Set<MessageStatut>(MESSAGE_STATUS);
    for (const targets of Object.values(TRANSITIONS)) {
      for (const t of targets) {
        expect(known.has(t)).toBe(true);
      }
    }
  });

  it("availableTransitions renvoie une COPIE (l'appelant ne mute pas la table)", () => {
    const got = availableTransitions("envoye");
    got.push("brouillon");
    // La table reste intacte malgré la mutation de la copie.
    expect(availableTransitions("envoye")).not.toContain("brouillon");
  });
});

describe("machine à états des Messages — options MANUELLES du mini-sheet (story 3.8)", () => {
  it("depuis envoye : vu / repondu / ignore (l'envoi n'est jamais un choix manuel)", () => {
    expect(manualTransitions("envoye").sort()).toEqual(
      ["ignore", "repondu", "vu"].sort(),
    );
  });

  it("depuis vu : repondu / ignore", () => {
    expect(manualTransitions("vu").sort()).toEqual(["ignore", "repondu"].sort());
  });

  it("brouillon ⇒ aucune option manuelle (l'envoi se fait ailleurs, pas au mini-sheet)", () => {
    expect(manualTransitions("brouillon")).toEqual([]);
  });

  it("statuts TERMINAUX ⇒ aucune option manuelle (rien à changer)", () => {
    expect(manualTransitions("repondu")).toEqual([]);
    expect(manualTransitions("ignore")).toEqual([]);
  });
});
