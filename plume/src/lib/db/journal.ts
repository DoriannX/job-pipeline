// Couture de JOURNALISATION (copilote Phase 2 inc.4) — types NEUTRES partagés.
//
// Le journal d'actions (`action_log`) doit être écrit ATOMIQUEMENT avec la mutation qu'il
// journalise (Constraint SPEC, parité `markSent`+`generation_events`). Pour ne PAS coupler les
// repositories d'entités (contacts/messages) au repository du journal, la mutation reçoit une
// SINK injectée : une fonction que le repository appelle DANS SA PROPRE TRANSACTION, en lui
// passant le handle transactionnel scopé (`tx`) + la description de la mutation. Le repository
// ignore tout du journal ; c'est l'appelant (la couche tool) qui branche la sink sur
// `actionLogRepository(tx)`. Atomicité garantie : l'entrée vit dans la même transaction que la
// mutation, donc « mutation sans entrée » est un état impossible (rollback total sinon).

import type { ActionLogPrevState } from "./schema";
import type { ScopedDb } from "./scoped";

/** Opérations de MUTATION journalisables (l'entrée d'audit `rewind` n'en est pas une). */
export type JournaledOp = "created" | "merged" | "reactivated" | "archived";

/**
 * Description NEUTRE d'une mutation à journaliser, produite par le repository (lui seul connaît
 * l'`op` réelle — `created` vs `merged` vs `reactivated` vs `archived` — et l'état antérieur).
 * `prevState` est REQUIS pour `merged`/`reactivated` (champs à restaurer au rewind) ET pour
 * `archived` (où il vaut `{ archivedAt: null }` : l'inverse DÉSARCHIVE, restaure l'actif) ; il est
 * omis pour `created` (dont l'inverse est l'archivage, sans état à restaurer).
 */
export type MutationRecord = {
  entityType: "contact" | "message";
  entityId: string;
  op: JournaledOp;
  prevState?: ActionLogPrevState | null;
};

/**
 * Sink de journalisation injectée dans une mutation. Le repository l'invoque DANS sa transaction
 * (handle `tx` re-scopé au même tenant) pour chaque entité mutée. Absente ⇒ mutation NON
 * journalisée (chemin hérité : saisie UI manuelle, tests purs) — la mutation reste alors hors
 * transaction si elle l'était déjà.
 */
export type JournalSink = (
  tx: ScopedDb,
  record: MutationRecord,
) => Promise<void>;
