// Façade `localStore` — persistance LOCALE des brouillons du Composeur (AR-12).
//
// Le Composeur écrit le brouillon À CHAQUE FRAPPE *avant tout réseau* : c'est le
// « brouillon immortel ». IndexedDB (via Dexie) est le seul support qui survit au
// rechargement de la PWA hors-ligne. Cette façade est la SEULE porte d'accès au
// store : les composants n'ouvrent jamais Dexie directement.
//
// RÈGLE DURE (AR-12) — façade PUREMENT CRUD. Aucune notion de synchro/outbox ici :
// pas de `status`, `synced`, `pending`, `enqueue`, `sync`… La logique d'outbox et de
// réconciliation serveur arrivera *derrière la MÊME façade* en Epic 5 ; on ne
// l'anticipe pas (pas de signature qui la présuppose). Un brouillon = un contact.
//
// SSR-safe : ce module est importé par un Client Component monté dans un layout
// SERVEUR ; il peut donc être évalué pendant le rendu serveur, où `indexedDB`
// n'existe pas. On initialise Dexie PARESSEUSEMENT, à la première opération côté
// navigateur — le simple chargement du module ne touche jamais IndexedDB.

import Dexie, { type Table } from "dexie";

import type { Canal } from "@/lib/domain/enums";

/**
 * Un brouillon de message en cours de rédaction, persisté localement.
 *
 * `key` = l'id du Contact : un seul brouillon par contact (rouvrir le Composeur pour
 * le même contact restaure exactement ce qui était en train d'être écrit).
 * `text` est la SOURCE DE VÉRITÉ (le texte affiché EST le Message, FR-6).
 */
export interface Draft {
  /** Id du Contact (clé primaire — un brouillon par contact). */
  key: string;
  /** Corps du message en cours (vide par défaut). */
  text: string;
  /** Canal de rédaction retenu (pré-rempli au canal préféré du contact). */
  canal: Canal;
  /** Registre de rédaction : brouillon rapide ou tournure soignée. */
  tone: "rapide" | "soigne";
  /** Dernière modification (epoch ms) — utile pour un futur affichage « modifié il y a… ». */
  updatedAt: number;
}

// Base Dexie typée. On NE l'instancie PAS au chargement du module : `new Dexie(...)`
// touche `indexedDB`, absent côté serveur. L'instance est créée à la 1re opération
// (cf. `db()`), une seule fois pour toute la session navigateur.
type PlumeDb = Dexie & { drafts: Table<Draft, string> };

let instance: PlumeDb | null = null;

/**
 * Renvoie l'instance Dexie, créée paresseusement au 1er appel côté navigateur.
 * Lève si `indexedDB` est absent (rendu serveur) — les opérations CRUD ci-dessous
 * sont toujours déclenchées par une interaction client, jamais pendant le SSR.
 */
function db(): PlumeDb {
  if (typeof indexedDB === "undefined") {
    throw new Error(
      "localStore: IndexedDB indisponible (rendu serveur ?). Les opérations de " +
        "brouillon ne s'exécutent que côté navigateur.",
    );
  }
  if (!instance) {
    const dexie = new Dexie("plume") as PlumeDb;
    // Schéma v1 : `key` (id contact) est la clé primaire ; pas d'autre index — la
    // façade ne fait que get/put/delete par clé (CRUD strict, aucune requête riche).
    dexie.version(1).stores({ drafts: "key" });
    instance = dexie;
  }
  return instance;
}

/** Lit le brouillon d'un contact ; `undefined` si aucun n'a encore été écrit. */
export async function getDraft(key: string): Promise<Draft | undefined> {
  return db().drafts.get(key);
}

/** Écrit (ou écrase) le brouillon d'un contact. Idempotent sur `key`. */
export async function saveDraft(draft: Draft): Promise<void> {
  await db().drafts.put(draft);
}

/** Efface le brouillon d'un contact (no-op si absent). */
export async function deleteDraft(key: string): Promise<void> {
  await db().drafts.delete(key);
}
