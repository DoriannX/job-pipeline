---
id: SPEC-copilote-phase-2-write
companions:
  - ../../implementation-artifacts/spec-copilote-phase-1-agent-chat.md   # architecture du module agent que cet incrément ÉTEND (adopted)
sources:
  - ../../brainstorming/brainstorming-session-2026-06-19.md
  - ../../implementation-artifacts/deferred-work.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Copilote Phase 2 — incrément 1 : frontière écriture + tool `seedContacts`

## Why

**Opportunité à capturer.** La Phase 1 a posé le moteur du copilote (boucle tool-use serveur, route `/api/agent/chat`, scope tenant, bornes de coût) mais avec un seul tool **read-only** (`queryContacts`). Le copilote ne peut encore rien _faire_. Cet incrément ouvre l'écriture — la moitié qui transforme « il répond » en « il agit » — par le premier write-tool, `seedContacts` (Thème B du brainstorm, indicateur de succès MVP : « crée 10 contacts au hasard »).

Mais ouvrir l'écriture rouvre la surface de risque (injection, massacre de données, fuite cross-tenant, amplification de coût). Le brainstorm impose donc de poser la **frontière lecture/écriture (Sécu #2)** en même temps que le premier write-tool : c'est le patron que tous les futurs tools d'écriture (`createContact`, `composeMessage`, import vrac) hériteront. On ne livre pas juste un tool ; on livre la **discipline d'écriture** du copilote, démontrée sur un cas réversible et sans danger (de la fausse donnée de test, taguée et annulable).

## Capabilities

- id: CAP-1
  intent: Depuis le chat, l'utilisateur demande en langage naturel de générer N faux contacts de test (ex. « crée 10 contacts au hasard ») ; l'agent appelle le write-tool `seedContacts(N)` qui crée N contacts fabriqués via la vraie fonction métier `contactsRepository.create`, scopés à l'utilisateur courant.
  success: Given une session valide, when je POST `{"message":"crée 10 contacts au hasard"}` sur `/api/agent/chat`, then N contacts fabriqués apparaissent en BDD chez l'utilisateur courant ET sont distinguables des vrais contacts (tag de provenance test) ET aucun n'apparaît chez un autre tenant ; un test prouvant l'isolement cross-tenant passe.

- id: CAP-2
  intent: Les contacts de test générés sont annulables — l'utilisateur (ou un appel ultérieur) peut les retirer en bloc sans toucher aux vrais contacts.
  success: Given des contacts de test créés par `seedContacts`, when on les retire via le soft-delete existant (`remove`/`archivedAt`), then ils disparaissent des lectures de la porte et aucun vrai contact n'est affecté ; un test prouve que le prédicat de tag isole exactement la donnée de test.

- id: CAP-3
  intent: L'historique de conversation fourni par le client ne peut pas amorcer l'agent avec un faux contexte — le serveur valide/limite les tours reçus avant de les passer au modèle, fermant la surface d'injection avant l'ouverture de l'écriture (dette Phase 1).
  success: Given un body `/api/agent/chat` contenant des tours `assistant` fabriqués par le client, when la route traite la requête, then ces tours falsifiés sont écartés/rejetés avant tout appel modèle (l'agent ne raisonne que sur des tours dignes de confiance) ; un test prouve qu'un faux tour `assistant` injecté ne déclenche pas `seedContacts` ni ne pré-charge de contexte.

## Constraints

- **Le write-tool n'implémente AUCUNE logique BDD** — il orchestre le repository existant via la porte scopée (Archi #1, parité avec `queryContacts`). `seedContacts` boucle sur le vrai `contactsRepository.create` ; il ne fait ni `insert` direct, ni accès drizzle/schéma.
- **`userId` clos par closure, jamais argument de l'agent** (Sécu #3, parité Phase 1). L'agent ne reçoit ni ne contrôle le périmètre tenant ; il est injecté depuis la session next-auth sous la couche tool.
- **Frontière R/W — écriture vers l'intérieur seulement** (Sécu #2). Les seules écritures autorisées passent par les repositories internes de Plume. Aucun write vers l'auth, les comptes connectés (OAuth), le web, ou toute ressource externe — ces tools n'existent pas dans cet incrément, et la frontière interdit de les introduire côté écriture sans renégociation.
- **Toute écriture de l'agent est réversible par construction.** `seedContacts` n'utilise que le soft-delete existant (`archivedAt`) ; aucun hard-delete. (Le journal d'actions transactionnel / rewind par tour — Sécu #1 — n'est PAS requis ici ; la réversibilité repose sur le soft-delete déjà en place.)
- **La donnée de test est taguée par `source = "seed"`** — valeur ajoutée à l'enum `SOURCES` existant (`["manuel","rapide","import_csv"]`), pas de nouvelle colonne. Le nettoyage devient un prédicat unique (`where source = 'seed'`) et la donnée de test ne peut JAMAIS être confondue avec une vraie donnée (Archi #1). La valeur `"seed"` est ajoutée à `SOURCES` (zone neutre `domain/enums`) et au schéma de validation zod de la frontière.
- **`seedContacts` est plafonné côté serveur**, indépendamment de la valeur fournie par l'agent ou le client (Sécu #6, parité avec les bornes de payload Phase 1). Un N déraisonnable est clampé, pas honoré.
- **Zod à la frontière du tool.** Le `count` est validé et borné par le `inputSchema` zod du tool ; un argument absent/aberrant ne lance pas une boucle de création.
- **L'historique client n'est pas digne de confiance** (CAP-3). La route ne passe au modèle que des tours validés : ne conserver que les tours `user`, ou valider/borner strictement les tours `assistant`/`tool` reçus. Un faux tour `assistant` fourni par l'appelant ne doit jamais devenir du contexte modèle. (Ferme la dette Phase 1 `deferred-work.md` avant l'ouverture de l'écriture.)
- **Parité sécu Phase 1 préservée** : modules `server-only`, barrières ESLint (`ai`/`@ai-sdk/*`/drizzle), erreurs douces (jamais de stack/500 au client), `auth()`→401. La route continue de passer par le wrapper `runAgentChat`, jamais le SDK nu.

## Non-goals

- **Pas de tool de nettoyage `resetTestData`** cet incrément — la réversibilité passe par le soft-delete existant ; le tool de purge en bloc dédié est l'incrément suivant.
- **Pas de write-tool sur de la VRAIE donnée** (`createContact` saisie réelle, `composeMessage`, import vrac texte-libre) — capacités Thème B ultérieures.
- **Pas d'UI** (icône flottante / popup chat) — validation toujours par curl/test, comme Phase 1.
- **Pas de web search, pas d'OAuth, pas d'écriture externe** (Capacité #5 / V2).
- **Pas de journal d'actions ni de rewind transactionnel** (Sécu #1 / V1).
- **Pas de mémoire ni d'historique persistant** (Capacité #6). CAP-3 durcit l'historique reçu dans la requête ; il ne stocke ni ne relit aucun historique entre sessions.

## Success signal

Je tape « crée 10 contacts au hasard » dans un POST sur `/api/agent/chat` avec une session valide, et 10 lignes de contacts fabriqués — clairement tagués « test », scopés à mon compte, supprimables en bloc et invisibles pour tout autre utilisateur — apparaissent réellement en base. Le copilote vient de _faire_ quelque chose pour la première fois, sans qu'aucun chemin n'ouvre une écriture dangereuse, externe ou irréversible.

## Assumptions

- **Données fabriquées via un générateur.** `@faker-js/faker` n'est pas installé ; la génération de faux noms/entreprises se fait soit en ajoutant cette dépendance (dev), soit via un petit générateur inline. Choix d'implémentation laissé au dev ; sans incidence sur le contrat.
- **Idempotence de dédup tolérée.** `contactsRepository.create` déduplique par `dedupKey` (nom+entreprise/email) ; deux seeds aléatoires entrant en collision fusionnent au lieu de doubler — comportement acceptable (un seed re-créé n'invente pas de doublon).
