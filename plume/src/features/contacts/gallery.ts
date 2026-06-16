// Logique PURE de la galerie Réseau (story 2.3) : tri + recherche par nom.
// Extraite des composants pour rester testable sans React. Aucune dépendance infra.
//
// PÉRIMÈTRE volontairement borné aux données disponibles à l'Epic 2 :
//   • tri par FROIDEUR (défaut, « les liens qui refroidissent en premier ») ;
//   • tri par NOM (alphabétique, insensible casse/accents) ;
//   • recherche par NOM.
// TODO(Epic 3): tri par date du dernier Message + filtre par Statut du dernier Message
//   (FR-5) — dépendent des Messages (Epic 3). On NE construit PAS d'UI/logique morte
//   ici tant que la donnée Message n'existe pas (pas de tri/filtre fantôme).

import { coldnessRank } from "@/lib/domain/cold-score";

import type { ContactView } from "./types";

/** Critères de tri DISPONIBLES à l'Epic 2 (la date/statut Message = Epic 3). */
export type SortKey = "coldness" | "name";

/** Normalise un nom pour comparaison/recherche : trim, minuscules, sans accents. */
function normalizeForSearch(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Comparaison alphabétique FR stable (insensible casse/accents). */
function compareNames(a: ContactView, b: ContactView): number {
  return a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" });
}

/**
 * Filtre les contacts dont le nom CONTIENT la requête (insensible casse/accents).
 * Requête vide ⇒ aucun filtrage (tous renvoyés).
 */
export function filterByName(
  contacts: ContactView[],
  query: string,
): ContactView[] {
  const needle = normalizeForSearch(query);
  if (needle === "") return contacts;
  return contacts.filter((c) => normalizeForSearch(c.nom).includes(needle));
}

/**
 * Trie une COPIE des contacts selon le critère choisi (n'altère pas l'entrée).
 *   • "coldness" : refroidissement décroissant (never < cold < warm < fresh), nom en
 *     départage pour un ordre stable et lisible ;
 *   • "name" : alphabétique FR.
 */
export function sortContacts(
  contacts: ContactView[],
  sort: SortKey,
): ContactView[] {
  const copy = [...contacts];
  if (sort === "name") {
    return copy.sort(compareNames);
  }
  // Tri par froideur (défaut) : le plus « à traiter » remonte ; à froideur égale,
  // on départage par nom pour un ordre déterministe.
  return copy.sort((a, b) => {
    const byCold = coldnessRank(a.coldness) - coldnessRank(b.coldness);
    return byCold !== 0 ? byCold : compareNames(a, b);
  });
}

/**
 * Vue galerie complète : on FILTRE par nom puis on TRIE. L'ordre (filtre→tri) garde
 * un résultat déterministe quel que soit l'ordre d'entrée.
 */
export function buildGallery(
  contacts: ContactView[],
  { query, sort }: { query: string; sort: SortKey },
): ContactView[] {
  return sortContacts(filterByName(contacts, query), sort);
}
