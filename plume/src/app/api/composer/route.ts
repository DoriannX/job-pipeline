// POST /api/composer — génération « dans la voix » en STREAMING (story 3.3).
//
// LE pipeline serveur du moat (archi l.212) :
//   résoudre userId (auth) → SELECT corpus voix (scopé, VIDE pour l'instant → []) →
//   prompt few-shot canal-aware (Haiku/Opus) → STREAM des deltas vers le client →
//   `sanitize()` + re-valide bornée → `GenerationEvent` EN MÉMOIRE (pas persisté ici).
//
// La clé Claude reste server-only : le client ne reçoit QUE le flux. Le SDK n'est jamais
// importé ici — on passe par le wrapper `@/lib/claude.server` (barrière clé server-only).
//
// PROTOCOLE DE FLUX : NDJSON (une ligne JSON par event, séparées par `\n`).
//   pendant le flux : {"type":"delta","text": "<delta>"}
//   à la fin OK     : {"type":"done","text":"<sanitizé>","event":<GenerationEvent>,
//                      "usage":{"input":n,"output":n}}
//   en cas d'échec  : {"type":"error","message":"<doux>"}
// Choix NDJSON (et non SSE `text/event-stream`) : le client lit un `ReadableStream` via
// reader + TextDecoder et `split("\n")` — plus simple à parser que le framing SSE, et
// suffisant ici (un seul flux, pas de multiplexing d'événements nommés).
//
// La route est DYNAMIQUE : elle lit le body, l'auth et l'env À LA REQUÊTE. `next build`
// ne doit jamais évaluer `ANTHROPIC_API_KEY` (la clé est lue paresseusement dans le
// wrapper, et seulement à l'appel) — d'où `dynamic = "force-dynamic"`.

import { z } from "zod";

import { auth } from "@/lib/auth";
import { forUser } from "@/lib/db";
import { CANAUX } from "@/lib/domain/enums";
import { AppError } from "@/lib/claude.server";
import { composeInVoice } from "@/lib/composer/pipeline.server";
import { ideaRequired } from "@/features/composer/generation";

// Runtime Node (le SDK Anthropic + l'accès DB visent Node, pas l'edge). Force-dynamic :
// aucune prérendu, l'env n'est lu qu'à la requête → build sans secret.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- Validation Zod du body (frontière, archi l.290) ------------------------
// `mode` ouvre les DEUX recettes (story 3.4) : `generate` (mise en forme d'une idée) et
// `improve` (retravail en place d'un texte existant). Le pipeline serveur est IDENTIQUE
// pour les deux (sanitize, streaming, fallback, tokens) — seule l'instruction du prompt
// diffère. `idea` porte le texte d'entrée dans les deux cas (idée brute OU message à
// retravailler) ; défaut `generate` pour rester compatible avec les appelants existants.
const bodySchema = z
  .object({
    // `idea` OPTIONNELLE : en mode `generate`, un champ vide est valide (« Générer »
    // produit alors un brouillon de prise de contact). En mode `improve`, il faut un
    // texte à retravailler (garde-fou ci-dessous).
    idea: z.string().trim().max(4000, "Idée trop longue.").default(""),
    canal: z.enum(CANAUX),
    tone: z.enum(["rapide", "soigne"]),
    mode: z.enum(["generate", "improve"]).default("generate"),
  })
  .refine((d) => !ideaRequired(d.mode) || d.idea.length >= 1, {
    message: "Rien à retravailler : le champ est vide.",
    path: ["idea"],
  });

const encoder = new TextEncoder();

/** Sérialise un event NDJSON (objet JSON + `\n`) en octets prêts à enqueue. */
function ndjson(event: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(event) + "\n");
}

export async function POST(request: Request): Promise<Response> {
  // 1. Auth scopée — sans session, 401 (jamais de génération anonyme).
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }

  // 2. Validation du body AVANT toute logique (Zod à la frontière).
  let parsed: z.infer<typeof bodySchema>;
  try {
    const raw: unknown = await request.json();
    const result = bodySchema.safeParse(raw);
    if (!result.success) {
      return Response.json(
        { error: "Requête invalide.", issues: result.error.issues },
        { status: 400 },
      );
    }
    parsed = result.data;
  } catch {
    return Response.json({ error: "Corps JSON illisible." }, { status: 400 });
  }

  // 3. Porte scopée du tenant — sert le corpus de voix au pipeline partagé. Construire la
  //    porte ne touche pas l'I/O (les lectures se font dans `composeInVoice`) → jamais de
  //    throw ici pour un userId valide.
  const gate = await forUser(userId);

  const { idea, canal, tone, mode } = parsed;

  // 4. Flux NDJSON : on délègue au PIPELINE VOIX PARTAGÉ (`composeInVoice`) — corpus voix
  //    (FR-17) → génération → `sanitize()` —, en lui passant un `onDelta` qui POMPE les
  //    deltas vers le client en direct. La route et le copilote partagent CE moat (zéro
  //    duplication). Toute erreur devient un event `error` DOUX (jamais de 500 : il lit le flux).
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const { event } = await composeInVoice({
          gate,
          idea,
          canal,
          tone,
          mode,
          onDelta: (delta) => {
            controller.enqueue(ndjson({ type: "delta", text: delta }));
          },
        });

        controller.enqueue(
          ndjson({
            type: "done",
            text: event.generatedText,
            event,
            usage: { input: event.tokens.input, output: event.tokens.output },
          }),
        );
      } catch (err) {
        // Erreur douce : message lisible, jamais de stack. AppError porte un message
        // déjà tourné « doux » ; tout le reste tombe sur un message générique.
        const message =
          err instanceof AppError
            ? err.message
            : "La génération a échoué. Réessaie dans un instant.";
        controller.enqueue(ndjson({ type: "error", message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      // NDJSON ligne-à-ligne ; pas de buffering proxy ; pas de cache.
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
    },
  });
}
