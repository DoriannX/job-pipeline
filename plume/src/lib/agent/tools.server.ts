import "server-only";

// CATALOGUE des tools du copilote.
//   - Phase 1 : `queryContacts` (read-only).
//   - Phase 2 inc.1 : `seedContacts` (premier WRITE-tool — frontière R/W ouverte).
// Règle d'archi (brainstorm Archi #1 + Capacité #1) : un tool n'implémente AUCUNE
// logique BDD — il orchestre les repositories existants via la porte scopée.
//
// SÉCU #3 (scope tenant imposé sous la couche tool) : `userId` est CLOS par la
// closure de `buildTools`, injecté depuis la session next-auth par l'appelant.
// L'agent ne reçoit JAMAIS `userId` en argument → une injection ne peut pas
// élargir le périmètre.
//
// FRONTIÈRE R/W (SÉCU #2) : les écritures de l'agent ne vont QUE vers l'intérieur
// (repositories Plume). Aucun write externe (auth, OAuth, web). Toute écriture est
// réversible par construction (soft-delete `archivedAt`) et taguée (`source="seed"`)
// pour ne JAMAIS être confondue avec une vraie donnée.

import { tool, type ToolSet } from "ai";
import { z } from "zod";

import { forUser, type ContactsRepository } from "@/lib/db";
import { CANAUX, type Canal } from "@/lib/domain/enums";

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

// ---------------------------------------------------------------------------
// seedContacts (Phase 2 inc.1) — premier write-tool : peuple le réseau de FAUX
// contacts de test, tagués `source="seed"`, scopés au tenant, réversibles.
// ---------------------------------------------------------------------------

/**
 * Plafond serveur du nombre de contacts seedés EN UN APPEL (SÉCU #6, parité avec
 * les bornes de payload Phase 1). Un `count` supérieur est CLAMPÉ à cette valeur,
 * jamais honoré tel quel — l'agent ni le client ne peuvent amplifier le coût.
 */
export const MAX_SEED = 25;

/** Résultat de `seedContacts` renvoyé à l'agent (pour qu'il verbalise l'action). */
export type SeedContactsResult = {
  /** Nombre de contacts de test DISTINCTS réellement présents après l'appel. */
  created: number;
  /** Nombre demandé (avant clamp) — pour que l'agent annonce une éventuelle borne. */
  requested: number;
  /** `true` quand `requested > MAX_SEED` : la demande a été plafonnée. */
  capped: boolean;
};

/** Données d'UN faux contact (sans `source`/scope : posés par la couche tool). */
type FakeContact = {
  nom: string;
  entreprise: string;
  canalPrefere: Canal;
  /** E-mail UNIQUE → clé de dédup unique → un seed ne fusionne jamais avec un autre. */
  email: string;
};

// Pools de fabrication de faux contacts plausibles.
const FAKE_FIRST = ["Camille","Léa","Hugo","Noé","Inès","Jules","Maya","Théo","Lola","Sacha"]; // prettier-ignore
const FAKE_LAST = ["Martin","Bernard","Dubois","Moreau","Laurent","Garnier","Faure","Rousseau","Blanc","Henry"]; // prettier-ignore
const FAKE_COMPANY = ["Acme","Globex","Initech","Umbrella","Hooli","Soylent","Vehement","Massive","Stark","Wayne"]; // prettier-ignore

const pick = <T,>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]!;

/**
 * Générateur ALÉATOIRE par défaut (« crée N contacts au hasard » — Success signal).
 * Chaque contact reçoit un e-mail à jeton aléatoire : sa clé de dédup est donc
 * UNIQUE, si bien que deux seeds ne fusionnent jamais — ni dans un même appel, ni
 * d'un appel à l'autre. `created` reflète alors fidèlement le nombre réellement créé
 * (un seed répété ajoute bien N nouveaux contacts, il n'en « recrée » pas 0 en
 * silence). Le domaine `@plume-seed.test` rend la provenance test évidente, en plus
 * du tag `source="seed"`. (Injectable → un générateur déterministe sert aux tests.)
 */
function defaultFakeContact(): FakeContact {
  const token = Math.random().toString(36).slice(2, 10);
  return {
    nom: `${pick(FAKE_FIRST)} ${pick(FAKE_LAST)}`,
    entreprise: pick(FAKE_COMPANY),
    canalPrefere: pick(CANAUX),
    email: `${token}@plume-seed.test`,
  };
}

/**
 * LOGIQUE PURE de `seedContacts`, testable hors serveur : reçoit un repository DÉJÀ
 * scopé au tenant. Boucle sur le VRAI `contactsRepository.create` (jamais d'insert
 * direct — Archi #1), en taguant chaque ligne `source="seed"`. Le `count` est CLAMPÉ
 * à `MAX_SEED` (SÉCU #6), indépendamment de la valeur fournie. `create` étant
 * idempotent (dédup), on compte les ids DISTINCTS réellement obtenus.
 */
export async function seedContacts(
  contacts: Pick<ContactsRepository, "create">,
  input: { count: number },
  generate: (index: number) => FakeContact = defaultFakeContact,
): Promise<SeedContactsResult> {
  const requested = input.count;
  const n = Math.min(Math.max(0, Math.floor(requested)), MAX_SEED);
  const ids = new Set<string>();
  for (let i = 0; i < n; i++) {
    const { email, ...rest } = generate(i);
    const row = await contacts.create({
      ...rest,
      handles: { email },
      source: "seed",
    });
    ids.add(row.id);
  }
  return { created: ids.size, requested, capped: requested > MAX_SEED };
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

    seedContacts: tool({
      description:
        "Crée des contacts de TEST fabriqués pour peupler le réseau (ex. « crée 10 " +
        "contacts au hasard »). Ces contacts sont tagués comme données de test, " +
        "scopés à l'utilisateur courant, distinguables des vrais contacts et " +
        `réversibles (archivables en bloc). \`count\` est plafonné à ${MAX_SEED} côté ` +
        "serveur : si la demande dépasse, elle est ramenée à ce maximum (`capped` " +
        "vaut alors vrai — annonce-le). N'utilise JAMAIS ce tool pour de vrais contacts.",
      // Deux bornes DISTINCTES, à dessein : le `.max(10_000)` zod rejette une valeur
      // ABSURDE à la frontière (anti-DoS), tandis qu'une valeur grande mais plausible
      // (≤ 10 000) est CLAMPÉE à MAX_SEED par la logique pure — « clampé, pas honoré »
      // (spec). On ne met PAS `.max(MAX_SEED)` ici : ça rejetterait `count:1000` au lieu
      // de le ramener à MAX_SEED comme la spec l'exige.
      inputSchema: z.object({
        count: z
          .number()
          .int()
          .min(1)
          .max(10_000)
          .describe(
            `Nombre de contacts de test à créer (plafonné à ${MAX_SEED} côté serveur).`,
          ),
      }),
      execute: async ({ count }) => {
        // Même posture que `queryContacts` : la porte/DB peut échouer EN PLEIN tour
        // d'agent — on absorbe et on renvoie un résultat structuré que le modèle sait
        // verbaliser, plutôt que de tuer le flux.
        try {
          const gate = await forUser(userId);
          return await seedContacts(gate.contacts, { count });
        } catch (err) {
          console.error("[agent] seedContacts a échoué :", err);
          return {
            created: 0,
            requested: count,
            capped: false,
            error: "Création de contacts de test momentanément indisponible.",
          };
        }
      },
    }),
  };
}
