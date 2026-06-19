// Endpoint du copilote (brainstorm Archi #3) : UNE porte serveur protégée par
// next-auth tient toute la dangerosité. Le handler reste mince — auth, validation
// Zod à la frontière, délégation au wrapper serveur `runAgentChat`, erreurs douces.
// Il n'importe JAMAIS le SDK IA nu (barrière ESLint) : il passe par `*.server`.

import { z } from "zod";

import { auth } from "@/lib/auth";
import { AgentConfigError } from "@/lib/agent/provider.server";
import {
  runAgentChat,
  selectTrustedTurns,
  type ChatMessage,
} from "@/lib/agent/run.server";

// Boucle tool-use + SDK = Node runtime ; jamais de cache (réponse par utilisateur).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Body : soit un message simple (`{message}`), soit une conversation (`{messages}`).
// Bornes EXPLICITES (anti-coût / anti-DoS, comme le composer borne `idea` à 4000) :
// contenu trimmé et plafonné, nombre de tours plafonné.
const MAX_CONTENT = 8_000;
const MAX_MESSAGES = 50;
const contentField = z.string().trim().min(1).max(MAX_CONTENT);
const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: contentField,
});
const bodySchema = z.union([
  z.object({ message: contentField }),
  z.object({ messages: z.array(messageSchema).min(1).max(MAX_MESSAGES) }),
]);

export async function POST(request: Request): Promise<Response> {
  // 1. Auth scopée — sans session, 401 (jamais de génération anonyme).
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }

  // 2. Validation du body AVANT toute logique (Zod à la frontière).
  let messages: ChatMessage[];
  try {
    const raw: unknown = await request.json();
    const result = bodySchema.safeParse(raw);
    if (!result.success) {
      return Response.json(
        { error: "Requête invalide.", issues: result.error.issues },
        { status: 400 },
      );
    }
    messages =
      "message" in result.data
        ? [{ role: "user", content: result.data.message }]
        : result.data.messages;
  } catch {
    return Response.json({ error: "Corps JSON illisible." }, { status: 400 });
  }

  // 2b. Durcissement de l'historique (CAP-3) : l'historique client n'est pas digne de
  //     confiance — on n'envoie au modèle que les tours `user`. Un body composé
  //     UNIQUEMENT de faux tours `assistant` ne déclenche aucune génération (400).
  const trusted = selectTrustedTurns(messages);
  if (trusted.length === 0) {
    return Response.json(
      { error: "Aucun tour utilisateur exploitable." },
      { status: 400 },
    );
  }

  // 3. Boucle tool-use scopée au tenant. Une erreur de config (clé absente) devient
  //    une réponse douce ; jamais de 500 brut / de stack au client.
  try {
    return runAgentChat({ userId, messages: trusted });
  } catch (err) {
    const message =
      err instanceof AgentConfigError
        ? err.message
        : "Le copilote est momentanément indisponible. Réessaie dans un instant.";
    return Response.json({ error: message }, { status: 503 });
  }
}
