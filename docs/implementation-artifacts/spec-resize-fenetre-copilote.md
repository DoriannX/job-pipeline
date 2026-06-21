---
title: 'Resize de la fenêtre du copilote (drag coin haut-gauche)'
type: 'feature'
created: '2026-06-21'
status: 'done'
baseline_commit: '46363ace17e4223114dc0fc6e56248d1a08eb089'
context: ['{project-root}/docs/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le panneau du copilote a une taille figée (`PANEL_W`/`PANEL_H`, CopiloteSheet.tsx:47-48) ; on ne peut pas l'agrandir pour lire une longue réponse sans scroller dans une fenêtre étroite.

**Approach:** Ajouter une poignée de resize au coin **haut-gauche** du panneau ouvert (le panneau est ancré bas-droite). Drag = agrandit/rétrécit largeur+hauteur ensemble. Taille retenue **en-session uniquement** (réinitialisée au reload, cohérent avec la conversation en-session du copilote, zéro persistance).

## Boundaries & Constraints

**Always:**
- Resize actif **seulement** quand le panneau est pleinement ouvert (`phase === "open"`). Jamais pendant le morph icône↔panneau ni à l'état icône.
- Préserver INTACTE l'animation séquentielle de morph (closed→wide→open et l'inverse) ; pendant un drag, désactiver le ressort `layout` (transition durée 0) pour que la boîte suive le pointeur sans lag, puis le restaurer au relâchement.
- Clamper la taille aux bornes : min lisible (champ + en-tête restent utilisables) ; max borné au viewport en gardant les marges d'ancrage (`right:24`, `bottom:96`).
- Plancher a11y (project-context « doublage obligatoire ») : poignée focusable au clavier, `aria-label` FR, redimensionnable aux flèches du clavier quand elle a le focus.
- UI/commentaires en français ; design-system respecté (contour encre, offset dur, rayons figés, mauve = action uniquement — la poignée n'est PAS une action mauve).

**Ask First:**
- Si l'implémentation casse ou rend saccadée l'animation de morph existante → HALT, ne pas livrer une anim dégradée.

**Never:**
- Aucune persistance (localStorage / BDD / cookie) — la taille meurt au reload.
- Pas de resize multi-axes indépendants (un seul geste coin = largeur+hauteur ensemble).
- Pas de bouton plein-écran ni de 2e poignée.
- Ne pas toucher la logique de stream, sync (`router.refresh`), rewind, ni le point de montage.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Drag agrandir | Panneau ouvert, drag poignée vers haut-gauche | Largeur+hauteur croissent en suivant le pointeur, ancrage bas-droite conservé | N/A |
| Drag au-delà des bornes | Drag qui dépasse min ou max | Taille clampée à la borne, le drag continue sans saut | N/A |
| Resize puis fermer/rouvrir | Taille custom, fermeture puis réouverture en-session | Le panneau rouvre à la taille custom retenue | N/A |
| Reload page | Taille custom, rechargement | Retour à la taille par défaut (aucune persistance) | N/A |
| Clavier | Poignée focus, flèches ↑↓←→ | Taille ajustée par pas fixe, clampée | N/A |
| Reduced motion | Drag avec `prefers-reduced-motion` | Resize fonctionne, déjà sans ressort (durée 0) | N/A |

</frozen-after-approval>

## Code Map

- `plume/src/features/copilote/CopiloteSheet.tsx` -- composant unique. `PANEL_W`/`PANEL_H` (47-48), record `SIZE` par phase (414-418), `motion.div` racine (style width/height = `SIZE[phase]`, 457-471), `motion.div` contenu interne (style figé `PANEL_W×PANEL_H`, 489). Tout le resize vit ici.
- `plume/src/design/tokens.ts` -- `colors` (poignée = contour encre/menthe, jamais mauve).

## Tasks & Acceptance

**Execution:**
- [x] `plume/src/features/copilote/CopiloteSheet.tsx` -- État en-session `panelSize: {w:number; h:number} | null` (null = défaut figé). À l'ouverture du drag, semer depuis la boîte réellement rendue (`getBoundingClientRect`) si null. Calculer le `SIZE` ouvert depuis `panelSize` quand non-null, sinon garder `PANEL_W`/`PANEL_H`. Propager la même taille au `motion.div` contenu interne.
- [x] `plume/src/features/copilote/CopiloteSheet.tsx` -- Poignée de resize (coin haut-gauche, visible/active seulement `isOpen`). Gestion par Pointer Events : `pointerdown` → `setPointerCapture` + seed taille ; `pointermove` → `newW = startW + (startX - clientX)`, `newH = startH + (startY - clientY)`, clamp [min,max] ; `pointerup`/`pointercancel` → fin. Flag `dragging` → transition `layout` à durée 0 pendant le drag, ressort restauré après. Bornes : min ≈ 18rem×20rem ; max = `innerWidth - 48` × `innerHeight - 120` (préserve marges d'ancrage).
- [x] `plume/src/features/copilote/CopiloteSheet.tsx` -- A11y : poignée focusable, `aria-label="Redimensionner le copilote"`, `onKeyDown` flèches → ajuste par pas fixe (24px, l'échelle d'espacement) avec le même clamp. (role="slider" écarté : sans `aria-valuenow` complet ce serait un mensonge a11y ; bouton + aria-label honnête retenu.)

**Acceptance Criteria:**
- Given le panneau ouvert, when je drague la poignée haut-gauche, then la fenêtre s'agrandit/rétrécit en suivant le pointeur sans rompre l'ancrage bas-droite ni saccader le morph.
- Given une taille custom, when je ferme puis rouvre le copilote dans la même session, then il rouvre à cette taille.
- Given une taille custom, when je recharge la page, then la taille par défaut revient.
- Given la poignée focus clavier, when j'appuie sur les flèches, then la taille change par pas et reste clampée.

## Design Notes

Le `motion.div` racine MORPHE via Motion `layout` (mesure px → anime par transform). Un drag doit écrire des **pixels** dans `panelSize` et neutraliser le ressort `layout` le temps du geste (sinon la boîte « rattrape » le pointeur avec retard). Réutiliser le pattern existant `reduceMotion ? {duration:0} : spring` en y ajoutant la condition `dragging`. La poignée s'inscrit dans le contour encre du panneau (pas de mauve : ce n'est pas une action métier, c'est une affordance de chrome).

## Verification

**Commands:**
- `pnpm --dir plume lint` -- expected: 0 erreur (3 barrières ESLint incluses)
- `pnpm --dir plume tsc --noEmit` -- expected: 0 erreur de types

**Manual checks:**
- Dev server : ouvrir le copilote, draguer le coin haut-gauche → la fenêtre suit, l'anim d'ouverture/fermeture reste fluide ; fermer/rouvrir conserve la taille ; reload la remet par défaut ; Tab jusqu'à la poignée + flèches redimensionne.

## Suggested Review Order

**État & calcul de la taille (cœur)**

- Entrée : state en-session `panelSize` (px) qui override la taille CSS figée.
  [`CopiloteSheet.tsx:98`](../../plume/src/features/copilote/CopiloteSheet.tsx#L98)

- Clamp central : bornes min lisibles + viewport moins marges d'ancrage.
  [`CopiloteSheet.tsx:108`](../../plume/src/features/copilote/CopiloteSheet.tsx#L108)

- Dérivation rendu : `openW/openH` (px resizé sinon défaut) → `SIZE` + ressort coupé pendant le drag.
  [`CopiloteSheet.tsx:518`](../../plume/src/features/copilote/CopiloteSheet.tsx#L518)

**Geste de resize**

- Drag par Pointer Events (capture, delta inversé pour l'ancrage bas-droite).
  [`CopiloteSheet.tsx:168`](../../plume/src/features/copilote/CopiloteSheet.tsx#L168)

- A11y clavier : flèches + garde `phase` anti-morph (patch review).
  [`CopiloteSheet.tsx:204`](../../plume/src/features/copilote/CopiloteSheet.tsx#L204)

- Re-clamp au resize de la fenêtre — anti-débordement hors écran (patch review).
  [`CopiloteSheet.tsx:229`](../../plume/src/features/copilote/CopiloteSheet.tsx#L229)

**UI (périphérie)**

- Poignée coin haut-gauche : chrome (encre, jamais mauve), focusable, grip SVG.
  [`CopiloteSheet.tsx:610`](../../plume/src/features/copilote/CopiloteSheet.tsx#L610)
