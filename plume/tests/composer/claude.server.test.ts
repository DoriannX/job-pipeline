// Wrapper SDK Claude (story 3.3, AR-7/AR-11) — AUCUN appel réseau réel : on mocke
// `@anthropic-ai/sdk` intégralement (vi.mock). On vérifie :
//   - la SÉLECTION DE MODÈLE exacte (rapide→claude-haiku-4-5, soigne→claude-opus-4-8) ;
//   - le FORWARD des deltas via `onDelta` ;
//   - la remontée de l'USAGE (input/output) ;
//   - qu'AUCUN `temperature`/`top_p`/`top_k`/`thinking` n'est passé au SDK (= 400 sinon) ;
//   - clé absente → AppError propre « ia_indisponible » (jamais de crash).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// — Mock du SDK. On capture les args de `messages.stream` et on simule un flux. —
// `streamMock` est réassigné par test pour piloter deltas/usage/erreur.
type StreamArgs = Record<string, unknown>;
const calls: StreamArgs[] = [];

let deltas: string[] = ["Bon", "jour"];
let usage = { input_tokens: 11, output_tokens: 7 };
let shouldThrow = false;

function makeStream(args: StreamArgs) {
  calls.push(args);
  const listeners: Record<string, (d: string) => void> = {};
  return {
    on(event: string, cb: (d: string) => void) {
      listeners[event] = cb;
      return this;
    },
    async finalMessage() {
      if (shouldThrow) throw new Error("boom réseau");
      // Émet les deltas APRÈS l'enregistrement du listener (comme le vrai SDK).
      for (const d of deltas) listeners["text"]?.(d);
      return {
        content: [{ type: "text", text: deltas.join("") }],
        usage,
      };
    },
  };
}

vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = { stream: (args: StreamArgs) => makeStream(args) };
    constructor(_opts: unknown) {
      void _opts;
    }
  }
  return { default: FakeAnthropic };
});

// Import APRÈS le mock (vi.mock est hoisté, mais on reste explicite).
import { generateMessage, MODEL_BY_TONE, AppError } from "@/lib/claude.server";

const baseInput = {
  idea: "Échange autour de ton poste produit.",
  canal: "linkedin" as const,
  voiceExamples: [] as string[],
};

beforeEach(() => {
  calls.length = 0;
  deltas = ["Bon", "jour"];
  usage = { input_tokens: 11, output_tokens: 7 };
  shouldThrow = false;
  process.env.ANTHROPIC_API_KEY = "sk-test-fake";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("claude.server — sélection de modèle (FR-14)", () => {
  it("rapide → claude-haiku-4-5", async () => {
    await generateMessage({ ...baseInput, tone: "rapide" }, () => {});
    expect(calls[0].model).toBe("claude-haiku-4-5");
    expect(MODEL_BY_TONE.rapide).toBe("claude-haiku-4-5");
  });

  it("soigne → claude-opus-4-8", async () => {
    await generateMessage({ ...baseInput, tone: "soigne" }, () => {});
    expect(calls[0].model).toBe("claude-opus-4-8");
    expect(MODEL_BY_TONE.soigne).toBe("claude-opus-4-8");
  });
});

describe("claude.server — paramètres interdits (un écart = 400 runtime)", () => {
  it("ne passe JAMAIS temperature/top_p/top_k/thinking au SDK", async () => {
    await generateMessage({ ...baseInput, tone: "soigne" }, () => {});
    const args = calls[0];
    expect(args).not.toHaveProperty("temperature");
    expect(args).not.toHaveProperty("top_p");
    expect(args).not.toHaveProperty("top_k");
    expect(args).not.toHaveProperty("thinking");
    // Sanity : les paramètres ATTENDUS sont bien là.
    expect(args).toHaveProperty("model");
    expect(args).toHaveProperty("max_tokens");
    expect(args).toHaveProperty("system");
    expect(args).toHaveProperty("messages");
  });
});

describe("claude.server — streaming & usage", () => {
  it("forwarde chaque delta via onDelta et renvoie le texte complet", async () => {
    const received: string[] = [];
    const result = await generateMessage(
      { ...baseInput, tone: "rapide" },
      (d) => received.push(d),
    );
    expect(received).toEqual(["Bon", "jour"]);
    expect(result.text).toBe("Bonjour");
  });

  it("remonte l'usage (input/output) et le modelId", async () => {
    usage = { input_tokens: 42, output_tokens: 13 };
    const result = await generateMessage(
      { ...baseInput, tone: "soigne" },
      () => {},
    );
    expect(result.usage).toEqual({ inputTokens: 42, outputTokens: 13 });
    expect(result.modelId).toBe("claude-opus-4-8");
  });
});

describe("claude.server — erreurs douces", () => {
  it("clé absente → AppError ia_indisponible (jamais de crash)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      generateMessage({ ...baseInput, tone: "rapide" }, () => {}),
    ).rejects.toMatchObject({ code: "ia_indisponible" });
  });

  it("échec d'appel modèle → AppError ia_echec (retriable)", async () => {
    shouldThrow = true;
    await expect(
      generateMessage({ ...baseInput, tone: "rapide" }, () => {}),
    ).rejects.toBeInstanceOf(AppError);
    shouldThrow = true;
    await expect(
      generateMessage({ ...baseInput, tone: "rapide" }, () => {}),
    ).rejects.toMatchObject({ code: "ia_echec", retriable: true });
  });
});
