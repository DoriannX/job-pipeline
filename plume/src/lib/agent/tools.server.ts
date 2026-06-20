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

import {
  actionLogRepository,
  forUser,
  type ContactsRepository,
  type MessagesRepository,
  type BulkCreateItem,
  type JournalSink,
} from "@/lib/db";
import { CANAUX, type Canal } from "@/lib/domain/enums";
import type { Tone } from "@/features/composer/generation";
import { composeInVoice } from "@/lib/composer/pipeline.server";

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
  journal?: JournalSink,
): Promise<SeedContactsResult> {
  const requested = input.count;
  const n = Math.min(Math.max(0, Math.floor(requested)), MAX_SEED);
  const ids = new Set<string>();
  for (let i = 0; i < n; i++) {
    const { email, ...rest } = generate(i);
    // `journal` (inc.4) : chaque création est journalisée atomiquement sous le `turnId` du run
    // (toute mutation du copilote au journal — même un seed, qui devient ainsi rewindable).
    const row = await contacts.create(
      {
        ...rest,
        handles: { email },
        source: "seed",
      },
      journal,
    );
    ids.add(row.id);
  }
  return { created: ids.size, requested, capped: requested > MAX_SEED };
}

// ===========================================================================
// Phase 2 inc.3 — WRITE-TOOLS sur VRAIE donnée (advisor → doer). L'agent CRÉE de la
// vraie donnée et RÉDIGE dans la voix, mais n'ENVOIE JAMAIS (aucun auto-send au MVP).
// Provenance VRAIE donnée : `source ∈ {"manuel","rapide"}`, JAMAIS `"seed"` (réciproque
// exacte de `seedContacts`). Tout réversible (soft-delete), aucun accès drizzle sous un
// tool : on orchestre les repositories via la porte scopée.
// ===========================================================================

// ---------------------------------------------------------------------------
// createContact (CAP-1) — ajoute UN vrai contact dicté en langage naturel.
// ---------------------------------------------------------------------------

/** Projection d'un contact créé, renvoyée à l'agent (borne les tokens). */
export type CreateContactResult = {
  id: string;
  nom: string;
  entreprise: string | null;
};

/** Données d'un contact à créer (sans `source`/scope : posés par la couche tool). */
export type CreateContactInput = {
  nom: string;
  entreprise?: string | null;
  email?: string | null;
  canalPrefere?: Canal | null;
};

/**
 * LOGIQUE PURE de `createContact`, testable hors serveur : reçoit un repository DÉJÀ
 * scopé au tenant. Délègue au VRAI `contactsRepository.create` (jamais d'insert direct —
 * Archi #1), en taguant `source="manuel"` (VRAIE donnée, JAMAIS `"seed"`). La dédup par
 * `dedupKey` du repository fait fusionner une collision au lieu de doubler ; le contact
 * reste réversible par le soft-delete existant.
 */
export async function createContact(
  contacts: Pick<ContactsRepository, "create">,
  input: CreateContactInput,
  journal?: JournalSink,
): Promise<CreateContactResult> {
  const row = await contacts.create(
    {
      nom: input.nom,
      entreprise: input.entreprise ?? null,
      canalPrefere: input.canalPrefere ?? null,
      handles: input.email ? { email: input.email } : null,
      // PROVENANCE VRAIE DONNÉE — saisie unitaire dictée = "manuel" (parité story 2.1).
      // JAMAIS "seed" : la vraie donnée reste trivialement distinguable du test.
      source: "manuel",
    },
    // `journal` (inc.4) : la création (ou fusion/réactivation par dédup) est journalisée
    // atomiquement sous le `turnId` du run → rewindable.
    journal,
  );
  return { id: row.id, nom: row.nom, entreprise: row.entreprise ?? null };
}

// ---------------------------------------------------------------------------
// importContacts (CAP-3) — crée N vrais contacts en bloc depuis un vrac STRUCTURÉ par
// l'agent. Le tool ne parse PAS de texte libre : il reçoit des contacts déjà structurés.
// ---------------------------------------------------------------------------

/**
 * Plafond serveur d'un import vrac EN UN APPEL (SÉCU #6, PARITÉ `seedContacts` MAX_SEED).
 * Un lot plus grand est CLAMPÉ à cette valeur, jamais honoré tel quel.
 */
export const MAX_IMPORT = MAX_SEED;

/** Résultat de `importContacts` renvoyé à l'agent (pour qu'il verbalise l'action). */
export type ImportContactsResult = {
  /** Contacts réellement créés (ou réactivés) via `bulkCreate`. */
  created: number;
  /** Contacts fusionnés (déjà présents / doublons intra-lot) — ton neutre. */
  merged: number;
  /** Nombre d'entrées demandées (avant clamp). */
  requested: number;
  /** `true` quand `requested > MAX_IMPORT` : l'excédent a été ignoré. */
  capped: boolean;
};

/**
 * LOGIQUE PURE de `importContacts`, testable hors serveur : reçoit un repository DÉJÀ
 * scopé au tenant. CLAMPE le lot à `MAX_IMPORT` (SÉCU #6), puis délègue au VRAI
 * `contactsRepository.bulkCreate` (dédup intra-lot + réactivation des archivés, provenance
 * `source="rapide"` ≠ `"seed"`). Réversible par soft-delete ; aucun insert direct.
 */
export async function importContacts(
  contacts: Pick<ContactsRepository, "bulkCreate">,
  input: { contacts: BulkCreateItem[] },
  journal?: JournalSink,
): Promise<ImportContactsResult> {
  const requested = input.contacts.length;
  // CLAMP serveur (« clampé, pas honoré ») : l'excédent au-delà du plafond est ignoré.
  const items = input.contacts.slice(0, MAX_IMPORT);
  // `journal` (inc.4) : le lot entier est journalisé DANS UNE transaction (une entrée par
  // contact créé/réactivé), sous le `turnId` du run → tout le lot rewindable d'un geste.
  const { created, merged } = await contacts.bulkCreate(items, journal);
  return { created, merged, requested, capped: requested > MAX_IMPORT };
}

// ---------------------------------------------------------------------------
// composeMessage (CAP-2) — RÉDIGE un brouillon dans la voix, n'ENVOIE JAMAIS.
// Réutilise le pipeline Composeur partagé (`composeInVoice`) + persiste un BROUILLON.
// ---------------------------------------------------------------------------

/** Canal par défaut quand ni l'argument ni la préférence du contact ne le fixent. */
const DEFAULT_CANAL: Canal = "linkedin";

/** Résultat de `composeMessage` : le brouillon persisté (jamais envoyé). */
export type ComposeMessageResult = {
  messageId: string;
  contactId: string;
  canal: Canal;
  /** TOUJOURS `"brouillon"` — l'agent ne franchit jamais `"envoye"`. */
  statut: "brouillon";
  /** Texte SANITIZÉ du brouillon (sortie du moat voix). */
  text: string;
};

/** Arguments validés de `composeMessage` (frontière zod du tool). */
export type ComposeMessageInput = {
  contactId: string;
  canal?: Canal;
  tone?: Tone;
  idea?: string;
};

/** Dépendances injectées de `composeMessage` (repos scopés + pipeline voix). */
export type ComposeMessageDeps = {
  contacts: Pick<ContactsRepository, "get">;
  messages: Pick<MessagesRepository, "createDraft">;
  /**
   * Pipeline voix injecté (prod = `composeInVoice` lié au tenant ; test = stub). Renvoie
   * au moins `event.generatedText` (sortie SANITIZÉE) — c'est ce que le brouillon persiste.
   */
  compose: (params: {
    idea: string;
    canal: Canal;
    tone: Tone;
    contact: { nom?: string | null };
  }) => Promise<{ event: { generatedText: string } }>;
  /** `journal` (inc.4) : journalise le brouillon atomiquement sous le `turnId` du run. */
  journal?: JournalSink;
};

/**
 * LOGIQUE de `composeMessage`, testable par injection (repos scopés + pipeline voix). Elle :
 *   1. résout le contact (scopé) — un id inconnu/hors tenant NE lance AUCUNE génération
 *      (borne anti-coût : un argument aberrant ne déclenche pas le pipeline) ;
 *   2. choisit le canal : argument validé > préférence du contact > défaut projet ;
 *   3. RÉUTILISE le pipeline Composeur (corpus voix + génération + `sanitize()` déterministe) ;
 *   4. persiste un BROUILLON lié au contact (`statut="brouillon"`, `genereParIa=true`) —
 *      JAMAIS d'envoi, JAMAIS `"envoye"`, aucun appel de sortie externe.
 */
export async function composeMessage(
  deps: ComposeMessageDeps,
  input: ComposeMessageInput,
): Promise<ComposeMessageResult> {
  const contact = await deps.contacts.get(input.contactId);
  if (!contact) {
    // Contact inconnu/hors tenant : on refuse AVANT toute génération (anti-coût + sécu).
    throw new Error("Contact introuvable pour ce tenant.");
  }

  const canal: Canal = input.canal ?? contact.canalPrefere ?? DEFAULT_CANAL;
  const tone: Tone = input.tone ?? "rapide";

  const { event } = await deps.compose({
    idea: input.idea ?? "",
    canal,
    tone,
    contact: { nom: contact.nom },
  });

  const message = await deps.messages.createDraft(
    {
      contactId: input.contactId,
      canal,
      texte: event.generatedText,
    },
    deps.journal,
  );

  return {
    messageId: message.id,
    contactId: input.contactId,
    canal,
    statut: "brouillon",
    text: event.generatedText,
  };
}

/**
 * CAP-2 (sync générique, branchée en UN SEUL point) — frontière R/W exprimée comme
 * DONNÉE : l'ensemble des tools qui ÉCRIVENT. Le wrapper serveur (`run.server.ts`)
 * s'en sert pour décider, EN FIN DE RUN, si une mutation a eu lieu et donc s'il faut
 * signaler au client de se resynchroniser (`router.refresh()`).
 *
 * GÉNÉRIQUE par construction : ajouter un futur write-tool (`createContact`,
 * `composeMessage`, import…) à cet ensemble — une seule ligne — suffit à lui faire
 * hériter de la sync, sans aucun autre câblage côté serveur NI côté client. La sync
 * ne connaît pas la FORME des mutations (ça ferait fuiter du métier côté front) :
 * juste le FAIT qu'une écriture a eu lieu.
 */
// CAP-4 (inc.3) — HÉRITAGE de la sync, SANS nouveau code : les trois write-tools réels
// rejoignent ce registre. Le pont d'invalidation d'inc.2 (un seul `router.refresh()` en
// fin de stream si `didWrite`) les couvre automatiquement. C'est le SEUL changement lié à
// la sync — la promesse « un futur write-tool hérite de la sync sans câblage » se réalise.
export const WRITE_TOOL_NAMES: ReadonlySet<string> = new Set([
  "seedContacts",
  "createContact",
  "composeMessage",
  "importContacts",
]);

/**
 * Construit le catalogue de tools pour UN tenant donné. `userId` ET `turnId` sont clos par la
 * closure (jamais des arguments que l'agent contrôle — SÉCU #3, Constraint SPEC inc.4). `turnId`
 * est généré côté serveur dans `runAgentChat` (un par run) : l'agent ne le reçoit ni ne le
 * contrôle, il ne peut donc ni réécrire ni cibler le journal.
 *
 * Chaque `execute` ouvre la porte scopée et délègue à la logique pure. Les WRITE-tools reçoivent
 * une SINK de journalisation `makeJournal(toolName)` : la mutation et son entrée `action_log`
 * s'écrivent ATOMIQUEMENT dans la MÊME transaction (le repository invoque la sink avec son handle
 * `tx`), sous ce `turnId`. La sink est le SEUL endroit qui connaît `turnId`+`toolName` ; le
 * repository, lui, ignore tout du journal (couplage évité — voir `journal.ts`).
 */
export function buildTools(userId: string, turnId: string): ToolSet {
  // Fabrique une sink liée au `turnId` du run et au `toolName` courant. Le repository l'appelle
  // DANS sa transaction (handle `tx`), de sorte que `actionLogRepository(tx).record(...)` écrit
  // l'entrée atomiquement avec la mutation — jamais un log async ratable (parité `markSent`).
  const makeJournal =
    (toolName: string): JournalSink =>
    async (tx, record) => {
      await actionLogRepository(tx).record({
        turnId,
        toolName,
        entityType: record.entityType,
        entityId: record.entityId,
        op: record.op,
        prevState: record.prevState,
      });
    };

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
          return await seedContacts(
            gate.contacts,
            { count },
            undefined,
            makeJournal("seedContacts"),
          );
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

    // --- createContact (CAP-1) : ajoute UN vrai contact (source "manuel", jamais seed). ---
    createContact: tool({
      description:
        "Ajoute UN VRAI contact au réseau de l'utilisateur (ex. « ajoute Sophie Martin, " +
        "CTO chez Acme »). Crée de la vraie donnée (jamais un contact de test). " +
        "Dédupliqué automatiquement : un contact déjà présent fusionne au lieu de doubler. " +
        "N'invente JAMAIS de contact — n'enregistre que ce que l'utilisateur a dicté.",
      inputSchema: z.object({
        nom: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .describe("Nom complet du contact (requis)."),
        entreprise: z
          .string()
          .trim()
          .max(200)
          .optional()
          .describe("Entreprise du contact (optionnel)."),
        email: z
          .string()
          .trim()
          .email()
          .max(320)
          .optional()
          .describe("E-mail du contact (optionnel)."),
        canalPrefere: z
          .enum(CANAUX)
          .optional()
          .describe("Canal de contact préféré (optionnel)."),
      }),
      execute: async (args) => {
        try {
          const gate = await forUser(userId);
          return await createContact(
            gate.contacts,
            args,
            makeJournal("createContact"),
          );
        } catch (err) {
          console.error("[agent] createContact a échoué :", err);
          return {
            error: "Création du contact momentanément indisponible. Réessaie plus tard.",
          };
        }
      },
    }),

    // --- importContacts (CAP-3) : crée N vrais contacts en bloc (vrac structuré par l'agent). ---
    importContacts: tool({
      description:
        "Importe PLUSIEURS vrais contacts en bloc, à partir d'une liste que TU structures " +
        "depuis le texte de l'utilisateur (parse toi-même le vrac en {nom, entreprise?, " +
        "email?}). Crée de la vraie donnée, dédupliquée (intra-lot ET vs existant). " +
        `Plafonné à ${MAX_IMPORT} contacts par appel : au-delà, l'excédent est ignoré ` +
        "(`capped` vaut alors vrai — annonce-le). N'invente AUCUN contact.",
      inputSchema: z.object({
        contacts: z
          .array(
            z.object({
              nom: z.string().trim().min(1).max(200),
              entreprise: z.string().trim().max(200).optional(),
              email: z.string().trim().email().max(320).optional(),
            }),
          )
          .min(1)
          // Borne DURE à la frontière (anti-DoS) ; la logique pure CLAMPE ensuite à
          // MAX_IMPORT (« clampé, pas honoré ») — même patron à deux bornes que seedContacts.
          .max(500)
          .describe(
            `Contacts structurés à créer (plafonné à ${MAX_IMPORT} côté serveur).`,
          ),
      }),
      execute: async (args) => {
        try {
          const gate = await forUser(userId);
          return await importContacts(
            gate.contacts,
            { contacts: args.contacts },
            makeJournal("importContacts"),
          );
        } catch (err) {
          console.error("[agent] importContacts a échoué :", err);
          return {
            error: "Import des contacts momentanément indisponible. Réessaie plus tard.",
          };
        }
      },
    }),

    // --- composeMessage (CAP-2) : RÉDIGE un brouillon dans la voix, n'ENVOIE JAMAIS. ---
    composeMessage: tool({
      description:
        "Rédige un BROUILLON de message d'outreach pour un contact, DANS LA VOIX de " +
        "l'utilisateur (réutilise le Composeur : few-shot de voix + nettoyage anti-IA, " +
        "longueur adaptée au canal). Le brouillon est PERSISTÉ, lié au contact, prêt à " +
        "copier — mais JAMAIS envoyé : c'est l'utilisateur qui envoie depuis l'app. " +
        "Donne `contactId` ; `canal`/`tone` optionnels (canal déduit de la préférence du " +
        "contact si absent), `idea` = contexte/consigne optionnel pour le message.",
      inputSchema: z.object({
        contactId: z
          .string()
          .trim()
          .min(1)
          .max(64)
          .describe("Id du contact destinataire (obtenu via queryContacts)."),
        canal: z
          .enum(CANAUX)
          .optional()
          .describe("Canal du message (défaut : préférence du contact)."),
        tone: z
          .enum(["rapide", "soigne"])
          .optional()
          .describe("Registre de rédaction (défaut : rapide)."),
        idea: z
          .string()
          .trim()
          .max(2000)
          .optional()
          .describe("Contexte/consigne pour le message (optionnel)."),
      }),
      execute: async (args) => {
        try {
          const gate = await forUser(userId);
          return await composeMessage(
            {
              contacts: gate.contacts,
              messages: gate.messages,
              // Pipeline voix PARTAGÉ avec /api/composer — `gate` clos par closure.
              compose: (p) =>
                composeInVoice({
                  gate,
                  idea: p.idea,
                  canal: p.canal,
                  tone: p.tone,
                  contact: p.contact,
                }),
              journal: makeJournal("composeMessage"),
            },
            args,
          );
        } catch (err) {
          console.error("[agent] composeMessage a échoué :", err);
          return {
            error: "Rédaction du brouillon momentanément indisponible. Réessaie plus tard.",
          };
        }
      },
    }),
  };
}
