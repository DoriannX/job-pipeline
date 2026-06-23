// EVAL RUNNER — evals figés de la Voix (story 3.9, anti-régression). DERNIÈRE story
// de l'Epic 3. Test-only : AUCUN code applicatif, AUCUNE migration, AUCUN appel réseau.
//
// CE QUE FAIT CE FICHIER
//   Rejoue le PANIER GELÉ (tests/fixtures/claude-canned/voice-basket.ts) à CHAQUE
//   `pnpm test` (donc en CI) contre le VRAI pipeline (`sanitize` / `hasTells` /
//   `buildPrompt` réels). Pour chaque cas il vérifie 4 choses :
//     (a) GOLDEN/TON  : sanitize(rawClaude) === expectedSanitized
//                       → si sanitize() régresse, le golden « bon ton » n'est plus
//                         atteint et l'éval casse (le ton conservé = égalité au golden).
//     (b) ZÉRO TELL   : hasNoTells(sanitize(rawClaude)) → un Tell réapparu = échec.
//     (c) LONGUEUR    : withinCanalTarget(sanitize(rawClaude), canal) → hors cible = échec.
//     (d) COUPLAGE    : buildPrompt(...).messages[0].content CONTIENT la contrainte
//         PROMPT        canal-aware attendue (ex. « 2 à 4 phrases » pour LinkedIn). Si
//                       quelqu'un retire/altère la contrainte de canal dans le prompt,
//                       l'éval échoue → sanitize() et prompt sont couplés, aucun des deux
//                       ne dérive en silence.
//
// DÉTERMINISME / ZÉRO RÉSEAU
//   Tout vient des fixtures gelées : `rawClaude` n'est JAMAIS produit en live, on
//   n'appelle JAMAIS le SDK Claude. Mêmes entrées → mêmes assertions, à chaque run.
//
// N FIGÉ AU 1ER RUN : N = 3 idées-test PAR CANAL → 12 cas (linkedin/email/whatsapp/sms).
//
// RE-GELER LE PANIER (changement VOLONTAIRE du prompt few-shot ou du modèle Haiku↔Opus)
//   1. Re-capturer `rawClaude` hors-ligne contre le nouveau prompt/modèle ;
//   2. Recalculer `expectedSanitized = sanitize(rawClaude)` et le RE-VÉRIFIER à l'œil
//      (bon ton, longueur cible, zéro Tell) ;
//   3. Bumper PROMPT_VERSION (prompt.server.ts) et/ou SANITIZE_VERSION (copy.ts).
//   (Détails dans l'en-tête de voice-basket.ts.) Le panier EST la baseline : tant qu'on
//   ne l'a pas re-gelé, toute dérive de sanitize()/prompt fait échouer ces evals.

import { describe, expect, it } from "vitest";

import { sanitize } from "@/lib/copy";
import { buildPrompt } from "@/lib/prompt.server";
import { CANAUX, type Canal } from "@/lib/domain/enums";

import {
  CASES_PER_CANAL,
  VOICE_BASKET,
} from "../fixtures/claude-canned/voice-basket";
import { hasNoTells, withinCanalTarget } from "./criteria";

// ─── Sanité du panier : dimensionnement figé ────────────────────────────────
describe("eval Voix — panier figé (dimensionnement N par canal)", () => {
  it(`contient N = ${CASES_PER_CANAL} idées-test PAR CANAL (figé au 1er run)`, () => {
    expect(CASES_PER_CANAL).toBe(3);
    expect(VOICE_BASKET).toHaveLength(CASES_PER_CANAL * CANAUX.length); // 12

    for (const canal of CANAUX) {
      const cas = VOICE_BASKET.filter((c) => c.canal === canal);
      expect(cas).toHaveLength(CASES_PER_CANAL);
    }
  });

  it("a des id uniques et des champs gelés non vides", () => {
    const ids = new Set<string>();
    for (const c of VOICE_BASKET) {
      expect(c.id).toBeTruthy();
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      expect(c.idea.trim().length).toBeGreaterThan(0);
      expect(c.rawClaude.trim().length).toBeGreaterThan(0);
      expect(c.expectedSanitized.trim().length).toBeGreaterThan(0);
    }
  });

  it("chaque rawClaude porte de VRAIS Tells (sinon le couplage sanitize ne prouve rien)", () => {
    // Au moins un Tell (cadratin/cousin OU emoji OU invisible) dans la sortie brute.
    const tell =
      /[—–―]|[​‌‍﻿]|[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}]/u;
    for (const c of VOICE_BASKET) {
      expect(tell.test(c.rawClaude)).toBe(true);
    }
  });
});

// ─── (a) Golden / ton conservé ───────────────────────────────────────────────
describe("eval Voix — (a) golden / ton : sanitize(rawClaude) === expectedSanitized", () => {
  it.each(VOICE_BASKET.map((c) => [c.id, c] as const))(
    "%s — le ton « bon » (golden) est atteint",
    (_id, c) => {
      expect(sanitize(c.rawClaude)).toBe(c.expectedSanitized);
    },
  );
});

// ─── (b) Zéro Tell ───────────────────────────────────────────────────────────
describe("eval Voix — (b) zéro Tell : la sortie sanitizée est propre", () => {
  it.each(VOICE_BASKET.map((c) => [c.id, c] as const))(
    "%s — aucun cadratin/emoji/invisible résiduel",
    (_id, c) => {
      const out = sanitize(c.rawClaude);
      expect(hasNoTells(out)).toBe(true);
      // Et le golden lui-même est propre (cohérence du panier).
      expect(hasNoTells(c.expectedSanitized)).toBe(true);
    },
  );
});

// ─── (c) Longueur dans la cible canal ────────────────────────────────────────
describe("eval Voix — (c) longueur : la sortie tient dans la cible du canal (FR-9)", () => {
  it.each(VOICE_BASKET.map((c) => [c.id, c] as const))(
    "%s — withinCanalTarget(sanitize(rawClaude), canal)",
    (_id, c) => {
      const out = sanitize(c.rawClaude);
      expect(withinCanalTarget(out, c.canal)).toBe(true);
    },
  );
});

// ─── (d) Couplage sanitize() + prompt (canal-aware) ──────────────────────────
//
// La contrainte canal-aware attendue, par canal — une SOUS-CHAÎNE distinctive de
// CONTRAINTE_CANAL (src/lib/prompt.server.ts). Si quelqu'un retire/altère le régime
// de longueur d'un canal dans le prompt, l'assertion casse → couplage prouvé.
const CONTRAINTE_ATTENDUE: Record<Canal, RegExp> = {
  linkedin: /COURT \(2 à 4 phrases\)/,
  email: /STRUCTURÉ \(une ouverture, un corps en 1 à 2 courts paragraphes, une clôture\)/,
  whatsapp: /TRÈS COURT \(1 à 2 phrases\)/,
  sms: /TRÈS COURT \(1 à 2 phrases\)/,
  discord: /TRÈS COURT \(1 à 2 phrases\)/,
};

/** Extrait le texte du tour utilisateur (suffixe volatil) d'un BuiltPrompt. */
function userText(canal: Canal, idea: string): string {
  const { messages } = buildPrompt({ idea, canal, voiceExamples: [] });
  const content = messages[0].content;
  return typeof content === "string" ? content : JSON.stringify(content);
}

describe("eval Voix — (d) couplage prompt : la contrainte canal-aware est présente", () => {
  it.each(VOICE_BASKET.map((c) => [c.id, c] as const))(
    "%s — buildPrompt(...).messages[0] contient la cible de longueur du canal",
    (_id, c) => {
      const t = userText(c.canal, c.idea);
      expect(t).toMatch(CONTRAINTE_ATTENDUE[c.canal]);
      // L'idée brute (seed) voyage bien dans le tour utilisateur.
      expect(t).toContain(c.idea);
    },
  );

  it("voiceExamples: [] → ton NEUTRE dans le système, few-shot présent, pas de crash", () => {
    for (const canal of CANAUX) {
      const built = buildPrompt({ idea: "Une idée test.", canal, voiceExamples: [] });
      // Système (persona + few-shot) présent et non vide.
      expect(built.system.length).toBeGreaterThanOrEqual(2);
      const systemText = built.system.map((b) => b.text).join("\n");
      // Corpus vide → consigne de ton neutre explicite (FR-16), jamais d'échec.
      expect(systemText).toMatch(/neutre/i);
      // Un seul tour utilisateur, bien formé.
      expect(built.messages).toHaveLength(1);
      expect(built.messages[0].role).toBe("user");
    }
  });
});

// ─── Déterminisme : rejouer le panier donne le MÊME résultat ────────────────
describe("eval Voix — déterminisme (zéro réseau, mêmes entrées → même sortie)", () => {
  it("sanitize(rawClaude) est stable sur deux passages (idempotence comprise)", () => {
    for (const c of VOICE_BASKET) {
      const a = sanitize(c.rawClaude);
      const b = sanitize(c.rawClaude);
      expect(a).toBe(b);
      // Idempotence : re-sanitizer le golden ne change rien (pas de Tell réintroduit).
      expect(sanitize(a)).toBe(a);
    }
  });
});
