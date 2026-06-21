// REWIND transactionnel d'un tour d'agent (copilote Phase 2 inc.4) — LOGIQUE PURE.
//
// Le rewind n'est PAS un tool d'agent (Constraint SPEC) : c'est une AFFORDANCE HUMAINE, déclenchée
// par le popup via une server action (`rewind.actions.ts`). Cette fonction-ci est la logique PURE,
// testable hors serveur : elle reçoit des repositories DÉJÀ scopés au tenant (porte `db.forUser`)
// et n'implémente AUCUNE logique BDD directe — elle ORCHESTRE les inverses (Constraint SPEC).
//
// ATOMICITÉ : cette fonction est rejouée DANS une transaction scopée fournie par l'appelant (la
// server action enveloppe `replayRewind` dans `gate.transaction(...)`) — tous les inverses ET
// l'entrée d'audit `rewind` réussissent ENSEMBLE ou pas du tout (jamais d'undo partiel sans
// trace). Les `deps` qu'elle reçoit sont donc déjà re-scopés sur le handle transactionnel.
//
// Elle rejoue, en ordre LIFO (fourni par `entriesToReverse`), l'INVERSE de chaque mutation
// journalisée du tour ciblé ET de tous les tours postérieurs :
//   - contact `created`            → re-archivage SOFT (`contacts.remove`) ;
//   - contact `merged`/`reactivated` → restauration de l'état antérieur (`prevState`) — JAMAIS un
//     re-archivage aveugle qui détruirait un contact préexistant (CAP-3) ;
//   - contact `archived`           → DÉSARCHIVAGE (restaure l'actif via `prevState = {archivedAt:
//     null}`) — l'inverse d'un `archiveContact` de l'agent ;
//   - message (brouillon `created`) → retrait SOFT (`messages.archiveDraft`) ;
//   - message `archived`           → DÉSARCHIVAGE (`messages.restoreDraft`) — inverse d'un
//     `archiveDraft` de l'agent.
// AUCUN hard-delete nulle part. Le rewind est lui-même JOURNALISÉ (entrée `op = "rewind"`, audit).

import type {
  ActionLogRepository,
  ContactsRepository,
  ContactUpdate,
  MessagesRepository,
} from "@/lib/db";

/** Repositories scopés injectés (prod = `forUser(userId)` ; test = repos sur db en mémoire). */
export type RewindDeps = {
  actionLog: Pick<ActionLogRepository, "entriesToReverse" | "recordRewind">;
  contacts: Pick<ContactsRepository, "remove" | "update">;
  messages: Pick<MessagesRepository, "archiveDraft" | "restoreDraft">;
};

/** Bilan d'un rewind (pour la verbalisation côté UI ; ton neutre). */
export type RewindSummary = {
  /** Nombre d'entrées de journal effectivement inversées. */
  reversed: number;
  /** Contacts re-archivés ou restaurés. */
  contacts: number;
  /** Brouillons retirés (soft). */
  messages: number;
  /** Tours annulés (le tour ciblé + ses postérieurs), pour l'audit. */
  turnIds: string[];
};

/**
 * Rejoue l'inverse exact d'un tour (et de ses tours postérieurs), en LIFO, sans jamais
 * hard-delete, puis journalise le rewind. Idempotent par construction : un tour déjà annulé
 * renvoie `entriesToReverse` vide → bilan à zéro, aucune écriture, aucune entrée d'audit.
 */
export async function replayRewind(
  deps: RewindDeps,
  turnId: string,
): Promise<RewindSummary> {
  // `entriesToReverse` rend les entrées EN ORDRE LIFO (récent → ancien), hors entrées `rewind`
  // et hors tours déjà annulés (la porte scopée garantit aussi qu'aucun tour d'un autre tenant
  // n'est visible : un `turnId` étranger renvoie []).
  const entries = await deps.actionLog.entriesToReverse(turnId);
  if (entries.length === 0) {
    return { reversed: 0, contacts: 0, messages: 0, turnIds: [] };
  }

  const cancelled = new Set<string>();
  let contactsTouched = 0;
  let messagesTouched = 0;

  for (const e of entries) {
    cancelled.add(e.turnId);
    if (e.entityType === "contact") {
      if (e.op === "created") {
        // Inverse d'une création : re-archivage SOFT (jamais DELETE). Idempotent.
        await deps.contacts.remove(e.entityId);
      } else {
        // merged / reactivated / archived : on RESTAURE l'état antérieur capturé. `prevState`
        // contient les champs touchés (et `archivedAt` antérieur pour une réactivation, ou
        // `{archivedAt: null}` pour un archivage → DÉSARCHIVAGE) — le contact retrouve exactement
        // son état d'avant le tour, sans perte du préexistant.
        await deps.contacts.update(
          e.entityId,
          (e.prevState ?? {}) as ContactUpdate,
        );
      }
      contactsTouched += 1;
    } else if (e.entityType === "message") {
      if (e.op === "archived") {
        // Inverse d'un archivage de brouillon par l'agent (`archiveDraft` du tool) = désarchivage.
        await deps.messages.restoreDraft(e.entityId);
      } else {
        // op `created` (brouillon rédigé par `composeMessage`) : retrait SOFT (jamais DELETE).
        await deps.messages.archiveDraft(e.entityId);
      }
      messagesTouched += 1;
    }
    // entityType "turn" / op "rewind" : exclus par `entriesToReverse` — non ré-inversables.
  }

  const turnIds = [...cancelled];
  // Le rewind est JOURNALISÉ, pas effaçant : on AJOUTE une entrée d'audit `op = "rewind"`.
  await deps.actionLog.recordRewind(turnId, turnIds);

  return {
    reversed: entries.length,
    contacts: contactsTouched,
    messages: messagesTouched,
    turnIds,
  };
}
