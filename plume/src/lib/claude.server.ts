import "server-only";

// ENCAPSULATION du SDK Claude (story 3.3, AR-7/AR-11) — barrière « clé server-only ».
//
// SEUL module autorisé à importer `@anthropic-ai/sdk` (cf. eslint.config.mjs : le SDK
// n'est importable que dans src/lib/**). La route `/api/composer` et le reste de la base
// passent par ici ; ils ne voient jamais le SDK ni la clé.
//
// RÔLE : sélectionner le modèle (Haiku/Opus selon le registre), construire le prompt
// canal-aware few-shot (délégué à prompt.server), STREAMER les deltas via un callback
// `onDelta`, et renvoyer `{ text, usage, modelId }`. AUCUNE écriture DB ici (la frontière
// `GenerationEvent` est construite par l'appelant).
//
// CONTRAINTES API VERROUILLÉES (un écart = 400 runtime sur Opus 4.8) :
//   - Model IDs EXACTS : `claude-haiku-4-5` (Rapide) / `claude-opus-4-8` (Soigné).
//   - JAMAIS `temperature` / `top_p` / `top_k` (Opus 4.8 les rejette en 400).
//   - JAMAIS `thinking` (on vise < 5 s ; thinking off par défaut convient).
//   - Un SEUL chemin de code pour les 2 modèles (mêmes paramètres).

import Anthropic from "@anthropic-ai/sdk";

import type { Canal } from "@/lib/domain/enums";
import type { Tone } from "@/features/composer/generation";
import {
  buildPrompt,
  type PromptContactContext,
  type PromptMode,
} from "./prompt.server";

/**
 * Erreur applicative typée (archi l.278 : `AppError {code, message, retriable}`).
 * `code` mappe un statut HTTP côté route (`ia_indisponible` → 503). Pas de stack
 * brute renvoyée au client : la route en fait un event `error` doux.
 */
export class AppError extends Error {
  constructor(
    readonly code: "ia_indisponible" | "ia_echec",
    message: string,
    readonly retriable: boolean,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Sélection du modèle EXACT selon le registre (FR-14). 3 paliers (story 7.7, F13) : Haiku par
 * défaut (Rapide), Sonnet (Équilibré — compromis coût/qualité), Opus (Soigné). Aucun suffixe de
 * date (les alias sont complets). `Record<Tone>` ⇒ le typecheck force la complétude des paliers.
 */
export const MODEL_BY_TONE: Record<Tone, string> = {
  rapide: "claude-haiku-4-5",
  equilibre: "claude-sonnet-4-6",
  soigne: "claude-opus-4-8",
};

/** Un message court : on borne la sortie. */
const MAX_TOKENS = 1024;

/** Ingrédients d'une génération streaming. */
export interface GenerateInput {
  /**
   * Texte d'entrée. `generate` : idée brute à mettre en forme. `improve` : message déjà
   * écrit à retravailler en place (même champ — le `mode` décide de l'interprétation).
   */
  idea: string;
  /** Canal ciblé (pilote la longueur). */
  canal: Canal;
  /** Registre (pilote le choix de modèle). */
  tone: Tone;
  /** Exemples de voix (few-shot). Vide tant que le corpus 3.5 n'existe pas. */
  voiceExamples: string[];
  /**
   * Mode de fabrication du prompt (story 3.4). Défaut `generate` (compat 3.3). Le mode
   * ne change RIEN au pipeline (mêmes modèles, mêmes paramètres, même streaming) : il
   * n'influe QUE sur l'instruction du tour utilisateur, via `buildPrompt`.
   */
  mode?: PromptMode;
  /** Contexte contact volatil (nom). Optionnel. */
  contact?: PromptContactContext;
}

/** Résultat d'une génération streaming (texte BRUT, non encore sanitizé). */
export interface GenerateResult {
  /** Texte complet renvoyé par le modèle (avant `sanitize()`). */
  text: string;
  /** Tokens consommés (entrée/sortie). */
  usage: { inputTokens: number; outputTokens: number };
  /** Id EXACT du modèle ayant produit le texte. */
  modelId: string;
}

/**
 * Client Anthropic créé PARESSEUSEMENT, une seule fois. On lit `ANTHROPIC_API_KEY`
 * À L'APPEL (jamais au chargement du module) : `next build` ne doit pas exiger la clé
 * (la route est dynamique). Clé absente → AppError propre « IA indisponible » (503),
 * jamais un crash.
 */
let client: Anthropic | null = null;
function getClient(): Anthropic {
  // On RE-VALIDE la présence de la clé à CHAQUE appel (jamais au chargement du module) :
  // ainsi `next build` ne l'exige pas, et une clé retirée échoue proprement même si un
  // client avait déjà été construit. La construction, elle, reste mémoïsée (une fois).
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AppError(
      "ia_indisponible",
      "IA indisponible : clé API absente (ANTHROPIC_API_KEY).",
      false,
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Génère un message dans la voix, en STREAMING. Pompe chaque delta de texte vers
 * `onDelta` au fil de l'eau, puis renvoie le texte complet + l'usage + le modelId.
 *
 * @throws AppError `ia_indisponible` si la clé manque ; `ia_echec` si l'appel modèle
 *         échoue (réseau, 4xx/5xx Anthropic). Jamais d'erreur brute remontée.
 */
export async function generateMessage(
  input: GenerateInput,
  onDelta: (text: string) => void,
): Promise<GenerateResult> {
  const modelId = MODEL_BY_TONE[input.tone];
  const anthropic = getClient(); // peut lever AppError('ia_indisponible')

  const { system, messages } = buildPrompt({
    idea: input.idea,
    canal: input.canal,
    voiceExamples: input.voiceExamples,
    mode: input.mode,
    contact: input.contact,
  });

  try {
    // NOTE : un seul chemin pour les 2 modèles. Aucun `temperature`/`top_p`/`top_k`,
    // aucun `thinking` (rejetés en 400 par Opus 4.8 / inutiles ici).
    const stream = anthropic.messages.stream({
      model: modelId,
      max_tokens: MAX_TOKENS,
      system,
      messages,
    });

    // `text` ne porte QUE le delta (pas le snapshot complet) : on le forwarde tel quel.
    stream.on("text", (delta) => {
      onDelta(delta);
    });

    const message = await stream.finalMessage();
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return {
      text,
      usage: {
        inputTokens: message.usage.input_tokens ?? 0,
        outputTokens: message.usage.output_tokens ?? 0,
      },
      modelId,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Tout échec d'appel modèle → AppError douce (la route en fait un event `error`).
    throw new AppError(
      "ia_echec",
      "La génération a échoué. Réessaie dans un instant.",
      true,
    );
  }
}
