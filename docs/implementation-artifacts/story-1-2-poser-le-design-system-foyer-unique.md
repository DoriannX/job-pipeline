# Story 1.2 — Poser le design-system (foyer unique)

- **Epic :** 1 — Socle, identité & design-system
- **Statut :** review (dev terminé, suite verte + app 200 au runtime)
- **Branche :** `claude/kind-hypatia-oaxgri` (base = `origin/main`)

## User story

As a fondateur, I want les tokens, l'illustration maison et le mini-set d'icônes
centralisés, So that toute l'UI dérive d'une source unique conforme à la DA (anti look-IA).

## Acceptance Criteria → preuve

1. **`src/design/tokens.ts` = foyer unique** — palette hex exacte (menthe/mauve = action ;
   froideur 4 états + `-shade`), typo (Fraunces display + Quicksand corps, ramp 32/30/16/18-20/12),
   rayons exacts, espacement `4/8/12/16/22/24`, offsets durs (UX-DR1, UX-DR19). **Tailwind v4
   `@theme` (globals.css) consomme ces valeurs** ; un test de parité échoue à la moindre dérive
   et interdit toute couleur hex hors du foyer.
2. **`<Plume name tint/>`** — asset canonique copié dans `public/plume-illustration-assets.svg` ;
   la plume-mascotte et les avatars-blobs se **recolorent** (fill froideur + `-shade` + joues)
   **sans être redessinés** (UX-DR2). Tracé partagé via sprite same-document + `<use href="#…">`.
3. **Mini-set d'icônes maison** (`src/design/icons.tsx`) — 4 canaux, 3 onglets, `+`, recherche,
   étincelle / double-étincelle, flèches de gestes, chevron, copier, modifier ; stroke 2.5px encre
   (`currentColor`), grille 24px, **aucune lib d'icônes** (UX-DR24).
4. **Flou = 0** — test dédié : tout offset (tokens) a un rayon de flou nul ; aucune déclaration
   `box-shadow` à flou non nul dans `src/`. Inter / police système / emoji-icône bannis.

**Vérif :** `typecheck` · `lint` · `test` (5/5) · `build` · `pnpm dev` → `/` **HTTP 200**.

## Décision technique (écart assumé vs architecture)

L'archi décrivait `<use href="/plume-illustration-assets.svg#name">` (fichier **externe**). Or le
blob exige 3 tons recolorables via variables CSS, qui **ne traversent pas de façon fiable** un
`<use>` externe (contexte de document séparé). Choix : **sprite inline monté une fois**
(`PlumeSprite`, dans `layout.tsx`) → propagation fiable des `--plume-*`, UN tracé partagé. La copie
verbatim dans `public/` reste l'artefact source de vérité (exigé par l'AC).

## Hors périmètre

Thème sombre (UX-DR13, structuré mais non implémenté), primitives `components/ui/`
(Button/ColdTag/BottomSheet — arrivent avec les features), coquille 3 onglets (1.4).
