// Wrapper `runAgentChat` (copilote incrément 2) — migration `toUIMessageStreamResponse`.
//
// On prouve les deux signaux que ce format porte, AU NIVEAU SERVEUR, via un modèle MOCKÉ
// (aucune clé, aucun réseau) injecté dans le wrapper :
//   - CAP-3 : une erreur EN PLEIN STREAM devient une part `error` TERMINALE lisible
//     (message doux), au lieu d'un flux tronqué silencieux ;
//   - CAP-2 : la part `finish` porte `messageMetadata.didWrite` — vrai SI et SEULEMENT SI
//     le run a appelé ≥1 write-tool (registre générique `WRITE_TOOL_NAMES`), faux sinon.
//
// On lit le corps SSE de la Response (`response.text()`) — ce que le client recevra.

import { describe, expect, it } from "vitest";
import { tool } from "ai";
import { MockLanguageModelV3, convertArrayToReadableStream } from "ai/test";
import { z } from "zod";

import { runAgentChat } from "@/lib/agent/run.server";

// — Fabriques de parts du flux modèle V3 (forme attendue par `streamText`). —
const USAGE = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};
const finish = (unified: "stop" | "tool-calls") =>
  ({
    type: "finish",
    usage: USAGE,
    finishReason: { unified, raw: undefined },
  }) as const;

const textParts = (id: string, text: string) =>
  [
    { type: "text-start", id },
    { type: "text-delta", id, delta: text },
    { type: "text-end", id },
  ] as const;

/** Un seul tour utilisateur (suffisant : le wrapper ne garde que les tours `user`). */
const userTurn = [{ role: "user" as const, content: "fais quelque chose" }];

describe("runAgentChat — flux UI message (copilote inc.2)", () => {
  it("CAP-3 : une erreur mid-stream produit une part `error` terminale douce", async () => {
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        // Du texte commence à sortir… puis le provider casse en plein vol.
        stream: convertArrayToReadableStream([
          ...textParts("1", "Je regarde"),
          { type: "error", error: new Error("provider 503") } as const,
        ]),
      }),
    });

    const res = runAgentChat({ userId: "u1", messages: userTurn, model, tools: {} });
    const body = await res.text();

    // Une part d'erreur TERMINALE est présente dans le flux (CAP-3) — pas un silence.
    expect(body).toContain('"type":"error"');
    // Message DOUX (jamais la stack/`provider 503` brut côté client).
    expect(body).toContain("souci en cours de route");
    expect(body).not.toContain("provider 503");
  });

  it("CAP-2 : un run READ-ONLY signale `didWrite:false` en fin de flux", async () => {
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          ...textParts("1", "Tu as 3 contacts."),
          finish("stop"),
        ]),
      }),
    });

    const res = runAgentChat({ userId: "u1", messages: userTurn, model, tools: {} });
    const body = await res.text();

    expect(body).toContain('"didWrite":false');
    expect(body).not.toContain('"didWrite":true');
  });

  it("CAP-2 : un run qui appelle un WRITE-tool signale `didWrite:true` (preuve sync)", async () => {
    // Catalogue injecté : un `seedContacts` factice (nom = clé du registre WRITE_TOOL_NAMES).
    // Il ne touche aucune DB — on teste le CÂBLAGE du signal, pas la création réelle.
    const tools = {
      seedContacts: tool({
        description: "stub",
        inputSchema: z.object({ count: z.number() }),
        execute: async ({ count }) => ({ created: count, requested: count, capped: false }),
      }),
    };

    let call = 0;
    const model = new MockLanguageModelV3({
      doStream: async () => {
        call += 1;
        if (call === 1) {
          // Tour 1 : le modèle APPELLE le write-tool.
          return {
            stream: convertArrayToReadableStream([
              {
                type: "tool-call",
                toolCallId: "t1",
                toolName: "seedContacts",
                input: JSON.stringify({ count: 3 }),
              } as const,
              finish("tool-calls"),
            ]),
          };
        }
        // Tour 2 : le modèle verbalise le résultat et conclut.
        return {
          stream: convertArrayToReadableStream([
            ...textParts("2", "C'est fait : 3 contacts de test."),
            finish("stop"),
          ]),
        };
      },
    });

    const res = runAgentChat({ userId: "u1", messages: userTurn, model, tools });
    const body = await res.text();

    // Le serveur a détecté l'écriture et l'a exposée → le client déclenchera UN refresh.
    expect(body).toContain('"didWrite":true');
    expect(body).not.toContain('"didWrite":false');
  });
});
