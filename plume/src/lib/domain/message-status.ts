// ZONE NEUTRE (domain/) — MACHINE À ÉTATS NOMMÉE des Messages (AR-5).
//
// Pure, sans infra, sans I/O : c'est la SEULE source des transitions LÉGALES du cycle
// de vie d'un Message. Le repository (`setStatus`) la consulte AVANT toute écriture ;
// l'UI (mini-sheet, story 3.8) ne propose QUE les transitions sortantes légales depuis
// le statut courant. Aucune transition n'est codée en dur ailleurs : on lit cette table.
//
// Le cycle (AR-5) :
//
//     brouillon ──► envoye ──► vu ──► repondu  (terminal)
//                       │        │
//                       │        └──► ignore   (terminal)
//                       └─────────────► repondu (terminal)
//                       └─────────────► ignore  (terminal)
//
//   • `brouillon → envoye` : faite par `markSent` (story 3.6), JAMAIS un choix manuel ;
//   • `envoye → vu | repondu | ignore` : saisie manuelle au MVP (mini-sheet, FR-19) ;
//   • `vu → repondu | ignore` : saisie manuelle ;
//   • `repondu`, `ignore` : TERMINAUX — aucune transition sortante (le cycle est clos).
//
// COUPLAGE RELANCE (Epic 4) : atteindre `repondu` ou `ignore` est le SIGNAL qui clôturera
// la Relance associée. Ici on ne décrit QUE la légalité de la transition d'état — la
// consommation du signal (fermeture de la Relance) vit en Epic 4, hors périmètre 3.8.

import { MESSAGE_STATUS, type MessageStatut } from "./enums";

/**
 * Table des transitions LÉGALES : pour chaque statut, la liste EXHAUSTIVE des statuts
 * vers lesquels on peut passer. Un tableau vide ⇒ statut TERMINAL (aucune sortie).
 *
 * Note : `brouillon → envoye` est légal dans la machine (transition d'envoi, story 3.6),
 * mais elle n'est PAS une option manuelle du mini-sheet (l'envoi est un acte à part).
 */
export const TRANSITIONS: Record<MessageStatut, MessageStatut[]> = {
  // L'envoi (markSent) fait passer le brouillon en envoyé ; pas d'autre sortie.
  brouillon: ["envoye"],
  // Après envoi : on observe (vu) ou on conclut directement (répondu / sans réponse).
  envoye: ["vu", "repondu", "ignore"],
  // Vu : on conclut (répondu / sans réponse). Pas de retour en arrière vers 'envoye'.
  vu: ["repondu", "ignore"],
  // Terminaux : le cycle est clos, aucune transition sortante.
  repondu: [],
  ignore: [],
};

/**
 * Le passage `from → to` est-il une transition LÉGALE de la machine à états ?
 * Un statut inconnu (hors union) n'a aucune transition (faux). Un `to` non listé
 * pour `from` est refusé (ex. `envoye → brouillon`, `repondu → vu`, `vu → envoye`).
 */
export function canTransition(from: MessageStatut, to: MessageStatut): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/**
 * Liste des transitions sortantes LÉGALES depuis `from` (vide pour un terminal).
 * L'UI s'en sert pour ne proposer QUE des changements valides ; on renvoie une COPIE
 * pour que l'appelant ne puisse pas muter la table de transitions.
 */
export function availableTransitions(from: MessageStatut): MessageStatut[] {
  return [...(TRANSITIONS[from] ?? [])];
}

/**
 * Transitions MANUELLES proposables dans le mini-sheet (story 3.8) : les transitions
 * sortantes légales PRIVÉES de l'envoi (`envoye`), qui n'est jamais un choix manuel.
 * Pour `envoye`/`vu` ⇒ typiquement `vu`/`repondu`/`ignore` ; vide pour les terminaux
 * et pour `brouillon` (rien à changer à la main avant l'envoi).
 */
export function manualTransitions(from: MessageStatut): MessageStatut[] {
  return availableTransitions(from).filter((to) => to !== "envoye");
}

// Garde-fou de complétude : la table couvre EXACTEMENT l'union des statuts (AR-5).
// Si un statut est ajouté à `MESSAGE_STATUS` sans entrée ici, le typage de `TRANSITIONS`
// (Record<MessageStatut, ...>) échoue au build — la machine reste exhaustive.
void MESSAGE_STATUS;
