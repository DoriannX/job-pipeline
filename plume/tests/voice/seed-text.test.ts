// Import SANITIZÉ d'un seed de voix (story 3.5, AR-3).
// `prepareSeedText` est le POINT D'IMPORT : il applique `sanitize()` (point unique de
// nettoyage des Tells d'IA) et rejette un seed vide après nettoyage. C'est la fonction
// PURE qu'utilise `addVoiceSeedAction` (extraite pour être testable directement).

import { describe, expect, it } from "vitest";

import { sanitize } from "@/lib/copy";
import { prepareSeedText } from "@/features/voice/seed-text";

describe("prepareSeedText — sanitize à l'import (AR-3)", () => {
  it("nettoie les Tells d'IA : cadratins, espaces exotiques, invisibles, emojis", () => {
    const raw = "Salut— ça​ va ? 🙂";
    const out = prepareSeedText(raw);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    // Le texte stocké est EXACTEMENT la sortie de `sanitize` (point unique).
    expect(out.texte).toBe(sanitize(raw));
    // Plus aucun cadratin ni emoji ne subsiste.
    expect(out.texte).not.toMatch(/[—–―]/);
    expect(out.texte).not.toMatch(/🙂/u);
    expect(out.texte).not.toMatch(/[​﻿]/);
  });

  it("préserve la structure des paragraphes (la voix garde son rythme)", () => {
    const raw = "Bonjour,\n\nUn point.\n\nUn autre.";
    const out = prepareSeedText(raw);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.texte).toBe("Bonjour,\n\nUn point.\n\nUn autre.");
  });

  it("rejette un seed VIDE après nettoyage (que des espaces)", () => {
    expect(prepareSeedText("   \n\t  ")).toEqual({ ok: false, reason: "empty" });
  });

  it("rejette un seed qui n'est QUE des invisibles/emojis (vide après sanitize)", () => {
    const raw = "​​🙂🎉﻿";
    expect(prepareSeedText(raw)).toEqual({ ok: false, reason: "empty" });
  });

  it("est idempotent (re-préparer un seed déjà préparé = no-op)", () => {
    const raw = "Texte—avec un cadratin.";
    const once = prepareSeedText(raw);
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    const twice = prepareSeedText(once.texte);
    expect(twice).toEqual(once);
  });
});
