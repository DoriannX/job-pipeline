// Repository du JOURNAL D'ACTIONS `action_log` (copilote Phase 2 inc.4) — ZONE AUTORISÉE
// (src/lib/db/**). C'est ICI, et seulement ici, qu'on touche au schéma Drizzle de `action_log` ;
// le journal a SON propre repository sur la porte scopée (Constraint SPEC : le journal et le
// rewind n'implémentent AUCUNE logique BDD directe — ils orchestrent les repositories).
//
// Deux usages :
//   - ÉCRITURE (CAP-1) : `record()` est appelée par la SINK de journalisation, DANS la
//     transaction de la mutation (atomicité) — voir `journal.ts`.
//   - LECTURE/REWIND (CAP-2/3) : `entriesToReverse()` calcule, pour un tour ciblé, les entrées à
//     inverser (ce tour + tous les tours POSTÉRIEURS, en ordre LIFO, hors tours déjà annulés) ;
//     `recordRewind()` ajoute l'entrée d'audit `op = "rewind"` (le journal n'est jamais effaçant).

import { now } from "../domain/time";
import { actionLog, type ActionLogPrevState } from "./schema";
import type { ScopedDb } from "./scoped";

/** Ligne `action_log` telle que lue en base (typée par le schéma). */
export type ActionLogEntry = typeof actionLog.$inferSelect;

/**
 * Entrée d'enregistrement d'une mutation au journal. `userId`/`createdAt` sont posés par la
 * porte/horloge ; `turnId` est clos par closure côté `runAgentChat` (jamais argument agent).
 */
export type RecordActionInput = {
  turnId: string;
  toolName: string;
  entityType: ActionLogEntry["entityType"];
  entityId: string;
  op: ActionLogEntry["op"];
  prevState?: ActionLogPrevState | null;
};

/** Contrat exposé par le repository du journal d'actions (auto-scopé par tenant). */
export type ActionLogRepository = {
  /** Insère UNE entrée de journal (scopée au tenant). Appelée dans la transaction de la mutation. */
  record: (input: RecordActionInput) => Promise<ActionLogEntry>;
  /**
   * Entrées à INVERSER pour rewind le tour `turnId` : ce tour + tous les tours POSTÉRIEURS, en
   * ordre CHRONOLOGIQUE INVERSE (LIFO — un tour qui a modifié une entité d'un tour antérieur est
   * annulé d'abord). Exclut les entrées d'audit `rewind` ET les tours DÉJÀ annulés par un rewind
   * précédent (idempotence : pas de double-inverse). Si le tour ciblé est inconnu ou déjà annulé,
   * renvoie `[]` (rien à faire).
   */
  entriesToReverse: (turnId: string) => Promise<ActionLogEntry[]>;
  /**
   * Journalise le rewind LUI-MÊME (audit) : une entrée `op = "rewind"` référençant les `turnId`
   * annulés dans `prevState`. N'efface JAMAIS les entrées annulées — le journal reste un récit
   * complet (actif SaaS). Non ré-inversable (pas de redo, cf. Non-goals).
   */
  recordRewind: (
    targetTurnId: string,
    cancelledTurnIds: string[],
  ) => Promise<ActionLogEntry>;
};

/** `prev_state` d'une entrée `rewind` : la liste des tours qu'elle a annulés. */
type RewindPrevState = { turnIds?: string[] };

export function actionLogRepository(scoped: ScopedDb): ActionLogRepository {
  return {
    async record(input) {
      const [row] = await scoped.insert(actionLog, {
        turnId: input.turnId,
        toolName: input.toolName,
        entityType: input.entityType,
        entityId: input.entityId,
        op: input.op,
        prevState: input.prevState ?? null,
        createdAt: now(scoped.now),
      });
      return row;
    },

    async entriesToReverse(turnId) {
      // On lit TOUT le journal du tenant (scopé par la porte) et on raisonne en mémoire : le
      // volume par session est petit et le calcul (min-timestamp du tour, tours déjà annulés,
      // LIFO) est plus clair et testable ainsi qu'en SQL.
      const all = await scoped.findMany(actionLog);

      // Tours DÉJÀ annulés par un rewind antérieur (union des `turnIds` des entrées `rewind`).
      const cancelled = new Set<string>();
      for (const e of all) {
        if (e.op === "rewind") {
          const prev = e.prevState as RewindPrevState | null;
          for (const t of prev?.turnIds ?? []) cancelled.add(t);
        }
      }

      // Tour ciblé inconnu (aucune mutation) OU déjà annulé → rien à inverser.
      const targetEntries = all.filter(
        (e) => e.turnId === turnId && e.op !== "rewind",
      );
      if (targetEntries.length === 0 || cancelled.has(turnId)) return [];

      // Borne temporelle = 1ʳᵉ mutation du tour ciblé. Tout ce qui est postérieur (≥) appartient
      // au tour ciblé ou à un tour ultérieur → entre dans le périmètre du rewind (ramène à un
      // point dans le temps). ASSUMPTION TRANCHÉE (SPEC) : rewind LIFO sur tours postérieurs.
      //
      // ROBUSTESSE `createdAt` NULL : nos écritures posent TOUJOURS `created_at` (horloge
      // injectée), mais le schéma l'autorise NULL. Un `?? 0` naïf ferait qu'une entrée à
      // `createdAt = null` rabaisse `minTs` à 0 et balaierait TOUT le journal. On calcule donc
      // `minTs` sur les seuls horodatages non-nuls, et on n'inclut une entrée dans le périmètre
      // que si (a) elle appartient explicitement au tour ciblé, OU (b) son `createdAt` non-nul
      // est ≥ `minTs`. Une entrée orpheline (createdAt null d'un autre tour) n'est jamais balayée.
      const targetTs = targetEntries
        .map((e) => e.createdAt)
        .filter((t): t is number => t != null);
      const minTs = targetTs.length > 0 ? Math.min(...targetTs) : Infinity;

      const toReverse = all.filter(
        (e) =>
          e.op !== "rewind" &&
          !cancelled.has(e.turnId) &&
          (e.turnId === turnId ||
            (e.createdAt != null && e.createdAt >= minTs)),
      );

      // LIFO : ordre chronologique INVERSE (plus récent d'abord) ; `id` en départage stable
      // pour les entrées d'un même run (même horodatage injecté).
      toReverse.sort((a, b) => {
        const dt = (b.createdAt ?? 0) - (a.createdAt ?? 0);
        return dt !== 0 ? dt : (b.id < a.id ? -1 : b.id > a.id ? 1 : 0);
      });
      return toReverse;
    },

    async recordRewind(targetTurnId, cancelledTurnIds) {
      const [row] = await scoped.insert(actionLog, {
        turnId: targetTurnId,
        toolName: "rewind",
        entityType: "turn",
        entityId: targetTurnId,
        op: "rewind",
        prevState: { turnIds: cancelledTurnIds },
        createdAt: now(scoped.now),
      });
      return row;
    },
  };
}
