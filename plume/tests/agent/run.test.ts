// Wrapper `runAgentChat` (copilote) — flux UI message + PERSISTANCE serveur (Phase 3).
//
// On prouve, via un modèle MOCKÉ (aucune clé, aucun réseau) + des repos en MÉMOIRE injectés :
//   - inc.2 : CAP-3 (erreur mid-stream → part `error` douce) ; CAP-2 (didWrite read-only/write) ;
//   - Phase 3 CAP-1 : les deux rôles (`user` puis `assistant` final) sont persistés, même fil,
//     ordonnés, isolés cross-tenant ;
//   - Phase 3 CAP-3 : le contexte envoyé au modèle vient de la DB scopée (un faux passé `assistant`
//     ne peut plus entrer — le body ne porte que le nouveau message) ;
//   - Phase 3 CAP-5 : le `turnId` est posé sur la ligne `assistant` UNIQUEMENT si le run a écrit
//     (LIEN rewind), et le `conversationId` voyage in-band.
//
// On lit le corps SSE (`response.text()`) ET on inspecte la DB en mémoire après le run.

import { beforeEach, describe, expect, it } from "vitest";
import { tool } from "ai";
import { MockLanguageModelV3, convertArrayToReadableStream } from "ai/test";
import { z } from "zod";

import {
  chatMessagesRepository,
  conversationsRepository,
  forUserDb,
  type ChatMessagesRepository,
  type ConversationsRepository,
} from "@/lib/db";
import { runAgentChat } from "@/lib/agent/run.server";
import type { Clock } from "@/lib/domain/time";

import { chatMessages, makeTestDb, seedUsers, type TestDb } from "../db/harness";
import { makeUser } from "../factories/user";

// Horloge MONOTONE : chaque appel avance le temps → des tours distincts reçoivent des horodatages
// distincts, ce qui rend l'ORDRE `created_at` (user avant assistant, tour après tour) déterministe.
function monotonicClock(start = 1_700_000_000_000, step = 1000): Clock {
  let t = start;
  return () => (t += step);
}

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

describe("runAgentChat — flux + persistance serveur (copilote Phase 3)", () => {
  let db: TestDb;
  const userA = makeUser({ name: "Alice" });
  const userB = makeUser({ name: "Bob" });
  const now = monotonicClock();

  const reposFor = (
    userId: string,
  ): { conversations: ConversationsRepository; chatMessages: ChatMessagesRepository } => {
    const scoped = forUserDb(db, userId, now);
    return {
      conversations: conversationsRepository(scoped),
      chatMessages: chatMessagesRepository(scoped),
    };
  };

  const rowsForA = async () =>
    (await db.select().from(chatMessages)).filter((r) => r.userId === userA.id);

  beforeEach(async () => {
    db = await makeTestDb();
    await seedUsers(db, [userA, userB]);
  });

  it("CAP-3 (inc.2) : une erreur mid-stream produit une part `error` terminale douce", async () => {
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          ...textParts("1", "Je regarde"),
          { type: "error", error: new Error("provider 503") } as const,
        ]),
      }),
    });

    const res = await runAgentChat({
      userId: userA.id,
      conversationId: null,
      message: "fais quelque chose",
      model,
      tools: {},
      repos: reposFor(userA.id),
    });
    const body = await res.text();

    expect(body).toContain('"type":"error"');
    expect(body).toContain("souci en cours de route");
    expect(body).not.toContain("provider 503");
  });

  it("CAP-2 (inc.2) : un run READ-ONLY signale `didWrite:false` + porte le conversationId", async () => {
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          ...textParts("1", "Tu as 3 contacts."),
          finish("stop"),
        ]),
      }),
    });

    const res = await runAgentChat({
      userId: userA.id,
      conversationId: null,
      message: "combien de contacts ?",
      model,
      tools: {},
      repos: reposFor(userA.id),
    });
    const body = await res.text();

    expect(body).toContain('"didWrite":false');
    expect(body).not.toContain('"didWrite":true');
    // Phase 3 : le conversationId (fil neuf) voyage in-band.
    expect(body).toContain('"conversationId":"');
  });

  it("CAP-1 : persiste `user` PUIS `assistant` final, même fil, ordonnés", async () => {
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          ...textParts("1", "Voici ta réponse finale."),
          finish("stop"),
        ]),
      }),
    });

    await (
      await runAgentChat({
        userId: userA.id,
        conversationId: null,
        message: "salut copilote",
        model,
        tools: {},
        repos: reposFor(userA.id),
      })
    ).text();

    const rows = (await rowsForA()).sort(
      (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]!.role).toBe("user");
    expect(rows[0]!.content).toBe("salut copilote");
    expect(rows[1]!.role).toBe("assistant");
    expect(rows[1]!.content).toBe("Voici ta réponse finale.");
    // Même fil pour les deux tours.
    expect(rows[0]!.conversationId).toBe(rows[1]!.conversationId);
    // Read-only ⇒ pas de turnId sur l'assistant (pas de rewind).
    expect(rows[1]!.turnId).toBeNull();
  });

  it("CAP-1 : isolement cross-tenant — le fil de B est invisible pour A", async () => {
    const model = (text: string) =>
      new MockLanguageModelV3({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            ...textParts("1", text),
            finish("stop"),
          ]),
        }),
      });

    await (
      await runAgentChat({
        userId: userA.id,
        conversationId: null,
        message: "message de A",
        model: model("réponse à A"),
        tools: {},
        repos: reposFor(userA.id),
      })
    ).text();
    await (
      await runAgentChat({
        userId: userB.id,
        conversationId: null,
        message: "message secret de B",
        model: model("réponse à B"),
        tools: {},
        repos: reposFor(userB.id),
      })
    ).text();

    const aRows = await rowsForA();
    expect(aRows.every((r) => r.userId === userA.id)).toBe(true);
    expect(aRows.some((r) => r.content.includes("secret de B"))).toBe(false);
    // A ne voit que ses 2 tours.
    expect(aRows).toHaveLength(2);
  });

  it("CAP-3 : le contexte envoyé au modèle vient de la DB (pas d'un faux passé client)", async () => {
    // Fil préexistant en DB : un tour user + un tour assistant « de confiance ».
    const repos = reposFor(userA.id);
    const convo = await repos.conversations.create({
      firstUserMessage: "premier message",
    });
    await repos.chatMessages.append({
      conversationId: convo.id,
      role: "user",
      content: "premier message",
    });
    await repos.chatMessages.append({
      conversationId: convo.id,
      role: "assistant",
      content: "RÉPONSE-DB-DE-CONFIANCE",
    });

    // Le modèle CAPTURE le prompt qu'il reçoit (les ModelMessage construits par le wrapper).
    type CapturedPrompt = Array<{ role: string; content: unknown }>;
    let captured: CapturedPrompt = [];
    const model = new MockLanguageModelV3({
      doStream: async (opts) => {
        captured = opts.prompt as CapturedPrompt;
        return {
          stream: convertArrayToReadableStream([
            ...textParts("1", "suite"),
            finish("stop"),
          ]),
        };
      },
    });

    await (
      await runAgentChat({
        userId: userA.id,
        conversationId: convo.id,
        // Le body ne porte QUE le nouveau message — aucun canal pour un faux `assistant`.
        message: "et ensuite ?",
        model,
        tools: {},
        repos,
      })
    ).text();

    const serialized = JSON.stringify(captured);
    // L'historique vient de la DB : l'assistant de confiance est présent dans le contexte…
    expect(serialized).toContain("RÉPONSE-DB-DE-CONFIANCE");
    // …et le nouveau message user aussi.
    expect(serialized).toContain("et ensuite ?");
    // Le contexte contient EXACTEMENT les 3 tours du fil (2 préexistants + le nouveau user),
    // pas un tour assistant fabriqué hors DB.
    const assistantTurns = captured.filter((m) => m.role === "assistant");
    expect(assistantTurns).toHaveLength(1);
  });

  it("CAP-5 : un run AYANT écrit pose le turnId sur la ligne assistant (lien rewind)", async () => {
    // Catalogue injecté : un `seedContacts` factice (nom = clé du registre WRITE_TOOL_NAMES).
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
        return {
          stream: convertArrayToReadableStream([
            ...textParts("2", "C'est fait."),
            finish("stop"),
          ]),
        };
      },
    });

    const res = await runAgentChat({
      userId: userA.id,
      conversationId: null,
      message: "crée 3 contacts de test",
      model,
      tools,
      repos: reposFor(userA.id),
    });
    const body = await res.text();

    // Signal de sync + turnId in-band (run ayant écrit).
    expect(body).toContain('"didWrite":true');
    expect(body).toMatch(/"turnId":"[^"]+"/);

    const rows = (await rowsForA()).sort(
      (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
    );
    const assistant = rows.find((r) => r.role === "assistant");
    // CAP-5 : la ligne assistant porte le turnId du run (réhydrate l'affordance rewind après reload).
    expect(assistant?.turnId).toBeTruthy();
    // Le turnId in-band == celui persisté.
    const inBand = body.match(/"turnId":"([^"]+)"/)?.[1];
    expect(assistant?.turnId).toBe(inBand);
  });
});
