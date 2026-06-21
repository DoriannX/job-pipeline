# Sprint Change Proposal — Historique de conversation → génération personnalisée

**Date :** 2026-06-21
**Auteur :** Monsieur (via correct-course)
**Mode :** Incrémental
**Source :** [brainstorming-session-2026-06-21.md](../brainstorming/brainstorming-session-2026-06-21.md)

---

## Section 1 — Résumé de l'enjeu

**Problème / opportunité :** la génération de message ne tient aujourd'hui compte d'aucun historique d'échange réel avec le contact. Le composeur génère « dans la voix » de l'utilisateur (few-shot) mais reste aveugle à la *relation* (ce qui s'est dit avant). Résultat : un message peut sonner juste mais hors-sol, sans continuité.

**Déclencheur :** idée émergée pendant le dev des archive-tools du copilote, creusée en session de brainstorm le 2026-06-21. **Nouveau besoin** (pas un échec d'implémentation ni un malentendu).

**Valeur :** renforce directement le moat (différenciation perso) — un message qui **rebondit sur le dernier point laissé en suspens** prouve que l'utilisateur (via Plume) a lu et suit la relation.

---

## Section 2 — Analyse d'impact

### Impact epics
- **Epic 3 « Le moat »** (actuellement `done`) → **rouvert en `in-progress`**, ajout d'**une story `3.10`**. La feature réutilise l'infra composeur (story 3.3, `POST /api/composer` + `composeInVoice`) et le champ Contact (Epic 2).
- **Epics 4 / 5 / 6** : aucun impact MVP. L'onboarding (story 5.5) pourra ultérieurement héberger le nudge avant/après (incrément 3, différé).
- **Séquencement** : inchangé. La feature se greffe sur de l'existant `done`, hors chemin critique Epic 4→5.

### Conflits artefacts
- **PRD** — ajout **FR-35** (historique du contact injecté à la génération). Extension **FR-32** (transparence API : l'historique transmis à Claude doit être explicité). Borne de taille rattachée à **NFR-5** (coût) / **NFR-1** (perf).
- **Architecture** — `contacts` reçoit **une colonne `historique text` nullable** (migration Drizzle, distincte du champ `notes` existant). `composeInVoice` reçoit un **bloc historique borné** dans le prompt. `sanitize()` appliqué à l'écriture (règle projet : sanitize à l'import des textes).
- **UX** — fiche Contact + formulaire de création : **textarea historique éditable** (token design `#EDF6F2`, jamais de rouge). Consigne composeur « continuité ». Respecte les 3 onglets / bottom-sheet existants.
- **Secondaires** — tests : couverture cross-tenant de la nouvelle colonne ; eval voix (3.9) inchangée.

---

## Section 3 — Chemin recommandé

**Option retenue : Option 1 — Direct Adjustment** (ajout d'une story dans la structure existante).

- **Effort :** Low-Medium. **Risque :** Low.
- **Rationale :** tout est déjà en place (route composeur, pipeline voix, schéma contact). On ajoute une colonne + un bloc de prompt + un champ UI. Pas de rollback (Option 2 rejetée : rien à défaire). Pas de réduction MVP (Option 3 rejetée : le MVP n'est pas menacé, on l'enrichit).
- **Périmètre limité au MVP** (textarea brut → injection → continuité). Incréments 2/3 (boutons-intention, écran de confiance, nudge onboarding, jauge) et gros morceaux (multi-fils par canal, forward mail) restent **différés** et explicitement hors de cette story.

---

## Section 4 — Éditions détaillées proposées

### 4.A — PRD (nouveau FR + extension)

**AJOUT — FR-35 (Composeur 4.2) :**
> **FR-35** : Historique de conversation par Contact — l'utilisateur peut coller/éditer l'historique brut des échanges passés (textarea libre, saisissable à la création du Contact et éditable ensuite). Quand il existe, il est injecté au prompt du Composeur (borné en taille) pour produire un message en **continuité** (rebondit sur le dernier point en suspens). Le champ intention reste optionnel. Pas de parsing de format (le bloc est avalé tel quel). Génération = Composeur (jamais le Copilote).

**EXTENSION — FR-32 (transparence) :**
> _(ajouter)_ … l'historique du Contact, quand présent et qu'une génération est lancée, fait partie du contexte transmis à Claude — explicité au même titre que l'idée et le few-shot voix.

**RATTACHEMENT — borne :** la taille d'historique injectée est plafonnée (cohérent NFR-5 coût + NFR-1 perf) ; au-delà, troncature côté serveur (« borné, pas honoré tel quel », parité avec les autres bornes de payload du projet).

### 4.B — epics.md

1. **Requirements Inventory** — ajouter FR-35 sous « Composeur (4.2) ».
2. **FR Coverage Map** — ajouter `**FR-35** : Epic 3 — Historique de Contact injecté à la génération (story 3.10)`.
3. **Epic 3** — statut `done` → `in-progress` ; ajouter la story :

> #### Story 3.10 : Historique de conversation du Contact → génération en continuité
>
> As a utilisateur,
> I want attacher l'historique de mes échanges passés avec un Contact,
> So that le message généré tienne compte du passé et réponde juste.
>
> **Acceptance Criteria :**
>
> **Given** la fiche Contact (et le formulaire de création)
> **When** je saisis/édite le champ historique (textarea libre)
> **Then** `contacts.historique` (text, nullable) est migré, sanitizé à l'écriture, scopé user_id ; le champ est éditable à tout moment (FR-35)
>
> **Given** un Contact avec un historique non vide
> **When** je touche Générer dans le Composeur
> **Then** `composeInVoice` injecte un bloc historique **borné** dans le prompt, à côté de l'idée (optionnelle) et du few-shot voix ; la consigne demande de rebondir sur le dernier point en suspens (continuité, pas simple rappel) (FR-35, AR-7)
>
> **Given** un historique présent
> **When** la génération est lancée
> **Then** la micro-ligne de transparence API reflète que l'historique est transmis (FR-32)
>
> **Given** un Contact sans historique
> **When** je génère
> **Then** le comportement actuel (few-shot seul) est strictement préservé — aucune régression
>
> **And** test cross-tenant 2-users sur `contacts.historique` (definition of done)

### 4.C — architecture.md

- **Schéma `contacts`** : `+ historique: text("historique")` (nullable). Distinct de `notes`. Migration Drizzle dédiée.
- **Pipeline composeur** (`composeInVoice` / `pipeline.server.ts`) : nouveau paramètre `historique?: string` ; intégré au prompt comme bloc de contexte borné ; passe par `sanitize()` à l'écriture BDD (pas à l'injection).
- **Borne** : constante serveur `MAX_HISTORIQUE_*` (parité MAX_SEED/MAX_IMPORT), troncature côté serveur.

### 4.D — UX (ux-designs)

- **Fiche Contact** : ajouter une section historique (textarea, fond `#EDF6F2`, label FR), éditable.
- **Création Contact** : champ historique présent dès la création (optionnel, « Passer » implicite : vide = comportement actuel).
- **Composeur** : aucune nouvelle commande au MVP (les boutons-intention sont incrément 2). La continuité est portée par le prompt, transparente pour l'utilisateur.

### 4.E — sprint-status.yaml

- `epic-3: done` → `in-progress`.
- Ajouter `3-10-historique-conversation-contact: backlog` sous Epic 3.
- `last_updated: 2026-06-21`.

---

## Section 5 — Handoff

**Classification : Moderate** (réorganisation backlog : réouverture epic + nouvelle story + édition PRD/archi/UX).

- **PO/DEV** : appliquer les éditions PRD + epics + architecture + UX + sprint-status (Section 4).
- **Puis `create-story`** sur `3-10` → story file détaillée prête pour dev.
- **DEV** : implémenter (migration colonne, paramètre pipeline, champ UI, tests cross-tenant + non-régression « sans historique »).

**Critères de succès :**
1. Un Contact avec historique génère un message qui rebondit sur le dernier point — vérifiable à la main.
2. Un Contact sans historique : zéro changement de comportement (non-régression).
3. Historique borné, sanitizé, scopé user_id, testé cross-tenant.
