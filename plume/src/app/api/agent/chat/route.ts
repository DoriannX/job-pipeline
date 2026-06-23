// Endpoint du copilote (brainstorm Archi #3) : UNE porte serveur protégée par
// next-auth tient toute la dangerosité. Le handler reste mince — auth, validation
// Zod à la frontière, vérification d'APPARTENANCE du fil, délégation au wrapper serveur
// `runAgentChat`, erreurs douces. Il n'importe JAMAIS le SDK IA nu (barrière ESLint) :
// il passe par `*.server`. Toute la persistance est SERVEUR (Phase 3, CAP-1/2/3).

import { z } from "zod";

import { auth } from "@/lib/auth";
import { forUser } from "@/lib/db";
import { AgentConfigError } from "@/lib/agent/provider.server";
import { runAgentChat } from "@/lib/agent/run.server";

// Boucle tool-use + SDK = Node runtime ; jamais de cache (réponse par utilisateur).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Body PHASE 3 : le client n'envoie QUE le nouveau message `user` + l'id du fil (jamais
// l'historique `assistant` — le serveur est la source de vérité du contexte, CAP-3).
// Bornes EXPLICITES (anti-coût / anti-DoS, parité `MAX_CONTENT` du composer) : contenu trimmé
// et plafonné, `conversationId` borné (id cuid2). `conversationId` absent = 1er message d'un fil
// neuf (création paresseuse serveur, CAP-2/4).
const MAX_CONTENT = 8_000;
const MAX_ID = 64;
const contentField = z.string().trim().min(1).max(MAX_CONTENT);
const bodySchema = z.object({
  conversationId: z.string().trim().min(1).max(MAX_ID).optional(),
  message: contentField,
});

export async function POST(request: Request): Promise<Response> {
  // 1. Auth scopée — sans session, 401 (jamais de génération anonyme ; ni lecture ni écriture
  //    d'un fil sans session).
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }

  // 2. Validation du body AVANT toute logique (Zod à la frontière).
  let conversationId: string | undefined;
  let message: string;
  try {
    const raw: unknown = await request.json();
    const result = bodySchema.safeParse(raw);
    if (!result.success) {
      return Response.json(
        { error: "Requête invalide.", issues: result.error.issues },
        { status: 400 },
      );
    }
    conversationId = result.data.conversationId;
    message = result.data.message;
  } catch {
    return Response.json({ error: "Corps JSON illisible." }, { status: 400 });
  }

  // 3. Boucle tool-use scopée au tenant + persistance serveur. Une erreur de config (clé absente)
  //    devient une réponse douce ; jamais de 500 brut / de stack au client.
  try {
    const gate = await forUser(userId);

    // 3a. APPARTENANCE du fil (CAP-3, SÉCU) : si un `conversationId` est fourni, il DOIT
    //     appartenir au tenant courant (la porte scopée le rend invisible sinon → `null`). On
    //     refuse 404 plutôt que de cibler — ou de fuiter — le fil d'autrui ; aucune génération.
    //     Absent = fil neuf (création paresseuse côté `runAgentChat`).
    if (conversationId) {
      const owned = await gate.conversations.findById(conversationId);
      if (!owned) {
        return Response.json({ error: "Conversation introuvable." }, { status: 404 });
      }
    }

    return await runAgentChat({
      userId,
      conversationId: conversationId ?? null,
      message,
      repos: { conversations: gate.conversations, chatMessages: gate.chatMessages },
      // F5 (story 7-9) : on propage le signal de la requête. Quand le client clique « Stop »,
      // son `AbortController` annule le `fetch` → `request.signal` s'abort → `streamText` cesse
      // et aucun tour `assistant` partiel n'est persisté (le tour `user`, écrit avant, reste).
      abortSignal: request.signal,
    });
  } catch (err) {
    const message =
      err instanceof AgentConfigError
        ? err.message
        : "Le copilote est momentanément indisponible. Réessaie dans un instant.";
    return Response.json({ error: message }, { status: 503 });
  }
}
