// Client du flux UI message `streamCopilote` (copilote inc.2) — front « bête ».
//
// On prouve, CÔTÉ CLIENT, que le parseur du flux SSE traduit correctement les parts
// porteuses de sens pour l'UI :
//   - CAP-3 : une part `error` (ou `abort`) → `onError` (fin TERMINALE), et SURTOUT pas
//     `onDone` (le tour est clos sur une erreur douce, jamais pris pour un succès) ;
//   - CAP-2 : la métadonnée `didWrite` de la part `finish` → `onWrite` (le SEUL signal
//     dont le composant a besoin pour `router.refresh()`), déclenché que le tour finisse
//     normalement OU sur une erreur (une écriture commise reste reflétée).
//
// `fetch` est stubé : aucune route réelle, on injecte directement un corps SSE.

import { afterEach, describe, expect, it, vi } from "vitest";

import { streamCopilote } from "@/features/copilote/stream-client";

/** Construit une Response 200 dont le corps streame les lignes SSE données. */
function sseResponse(lines: string[]): Response {
  const body = `${lines.join("\n")}\n`;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

const sse = (part: unknown) => `data: ${JSON.stringify(part)}`;

afterEach(() => vi.unstubAllGlobals());

describe("streamCopilote — parseur du flux UI message (copilote inc.2)", () => {
  it("CAP-3 : une part `error` déclenche onError TERMINAL, ni onDone ni onWrite", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          sse({ type: "text-start", id: "1" }),
          sse({ type: "text-delta", id: "1", delta: "Je regarde" }),
          sse({ type: "error", errorText: "Le copilote a rencontré un souci." }),
        ]),
      ),
    );

    const onDelta = vi.fn();
    const onError = vi.fn();
    const onDone = vi.fn();
    const onWrite = vi.fn();
    await streamCopilote({ conversationId: null, message: "salut" }, {
      onDelta,
      onError,
      onDone,
      onWrite,
    });

    expect(onDelta).toHaveBeenCalledWith("Je regarde");
    expect(onError).toHaveBeenCalledWith("Le copilote a rencontré un souci.");
    // Erreur terminale (read-only) : ni fin réussie, ni sync.
    expect(onDone).not.toHaveBeenCalled();
    expect(onWrite).not.toHaveBeenCalled();
  });

  it("CAP-2 : `didWrite:true` en fin de flux remonte via onWrite (déclencheur de sync)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          sse({ type: "text-start", id: "1" }),
          sse({ type: "text-delta", id: "1", delta: "C'est fait." }),
          sse({ type: "finish", messageMetadata: { didWrite: true } }),
        ]),
      ),
    );

    const onError = vi.fn();
    const onDone = vi.fn();
    const onWrite = vi.fn();
    await streamCopilote({ conversationId: "c1", message: "crée 3 contacts" }, {
      onDelta: vi.fn(),
      onError,
      onDone,
      onWrite,
    });

    expect(onError).not.toHaveBeenCalled();
    expect(onWrite).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("CAP-2 robustesse : une écriture SUIVIE d'une erreur déclenche QUAND MÊME onWrite", async () => {
    // Le SDK émet la part `finish` (didWrite) MÊME quand le tour se clôt sur une erreur
    // (`finishReason:"error"`). Une mutation commise doit rester reflétée (router.refresh).
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          sse({ type: "text-delta", id: "1", delta: "C'est" }),
          sse({ type: "error", errorText: "Coupure en cours de route." }),
          sse({ type: "finish", messageMetadata: { didWrite: true } }),
        ]),
      ),
    );

    const onError = vi.fn();
    const onDone = vi.fn();
    const onWrite = vi.fn();
    await streamCopilote({ conversationId: "c1", message: "crée 3 contacts" }, {
      onDelta: vi.fn(),
      onError,
      onDone,
      onWrite,
    });

    // Erreur affichée (CAP-3), pas de fin normale, MAIS la sync est déclenchée (CAP-2).
    expect(onError).toHaveBeenCalledWith("Coupure en cours de route.");
    expect(onDone).not.toHaveBeenCalled();
    expect(onWrite).toHaveBeenCalledTimes(1);
  });

  it("CAP-2 : un run read-only termine sans onWrite (aucun refresh)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          sse({ type: "text-delta", id: "1", delta: "Tu as 3 contacts." }),
          sse({ type: "finish", messageMetadata: { didWrite: false } }),
        ]),
      ),
    );

    const onDone = vi.fn();
    const onWrite = vi.fn();
    await streamCopilote({ conversationId: "c1", message: "combien ?" }, {
      onDelta: vi.fn(),
      onError: vi.fn(),
      onDone,
      onWrite,
    });

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onWrite).not.toHaveBeenCalled();
  });

  it("Phase 3 : le conversationId in-band (part `finish`) remonte via onConversation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          sse({ type: "text-delta", id: "1", delta: "Bonjour." }),
          sse({
            type: "finish",
            messageMetadata: { didWrite: false, conversationId: "conv-neuf-1" },
          }),
        ]),
      ),
    );

    const onConversation = vi.fn();
    await streamCopilote(
      { conversationId: null, message: "salut" },
      {
        onDelta: vi.fn(),
        onError: vi.fn(),
        onDone: vi.fn(),
        onWrite: vi.fn(),
        onConversation,
      },
    );

    expect(onConversation).toHaveBeenCalledWith("conv-neuf-1");
  });

  it("Phase 3 : un fil neuf (conversationId null) n'envoie PAS de conversationId au serveur", async () => {
    const fetchMock = vi.fn(async () =>
      sseResponse([
        sse({
          type: "finish",
          messageMetadata: { didWrite: false, conversationId: "c-new" },
        }),
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    await streamCopilote(
      { conversationId: null, message: "premier" },
      { onDelta: vi.fn(), onError: vi.fn(), onDone: vi.fn() },
    );

    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(call[1].body as string) as Record<string, unknown>;
    expect(body).toEqual({ message: "premier" });
    expect("conversationId" in body).toBe(false);
  });

  it("part `abort` (interruption serveur) → message doux terminal, pas onDone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          sse({ type: "text-delta", id: "1", delta: "Je" }),
          sse({ type: "abort" }),
        ]),
      ),
    );

    const onError = vi.fn();
    const onDone = vi.fn();
    await streamCopilote({ conversationId: null, message: "salut" }, {
      onDelta: vi.fn(),
      onError,
      onDone,
      onWrite: vi.fn(),
    });

    expect(onError).toHaveBeenCalledWith(
      "Le tour a été interrompu avant la fin. Réessaie dans un instant.",
    );
    expect(onDone).not.toHaveBeenCalled();
  });

  it("401 sans flux → message doux, aucun parse de corps", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );

    const onError = vi.fn();
    const onDone = vi.fn();
    await streamCopilote({ conversationId: null, message: "salut" }, {
      onDelta: vi.fn(),
      onError,
      onDone,
      onWrite: vi.fn(),
    });

    expect(onError).toHaveBeenCalledWith(
      "Session expirée. Reconnecte-toi puis réessaie.",
    );
    expect(onDone).not.toHaveBeenCalled();
  });
});
