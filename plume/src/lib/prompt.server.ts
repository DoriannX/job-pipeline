import "server-only";

// CONSTRUCTION DU PROMPT de génération « dans la voix » (story 3.3, FR-9/FR-10).
//
// Module le plus PUR possible : aucune dépendance au SDK Claude, aucune I/O, aucune
// horloge. Il prend les ingrédients (idée brute, canal, exemples de voix) et renvoie
// `{ system, messages }` — des structures de données PLATES, prêtes à être passées au
// SDK par `claude.server.ts`. Cette pureté le rend trivialement testable (pas de mock).
//
// `server-only` : le prompt encode notre « secret de fabrication » (instructions de
// voix, Liste noire des Tells, régimes de longueur). On le tient hors du bundle client.
//
// PROMPT CACHING (décision d'archi, l.70/l.76) — la structure est CACHABLE :
//   - le PRÉFIXE STABLE (instructions système + few-shot de voix) vient EN PREMIER,
//     avec `cache_control: { type: "ephemeral" }` posé sur le DERNIER bloc stable ;
//   - le SUFFIXE VOLATIL (idée brute, contexte contact) vient APRÈS, dans `messages`,
//     hors de tout breakpoint de cache.
// Tant que le corpus de voix est vide (3.5 à venir), le few-shot est neutre/vide —
// mais la structure reste cachable, prête pour le jour où le corpus se remplit.

import type Anthropic from "@anthropic-ai/sdk";

import type { Canal } from "@/lib/domain/enums";

/**
 * Version du prompt — ENTIER monotone, persisté dans `generation_events.prompt_version`
 * (3.6). À INCRÉMENTER à chaque changement OBSERVABLE de la fabrication du prompt
 * (instructions, régimes de longueur, format du few-shot). Un entier se compare et
 * s'indexe trivialement, et trace sans ambiguïté quelle recette a produit un texte.
 *
 * v2 (story 3.4) : introduction du `mode` (`generate` | `improve`). Le mode fait partie
 * de la RECETTE — le tour utilisateur diffère de façon OBSERVABLE entre les deux —, donc
 * on incrémente. Le préfixe stable (système + few-shot, cachable) reste IDENTIQUE.
 */
export const PROMPT_VERSION = 2;

/**
 * Mode de fabrication du tour utilisateur (story 3.4).
 *   - `generate` : mettre en forme une IDÉE BRUTE dans la voix (story 3.3) ;
 *   - `improve`  : RETRAVAILLER EN PLACE un texte déjà écrit par l'utilisateur, sans
 *                  imposer de ton étranger (FR-8, UX-DR8).
 * Le `system`/few-shot (préfixe cachable) est le MÊME pour les deux : seule l'INSTRUCTION
 * du tour utilisateur change.
 */
export type PromptMode = "generate" | "improve";

/** Contexte volatil minimal du contact (suffixe non cachable). Optionnel. */
export interface PromptContactContext {
  /** Prénom/nom du contact ciblé (pour adresser le message), si connu. */
  nom?: string | null;
}

/** Ingrédients de construction du prompt. */
export interface BuildPromptInput {
  /**
   * Texte d'entrée. En mode `generate` : l'IDÉE BRUTE à mettre en forme. En mode
   * `improve` : le MESSAGE déjà écrit par l'utilisateur à retravailler en place. Le
   * champ est réutilisé tel quel (le mode décide comment il est interprété) — c'est le
   * même flux serveur que 3.3, seule l'instruction change.
   */
  idea: string;
  /** Canal ciblé — pilote le régime de longueur (FR-9). */
  canal: Canal;
  /**
   * Exemples de voix (few-shot) — messages réels de l'utilisateur. VIDE pour
   * l'instant (corpus 3.5 non encore constitué) → ton neutre, jamais d'échec.
   */
  voiceExamples: string[];
  /**
   * Mode de fabrication du tour utilisateur (story 3.4). Défaut `generate` pour
   * compatibilité avec 3.3 (les appelants existants n'ont rien à changer).
   */
  mode?: PromptMode;
  /** Contexte contact volatil (nom). Optionnel. */
  contact?: PromptContactContext;
}

/** Sortie : prête à étaler dans `client.messages.stream({ system, messages })`. */
export interface BuiltPrompt {
  system: Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
}

// --- Contraintes CANAL-AWARE (FR-9) -----------------------------------------
//
// Trois RÉGIMES DE LONGUEUR distincts, un par profil de canal. C'est le cœur du
// « canal-aware » : un même fond s'écrit court sur LinkedIn, structuré en e-mail,
// très court en messagerie instantanée. Valeurs en français (le prompt parle au
// modèle en français, langue de l'app).
const CONTRAINTE_CANAL: Record<Canal, string> = {
  // LinkedIn : court, pro mais chaleureux, pas de formules d'e-mail.
  linkedin:
    "Canal LinkedIn : message COURT (2 à 4 phrases). Ton professionnel mais chaleureux. " +
    "Pas d'objet, pas de formule d'appel ni de signature : on est dans une messagerie sociale.",
  // Email : structuré, avec une vraie ouverture et une clôture.
  email:
    "Canal e-mail : message STRUCTURÉ (une ouverture, un corps en 1 à 2 courts paragraphes, " +
    "une clôture). Pas d'objet (l'utilisateur le mettra). Ton soigné, lisible.",
  // WhatsApp : très court, direct, conversationnel.
  whatsapp:
    "Canal WhatsApp : message TRÈS COURT (1 à 2 phrases), direct et conversationnel, " +
    "comme un SMS entre personnes qui se connaissent. Aucune formule protocolaire.",
  // SMS : très court, va droit au but.
  sms:
    "Canal SMS : message TRÈS COURT (1 à 2 phrases), va droit au but. " +
    "Aucune formule d'appel ni signature.",
};

// --- Instructions système STABLES (préfixe cachable) ------------------------
//
// Bloc 1 — la « persona » et les règles de voix. STABLE entre tous les appels d'un
// même utilisateur (et même entre utilisateurs au MVP) : il forme le préfixe cachable.
// On y encode la LISTE NOIRE DES TELLS de façon IMPLICITE (consigne « écris comme un
// humain »), en sachant que `sanitize()` reste le filet déterministe en aval.
const SYSTEME_VOIX_BASE =
  "Tu es la plume de l'utilisateur : tu rédiges des messages de mise en relation " +
  "professionnelle À SA PLACE, dans SA voix. Tu n'inventes jamais de faits ; tu " +
  "reformules et mets en forme l'idée brute fournie.\n\n" +
  "Écris comme un humain, jamais comme une IA. Proscris absolument : les tirets " +
  "cadratins (—), les emojis, les formules toutes faites (« J'espère que ce message " +
  "vous trouve en bonne santé »), le jargon corporate creux, les superlatifs vides. " +
  "Privilégie des phrases simples, concrètes, une ponctuation ASCII normale.\n\n" +
  "Tu produis UNIQUEMENT le corps du message, prêt à copier-coller : pas de préambule " +
  "(« Voici votre message : »), pas de guillemets autour, pas de méta-commentaire, " +
  "pas d'options multiples. Juste le message.";

/**
 * Construit le bloc few-shot de voix à partir d'exemples réels. Si la liste est VIDE
 * (corpus 3.5 non constitué), renvoie une consigne NEUTRE explicite : le modèle adopte
 * un ton sobre par défaut, sans jamais échouer (FR-16). Sinon, présente les exemples
 * comme référence de style à IMITER (le fond, lui, vient de l'idée brute).
 */
function buildFewShotBlock(voiceExamples: string[]): string {
  const examples = voiceExamples
    .map((ex) => ex.trim())
    .filter((ex) => ex.length > 0);

  if (examples.length === 0) {
    return (
      "Aucun exemple de la voix de l'utilisateur n'est disponible pour l'instant. " +
      "Adopte un ton NEUTRE, sobre et naturel par défaut : ni familier ni guindé."
    );
  }

  const corpus = examples
    .map((ex, i) => `Exemple ${i + 1} :\n${ex}`)
    .join("\n\n");
  return (
    "Voici des messages déjà écrits par l'utilisateur. Imite leur TON, leur rythme " +
    "et leur niveau de langue (PAS leur contenu) :\n\n" +
    corpus
  );
}

/**
 * Construit `{ system, messages }` pour la génération.
 *
 * Le `system` est un TABLEAU de 2 blocs texte :
 *   [0] instructions de voix de base (stable) ;
 *   [1] few-shot de voix (stable au sein d'un appel) — porte le `cache_control`
 *       éphémère : c'est le DERNIER bloc stable, donc le point de césure du cache.
 * Le SUFFIXE VOLATIL (contraintes canal + contexte contact + idée brute) part dans
 * `messages` (tour utilisateur), APRÈS le breakpoint — il ne casse pas le cache.
 */
export function buildPrompt(input: BuildPromptInput): BuiltPrompt {
  const { idea, canal, voiceExamples, contact, mode = "generate" } = input;

  // PRÉFIXE STABLE/CACHABLE — IDENTIQUE pour `generate` et `improve` (même voix, même
  // Liste noire des Tells, même few-shot). Le mode ne touche JAMAIS au système : on
  // préserve la césure du cache et la persona.
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: SYSTEME_VOIX_BASE },
    {
      type: "text",
      text: buildFewShotBlock(voiceExamples),
      // Césure du cache sur le DERNIER bloc stable (système + few-shot cachés ensemble).
      cache_control: { type: "ephemeral" },
    },
  ];

  // Suffixe VOLATIL — assemblé dans le tour utilisateur, hors du préfixe caché. La
  // contrainte canal-aware (FR-9) s'applique IDENTIQUEMENT aux deux modes ; seule
  // l'instruction sur le texte (« mettre en forme » vs « retravailler en place ») change.
  const contrainteCanal = CONTRAINTE_CANAL[canal];
  const adresse = contact?.nom?.trim()
    ? `Tu écris à ${contact.nom.trim()}.\n`
    : "";

  const consigne =
    mode === "improve"
      ? // AMÉLIORER (FR-8, UX-DR8) : retravail EN PLACE, sans ton étranger.
        "Voici un message DÉJÀ écrit par l'utilisateur. Retravaille-le EN PLACE : garde " +
        "SES idées et SA voix, n'impose AUCUN ton étranger. Rends-le plus net et plus " +
        "naturel, et adapte-le au canal (contrainte ci-dessus). Ne change pas le fond, " +
        "ne rallonge pas inutilement.\n\n" +
        `Message à retravailler :\n"""\n${idea}\n"""`
      : // GÉNÉRER (story 3.3) : mise en forme d'une idée brute.
        "Idée brute à mettre en forme dans la voix de l'utilisateur :\n" +
        `"""\n${idea}\n"""`;

  const userText = `${contrainteCanal}\n\n${adresse}${consigne}`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userText },
  ];

  return { system, messages };
}
