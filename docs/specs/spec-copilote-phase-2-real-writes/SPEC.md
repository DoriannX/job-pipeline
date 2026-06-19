---
id: SPEC-copilote-phase-2-real-writes
companions:
  - ../../implementation-artifacts/spec-copilote-phase-1-agent-chat.md   # archi du module agent que cet incrément ÉTEND (adopted)
  - ../spec-copilote-phase-2-write/SPEC.md                                # frontière R/W + parité sécu à PRÉSERVER (adopted)
  - ../spec-copilote-phase-2-ui-sync/SPEC.md                              # sync générique (pont d'invalidation) DONT héritent les nouveaux tools (adopted)
  - ../../project-context.md                                             # design-system + règles du Composeur/moat voix + interdiction d'auto-send (adopted)
sources:
  - ../../brainstorming/brainstorming-session-2026-06-19.md
  - ../../implementation-artifacts/deferred-work.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Copilote Phase 2 — incrément 3 : write-tools sur VRAIE donnée (advisor → doer)

## Why

**Opportunité à capturer.** Le copilote a un moteur (boucle tool-use serveur, route `/api/agent/chat`), une UI (icône flottante → popup, inc.2), une sync temps réel générique (pont d'invalidation, inc.2) et un premier write-tool — mais ce write-tool, `seedContacts`, ne produit que de la **fausse donnée jetable** (tag `source = "seed"`). Le copilote sait écrire, mais il n'écrit encore rien de **vrai**. Cet incrément ouvre le Thème B du brainstorm : les write-tools sur de la **vraie donnée** — `createContact` (saisie réelle), `composeMessage` (le Composeur « ta voix » exposé comme tool), import vrac texte-libre → contacts. C'est le pivot validé en session : « l'outil de test EST l'assistant produit » — on cesse de seeder du faux pour commencer à **faire** dans la vraie BDD de l'utilisateur (Capacité #3 advisor→doer, Capacité #4 import vrac).

**Risque rouvert, frontière à tenir.** La vraie donnée déplace deux frontières d'un coup : (a) la donnée n'est plus jetable — elle doit rester distinguable du test (provenance `source ≠ "seed"`) et réversible par construction ; (b) `composeMessage` touche le **moat** (la voix, les Tells d'IA) ET frôle la sortie externe. Le brainstorm (Sécu #4) et `project-context.md` tranchent net : **l'agent rédige, l'humain envoie**. Aucun auto-send au MVP. `composeMessage` ne produit donc qu'un **brouillon** ; l'envoi réel reste l'action humaine du parcours existant et n'est PAS dans cet incrément. On ne livre pas trois tools de plus ; on livre la **discipline d'écriture sur vraie donnée** — réversible, taguée vraie, jamais envoyée à la place de l'utilisateur — par-dessus le moteur, la sync et la parité sécu déjà posés.

## Capabilities

- id: CAP-1
  intent: Depuis le chat, l'utilisateur demande en langage naturel d'ajouter un vrai contact (ex. « ajoute Sophie Martin, CTO chez Acme ») ; l'agent appelle le write-tool `createContact` qui crée le contact via la vraie fonction métier `contactsRepository.create`, avec une provenance de VRAIE donnée (`source ∈ {"manuel","rapide"}`, jamais `"seed"`), scopé à l'utilisateur courant.
  success: Given une session valide, when je POST une demande d'ajout en langage naturel sur `/api/agent/chat`, then un contact réel apparaît en BDD chez l'utilisateur courant avec `source ≠ "seed"` (distinguable de la donnée de test inc.1), dédupliqué par `dedupKey` (une collision fusionne au lieu de doubler), invisible pour tout autre tenant, et réversible par le soft-delete existant ; un test prouve la provenance vraie-donnée, la déduplication et l'isolement cross-tenant.

- id: CAP-2
  intent: Depuis le chat, l'utilisateur demande à l'agent de rédiger un message d'outreach pour un contact donné ; l'agent appelle le write-tool `composeMessage` qui RÉUTILISE le pipeline du Composeur existant (corpus voix few-shot + génération + `sanitize()` déterministe des Tells d'IA, canal-aware) et persiste le résultat comme **brouillon** lié au contact (`genereParIa = true`, `statut = "brouillon"`) — sans JAMAIS l'envoyer.
  success: Given un contact existant, when je demande au copilote de lui écrire un message (canal précisé ou déduit), then un message **brouillon** est persisté lié à ce contact, généré par le MÊME pipeline voix+`sanitize()` que le Composeur manuel (tiret cadratin remplacé, Tells strippés, longueur canal-aware), `statut = "brouillon"` ; AUCUN passage à `"envoye"` et AUCUN appel de sortie externe n'est déclenché par l'agent ; un test prouve que le texte est passé par `sanitize()` et qu'aucun message ne franchit l'état `"envoye"` par le chemin agent.

- id: CAP-3
  intent: L'utilisateur colle un bloc de texte libre nommant plusieurs personnes ; l'agent parse le vrac en N contacts structurés dans sa boucle de raisonnement, puis appelle le write-tool `importContacts` qui les persiste via la vraie fonction métier `contactsRepository.bulkCreate` (dédup intra-lot + réactivation des archivés), en VRAIE donnée, borné et réversible.
  success: Given un bloc collé nommant plusieurs personnes, when je demande au copilote de les importer, then N contacts réels sont créés via `bulkCreate` (retour `{created, merged}` — les doublons fusionnent, ne doublent pas), scopés à mon compte, `source ≠ "seed"`, réversibles par soft-delete ; un lot déraisonnable est clampé par un plafond serveur (parité `seedContacts` MAX_SEED) ; un test prouve la déduplication, l'isolement cross-tenant et le plafond. (La rédaction d'un message par contact se fait par l'agent qui chaîne `composeMessage` (CAP-2), pas par un tool couplé — voir Constraints.)

- id: CAP-4
  intent: Les trois nouveaux write-tools se reflètent en TEMPS RÉEL dans l'UI sans reload en HÉRITANT du mécanisme de sync générique d'inc.2 (pont d'invalidation), sans aucun nouveau code de sync — vérification que la promesse « un futur write-tool hérite de la sync sans câblage dédié » (inc.2 CAP-2) se réalise.
  success: Given le popup copilote ouvert sur l'onglet Réseau, when `createContact` ou `importContacts` s'exécute, then les contacts apparaissent dans la galerie SANS reload ; le SEUL changement lié à la sync est l'ajout des noms de tools à `WRITE_TOOL_NAMES` (tools.server.ts) — aucun nouveau `router.refresh()`, aucun chemin de sync par tool ni par page ; une revue de diff confirme zéro nouveau mécanisme de sync.

## Constraints

- **Les write-tools n'implémentent AUCUNE logique BDD** — ils orchestrent les repositories existants via la porte scopée `db.forUser` (Archi #1, parité `queryContacts`/`seedContacts`). `createContact` → `contactsRepository.create` ; `importContacts` → `contactsRepository.bulkCreate` ; `composeMessage` → pipeline Composeur + persistance message via le repository. Aucun `insert` direct, aucun accès drizzle/schéma sous un tool.
- **`composeMessage` RÉUTILISE le pipeline du Composeur existant, ne le réinvente pas.** Il passe par l'assemblage du corpus voix (seed de voix + messages envoyés via `listSentTexts` + sélection few-shot), la génération (`generateMessage` / `@/lib/claude.server`) ET le `sanitize()` déterministe côté serveur (remplacement tiret cadratin, NFC, trim, blacklist des Tells), génération **canal-aware** (LinkedIn court / Email structuré / WhatsApp-SMS ultra-court). Le moat (voix, Tells, SM-1 distance d'édition) s'applique à l'identique. Factoriser ce pipeline en une fonction serveur partagée appelée à la fois par `/api/composer` et par `composeMessage` — pas de duplication du moat.
- **L'agent RÉDIGE, n'ENVOIE jamais** (Sécu #4 + `project-context.md` : « Aucun chemin d'auto-send au MVP »). `composeMessage` ne persiste qu'un `statut = "brouillon"` ; le passage à « Envoyé » reste l'action humaine du parcours UI existant (copier → marquer Envoyé). Aucun tool de sortie externe n'existe dans cet incrément ; la frontière R/W interdit d'en introduire un côté écriture sans renégociation.
- **Provenance VRAIE donnée, distincte du test.** `createContact` / `importContacts` écrivent `source ∈ {"manuel","rapide"}`, JAMAIS `"seed"` (réciproque exacte de la discipline inc.1). Vraie donnée et donnée de test restent triviallement distinguables par le prédicat `source`.
- **Toute mutation réversible par construction, aucun hard-delete.** Les contacts via le soft-delete existant (`archivedAt`). Un brouillon créé par l'agent doit être tout aussi réversible (effaçable) sans hard-delete ; l'entité `Message` n'offre pas aujourd'hui de soft-delete — voir Assumptions pour le chemin minimal requis.
- **`userId` clos par closure, jamais argument de l'agent** (Sécu #3, parité Phase 1/2). Le périmètre tenant est injecté depuis la session next-auth sous la couche tool ; l'agent ne le reçoit ni ne le contrôle.
- **Frontière R/W — écriture vers l'intérieur seulement** (Sécu #2). Toutes les écritures passent par les repositories internes de Plume. Aucun write vers l'auth, OAuth, le web, ou une ressource externe ; ces tools n'existent pas ici et la frontière interdit de les introduire côté écriture.
- **Zod à chaque frontière de tool ; comptes et lots bornés côté serveur** (Sécu #6, parité `seedContacts` MAX_SEED). `importContacts` plafonne un lot déraisonnable (clamp, pas honoré) ; `composeMessage` est borné par tour pour éviter une rafale de générations coûteuses (un argument absent/aberrant ne lance pas de boucle).
- **`sanitize()` s'applique à TOUT texte de message produit par l'agent** (compose, et tout message rédigé au fil d'un import) avant écriture BDD — parité avec `project-context.md` (« `sanitize()` passe AUSSI à l'import »). Le prompt seul ne suffit pas : le code strippe et re-valide avant persistance.
- **`selectTrustedTurns` maintenu (inc.1 CAP-3, non négocié).** Le serveur ne fait confiance qu'aux tours `user` (filtre à la frontière HTTP + défense en profondeur dans `runAgentChat`).
- **Provider = Vercel AI SDK multi-provider pour la boucle agent** (Gemini free en dev, Sonnet en prod) — pas le SDK Anthropic nu. Note : la génération de `composeMessage` réutilise le chemin Composeur existant (`@/lib/claude.server`, `@anthropic-ai/sdk`), distinct du provider de la boucle agent — c'est le moteur de génération de message déjà en place, autorisé (la barrière ESLint #2 restreint `ai`/`@ai-sdk/*`, pas `@anthropic-ai/sdk`), pas une entorse.
- **Sync GÉNÉRIQUE héritée, jamais re-spécifiée.** Les trois tools rejoignent l'ensemble `WRITE_TOOL_NAMES` (tools.server.ts) et réutilisent l'unique `router.refresh()` de fin de stream posé en inc.2. AUCUN nouveau code de sync, aucun chemin par tool/par page. (Vérifié par CAP-4.)
- **Parité sécu Phase 1/2 intégralement préservée** : modules `server-only`, barrières ESLint (`ai`/`@ai-sdk/*`/drizzle), `auth()`→401, erreurs douces (jamais de stack/500 au client), route via le wrapper `runAgentChat` (jamais le SDK nu), réponse via `toUIMessageStreamResponse` (erreur in-band d'inc.2 conservée).
- **Finition design-system préservée.** Toute affordance UI nouvelle (ex. présentation d'un brouillon rédigé par l'agent dans le chat ou côté contact) respecte pleinement `project-context.md` : Fraunces + Quicksand, contour plein + hard offset (blur 0), mauve = action seule, erreurs en teinte douce, jamais d'esthétique « app IA générique ». Le popup copilote lui-même est inchangé ; les nouvelles mutations remontent via le chat existant et la galerie Réseau.

## Non-goals

- **Pas d'envoi externe ni d'auto-send** (Email/WhatsApp/SMS/LinkedIn), pas de nouveau bouton « Envoyer » comme action agent externe — l'agent rédige, l'humain envoie via l'UI existante. L'envoi réel via comptes connectés (avec human-in-the-loop explicite, Sécu #4) est une capacité ultérieure (Capacité #5 / V2).
- **Pas de web search, pas d'OAuth, pas d'accès externe** (Capacité #5 / V2). La frontière R/W reste interne-only.
- **Pas de `resetTestData`** (l'autre candidat inc.3) — la discipline test reste le soft-delete existant ; le tool de purge en bloc de la donnée `source = "seed"` est différé.
- **Pas de mega-tool « import-qui-compose ».** `importContacts` crée des contacts uniquement ; la rédaction d'un message par contact est l'agent qui CHAÎNE `composeMessage` (composabilité, parité avec le design mono-responsabilité des tools existants), bornée pour le coût. Pas de tool couplé import+compose.
- **Pas de refonte du Composeur UI ni du moat voix.** `composeMessage` réutilise le pipeline existant ; il ne touche ni l'UI du Composeur, ni la sélection few-shot, ni la blacklist des Tells.
- **Pas de nouveau mécanisme de sync** — réutilise le pont d'invalidation d'inc.2 (CAP-4).
- **Pas de journal d'actions ni de rewind transactionnel** (Sécu #1 / V1) — la réversibilité reste le soft-delete existant.
- **Pas de mémoire ni d'historique persistant** (Capacité #6 / V2). L'état du chat reste en-session ; rien n'est relu entre sessions.

## Success signal

Depuis le popup du copilote sur l'onglet Réseau, je tape « ajoute Sophie Martin, CTO chez Acme » : un **vrai** contact (`source = "manuel"`, pas `seed`) apparaît dans la galerie **sans que je recharge**. Je dis « écris-lui un message LinkedIn » : un **brouillon** rédigé par mon moat de voix (Tells strippés, longueur canal-aware) se persiste, lié à Sophie, visible, `statut = "brouillon"` — et **rien n'est envoyé**. Je colle un bloc de dix personnes : dix contacts réels créés en bloc, dédupliqués, live. Le copilote est devenu l'assistant produit (advisor → doer) : il crée de la vraie donnée et rédige dans ma voix, sans jamais envoyer à ma place ni ouvrir une écriture externe — et chaque mutation se reflète à l'écran via la sync héritée, sans une ligne de code de sync en plus.

## Assumptions

- **Chemin de persistance d'un brouillon.** `messagesRepository` expose `markSent` (insère en `"envoye"`, transactionnel, met à jour `dernierContactAt` + `generation_events`), `editSent`, `setStatus`, `getById`, `listForContact`, `listSentTexts` — mais AUCUNE méthode d'insertion d'un brouillon constatée. `composeMessage` a besoin de persister `statut = "brouillon"` (sans `dernierContactAt`, sans `generation_events` d'envoi) ; une méthode repository dédiée (ex. `createDraft`) est probablement à ajouter au repository (le repo implémente la BDD, le tool orchestre — parité). Sans incidence sur le contrat ; à confirmer au dev.
- **Réversibilité des brouillons.** L'entité `Message` n'a pas d'`archivedAt` (jamais de soft-delete ; l'archivage du contact cascade). Un brouillon créé par l'agent doit rester réversible sans hard-delete. Deux options acceptables, à trancher au dev : (a) la cascade d'archivage du contact suffit comme réversibilité du brouillon (option la plus simple, zéro changement de schéma) ; ou (b) ajout d'un chemin de retrait minimal au repository des messages. Aucune n'autorise le hard-delete.
- **Pipeline Composeur factorisable.** L'assemblage du corpus voix (seed de voix + `listSentTexts` + `selectFewShot`) est aujourd'hui inline dans `/api/composer/route.ts`. `composeMessage` doit appeler le même pipeline ; l'extraire en fonction serveur partagée évite la duplication du moat. Choix d'implémentation, sans incidence sur le contrat.
- **Canal par défaut de `composeMessage`.** `Message.canal` est NOT NULL ; le tool doit fixer un canal — défaut = `contact.canalPrefere`, sinon canal passé en argument validé zod, sinon défaut projet. À confirmer au dev.
- **Le parsing du vrac est le travail de l'agent.** La structuration texte-libre → contacts se fait dans la boucle de raisonnement de l'agent (LLM) ; `importContacts` ne reçoit que des contacts déjà structurés, validés par `inputSchema` zod. Le tool ne parse pas de texte libre.
- **Valeur `source` de l'import.** L'ajout vrac réutilise vraisemblablement `source = "rapide"` (sémantique « ajout rapide multiple » du MVP) ; `createContact` unitaire réutilise `source = "manuel"`. À confirmer au dev ; sans incidence sur le contrat tant que `source ≠ "seed"`.
