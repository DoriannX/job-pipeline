# Diagrammes — journal d'actions & rewind

Companion de [`SPEC.md`](SPEC.md). Les diagrammes vivent ici (kernel = prose seule).

## Flux : un tour écrit → journal atomique

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant UI as Popup copilote (client)
    participant R as runAgentChat (server, turnId clos par closure)
    participant T as write-tool (createContact/…)
    participant Repo as repository (db.forUser)
    participant DB as Turso (mutation + action_log)

    U->>UI: « importe 8 personnes, écris à chacune »
    UI->>R: POST /api/agent/chat
    Note over R: génère turnId (1 par run)
    R->>T: buildTools(userId, turnId).execute(...)
    T->>Repo: contactsRepository.bulkCreate / messagesRepository.createDraft
    Repo->>DB: TRANSACTION { mutation + entrée action_log {turnId, op, prevState?} }
    DB-->>Repo: ok (atomique)
    R-->>UI: flux UI (texte) + turnId in-band (à côté de didWrite)
    UI->>UI: router.refresh() (sync inc.2) + retient (tour ↔ turnId) en-session
```

## Flux : rewind d'un tour (affordance humaine)

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant UI as Popup copilote (client)
    participant SA as Server action rewind (auth + vérif tenant)
    participant AL as actionLogRepository (db.forUser)
    participant Repo as repositories (contacts/messages)
    participant DB as Turso

    U->>UI: clic « Annuler ce tour » (mauve = action)
    UI->>SA: rewind(turnId)  %% turnId retenu en-session
    Note over SA: auth()→401 ; vérifie que turnId ∈ tenant courant
    SA->>AL: lit entrées du tour + tours postérieurs (ordre LIFO)
    loop par entrée, ordre chronologique inverse
        AL-->>SA: {op, entityId, prevState?}
        alt op = created
            SA->>Repo: archivedAt = now (re-archivage)
        else op = merged / reactivated
            SA->>Repo: restaurer prevState
        else entityType = message (brouillon)
            SA->>Repo: retrait soft (jamais DELETE)
        end
        Repo->>DB: update soft
    end
    SA->>AL: insère entrée op = "rewind" {turnId annulés} (audit)
    SA-->>UI: ok → revalidate / router.refresh() (sync inc.2)
    UI->>UI: galerie reflète l'annulation, sans reload
```

## État du « point de rewind » (en-session, sans historique persistant)

```mermaid
flowchart LR
    subgraph Client["Popup copilote — état EN-SESSION (éphémère)"]
        M1["tour 1 (write) ↔ turnId=a"]
        M2["tour 2 (read) — pas d'affordance"]
        M3["tour 3 (write) ↔ turnId=c"]
    end
    subgraph Server["Persistance — action_log (durable, scopé tenant)"]
        L1["entrées turnId=a : created, merged…"]
        L3["entrées turnId=c : created…"]
    end
    M1 -.affordance rewind.-> L1
    M3 -.affordance rewind.-> L3
    note["Le chat est éphémère ; seul turnId ↔ mutations survit.<br/>Rewind d'un tour = ce tour + tours postérieurs, LIFO."]
```
