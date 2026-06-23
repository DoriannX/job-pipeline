---
title: "Brainstorm — Cadence de relation / escalade outreach (copilote Plume)"
date: 2026-06-23
facilitator: BMad Brainstorming
participant: Monsieur
status: decisions-locked
topic: "Modèle de cadence : où on en est dans la relation → quel intent pour le brouillon"
---

# Brainstorm — Cadence de relation (copilote Plume)

## Problème (dogfood R1, 2026-06-23)

Le copilote traite chaque message comme un one-shot et balance la demande directe
(« j'aimerais explorer les opportunités d'alternance chez X… on en discute ? ») dès le
1er contact. Réalité de l'outreach réseau : on tisse d'abord un lien, on demande APRÈS.
Le copilote ne sait pas « où on en est » dans la relation → pas de cadence, pas d'escalade.

## Découvertes clés (grounding code)

1. **La froideur n'est PAS l'axe de cadence.** `coldness()` (`plume/src/lib/domain/cold-score.ts:30`)
   dérive UNIQUEMENT de `dernier_contact_at` : `never` / `fresh <30j` / `warm 30-90j` /
   `cold >90j`. Elle mesure « depuis quand on s'est pas parlé », pas « où on en est dans la
   relation ». Un contact `froid` peut être un proche négligé. Le PRD Epic 8 le confirme :
   « la froideur dit qui est négligé, pas qui vaut la peine ». → Réutiliser la froideur comme
   axe « chaleur de relation » = erreur de modèle. Elle pilote le TRI galerie + Relances (timing).

2. **Le vrai signal d'étape = la RÉCIPROCITÉ.** Machine à états du message
   (`plume/src/lib/domain/enums.ts:27`) : `brouillon → envoye → vu → repondu → ignore`.
   Le seuil « on peut demander » = l'autre a répondu ≥1 fois. MAIS `repondu`/`vu`/`ignore`
   sont consommés par les Relances (Epic 4), gaté derrière le Jalon R1 → pas posable dans
   l'UI aujourd'hui.

3. **Le pivot conversationnel résout la détection.** Le copilote lit les signaux qu'il a,
   annonce où il pense qu'on en est, et DEMANDE quand c'est ambigu (« il t'a déjà répondu ? »).
   L'override est natif au dialogue (tu veux demander direct → il obéit).

4. **Garde-fou quasi-gratuit dispo MAINTENANT** (non retenu pour build) : `jamais contacté`
   (`dernier_contact_at === null`) est déjà calculé → forcer OUVRIR sur premier contact, une
   ligne de `consigne`, zéro dépendance Epic 4. Décision : on ne le fait pas pour l'instant.

## Modèle de cadence retenu

Cadence 3 étapes pilotée par la RÉCIPROCITÉ (pas la froideur).

| Étape | Détectée par | Intent du brouillon |
|-------|-------------|---------------------|
| OUVRIR | aucun `repondu` (jamais contacté OU envoyé sans réponse) | créer une raison d'échanger, zéro demande dure |
| TISSER | a répondu ≥1, relation pas mûre | intérêt sincère, valeur, légère avancée |
| DEMANDER | réciprocité établie / l'utilisateur le décide | la vraie demande, légitime |

## Décisions verrouillées

1. **Axe = réciprocité (`repondu`), pas froideur.** Froideur reste au tri galerie + Relances.
2. **Détection = signal structurel `repondu` d'Epic 4.** Pas de nouveau champ inventé.
   Seuil « demander » = a répondu ≥1 fois. *(Choix Monsieur : attendre le signal Epic 4.)*
3. **3 étapes** OUVRIR → TISSER → DEMANDER. *(Choix Monsieur.)*
4. **Override = conversationnel natif** (pivot). Le copilote annonce l'étape ; si l'utilisateur
   veut demander direct, il obéit. Aucune gate rigide.
5. **Branchement = bloc `consigne` du mode `generate`** (tour utilisateur volatil), à côté de
   `CALIBRAGE_RECENCE` (`plume/src/lib/prompt.server.ts`). Fixe le BUT, pas un fait → ne casse
   pas « n'invente aucun fait ». Jamais dans le `system` cachable, jamais en mode `improve`.
6. **Frontière nette :** Epic 8 = QUI/QUAND contacter · Epic 4 = QUAND relancer · Cadence =
   QUEL intent pour ce brouillon. Zéro doublon.
7. **Sequencing = avec Epic 4**, gaté derrière le GO Jalon R1. *(Choix Monsieur.)*

## Où ça s'intègre

Pas Epic 8. Nouvelle story dans/avec **Epic 4 (Relances)** — partage le câblage de transition
`repondu`/`ignore`. Dépendance dure : `repondu` doit être posable (UI Epic 4).

## Prochain pas

Spec/create-story **post-GO R1, avec Epic 4** : cadence 3 étapes complète, détection via
`repondu`, microcopy FR du copilote annonçant l'étape. Rien à builder avant.
