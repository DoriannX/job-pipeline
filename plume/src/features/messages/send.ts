"use server";

// Server action « Marquer Envoyé » (Epic 3, story 3.6).
//
// RÈGLE DURE : cette action n'importe NI le schéma Drizzle NI drizzle-orm. Tout accès aux
// données passe par la porte `forUser(userId)` de `@/lib/db` (barrière n°1) ; l'écriture
// ATOMIQUE (message figé + generation_events + maj contact) vit dans le repository, dans
// UNE transaction (AR-8, SM-1). `userId` est résolu via `auth()` DANS l'action.
//
// AUCUNE intégration d'envoi sortante (FR-21) : on n'envoie RIEN à un canal externe — on
// ENREGISTRE le Message dans la timeline et on instrumente le moat. Le texte est FIGÉ ici
// (= sortie sanitizée finale, l'éditée si retouchée à la main, AR-5).
//
// Le `GenerationEvent` (produit en mémoire au Composeur, story 3.3) est passé tel quel
// quand le texte a été généré ; `null` pour un texte tapé MAIN (pas de generation_events).

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { forUser } from "@/lib/db";
import type { Canal } from "@/lib/domain/enums";

import type { GenerationEvent } from "@/features/composer/generation";

/** Entrée plate de l'action (sérialisable, traversant la frontière client→serveur). */
export type MarkSentInput = {
  contactId: string;
  /** Texte FIGÉ courant du champ (sortie finale, éditée comprise). */
  texte: string;
  /** Canal retenu dans le Composeur. */
  canal: Canal;
  /** `GenerationEvent` du dernier flux si généré, sinon `null` (tapé main). */
  event: GenerationEvent | null;
};

/** Résultat de l'action (ton DOUX en cas d'échec ; le champ est préservé côté client). */
export type MarkSentResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

/**
 * Marque un texte composé comme Message ENVOYÉ.
 *
 * Pipeline : auth() → garde douce (texte/contact présents) → `forUser(userId).messages
 * .markSent(...)` (écriture atomique scopée) → revalide la fiche Contact + `/reseau`
 * (la timeline et la froideur se rafraîchissent). En cas d'échec, on renvoie un message
 * doux (le client préserve le champ) — jamais de 500 brut.
 */
export async function markSentAction(
  input: MarkSentInput,
): Promise<MarkSentResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, error: "Session requise." };
  }

  const texte = input.texte?.trim() ?? "";
  if (!input.contactId || texte.length === 0) {
    // Rien à enregistrer : ton neutre, le champ reste éditable côté client.
    return { ok: false, error: "Écris un message avant de le marquer envoyé." };
  }

  try {
    const db = await forUser(userId);
    // On passe la projection PLATE du GenerationEvent au repository (qui n'expose pas
    // le type feature). `null` (tapé main) ⇒ aucun generation_events, genere_par_ia=false.
    const generation = input.event
      ? {
          generated: input.event.generatedText,
          rawIntent: input.event.rawIntent,
          promptVersion: input.event.promptVersion,
          modelId: input.event.modelId,
          voiceExamplesRef: input.event.voiceExamplesRef,
          sanitizeVersion: input.event.sanitizeVersion,
          tokens: {
            input: input.event.tokens.input,
            output: input.event.tokens.output,
          },
        }
      : null;

    const message = await db.messages.markSent({
      contactId: input.contactId,
      canal: input.canal,
      texte,
      generation,
    });

    // La fiche Contact (timeline + froideur) et la galerie Réseau (froideur) changent.
    revalidatePath(`/reseau/${input.contactId}`);
    revalidatePath("/reseau");

    return { ok: true, messageId: message.id };
  } catch {
    // Échec doux : message lisible, champ préservé côté client (aucune saisie perdue).
    return {
      ok: false,
      error: "L'enregistrement a échoué. Réessaie dans un instant.",
    };
  }
}

/** Entrée de « Enregistrer le brouillon » — texte tapé MAIN gardé en brouillon (story 7-2). */
export type MarkDraftInput = {
  contactId: string;
  /** Texte courant du champ. */
  texte: string;
  /** Canal retenu dans le composeur. */
  canal: Canal;
};

export type MarkDraftResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

/**
 * Enregistre le texte du composeur MANUEL comme Message BROUILLON (jamais envoyé,
 * `genere_par_ia=false`). Pendant manuel de `markSentAction` : le brouillon vit dans la
 * timeline « Votre histoire », reste ÉDITABLE (Modifier, story 7-2) et promouvable « envoyé »
 * via la pastille de statut. Échec doux (le champ est préservé côté client).
 */
export async function markDraftAction(
  input: MarkDraftInput,
): Promise<MarkDraftResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, error: "Session requise." };
  }

  const texte = input.texte?.trim() ?? "";
  if (!input.contactId || texte.length === 0) {
    return { ok: false, error: "Écris un message avant de l'enregistrer." };
  }

  try {
    const db = await forUser(userId);
    const message = await db.messages.createDraft({
      contactId: input.contactId,
      canal: input.canal,
      texte,
      genereParIa: false,
    });
    // La timeline de la fiche change (nouveau brouillon).
    revalidatePath(`/reseau/${input.contactId}`);
    return { ok: true, messageId: message.id };
  } catch {
    return {
      ok: false,
      error: "L'enregistrement a échoué. Réessaie dans un instant.",
    };
  }
}
