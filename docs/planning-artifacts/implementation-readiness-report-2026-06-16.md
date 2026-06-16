---
stepsCompleted: ['step-01-document-discovery', 'step-02-prd-analysis', 'step-03-epic-coverage-validation', 'step-04-ux-alignment', 'step-05-epic-quality-review', 'step-06-final-assessment']
status: complete
overallReadiness: READY
completedAt: '2026-06-16'
documentsIncluded:
  - 'prds/prd-job-pipeline-2026-06-15/prd.md'
  - 'prds/prd-job-pipeline-2026-06-15/addendum.md'
  - 'architecture.md'
  - 'epics.md'
  - 'ux-designs/ux-job-pipeline-2026-06-15/DESIGN.md'
  - 'ux-designs/ux-job-pipeline-2026-06-15/EXPERIENCE.md'
---

# Implementation Readiness Assessment Report

**Date:** 2026-06-16
**Project:** Plume (repo job-pipeline)

## Document Inventory

| Type | Fichier retenu | Taille |
|------|----------------|--------|
| PRD (requis) | `prds/prd-job-pipeline-2026-06-15/prd.md` (+ `addendum.md`) | 42 Ko |
| Architecture (requis) | `architecture.md` | 45 Ko |
| Epics & Stories (requis) | `epics.md` | 63 Ko |
| UX | `ux-designs/ux-job-pipeline-2026-06-15/DESIGN.md` + `EXPERIENCE.md` | 60 Ko |

**Doublons :** aucun. **Manquants :** aucun. Inventaire confirmé par Monsieur.

## PRD Analysis

Source : `prd.md` (v final, 2026-06-16) + `addendum.md` (technique, non normatif).

### Functional Requirements

**Feature 4.1 — Import & gestion Contacts (Réseau)**
- **FR-1** : Import CSV LinkedIn en backfill asynchrone (optionnel, non bloquant ; dédup ; CR import).
- **FR-2** : Ajout & édition manuelle d'un Contact (+ suppression Contact/Message confirmée).
- **FR-34** : Ajout rapide multiple (coller N lignes → N Contacts, dédup).
- **FR-3** : Fiche Contact = timeline complète des Messages.
- **FR-4** : Score de froideur (jamais contacté / frais <30j / tiède 30-90j / froid >90j).
- **FR-5** : Liste, tri & filtre du Réseau (froideur, date, statut).

**Feature 4.2 — Composeur « ta voix » (héros/moat)**
- **FR-6** : Champ unique = source de vérité (vide par défaut).
- **FR-7** : Générer un Message (idée→texte, canal-aware, fallback offline éditable, couple généré/envoyé conservé pour SM-1).
- **FR-8** : Améliorer un Message (réécrit en place, garde idées+voix).
- **FR-9** : Génération canal-aware (LinkedIn court / Email structuré / WhatsApp+SMS très court).
- **FR-10** : Few-shot voix minimal (injection contexte, pas de fine-tuning ; ton neutre si vide).
- **FR-11** : Liste noire des Tells d'IA (zéro tiret cadratin, etc.).
- **FR-12** : Revue humaine obligatoire (aucun envoi auto).
- **FR-13** : Composeur en flow (pas un onglet ; porte le contexte Contact).
- **FR-14** : Choix du modèle (Haiku défaut, Opus option, persistant).
- **FR-15** : ~~Mode sans-IA par Contact~~ **SUPPRIMÉ** (2026-06-16, décision #30) — hors périmètre.

**Feature 4.3 — Apprentissage de la Voix**
- **FR-16** : Seed de voix optionnel à l'onboarding.
- **FR-17** : Apprentissage au fil de l'eau (tout Message envoyé alimente le corpus, y compris manuel).

**Feature 4.4 — Messages & Statut**
- **FR-18** : Enregistrer un Message (date, canal, statut, texte figé).
- **FR-19** : Cycle de Statut d'un tap (brouillon→envoyé→vu→répondu/ignoré, manuel au MVP).
- **FR-20** : Verrou read-only après Envoyé (+ bouton Modifier discret).
- **FR-21** : Copier puis marquer Envoyé (tous canaux, zéro intégration sortante).

**Feature 4.5 — File du jour (Aujourd'hui)**
- **FR-22** : Écran par défaut au lancement.
- **FR-23** : File priorisée (relances dues d'abord, puis nouveaux Contacts ; état vide explicite).
- **FR-24** : Action-first (une action à la fois ; envoyé/skip/snooze, bouton ou swipe).

**Feature 4.6 — Relances zéro-fuite**
- **FR-25** : Next-action automatique (J+5 défaut ; clôture idempotente si répondu/ignoré ; confirmation 1-tap).
- **FR-26** : Notification push Web Push (iOS = PWA à l'écran d'accueil).
- **FR-27** : Compteur zéro-fuite (in-app garanti même sans push).

**Feature 4.7 — Coquille PWA, Auth & Privacy**
- **FR-28** : PWA installable (service worker, Capacitor-ready).
- **FR-29** : Auth Google OAuth + données scopées par `user_id`.
- **FR-30** : Export des données (format ouvert).
- **FR-31** : Suppression des données.
- **FR-32** : Transparence API Claude (ce qui part, quand).
- **FR-33** : Onboarding court (<2 min, sans dépendre du CSV).

**Total FRs actifs : 33** (FR-1..FR-34, FR-15 supprimé).

### Non-Functional Requirements

- **NFR-1 (Perf composeur)** : génération quasi instantanée, cible < 5 s avant premier texte (§11).
- **NFR-2 (Archi SaaS-ready)** : entités scopées `user_id` dès J1, sans sur-ingénierie multi-tenant (§11, FR-29).
- **NFR-3 (Mobile-first strict)** : tout parcours utilisable au pouce sur téléphone (§11).
- **NFR-4 (Privacy first-class)** : données scopées user, zéro partage tiers, export/suppression, transparence API, pas d'entraînement sur données user (§7.2, §11).
- **NFR-5 (Coût maîtrisé)** : <1 ct/génération Haiku ; quelques dizaines ct à 1-2 €/user/mois ; free tier SaaS plafonné (§7.3, §11).
- **NFR-6 (Résilience import)** : import partiellement invalide ne bloque pas (§11, FR-1).
- **NFR-7 (Anti-robot/authenticité — sécurité produit)** : Tells d'IA proscrits, revue humaine obligatoire, écriture 100% manuelle toujours possible, « tout doit sentir l'humain » (§7.1).
- **NFR-8 (Conformité plateforme)** : pas de scraping ni auto-send LinkedIn (CGU/ban) (§7.4).

**Total NFRs : 8.**

### Additional Requirements / Contraintes

- **Modèle de données** (addendum A) : `users`, `contacts`, `channels`, `messages`, `next_actions`, `voice_samples` (à modéliser explicitement). `opportunities` = v1 différé.
- **Stack figée** (addendum B + architecture.md) : Next.js PWA, Turso, Auth.js Google, Claude API serveur-only, Web Push.
- **Métriques** : SM-1 (faisabilité Voix, Levenshtein normalisée médiane <20%), SM-2..SM-5 ; contre-métriques SM-C1..C3.
- **Gouvernance** : préséance UX sur PRD en cas de conflit.

### PRD Completeness Assessment

PRD complet et testable : chaque FR porte des « Consequences (testable) », UJs (UJ-1..3) reliés inline, hypothèses indexées (§17), non-goals explicites (§5), risques (§12), métriques (§15). Zones ouvertes assumées et taguées (§16 : pricing, seuils froideur/relance, RGPD tiers, faisabilité Voix) — non bloquantes pour l'implémentation MVP. Prêt pour validation de couverture epics.

## Epic Coverage Validation

Source : `epics.md` (6 epics, post party-mode 2026-06-16). L'epics doc porte sa propre **FR Coverage Map** (l.143-182) ; chaque mapping vérifié contre une story réelle.

### Coverage Matrix

| FR | Epic | Story(s) | Statut |
|----|------|----------|--------|
| FR-1 | Epic 2 | 2.5 (import CSV async) | ✓ Covered |
| FR-2 | Epic 2 | 2.1 (ajout/édit/suppr manuelle) | ✓ Covered |
| FR-3 | Epic 2 | 2.4 (fiche timeline) | ✓ Covered |
| FR-4 | Epic 2 | 2.3 (score froideur dérivé) | ✓ Covered |
| FR-5 | Epic 2 | 2.3 (liste/tri/filtre) | ✓ Covered |
| FR-34 | Epic 2 | 2.2 (ajout rapide multiple) | ✓ Covered |
| FR-6 | Epic 3 | 3.1 (champ unique) | ✓ Covered |
| FR-7 | Epic 3 | 3.3 (générer, fallback, couple SM-1) | ✓ Covered |
| FR-8 | Epic 3 | 3.4 (améliorer en place) | ✓ Covered |
| FR-9 | Epic 3 | 3.3 (canal-aware) | ✓ Covered |
| FR-10 | Epic 3 | 3.3 + 3.5 (few-shot) | ✓ Covered |
| FR-11 | Epic 3 | 3.2 + 3.3 (sanitize/Tells) | ✓ Covered |
| FR-12 | Epic 3 | 3.1 (revue humaine, anti auto-send) | ✓ Covered |
| FR-13 | Epic 3 | 3.1 (composeur en flow) | ✓ Covered |
| FR-14 | Epic 3 | 3.3 + 5.3 (modèle, défaut Réglages) | ✓ Covered |
| FR-15 | — | — | ⊘ SUPPRIMÉ (#30) — non implémenté, correct |
| FR-16 | Epic 3 | 3.5 (seed) + écran 5.5 | ✓ Covered |
| FR-17 | Epic 3 | 3.5 + 3.6 (apprentissage) | ✓ Covered |
| FR-18 | Epic 3 | 3.6 (enregistrer Message) | ✓ Covered |
| FR-19 | Epic 3 | 3.8 (cycle statut) | ✓ Covered |
| FR-20 | Epic 3 | 3.7 (verrou après Envoyé) | ✓ Covered |
| FR-21 | Epic 3 | 3.6 (copier → Envoyé) | ✓ Covered |
| FR-22 | Epic 4 | 4.1 (écran défaut, amorce 1.4) | ✓ Covered |
| FR-23 | Epic 4 | 4.1 + état vide 2.1 | ✓ Covered |
| FR-24 | Epic 4 | 4.2 (action-first deck) | ✓ Covered |
| FR-25 | Epic 4 | 4.3 + 4.4 (next-action auto) | ✓ Covered |
| FR-26 | Epic 6 | 6.1 + 6.2 | ⚠ Covered mais **DIFFÉRÉ** (hors sprint MVP) |
| FR-27 | Epic 4 | 4.4 (compteur zéro-fuite in-app) | ✓ Covered |
| FR-28 | Epic 5 | 5.1 (PWA installable) | ✓ Covered |
| FR-29 | Epic 1 | 1.3 (OAuth + scoping user_id) | ✓ Covered |
| FR-30 | Epic 5 | 5.4 (export) | ✓ Covered |
| FR-31 | Epic 5 | 5.4 (suppression) | ✓ Covered |
| FR-32 | Epic 5 + 3 | 5.4 (permanent) + 3.3 (one-time) | ✓ Covered (split 2 epics) |
| FR-33 | Epic 5 | 5.5 (onboarding <2 min) | ✓ Covered |

### NFR / AR Coverage

- NFR-1→E3 (3.3 streaming) · NFR-2→E1 (1.3) · NFR-3→E1+transverse · NFR-4→E5 (5.4) · NFR-5→E3 (3.3) · NFR-6→E2 (2.5)+E5 (5.2).
- AR-1..AR-17 tissés dans les stories (AR-1=1.1, AR-2/6/13=1.3, AR-3=3.2, AR-8=3.6, AR-12=3.1/5.2, AR-14=6.x, AR-17=1.1…). Aucun AR orphelin.

### Missing Requirements

**Aucun FR actif manquant.** Aucun FR présent dans les epics mais absent du PRD (FR-15 correctement exclu, non implémenté).

**Point d'attention (non bloquant) :** FR-26 (push) est couvert mais **délibérément différé** (Epic 6, déclencheur = 1er user non-founder). La garantie zéro-fuite est tenue in-app par Epic 4 sans dépendre d'Epic 6 — décision de scope explicite, traçable. À acter au sprint planning : Epic 6 hors périmètre du sprint MVP.

### Coverage Statistics

- Total FRs actifs PRD : **33** (FR-1..FR-34, FR-15 supprimé).
- FRs couverts dans les epics : **33**.
- **Couverture : 100 %** (33/33). FR-26 inclus mais en epic différé.

## UX Alignment Assessment

### UX Document Status

**Found.** `DESIGN.md` (identité visuelle / tokens) + `EXPERIENCE.md` (spine comportementale, IA, états, flows, a11y) + `validation-report.{md,html}` + mockups HTML promus. App fortement user-facing (PWA mobile-first) → UX requise et présente.

### UX ↔ PRD Alignment

- **Parcours alignés** : Flows UX 1-4 (boucle matinale / onboarding / relance zéro-fuite / améliorer brouillon) mappent UJ-1, UJ-3, UJ-2 du PRD §2.3. ✓
- **Gouvernance « UX prime » honorée** : déclarée dans PRD §0, EXPERIENCE en-tête et architecture en-tête. ✓
- **Conflits historiques résolus** (et tracés) :
  - FR-15 « Mode sans-IA » **supprimé** pour s'aligner sur l'UX #18/#19 (le moat n'a aucun mode/toggle). ✓
  - Lien **Gmail retiré** de l'onboarding (UX-DR9) — cohérent avec PRD §6.2 (Gmail = v1). ✓
- **24 UX-DR** (UX-DR1..24) ajoutés par l'UX, tous tracés dans les epics ; aucun ne contredit un FR.

### UX ↔ Architecture Alignment

L'architecture promeut explicitement les garanties d'expérience au rang d'invariants archi (§ « Garanties d'expérience à porter par l'architecture ») :

| Besoin UX | Support archi | Statut |
|-----------|---------------|--------|
| Streaming = chargement (UX-DR15) | AR-11 `POST /api/composer` SSE token-par-token, FSM `idle/generating/ok/error/offline`, timeout doux 5 s | ✓ |
| Brouillon immortel + undo Améliorer | AR-12 Dexie `drafts`, persistance avant réseau, undo | ✓ |
| Tokens design figés (UX-DR1/19) | `src/design/tokens.ts` foyer unique consommé par Tailwind v4 `@theme` | ✓ |
| Illustration recolor jamais redraw (UX-DR2) | `<use href="…#name">` + recolor CSS/`currentColor`, jamais inline | ✓ |
| Plancher a11y (UX-DR4) | a11y structurelle forme+texte+ARIA, équivalents non-gestuels, contraste AA en CI | ✓ |
| Composeur bottom-sheet en flow (UX-DR5) | `ComposerSheet` monté **une fois** au-dessus des routes, hors onglet | ✓ |
| Erreur inline douce, jamais rouge (UX-DR14) | « erreurs UX douce, jamais rouge alarme » ; `StatusMessage(tone)` | ✓ |
| Push = événement gagné (UX-DR9) | « Timing permission push = événement gagné, jamais à l'init » | ✓ |
| NFR-1 < 5 s | streaming traité comme contrat d'état UI, pas seule métrique serveur | ✓ |

### Alignment Issues

**Aucun désalignement bloquant.** PRD, UX et Architecture forment un triangle cohérent et explicitement réconcilié (versionné 2026-06-16). L'architecture porte une section « Requirements Coverage Validation » concluant 34/34 FR supportés + NFR couverts.

### Warnings

- **Détails push non élicités** (regroupement de relances dues, horaire/fréquence d'envoi, son) — assumé non spécifié, **cohérent avec le build push différé** (Epic 6 / AR-14). Non bloquant MVP.
- **RGPD données tiers** — colonnes `source/imported_at/legal_basis` posées dès J1, cadrage juridique (effacement cross-user) à instruire avant SaaS. Non bloquant single-user.
- **`DESIGN.md`** = référence d'identité visuelle confirmée présente ; tokens repris fidèlement dans project-context + UX-DR1/19 + architecture (cohérence vérifiée par référence, pas de divergence détectée).

## Epic Quality Review

Évaluation rigoureuse des 6 epics + 24 stories contre les standards `create-epics-and-stories` (valeur user, indépendance, dépendances avant, sizing, AC, timing de création des tables).

### Structure des epics — valeur utilisateur & indépendance

| Epic | Valeur user | Indépendance (n'exige pas un epic futur) |
|------|-------------|------------------------------------------|
| 1. Socle, identité & design-system | Installer + se connecter (Google) + coquille 3 onglets navigable | Autonome ✓ |
| 2. Mon réseau (Contacts) | Peupler/gérer son réseau, galerie froideur, fiche timeline | N'utilise qu'Epic 1 ✓ |
| 3. Le moat bout en bout | Composer→envoyer→mesurer (dogfoodable + jalon GO/PIVOT) | Epic 1+2 ✓ |
| 4. Aujourd'hui & relances (filet) | File du jour priorisée + zéro-fuite in-app | Epic 3 (messages) ✓ |
| 5. PWA, offline, privacy, onboarding | Installable, résiliente, privée, accueillante | Epic 1-3 ✓ |
| 6. Relances push (DIFFÉRÉ) | Notif push best-effort | Epic 4 ✓, déclencheur = 1er user non-founder |

Aucun epic n'est un pur jalon technique sans valeur. Epic 1 est le classique epic-socle greenfield, mais cadré sur un résultat user-visible (login + navigation).

### Conformité des points spéciaux

- **Starter template (AR-1)** : l'architecture impose `create-next-app` comme 1re story → **Story 1.1 = exactement cet init**. Conforme à la règle « si starter spécifié, Epic 1 Story 1 = setup du starter ». ✓
- **Greenfield** : story de setup + env + CI tôt (1.1 pose la CI GitHub Actions). ✓
- **Création des tables au juste besoin** (anti-pattern = tout en Epic 1) : `users`→1.3 · `contacts`→2.1 · `seed_voix`→3.5 · `messages`+`generation_events`→3.6 · `next_actions`→4.3 · `push_subscriptions`→6.1. **Aucune table créée en avance.** ✓ (point fort)
- **AC en Given/When/Then** : toutes les stories ; testables, spécifiques, couvrant erreurs/edge cases (hors-ligne, ligne CSV malformée, `merge_pending`, conflit 409, échec push). ✓
- **Test cross-tenant 2-users** étendu à chaque nouvelle table (definition of done transverse). ✓
- **Traçabilité FR** maintenue story par story (FR cités dans chaque AC). ✓

### Dépendances — analyse des références « avant »

Le découpage emploie un motif « amorce/placeholder en Epic N, comportement réel en Epic N+k ». **Vérifié : ce sont des échafaudages forward-compatibles, PAS des dépendances avant bloquantes** (chaque epic fonctionne sans l'epic futur) :
- Story 1.4 : point de montage `ComposerSheet` (placeholder vide) — la coquille marche ; Epic 3 le remplit. ✓ non bloquant
- Stories 2.1 / 2.4 : bouton « Écrire » visible — Epic 2 fonctionne (CRUD contacts) ; ouverture composeur = Epic 3. ✓
- Story 3.6 : machine à états expose `envoye_at` / état réponse « conçus maintenant, lus en Epic 4 » — schéma forward-compatible, Epic 3 complet seul. ✓
- Story 3.1 : façade `localStore` posée sans signature anticipant la synchro (outbox = Epic 5 derrière la même façade). ✓ discipline anti-couplage exemplaire

Dépendances **arrière** explicites et correctes : 5.2→façade 3.1 · 5.5 onboarding→écran vide 2.1 (propriété unique, anti-doublon) · 4.3→statut 3.8.

### 🔴 Violations critiques

**Aucune.** Pas d'epic technique sans valeur, pas de dépendance avant brisant l'indépendance, pas de story de taille epic non complétable.

### 🟠 Problèmes majeurs

**Aucun.** AC complètes et testables, sizing cohérent, création de tables au juste besoin.

### 🟡 Concerns mineurs (non bloquants — à garder en tête au sprint planning)

1. **FRs livrés sur 2 epics** : FR-32 (Epic 3 micro-ligne + Epic 5 mention permanente), FR-14 (Epic 3 par-message + Epic 5 défaut global), FR-16 (mécanisme seed Epic 3 + écran onboarding Epic 5). → Ne marquer ces FR « done » que lorsque **toutes** les pièces ont atterri.
2. **Motif « amorce/placeholder »** : très présent. Non bloquant (échafaudage forward-compatible), mais au sprint planning **ne pas le lire comme des blocages** — séquencer Epic 1→2→3 normalement.
3. **Ordre intra-epic à respecter** : Epic 3 (3.9 evals dépend de 3.2/3.3/3.6 — noté explicitement « après elles ») ; Epic 4 (4.3 étend la File de 4.1). Séquencer les stories dans cet ordre au sprint.
4. **Story 1.1 = setup pur** sans valeur user directe — **non un défaut** (imposé par la règle starter template), simplement le premier pas obligé.

### Best Practices Compliance Checklist

- [x] Chaque epic délivre de la valeur user
- [x] Chaque epic fonctionne indépendamment (pas de dép. avant)
- [x] Stories correctement dimensionnées
- [x] Aucune dépendance avant bloquante
- [x] Tables créées au juste besoin
- [x] AC claires (G/W/T), testables, avec erreurs
- [x] Traçabilité FR maintenue
- [x] Story 1.1 = setup du starter (règle spéciale)

## Summary and Recommendations

### Overall Readiness Status

**✅ READY** (prêt pour l'implémentation, avec gaps mineurs non bloquants).

Le triangle **PRD ↔ UX ↔ Architecture** est cohérent, explicitement réconcilié (versionné 2026-06-16, post party-mode + revue adversariale 4 agents) et entièrement tracé jusqu'aux epics/stories. Couverture FR = **100 % (33/33 actifs)**. Aucune violation critique ni majeure de qualité des epics. Tables créées au juste besoin, AC testables, indépendance des epics tenue.

### Critical Issues Requiring Immediate Action

**Aucune.** Zéro gap critique, zéro problème majeur. L'implémentation peut démarrer.

### Issues recensés (tous non bloquants)

- **FRs livrés sur 2 epics** (FR-32, FR-14, FR-16) → ne marquer « done » que pièces complètes.
- **Motif amorce/placeholder** très présent → ne pas le lire comme des blocages au sprint planning.
- **Ordre intra-epic** à respecter (Epic 3 : 3.9 après 3.2/3.3/3.6 ; Epic 4 : 4.3 étend 4.1).
- **FR-26 (push) délibérément différé** (Epic 6, déclencheur = 1er user non-founder) — zéro-fuite tenue in-app par Epic 4.
- **Détails push** (regroupement, horaire) non élicités → à instruire au build d'Epic 6.
- **RGPD données tiers** : colonnes posées J1, cadrage juridique avant SaaS.
- **3 specs à figer en début de story** (déjà notées par l'archi) : table de vecteurs Unicode `sanitize()` (story 3.2), critère exact de sélection few-shot (story 3.5), chemin build PWA webpack/Serwist validé en CI (story 5.1).

### Recommended Next Steps

1. **Lancer Sprint Planning** (`bmad-sprint-planning`) — produire le plan d'exécution séquencé des stories. Acter explicitement : **Epic 6 hors périmètre sprint MVP**, ordre Epic 1→2→3→(jalon R1 GO/PIVOT)→4→5.
2. **Inscrire le jalon R1 GO/PIVOT comme porte de décision** après Epic 3 : mesurer SM-1 (Levenshtein normalisée médiane <20 %) sur 20-30 vrais messages avant d'investir Epics 4-6.
3. **Au démarrage des stories concernées**, figer les 3 specs ci-dessus (vecteurs `sanitize()`, sélection few-shot, build PWA) — résolvables dans la story, pas avant.
4. **Tableau de suivi des FR multi-epics** (FR-32/14/16) pour éviter un « done » prématuré.

### Final Note

Cette évaluation a recensé **0 problème critique, 0 problème majeur, ~7 points mineurs/avertissements** répartis sur 4 catégories (couverture FR, alignement UX, qualité des epics, gaps produit/juridique différés). Aucun ne bloque l'implémentation. Les artefacts de planification (PRD, UX, Architecture, Epics) sont d'une qualité élevée et mutuellement cohérents : **GO pour la phase 4 (implémentation)**.

---

*Évalué le 2026-06-16 par BMad Implementation Readiness (rôle PM / traçabilité). Documents source : PRD `prd.md` + `addendum.md`, `architecture.md`, `epics.md`, UX `DESIGN.md` + `EXPERIENCE.md`.*

