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
import { AppError, generateMessage } from "@/lib/claude.server";
import { buildGenerationEvent } from "@/lib/composer/pipeline.server";
import { selectFewShot } from "@/lib/composer/voice";
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

  // 3. Extraction du CORPUS DE VOIX scopé (FR-17, archi l.193). Le corpus = `seed_voix`
  //    (amorce optionnelle) + TOUS les Messages ENVOYÉS (manuels inclus, aucune exclusion)
  //    — c'est la couture annoncée en 3.5, effective ici en 3.6. On lit les deux sources
  //    via la porte scopée, on les FUSIONNE en une liste ordonnée récent → ancien, puis on
  //    BORNE le few-shot avec la stratégie nommée `selectFewShot` (les N plus récents,
  //    AR-7, NFR-1). `voiceExamplesRef` trace les ids EXACTS injectés (seeds et/ou
  //    messages). Liste vide → `[]` → ton NEUTRE (FR-16). Un échec d'accès DB ne doit PAS
  //    casser la génération : on l'absorbe et on dégrade en corpus vide (jamais de 500).
  let voiceExamples: string[] = [];
  let voiceExamplesRef: string[] = [];
  try {
    const gate = await forUser(userId);
    // Les deux sources sont déjà ordonnées récent → ancien par leur repository.
    const [seeds, sentTexts] = await Promise.all([
      gate.seedVoix.list(),
      gate.messages.listSentTexts(),
    ]);
    // Exemples candidats, AVEC leur référence (id de seed, ou marqueur de message). On
    // entrelace par récence approximative en plaçant les Messages envoyés D'ABORD (la
    // voix la plus actuelle = ce que l'utilisateur a réellement envoyé), puis les seeds.
    const candidates: { texte: string; ref: string }[] = [
      ...sentTexts.map((texte, i) => ({ texte, ref: `message:${i}` })),
      ...seeds.map((s) => ({ texte: s.texte, ref: s.id })),
    ];
    voiceExamples = selectFewShot(candidates.map((c) => c.texte));
    // `selectFewShot` garde les N premiers : les N premières refs correspondent 1-pour-1.
    voiceExamplesRef = candidates.slice(0, voiceExamples.length).map((c) => c.ref);
  } catch {
    // Accès DB indisponible : ton neutre (corpus vide), jamais de 500 brut.
    voiceExamples = [];
    voiceExamplesRef = [];
  }

  const { idea, canal, tone, mode } = parsed;

  // 4. Flux NDJSON : on POMPE les deltas du modèle vers le client en direct, puis on
  //    finalise (sanitize + GenerationEvent) dans l'event `done`. Toute erreur devient
  //    un event `error` DOUX (jamais de 500 brut au client : il lit le flux).
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await generateMessage(
          { idea, canal, tone, voiceExamples, mode },
          (delta) => {
            controller.enqueue(ndjson({ type: "delta", text: delta }));
          },
        );

        // Finalisation : sanitize + re-valide bornée + GenerationEvent en mémoire.
        const event = buildGenerationEvent({
          rawText: result.text,
          idea,
          canal,
          tone,
          mode,
          modelId: result.modelId,
          voiceExamplesRef,
          tokens: {
            input: result.usage.inputTokens,
            output: result.usage.outputTokens,
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
