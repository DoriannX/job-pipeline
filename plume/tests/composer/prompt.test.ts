// Construction du prompt de génération (story 3.3, FR-9/FR-10).
//
// Le prompt est le « secret de fabrication » du moat : ces tests verrouillent ses
// invariants structurels — canal-aware (3 régimes de longueur), few-shot injecté
// (vide → neutre, jamais de crash), idée incluse, version exportée, et césure de cache
// `cache_control` posée sur le DERNIER bloc stable (prompt caching, archi l.70/l.76).
//
// Module PUR : aucun mock nécessaire (buildPrompt n'a ni I/O ni SDK).

import { describe, expect, it } from "vitest";

import { buildPrompt, PROMPT_VERSION } from "@/lib/prompt.server";
import { CANAUX } from "@/lib/domain/enums";

const baseInput = {
  idea: "On s'est croisés au meetup React, j'aimerais échanger sur ton poste.",
  voiceExamples: [] as string[],
};

describe("prompt — version exportée", () => {
  it("exporte une PROMPT_VERSION entière (persistée dans generation_events)", () => {
    expect(Number.isInteger(PROMPT_VERSION)).toBe(true);
    expect(PROMPT_VERSION).toBeGreaterThanOrEqual(1);
  });
});

describe("prompt — structure cachable (prompt caching)", () => {
  it("place le cache_control éphémère sur le DERNIER bloc système stable", () => {
    const { system } = buildPrompt({ ...baseInput, canal: "linkedin" });

    // Au moins 2 blocs système (instructions + few-shot).
    expect(system.length).toBeGreaterThanOrEqual(2);

    // Le DERNIER bloc porte le breakpoint ; les précédents NON (préfixe stable groupé).
    const last = system[system.length - 1];
    expect(last.cache_control).toEqual({ type: "ephemeral" });
    for (let i = 0; i < system.length - 1; i++) {
      expect(system[i].cache_control).toBeUndefined();
    }
  });

  it("met l'idée brute dans le tour utilisateur (suffixe volatil), pas dans le système", () => {
    const { system, messages } = buildPrompt({ ...baseInput, canal: "email" });

    const systemText = system.map((b) => b.text).join("\n");
    expect(systemText).not.toContain(baseInput.idea);

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    const userText =
      typeof messages[0].content === "string"
        ? messages[0].content
        : JSON.stringify(messages[0].content);
    expect(userText).toContain(baseInput.idea);
  });
});

describe("prompt — canal-aware (FR-9, 3 régimes de longueur)", () => {
  // On vérifie qu'une contrainte de longueur DISTINCTE est présente par profil de canal.
  it("LinkedIn → court", () => {
    const { messages } = buildPrompt({ ...baseInput, canal: "linkedin" });
    const t = String((messages[0] as { content: string }).content);
    expect(t).toContain("LinkedIn");
    expect(t).toMatch(/COURT/i);
  });

  it("Email → structuré", () => {
    const { messages } = buildPrompt({ ...baseInput, canal: "email" });
    const t = String((messages[0] as { content: string }).content);
    expect(t).toMatch(/e-mail/i);
    expect(t).toMatch(/STRUCTUR/i);
  });

  it("WhatsApp & SMS → très court", () => {
    const wa = String(
      (buildPrompt({ ...baseInput, canal: "whatsapp" }).messages[0] as {
        content: string;
      }).content,
    );
    const sms = String(
      (buildPrompt({ ...baseInput, canal: "sms" }).messages[0] as {
        content: string;
      }).content,
    );
    expect(wa).toMatch(/TRÈS COURT/i);
    expect(sms).toMatch(/TRÈS COURT/i);
  });

  it("produit un prompt non vide pour CHAQUE canal canonique", () => {
    for (const canal of CANAUX) {
      const { system, messages } = buildPrompt({ ...baseInput, canal });
      expect(system.length).toBeGreaterThan(0);
      expect(messages.length).toBe(1);
    }
  });
});

describe("prompt — few-shot de voix (FR-10)", () => {
  it("corpus VIDE → consigne de ton neutre, jamais de crash", () => {
    const { system } = buildPrompt({ ...baseInput, canal: "linkedin" });
    const systemText = system.map((b) => b.text).join("\n");
    expect(systemText).toMatch(/neutre/i);
  });

  it("corpus NON vide → les exemples sont injectés dans le préfixe stable", () => {
    const { system } = buildPrompt({
      ...baseInput,
      canal: "linkedin",
      voiceExamples: ["Salut ! Ça fait un bail, on se capte cette semaine ?"],
    });
    const systemText = system.map((b) => b.text).join("\n");
    expect(systemText).toContain("on se capte cette semaine");
  });

  it("filtre les exemples vides/blancs sans planter", () => {
    expect(() =>
      buildPrompt({
        ...baseInput,
        canal: "sms",
        voiceExamples: ["", "   ", "\n"],
      }),
    ).not.toThrow();
    const { system } = buildPrompt({
      ...baseInput,
      canal: "sms",
      voiceExamples: ["", "   "],
    });
    // Tous blancs ⇒ retombe sur le ton neutre.
    expect(system.map((b) => b.text).join("\n")).toMatch(/neutre/i);
  });
});

describe("prompt — contexte contact (suffixe volatil)", () => {
  it("inclut le nom du contact quand fourni", () => {
    const { messages } = buildPrompt({
      ...baseInput,
      canal: "linkedin",
      contact: { nom: "Camille" },
    });
    const t = String((messages[0] as { content: string }).content);
    expect(t).toContain("Camille");
  });
});
