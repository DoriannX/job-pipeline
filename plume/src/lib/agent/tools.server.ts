import "server-only";

// CATALOGUE des tools du copilote (Phase 1 : un seul, read-only).
// Règle d'archi (brainstorm Archi #1 + Capacité #1) : un tool n'implémente AUCUNE
// logique BDD — il orchestre les repositories existants via la porte scopée.
//
// SÉCU #3 (scope tenant imposé sous la couche tool) : `userId` est CLOS par la
// closure de `buildTools`, injecté depuis la session next-auth par l'appelant.
// L'agent ne reçoit JAMAIS `userId` en argument → une injection ne peut pas
// élargir le périmètre.

import { tool, type ToolSet } from "ai";
import { z } from "zod";

import { forUser, type ContactsRepository } from "@/lib/db";

/** Projection LÉGÈRE d'un contact renvoyée à l'agent (borne les tokens). */
export type ContactSummary = {
  id: string;
  nom: string;
  entreprise: string | null;
  canalPrefere: string | null;
};

/** Résultat de `queryContacts` : compte total + échantillon borné. */
export type QueryContactsResult = {
  count: number;
  contacts: ContactSummary[];
  /** `true` quand `count > MAX_RESULTS` : `contacts` ne contient qu'un échantillon. */
  truncated: boolean;
};

/** Nombre max de contacts détaillés renvoyés (le `count` reste exact). */
const MAX_RESULTS = 50;

/**
 * LOGIQUE PURE de `queryContacts`, testable hors serveur : reçoit un repository
 * DÉJÀ scopé au tenant (la porte garantit l'isolement). Liste, filtre optionnel
 * par texte (nom ou entreprise, insensible à la casse), projette, borne.
 */
export async function queryContacts(
  contacts: Pick<ContactsRepository, "list">,
  input: { search?: string },
): Promise<QueryContactsResult> {
  const all = await contacts.list();
  const needle = input.search?.trim().toLowerCase();
  const filtered = needle
    ? all.filter((c) => {
        const haystack = `${c.nom} ${c.entreprise ?? ""}`.toLowerCase();
        return haystack.includes(needle);
      })
    : all;
  return {
    count: filtered.length,
    truncated: filtered.length > MAX_RESULTS,
    contacts: filtered.slice(0, MAX_RESULTS).map((c) => ({
      id: c.id,
      nom: c.nom,
      entreprise: c.entreprise ?? null,
      canalPrefere: c.canalPrefere ?? null,
    })),
  };
}

/**
 * Construit le catalogue de tools pour UN tenant donné. `userId` est clos par la
 * closure (jamais un argument que l'agent contrôle — SÉCU #3). Chaque `execute`
 * ouvre la porte scopée et délègue à la logique pure.
 */
export function buildTools(userId: string): ToolSet {
  return {
    queryContacts: tool({
      description:
        "Liste les contacts du réseau de l'utilisateur courant. Filtre optionnel " +
        "`search` (texte libre) sur le nom ou l'entreprise. Utilise-le pour " +
        "compter, retrouver ou résumer des contacts. `count` est le total exact ; " +
        "si `truncated` est vrai, `contacts` n'est qu'un échantillon (max " +
        `${MAX_RESULTS}) — annonce-le à l'utilisateur plutôt que d'énumérer comme si c'était tout.`,
      inputSchema: z.object({
        search: z
          .string()
          .max(200)
          .optional()
          .describe("Filtre texte sur le nom ou l'entreprise (optionnel)."),
      }),
      execute: async ({ search }) => {
        // La porte/DB peut échouer (indispo) EN PLEIN tour d'agent : on absorbe et
        // on renvoie un résultat structuré que le modèle sait verbaliser, plutôt que
        // de tuer le flux (même posture que le composer qui dégrade en corpus vide).
        try {
          const gate = await forUser(userId);
          return await queryContacts(gate.contacts, { search });
        } catch (err) {
          console.error("[agent] queryContacts a échoué :", err);
          return {
            count: 0,
            truncated: false,
            contacts: [],
            error: "Contacts momentanément indisponibles. Réessaie plus tard.",
          };
        }
      },
    }),
  };
}
