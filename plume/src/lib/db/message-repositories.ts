// Repository des MESSAGES (Epic 3, story 3.6) — ZONE AUTORISÉE (src/lib/db/**).
// C'est ICI, et seulement ici, qu'on touche au schéma Drizzle pour `messages` et
// `generation_events` ; les features n'importent JAMAIS le schéma (barrière n°1 / AR-2,
// AR-13). Le repository reçoit un `ScopedDb` INJECTÉ : pur, testable (db en mémoire).
//
// CŒUR DU MOAT (SM-1, AR-8) : `markSent` est l'ÉCRITURE ATOMIQUE de l'envoi. Dans UNE
// transaction scopée, elle :
//   (a) insère le Message FIGÉ (statut 'envoye', `envoye_at` posé) ;
//   (b) SI une génération a eu lieu, insère le `generation_events` (generated, sent,
//       edit_distance, tokens, versions…) — la qualité du moat ET le coût, gardés
//       transactionnellement (impossible à rétro-calculer, archi l.84) ;
//   (c) met à jour `contacts.dernier_contact_at` → la froideur (Epic 2) devient vivante.
// Si une seule de ces écritures échoue, la transaction est ANNULÉE (rollback total).

import { and, desc, eq } from "drizzle-orm";

import { normalizedLevenshtein } from "../domain/edit-distance";
import type { Canal } from "../domain/enums";
import { now } from "../domain/time";
import { contacts, generationEvents, messages } from "./schema";
import type { ScopedDb } from "./scoped";

/** Ligne `messages` telle que lue en base (typée par le schéma). */
export type Message = typeof messages.$inferSelect;
/** Ligne `generation_events` telle que lue en base. */
export type GenerationEventRow = typeof generationEvents.$inferSelect;

/**
 * Données de la génération à tracer avec l'envoi (SM-1). C'est la projection PLATE du
 * `GenerationEvent` produit en mémoire au Composeur (story 3.3), passée à `markSent`
 * quand un texte a été GÉNÉRÉ (puis éventuellement édité). `null`/absent ⇒ texte tapé
 * main : aucun `generation_events` n'est écrit (le Message est seul, `genereParIa=false`).
 *
 * La frontière n'expose PAS le type `GenerationEvent` (qui vit côté feature) : le
 * repository reçoit cette forme neutre, sérialisable, sans dépendance feature.
 */
export type MarkSentGeneration = {
  /** Texte GÉNÉRÉ (sortie IA sanitizée, avant édition). */
  generated: string;
  /** Idée brute saisie par l'utilisateur — `raw_intent`. */
  rawIntent: string;
  /** Version du prompt ayant servi. */
  promptVersion: number;
  /** Id EXACT du modèle Claude. */
  modelId: string;
  /** Ids des exemples de voix injectés (seeds et/ou messages). Sérialisé en JSON. */
  voiceExamplesRef: string[];
  /** Version du nettoyage `sanitize()` appliqué. */
  sanitizeVersion: number;
  /** Tokens consommés (entrée/sortie). */
  tokens: { input: number; output: number };
};

/**
 * Entrée de l'ÉDITION d'un Message envoyé (story 3.7) — la frontière du repository.
 * `expectedUpdatedAt` est le JETON DE VERSION optimiste : l'édition n'est appliquée que
 * si le `updated_at` en base lui est ÉGAL (sinon CONFLIT, 0 ligne, aucune écriture).
 */
export type EditSentInput = {
  /** Id du Message à rouvrir (scopé au tenant par la porte). */
  id: string;
  /** Nouveau texte FIGÉ (déjà sanitizé en amont par l'action, AR-3). */
  texte: string;
  /** Jeton de version attendu : `updated_at` courant (porté côté client depuis la fiche). */
  expectedUpdatedAt: number;
};

/**
 * Résultat de `editSent` — l'autorité serveur sur `Sent` distingue trois issues :
 *   • `ok` : l'édition a été appliquée (le Message porte le NOUVEAU `updated_at`) ;
 *   • `conflict` : jeton périmé / réédition concurrente (0 ligne) → sémantique 409 ;
 *   • `not-found` : aucun Message de ce tenant à cet id (porte scopée → invisible).
 */
export type EditSentResult =
  | { status: "ok"; message: Message }
  | { status: "conflict" }
  | { status: "not-found" };

/** Entrée de `markSent` — la frontière du repository (jamais `userId`, imposé par la porte). */
export type MarkSentInput = {
  /** Contact destinataire. */
  contactId: string;
  /** Canal utilisé. */
  canal: Canal;
  /** Texte FIGÉ = sortie sanitizée finale (l'éditée si retouchée à la main). */
  texte: string;
  /**
   * Données de la génération si le texte a été produit par l'IA, sinon `null` (tapé main).
   * Détermine `genere_par_ia`, `texte_genere`, et l'écriture (ou non) du `generation_events`.
   */
  generation?: MarkSentGeneration | null;
};

/** Contrat exposé par le repository des Messages (auto-scopé par tenant). */
export type MessagesRepository = {
  /** Messages d'un contact, ordonnés du plus RÉCENT au plus ancien (timeline). */
  listForContact: (contactId: string) => Promise<Message[]>;
  /**
   * Textes des Messages au statut 'envoye', ordonnés récent → ancien. Sert le CORPUS
   * DE VOIX (FR-17) : tous les Messages envoyés (manuels inclus), aucune exclusion.
   */
  listSentTexts: () => Promise<string[]>;
  /**
   * ÉCRITURE ATOMIQUE de l'envoi (AR-8, SM-1). Insère le Message FIGÉ + (si génération)
   * le `generation_events` + met à jour `contacts.dernier_contact_at`, le tout dans UNE
   * transaction scopée. Renvoie le Message créé.
   */
  markSent: (input: MarkSentInput) => Promise<Message>;
  /**
   * Lit UN Message scopé par son id (ou `null` si introuvable / d'un autre tenant).
   * Sert à charger l'état courant + son jeton `updated_at` avant de rouvrir en édition.
   */
  getById: (id: string) => Promise<Message | null>;
  /**
   * ÉDITION d'un Message envoyé avec CONCURRENCE OPTIMISTE (story 3.7, AR-12). Met à jour
   * `texte` + `updated_at` UNIQUEMENT si `updated_at = expectedUpdatedAt` (autorité serveur
   * sur `Sent`). NE TOUCHE JAMAIS `generation_events`, `texte_genere`, `genere_par_ia` ni
   * `statut` (reste 'envoye'). 0 ligne modifiée ⇒ CONFLIT (jeton périmé / réédition
   * concurrente, 409) — aucune écriture. Un Message d'un autre tenant est invisible (porte).
   */
  editSent: (input: EditSentInput) => Promise<EditSentResult>;
};

/**
 * Construit le repository des Messages au-dessus d'une porte scopée. Toutes les
 * lectures/écritures sont déjà bornées au tenant ; `markSent` ouvre une transaction
 * (elle aussi scopée au même tenant) pour garantir l'atomicité de l'envoi.
 */
export function messagesRepository(scoped: ScopedDb): MessagesRepository {
  return {
    async listForContact(contactId) {
      // Borné au tenant ET au contact ; tri DESC sur `created_at` (récent → ancien).
      return scoped.findMany(
        messages,
        eq(messages.contactId, contactId),
        [desc(messages.createdAt)],
      );
    },

    async listSentTexts() {
      // Corpus de Voix : uniquement les envoyés, récent → ancien (selectFewShot bornera).
      const rows = await scoped.findMany(
        messages,
        eq(messages.statut, "envoye"),
        [desc(messages.createdAt)],
      );
      return rows.map((m) => m.texte);
    },

    async markSent(input) {
      const ts = now(scoped.now);
      const generation = input.generation ?? null;

      // TRANSACTION SCOPÉE : message figé + (event) + maj contact = tout ou rien (AR-8).
      return scoped.transaction(async (tx) => {
        // GARDE D'INTÉGRITÉ : le contact DOIT appartenir au tenant. `contactId` vient du
        // client (action publique) ; sans cette garde, un appelant pourrait créer un
        // message ORPHELIN pointant vers le contact d'un AUTRE tenant (la FK est
        // satisfaite, et l'update (c) ci-dessous matcherait 0 ligne en silence). On
        // refuse : la transaction est annulée (rollback total), l'action renvoie un
        // échec doux. `findFirst` est scopé → un contact d'un autre tenant est invisible.
        const contact = await tx.findFirst(
          contacts,
          eq(contacts.id, input.contactId),
        );
        if (!contact) {
          throw new Error("Contact introuvable pour ce tenant.");
        }

        // (a) Message FIGÉ : `texte` = sortie finale, statut 'envoye', `envoye_at` posé.
        //     `texte_genere` garde la sortie IA d'origine (NULL si tapé main).
        const [message] = await tx.insert(messages, {
          contactId: input.contactId,
          canal: input.canal,
          texte: input.texte,
          texteGenere: generation ? generation.generated : null,
          statut: "envoye",
          genereParIa: generation !== null,
          envoyeAt: ts,
          createdAt: ts,
          // 1er jeton de version optimiste (story 3.7) = l'instant d'envoi. Toute
          // édition ultérieure le ré-écrira ; `editSent` exige sa valeur courante.
          updatedAt: ts,
        });

        // (b) SI génération : `generation_events` lié au message qu'on vient d'insérer.
        //     `edit_distance` = distance NORMALISÉE généré→envoyé (métrique SM-1) ;
        //     `voice_examples_ref` sérialisé en JSON (ids des exemples injectés).
        if (generation) {
          await tx.insert(generationEvents, {
            messageId: message.id,
            contactId: input.contactId,
            generated: generation.generated,
            sent: input.texte,
            editDistance: normalizedLevenshtein(generation.generated, input.texte),
            rawIntent: generation.rawIntent,
            promptVersion: generation.promptVersion,
            modelId: generation.modelId,
            voiceExamplesRef: JSON.stringify(generation.voiceExamplesRef),
            sanitizeVersion: generation.sanitizeVersion,
            tokensInput: generation.tokens.input,
            tokensOutput: generation.tokens.output,
            createdAt: ts,
          });
        }

        // (c) Le Score de froideur (Epic 2) devient vivant : on marque le dernier contact.
        //     Borné au tenant ET au contact (la porte combine avec le filtre tenant).
        await tx.update(
          contacts,
          { dernierContactAt: ts, updatedAt: ts },
          eq(contacts.id, input.contactId),
        );

        return message;
      });
    },

    async getById(id) {
      // Lecture scopée : un message d'un autre tenant est invisible (porte) → null.
      const row = await scoped.findFirst(messages, eq(messages.id, id));
      return row ?? null;
    },

    async editSent({ id, texte, expectedUpdatedAt }) {
      const ts = now(scoped.now);

      // VERROU OPTIMISTE (autorité serveur sur Sent, AR-12) : on n'écrit QUE si le jeton
      // fourni égale celui en base. `update` est scopé au tenant (la porte ajoute
      // `user_id = tenant`) ET filtré sur `id` + `updated_at = expectedUpdatedAt`. On ne
      // pose QUE `texte` + `updated_at` : `generation_events`, `texte_genere`,
      // `genere_par_ia`, `statut` (reste 'envoye') et `edit_distance` (figé à l'envoi)
      // restent INTACTS — l'historique du moat ne bouge pas.
      const updated = await scoped.update(
        messages,
        { texte, updatedAt: ts },
        and(eq(messages.id, id), eq(messages.updatedAt, expectedUpdatedAt)),
      );

      if (updated.length > 0) {
        // Une ligne modifiée : édition appliquée, le Message porte le NOUVEAU jeton.
        return { status: "ok", message: updated[0] };
      }

      // 0 ligne : soit le Message n'existe pas (ou est d'un autre tenant) → introuvable,
      // soit il existe mais son jeton diffère (réédition concurrente / jeton périmé) →
      // CONFLIT (409). On distingue les deux par une lecture scopée de l'état courant.
      const current = await scoped.findFirst(messages, eq(messages.id, id));
      return current ? { status: "conflict" } : { status: "not-found" };
    },
  };
}
