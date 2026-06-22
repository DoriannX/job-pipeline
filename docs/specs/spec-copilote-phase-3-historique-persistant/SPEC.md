---
id: SPEC-copilote-phase-3-historique-persistant
companions:
  - data-model.md                                                          # tables proposées conversations + chat_messages, lien turnId↔action_log — spec-authored
  - architecture-diagrams.md                                               # flux client→route→runAgentChat→DB (contexte chargé serveur) — spec-authored (diagrammes)
  - ../spec-copilote-phase-2-rewind/SPEC.md                                # action_log + turnId par tour que cet incrément RELIE au fil persisté (adopted)
  - ../spec-copilote-phase-2-ui-sync/SPEC.md                               # popup copilote + sync dont HÉRITE l'UI de reprise (adopted)
  - ../../implementation-artifacts/spec-copilote-phase-1-agent-chat.md     # archi du module agent (runAgentChat, selectTrustedTurns, scope clos par closure) (adopted)
  - ../../project-context.md                                               # design-system + scoping user_id + server-only + frontière moat (adopted)
sources:
  - ../../implementation-artifacts/deferred-work.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Copilote Phase 3 — historique de conversation persistant

## Why

**Pain à résoudre : le copilote n'a aucune mémoire au-delà de la session.** Depuis l'inc.2, la conversation du copilote vit en RAM client seulement (`CopiloteSheet.tsx:8` : « Conversation EN-SESSION seulement (aucune persistance — non-goal) »). Fermer le popup ou recharger la page = fil perdu, page blanche à la réouverture. L'agent doer de confiance (inc.3/4) qui sait créer, importer, rédiger et tout annuler oublie tout dès qu'on ferme l'onglet : aucun retour sur une discussion d'hier, aucun fil parallèle. La capacité « mémoire/historique persistant » a été listée en non-goal V2 à CHAQUE incrément (inc.2→4, « Capacité #6 / V2 ») ; cet incrément la livre.

**Opportunité + dette de sécurité à solder.** Le multi-tour actuel (inc.3) reconstruit la conversation envoyée au modèle depuis le **body client** (`{messages}` → `selectTrustedTurns`). Le client est donc la SEULE source des tours `assistant`, et `deferred-work.md` note explicitement la renégociation due : « multi-tour réel ⇒ valider/signer les tours `assistant` côté serveur plutôt que les écarter ». Persister la conversation côté serveur résout les deux d'un coup : le fil scopé tenant devient (a) un **actif produit** (reprise, fils multiples, historique consultable, réutilisable au SaaS) ET (b) la **source de vérité serveur** du contexte multi-tour — le navigateur n'a plus à être cru sur le passé, un faux tour `assistant` fabriqué côté client ne peut plus influencer la génération. Le fil persisté porte aussi le `turnId` de chaque tour ayant écrit (déjà journalisé dans `action_log` à l'inc.4) : la matérialisation du point de rewind, jusqu'ici éphémère (inc.4 : « le côté chat est éphémère »), peut enfin survivre au reload.

## Capabilities

- id: CAP-1
  intent: Chaque échange du copilote (le message `user` ET le texte `assistant` final du tour) est persisté en base, regroupé par **conversation** (fil), via un repository scopé `db.forUser` — le route handler et les tools n'écrivent aucune logique BDD de persistance en direct.
  success: Given une session valide et une conversation active, when je POST un message et que l'agent répond, then une ligne `chat_messages` est écrite pour le tour `user` PUIS pour le tour `assistant` (texte final), toutes deux rattachées au même `conversationId` et scopées à l'utilisateur courant, ordonnées (horodatage/séquence), et aucune n'est visible pour un autre tenant ; un test prouve la persistance des deux rôles, le rattachement au fil, l'ordre, et l'isolement cross-tenant 2-users.

- id: CAP-2
  intent: À l'ouverture du popup (mount/reload), l'utilisateur retrouve son fil actif rechargé depuis la base — la conversation s'affiche telle qu'elle était, plus de page blanche.
  success: Given une conversation de N échanges persistée, when je recharge la page ou ferme puis rouvre le popup, then le popup affiche les tours `user`/`assistant` du fil depuis la DB (scopés, dans l'ordre, bornés au plus récent — voir Constraints), et NON un fil vide ; un test ou une démonstration prouve la réhydratation depuis la DB après reload.

- id: CAP-3
  intent: Le contexte multi-tour envoyé au modèle est reconstruit CÔTÉ SERVEUR depuis la conversation persistée et scopée, plus depuis le body client — le client n'envoie que le NOUVEAU message `user` (+ l'identifiant du fil), jamais l'historique `assistant`.
  success: Given une conversation persistée, when le client POST uniquement `{ conversationId, message }`, then `runAgentChat` charge les tours antérieurs du fil via la porte scopée (jamais depuis le body) avant d'appeler le modèle, et un tour `assistant` fabriqué dans un body client ne peut plus entrer dans le contexte ; un test prouve que l'historique vient de la DB (un body client ne contenant qu'un faux passé `assistant` n'influence pas la génération) et que le chargement reste scopé tenant (impossible de cibler le fil d'un autre user).

- id: CAP-4
  intent: L'utilisateur gère ses **fils multiples** depuis le popup : démarrer une nouvelle conversation, consulter la **liste** de ses fils passés, en **rouvrir** un, le **renommer**, et l'**archiver** (soft) — le tout scopé tenant.
  success: Given plusieurs fils persistés, when j'ouvre la liste des conversations, then j'y vois mes fils (titre + récence, scopés à moi seul), je peux en rouvrir un (son transcript se recharge, CAP-2), le renommer (le nouveau titre persiste), l'archiver (il sort des lectures par soft-delete `archivedAt`, jamais hard-delete) et créer une nouvelle conversation (nouveau `conversationId`, popup vide) sans toucher les autres ; un test prouve la liste scopée (aucun fil d'un autre tenant), la réouverture, le renommage persistant, l'archivage soft, et qu'aucune opération n'écrase ni ne supprime physiquement un fil.

- id: CAP-5
  intent: L'affordance **« annuler ce tour »** (rewind, inc.4) survit au reload : sur les tours `assistant` rechargés ayant écrit, le bouton de rewind est réhydraté depuis le `turnId` persisté.
  success: Given un fil persisté contenant un tour qui a créé des contacts/brouillons (donc avec `turnId`), when je recharge la page et rouvre ce fil, then l'affordance « annuler ce tour » réapparaît sur ce tour (réhydratée via le `turnId` stocké sur la ligne `chat_messages`), un clic rejoue les inverses du journal `action_log` exactement comme en-session (parité inc.4, aucune ligne hard-deletée), et un tour read-only rechargé n'offre PAS de rewind ; un test prouve la réhydratation du `turnId` et que le rewind d'un tour rechargé annule ses mutations.

- id: CAP-6
  intent: La rétention des fils est **bornée** : au-delà d'un seuil (plafond de fils par tenant et/ou ancienneté), les fils les plus anciens sont purgés en **soft** (archivés), pour contenir le coût DB sans jamais détruire de donnée physiquement.
  success: Given un tenant dont le nombre de fils (ou l'ancienneté d'un fil) dépasse le seuil retenu, when la borne s'applique (à l'écriture d'un nouveau fil ou à un balayage), then les fils excédentaires/les plus vieux passent à `archivedAt` (sortis des lectures), AUCUN n'est hard-deleté, et les fils sous le seuil sont intacts ; un test prouve le déclenchement au seuil, la sélection des plus anciens, et l'absence de `DELETE` physique. (Seuil exact = constante serveur, voir Constraints.)

## Constraints

- **Persistance via la porte scopée, AUCUNE logique BDD directe sous la route ou un tool** (Archi #1, parité `action_log`/`contactsRepository`). Les fils et messages de chat ont leur(s) propre(s) repository(ies) (ex. `conversationsRepository`/`chatMessagesRepository`) sur `db.forUser` ; aucun `insert`/`update`/`select` drizzle direct dans le route handler, `runAgentChat` ou un tool. Toute table porte `user_id` → scoping AUTOMATIQUE par la porte.
- **Le serveur devient la source de vérité du contexte ; le body client ne porte plus l'historique `assistant`** (solde la dette `deferred-work.md`). La frontière HTTP accepte `{ conversationId, message }` (nouveau message `user` seul) ; le contexte est chargé serveur depuis le fil persisté. `selectTrustedTurns` (qui écartait/filtrait les tours du body) devient inutile pour le contexte — le retirer du chemin de contexte ou le réduire à une défense résiduelle, mais ne JAMAIS recréer une dépendance au passé `assistant` fourni par le client.
- **On persiste le message `user` et le TEXTE `assistant` FINAL d'un tour ; pas la timeline intermédiaire.** Les chips tool-use (libellés d'outils affichés pendant le run) et les étapes intermédiaires de la boucle tool-use sont une **progression éphémère**, non persistée. À la réhydratation, on réaffiche le texte final, pas le détail des appels d'outils. (Voir Non-goals.)
- **Le fil de chat ne nourrit JAMAIS le corpus de voix / few-shot, et n'est PAS soumis à `sanitize()`** (frontière moat, parité « `sanitize()` à l'écriture » réservé au corpus d'outreach). La conversation copilote est un transcript d'assistance, pas un `Message` d'outreach : elle n'entre ni dans `seed_voix`, ni dans le few-shot, ni dans `generation_events`. Confondre les deux polluerait le moat (le risque n°1, SM-1).
- **Borne de contexte serveur (anti-coût / anti-DoS, parité `MAX_MESSAGES = 50` / `MAX_CONTENT = 8000`).** Le contexte multi-tour chargé depuis la DB et envoyé au modèle est PLAFONNÉ (nombre de tours et/ou taille) côté serveur ; un fil long est tronqué (fenêtre glissante sur les tours récents), jamais envoyé intégralement. La persistance, elle, garde tout le fil ; seul le contexte modèle est borné.
- **Table dédiée au transcript, distincte de `action_log`.** `action_log` (inc.4) est le journal des MUTATIONS (rewind/audit) ; le transcript de conversation est une donnée différente (tours de dialogue). Ne pas réutiliser `action_log` pour stocker le chat. Le LIEN entre les deux = le `turnId` : un tour `assistant` ayant écrit porte le `turnId` de son run (déjà présent dans `action_log`), ce qui permet de rattacher un message du fil à ses mutations. Forme des tables = [`data-model.md`](data-model.md).
- **Réversibilité / soft-delete (non négocié, parité Phase 1/2).** L'archivage d'un fil (CAP-4) ET la purge de rétention (CAP-6) sont SOFT (`archivedAt`), jamais un hard-delete. Le filtrage par la porte exclut les fils archivés des lectures (liste comprise). Aucun `DELETE` physique d'un fil ou d'un message de chat.
- **Titre d'un fil = début du 1er message `user`, tronqué — déterministe, AUCUN appel IA.** Le titre est posé à la création du fil (au 1er message `user`), par simple troncature côté serveur (constante de longueur). Le renommage (CAP-4) écrase ce titre par celui de l'utilisateur. Jamais de génération IA de titre (coût/latence pour zéro valeur moat).
- **Rétention bornée par une constante serveur (CAP-6).** Le seuil (plafond de fils par tenant et/ou ancienneté max) est une constante serveur explicite (parité `MAX_MESSAGES`/`MAX_HISTORIQUE` : borne nommée, pas magique), appliquée par la porte/un repository ; la purge est SOFT et ne touche jamais un fil sous le seuil. Valeur exacte du seuil = choix dev (voir Assumptions).
- **Parité sécu Phase 1/2/3 intégralement préservée** : modules `server-only`, barrières ESLint (`ai`/`@ai-sdk/*`/drizzle), `auth()` → 401 (ni lecture ni écriture de fil sans session ; le chargement d'un `conversationId` VÉRIFIE qu'il appartient au tenant courant — sinon 404/403, jamais le fil d'autrui), zod à la frontière (`conversationId` + `message` bornés), erreurs douces (jamais de stack/500 au client), route agent via le wrapper `runAgentChat`, réponse via `toUIMessageStreamResponse` (signal `didWrite` + `turnId` in-band conservés).
- **`turnId` reste clos par closure, jamais argument de l'agent** (SÉCU #3, inchangé inc.4). La persistance n'ouvre aucun nouveau canal où le client contrôlerait `turnId` ou ciblerait le fil/journal d'un autre tour : le client ne fait que RETENIR/RENVOYER un `conversationId` que le serveur valide.
- **Finition design-system préservée** (`project-context.md`). Toute nouvelle surface (bouton « nouvelle conversation », éventuelle reprise/liste) respecte : Fraunces + Quicksand, contour plein + hard offset (blur 0), **mauve = action seule** (« nouvelle conversation » est une action → mauve), erreurs en teinte douce (jamais rouge alarme), jamais d'esthétique « app IA générique ». La reprise ne doit pas alourdir le popup ni casser l'UX « partout, jamais intrusif » (UX #1).

## Non-goals

- **Pas de mémoire sémantique / résumé / embeddings du fil.** On persiste le transcript BRUT (parité « historique de contact stocké brut »), pas un résumé vectoriel ni une compression IA.
- **Pas de recherche plein-texte ni de filtrage dans les conversations** (rechercher un vieux fil par mot-clé). Reprise du fil actif + nouvelle conversation suffisent à cet incrément.
- **Pas de persistance de la timeline tool-use** (chips d'outils, étapes intermédiaires) — éphémère par construction. Seuls `user` + texte `assistant` final survivent.
- **Pas d'édition ni de suppression d'un message individuel** d'un fil passé. Le transcript est un récit, pas un document éditable.
- **Le fil de chat ne nourrit jamais le corpus de voix / few-shot / `generation_events`** (frontière moat dure).
- **Pas de sync temps réel multi-device du même fil** (le même fil ouvert sur deux appareils en simultané). Un appareil à la fois suffit au MVP ; la persistance assure la reprise, pas la co-édition live.
- **Pas de partage ni d'export dédié d'une conversation** dans cet incrément (l'export/suppression Privacy global du compte est traité ailleurs — Epic 5).
- **Pas de titres de fils générés par IA** (un appel modèle pour nommer chaque fil) — voir Open questions pour l'alternative triviale.
- **Pas d'envoi externe / auto-send, pas de web search / OAuth / accès externe** — inchangé depuis inc.3 ; la frontière R/W reste interne et non-destructive.

## Success signal

J'ouvre le copilote, je discute : « montre-moi mes contacts froids », puis « écris à Sophie un message LinkedIn ». L'agent répond, agit, je ferme l'app. Le lendemain je rouvre Plume et le popup : ma conversation d'hier est là, telle quelle — je continue le fil, et l'agent a bien le contexte (chargé depuis le serveur, pas reconstruit par mon navigateur). Le bouton **« annuler ce tour »** est toujours là sur l'échange d'hier qui avait créé des contacts. J'ouvre la **liste de mes fils**, j'en rouvre un plus ancien, j'en renomme un, j'**archive** celui qui ne sert plus, je clique **« nouvelle conversation »** pour repartir propre. Rien n'a été perdu à la fermeture, rien n'est jamais détruit physiquement, et un navigateur trafiqué ne peut plus fabriquer un faux passé : le serveur est la mémoire.

## Assumptions

- **Schéma proposé : `conversations` + `chat_messages`.** Une table `conversations` (`id`, `userId`, `titre?`, `archivedAt?`, `createdAt`, `updatedAt`) et une table `chat_messages` (`id`, `userId`, `conversationId`, `role`, `content`, `turnId?`, `createdAt`/séquence). Le contrat exige : scoping `user_id`, rattachement à un fil, rôle, ordre, et le lien optionnel `turnId` vers `action_log` (tours ayant écrit). Forme exacte et index laissés au dev. Détail dans [`data-model.md`](data-model.md). À confirmer au dev.
- **Fil chargé à l'ouverture = dernier fil actif du tenant.** À défaut de sélecteur multi-fils (voir Open questions), le popup reprend le fil le plus récemment mis à jour ; « nouvelle conversation » en crée un et le rend actif. À confirmer au dev.
- **Propagation du `conversationId`.** Le serveur crée/retourne le `conversationId` du fil actif au mount (ou au premier message d'un fil neuf) ; le client le RETIENT et le RENVOIE avec chaque message suivant. Le serveur le valide (appartenance tenant) à chaque appel. Mécanisme exact (data part du flux UI, réponse de mount, server action de bootstrap) = choix d'implémentation.
- **Persistance du tour `assistant` au bon moment.** Le texte `assistant` final est connu en fin de run `streamText` ; sa persistance s'insère à la fin du flux (parité du calcul `didWrite`/`turnId` déjà fait sur la part `finish`). Le seam exact (callback `onFinish` serveur vs écriture post-stream) est un choix d'implémentation ; le contrat exige seulement que `user` et `assistant` final soient persistés pour chaque tour réussi.
- **Lien rewind↔fil via `turnId` déjà disponible.** `action_log.turnId` existe (inc.4) ; rattacher le tour `assistant` persisté à son `turnId` ne requiert aucune nouvelle donnée côté journal, seulement de stocker le `turnId` (déjà renvoyé in-band) sur la ligne `chat_messages` — c'est ce qui rend CAP-5 (rewind après reload) gratuit côté journal.
- **Seuil de rétention (CAP-6) à fixer au dev.** La borne (ex. N fils max par tenant et/ou ancienneté max) est une constante serveur ; sa valeur exacte est un réglage produit/coût, pas un invariant — à trancher au dev (et ajustable). Le contrat exige seulement qu'une borne existe et que la purge soit SOFT.
