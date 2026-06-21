---
id: SPEC-copilote-phase-2-archive-tools
companions:
  - ../spec-copilote-phase-2-rewind/SPEC.md                                # journal + rewind dont CET incrément réutilise l'op `archived` comme inverse (adopted)
  - ../spec-copilote-phase-2-rewind/action-inverse-map.md                  # matrice op→inverse étendue aux archive-tools (spec-authored, mise à jour ici)
  - ../spec-copilote-phase-2-real-writes/SPEC.md                           # write-tools sur vraie donnée + parité MAX_SEED/MAX_IMPORT à PRÉSERVER (adopted)
  - ../spec-copilote-phase-2-write/SPEC.md                                 # frontière R/W + parité sécu (la contrainte « pas de tool destructif » RENÉGOCIÉE ici) (adopted)
  - ../../implementation-artifacts/spec-copilote-phase-1-agent-chat.md     # archi du module agent (scope clos par closure) (adopted)
  - ../../project-context.md                                              # soft-delete only + barrières archi + interdiction d'auto-send (adopted)
sources:
  - PR #23 (feat/copilote-archive-et-dev-login) — revue de code 2026-06-21
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Cet incrément a été IMPLÉMENTÉ avant d'être spécifié (PR #23) ; ce document est le contrat rétroactif qui acte la **renégociation de la frontière R/W destructive** (décision de revue 2026-06-21) et borne la portée du bypass d'auth dev.

# Copilote Phase 2 — incrément 5 : archive-tools (delete réversible) + connexion dev sans Google

## Why

**Renégociation explicite d'une contrainte d'inc.4.** L'incrément 4 ([rewind](../spec-copilote-phase-2-rewind/SPEC.md)) interdisait tout tool destructif côté agent — y compris `deleteContacts` — au motif qu'un tour pourrait *s'auto-annuler* ou en annuler un autre (footgun), et que la frontière R/W ne devait pas franchir le destructif « sans renégociation » (rewind SPEC, Constraints l.46, Non-goals l.62). Cet incrément **est** cette renégociation, et la tranche ainsi : le danger réel visé par inc.4 était l'**auto-annulation** (un tool `rewind`/`undo`), pas le retrait de donnée à la demande explicite de l'utilisateur. Un **archivage réversible** (soft-delete `archivedAt`, journalisé sous le `turnId`, défait par le rewind humain) est une capacité doer légitime, distincte de l'auto-annulation, qui reste interdite. La frontière verrouillée devient donc « **aucun tool rewind/undo** » (l'agent ne s'annule jamais lui-même), non plus « aucun delete ».

**Besoin produit.** Le copilote doer (inc.3) sait créer/importer/rédiger, mais pas retirer : l'utilisateur qui dit « supprime tous les contacts de test » ou « retire ce brouillon » devait le faire à la main. L'archivage agent ferme la symétrie create↔archive, en restant **100 % réversible par construction** — donc sans nouvelle surface de risque irréversible.

**Connexion dev sans Google (outillage).** Orthogonal au copilote, embarqué dans la même PR : le pane de preview (iframe localhost-only) bloque le redirect OAuth vers `accounts.google.com`, rendant toute l'app — derrière le login — inatteignable en preview. Un bypass d'auth **strictement dev** crée une vraie session `database` sans OAuth. C'est de l'outillage de développement, pas une capacité produit ; il est spécifié ici uniquement pour borner son risque.

## Capabilities

- id: CAP-DEL-1
  intent: L'agent peut **archiver UN contact** par id (`archiveContact`), à la demande explicite de l'utilisateur — soft-delete `archivedAt`, jamais de hard-delete, journalisé (op `archived`) sous le `turnId` du run → rewindable.
  success: Given une session valide et un contact actif résolu via `queryContacts`, when l'agent appelle `archiveContact({contactId})`, then le contact pose `archivedAt` (invisible aux lectures, ligne CONSERVÉE en base), une entrée `action_log {op:"archived", prevState:{archivedAt:null}}` est écrite ATOMIQUEMENT dans la même transaction, et le rewind du tour DÉSARCHIVE le contact ; idempotent : un id inconnu ou déjà archivé renvoie `{archived:false}` sans écriture ni entrée. Un test prouve le soft-delete, l'idempotence, l'isolement cross-tenant (A ne peut pas archiver un contact de B) et la réversibilité par rewind.

- id: CAP-DEL-2
  intent: L'agent peut **archiver PLUSIEURS contacts en bloc** (`archiveContacts`) à partir d'une liste d'ids qu'il a lui-même résolus (`queryContacts`) — le tool ne devine AUCUN critère côté serveur. Plafonné serveur (parité `MAX_SEED`/`MAX_IMPORT`), **lot atomique**.
  success: Given une liste d'ids, when l'agent appelle `archiveContacts({contactIds})`, then le lot est CLAMPÉ à `MAX_ARCHIVE` (= `MAX_SEED`, l'excédent ignoré, `capped:true` annoncé), tout le lot s'archive dans UNE SEULE transaction (un échec en cours ANNULE TOUT — jamais d'archivage partiel), chaque contact réellement archivé est journalisé sous le même `turnId` (lot entier rewindable d'un geste), et `archived` compte les archivages EFFECTIFS (id inconnu/déjà archivé/doublon intra-lot exclu). Un test prouve le clamp à la borne, le compte effectif, et la réversibilité de masse par rewind.

- id: CAP-DEL-3
  intent: L'agent peut **retirer UN brouillon** qu'il a rédigé (`archiveDraft`) — soft-delete réversible, qui ne touche QU'UN message resté `statut = "brouillon"` (un `envoye` est refusé : corpus de voix préservé).
  success: Given un brouillon actif, when l'agent appelle `archiveDraft({messageId})`, then le message pose `archivedAt` (garde `statut="brouillon"`), une entrée `action_log {op:"archived"}` est écrite atomiquement → le rewind RESTAURE le brouillon via `restoreDraft` ; un message déjà `envoye` (ou inconnu/déjà retiré) renvoie `{archived:false}` sans écriture. Un test prouve le retrait du brouillon, le REFUS d'un envoyé, et la restauration par rewind.

- id: CAP-DEV-1
  intent: En développement UNIQUEMENT, l'utilisateur peut se connecter **sans Google** (`devSignIn`) — crée une vraie session `database` + pose le cookie Auth.js, sans OAuth — pour rendre l'app atteignable dans le pane de preview localhost.
  success: Given `NODE_ENV !== "production"`, when l'utilisateur clique « Connexion dev (sans Google) », then une vraie ligne `sessions` est créée pour le faux user `dev@plume.local` et le cookie Auth.js posé, `auth()` résout la session comme normale, et l'utilisateur atteint `/aujourdhui` authentifié ; en production (`next build` force `NODE_ENV=production`, prod ET preview Vercel) le bouton n'est PAS rendu ET `devSignIn` LÈVE si appelée. Un test/preview prouve la connexion dev et l'inaccessibilité en prod.

## Constraints

- **Frontière R/W renégociée = « aucun tool rewind/undo », plus « aucun delete ».** L'agent NE s'auto-annule JAMAIS (pas de tool `rewind`/`undo`/`annul*`, garde verrouillée par test `rewind-not-a-tool`). L'archivage réversible est une capacité distincte, autorisée. « L'humain seul annule » (le rewind reste une affordance humaine) ET « l'humain seul envoie » (Sécu #4) tiennent inchangés.
- **Soft-delete ONLY, jamais de hard-delete** (non négocié, parité Phase 1/2 + project-context). Tout archivage pose `archivedAt` ; l'inverse au rewind est un DÉSARCHIVAGE (`prevState = {archivedAt: null}`), jamais un `DELETE`. Voir [`action-inverse-map.md`](../spec-copilote-phase-2-rewind/action-inverse-map.md).
- **Aucune logique BDD sous un tool** (Archi #1). Les archive-tools orchestrent les repositories via la porte scopée `forUser` (`contacts.remove`/`bulkRemove`, `messages.archiveDraft`) ; aucun `insert`/`update`/`delete` ni accès drizzle direct sous un tool.
- **Scope tenant clos par closure** (Sécu #3) : `userId` injecté par `buildTools`, jamais argument de l'agent → un id cross-tenant ne matche pas la porte scopée (no-op), jamais d'archivage d'autrui.
- **Confirmation de la cible AVANT d'archiver.** Les descriptions de tools + le system prompt forcent l'agent à retrouver la/les cible(s) via `queryContacts`, à annoncer le NOM (et le nombre, pour un bloc) et à n'agir que sur une demande claire — jamais sur une instruction ambiguë ni un id non résolu.
- **Plafond serveur sur le bloc** (`MAX_ARCHIVE = MAX_SEED`, SÉCU #6) : « clampé, pas honoré » — l'agent ne peut ni amplifier le coût ni vider tout un réseau d'un appel. Borne DURE à la frontière zod (`.max(500)`, anti-DoS) + clamp logique à `MAX_ARCHIVE`, même patron à deux bornes que `seedContacts`/`importContacts`.
- **Lot atomique** (CAP-DEL-2) : `archiveContacts` délègue à `contactsRepository.bulkRemove`, qui archive tout le lot dans UNE transaction (parité `bulkCreate`). Pas N transactions indépendantes — un échec en cours annule tout, jamais d'archivage partiel ni de compte faux.
- **Journal écrit ATOMIQUEMENT avec l'archivage** (CAP-1 d'inc.4) : entrée `action_log` dans la même transaction que la pose d'`archivedAt`, UNIQUEMENT si une ligne a réellement été archivée (un no-op ne journalise rien, sinon le rewind « désarchiverait » à tort).
- **Symétrie archive↔restore des brouillons.** `archiveDraft` et `restoreDraft` portent la MÊME garde `statut = "brouillon"` : on ne ressuscite jamais au rewind un brouillon que l'humain a depuis promu `envoye`. `restoreDraft` est réservé au rewind, jamais un tool d'agent.
- **Les archive-tools héritent de la sync d'inc.2** par leur seule présence dans `WRITE_TOOL_NAMES` (`router.refresh` après écriture) — aucun code de sync dédié (parité CAP-4 d'inc.4).
- **Bypass dev — TRIPLE GARDE, jamais en production.** (1) `isDevAuthEnabled()` exige `NODE_ENV !== "production"` (faux dans tout build Vercel, prod ET preview) ; (2) `devSignIn()` re-vérifie et LÈVE hors dev (défense en profondeur) ; (3) le bouton n'est rendu que si `isDevAuthEnabled()`. La mutation `users`/`sessions` vit dans la zone autorisée `src/lib/db` (`dev-auth.ts`), exposée par la façade `@/lib/db` ; la garde + le cookie vivent dans `src/lib/auth-dev.ts`. Modules `server-only`, aucun `NEXT_PUBLIC_*`, token de session = deux cuid2 concaténés (opaque, non devinable), cookie `secure:false` UNIQUEMENT car http://localhost.

## Non-goals

- **Pas de hard-delete ni de purge** — l'archivage est soft et réversible ; la purge en bloc de la donnée `source = "seed"` (`resetTestData`) reste différée.
- **Pas de tool de désarchivage côté agent** — `restoreDraft`/désarchivage contact sont réservés au rewind humain. L'agent archive, l'humain restaure (parité « l'humain seul annule »).
- **Pas d'archivage sur critère côté serveur** — l'agent fournit des ids EXACTS qu'il a résolus ; le tool ne traduit aucun « tous les X » en requête serveur (anti-amplification, anti-ambiguïté).
- **Le bypass dev n'est PAS une fonctionnalité produit** — pas de multi-compte dev, pas de rôle, pas de purge des sessions dev. Outillage local strict ; jamais atteignable sur un déploiement.
- **Pas de durcissement réseau du bypass dev dans cet incrément** — la garde est le mode d'environnement (`NODE_ENV`), pas une vérification de localité réseau (host loopback). Un opt-in explicite (`PLUME_DEV_AUTH=1`) et/ou un check host loopback sont une amélioration différée (defense-in-depth), reportée dans `deferred-work.md`.

## Success signal

Depuis le popup sur l'onglet Réseau, je dis « supprime tous mes contacts de test ». L'agent les retrouve via `queryContacts`, m'annonce « je vais archiver ces 12 contacts : Camille, Léa… — d'accord ? », j'accepte. Les 12 disparaissent de la galerie (soft-delete, lignes conservées) **sans reload**, le tout dans une seule transaction journalisée. Je change d'avis : « Annuler ce tour » — les 12 réapparaissent **exactement** (désarchivés), rien n'a été supprimé physiquement. En parallèle, en preview localhost, je clique « Connexion dev (sans Google) » et j'atteins `/aujourdhui` authentifié sans jamais toucher Google — un bouton qui n'existe simplement pas en production.

## Assumptions

- **Implémenté avant spécifié (PR #23).** Ce contrat est rétroactif ; il reflète le code mergé + les décisions de la revue 2026-06-21 (D1 : acter la renégociation par cette spec). Toute divergence future code↔contrat se résout en faveur de ce document.
- **`NODE_ENV` en preview Vercel.** Le contrat suppose que `next build` force `NODE_ENV=production` pour TOUT déploiement Vercel (prod et preview) — vérifié en revue : aucune référence `VERCEL_ENV` dans le repo, le bouton dev ne rend que sous `next dev` local. Si un jour un déploiement tourne avec `NODE_ENV` non-production (Docker mal configuré, `next start` sans env), la garde tomberait : c'est précisément le risque que le durcissement différé (opt-in `PLUME_DEV_AUTH` + host loopback) neutraliserait.
- **Accumulation des sessions dev.** Chaque `devSignIn` insère une ligne `sessions` jamais purgée (anciens tokens dev valides 30 j). Sans incidence prod (dev-only) ; un nettoyage est différé.
