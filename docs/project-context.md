---
project_name: 'Plume (repo job-pipeline)'
user_name: 'Monsieur'
date: '2026-06-16'
sections_completed: ['technology_stack', 'domain_naming', 'legal_privacy_archi', 'design_system', 'composer', 'mvp_scope_gotchas']
existing_patterns_found: 0
status: 'complete'
rule_count: 50
optimized_for_llm: true
---

# Project Context for AI Agents — Plume

_Règles et patterns critiques à suivre lors de l'implémentation. Focalisé sur les
détails non évidents qu'un agent IA pourrait manquer. Source : PRD + UX finaux
(`docs/planning-artifacts/`). En cas de conflit PRD↔UX, l'UX (plus récent) prime._

> **Greenfield.** Le code Python (`src/`, `main.py`, ingestion e-mail) est l'**ancien**
> `job-pipeline` (cold apply) — **abandonné, ne pas s'en inspirer**. Plume = web app PWA
> d'outreach réseau (recherche d'emploi via messages au réseau perso).

---

## Technology Stack & Versions

**Stack FIGÉE** par l'architecture ([`docs/planning-artifacts/architecture.md`](planning-artifacts/architecture.md),
2026-06-16). Versions vérifiées juin 2026 ; source de vérité = `architecture.md` (ce résumé en dérive).

- **Next.js 16** (App Router, Turbopack, React 19.2) — PWA mobile-first ; wrap **Capacitor** plus tard.
- **TypeScript** strict · **pnpm**.
- **Turso** (libSQL) + **Drizzle ORM** (`drizzle-orm/libsql`, dialect `turso`, `sqliteTable`) — déjà en place côté infra.
- **Tailwind CSS v4** (tokens design-system via `src/design/tokens.ts`).
- **Auth.js v5** (next-auth beta), provider **Google** — clé d'identité opaque (email = attribut, jamais PK).
- **Claude API** (`@anthropic-ai/sdk`, **serveur-only**) — Haiku par défaut, Opus en option ; few-shot **en contexte**,
  jamais de fine-tuning ; prompt caching sur le préfixe stable.
- **Serwist** (`@serwist/next`, PWA, compatible Turbopack — successeur de next-pwa).
- **Zustand** (état client) + **Dexie** (offline IndexedDB) + **Zod 4** (validation aux frontières).
- **Web Push** (`web-push`/VAPID via service worker ; iOS exige la PWA à l'écran d'accueil).
- **Hébergement Vercel** + **Vercel Cron** (scheduler relances) · CI GitHub Actions.

**Règle (norme projet « ne rien deviner ») :** la stack est tranchée — suivre `architecture.md` à la
lettre (invariants, frontières `.server.ts`/`domain/`/porte `db.forUser`, 3 barrières ESLint). Pour tout
choix NON couvert par l'archi : **TODO explicite + demander** (jamais deviner).

---

## Critical Implementation Rules

### Modèle de domaine & nommage

- **Produit = « Plume »** ; repo technique = `job-pipeline` (≠ — ne pas confondre).
- **UI, microcopy ET commentaires de code = français.** Pas de fallback anglais.
- Vocabulaire canonique des entités (réutiliser tel quel) :
  `Contact`, `Message`, `Canal` (LinkedIn/Email/WhatsApp/SMS), `Statut`
  (brouillon → envoyé → vu → répondu/ignoré), `Composeur`, `Voix`, `Few-shot voix`,
  `Seed de voix`, `Tell d'IA`, `Score de froideur`, `File du jour`, `Relance`,
  `Zéro-fuite` (garantie : aucune `Relance` due n'est oubliée).
- `Score de froideur` : jamais contacté · frais (< 30 j) · tiède (30-90 j) · froid (> 90 j).
- `Opportunité` (poste @ entreprise reliant N `Contact`/`Message`) = **v1, absent du MVP**.
- Texte d'un `Message` **figé après « Envoyé »** (read-only + bouton Modifier discret).

### Légal / Privacy / Architecture SaaS-ready

- **Pas de scraping LinkedIn** (CGU/ban). Import = CSV officiel LinkedIn + ajout
  manuel/rapide. **Pas d'auto-send LinkedIn.**
- **Envoi = humain** : copier → marquer « Envoyé ». **Aucun chemin d'auto-send au MVP**
  (ni timer, ni « envoi après approbation »).
- **Privacy first-class** : données scopées par user, zéro partage tiers, export +
  suppression à la demande (formats ouverts), transparence sur les appels Claude.
- **`user_id` dès J1, scopé au niveau REQUÊTE** : toute lecture/écriture
  (`Contact`/`Message`/`Relance`) filtrée par l'utilisateur authentifié (Turso mono-base
  partagée au MVP). **Aucune query sans clause `user_id`.**
- **Secrets jamais en dur ni dans le repo** (clé Claude API, token Turso) → variables
  d'env **serveur** uniquement, jamais `NEXT_PUBLIC_*`.
- **Appels Claude exclusivement côté serveur** (route handler / server action) ; la clé
  ne transite jamais au client PWA, aucun appel direct browser → Anthropic.
- **`Relance` (zéro-fuite) = 2 couches :**
  1. **In-app** (le filet) : `File du jour` dérivée à la lecture des échéances + compteur
     visible. Suffit à la garantie zéro-fuite.
  2. **Push** : Web Push best-effort. **Topologie tranchée (archi) = Vercel Cron managé →
     route handler authentifié (`CRON_SECRET`) → `next_actions` dues → `web-push`/VAPID.**
     **Build différé au 1er user non-founder** ; au MVP n'implémenter QUE la couche in-app
     (le filet suffit). `next_actions.due_at` doit rester lisible serveur-side.
- **`Relance` idempotente** : une `Relance` unique par `Message` non répondu (contrainte
  d'unicité) ; rejouer le scheduler ne crée ni doublon ni double notification ;
  « répondu/ignoré » clôt de façon idempotente.

### Design system — règles UI (à respecter pour tout code d'interface)

- **Palette (hex exacts) :**
  - Fond app `#E9F3EF` · carte `#FBFEFD` · champ/note `#EDF6F2`.
  - Encre (texte + contour illu) `#2E3F3B` · texte 2ndaire `#5F726D` · hint/placeholder `#9DB5AD`.
  - Menthe (marque, bordures) `#7FBEAF` · menthe-deep `#4E8978` · menthe-offset `#CADFD8`.
  - **Mauve `#B391AC` = couleur d'ACTION UNIQUEMENT** (boutons primaires, états actifs) ·
    mauve-deep `#876585` (offset) · mauve-tint `#ECE2EA` (chips).
  - Froideur (jamais alarmiste) : jamais contacté `#C9C2D6` · frais `#8FBCA8` ·
    tiède `#CBA7C0` · froid `#A7BCC6`.
- **Typo : Fraunces** (titres, noms, chiffres clés ; italique = citations) **+ Quicksand**
  (corps, boutons, labels). **JAMAIS Inter / police système / emoji en icône.**
- **Profondeur = contour plein ~2.5px + hard offset. Le flou du box-shadow = TOUJOURS 0.**
  Zéro ombre molle, zéro gradient, zéro glassmorphism (= signature « app IA générique »
  à fuir). Offsets exacts : boutons `0 6px 0 0` · bottom-sheet `0 -7px 0 0` · châssis
  téléphone `13px 14px 0 0` (pas l'offset générique de 4px).
- **Rayons EXACTS** : cartes 16px · **deck 32px** · groupes/boutons/champ 22px · petits
  conteneurs (canaux/segments/icon-btn) 11-16px · bottom-sheet top 34px.
- **Échelle d'espacement FIGÉE** : `4 / 8 / 12 / 16 / 22 / 24` (jamais de valeur hors-pas,
  ni 10/20/32) ; gouttière + marge écran 24px ; gap galerie Réseau 12-18px.
- **Illustration maison = l'âme.** Assets canoniques figés dans
  `mockups/plume-illustration-assets.svg` (plume-mascotte + avatars-blobs). **Recolorer
  (fill froideur + ombre interne `-shade`), JAMAIS redessiner par écran.**
- **Rotations EXACTES (fait-main, anti-template)** : cartes du deck `rotate(3.2deg)` /
  `rotate(-2deg)` · mascotte `rotate(-14..-16)`. **Jamais de symétrie parfaite.**
- **Doublage a11y OBLIGATOIRE** : tout signal porté par la couleur DOIT être doublé par
  texte/label — coldtag froideur (« Tiède »), canal actif = libellé, onglet actif =
  label + soulignement + pastille. **La couleur n'est jamais le seul signal.**
- **3 onglets max : Aujourd'hui · Réseau · Réglages** (Stats = v1). **`Composeur` =
  bottom-sheet en flow, PAS un onglet.**
- Aujourd'hui = **deck swipe** : horizontal = feuilleter · ↑ = écrire · ↓ = plus tard.
  Réseau = **galerie d'avatars triée par froideur** (PAS un tableau/CRM).
- **Composeur (UI)** : sélecteur 4 canaux (actif = aplat mauve + offset, autres = contour ;
  canal préféré pré-coché) · segment Rapide/Soigné (actif mauve) · **pill tokens menthe
  affichée APRÈS génération seulement** · caret du champ mauve · bouton secondaire = ghost
  menthe (transparent, offset menthe-doux).
- Erreurs : teinte douce de la famille, **jamais de rouge alarme**.

### Composeur « ta voix » — le moat (différenciateur unique)

- **Champ unique = source de vérité.** Le texte affiché EST le message. **Vide par défaut**
  (jamais pré-généré).
- **Bouton intelligent** : champ vide → **Générer** (idée → message) ; texte présent →
  **Améliorer** (réécrit en place, garde idées + voix, n'importe jamais un ton étranger,
  adapte au canal).
- **Few-shot voix = cœur du moat** : injection en contexte des `Message` passés
  (**PAS de fine-tuning**). Apprentissage continu : tout message envoyé alimente le corpus
  (consentement CGU, pas d'opt-out). **« Mode sans-IA » supprimé (UX #18/#19).**
- **Seed de voix optionnel** à l'onboarding (coller 1-2 anciens messages) ; « Passer »
  évident ; ton neutre par défaut sinon.
- **Génération canal-aware** : LinkedIn court · Email structuré · WhatsApp/SMS ultra-court.
- **Blacklist des Tells d'IA appliquée en POST-TRAITEMENT DÉTERMINISTE côté serveur**
  (`sanitize()` : remplace le tiret cadratin `—`/`–`, NFC, trim) **PUIS validation** — le
  prompt seul ne suffit pas, le code strippe et re-valide avant de renvoyer. Tells :
  tiret cadratin, formule ampoulée, emoji cliché, ton lisse/corporate. « Tout doit
  sentir l'humain. »
- **`sanitize()` passe AUSSI à l'import** (seeds, corpus, anciens messages) avant écriture BDD.
- Appels Claude **serveur-only** (cf. Architecture). **Compteur de tokens** (pill) après
  génération. Choix modèle Rapide/Soigné (Haiku/Opus) compact, jamais bavard.
- **Revue humaine obligatoire** avant tout envoi. Copier = commit, puis marquer « Envoyé ».
  Aucun envoi automatique.

### Scope MVP & pièges à éviter

- **MVP (IN)** : `Contact` (manuel + ajout rapide multiple + backfill CSV async non
  bloquant) · `Composeur` · `Voix` (seed optionnel + apprentissage) · `Message` & `Statut`
  (manuel, figé après Envoyé) · Aujourd'hui (file priorisée) · `Relance` zéro-fuite (J+5
  défaut, in-app + push best-effort, confirmation 1-tap) · PWA + Web Push · Google OAuth ·
  Privacy.
- **Frontière dure** : **onboarding < 2 min sans dépendre du CSV** (FR-33) — tout parcours
  d'entrée doit atteindre la `File du jour` + un 1er message en moins de 2 min.
- **Différé v1** : Gmail scan + statut auto e-mail · envoi direct (Email/WhatsApp/SMS) ·
  module `Opportunité`/pipeline · onglet Stats + analytics · gamification · RAG avancé ·
  extension navigateur LinkedIn.
- **Supprimé — NE PAS réintroduire** : « Mode sans-IA » (UX #18/#19 ; **PRD FR-15 supprimé
  2026-06-16, #30 clos**) · brouillon pré-généré · prédiction de chances.
- **Pièges agents IA :**
  - Champ `Composeur` **vide par défaut** (jamais pré-générer).
  - Chaînes FR en dur au MVP single-user (pas de lib i18n) ; **centraliser les libellés
    générés / `sanitize()` dans `lib/copy.ts`** (réutilisable serveur).
  - Onboarding mentionne Gmail → le **retirer/désactiver** (Gmail = v1).
  - Asset SVG canonique → copier dans `public/plume-illustration-assets.svg`, référencer
    par path, **recolorer via CSS, jamais régénérer/inliner**.
  - **`Voix` = risque n°1** : SM-1 = distance d'édition médiane **< 20 %** (généré vs
    envoyé), mesurée via le couple conservé (FR-7), sur 20-30 vrais messages.
  - Free tier SaaS = **plafonné** (quota), sinon l'API Claude mange la marge.

---

## Guide d'usage

**Pour les agents IA :**

- Lire ce fichier AVANT d'implémenter le moindre code.
- Suivre TOUTES les règles à la lettre ; en cas de doute, choisir l'option la plus
  restrictive et poser un **TODO explicite** plutôt que deviner.
- En cas de conflit entre sources, l'**UX (le plus récent)** prime sur le PRD.
- Mettre ce fichier à jour quand un nouveau pattern stable émerge.

**Pour les humains :**

- Garder ce fichier lean, focalisé sur ce dont les agents ont besoin.
- **Stack recalée (2026-06-16)** : versions réelles figées (cf. `architecture.md`), TODO scheduler
  push levé (topologie Vercel Cron). Reste différé : multi-tenancy Turso (mono-base au MVP, DB-per-user au SaaS).
- **Réconciliation #30 CLOSE (2026-06-16)** : FR-15 « Mode sans-IA » supprimé du PRD, aligné
  sur l'UX (#18/#19) ; corpus = tous les messages envoyés, aucune exclusion.
- Revue périodique : retirer les règles devenues évidentes.

_Dernière mise à jour : 2026-06-16._
