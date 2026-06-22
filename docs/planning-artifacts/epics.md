---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - docs/planning-artifacts/prds/prd-job-pipeline-2026-06-15/prd.md
  - docs/planning-artifacts/prds/prd-job-pipeline-2026-06-15/addendum.md
  - docs/planning-artifacts/architecture.md
  - docs/planning-artifacts/diagrams.md
  - docs/planning-artifacts/ux-designs/ux-job-pipeline-2026-06-15/DESIGN.md
  - docs/planning-artifacts/ux-designs/ux-job-pipeline-2026-06-15/EXPERIENCE.md
  - docs/project-context.md
project_name: 'Plume (repo job-pipeline)'
user_name: 'Monsieur'
date: '2026-06-16'
---

# Plume (repo job-pipeline) - Epic Breakdown

## Overview

Découpage complet en epics et stories pour **Plume** (PWA d'outreach réseau, composeur « ta voix » few-shot). Décompose les exigences du PRD, de l'UX (DESIGN + EXPERIENCE) et de l'Architecture en stories implémentables. En cas de conflit PRD↔UX, l'UX (plus récent) prime. Source de vérité technique = `architecture.md`.

> **Révision 2026-06-16 (post party-mode).** Ex-Epics 3 (Composeur) et 4 (Messages) **fusionnés** en un seul Epic 3 « Le moat, bout en bout » : la boucle générer → envoyer → mesurer (SM-1) ne doit pas être coupée entre deux epics, sinon le moat est *ressenti* sans être *mesuré*. Ajout d'une story d'evals figés et d'un **jalon GO/PIVOT R1** clôturant l'Epic 3. Epics suivants renumérotés (7 → 6 epics).

## Requirements Inventory

### Functional Requirements

*Source : PRD §4 (FR-1..FR-34, numérotation globale). FR-15 SUPPRIMÉ (#30 clos, 2026-06-16) — conservé pour traçabilité, non implémenté.*

**Contacts / Réseau (4.1)**
- **FR-1** : Import CSV LinkedIn en backfill asynchrone, optionnel — l'app est pleinement utilisable avant tout import ; parse + crée/MAJ Contact par ligne ; dédup/fusion (pas de doublon) ; ligne malformée ignorée sans bloquer + compte-rendu (N créés/fusionnés/ignorés).
- **FR-2** : Ajout et édition manuelle d'un Contact (min. un nom ; immédiatement actionnable → Composeur ; édition sans casser la timeline ; suppression confirmée irréversible du Contact ou d'un Message).
- **FR-34** : Ajout rapide multiple — coller N lignes (« Nom, Entreprise » best-effort) → N Contacts en une action, dédupliqués contre l'existant et un CSV ultérieur.
- **FR-3** : Fiche Contact = timeline chronologique complète des Messages (date, Canal, Statut) ; ouvre le Composeur en flow.
- **FR-4** : Score de froideur dérivé par récence du dernier Message — jamais contacté (état distinct) / frais < 30 j / tiède 30-90 j / froid > 90 j.
- **FR-5** : Liste et tri du Réseau — tri par froideur et par date du dernier Message ; filtre par Statut du dernier Message.

**Composeur « ta voix » — le moat (4.2)**
- **FR-6** : Champ unique source de vérité — le texte affiché EST le Message ; vide par défaut (aucun brouillon pré-généré).
- **FR-7** : Générer un Message dans la Voix via API Claude (respecte Canal FR-9 + Liste noire FR-11) ; fallback échec API / hors-ligne = champ éditable, écriture/envoi manuels, rien perdu ; conserve le couple (généré, envoyé) pour SM-1.
- **FR-8** : Améliorer en place un texte écrit à la main (garde idées + Voix, ne remplace pas par un hors-sujet, reste éditable).
- **FR-9** : Génération canal-aware (LinkedIn court / Email structuré / WhatsApp-SMS très court).
- **FR-10** : Few-shot voix minimal — injection en contexte des Messages passés (+ Seed), pas de fine-tuning ; ton neutre par défaut sans exemples (jamais d'échec).
- **FR-11** : Liste noire des Tells d'IA appliquée à chaque génération (zéro tiret cadratin ; formules ampoulées absentes/signalées avant envoi).
- **FR-12** : Revue humaine obligatoire — aucun chemin produit n'envoie un Message sans action humaine explicite.
- **FR-13** : Composeur en flow — s'ouvre depuis un Contact ou une carte, jamais comme onglet ; porte toujours le contexte du Contact.
- **FR-14** : Choix du modèle — Haiku par défaut, Opus sélectionnable, choix persistant par utilisateur.
- **FR-15** : ~~Mode sans-IA par Contact~~ — **SUPPRIMÉ** (#30 clos, 2026-06-16, aligné UX #18/#19). Pas de mode ni toggle. Ne rien implémenter.
- **FR-35** : Historique de conversation par Contact (ajout 2026-06-21) — textarea libre brut, saisissable à la création du Contact et éditable ensuite ; quand présent, injecté borné au prompt du Composeur pour une génération **en continuité** (rebondit sur le dernier point en suspens) ; champ intention reste optionnel ; pas de parsing de format ; génération = Composeur, jamais le Copilote.

**Apprentissage de la Voix (4.3)**
- **FR-16** : Seed de voix optionnel à l'onboarding (coller des messages passés) ; « Passer » évident ; Seed fourni utilisé immédiatement par le Few-shot.
- **FR-17** : Apprentissage au fil de l'eau — tout Message marqué Envoyé (généré-édité OU tapé main) alimente le corpus ; aucune exclusion par Contact.

**Messages et Statut (4.4)**
- **FR-18** : Enregistrer un Message (date, Canal, Statut, texte figé) dans la timeline du Contact.
- **FR-19** : Cycle de Statut d'un tap (brouillon → envoyé → vu → répondu/ignoré) ; vu/répondu/ignoré saisis manuellement au MVP.
- **FR-20** : Verrou après Envoyé — texte read-only ; bouton Modifier discret pour rouvrir.
- **FR-21** : Copier puis marquer Envoyé pour tout Canal (presse-papier + proposition de marquer Envoyé) ; aucune intégration d'envoi sortante au MVP.

**File du jour — Aujourd'hui (4.5)**
- **FR-22** : Écran par défaut au lancement = Aujourd'hui / File du jour (aucune navigation pour voir la 1re action).
- **FR-23** : File priorisée — relances dues d'abord (par retard) puis nouveaux Contacts par froideur ; état vide explicite (pas d'écran blanc).
- **FR-24** : Action-first — une action à la fois ; envoyé / skip / snooze par bouton ou swipe ; traiter une carte fait monter la suivante.

**Relances zéro-fuite (4.6)**
- **FR-25** : Next-action automatique — Relance datée (J+5 défaut, ajustable) sur Message envoyé non répondu ; répondu/ignoré clôt automatiquement et idempotemment ; confirmation 1-tap (« X t'a répondu ? ») ; décaler/annuler possible.
- **FR-26** : Notification push de Relance (Web Push via service worker) ; iOS exige l'ajout PWA à l'écran d'accueil (signalé).
- **FR-27** : Compteur zéro-fuite — relances dues et en retard visibles distinctement ; garantie délivrée in-app indépendamment du push (push = best-effort).

**Coquille PWA, Auth, Privacy (4.7)**
- **FR-28** : PWA installable (service worker, mobile + desktop, sans store) ; front Capacitor-ready.
- **FR-29** : Auth Google OAuth + toutes données scopées par user_id (aucune donnée lisible hors du périmètre user ; user_id sur Contacts/Messages/Relances).
- **FR-30** : Export des données à tout moment en format ouvert (JSON/CSV : Contacts + Messages).
- **FR-31** : Suppression des données à tout moment.
- **FR-32** : Transparence API — l'app explicite ce qui est transmis à Claude et quand (générer/améliorer envoie le contexte ; taper sans générer ne transmet rien).
- **FR-33** : Onboarding < 2 min (Google + Seed optionnel + 1ers Contacts manuel/rapide) **sans dépendre du CSV** ; atteint la File du jour + 1er Message, aucune étape bloquante.

### NonFunctional Requirements

*Source : PRD §11 + invariants d'architecture.*

- **NFR-1 — Perf Composeur** : premier texte perçu quasi instantané, cible < 5 s avant le 1er token (few-shot en contexte + streaming SSE) ; timeout UX doux à 5 s, spinner infini interdit.
- **NFR-2 — Archi SaaS-ready** : entités scopées par user_id dès J1, clé d'identité opaque (email Google = attribut, jamais PK), sans sur-ingénierie multi-tenant prématurée.
- **NFR-3 — Mobile-first strict** : tout parcours utilisable au pouce sur téléphone (colonne unique, cibles tactiles confortables).
- **NFR-4 — Privacy first-class** : données scopées user, zéro partage tiers, export + suppression (formats ouverts), transparence API, pas d'entraînement sur données user, rétention limitée côté API.
- **NFR-5 — Coût maîtrisé** : Haiku par défaut, compteur de tokens par user, cible quelques dizaines de centimes à 1-2 €/mois/utilisateur actif.
- **NFR-6 — Résilience** : import partiellement invalide ne bloque pas ; Composeur dégradé hors-ligne (champ éditable, brouillon jamais perdu).

### Additional Requirements

*Exigences techniques issues de l'Architecture qui impactent le découpage. Source : `architecture.md`, `diagrams.md`, `project-context.md`.*

- **AR-1 — STARTER / 1re story d'implémentation** : initialiser le projet via `pnpm create next-app@latest plume --typescript --tailwind --app --src-dir --eslint --import-alias "@/*" --use-pnpm`, puis ajouter Drizzle ORM + `@libsql/client` (dialect `turso`), Auth.js v5 (`next-auth@beta` + `@auth/drizzle-adapter`, provider Google), Serwist (`@serwist/next`), `@anthropic-ai/sdk`. Stack figée : Next.js 16 (App Router/Turbopack, React 19.2), TS strict, Tailwind v4, pnpm. **Cet init DOIT être la première story.**
- **AR-2 — Porte de données unique** : `db.forUser(userId)` (`lib/db/scoped.ts`) seul accès aux données ; zéro query Drizzle nue (invariant #1) ; filet de test cross-tenant (2 users, zéro fuite par endpoint).
- **AR-3 — `sanitize()`** (`lib/copy.ts`, server-only) versionné, idempotent, ordonné, borné (`MAX_SANITIZE_RETRIES=2`) ; couverture Unicode (em-dash U+2014 + cousins, anti-emoji `\p{Extended_Pictographic}`) ; property-test obligatoire ; appliqué à la génération ET à l'import ; `sanitize_version` stockée au passage Envoyé.
- **AR-4 — Idempotence en base** : contrainte d'unicité + `INSERT ... ON CONFLICT DO NOTHING` (import, `uq_next_actions_message_id`) ; jamais check-then-insert applicatif.
- **AR-5 — Machine à états Messages** : `brouillon → généré → envoyé → (relance due)`, transitions légales nommées ; `body` immuable applicativement après Envoyé (le gelé = sortie sanitizée finale).
- **AR-6 — Horloge injectée** : `now` paramètre injecté, jamais `Date.now()` en dur ; tout « Today »/échéance dérivé de `(now, user.timezone)` ; `timezone` = propriété user dès J1.
- **AR-7 — Claude = dépendance externe synchrone serveur-only** : budget tokens borné par compose ; stratégie de sélection few-shot **nommée** (prompt enfle avec le corpus → NFR-1) ; prompt caching sur le préfixe stable ; chemin de dégradation explicite (Générer/Améliorer grisés + message doux, champ éditable).
- **AR-8 — Observabilité du moat (SM-1)** : `generation_events` écrit **transactionnellement avec l'envoi** (`generated, sent, edit_distance, contact_id, raw_intent, prompt_version, model_id, voice_examples_ref, sanitize_version, tokens, timestamp`) + compteur tokens par user.
- **AR-9 — Modèle contact↔canal + dédup** (tranché avant schéma) : `contacts.canal_prefere` (enum) + `contacts.handles` (JSON `{linkedin,email,phone,whatsapp}`) ; clé dédup = email normalisé sinon `nom_normalisé + entreprise_normalisée` ; collision → flag `merge_pending` + fusion manuelle ; `ImportReport {created, merged, skipped, reasons}`.
- **AR-10 — Validation Zod 4** à chaque frontière (route handler, server action, ligne CSV, formulaire) via `drizzle-zod` ; une donnée non validée n'entre jamais en BDD.
- **AR-11 — Composeur streaming** : `POST /api/composer` en ReadableStream/SSE token-par-token ; FSM `idle|generating|ok|error|offline` ; génération annulable.
- **AR-12 — Offline / optimistic** : Dexie (IndexedDB) — brouillon persisté à chaque frappe **avant tout réseau** ; outbox queue rejouée à la reconnexion (`lib/offline/sync.ts` pur) ; « Améliorer » garde l'ancienne version (undo) ; autorité serveur sur Sent (immuable, rejet 409).
- **AR-13 — Frontières server/client durcies** : suffixe `.server.ts` + `import 'server-only'` (claude/push/prompt/few-shot/db.env/copy) ; 3 barrières ESLint (anthropic hors `lib/**` serveur ; query nue ; etc.) ; zone neutre `lib/domain/*` (enums source unique) importable client+server.
- **AR-14 — Scheduler relances (topologie lockée, build différé)** : Vercel Cron managé (`vercel.json`) → route handler authentifié (`CRON_SECRET`) → SELECT `next_actions` dues (`due_at` lisible serveur-side) → `web-push`/VAPID. **MVP = couche in-app (filet) seule** ; build push différé au **1er user non-founder** ; topologie + contrat `due_at` serveur-lisible verrouillés maintenant.
- **AR-15 — CI / qualité** : GitHub Actions (repo public) = lint + typecheck + vitest + playwright + check migrations drizzle ; trap PWA Serwist/webpack (`next build --webpack`) à valider en CI dès le 1er commit Serwist.
- **AR-16 — Provenance / base légale par Contact** : colonnes `source`, `imported_at`, `legal_basis` dès J1 (même vides) ; cadrage RGPD données tiers (effacement cross-user) avant SaaS (non bloquant MVP single-user).
- **AR-17 — Organisation par feature** : `src/features/{contacts,composer,messages,today,relances,voice,settings}` ; design-system à foyer unique `src/design/tokens.ts` ; tests co-localisés `*.test.ts(x)`, E2E dans `e2e/`.

### UX Design Requirements

*L'UX (DESIGN + EXPERIENCE) est un document d'entrée de première classe. Source : `DESIGN.md`, `EXPERIENCE.md`.*

- **UX-DR1 — Design tokens figés** (`src/design/tokens.ts` consommés par Tailwind v4 + CSS vars) : palette hex exacte (menthe d'eau, mauve = action uniquement, froideur 4 états + `-shade`), typo Fraunces (display) + Quicksand (corps), rayons exacts (carte 16 / deck 32 / bouton 22 / sheet 34), échelle d'espacement FIGÉE `4/8/12/16/22/24`, offsets durs exacts. **RÈGLE DURE : flou de tout `box-shadow` = 0.**
- **UX-DR2 — Illustration maison = l'âme** : asset SVG canonique (`plume-illustration-assets.svg`) copié dans `public/`, exposé via `<Plume name tint/>` — **recolorer (fill froideur + `-shade`), jamais redessiner par écran** ; rotations exactes fait-main (deck `3.2deg`/`-2deg`, mascotte `-14..-16`).
- **UX-DR3 — Bibliothèque de primitives** (`src/components/ui/`) : Button chunky primaire/secondaire, BottomSheet, ColdTag (couleur + label + ARIA), StatusMessage (ton doux), card-deck, channel-selector (4 canaux), segmented Rapide/Soigné, token-pill, chip-relance, tabbar (3 onglets), toggle, stepper, pager, champ unique, group-card, état vide serein.
- **UX-DR4 — Plancher a11y** : tout signal porté par la couleur **doublé** par texte/label + ARIA ; tout geste a un équivalent au tap ; anneau de focus net (cohérent flou=0) ; lecteur d'écran annonce rôle + état ; Reduce Motion respecté ; contraste AA (≥ 4.5:1 texte normal) vérifié au build.
- **UX-DR5 — Coquille de navigation** : 3 onglets max (Aujourd'hui · Réseau · Réglages) ancrés en bas ; Composeur = bottom-sheet **en flow** (monté une fois au-dessus des routes), jamais un onglet ; onboarding hors coquille.
- **UX-DR6 — Aujourd'hui = swipe-deck** : machine à états + undo + tri figé au chargement de session ; gestes (horizontal = feuilleter/choisir, ↑ = écrire, ↓ = plus tard) ; boutons chunky **doublent toujours** les gestes verticaux (Écrire / Plus tard) ; pager non interactif.
- **UX-DR7 — Réseau = galerie** : avatars-blobs en grille 3 colonnes triée par froideur (jamais un tableau/CRM) ; recherche + bouton « + » (manuel / rapide / CSV) ; fiche Contact = timeline narrative chronologique.
- **UX-DR8 — Composeur (comportements)** : champ unique source de vérité vide par défaut ; bouton intelligent Générer↔Améliorer (seuls libellé + picto changent) ; canal préféré pré-sélectionné, changeable 1 tap (réadapte ton/longueur) ; segmented Rapide/Soigné (par message) ; pill de tokens **après génération seulement** (tappable → détail) ; Copier = commit → proposer Marquer Envoyé ; régénérer (mini, secondaire).
- **UX-DR9 — Onboarding** : 5 écrans, < 2 min, une décision par écran (Google → Seed optionnel skippable → 1er contact prénom/nom → ajout écran d'accueil pour push → « Voir ma journée »). **Lien Gmail RETIRÉ du MVP** (v1). **Timing permission push = événement gagné** (après le 1er message envoyé / écran 4), jamais à l'init.
- **UX-DR10 — Microcopy** : français, warm, tutoiement, jamais culpabilisant ni « dashboard » ; centralisé dans `lib/copy.ts` ; zéro Tell d'IA dans tout texte d'interface ; états vides sereins (jamais d'écran blanc).
- **UX-DR11 — États interactifs** : focus / hover / pressed (offset réduit, pas de ripple ni flou) / disabled (offset supprimé, libellé `ink-hint`) ; bouton intelligent disabled pendant la génération ; erreur / hors-ligne = teinte douce de la famille, **jamais de rouge alarme** ; permission push refusée = aucun blocage, ré-invite douce.
- **UX-DR12 — Garanties d'expérience portées par l'archi** : streaming du Composeur (latence = spectacle) ; brouillon qui ne meurt jamais (IndexedDB, undo « Améliorer ») ; confirmation de relance 1-tap (« X t'a répondu ? » → Oui clôt / Non ouvre le composeur de relance) ; compteur zéro-fuite ; bloc Consommation (messages + tokens du mois, ton rassurant).

**Décisions UX tranchées (2026-06-16, ex-« lacunes à élicité » — validées par Monsieur).** Chacune est désormais une exigence testable :

- **UX-DR13 — Dark mode hors MVP** : thème clair unique ; `prefers-color-scheme` ignoré (forcé clair). Tokens structurés pour permettre un thème sombre ultérieur sans réécriture.
- **UX-DR14 — Signal erreur / hors-ligne** : bandeau **inline** sous le champ (jamais modale ni toast éphémère), teinte douce désaturée (`ink-soft`) + picto maison (plume posée), microcopy warm (« Pas de réseau, écris à la main, rien n'est perdu »). Bouton Générer/Améliorer grisé (disabled). **Jamais de rouge.**
- **UX-DR15 — Chargement génération** : le **streaming token-par-token EST le traitement de chargement** ; avant le 1er token, plume-mascotte qui « écrit » (micro-animation, respecte Reduce Motion) ; **pas de skeleton ni spinner** ; timeout doux à 5 s → message doux (NFR-1, AR-11).
- **UX-DR16 — Import CSV (compte-rendu + fusion)** : compte-rendu = **carte-bilan non bloquante** dans Réseau (« N ajoutés · N fusionnés · N à vérifier », ton neutre) ; doublons ambigus (`merge_pending`) = **file de revue 1-par-1** (esprit deck) → Fusionner / Garder séparés. Jamais bloquant le cold-start.
- **UX-DR17 — Confirmation de relance** : **variante de la carte courante** du deck (pas d'interstitiel) ; ajoute « X t'a répondu ? » + Oui/Non au-dessus des actions ; Oui → clôt la Relance (carte disparaît) · Non → ouvre le Composeur de relance. 1 tap.
- **UX-DR18 — Compteur zéro-fuite** : cadrage **positif**, pas de chiffre anxiogène (« Tout est repris, rien d'oublié » sur l'état vide) ; en cas de retard, chip mauve discret en haut du deck (« 2 à reprendre »). **Jamais de badge rouge.**
- **UX-DR19 — Ramp typo + espacement formalisés** : figés dans `src/design/tokens.ts` à partir des valeurs des mocks (display 32 / 30, body 16, bouton 18-20, label-caps 12 ; espacement `4/8/12/16/22/24`). **Aucune valeur hors-pas.** (Concrétise UX-DR1.)
- **UX-DR20 — Équivalent tap au feuilletage horizontal** : flèches latérales discrètes ‹ › (boutons) + **pager tappable** (tap sur un point → carte correspondante) + flèches clavier gauche/droite (satisfait UX-DR4).
- **UX-DR21 — Emplacement transparence API** : mention permanente dans **Réglages > Confidentialité** + micro-ligne **one-time** à la 1re génération + lien depuis la pill de tokens (→ détail consommation). **Pas dans le composeur** (zéro bloat). Réalise FR-32.
- **UX-DR22 — Affordance du cycle de statut post-Envoyé** : dans la timeline de la fiche, **tap sur la pastille de statut** → mini-sheet compact (vu / répondu / ignoré) ; la confirmation de relance dans le deck reste le chemin principal pour répondu/ignoré. Réalise FR-19.
- **UX-DR23 — État vide de premier lancement (réseau vide)** : **distinct** du « deck terminé » — plume-mascotte + CTA primaire « Ajouter un premier contact » (manuel/rapide), microcopy « Par qui on commence ? ». (Cold-start ≠ journée finie ; réalise FR-23 état vide + FR-33.)
- **UX-DR24 — Mini-set d'icônes canonique** : défini maintenant (stroke 2.5px encre, grille 24px, style fait-main, dans `src/design/`) couvrant : 4 canaux, onglets, `+`, recherche, étincelle (Générer) / double-étincelle (Améliorer), flèches de gestes, chevron, copier, modifier. **Aucune lib d'icônes.** (Sous-story du design-system, UX-DR3.)

### FR Coverage Map

*Garantit qu'aucun FR n'est oublié. FR-15 supprimé (#30 clos) — non mappé.*

- **FR-1** : Epic 2 — Import CSV LinkedIn en backfill asynchrone.
- **FR-2** : Epic 2 — Ajout / édition / suppression manuelle d'un Contact.
- **FR-3** : Epic 2 — Fiche Contact = timeline complète.
- **FR-4** : Epic 2 — Score de froideur dérivé.
- **FR-5** : Epic 2 — Liste et tri du Réseau.
- **FR-6** : Epic 3 — Champ unique source de vérité.
- **FR-7** : Epic 3 — Générer un Message (+ fallback hors-ligne, couple SM-1).
- **FR-8** : Epic 3 — Améliorer un Message en place.
- **FR-9** : Epic 3 — Génération canal-aware.
- **FR-10** : Epic 3 — Few-shot voix minimal.
- **FR-11** : Epic 3 — Liste noire des Tells d'IA.
- **FR-12** : Epic 3 — Revue humaine obligatoire (verrou d'envoi dans le même epic, story 3.6).
- **FR-13** : Epic 3 — Composeur en flow.
- **FR-14** : Epic 3 — Choix du modèle (défaut global exposé en Réglages, Epic 5).
- **FR-15** : ~~SUPPRIMÉ~~ (#30 clos, 2026-06-16) — non implémenté.
- **FR-16** : Epic 3 — Seed de voix optionnel (écran d'onboarding livré en Epic 5).
- **FR-17** : Epic 3 — Apprentissage au fil de l'eau (corpus = Messages envoyés ; effectif dès la story d'envoi 3.6).
- **FR-18** : Epic 3 — Enregistrer un Message (story 3.6).
- **FR-19** : Epic 3 — Cycle de Statut d'un tap (story 3.8).
- **FR-20** : Epic 3 — Verrou read-only après Envoyé (story 3.7).
- **FR-21** : Epic 3 — Copier puis marquer Envoyé (story 3.6).
- **FR-22** : Epic 4 — Écran par défaut = Aujourd'hui.
- **FR-23** : Epic 4 — File du jour priorisée (+ état vide premier lancement, UX-DR23).
- **FR-24** : Epic 4 — Action-first.
- **FR-25** : Epic 4 — Next-action automatique (Relance).
- **FR-26** : Epic 6 — Notification push de Relance (**DIFFÉRÉ**, 1er user non-founder).
- **FR-27** : Epic 4 — Compteur zéro-fuite (garantie in-app).
- **FR-28** : Epic 5 — PWA installable + offline (coquille fournie par Epic 1).
- **FR-29** : Epic 1 — Auth Google OAuth + scoping user_id.
- **FR-30** : Epic 5 — Export des données.
- **FR-31** : Epic 5 — Suppression des données.
- **FR-32** : **livré sur 2 epics** — Epic 5 (mention permanente Réglages > Confidentialité) + Epic 3 (micro-ligne one-time à la 1re génération, UX-DR21). Ne pas le traiter comme entièrement faisable en Epic 5 seul au sprint planning.
- **FR-33** : Epic 5 — Onboarding court < 2 min.
- **FR-34** : Epic 2 — Ajout rapide multiple.
- **FR-35** : Epic 3 — Historique de Contact injecté à la génération (story 3.10). _(extension FR-32 transparence : historique transmis à Claude explicité.)_

**Couverture : 33/33 FR actifs mappés** (FR-15 supprimé). NFR-1→E3 · NFR-2→E1 · NFR-3→E1+transverse · NFR-4→E5 · NFR-5→E3 · NFR-6→E2+E5.

## Epic List

*8 epics par valeur. Ordre = build order ; aucun epic ne requiert un epic futur pour fonctionner. Roadmap v1/v2/SaaS = PRD §14 (hors epics). Epic 7 (copilote) et Epic 8 (Campagne) issus de pivots post-MVP : voir leurs origines respectives ci-dessous.*

**Definition of done transverse :** chaque epic qui crée une table étend le **test cross-tenant 2-users** à cette table (AR-2) ; aucune query Drizzle nue (barrière ESLint).

### Epic 1: Socle, identité & design-system
Mettre en place le squelette déployable : un utilisateur installe Plume, se connecte via Google OAuth, et atterrit sur une coquille à 3 onglets (Aujourd'hui · Réseau · Réglages) navigable mais vide. Le design-system (tokens figés, illustration maison, primitives, plancher a11y) et les invariants non-négociables (scoping `user_id` via `db.forUser`, frontières `.server.ts`/3 barrières ESLint, horloge injectée, CI) sont verrouillés dès J1.
**FRs covered:** FR-29 (+ socle archi AR-1,2,6,10,13,15,16,17 ; UX-DR1,2,3,4,5,19,24 ; NFR-2,3)

### Epic 2: Mon réseau (Contacts)
Un utilisateur peuple et gère son réseau : ajout manuel, ajout rapide multiple (coller N lignes), et import CSV LinkedIn en backfill asynchrone non bloquant. Il parcourt une galerie d'avatars triée par froideur, ouvre une fiche Contact = timeline, et voit les liens qui refroidissent. Dédup propre (intra-fichier + vs-DB), compte-rendu d'import et résolution 1-par-1 des doublons ambigus.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-34 (+ AR-9 ; UX-DR7,16,23 ; NFR-6 import)

### Epic 3: Le moat, bout en bout — composer, envoyer, mesurer, historiser
L'epic qui **prouve le moat de bout en bout**, et le premier jalon dogfoodable. Depuis un Contact, l'utilisateur ouvre le Composeur en flow, note une idée dans un champ unique vide, et touche Générer — un Message ressort dans sa Voix (few-shot en contexte, canal-aware), sans Tells d'IA (`sanitize()` borné). Améliorer retravaille en place. Streaming < 5 s, fallback hors-ligne, seed + apprentissage, Haiku/Opus. Puis **Copier → marquer Envoyé** : le Message est figé, historisé dans la timeline, le Statut évolue d'un tap, et `generation_events` est écrit **transactionnellement avec l'envoi** (instrumentation SM-1). Revue humaine obligatoire, aucun auto-send. **À la fin de cet epic, le fondateur génère → envoie → mesure la distance d'édition sur de vrais messages ; un jalon GO/PIVOT R1 clôt l'epic.**
**FRs covered:** FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14, FR-16, FR-17, FR-18, FR-19, FR-20, FR-21 (+ AR-3,5,7,8,11,12 ; UX-DR8,14,15,21,22 ; NFR-1,5) — _FR-15 supprimé_

### Epic 4: Aujourd'hui & relances zéro-fuite (filet in-app)
L'utilisateur ouvre l'app directement sur la File du jour : un swipe-deck priorisé (relances dues d'abord, puis nouveaux Contacts par froideur), une action à la fois (écrire / plus tard / skip), gestes doublés de boutons. Une Relance datée (J+5) s'arme automatiquement sur tout Message envoyé non répondu ; la confirmation 1-tap (« X t'a répondu ? ») clôt ou relance idempotemment. La garantie zéro-fuite tient **in-app**, indépendamment de tout push.
**FRs covered:** FR-22, FR-23, FR-24, FR-25, FR-27 (+ AR-4 idempotence, cold-score dérivé ; UX-DR6,17,18,20) — _FR-26 (push) = Epic 6_

### Epic 5: PWA, hors-ligne, confidentialité & onboarding
Rendre l'app installable, résiliente, privée et accueillante : PWA installable (Serwist) + résilience hors-ligne complète (outbox Dexie rejouée à la reconnexion) ; Réglages (modèle par défaut, gestion de la Voix, bloc Consommation) ; privacy first-class (export format ouvert, suppression, transparence API) ; onboarding < 2 min en 5 écrans, sans dépendre du CSV, lien Gmail retiré.
**FRs covered:** FR-28, FR-30, FR-31, FR-32, FR-33 (+ AR-12 outbox ; UX-DR9,11 ; NFR-4,6)

### Epic 6: Relances push (DIFFÉRÉ — déclencheur = 1er user non-founder)
Notification push best-effort quand une Relance est due (Web Push/VAPID via service worker ; iOS exige la PWA à l'écran d'accueil). Topologie déjà verrouillée par l'architecture (Vercel Cron managé → route handler authentifié `CRON_SECRET` → `next_actions` dues → `web-push`). **Build hors sprint MVP** : déclenché au premier utilisateur non-fondateur, pas à une date. La garantie zéro-fuite (Epic 4) ne dépend pas de cet epic.
**FRs covered:** FR-26 (+ AR-14 Vercel Cron + web-push/VAPID)

### Epic 7: Copilote — surface IA unique (PIVOT dogfood 2026-06-21)
Le **copilote conversationnel** devient la **seule** surface d'IA : toute la rédaction assistée y vit (l'IA pose toujours des questions avant de rédiger, et à la création d'un contact) ; l'application ne porte plus que le **manuel**. Le composeur one-shot « Générer » disparaît comme concept. Cet epic intègre officiellement le copilote (construit hors-epics via `docs/specs/spec-copilote-phase-1/2/3`) à la structure BMad, **re-route** l'infra du moat (sanitize, few-shot, `generation_events`, envoi) et absorbe les findings du dogfood. **Séquencement vs Epic 4 à trancher au sprint-planning** (conditionne le Jalon R1, à redéfinir pour la voie conversationnelle).
**FRs covered:** FR-36, FR-37, FR-38, FR-39 (nouveaux) + re-route FR-7, FR-8, FR-9, FR-13, FR-14, FR-35 — _détail [sprint-change-proposal-2026-06-21-pivot-copilote.md](sprint-change-proposal-2026-06-21-pivot-copilote.md)_

### Epic 8: Campagne — copilote de sourcing piloté par objectif (qui contacter, et quand)
Répondre à la question qui vient *avant* la rédaction : **qui contacter maintenant, et pourquoi ?** Le founder donne un objectif en langage naturel au copilote ; après un mini-cadrage, une **campagne active** transforme l'objectif en une **liste du jour courte (3-5)**, chacun avec son *pourquoi* (scoring de pertinence LLM + signaux internes gratuits + signal job-change PDL borné), puis bascule en rédaction avec l'angle pré-chargé. Sourcing et rédaction **en un seul geste**, sur le réseau existant uniquement (jamais de scraping). Enrichment PDL **opt-in juste-à-temps, borné par l'objectif, à quota dur**. **Séquencé après la clôture d'Epic 7** (réutilise la surface copilote FR-36→39).
**FRs covered:** FR-40 → FR-55 (16 nouveaux) + NFR-7 → NFR-10 — _détail [prd-campagne-2026-06-22/prd.md](prds/prd-campagne-2026-06-22/prd.md)_

---

## Epic 1: Socle, identité & design-system

Mettre en place le squelette déployable : un utilisateur installe Plume, se connecte via Google OAuth, et atterrit sur une coquille à 3 onglets navigable mais vide. Le design-system (tokens figés, illustration maison, primitives, plancher a11y) et les invariants non-négociables (scoping `user_id` via `db.forUser`, frontières `.server.ts` / 3 barrières ESLint, horloge injectée, CI) sont verrouillés dès J1. Le test cross-tenant (2 users) est posé ici et **étendu à chaque nouvelle table** au fil des epics (definition of done).

### Story 1.1: Initialiser le starter & l'outillage

As a fondateur-développeur,
I want un projet Next.js 16 scaffoldé avec la stack figée et une CI verte,
So that toute story suivante démarre sur un socle conforme à l'architecture.

**Acceptance Criteria:**

**Given** un répertoire vide
**When** j'exécute `pnpm create next-app@latest plume --typescript --tailwind --app --src-dir --eslint --import-alias "@/*" --use-pnpm`
**Then** le projet démarre via `pnpm dev` (Turbopack) sur une page par défaut

**Given** le projet scaffoldé
**When** j'ajoute drizzle-orm, @libsql/client, drizzle-kit, next-auth@beta, @auth/drizzle-adapter, serwist, @serwist/next, @anthropic-ai/sdk, zod
**Then** `pnpm install`, `pnpm typecheck` et `pnpm lint` passent en mode strict
**And** l'arborescence par feature existe (`src/features/`, `src/lib/{db,domain}`, `src/design/`, `src/components/ui/`) conforme à l'architecture (AR-17)

**Given** un repo public
**When** je pousse
**Then** la CI GitHub Actions exécute lint + typecheck + test (placeholder) + check migrations drizzle et est verte (AR-15)
**And** aucun secret n'est committé ; `.env.example` liste TURSO_*, AUTH_GOOGLE_*, ANTHROPIC_API_KEY, VAPID_* ; `.env.local` est gitignored

### Story 1.2: Poser le design-system (foyer unique)

As a fondateur,
I want les tokens, l'illustration maison et le mini-set d'icônes centralisés,
So that toute l'UI dérive d'une source unique conforme à la direction artistique (anti look-IA).

**Acceptance Criteria:**

**Given** le starter
**When** je crée `src/design/tokens.ts`
**Then** il porte la palette hex exacte (menthe / mauve = action / froideur 4 états + `-shade`), la typo (Fraunces display + Quicksand corps, ramp 32/30/16/18-20/12), les rayons exacts, l'espacement `4/8/12/16/22/24` et les offsets durs (UX-DR1, UX-DR19)
**And** Tailwind v4 `@theme` consomme `tokens.ts` ; aucune couleur/rayon/espacement codé en dur hors tokens

**Given** l'asset SVG canonique
**When** je copie `plume-illustration-assets.svg` dans `public/` et expose `<Plume name tint/>`
**Then** la plume-mascotte et les avatars-blobs se **recolorent** (fill froideur + `-shade`) sans être redessinés ; les rotations fait-main sont préservées (UX-DR2)

**Given** le besoin d'icônes
**When** je crée le mini-set SVG maison dans `src/design/`
**Then** il couvre 4 canaux, onglets, `+`, recherche, étincelle/double-étincelle, flèches de gestes, chevron, copier, modifier (stroke 2.5px encre, grille 24px) ; aucune lib d'icônes (UX-DR24)
**And** **flou=0** : tout `box-shadow` a un rayon de flou nul (vérifié) ; Inter / police système / emoji-icône interdits

### Story 1.3: Connexion Google + porte de données scopée

As a utilisateur,
I want me connecter via Google et que mes données soient isolées par mon identité,
So that personne d'autre n'y accède (architecture SaaS-ready dès J1).

**Acceptance Criteria:**

**Given** Auth.js v5 + provider Google configurés
**When** je me connecte
**Then** une session est créée et `auth()` résout un `user_id` **opaque** (cuid2) côté serveur ; l'email Google est un attribut, jamais la PK (FR-29, NFR-2)

**Given** la table `users` (id opaque, email, `timezone`, `voix_ton` défaut neutre)
**When** elle est migrée via drizzle-kit
**Then** `timezone` est présent dès J1 et `now` est injecté (jamais `Date.now()` en dur) dans toute logique temporelle (AR-6)

**Given** la porte `db.forUser(userId)` (`lib/db/scoped.ts`)
**When** du code accède aux données
**Then** il passe exclusivement par cette porte ; une query Drizzle nue est rejetée par une barrière ESLint (AR-2, AR-13)
**And** tout module touchant un secret/SDK porte `.server.ts` + `import 'server-only'` ; les 3 barrières ESLint sont actives

**Given** 2 utilisateurs seedés (A, B)
**When** le test cross-tenant s'exécute sur chaque endpoint
**Then** aucune donnée de A n'est lisible par B et inversement (test vert) ; ce harnais est **paramétré pour être étendu à chaque table créée dans les epics suivants**

### Story 1.4: Coquille de navigation 3 onglets

As a utilisateur connecté,
I want une coquille à 3 onglets qui s'ouvre sur Aujourd'hui,
So that je m'oriente instantanément, sans courbe d'apprentissage.

**Acceptance Criteria:**

**Given** un utilisateur connecté
**When** j'ouvre l'app
**Then** je suis redirigé vers `/aujourdhui` (écran par défaut) ; un utilisateur non connecté est redirigé vers `/login` (UX-DR5 ; amorce FR-22)

**Given** la coquille `(app)/layout.tsx`
**When** elle rend
**Then** une tabbar à 3 entrées (Aujourd'hui · Réseau · Réglages) est ancrée en bas et l'onglet actif est doublé (label + soulignement + pastille, jamais la couleur seule) (UX-DR4, UX-DR5)
**And** un point de montage `ComposerSheet` existe **une seule fois** au-dessus des routes (placeholder vide ; ouverture réelle = Epic 3), pas un onglet

**Given** un onglet sans contenu
**When** j'y navigue
**Then** un état vide serein s'affiche (jamais un écran blanc)
**And** le plancher a11y est tenu : ordre de focus = ordre de lecture, anneau de focus net (flou=0), rôle + état annoncés au lecteur d'écran, Reduce Motion respecté (UX-DR4)

## Epic 2: Mon réseau (Contacts)

Un utilisateur peuple et gère son réseau : ajout manuel, ajout rapide multiple (coller N lignes), et import CSV LinkedIn en backfill asynchrone non bloquant. Il parcourt une galerie d'avatars triée par froideur, ouvre une fiche Contact = timeline, et voit les liens qui refroidissent. Dédup propre (intra-fichier + vs-DB), compte-rendu d'import et résolution 1-par-1 des doublons ambigus.

### Story 2.1: Ajouter, éditer & supprimer un Contact manuellement

As a utilisateur,
I want créer et gérer un Contact à la main,
So that je commence mon réseau en quelques secondes, sans dépendre d'un import.

**Acceptance Criteria:**

**Given** un réseau vide
**When** j'ouvre l'onglet Réseau
**Then** un état vide d'amorçage distinct s'affiche (plume + CTA « Ajouter un premier contact », « Par qui on commence ? »), pas l'état « deck terminé » (UX-DR23, amorce FR-23). **Propriétaire unique du moment « réseau vide / premier contact »** — l'onboarding (Epic 5) réutilise ce même écran, ne le re-conçoit pas.

**Given** le formulaire d'ajout
**When** je crée un Contact avec au minimum un nom
**Then** la table `contacts` (`id`, `user_id`, `nom`, `canal_prefere` enum, `handles` JSON `{linkedin,email,phone,whatsapp}`, `notes`, `dernier_contact_at` null, `source`, `imported_at`, `legal_basis`) est migrée et la ligne créée via `db.forUser` (FR-2, AR-9, AR-16)
**And** la saisie est validée par Zod 4 à la frontière ; le Contact est immédiatement actionnable (bouton Écrire visible, ouverture réelle = Epic 3)
**And** `contacts` passe le test cross-tenant 2-users (definition of done)

**Given** un Contact existant
**When** je l'édite
**Then** la fiche est mise à jour sans casser l'historique

**Given** un Contact existant
**When** je le supprime
**Then** la suppression est confirmée et irréversible (Contact + ses Messages/Relances), ton destructif soft, jamais de rouge alarme

### Story 2.2: Ajout rapide multiple

As a utilisateur,
I want coller une liste pour créer plusieurs Contacts d'un coup,
So that je saisis mes cibles du jour instantanément.

**Acceptance Criteria:**

**Given** le champ d'ajout rapide
**When** je colle N lignes (« Nom, Entreprise » parsé best-effort, sinon un nom par ligne)
**Then** N Contacts sont créés en une action (FR-34)

**Given** des Contacts déjà présents
**When** l'ajout rapide s'exécute
**Then** les nouveaux Contacts sont dédupliqués contre l'existant : clé = email normalisé (lowercase+trim) sinon `nom_normalisé + entreprise_normalisée` ; aucun doublon créé (AR-9)
**And** un mini compte-rendu s'affiche (N créés / N fusionnés), ton neutre
**And** aucun enrichissement automatique n'est effectué au MVP

### Story 2.3: Galerie Réseau triée par froideur + recherche

As a utilisateur,
I want parcourir mon réseau en galerie triée par froideur,
So that je vois d'un coup d'œil les liens qui refroidissent.

**Acceptance Criteria:**

**Given** un réseau peuplé
**When** j'ouvre l'onglet Réseau
**Then** une galerie d'avatars-blobs en 3 colonnes (gap 12-18px) s'affiche, jamais un tableau/CRM (UX-DR7)

**Given** `dernier_contact_at`
**When** le Score de froideur est calculé
**Then** il est dérivé à la lecture (`lib/domain/cold-score.ts`, non stocké) : jamais contacté (null) / frais < 30 j / tiède 30-90 j / froid > 90 j (FR-4 ; transitions effectives dès qu'il y a des Messages, Epic 3)
**And** la couleur de l'avatar porte la froideur, doublée par un coldtag texte (a11y, jamais la couleur seule)

**Given** la galerie
**When** je trie, filtre ou recherche
**Then** tri par froideur et par date du dernier Message ; filtre par Statut du dernier Message ; recherche par nom (FR-5)

### Story 2.4: Fiche Contact = timeline

As a utilisateur,
I want ouvrir une fiche Contact qui raconte l'historique des échanges,
So that je sais où j'en suis avant d'écrire.

**Acceptance Criteria:**

**Given** la galerie Réseau
**When** je tape un avatar
**Then** la fiche s'ouvre avec identité (Fraunces), froideur, canaux et bouton Écrire (FR-3)

**Given** la fiche Contact
**When** elle rend
**Then** elle affiche une timeline chronologique (du plus récent au plus ancien) des Messages — structure prête, peuplée dès Epic 3 ; narrative, jamais une grille de données

**Given** le bouton Écrire
**When** je le touche
**Then** il ouvrira le Composeur en flow pour ce Contact (montage présent depuis Epic 1 ; comportement réel = Epic 3)

### Story 2.5: Import CSV LinkedIn en backfill asynchrone

As a utilisateur,
I want importer mon export LinkedIn en arrière-plan,
So that j'enrichis mon réseau en masse sans bloquer l'usage.

**Acceptance Criteria:**

**Given** que l'app est pleinement utilisable
**When** je lance un import CSV
**Then** il tourne en job background (le `user_id` voyage dans le payload du job) et aucun parcours ne bloque sur l'attente (FR-1, NFR-6)

**Given** un CSV LinkedIn standard
**When** il est parsé
**Then** chaque ligne valide crée ou met à jour un Contact ; dédup intra-fichier ET vs-DB (même clé qu'en 2.2) ; idempotence via contrainte d'unicité + `INSERT ... ON CONFLICT DO NOTHING` (AR-4, AR-9)

**Given** une collision ambiguë (A a un email, B même nom+entreprise sans email)
**When** la dédup s'exécute
**Then** la ligne est flaggée `merge_pending` (jamais de fusion à tort) et résolue en file de revue 1-par-1 (Fusionner / Garder séparés) (UX-DR16)

**Given** une ligne malformée
**When** l'import la rencontre
**Then** elle est ignorée sans bloquer l'import ; un `ImportReport {created, merged, skipped, reasons}` s'affiche en carte-bilan non bloquante dans Réseau (UX-DR16)

## Epic 3: Le moat, bout en bout — composer, envoyer, mesurer, historiser

> **⚠️ PIVOT 2026-06-21 (dogfood) — surface IA one-shot dépréciée.** La génération assistée migre du composeur one-shot vers le **copilote conversationnel** (Epic 7). L'infra reste **réutilisée, pas jetée** : `sanitize()` (AR-3), few-shot voix (FR-10/16/17), `generation_events`/SM-1 (AR-8), envoi + timeline (FR-18→21). FR-7/8/9/13/14/35 re-routés vers le copilote. Le shipped reste accessible le temps de la migration. **Jalon R1 / SM-1 à redéfinir** pour la voie conversationnelle. Cf. [sprint-change-proposal-2026-06-21-pivot-copilote.md](sprint-change-proposal-2026-06-21-pivot-copilote.md).

L'epic qui **prouve le moat de bout en bout**, et le premier jalon dogfoodable. Composer (champ unique, Générer/Améliorer streaming, `sanitize()` anti-Tells, few-shot, seed + apprentissage, Haiku/Opus, fallback hors-ligne) PUIS envoyer (Copier → marquer Envoyé, texte figé, cycle de statut) PUIS mesurer (`generation_events` écrit transactionnellement avec l'envoi = instrumentation SM-1). Revue humaine obligatoire, aucun auto-send. La boucle générer → envoyer → mesurer vit dans **un seul epic** : sinon le moat serait *ressenti* sans être *mesuré*. _(FR-15 supprimé.)_

### Story 3.1: Composeur en flow + champ unique + brouillon immortel

As a utilisateur,
I want ouvrir un composeur en flow avec un champ unique qui ne perd jamais ma saisie,
So that j'écris un message sans page blanche ni perte.

**Acceptance Criteria:**

**Given** une carte de la File ou une fiche Contact
**When** je touche Écrire
**Then** le Composeur monte en bottom-sheet avec le contexte du Contact ancré au-dessus, jamais comme un onglet (FR-13)

**Given** le Composeur ouvert
**When** il rend
**Then** le champ unique est vide par défaut, éditable, et constitue la source de vérité (le texte affiché EST le Message) (FR-6, UX-DR8)
**And** le sélecteur 4 canaux pré-sélectionne le canal préféré du Contact (changeable en 1 tap) et le segment Rapide/Soigné est présent (UX-DR8)

**Given** que je tape dans le champ
**When** chaque frappe a lieu
**Then** le brouillon est persisté localement via une **façade `localStore` minimale (CRUD only)** au-dessus de Dexie `drafts`, avant tout réseau ; rouvrir le Composeur restaure le texte (AR-12). La logique d'outbox/synchro viendra **derrière la même façade** en Epic 5 — aucune signature anticipant la synchro ici.

**Given** un message rédigé
**When** je cherche à l'envoyer
**Then** aucun chemin ne l'envoie automatiquement (Copier = commit manuel ; pas d'auto-send) (FR-12)

### Story 3.2: Garantir zéro Tell d'IA (`sanitize()`)

As a utilisateur,
I want que tout texte soit nettoyé des marqueurs d'IA,
So that rien ne sonne « robot » (« tout doit sentir l'humain »).

**Acceptance Criteria:**

**Given** `lib/copy.ts`
**When** `sanitize(x)` s'exécute
**Then** il est versionné, idempotent (`sanitize(sanitize(x)) === sanitize(x)`), ordonné et borné (`MAX_SANITIZE_RETRIES=2`) (AR-3)

**Given** un texte contenant des marqueurs
**When** `sanitize()` le traite
**Then** couverture Unicode explicite : tiret cadratin U+2014 + cousins (U+2013/U+2015, NBSP, zero-width), anti-emoji `\p{Extended_Pictographic}` + ZWJ/skin-tone/regional-indicators ; ordre NFC vs strip décidé (FR-11, AR-3)

**Given** la spec exécutable
**When** la CI tourne
**Then** une table de vecteurs entrée→sortie + un property-test valident `sanitize()` (vert)
**And** `sanitize()` est l'unique point de nettoyage, réutilisé par la génération (3.3) ET l'import de voix (3.5) ; aucun `replace('—','-')` ad-hoc

### Story 3.3: Générer un Message dans la Voix (streaming)

As a utilisateur,
I want générer un message dans ma voix depuis une idée brute,
So that j'écris vite sans repartir de zéro.

**Acceptance Criteria:**

**Given** une idée dans le champ vide
**When** je touche Générer
**Then** `POST /api/composer` streame le texte token-par-token dans le champ (clé Claude serveur-only, jamais au client) (FR-7, AR-7, AR-11)

**Given** un canal et un modèle sélectionnés
**When** la génération s'exécute
**Then** elle est canal-aware (LinkedIn court / Email structuré / WhatsApp-SMS très court) (FR-9), injecte le few-shot voix (Messages envoyés + seed ; pas de fine-tuning ; ton neutre si vide) (FR-10), passe par `sanitize()` + re-validation bornée avant renvoi (FR-11)
**And** Haiku par défaut, Opus sélectionnable, choix persistant (FR-14, NFR-5)

**Given** une génération en cours
**When** j'attends le résultat
**Then** le premier texte est perçu < 5 s ; avant le 1er token la plume « écrit » (Reduce Motion respecté), pas de spinner ; timeout doux à 5 s (NFR-1, UX-DR15)

**Given** un échec API ou un état hors-ligne
**When** je touche Générer
**Then** Générer est grisé + bandeau inline doux (jamais rouge), le champ reste éditable, aucune saisie perdue (FR-7, UX-DR14)

**Given** un texte généré
**When** il s'affiche
**Then** apparaissent Copier (= commit presse-papier) + Améliorer + régénérer + pill de tokens (tappable → détail) ; une micro-ligne de transparence API s'affiche one-time à la 1re génération (UX-DR8, UX-DR21, FR-32 point de contact)
**And** un objet `GenerationEvent` est **produit en mémoire** (texte généré, `prompt_version`, `model_id`, few-shots sélectionnés, `sanitize_version`, tokens) — **pas persisté ici** ; il sera écrit transactionnellement à l'envoi en story 3.6 (frontière = un type, pas une ligne) (AR-8)

### Story 3.4: Améliorer un Message en place

As a utilisateur,
I want faire retravailler un texte que j'ai écrit moi-même,
So that je garde mes idées et mon ton, en plus net.

**Acceptance Criteria:**

**Given** un champ non vide
**When** le bouton intelligent affiche Améliorer et que je le touche
**Then** Plume retravaille le texte en place : garde idées + Voix, n'impose aucun ton étranger, adapte au canal (FR-8, UX-DR8)

**Given** un texte amélioré
**When** il s'affiche
**Then** le résultat reste éditable et « Améliorer » garde l'ancienne version récupérable (undo Composeur) (AR-12)
**And** le pipeline serveur (sanitize, streaming, fallback, tokens) est identique à 3.3

### Story 3.5: Seed de voix optionnel + apprentissage au fil de l'eau

As a utilisateur,
I want amorcer ma voix et qu'elle s'affine à chaque envoi,
So that les générations me ressemblent de plus en plus.

**Acceptance Criteria:**

**Given** l'amorce de voix
**When** je colle 1-2 anciens messages (seed)
**Then** la table `seed_voix` (`id`, `user_id`, `texte`) est migrée, le texte passe par `sanitize()` à l'import et alimente immédiatement le few-shot ; « Passer » est évident (FR-16, AR-3)

**Given** aucun seed fourni
**When** je termine l'amorce
**Then** un ton neutre par défaut est utilisé (jamais d'échec) (FR-16)

**Given** des Messages envoyés
**When** le corpus de Voix est constitué
**Then** il = les Messages au statut `envoyé` (généré-édité OU tapé main), aucune exclusion ; effectif dès la story d'envoi 3.6 (FR-17)
**And** la stratégie de sélection few-shot est nommée (N Messages récents/édités) pour borner le prompt (AR-7, NFR-1)

### Story 3.6: Marquer Envoyé, enregistrer le Message & instrumenter le moat (SM-1)

As a utilisateur,
I want transformer un texte composé en Message tracé d'un tap,
So that je garde l'historique et que Plume mesure si la voix marche.

**Acceptance Criteria:**

**Given** un texte dans le Composeur
**When** je touche Copier puis Marquer Envoyé (tous canaux)
**Then** le Message est enregistré dans la timeline du Contact (date, canal, statut, texte) ; aucune intégration d'envoi sortante n'est requise (FR-21, FR-18)

**Given** la table `messages` (`id`, `user_id`, `contact_id`, `canal`, `texte`, `texte_genere`, `statut`, `genere_par_ia`, `envoye_at`)
**When** elle est migrée et qu'un Message passe `brouillon → envoyé`
**Then** le `texte` est figé (= sortie sanitizée finale, l'éditée si retouchée à la main) (AR-5)
**And** la machine à états **expose les événements/timestamps que les Relances consommeront** (`envoye_at`, état `répondu`/`sans réponse`), conçus maintenant même s'ils ne sont lus qu'en Epic 4 (AR-5)

**Given** `features/messages/send.ts`
**When** un Message est marqué Envoyé
**Then** il écrit `messages` (figé) + `generation_events` (`generated, sent, edit_distance, contact_id, raw_intent, prompt_version, model_id, voice_examples_ref, sanitize_version, tokens, timestamp`) dans UNE transaction Drizzle (AR-8, SM-1)
**And** `contacts.dernier_contact_at` est mis à jour → le Score de froideur (Epic 2) devient vivant
**And** la timeline de la fiche Contact affiche le Message envoyé, marqué `accent`
**And** `messages` et `generation_events` passent le test cross-tenant 2-users (definition of done)

### Story 3.7: Verrou read-only après Envoyé + Modifier

As a utilisateur,
I want qu'un message envoyé soit figé mais rouvrable,
So that je ne l'altère pas par accident tout en gardant une porte de sortie.

**Acceptance Criteria:**

**Given** un Message au statut `envoyé`
**When** je l'ouvre
**Then** son texte est read-only et un bouton Modifier discret permet de le rouvrir (FR-20)

**Given** un Message figé
**When** je tente de l'éditer sans passer par Modifier
**Then** l'édition est bloquée ; l'autorité serveur sur `Sent` rejette une réédition concurrente (409) (AR-12)
**And** rouvrir via Modifier n'invalide pas le `generation_events` déjà écrit (historique moat intact)

### Story 3.8: Cycle de Statut d'un tap

As a utilisateur,
I want faire évoluer le statut d'un message d'un tap,
So that je suis où en est l'échange.

**Acceptance Criteria:**

**Given** la timeline d'un Contact
**When** je tape la pastille de statut d'un Message
**Then** un mini-sheet propose vu / répondu / ignoré (saisie manuelle au MVP) (FR-19, UX-DR22)

**Given** un changement de statut
**When** je le sélectionne
**Then** la transition respecte la machine à états (`brouillon → envoyé → vu → répondu/ignoré`), nommée et légale (AR-5)
**And** marquer « répondu » ou « ignoré » est le signal qui clôturera la Relance associée (couplage réel = Epic 4)
**And** chaque transition se fait d'un tap, sans quitter la fiche

### Story 3.9: Evals figés de la Voix (anti-régression)

As a fondateur,
I want un jeu d'evals figé rejoué à chaque changement de prompt ou de modèle,
So that je ne dégrade jamais en silence le seul actif qui compte (la Voix).

**Dépend de :** 3.2 (prompt few-shot) + 3.3 (`sanitize()`) + 3.6 (`generation_events`) — à implémenter après elles.

**Acceptance Criteria:**

**Given** un panier d'évals **dimensionné** (≥ N idées-test par canal, N figé au 1er run ; chaque cas porte seed + **critères binaires** attendus : longueur dans la cible canal, absence de Tells d'IA, ton conservé)
**When** je modifie le prompt few-shot ou je change de modèle (Haiku↔Opus)
**Then** les evals sont rejoués et signalent toute régression (Tell d'IA réapparu, longueur hors cible canal, ton dérivé) avant merge

**Given** les payloads Claude
**When** les evals tournent en CI
**Then** ils utilisent des réponses gelées (`tests/fixtures/claude-canned/`), déterministes, sans appel réseau réel
**And** ils couvrent le couplage `sanitize()` + prompt (un changement de l'un ne casse pas l'autre en silence)

### Story 3.10: Historique de conversation du Contact → génération en continuité

> **Ajout 2026-06-21 (correct-course, [sprint-change-proposal-2026-06-21](sprint-change-proposal-2026-06-21.md)).** Feature née du brainstorm 2026-06-21. Étend le moat : la génération tient compte des échanges passés. Réutilise l'infra composeur (3.3) + le champ Contact (Epic 2). MVP uniquement ; incréments 2/3 (boutons-intention, écran de confiance, nudge onboarding) et gros morceaux (multi-fils par canal, forward mail) **différés et hors scope de cette story**.

As a utilisateur,
I want attacher l'historique de mes échanges passés avec un Contact,
So that le message généré tienne compte du passé et réponde juste.

**Acceptance Criteria:**

**Given** la fiche Contact (et le formulaire de création)
**When** je saisis ou édite le champ historique (textarea libre, brut, pas de parsing de format)
**Then** `contacts.historique` (text, nullable) est migré, passé par `sanitize()` à l'écriture, scopé `user_id` ; le champ est éditable à tout moment (FR-35)

**Given** un Contact avec un historique non vide
**When** je touche Générer dans le Composeur
**Then** `composeInVoice` injecte un bloc historique **borné** (troncature serveur, parité MAX_SEED/MAX_IMPORT) dans le prompt, à côté de l'idée (optionnelle) et du few-shot voix ; la consigne demande de rebondir sur le dernier point laissé en suspens (continuité, pas simple rappel) (FR-35, AR-7, NFR-1, NFR-5)

**Given** un historique présent
**When** la génération est lancée
**Then** la micro-ligne de transparence API reflète que l'historique du Contact est transmis à Claude (FR-32)

**Given** un Contact sans historique
**When** je génère
**Then** le comportement actuel (few-shot seul) est **strictement préservé** — aucune régression

**And** `contacts.historique` passe le test cross-tenant 2-users (definition of done)
**And** génération = **Composeur** (jamais le Copilote) ; le champ intention reste optionnel

### Jalon R1 — GO / PIVOT (clôt l'Epic 3)

**Porte de décision, pas une story de dev. À franchir avant d'investir dans les Epics 4-6.**

**Given** l'Epic 3 livré (générer → envoyer → mesurer)
**When** le fondateur a fait transiter 20-30 vrais messages par le cycle complet
**Then** on mesure SM-1 = distance d'édition médiane généré→envoyé (données `generation_events`, story 3.6)
**And** seuil de décision écrit maintenant : médiane **< 20 %** → **GO** (lancer Epics 4-6) ; médiane **≥ 20 %** → **PIVOT** (ne pas enchaîner : rouvrir le mécanisme de Voix — sélection few-shot, seed, bascule Opus, ou profils de style explicites — avant tout autre investissement)
**And** la décision se prend sur le chiffre, pas sur le ressenti (R1 = risque n°1 ; tout Epic 4-6 construit avant cette mesure est du travail à risque)

## Epic 4: Aujourd'hui & relances zéro-fuite (filet in-app)

L'utilisateur ouvre l'app directement sur la File du jour : un swipe-deck priorisé (relances dues d'abord, puis nouveaux Contacts par froideur), une action à la fois (écrire / plus tard / skip), gestes doublés de boutons. Une Relance datée (J+5) s'arme automatiquement sur tout Message envoyé non répondu ; la confirmation 1-tap (« X t'a répondu ? ») clôt ou relance idempotemment. La garantie zéro-fuite tient in-app, indépendamment de tout push. _(FR-26 push = Epic 6.)_

### Story 4.1: File du jour priorisée (écran par défaut)

As a utilisateur,
I want ouvrir l'app sur une file priorisée,
So that je sais quoi faire sans réfléchir ni naviguer.

**Acceptance Criteria:**

**Given** un utilisateur connecté
**When** j'ouvre l'app
**Then** j'atterris sur Aujourd'hui / File du jour ; aucune navigation n'est nécessaire pour voir la première action (FR-22)

**Given** des Contacts et (plus tard) des Relances
**When** la File est construite
**Then** elle est dérivée à la lecture : nouveaux Contacts à joindre priorisés par froideur (relances ajoutées en 4.3) ; tri figé au chargement de session (FR-23)

**Given** une File terminée
**When** plus aucune carte ne reste
**Then** un état vide serein s'affiche (« C'est tout pour aujourd'hui » + plume + compteur rassurant), distinct de l'état vide premier lancement d'Epic 2 (FR-23, UX-DR18)

### Story 4.2: Swipe-deck action-first + équivalents tap

As a utilisateur,
I want traiter mes cartes au geste, une à la fois,
So that j'avance vite au pouce.

**Acceptance Criteria:**

**Given** le deck
**When** j'interagis avec la carte courante
**Then** une carte plein écran à la fois ; horizontal = feuilleter/choisir, ↑ = écrire (ouvre le Composeur, Epic 3), ↓ = plus tard (snooze) (FR-24, UX-DR6)

**Given** les gestes
**When** je veux un équivalent non-gestuel
**Then** les boutons chunky (Écrire / Plus tard) doublent les gestes verticaux ; flèches ‹ › + pager tappable + flèches clavier doublent le feuilletage horizontal (UX-DR20, a11y)

**Given** un « plus tard »
**When** je repousse une carte
**Then** elle est déplacée avec un timestamp de réapparition ; un snackbar Annuler (doublé d'un label) permet l'undo (machine à états + undo) (UX-DR6)
**And** traiter une carte fait monter la suivante sans quitter l'écran (FR-24)

### Story 4.3: Next-action automatique (Relance)

As a utilisateur,
I want qu'une relance s'arme automatiquement après un envoi sans réponse,
So that je ne laisse jamais une piste refroidir.

**Acceptance Criteria:**

**Given** un Message marqué Envoyé non répondu
**When** l'envoi a lieu
**Then** une `next_actions` (`id`, `user_id`, `message_id` UNIQUE, `due_at` J+5 défaut, `statut` due/faite/close) est créée (FR-25)

**Given** la création de Relance
**When** le scheduler ou l'envoi est rejoué
**Then** elle est idempotente : `UNIQUE(message_id)` + `INSERT ... ON CONFLICT DO NOTHING` ; ni doublon ni double notification (AR-4)

**Given** un Message marqué « répondu » ou « ignoré » (Epic 3, story 3.8)
**When** le statut change
**Then** la Relance associée est close de façon idempotente ; Plume ne relance jamais un Contact ayant répondu
**And** je peux décaler (stepper, défaut 5 j) ou annuler une Relance ; `due_at` reste lisible serveur-side (pré-requis du cron Epic 6) (AR-14)
**And** `next_actions` passe le test cross-tenant 2-users (definition of done)

**Given** une Relance due
**When** la File du jour est construite
**Then** elle apparaît le jour de son échéance, priorisée avant les nouveaux Contacts (extension de 4.1) (FR-23)

### Story 4.4: Confirmation de relance 1-tap + compteur zéro-fuite

As a utilisateur,
I want confirmer une réponse en un tap et voir que rien ne fuit,
So that je relance juste, sans faux pas ni charge mentale.

**Acceptance Criteria:**

**Given** une Relance due dans le deck
**When** la carte s'affiche (variante de la carte courante, pas d'interstitiel)
**Then** elle pose « X t'a répondu ? » → Oui clôt la Relance · Non ouvre le Composeur de relance (FR-25, UX-DR17)

**Given** un push échoué ou absent
**When** une Relance est due
**Then** elle apparaît toujours in-app (garantie indépendante du push ; aucun hook vers Epic 6) (FR-27)

**Given** des Relances dues et en retard
**When** je consulte Aujourd'hui
**Then** les Relances en retard sont distinctes des à venir ; le compteur zéro-fuite est en cadrage positif (« Tout est repris, rien d'oublié »), chip mauve discret en cas de retard, jamais de badge rouge (FR-27, UX-DR18)

## Epic 5: PWA, hors-ligne, confidentialité & onboarding

Rendre l'app installable, résiliente, privée et accueillante : PWA installable (Serwist) + résilience hors-ligne complète (outbox Dexie rejouée à la reconnexion) ; Réglages (modèle par défaut, gestion de la Voix, bloc Consommation) ; privacy first-class (export format ouvert, suppression, transparence API) ; onboarding < 2 min en 5 écrans, sans dépendre du CSV, lien Gmail retiré. _(Permission/envoi push = Epic 6.)_

### Story 5.1: PWA installable (service worker)

As a utilisateur,
I want installer Plume sur mon téléphone,
So that je l'ai sous la main comme une vraie app.

**Acceptance Criteria:**

**Given** Serwist (`@serwist/next`) + `manifest.webmanifest` + icônes
**When** je visite l'app
**Then** elle est installable (mobile + desktop) sans store et tourne en plein écran depuis l'écran d'accueil (FR-28)

**Given** l'environnement d'exécution
**When** l'app démarre
**Then** le display-mode est détecté (Safari vs standalone) avec dégradation gracieuse

**Given** le build PWA
**When** la CI tourne
**Then** le trap Serwist/webpack (`next build --webpack`) est validé dès le 1er commit Serwist (AR-15)
**And** le front reste Capacitor-ready (aucune dépendance empêchant un wrap natif)

### Story 5.2: Résilience hors-ligne complète (outbox)

As a utilisateur,
I want que mes actions tiennent hors-ligne et se rejouent à la reconnexion,
So that je ne perds jamais rien dans le métro.

**Acceptance Criteria:**

**Given** Dexie (`drafts` d'Epic 3 + `outbox`)
**When** je mute hors-ligne
**Then** l'écriture passe par l'outbox queue, ajoutée **derrière la façade `localStore` posée en Epic 3** (jamais d'écriture optimiste directe hors queue) (AR-12, NFR-6)

**Given** une reconnexion
**When** `lib/offline/sync.ts` s'exécute
**Then** il rejoue l'outbox (pur, testable) vers les server actions ; `useLiveQuery` propage SW→composant (AR-12)

**Given** un conflit
**When** la réconciliation a lieu
**Then** autorité serveur sur `Sent` (immuable), last-write-wins ailleurs (AR-12)
**And** un test offline (`tests/offline/replay.test.ts`) valide le replay (vert)

### Story 5.3: Réglages — modèle, voix & consommation

As a utilisateur,
I want régler mon modèle par défaut, gérer ma voix et voir ma consommation,
So that je garde le contrôle sans angoisse.

**Acceptance Criteria:**

**Given** l'onglet Réglages
**When** je l'ouvre
**Then** des groupes exposent : défaut modèle global Rapide/Soigné (FR-14, exposition), gestion de la Voix (« Gérer mes exemples de voix », « Plume apprend de tous tes messages envoyés »), bloc Consommation (messages + tokens du mois, barre de progression, ligne rassurante) (UX-DR12)

**Given** les éléments interactifs
**When** ils sont focus / survolés / pressés / désactivés
**Then** états systématisés : focus (anneau net, flou=0), hover (contour/offset discret), pressed (offset réduit, pas de ripple/flou), disabled (offset supprimé, libellé `ink-hint`) (UX-DR11)
**And** un toggle « Rappels push » est présent mais désactivé/différé (envoi = Epic 6) ; jamais de modale insistante

### Story 5.4: Confidentialité — export, suppression & transparence

As a utilisateur,
I want exporter, supprimer mes données et savoir ce qui part à l'API,
So that je garde la maîtrise (privacy first-class).

**Acceptance Criteria:**

**Given** mes données
**When** je demande un export
**Then** un fichier en format ouvert (JSON/CSV) contenant Contacts + Messages est produit (FR-30, NFR-4)

**Given** mes données
**When** je demande la suppression
**Then** elles sont retirées de la base ; action confirmée, destructif soft (mauve mesuré, jamais rouge) (FR-31, UX-DR11)

**Given** Réglages > Confidentialité
**When** je le consulte
**Then** une mention permanente de transparence s'affiche (« Générer envoie ton texte à l'API Claude ; taper sans générer ne transmet rien »), complétée par la micro-ligne one-time d'Epic 3 (FR-32, UX-DR21)
**And** aucune PII de Contact tiers ne fuit dans les logs (NFR-4)

### Story 5.5: Onboarding < 2 min

As a nouvel utilisateur,
I want être prêt en moins de 2 minutes,
So that je ne décroche pas avant la valeur.

**Acceptance Criteria:**

**Given** le premier lancement
**When** je suis l'onboarding
**Then** 5 écrans, une décision par écran : Google → seed optionnel (« Passer » évident) → 1er contact (prénom/nom) → « Ajoute à l'écran d'accueil » (Plus tard évident) → « Voir ma journée » (FR-33, UX-DR9)
**And** l'écran « 1er contact » réutilise l'écran « réseau vide » dont Epic 2 (story 2.1) est propriétaire — pas de double conception de cet état

**Given** l'onboarding
**When** je le termine
**Then** j'atteins la File du jour + un 1er Message en < 2 min sans dépendre du CSV ; aucune étape n'attend un export LinkedIn (FR-33)
**And** le lien Gmail est retiré du MVP (scan Gmail = v1) (UX-DR9)

**Given** la permission de notification
**When** l'onboarding se déroule
**Then** elle n'est jamais demandée à l'init (événement gagné, après le 1er message / Epic 6) ; refuser ne bloque rien, garantie zéro-fuite in-app maintenue (UX-DR9, UX-DR11)

## Epic 6: Relances push (DIFFÉRÉ — déclencheur = 1er user non-founder)

Notification push best-effort quand une Relance est due (Web Push/VAPID via service worker ; iOS exige la PWA à l'écran d'accueil). Topologie verrouillée par l'architecture (Vercel Cron managé → route handler authentifié `CRON_SECRET` → `next_actions` dues → `web-push`). **Build hors sprint MVP** : déclenché au premier utilisateur non-fondateur, pas à une date. La garantie zéro-fuite (Epic 4) ne dépend pas de cet epic.

### Story 6.1: Abonnement Web Push + permission (événement gagné)

As a utilisateur,
I want activer les rappels push au bon moment,
So that je ne rate pas une relance, sans qu'on me harcèle dès l'ouverture.

**Acceptance Criteria:**

**Given** que j'ai envoyé un premier message (événement gagné)
**When** la permission de notification est proposée
**Then** elle n'est jamais demandée à l'init ; refuser ne bloque rien (garantie zéro-fuite in-app, Epic 4, maintenue) (FR-26, UX-DR9)

**Given** une permission accordée
**When** je m'abonne
**Then** la table `push_subscriptions` (`id`, `user_id`, endpoint, clés) est migrée ; `POST /api/push/subscribe` enregistre l'abonnement ; VAPID public = seule var `NEXT_PUBLIC_*` (AR-14)

**Given** un appareil iOS
**When** j'active les rappels
**Then** l'app signale explicitement que le push exige la PWA ajoutée à l'écran d'accueil (FR-26)
**And** le toggle « Rappels push » de Réglages (Epic 5) devient actif

### Story 6.2: Cron scheduler + envoi push best-effort

As a utilisateur,
I want recevoir une notification quand une relance est due,
So that je suis ramené dans Plume au bon moment.

**Acceptance Criteria:**

**Given** Vercel Cron managé (`vercel.json`)
**When** le cron quotidien se déclenche
**Then** il appelle un route handler authentifié (`CRON_SECRET`) qui SELECT les `next_actions` dues (`due_at` lisible serveur-side) et dispatche via `web-push`/VAPID (FR-26, AR-14)

**Given** un cron rejoué
**When** il s'exécute deux fois
**Then** l'envoi est idempotent : ni double notification (cohérent `UNIQUE(message_id)`, Epic 4) (AR-4)

**Given** un échec de push (refusé, iOS non installé, navigateur non supporté)
**When** le dispatch a lieu
**Then** il est best-effort et n'altère pas la garantie zéro-fuite (tenue in-app, Epic 4) (FR-27)
**And** le service worker affiche la notification (« Relance due : X »)

## Epic 7: Copilote — surface IA unique (PIVOT dogfood 2026-06-21)

> **Origine :** [sprint-change-proposal-2026-06-21-pivot-copilote.md](sprint-change-proposal-2026-06-21-pivot-copilote.md), issu du [compte-rendu dogfood](../implementation-artifacts/compte-rendu-test-dogfood-copilote.md). Mémoire : `copilote-pivot-conversationnel`.

Le **copilote conversationnel** devient la **seule** surface d'IA : toute la rédaction assistée y vit (l'IA pose **toujours** des questions avant de rédiger, et à la création d'un contact) ; l'application ne porte plus que le **manuel**. Le composeur one-shot « Générer » disparaît comme concept ; son infra (sanitize, few-shot, `generation_events`, envoi) est **re-routée**, pas jetée. Cet epic intègre officiellement le copilote (construit hors-epics via `docs/specs/spec-copilote-phase-1/2/3`) à la structure BMad, et absorbe les findings F1→F14 du dogfood.

> **⚠️ Stories-stubs — AC à détailler via `bmad-create-story` / `bmad-spec` au sprint-planning.** Cette section est un **cadrage** (correct-course « Cadrage + stubs »), pas des stories prêtes-dev. Priorité dev dogfood : **7-6 (bug F11) → 7-4 (F2/F8) → 7-1 (pivot) → 7-8 (quick-wins)**.

> **⚠️ Jalon R1 / SM-1 à redéfinir.** La distance d'édition généré→envoyé (SM-1) n'a plus de sens littéral en conversationnel. PM/Architecte : redéfinir la métrique (ex. % de messages envoyés sans réécriture après le dialogue) et **rejouer R1 sur la nouvelle voie** avant d'investir Epic 4-6.

### Story 7.1: Rédiger en conversationnel full — migrer la génération dans le copilote
Router la rédaction assistée (Générer/Améliorer, canal-aware, few-shot voix, `sanitize()`, historique de contact) à travers le **flux conversationnel** du copilote : l'IA pose toujours des questions ciblées avant de rédiger. Réutilise l'infra Epic 3 (`composeInVoice`, sanitize, generation_events). Porte les corrections de prompt **P1** (récence ≠ oubli) / **P2** (ne pas minimiser l'interaction). _Re-route FR-7, FR-8, FR-9, FR-13, FR-35._

### Story 7.2: Choix IA / manuel par message
L'utilisateur décide, message par message, s'il passe par le copilote (IA) ou écrit lui-même dans l'app (manuel). Pas d'imposition. _Nouveau FR-36._

### Story 7.3: Capter le contexte relationnel à la création de contact
À la création d'un contact, le copilote pose des questions (comment tu le connais, dernière interaction, ton) et alimente le champ historique/contexte — réutilisé pour chaque message futur. _Nouveau FR-38._

### Story 7.4: Write-tool `updateContact` (+ handles) — confirmation + rewind  ⭐ F2/F8
Tool d'édition de fiche existante (entreprise, canal préféré, `handles` {linkedin, email, phone, whatsapp}, notes, historique). Résolution via `queryContacts` (id réel), **annonce NOM + champ(s) ciblé(s) + confirmation utilisateur obligatoire** avant écriture. Ajout à `WRITE_TOOL_NAMES` (→ `didWrite` → `router.refresh`). Journalisation `action_log` (`prev_state`) pour le **rewind**. Fusion non-destructive des `handles`. _Nouveau FR-39._

### Story 7.5: Write-tool `duplicateContact` — gestion dédup  F4
Dupliquer une fiche existante (variante proche). Confirmation (source + ce qui change). Gère la tension avec `uq_contacts_user_dedup` : force une `dedup_key` distincte ou refuse/explique la copie pure. Mutualise résolution + `action_log`/rewind avec 7.4. _Nouveau FR-39._

### Story 7.6: Durcir l'idempotence de `createContact`  🐛 F11
Bug : une demande de création unique a produit deux contacts (viole `uq_contacts_user_dedup`). Durcir : dédoublonner via `dedupKey` avant insert (réactiver si existant) et/ou empêcher un second `createContact` identique dans le même tour tool-use. Investiguer `tools.server.ts` + repository contacts.

### Story 7.7: Migrer le registre de modèle (palier Sonnet) vers le copilote  F13
Le sélecteur de modèle migre du composeur vers le copilote. Ajouter le 3ᵉ palier **Sonnet** (« équilibré ») entre Haiku (« rapide », défaut conservé) et Opus (« soigné »). Mapping + libellé FR + UI côté copilote.

### Story 7.8: Quick-wins UI copilote  F7 / F9 / F12 / F14
- **F7** — rendre le markdown des tours **réhydratés** (même composant que le stream live) → liens fiches cliquables après reload.
- **F9** — afficher le locuteur (« Moi » / « Copilote » + style par `role`).
- **F12** — retirer l'icône étincelle redondante du composeur (doublon du bouton « Générer »).
- **F14** — au refresh, copilote **fermé/vide** (couper la réhydratation auto CAP-2 ; reprise d'un fil seulement sur sélection explicite dans l'historique).

### Story 7.9: Contrôle du tour — Stop + édition de message  F5 / F6
- **F5** — bouton **Stop** : `AbortController` côté client + `abortSignal` propagé à `streamText` ; décider du sort de la persistance d'un tour interrompu.
- **F6** — rééditer un message `user` passé + relancer (réécriture du fil aval vs fork) — à cadrer en spec.

### Story 7.10: Canal Discord  F10
Étendre l'union `Canal` (`@/lib/domain/enums`) avec `discord` + `ContactHandles.discord` + libellé `copy.ts` + UI (sélecteur + saisie handle) + copilote. Auditer tous les `switch`/validations exhaustifs sur `Canal`.

### Hors epic (traçé ailleurs)
- **F1 (process)** — garde-fou migrations (apply/check au boot dev OU check CI schéma↔migrations) → `deferred-work.md`. Non lié au pivot.
- **F3** — compléter le tableau verdicts composeur → matière à itération prompt (portée par 7.1), pas une story.

---

## Epic 8: Campagne — copilote de sourcing piloté par objectif (qui contacter, et quand)

> **Origine :** [prd-campagne-2026-06-22/prd.md](prds/prd-campagne-2026-06-22/prd.md) (status `final`), issu du [brief Campagne](briefs/brief-campagne-2026-06-22/brief.md). Décisions D1→D16 (brief) + P0→P11 (PRD) dans leurs decision-logs. Mémoire : `feature-campagne-qui-contacter`.

Plume sait **écrire** dans la voix et **suivre** les relances ; il ne répond jamais à *qui contacter, et quand*. **Campagne** transforme un objectif NL en routine de contact ciblée : objectif cadré → liste du jour 3-5 (chacun avec son *pourquoi*) → message pré-chargé. Net-new infra : table `campagnes`, intégration **PDL serveur-only** (job-change), scoring LLM borné, instrumentation timing, feedback négatif.

> **⚠️ Stories-stubs — AC à détailler via `bmad-create-story` / `bmad-spec` au sprint-planning.** Section = cadrage (correct-course recadrage 2026-06-22), pas des stories prêtes-dev.

> **⚠️ Pré-requis de séquencement.** NE PAS démarrer avant : (1) clôture d'Epic 7 (Campagne réutilise la surface copilote FR-36→39 + le moat rédaction) ; (2) Jalon R1 GO confirmé (idem porte Epic 4). Open Questions PRD à trancher avant dev : **valeur du quota dur PDL** (NFR-7) et **intervalle de re-check enrichment** (FR-43).

> **⚠️ Garde-fou légal (RGPD art. 14).** L'opt-in (FR-51) protège le founder ; le **contact enrichi** est un tiers non-consentant. Toléré au dogfood single-user, **bloquant avant SaaS** : information du tiers + `legal_basis` + DPA. Voir [PRD §note PM](prds/prd-campagne-2026-06-22/prd.md).

### Story 8.1: Campagne active — objectif NL + cadrage + cycle d'état
Objectif en langage naturel au copilote, **1-2 questions de cadrage** avant activation ; l'objectif cadré devient une **campagne active persistante** (table `campagnes`, scopée `user_id`). **Une seule active à la fois** : états `active | en_pause | close`, transitions nommées **idempotentes**, `close` terminal, lancer une nouvelle met l'actuelle en pause sans perte. _FR-40, FR-41, NFR-10._

### Story 8.2: Scoring de pertinence LLM borné + evals
Chaque contact du réseau reçoit un score de pertinence relatif à l'objectif actif, calculé par **LLM** (clé Claude serveur-only), **borné par la campagne**. Reproductibilité évaluée sur la **stabilité du classement** (non-déterministe par nature) via un panier d'évals figé (esprit Story 3.9). _FR-42, NFR-9._

### Story 8.3: Liste du jour dans le copilote + signaux internes gratuits
Liste **courte 3-5** présentée conversationnellement, chaque entrée en **carte structurée inline** (nom + froideur + *pourquoi* + bouton Écrire). **Split hybride :** l'app calcule le signal brut déterministe, le copilote le met en mots. Cadence **1x/jour + à la demande**. Réintègre les **dormants** liés à l'objectif **OU** porteurs d'un signal de timing. Signaux zéro-API : froideur (Epic 2) + relance en suspens (Epic 4). _FR-44, FR-45, FR-46, FR-49._

### Story 8.4: Dialogue sur la liste — écarter → feedback
Le founder peut, en conversation : **demander pourquoi** (transparence du signal), **écarter** un contact. Écarter le retire **et** réinjecte un **signal négatif** (exemple-en-contexte borné par campagne, pas un modèle entraîné) ; un fait durable (« a quitté la data ») est conservé **au niveau du contact**. _FR-47, FR-48._

### Story 8.5: Enrichment job-change PDL — opt-in, bornage, quota dur
Détection du changement de poste via **People Data Labs** (serveur-only), **uniquement sur les contacts liés à l'objectif** (FR-52), à partir des handles existants — **jamais de scraping** (réseau-only, FR-55). **Opt-in OFF par défaut**, consentement demandé pile avant le 1er appel, mémorisé, **révocable** (Réglages > Confidentialité → stoppe tout appel futur). 3 garde-fous coût cumulatifs : borne objectif + cache/re-check à intervalle + **quota dur numérique** (refus au-delà). _FR-43, FR-51, FR-52, FR-55, NFR-7, NFR-8._

### Story 8.6: Provenance & transparence enrichment
Tout contact enrichi porte sa provenance / base légale (`source`, `imported_at`, `legal_basis`, AR-16). L'app explicite **ce qui est transmis et à qui** (PDL pour l'enrichment, Claude pour scoring/rédaction) — extension de la transparence API (FR-32 / UX-DR21). Effacement cross-user prêt. _FR-53._

### Story 8.7: Pré-chargement de l'angle en rédaction
Choisir un contact dans la liste (« écris à X ») **bascule le copilote en rédaction** avec l'**angle pré-chargé par l'objectif** : sourcing et rédaction en un geste. Réutilise le moat rédaction Epic 7 (few-shot voix, sanitize, generation_events). _FR-50._

### Story 8.8: Instrumentation réponse × timing (north star)
Horodate le **signal détecté** et l'**envoi**, dérive un booléen **`bien_timé`** (parti dans les N jours d'un signal, N = 7/14 à trancher), relie au statut `répondu`. Permet de comparer le **taux de réponse bien-timé vs baseline**. _FR-54._
