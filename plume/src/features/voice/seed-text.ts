// Préparation PURE d'un seed de voix à l'import (story 3.5, AR-3).
//
// POINT D'IMPORT du seed : c'est ici qu'on applique `sanitize()` — le POINT UNIQUE de
// nettoyage des « Tells » d'IA (FR-11, AR-3). Un seed est du texte « voix » : il passe
// par le MÊME nettoyage déterministe que la génération, jamais par un replace ad-hoc.
//
// Extrait en fonction PURE (zéro `auth`, zéro I/O) pour être testable directement : la
// server action `addVoiceSeedAction` se contente de l'appeler puis de persister via la
// porte. `sanitize` (@/lib/copy) est déterministe/idempotent ; importer ce module ici
// (zone features) reste conforme aux barrières (ce n'est PAS un module `*.server`).

import { sanitize } from "@/lib/copy";

/** Résultat de la préparation d'un seed : prêt à persister, ou rejeté (vide). */
export type PrepareSeedResult =
  | { ok: true; texte: string }
  | { ok: false; reason: "empty" };

/**
 * Nettoie le texte d'un seed via `sanitize()` (point unique, AR-3) et rejette s'il est
 * VIDE après nettoyage (un collage de seuls espaces/emojis/invisibles ne fait pas voix).
 *
 * @param raw texte brut collé par l'utilisateur.
 * @returns `{ ok: true, texte }` (sanitizé) ou `{ ok: false, reason: "empty" }`.
 */
export function prepareSeedText(raw: string): PrepareSeedResult {
  const texte = sanitize(raw);
  if (texte.length === 0) {
    return { ok: false, reason: "empty" };
  }
  return { ok: true, texte };
}
