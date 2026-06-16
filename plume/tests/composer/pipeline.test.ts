// Pipeline « générer → sanitize → GenerationEvent » (story 3.3, AR-8).
//
// Logique extraite de la route pour être testable sans handler. On vérifie que la
// sortie finale est SANITIZÉE (réutilise `sanitize`, point unique), et que le
// GenerationEvent porte les bons champs versionnés + tokens + voiceExamplesRef cohérent.

import { describe, expect, it } from "vitest";

import {
  buildGenerationEvent,
  finalizeText,
} from "@/lib/composer/pipeline.server";
import { hasTells, sanitize, SANITIZE_VERSION } from "@/lib/copy";
import { PROMPT_VERSION } from "@/lib/prompt.server";

describe("finalizeText — sanitize + re-valide bornée", () => {
  it("retire les Tells (cadratin, emoji) — sortie identique à sanitize()", () => {
    const raw = "Salut — content de te voir 😀";
    const out = finalizeText(raw);
    expect(out).toBe(sanitize(raw));
    expect(hasTells(out)).toBe(false);
  });

  it("texte déjà propre → inchangé (idempotence)", () => {
    const clean = "Bonjour, ravi d'échanger.";
    expect(finalizeText(clean)).toBe(clean);
  });
});

describe("buildGenerationEvent — frontière du moat (AR-8)", () => {
  const input = {
    rawText: "On s'est croisés — au meetup 🙂",
    idea: "Échange après le meetup",
    canal: "linkedin" as const,
    tone: "soigne" as const,
    modelId: "claude-opus-4-8",
    voiceExamplesRef: [] as string[],
    tokens: { input: 30, output: 12 },
  };

  it("generatedText est le texte SANITIZÉ (pas le brut)", () => {
    const ev = buildGenerationEvent(input);
    expect(ev.generatedText).toBe(sanitize(input.rawText));
    expect(hasTells(ev.generatedText)).toBe(false);
    expect(ev.generatedText).not.toContain("—");
  });

  it("porte les versions et le modelId corrects", () => {
    const ev = buildGenerationEvent(input);
    expect(ev.modelId).toBe("claude-opus-4-8");
    expect(ev.promptVersion).toBe(PROMPT_VERSION);
    expect(ev.sanitizeVersion).toBe(SANITIZE_VERSION);
  });

  it("conserve rawIntent, canal, tone, tokens et voiceExamplesRef", () => {
    const ev = buildGenerationEvent(input);
    expect(ev.rawIntent).toBe("Échange après le meetup");
    expect(ev.canal).toBe("linkedin");
    expect(ev.tone).toBe("soigne");
    expect(ev.tokens).toEqual({ input: 30, output: 12 });
    expect(ev.voiceExamplesRef).toEqual([]);
  });

  it("voiceExamplesRef reflète les exemples passés (cohérence)", () => {
    const ev = buildGenerationEvent({
      ...input,
      voiceExamplesRef: ["msg_1", "msg_2"],
    });
    expect(ev.voiceExamplesRef).toEqual(["msg_1", "msg_2"]);
  });
});
