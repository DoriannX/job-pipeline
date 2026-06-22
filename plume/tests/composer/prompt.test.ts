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

// --- Historique de conversation (story 3.10, FR-35) ------------------------
// On verrouille : (1) PRÉSENT → le bloc historique + la consigne de CONTINUITÉ sont dans le
// tour utilisateur, JAMAIS dans le `system` cachable (cache préservé) ; (2) ABSENT/vide →
// tour utilisateur STRICTEMENT identique à un prompt sans `contact` (non-régression AC 3) ;
// (3) en mode `improve`, AUCUNE injection (la consigne « en place » primerait, AC 6/scope).

const userOf = (input: Parameters<typeof buildPrompt>[0]) =>
  String((buildPrompt(input).messages[0] as { content: string }).content);

const histoEx =
  "Moi : on s'était dit qu'on se recroiserait au prochain meetup.\n" +
  "Lui : oui ! je te tiens au courant de la date.";

describe("prompt — historique de conversation (story 3.10)", () => {
  it("PROMPT_VERSION est au moins 3 (recette historique disponible)", () => {
    expect(PROMPT_VERSION).toBeGreaterThanOrEqual(3);
  });

  it("historique présent → bloc + consigne de continuité dans le TOUR UTILISATEUR", () => {
    const t = userOf({
      ...baseInput,
      canal: "linkedin",
      contact: { nom: "Camille", historique: histoEx },
    });
    // Le texte de l'historique voyage bien dans le tour user…
    expect(t).toContain("on se recroiserait au prochain meetup");
    // …avec une consigne EXPLICITE de continuité (rebondir, pas résumer).
    expect(t).toMatch(/REBONDIS|continuité|suite naturelle/i);
    expect(t).toMatch(/dernier point/i);
  });

  it("historique présent → JAMAIS dans le système cachable (cache préservé)", () => {
    const { system } = buildPrompt({
      ...baseInput,
      canal: "linkedin",
      contact: { nom: "Camille", historique: histoEx },
    });
    const systemText = system.map((b) => b.text).join("\n");
    expect(systemText).not.toContain("on se recroiserait");
    // Et la césure de cache reste sur le DERNIER bloc stable (inchangée).
    expect(system[system.length - 1].cache_control).toEqual({
      type: "ephemeral",
    });
  });

  it("SANS historique → tour utilisateur IDENTIQUE à un prompt sans contact (non-régression)", () => {
    const sansContact = userOf({ ...baseInput, canal: "email" });
    // historique absent (undefined) ne doit RIEN ajouter au tour user.
    const histoAbsent = userOf({
      ...baseInput,
      canal: "email",
      contact: { historique: null },
    });
    const histoVide = userOf({
      ...baseInput,
      canal: "email",
      contact: { historique: "   \n  " },
    });
    expect(histoAbsent).toBe(sansContact);
    expect(histoVide).toBe(sansContact);
  });

  it("le SYSTÈME (préfixe cachable) est IDENTIQUE avec et sans historique", () => {
    const sans = buildPrompt({ ...baseInput, canal: "linkedin" });
    const avec = buildPrompt({
      ...baseInput,
      canal: "linkedin",
      contact: { nom: "Camille", historique: histoEx },
    });
    expect(avec.system).toEqual(sans.system);
  });

  it("mode improve → historique NON injecté (la consigne en place prime)", () => {
    const t = userOf({
      ...baseInput,
      canal: "linkedin",
      mode: "improve",
      contact: { nom: "Camille", historique: histoEx },
    });
    expect(t).not.toContain("on se recroiserait au prochain meetup");
    // Et reste bien la consigne d'amélioration.
    expect(t).toMatch(/retravaille/i);
  });
});

// --- Mode `improve` (story 3.4, FR-8/UX-DR8) -------------------------------
// Le pipeline serveur est IDENTIQUE à 3.3 : seule l'INSTRUCTION du tour utilisateur
// change. On verrouille : (1) le préfixe stable (système + few-shot, cachable) est
// IDENTIQUE entre les deux modes ; (2) le tour utilisateur d'`improve` demande de
// RETRAVAILLER un texte existant (garde idées/voix, canal-aware), distinct de `generate`.

const userContent = (canal: "linkedin" | "email" | "whatsapp" | "sms", mode?: "generate" | "improve") =>
  String(
    (buildPrompt({ ...baseInput, canal, mode }).messages[0] as {
      content: string;
    }).content,
  );

describe("prompt — mode improve (story 3.4)", () => {
  it("default = generate : sans mode, le tour user demande de METTRE EN FORME une idée brute", () => {
    const t = userContent("linkedin");
    expect(t).toMatch(/idée brute/i);
    expect(t).toMatch(/mettre en forme/i);
  });

  it("improve : le tour user demande de RETRAVAILLER EN PLACE un texte existant", () => {
    const t = userContent("linkedin", "improve");
    expect(t).toMatch(/retravaille/i);
    expect(t).toMatch(/en place/i);
    // Garde idées + voix, pas de ton étranger (FR-8, UX-DR8).
    expect(t).toMatch(/garde/i);
    expect(t).toMatch(/voix/i);
    expect(t).toMatch(/aucun ton étranger/i);
    // C'est bien la consigne d'amélioration, pas celle de génération.
    expect(t).not.toMatch(/idée brute à mettre en forme/i);
    // Le texte d'entrée voyage toujours dans le tour utilisateur.
    expect(t).toContain(baseInput.idea);
  });

  it("improve reste CANAL-AWARE : la contrainte de longueur du canal est présente (FR-9)", () => {
    // Même contrainte canal qu'en `generate` : on la vérifie sur deux profils.
    expect(userContent("sms", "improve")).toMatch(/TRÈS COURT/i);
    expect(userContent("email", "improve")).toMatch(/STRUCTUR/i);
  });

  it("le SYSTÈME (préfixe cachable) est IDENTIQUE entre generate et improve", () => {
    const gen = buildPrompt({ ...baseInput, canal: "linkedin", mode: "generate" });
    const imp = buildPrompt({ ...baseInput, canal: "linkedin", mode: "improve" });
    // Mêmes blocs système, même few-shot, même césure de cache : le mode ne touche
    // JAMAIS au préfixe stable (sinon on casserait le cache et la persona).
    expect(imp.system).toEqual(gen.system);
    // Et la voix neutre est bien préservée dans les deux.
    expect(imp.system.map((b) => b.text).join("\n")).toMatch(/neutre/i);
  });

  it("le tour utilisateur DIFFÈRE entre generate et improve (instruction observable)", () => {
    expect(userContent("linkedin", "improve")).not.toBe(
      userContent("linkedin", "generate"),
    );
  });
});

// --- Calibrage RÉCENCE/MÉMOIRE (story 7.1, P1/P2 dogfood) ------------------
// On verrouille : (1) PROMPT_VERSION === 4 (AC #6) ; (2) en mode `generate` avec idée, la
// consigne récence/mémoire est dans le TOUR UTILISATEUR (P1 « pas d'oubli présumé », P2 « ne
// pas minimiser », deux axes — AC #3/#4/#5) ; (3) le mode `improve` est INCHANGÉ : la consigne
// n'y apparaît PAS (non-régression P1/P2 hors improve — AC #9) ; (4) la consigne reste hors du
// SYSTÈME cachable (cache préservé) — elle vit dans le tour user volatil.

describe("prompt — calibrage récence/mémoire (story 7.1)", () => {
  it("PROMPT_VERSION est passée à 4 (recette récence/mémoire)", () => {
    expect(PROMPT_VERSION).toBe(4);
  });

  it("generate (idée présente) → la consigne récence/mémoire est dans le tour utilisateur", () => {
    const t = userContent("linkedin", "generate");
    // P1 — ne pas présumer l'oubli (référence l'événement).
    expect(t).toMatch(/RÉCENCE/i);
    expect(t).toMatch(/présume PAS l'oubli|ne présume pas l'oubli/i);
    // P2 — ne pas minimiser l'interaction.
    expect(t).toMatch(/minimise/i);
    // Deux axes distincts (distance sociale ≠ mémoire).
    expect(t).toMatch(/deux axes|axes distincts/i);
  });

  it("improve → la consigne récence/mémoire est ABSENTE (non-régression P1/P2 hors improve, AC #9)", () => {
    const t = userContent("linkedin", "improve");
    expect(t).not.toMatch(/présume PAS l'oubli|ne présume pas l'oubli/i);
    expect(t).not.toMatch(/axes distincts/i);
    // Et reste bien la consigne d'amélioration en place.
    expect(t).toMatch(/retravaille/i);
  });

  it("la consigne récence/mémoire reste HORS du système cachable (cache préservé)", () => {
    const { system } = buildPrompt({ ...baseInput, canal: "linkedin" });
    const systemText = system.map((b) => b.text).join("\n");
    expect(systemText).not.toMatch(/présume PAS l'oubli|ne présume pas l'oubli/i);
    expect(systemText).not.toMatch(/axes distincts/i);
  });
});
