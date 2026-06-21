# Matrice op → inverse (journal d'actions / rewind)

Companion de [`SPEC.md`](SPEC.md). Contrat de réversibilité par tool : pour chaque write-tool (inc.3 création + inc.5 archive-tools réversibles, cf. [`../spec-copilote-phase-2-archive-tools/SPEC.md`](../spec-copilote-phase-2-archive-tools/SPEC.md)), quelle op le journal enregistre, quel `prevState` il capture, et quel inverse le rewind rejoue. Règle absolue, non négociée : **aucun inverse n'effectue de hard-delete** — tout inverse est un re-archivage (`archivedAt`), une restauration de champs (`prevState`), un désarchivage, ou un retrait soft.

## Forme d'une entrée `action_log`

| Champ | Rôle |
|-------|------|
| `userId` | Frontière tenant (scoping automatique par la porte `db.forUser`). |
| `turnId` | Groupe toutes les mutations d'un même run `runAgentChat`. Clos par closure, jamais argument agent. |
| `toolName` | Tool ayant déclenché la mutation (`createContact`, `composeMessage`, `importContacts`, …). |
| `entityType` | `contact` \| `message` (extensible). |
| `entityId` | Ligne touchée. |
| `op` | `created` \| `merged` \| `reactivated` \| `archived` \| `rewind`. Détermine l'inverse. |
| `prevState?` | État antérieur des champs touchés — REQUIS pour `merged`/`reactivated` ET pour `archived` (= `{archivedAt: null}`, l'inverse désarchive), omis pour `created`. |
| horodatage | Ordre LIFO du rewind (rejeu des inverses en ordre chronologique inverse). |

## Mapping par tool

| Tool | op enregistrée | prevState capturé | Inverse rejoué par le rewind |
|------|----------------|-------------------|------------------------------|
| `createContact` | `created` (ligne neuve) | — | Re-archivage : `archivedAt = now` sur le contact créé. |
| `createContact` | `merged` (collision `dedupKey` → fusion dans un contact vivant) | champs écrasés par la fusion | Restauration des champs à `prevState` (le contact préexistant survit intact). |
| `createContact` | `reactivated` (re-ajout d'un contact archivé → `archivedAt = null`) | `archivedAt` antérieur (≠ null) | Restauration de `archivedAt` antérieur (le contact retourne à l'état archivé) + restauration des champs si la réactivation en a écrasé. |
| `importContacts` | une entrée par contact du lot, chacune `created` \| `merged` \| `reactivated` | idem ci-dessus, par contact | idem ci-dessus, par contact, en LIFO. Retour `{created, merged}` du `bulkCreate` mappé entrée par entrée. |
| `composeMessage` | `created` (brouillon, `statut = "brouillon"`) | — | Retrait **soft** du brouillon (`archivedAt` sur `messages`, garde `statut = "brouillon"`). Jamais de `DELETE`. |
| `archiveContact` (inc.5, delete réversible) | `archived` (soft-delete d'un contact actif → `archivedAt = now`) | `{archivedAt: null}` | **Désarchivage** : restaure l'actif via `contacts.update(prevState)` — l'inverse exact d'un `archiveContact` de l'agent. Jamais un re-archivage aveugle. |
| `archiveContacts` (inc.5) | une entrée `archived` par contact du lot RÉELLEMENT archivé (lot atomique : une seule transaction via `bulkRemove`) | `{archivedAt: null}` par contact | Désarchivage de chaque contact du lot, en LIFO. Un id inconnu/déjà archivé ne journalise rien → rien à rejouer. |
| `archiveDraft` (inc.5) | `archived` (soft-delete d'un brouillon resté `statut = "brouillon"`) | `{archivedAt: null}` | **Désarchivage** via `messages.restoreDraft` (lève `archivedAt`, garde symétrique `statut = "brouillon"` : ne ressuscite jamais un message promu `envoye`). |
| _(rewind lui-même)_ | `rewind` | liste des `turnId` annulés | Aucun (entrée d'audit terminale ; non ré-inversable — pas de redo, voir Non-goals). |

## Règles d'invariance

- **`created` ⇒ archiver ; `merged`/`reactivated`/`archived` ⇒ restaurer `prevState`.** Ne jamais archiver un contact dont le tour n'a fait que modifier des champs : il préexistait, le rewind doit le rendre identique à avant le tour, pas le faire disparaître. C'est le cœur de CAP-3. Pour `archived`, `prevState = {archivedAt: null}` ⇒ la restauration **désarchive** (l'inverse d'un soft-delete agent), elle ne re-crée ni ne re-supprime.
- **Ordre LIFO.** Les inverses d'un tour (et des tours postérieurs) se rejouent en ordre chronologique inverse : un tour B qui a modifié une entité créée au tour A doit être annulé avant A pour que l'état soit cohérent.
- **Atomicité.** L'entrée `action_log` est écrite dans la MÊME transaction que la mutation (parité `markSent` + `generation_events`). Pas de mutation sans entrée, pas d'entrée sans mutation.
- **Le rewind est journalisé, pas effaçant.** Un rewind ajoute une entrée `op = "rewind"` ; il ne supprime jamais les entrées qu'il annule. Le journal reste un récit d'audit complet (actif SaaS).
- **Aucune entrée n'autorise un hard-delete.** Si un futur tool introduit une op dont l'inverse exigerait une suppression physique, c'est une renégociation de la frontière (interdit ici).
