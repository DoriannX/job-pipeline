# Diagrammes — Plume (repo job-pipeline)

_Source : `project-context.md` + PRD/UX finaux (`docs/planning-artifacts/`).
À réutiliser par l'architecture (`bmad-create-architecture`) et les epics/stories.
En cas de conflit PRD↔UX, l'UX prime. Dernière mise à jour : 2026-06-16._

---

## #5 — Modèle de domaine MVP (ER)

> Le *corpus few-shot voix* n'est PAS une table : c'est l'ensemble des `MESSAGE` au
> statut `envoyé` (apprentissage continu, pas de fine-tuning). `SEED_VOIX` = seulement
> l'amorce optionnelle d'onboarding. Toute lecture/écriture est scopée par `user_id`.

```mermaid
erDiagram
    UTILISATEUR ||--o{ CONTACT : possède
    UTILISATEUR ||--o{ MESSAGE : possède
    UTILISATEUR ||--o{ SEED_VOIX : "fournit (optionnel)"
    CONTACT ||--o{ MESSAGE : "destinataire de"
    MESSAGE ||--o| RELANCE : "1 max si non répondu"
    UTILISATEUR {
        string user_id PK "Google OAuth — scope TOUTE requête"
        string email
        string voix_ton "neutre par défaut"
    }
    CONTACT {
        string id PK
        string user_id FK "jamais de query sans"
        string nom
        string canal_prefere "LinkedIn|Email|WhatsApp|SMS"
        datetime dernier_contact_at "null = jamais contacté"
        string score_froideur "dérivé: jamais|frais<30j|tiède30-90j|froid>90j"
    }
    MESSAGE {
        string id PK
        string user_id FK
        string contact_id FK
        string canal "fige le format de génération"
        string texte "figé (read-only) après Envoyé"
        string texte_genere "conservé: couple FR-7 pour SM-1"
        string statut "brouillon|envoyé|vu|répondu|ignoré"
        boolean genere_par_ia
        datetime envoye_at
    }
    RELANCE {
        string id PK
        string user_id FK
        string message_id FK "UNIQUE — idempotence zéro-fuite"
        datetime echeance_at "J+5 défaut"
        string statut "due|faite|close (répondu/ignoré clôt)"
    }
    SEED_VOIX {
        string id PK
        string user_id FK
        string texte "1-2 anciens msg · sanitize() à l'import"
    }
```

---

## #2 — Flow Composeur (le moat)

Points clés : champ vide par défaut · bouton intelligent Générer/Améliorer ·
`sanitize()` post-traitement déterministe **côté serveur** + re-validation en boucle ·
clé Claude jamais au client · aucun auto-send (Copier → Envoyé manuel).

```mermaid
flowchart TD
    A([Ouvrir Composeur · bottom-sheet]) --> B[Champ unique · VIDE par défaut]
    B --> C{Champ vide ?}
    C -->|oui| D[Bouton = Générer]
    C -->|non · texte présent| E[Bouton = Améliorer]
    D --> F[Saisir une idée]
    F --> G[Tap action]
    E --> G
    G --> H[/Modèle · Rapide=Haiku / Soigné=Opus/]
    subgraph S[SERVEUR uniquement · clé Claude jamais au client]
        I[Injecter few-shot voix · Messages envoyés en contexte · PAS de fine-tuning]
        I --> J[Génération canal-aware · LinkedIn court / Email structuré / WA-SMS ultra-court]
        J --> K[[sanitize déterministe · tiret cadratin, NFC, trim, anti-emoji]]
        K --> L{Validation Tells d'IA ?}
        L -->|tell détecté| K
        L -->|propre| M[Retour texte + compteur tokens]
    end
    H --> I
    M --> N[Texte injecté DANS le champ unique = source de vérité]
    N --> O{Satisfait ?}
    O -->|non| E
    O -->|oui| P[[Revue humaine OBLIGATOIRE]]
    P --> Q[Copier = commit]
    Q --> R[Marquer Envoyé]
    R --> T[Texte FIGÉ + alimente corpus voix]
```

---

## #3 — Appel Claude serveur-only (séquence)

Frontière de sécurité que l'architecture doit garantir : la clé Claude vit en variable
d'env **serveur** (jamais `NEXT_PUBLIC_*`), aucun appel direct browser → Anthropic.
`sanitize()` + validation des Tells d'IA bouclent côté serveur avant renvoi. Aucun
auto-send : revue humaine puis Copier = Envoyé.

```mermaid
sequenceDiagram
    autonumber
    participant U as PWA (client)
    participant API as Route handler (serveur)
    participant DB as Turso (libSQL)
    participant LLM as Claude API
    U->>API: POST /composer (idée, canal, modèle)
    Note over API: Auth Google OAuth → résout user_id côté serveur
    API->>DB: SELECT messages envoyés WHERE user_id (few-shot voix)
    DB-->>API: corpus voix
    Note over API: clé Claude = env serveur (jamais NEXT_PUBLIC)
    API->>LLM: prompt few-shot + idée (canal-aware, Haiku/Opus)
    LLM-->>API: texte brut + usage tokens
    Note over API: sanitize() déterministe (tiret cadratin, NFC, trim, anti-emoji)
    loop tant qu'un Tell d'IA subsiste
        API->>API: re-sanitize + re-valider
    end
    API-->>U: texte propre + compteur tokens
    Note over U: affiche dans le champ unique (clé jamais transmise)
    Note over U,API: aucun auto-send — revue humaine puis Copier = Envoyé
```

---

## #1 — Cycle de vie du `Statut` du Message (state)

Le texte est **figé (read-only)** au passage `brouillon → envoyé`. Au MVP toutes les
transitions sont **manuelles** (le statut auto via Gmail est différé en v1). La `Relance`
zéro-fuite est armée à J+5 sur tout `Message` envoyé non répondu ; `répondu`/`ignoré` la
clôt de façon idempotente.

```mermaid
stateDiagram-v2
    [*] --> brouillon : création
    brouillon --> envoye : Copier puis Marquer Envoyé (texte FIGÉ)
    envoye --> vu : destinataire a vu *
    envoye --> repondu : réponse reçue *
    envoye --> ignore : sans réponse / classé *
    vu --> repondu : réponse reçue *
    vu --> ignore : sans réponse *
    repondu --> [*] : clôt la Relance
    ignore --> [*] : clôt la Relance
    note right of envoye
      Relance J+5 armée si non répondu
      (idempotente, 1 par Message)
    end note
    note left of brouillon
      * statut manuel au MVP
      Gmail auto-statut = v1
    end note
```

---

## #4 — `Relance` zéro-fuite, 2 couches (flowchart)

**Couche 1 in-app = le filet** (suffit à la garantie zéro-fuite) : `File du jour` dérivée
à la lecture des échéances + compteur visible, action 1-tap. **Couche 2 push = best-effort**
et dépend d'un **scheduler serveur NON tranché (PRD §14)** → tant qu'il n'existe pas,
n'implémenter QUE la couche 1 ; le déclencheur push = TODO archi. `Relance` **idempotente** :
1 par `Message` non répondu (unicité), rejouer le scheduler ne crée ni doublon ni double
notif ; `répondu`/`ignoré` clôt de façon idempotente.

```mermaid
flowchart TD
    M["Message passe à Envoyé"] --> R{{"Créer Relance<br/>UNIQUE par Message<br/>échéance J+5"}}
    R --> O
    R --> S
    subgraph L1["Couche 1 · in-app · LE FILET (garantie zéro-fuite)"]
        direction TB
        O["Ouverture app"] --> Q["Dériver File du jour<br/>Relances dues WHERE user_id"]
        Q --> CT["Compteur visible"]
        CT --> A{"Action 1-tap"}
        A -->|Relancer| NM["Nouveau Message"]
        A -->|Reporter| RP["Repousser échéance"]
    end
    subgraph L2["Couche 2 · push (BEST-EFFORT)"]
        direction TB
        S{"Scheduler serveur<br/>TODO archi · PRD §14 · NON tranché<br/>rejouer = pas de doublon"}
        S -->|existe| WP["Web Push best-effort<br/>iOS: PWA installée requise"]
        S -->|absent| X["Pas de push<br/>couche 1 suffit"]
    end
    WP -.rappel.-> O
    A -->|Répondu / Ignoré| CL[["Clôturer Relance (idempotent)"]]
    NM --> CL
    RP --> Q
```

---

## #6 — `Score de froideur` (state, dérivé)

Le score est **dérivé à la lecture** depuis `dernier_contact_at` (jamais stocké) : un
`Contact` sans `Message` est *jamais contacté* ; le 1er envoi le rend *frais* ; il vieillit
en *tiède* (30 j) puis *froid* (90 j) ; tout nouveau `Message` envoyé **réinitialise** l'âge.
**a11y :** la couleur n'est jamais le seul signal — toujours doublée par un libellé texte
(coldtag), et jamais alarmiste.

```mermaid
stateDiagram-v2
    [*] --> jamais : Contact créé (aucun Message)
    jamais --> frais : 1er Message envoyé
    frais --> tiede : 30 j écoulés
    tiede --> froid : 90 j écoulés
    frais --> frais : nouveau Message (reset âge)
    tiede --> frais : nouveau Message (reset âge)
    froid --> frais : nouveau Message (reset âge)
    note right of froid
      Dérivé à la LECTURE depuis dernier_contact_at (non stocké)
      jamais contacté | frais <30j | tiède 30-90j | froid >90j
      a11y: TOUJOURS doublé par un label texte (jamais la couleur seule)
    end note
```
