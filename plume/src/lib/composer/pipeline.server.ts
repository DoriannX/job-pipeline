import "server-only";

// PIPELINE de génération du Composeur — la logique testable, extraite de la route.
//
// La route handler (`app/api/composer/route.ts`) est dure à tester unitairement
// (auth, ReadableStream, env). On en extrait ICI les deux opérations métier pures-ish :
//   1. la finalisation : texte brut → `sanitize()` + boucle re-valide bornée → texte propre ;
//   2. la construction de l'événement `GenerationEvent` en mémoire (AR-8).
// La route se contente d'orchestrer auth + flux + appel de ces fonctions.
//
// `server-only` : importe `sanitize` (server-only) ; appartient au serveur.

import { hasTells, sanitize, SANITIZE_VERSION, MAX_SANITIZE_RETRIES } from "@/lib/copy";
import { generateMessage } from "@/lib/claude.server";
import type { UserGate } from "@/lib/db";
import type { Canal } from "@/lib/domain/enums";
import { PROMPT_VERSION, type PromptContactContext } from "@/lib/prompt.server";
import { selectFewShot } from "@/lib/composer/voice";
import type {
  GenerationEvent,
  GenerationMode,
  Tone,
} from "@/features/composer/generation";

/**
 * Nettoie le texte généré et RE-VALIDE en boucle bornée (archi l.293).
 *
 * `sanitize()` étant IDEMPOTENT, `hasTells(sanitize(x)) === false` : une seule passe
 * suffit toujours. La boucle bornée par `MAX_SANITIZE_RETRIES` est donc une SÉCURITÉ
 * (au cas où une évolution future de sanitize/hasTells les désynchroniserait) — jamais
 * un chemin chaud. On ne boucle JAMAIS sans borne.
 */
export function finalizeText(raw: string): string {
  let out = sanitize(raw);
  let attempts = 0;
  while (hasTells(out) && attempts < MAX_SANITIZE_RETRIES) {
    out = sanitize(out);
    attempts += 1;
  }
  return out;
}

/** Ingrédients de construction du `GenerationEvent` (tout vient déjà du serveur). */
export interface BuildEventInput {
  /** Texte BRUT renvoyé par le modèle (sera sanitizé ici). */
  rawText: string;
  /** Texte d'entrée (idée brute en `generate`, message à retravailler en `improve`). */
  idea: string;
  /** Canal ciblé. */
  canal: Canal;
  /** Registre demandé. */
  tone: Tone;
  /** Mode de génération (`generate` | `improve`). Défaut `generate` (compat 3.3). */
  mode?: GenerationMode;
  /** Id EXACT du modèle ayant produit le texte. */
  modelId: string;
  /** Références des exemples de voix injectés (vide tant que le corpus 3.5 est vide). */
  voiceExamplesRef: string[];
  /** Tokens consommés. */
  tokens: { input: number; output: number };
}

/**
 * Construit le `GenerationEvent` EN MÉMOIRE (jamais persisté ici — 3.6).
 *
 * Sanitize le texte (via `finalizeText`) puis renseigne les champs versionnés
 * (`promptVersion`, `sanitizeVersion`, `modelId`) qui rendent le moat reconstructible.
 * Retourne aussi à part le texte final (= `generatedText`) pour que la route le renvoie
 * dans l'event `done` sans le re-dériver.
 */
export function buildGenerationEvent(input: BuildEventInput): GenerationEvent {
  const generatedText = finalizeText(input.rawText);
  return {
    generatedText,
    // `rawIntent` = idée brute saisie. CHAÎNE VIDE ⟺ « Générer sans idée » (brouillon de
    // prise de contact) : c'est le marqueur naturel à exclure des analyses SM-1 d'écart
    // généré→envoyé, pour ne pas confondre « aucune idée » et une vraie idée utilisateur.
    rawIntent: input.idea,
    canal: input.canal,
    tone: input.tone,
    mode: input.mode ?? "generate",
    modelId: input.modelId,
    promptVersion: PROMPT_VERSION,
    sanitizeVersion: SANITIZE_VERSION,
    voiceExamplesRef: input.voiceExamplesRef,
    tokens: { input: input.tokens.input, output: input.tokens.output },
  };
}

// ---------------------------------------------------------------------------
// PIPELINE VOIX PARTAGÉ (copilote Phase 2 inc.3) — extrait de la route `/api/composer`.
//
// Le moat (voix, Tells, longueur canal-aware) NE doit JAMAIS être dupliqué. La route
// `/api/composer` ET le write-tool `composeMessage` du copilote appellent le MÊME
// pipeline : assemblage du corpus de voix (seeds + messages envoyés via `listSentTexts`
// + sélection few-shot bornée), génération (`generateMessage`), puis `sanitize()`
// déterministe via `buildGenerationEvent`. Seul varie le SIGNE de sortie : la route
// STREAME les deltas vers le client (NDJSON), le tool ne veut que le texte final.
// ---------------------------------------------------------------------------

/** Corpus de voix scopé + ses références (ids des exemples injectés). */
export interface VoiceCorpus {
  /** Exemples few-shot bornés (ordre récent → ancien), prêts pour le prompt. */
  voiceExamples: string[];
  /** Références 1-pour-1 des exemples retenus (`message:i` ou id de seed). */
  voiceExamplesRef: string[];
}

/**
 * Assemble le CORPUS DE VOIX scopé (FR-17) : `seed_voix` (amorce) + Messages ENVOYÉS
 * (`listSentTexts`), fusionnés récent → ancien (les messages d'abord = voix la plus
 * actuelle), puis bornés par `selectFewShot`. Un échec d'accès DB ne casse PAS la
 * génération : on DÉGRADE en corpus vide (ton neutre, FR-16) — jamais de 500.
 */
export async function assembleVoiceCorpus(gate: UserGate): Promise<VoiceCorpus> {
  try {
    // Les deux sources sont déjà ordonnées récent → ancien par leur repository.
    const [seeds, sentTexts] = await Promise.all([
      gate.seedVoix.list(),
      gate.messages.listSentTexts(),
    ]);
    const candidates: { texte: string; ref: string }[] = [
      ...sentTexts.map((texte, i) => ({ texte, ref: `message:${i}` })),
      ...seeds.map((s) => ({ texte: s.texte, ref: s.id })),
    ];
    const voiceExamples = selectFewShot(candidates.map((c) => c.texte));
    // `selectFewShot` garde les N premiers : les N premières refs correspondent 1-pour-1.
    const voiceExamplesRef = candidates
      .slice(0, voiceExamples.length)
      .map((c) => c.ref);
    return { voiceExamples, voiceExamplesRef };
  } catch {
    // Accès DB indisponible : ton neutre (corpus vide), jamais de 500 brut.
    return { voiceExamples: [], voiceExamplesRef: [] };
  }
}

/** Ingrédients d'une génération « dans la voix » via le pipeline partagé. */
export interface ComposeInVoiceInput {
  /** Porte scopée du tenant (corpus voix + persistance). */
  gate: UserGate;
  /** Texte d'entrée (idée brute en `generate`, message à retravailler en `improve`). */
  idea: string;
  /** Canal ciblé (pilote la longueur). */
  canal: Canal;
  /** Registre (pilote le choix de modèle). */
  tone: Tone;
  /** Mode (`generate` | `improve`). Défaut `generate`. */
  mode?: GenerationMode;
  /** Contexte contact volatil (nom). Optionnel. */
  contact?: PromptContactContext;
  /** Callback de streaming des deltas (route NDJSON). Omis = pas de stream (tool). */
  onDelta?: (delta: string) => void;
}

/** Sortie du pipeline partagé : l'événement de génération (texte sanitizé inclus). */
export interface ComposeInVoiceResult {
  /** `GenerationEvent` en mémoire ; `generatedText` = sortie SANITIZÉE finale. */
  event: GenerationEvent;
}

/**
 * Exécute le pipeline voix de bout en bout (corpus → génération → sanitize) et renvoie
 * le `GenerationEvent`. C'est LE point unique du moat partagé par la route et le copilote.
 * `onDelta` permet à la route de pomper le flux ; le tool l'omet (il ne veut que la
 * sortie finale `event.generatedText`). Peut lever `AppError` (clé absente / échec IA) :
 * l'appelant la transforme en erreur douce (event NDJSON `error` ou résultat tool absorbé).
 */
export async function composeInVoice(
  input: ComposeInVoiceInput,
): Promise<ComposeInVoiceResult> {
  const { voiceExamples, voiceExamplesRef } = await assembleVoiceCorpus(input.gate);

  const result = await generateMessage(
    {
      idea: input.idea,
      canal: input.canal,
      tone: input.tone,
      voiceExamples,
      mode: input.mode,
      contact: input.contact,
    },
    // Stream optionnel : la route forwarde chaque delta ; le tool ne consomme rien.
    input.onDelta ?? (() => {}),
  );

  const event = buildGenerationEvent({
    rawText: result.text,
    idea: input.idea,
    canal: input.canal,
    tone: input.tone,
    mode: input.mode,
    modelId: result.modelId,
    voiceExamplesRef,
    tokens: {
      input: result.usage.inputTokens,
      output: result.usage.outputTokens,
    },
  });

  return { event };
}
