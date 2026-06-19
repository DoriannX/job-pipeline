---
id: SPEC-copilote-phase-2-ui-sync
companions:
  - ../../implementation-artifacts/spec-copilote-phase-1-agent-chat.md   # archi du module agent que cet incrément branche à l'UI (adopted)
  - ../spec-copilote-phase-2-write/SPEC.md                                # frontière R/W + parité sécu à PRÉSERVER (adopted)
  - sync-mechanism-options.md                                            # 3 pistes de sync + recommandation (spec-authored)
sources:
  - ../../brainstorming/brainstorming-session-2026-06-19.md
  - ../../implementation-artifacts/deferred-work.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Copilote Phase 2 — incrément 2 : UI du copilote + sync temps réel des mutations

## Why

**Opportunité à capturer + dette à fermer.** Les incréments 1 (moteur tool-use, route `/api/agent/chat`) et Phase 2 inc.1 (premier write-tool `seedContacts`) ont prouvé que le copilote sait _agir_ — mais uniquement par curl/test : il n'a **aucune UI**. C'est le dernier verrou du MVP « ça marche pour toi » (brainstorm Thème C, UX #1 : icône flottante → popup chat). Cet incrément livre la **première surface visible** du copilote.

Mais brancher l'UI révèle un trou constaté au checkpoint inc.1 : `seedContacts` crée bien 10 contacts, **mais il faut recharger la page Réseau pour les voir**. Une UI qui ment sur l'état (l'agent dit « c'est fait », l'écran ne bouge pas) casse la confiance dès le premier usage. Il faut donc poser, EN MÊME TEMPS que l'UI, le **mécanisme de synchronisation temps réel** — générique, pas un patch par feature — pour que TOUTE écriture déclenchée par le copilote (aujourd'hui `seedContacts` ; demain `createContact`, `composeMessage`, import) se reflète dans l'UI sans reload. On ne livre pas juste un chat ; on livre la **boucle de feedback** du copilote : il agit ET l'écran le montre.

L'arrivée de l'UI rend aussi pertinente une dette de Phase 1 (`deferred-work.md`) : une erreur en plein stream est aujourd'hui journalisée mais **invisible** au client. Avec une UI, un flux tronqué silencieux ressemble à un succès — on ferme cette dette ici en surfaçant l'erreur in-band.

## Capabilities

- id: CAP-1
  intent: Depuis n'importe quel onglet de l'app, l'utilisateur ouvre le copilote (icône flottante → popup chat), tape une demande en langage naturel et voit la réponse de l'agent se streamer dans le popup — première surface UI du copilote, sur la route serveur existante.
  success: Given une session valide, when je clique l'icône du copilote sur l'onglet Réseau (ou Aujourd'hui / Réglages) et que je tape « combien j'ai de contacts », then le popup s'ouvre et affiche la réponse streamée de l'agent (le compte réel scopé à mon compte), sans qu'aucune clé API n'apparaisse côté réseau navigateur ; l'icône est présente sur les 3 onglets.

- id: CAP-2
  intent: Toute écriture déclenchée par le copilote se reflète dans l'UI en TEMPS RÉEL, sans reload manuel, via un mécanisme GÉNÉRIQUE qui couvre toutes les mutations d'un coup — un futur write-tool hérite de la sync sans câblage dédié.
  success: Given le popup copilote ouvert sur l'onglet Réseau, when je tape « crée 10 contacts au hasard » et que l'agent exécute `seedContacts`, then les 10 contacts apparaissent dans la galerie Réseau SANS que je recharge la page ; un test/démo prouve que la galerie reflète la mutation après le tour d'écriture, et le mécanisme est branché en un seul point (pas dupliqué par tool/par page).

- id: CAP-3
  intent: Une erreur survenant EN PLEIN stream (provider 429/5xx, coupure, tool qui jette) est rendue visible à l'utilisateur dans le chat comme une fin terminale lisible, plutôt que journalisée en silence — fermeture de la dette Phase 1 « erreur in-band côté client ».
  success: Given une génération en cours, when le stream échoue en milieu de course, then le popup affiche un message d'erreur doux (famille de couleurs douce, jamais de stack/rouge alarme) et l'utilisateur comprend que le tour a échoué ; le flux n'est pas figé sur une bulle tronquée prise pour un succès. Un test prouve qu'un échec mid-stream produit un token d'erreur terminal côté client.

## Constraints

- **Mécanisme de sync GÉNÉRIQUE et transverse — jamais un patch par feature.** La sync doit couvrir TOUTES les mutations du copilote d'un seul mécanisme, branché en UN point. Quand `createContact` / `composeMessage` / import arriveront comme write-tools, ils héritent de la sync **sans nouveau code de sync**. Une implémentation qui câble la sync tool-par-tool ou page-par-page viole cette contrainte. (Préférer le mécanisme le plus haut niveau — voir companion `sync-mechanism-options.md`.)
- **Mécanisme décidé : pont d'invalidation (piste A).** La sync reflète la VÉRITÉ SERVEUR via le flux de données existant. La page Réseau est un server component qui lit les contacts par la porte scopée (`db.forUser`) et dérive la froideur à la lecture ; le client re-rend via `router.refresh()` après mutation (pattern déjà en place pour les server actions). Le copilote réutilise CE levier : après un tour d'écriture, le client déclenche `router.refresh()`, qui re-rend le segment courant (relecture `db.forUser`). PAS de cache/store client parallèle (écarte piste C), PAS d'events de mutation métier appliqués côté client (écarte piste B) — les deux feraient fuiter de la logique ou une source de vérité côté client.
- **Déclencheur décidé : un seul `router.refresh()` en fin de stream, conditionné à « le run a appelé ≥1 write-tool ».** Le serveur détermine côté serveur si le run a comporté une écriture et expose ce fait en fin de flux ; le client refresh UNE fois, jamais à chaque token, et rien si le run était read-only.
- **Le front reste « bête » (brainstorm Archi #3).** Le composant copilote POST vers `/api/agent/chat`, rend le flux, applique le signal de sync — rien de plus. Zéro logique métier, zéro accès repository/DB, zéro scope tenant côté client. La clé API ne touche JAMAIS le navigateur (toute la dangerosité reste derrière la route serveur).
- **Passage à `toUIMessageStreamResponse`.** La route renvoie aujourd'hui `toTextStreamResponse` (suffisant pour curl, pas d'erreur in-band). Pour surfacer l'erreur terminale (CAP-3) — et porter un éventuel signal de mutation si le design retient la voie serveur→client — la réponse passe au flux UI message du SDK. Le canal d'erreur du flux UI porte l'échec mid-stream ; pas de protocole d'erreur ad-hoc.
- **`selectTrustedTurns` maintenu (CAP-3 inc.1, non négocié).** L'UI peut envoyer un historique de conversation, mais le serveur ne fait toujours confiance qu'aux tours `user` (filtre à la frontière HTTP + défense en profondeur dans `runAgentChat`). L'UI ne doit pas supposer que ses tours `assistant` rejoués font autorité.
- **Parité sécu Phase 1/2 intégralement préservée** : modules `server-only`, barrières ESLint (`ai`/`@ai-sdk/*`/drizzle), `auth()`→401, erreurs douces (jamais de stack/500 au client), route via le wrapper `runAgentChat` (jamais le SDK nu), `userId` clos par closure (jamais argument agent), frontière R/W écriture interne-only.
- **Finition design-system PLEINE dès cet incrément (décidé).** L'icône/popup est pleinement conforme aux règles `project-context.md` d'emblée — pas de MVP « stylé assez » à polir plus tard : Fraunces + Quicksand (jamais Inter/emoji-icône), contour plein + hard offset (box-shadow blur = 0), mauve = action uniquement, mascotte plume, rayons/espacements de l'échelle figée, erreurs en teinte douce (jamais rouge alarme). Pas d'esthétique « app IA générique » (gradient/glassmorphism interdits) — c'est la feature phare, elle est belle tout de suite.

## Non-goals

- **Pas de nouveaux write-tools** (`createContact` sur saisie réelle, `composeMessage`, import vrac) — capacités Thème B ultérieures. Mais le mécanisme de sync (CAP-2) est conçu pour les couvrir à leur arrivée sans recâblage.
- **Pas d'UI optimiste ni de prédiction de mutation côté client.** La sync reflète la vérité serveur APRÈS le tour d'écriture, pas une supposition spéculative affichée avant confirmation (évite la divergence client↔base ; garde le mécanisme simple).
- **Pas de persistance de conversation ni de mémoire** (Capacité #6 / V2). L'état du chat est en-session seulement ; rien n'est stocké côté serveur, aucun historique relu entre sessions.
- **Pas de human-in-the-loop send ni d'action externe** (Sécu #4, Capacité #5 / V2) — le copilote n'envoie rien au nom de l'utilisateur, ne touche ni web ni OAuth.
- **Pas de journal d'actions ni de rewind transactionnel** (Sécu #1 / V1) — la réversibilité reste le soft-delete existant.
- **Pas de sync custom par page.** Un seul mécanisme générique ; pas de chemin de rafraîchissement spécifique à l'onglet Réseau qui ne servirait pas les autres surfaces.

## Success signal

Depuis l'onglet Réseau, je clique l'icône du copilote, le popup s'ouvre, je tape « crée 10 contacts au hasard » et je regarde la réponse de l'agent se streamer. Quand il a fini, **les 10 contacts sont déjà là dans la galerie — je n'ai rien rechargé**. Si le stream avait échoué en route, j'aurais vu un message d'erreur doux dans le chat, pas une bulle figée. Et quand `createContact` deviendra un write-tool, ses créations apparaîtront live de la même façon, sans une ligne de sync en plus. Le copilote a une voix, un visage, et l'écran ne ment plus sur ce qu'il vient de faire.

## Assumptions

- **Guides Next non bundlés.** Le dossier `node_modules/next/dist/docs/` n'existe pas dans cette version (`next@16` installé) — absent à la vérification. Le mécanisme de sync décidé (pont d'invalidation) s'appuie sur le **pattern déjà présent dans le repo** (server action → `revalidatePath` + client `router.refresh()`), pas sur des guides bundlés.
- **Point de montage.** Le copilote se monte dans `src/app/(app)/layout.tsx` (point unique présent sur les 3 onglets, à côté de `ComposerSheet`) — comme l'exige « présent partout, jamais intrusif » (UX #1).
- **Client de stream.** `useChat` (AI SDK React) est le consommateur probable de `toUIMessageStreamResponse` côté client ; à confirmer au design.

<!-- Décisions tranchées par Monsieur (2026-06-19), désormais contractuelles :
  - Mécanisme de sync = pont d'invalidation (piste A). Voir Constraints + companion.
  - Déclencheur = un seul router.refresh() en fin de stream si ≥1 write-tool appelé. Voir Constraints.
  - Finition UI = pleinement design-system dès cet incrément. Voir Constraints.
  Aucune open question résiduelle. -->

</content>
</invoke>
