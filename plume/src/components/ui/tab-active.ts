// Logique PURE de l'onglet actif — isolée de TabBar.tsx (composant client) pour être
// testable sans rendu. Zone neutre : aucune dépendance React/Next.

/** Les 3 onglets de la coquille, dans l'ordre de lecture (= ordre de focus). */
export const TAB_HREFS = ["/aujourdhui", "/reseau", "/reglages"] as const;

/**
 * Un onglet est actif sur sa route exacte ET ses sous-routes
 * (ex. /reseau actif sur /reseau/abc123). Évite qu'un préfixe partagé
 * — s'il en existait — ne déclenche un faux positif (match sur segment plein).
 */
export function isTabActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
