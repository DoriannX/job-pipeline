# Diagrammes — historique de conversation persistant

## Flux d'un tour (contexte chargé CÔTÉ SERVEUR)

Le client n'envoie que le NOUVEAU message `user` + le `conversationId` ; le serveur charge
l'historique depuis la DB scopée (plus depuis le body). Résout la dette `deferred-work.md`
(le client n'est plus la source de vérité des tours `assistant`).

```mermaid
sequenceDiagram
    participant C as CopiloteSheet (client « bête »)
    participant R as /api/agent/chat (route, auth+zod)
    participant W as runAgentChat (server-only)
    participant DB as db.forUser (porte scopée)
    participant M as Modèle (streamText)

    C->>R: POST { conversationId, message }
    R->>R: auth() → 401 si absent ; zod borne message
    R->>W: runAgentChat({ userId, conversationId, message })
    W->>DB: charge le fil (tours antérieurs, scopé user_id, borné)
    DB-->>W: historique [user, assistant, …] (DB = source de vérité)
    W->>DB: persiste le tour user
    W->>M: streamText(system + historique + nouveau message, tools clos par closure)
    M-->>W: flux (steps tool-use, texte final) + turnId du run
    W->>DB: persiste le tour assistant (texte final + turnId si write)
    W-->>C: toUIMessageStreamResponse (texte + didWrite + turnId in-band)
    C->>C: si didWrite → router.refresh() (sync héritée inc.2)
```

## Reprise après reload (CAP-2)

```mermaid
sequenceDiagram
    participant C as CopiloteSheet (mount/reload)
    participant R as serveur (route/server action de bootstrap)
    participant DB as db.forUser

    C->>R: ouverture du popup (mount)
    R->>DB: dernier fil actif du tenant (conversations.updated_at desc)
    DB-->>R: conversationId + tours bornés
    R-->>C: { conversationId, tours }
    C->>C: réaffiche le fil (texte final par tour ; chips tool-use NON réhydratées)
    Note over C: « nouvelle conversation » (CAP-4) → nouveau conversationId, popup vide,<br/>ancien fil intact en base
```

## Frontières (rappel)

- `conversations` / `chat_messages` = TRANSCRIPT ; `action_log` = MUTATIONS ; `messages` =
  OUTREACH (moat). Pont transcript↔mutations = `turn_id`. Aucune fusion. Voir
  [`data-model.md`](data-model.md).
- Tout passe par `db.forUser` (scoping `user_id` automatique). Aucun drizzle direct sous la
  route, `runAgentChat` ou un tool.
