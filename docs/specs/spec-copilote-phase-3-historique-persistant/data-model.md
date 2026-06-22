# Modèle de données — historique de conversation persistant

Tables PROPOSÉES (forme et index à confirmer au dev). Invariants NON négociables : colonne
`user_id` (scoping automatique par `db.forUser`), soft-delete only, lien `turnId` vers
`action_log`. Patron = les tables existantes de `plume/src/lib/db/schema.ts` (id cuid2,
`userId` NOT NULL → `users` cascade, horodatage epoch ms via horloge injectée).

## `conversations` — un fil de discussion

| colonne       | type                         | rôle |
|---------------|------------------------------|------|
| `id`          | text PK (cuid2)              | identifiant opaque du fil |
| `user_id`     | text NOT NULL → users (cascade) | frontière tenant ; scoping automatique par la porte |
| `titre`       | text, nullable               | libellé du fil = **début du 1er message `user` tronqué** (déterministe, aucun appel IA), posé à la création ; écrasé par le renommage (CAP-4) |
| `archived_at` | integer (epoch ms), nullable | soft-delete (jamais de hard-delete) ; les lectures de la porte excluent les fils archivés |
| `created_at`  | integer (epoch ms)           | création |
| `updated_at`  | integer (epoch ms)           | dernière activité → sert à reprendre « le dernier fil actif » (CAP-2) |

## `chat_messages` — un tour de dialogue dans un fil

| colonne           | type                         | rôle |
|-------------------|------------------------------|------|
| `id`              | text PK (cuid2)              | identifiant opaque du tour |
| `user_id`         | text NOT NULL → users (cascade) | frontière tenant ; scoping automatique |
| `conversation_id` | text NOT NULL → conversations | rattachement au fil |
| `role`            | text `"user" \| "assistant"` | rôle du tour (jamais d'autre rôle persisté) |
| `content`         | text NOT NULL                | message `user` brut OU texte `assistant` FINAL (jamais la timeline tool-use) |
| `turn_id`         | text, nullable               | LIEN vers `action_log.turn_id` — renseigné sur le tour `assistant` d'un run AYANT écrit ; permet de réhydrater l'affordance rewind (cf. Open question) |
| `created_at`      | integer (epoch ms)           | ordre des tours dans le fil (séquence d'affichage + ordre du contexte modèle) |

## Notes de contrat

- **`chat_messages` ≠ `action_log`.** `action_log` journalise les MUTATIONS (rewind/audit) ;
  `chat_messages` est le TRANSCRIPT du dialogue. Le seul pont = `turn_id`. Ne pas fusionner.
- **`chat_messages` ≠ `messages` (outreach).** `messages` = les `Message` d'outreach qui
  nourrissent le moat (few-shot, `generation_events`, `sanitize()`). Le transcript copilote
  n'entre JAMAIS dans ce circuit (frontière moat, cf. SPEC Constraints).
- **Pas de `sanitize()`** sur `content` — réservé au corpus d'outreach, hors de propos ici.
- **Borne de contexte** (SPEC Constraint) : la lecture qui alimente le modèle plafonne le
  nombre de tours (fenêtre glissante sur les `created_at` récents) ; la table garde tout le fil.
- **Index utiles (au dev)** : `(user_id, updated_at)` sur `conversations` (reprise du dernier
  fil + tri de la liste CAP-4) ; `(conversation_id, created_at)` sur `chat_messages` (lecture
  ordonnée d'un fil).
- **Rétention (CAP-6)** : `archived_at` porte AUSSI la purge bornée — au-delà d'une constante
  serveur (N fils/tenant et/ou ancienneté), les plus vieux fils passent à `archived_at` (SOFT,
  jamais `DELETE`). Sélection des plus anciens via `updated_at`. Seuil = réglage dev.
- **Rewind après reload (CAP-5)** : `turn_id` sur le tour `assistant` suffit à réhydrater
  l'affordance « annuler ce tour » ; le rejeu des inverses reste celui de l'inc.4 sur `action_log`.
