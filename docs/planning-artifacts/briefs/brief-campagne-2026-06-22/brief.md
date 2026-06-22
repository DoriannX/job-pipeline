---
title: "Product Brief — Campagne (Plume)"
status: draft
created: 2026-06-22
updated: 2026-06-22
---

# Product Brief : Campagne

> Feature net-new pour Plume — copilote de sourcing piloté par objectif. Territoire Epic 8.

## Executive Summary

Plume sait aider à **écrire** un message dans ta voix et à **suivre** tes relances, mais jamais à répondre à la question qui vient avant : **qui contacter, et quand ?** Le réseau est là, trié par froideur, mais une galerie froide ne dit ni par où commencer ni pourquoi maintenant. Le founder agit déjà — il agit juste mal : il rate le bon moment et part au hasard, sans stratégie reliée à un objectif. Résultat : de l'outreach gaspillé et des fenêtres manquées.

**Campagne** comble ce trou. Tu donnes un objectif au copilote en langage naturel ("je cherche un lead data à Lyon") ; il en fait une campagne active, repère les contacts pertinents de ton réseau, les enrichit (changement de poste via People Data Labs), croise avec ce qu'il sait (froideur, relances), et te sort une **courte liste du jour** où chacun arrive avec son "pourquoi". L'app calcule les signaux, le copilote les met en mots et en discute — puis l'objectif pré-charge le message à écrire. **Sourcing et rédaction en un seul geste.**

Ce qui le rend différent n'est pas la donnée (achetable par tous) mais l'intégration, et une **posture privacy défendable** quand le marché du sourcing ne l'est pas : enrichment en opt-in explicite, borné par l'objectif, sur ton seul réseau — jamais de scraping. On le valide d'abord en dogfood sur le founder, contre une métrique unique : le taux de réponse des messages bien timés doit nettement battre le hasard. Territoire Epic 8, après la clôture d'Epic 7.

## The Problem

Plume aide à **rédiger** un message dans sa voix et à **suivre** ses relances. Mais il ne répond jamais à la question qui vient *avant* : **qui contacter, et quand ?** Le réseau est là, trié par froideur, mais une galerie froide ne dit pas par où commencer.

Le problème n'est pas l'inaction — le founder agit déjà. C'est un problème de **précision** : il agit mal.

- **Il rate le bon moment.** Un contact change de poste ou de boîte — la fenêtre idéale pour reprendre contact — et il l'apprend trop tard, ou jamais. L'opportunité passe en silence.
- **Il part au hasard.** Sans stratégie reliée à un objectif concret ("je cherche un lead data à Lyon"), il contacte des gens sans angle, et le taux de réponse s'en ressent.

Le coût du statu quo : de l'outreach gaspillé (messages sans angle, faible réponse) et des fenêtres d'opportunité manquées. Trier par froideur (ce que fait déjà la galerie) ne résout ni l'un ni l'autre : la froideur dit *qui est négligé*, pas *qui vaut la peine maintenant ni pourquoi*.

## The Solution

**Campagne** transforme un objectif en une routine de contact ciblée. Le founder dit au copilote, en langage naturel, ce qu'il cherche — *"je cherche un lead data à Lyon"*. Cet objectif devient une **campagne active**.

À partir de là, Plume travaille en fond : il repère dans le réseau les contacts liés à l'objectif, les enrichit (changement de poste via People Data Labs), et croise ça avec ce qu'il sait déjà (froideur, relances en suspens). Il en sort une **courte liste du jour** — pas une galerie infinie, un quota tenable — où chaque personne arrive avec **son "pourquoi"** : *"Léa est passée Head of Data chez X et tu ne l'as pas relancée depuis 5 mois."*

Le partage du travail est **hybride** : l'application calcule les signaux bruts (algorithme, déterministe) ; le copilote les **met en mots et en discute** avec toi. Tu peux répondre, écarter, demander pourquoi. Et quand tu choisis quelqu'un, l'objectif **pré-charge le message** : le copilote sait déjà dans quel angle écrire. Le sourcing et la rédaction ne font qu'un seul geste.

## What Makes This Different

- **Ni CRM, ni liste froide.** Trier par froideur dit *qui est négligé*. Campagne dit *qui vaut la peine maintenant, et pourquoi* — relié à un objectif réel, pas à une date.
- **L'objectif est un levier unique à triple emploi** : il filtre la pertinence, il **borne le coût** (on n'enrichit que les contacts liés au but, pas les 500) et il **borne l'exposition privacy** (moins de données partagées). Un seul réglage résout trois problèmes.
- **Le moat n'est pas la donnée.** N'importe qui peut acheter People Data Labs. L'avantage est dans l'**intégration** : objectif → sourcing → message dans ta voix, en un seul flux conversationnel. C'est la fusion sourcing × rédaction que personne ne fait dans un outil grand public.
- **La privacy comme posture, pas comme slogan.** Les outils de sales (UserGems, Apollo) aspirent tout par défaut. Campagne fait l'inverse : enrichment en opt-in explicite, borné par l'objectif, sur ton propre réseau. C'est défendable quand le reste du marché ne l'est pas (cf. la mort de Proxycurl).

## Who This Serves

**Primaire (concret, dogfood) :** le founder lui-même — en recherche d'emploi via son réseau personnel. C'est sur lui que le v1 est validé, et son vécu définit le problème (rater le bon moment, partir au hasard).

**Secondaire (horizon SaaS, volontairement large) :** tout **networker actif** qui fait de l'outreach relationnel vers un but — chercheur d'emploi, freelance en quête de clients, founder/sales solo en prospection early-stage. Le persona précis n'est **pas tranché** à ce stade : il le sera au PRD si l'ouverture SaaS se confirme. Garder large ici est assumé — le founder est le cas réel, le reste est une hypothèse à tester, pas à figer.

## Success Criteria

**North star — composite "réponse × timing".** Un message est dit *bien timé* s'il part dans les **N jours** d'un signal détecté (changement de poste, etc. ; N à fixer au PRD). La métrique principale est le **taux de réponse des messages bien timés, comparé à la baseline** (taux de réponse des messages envoyés hors signal). Si Campagne marche, le premier doit nettement battre le second : capter le bon moment **et** que ça paie en réponses.

> Cette métrique **remplace SM-1** (distance d'édition généré↔envoyé), devenue caduque avec le pivot conversationnel.

**Métriques secondaires (support, jamais arbitre) :**

- **Réactivation de dormants** — nombre de contacts dormants pertinents repris grâce à une suggestion (et non spontanément).
- **Adhésion** — le founder fait réellement ses N contacts ciblés du jour. Mesure l'usage, pas la valeur : utile pour détecter l'abandon, jamais pour déclarer le succès.

**Garde-fou de mesure :** la validation se fait d'abord en dogfood sur le founder, sur un volume réel de messages (à dimensionner au PRD, dans l'esprit des 20-30 messages du jalon R1).

## Scope

**Frontière dure : réseau existant uniquement.** Campagne agit sur les contacts déjà dans Plume (et les enrichit). Sourcer des inconnus (recherche externe type LinkedIn) est **hors périmètre** — risque légal (cf. mort de Proxycurl) et horizon SaaS lointain.

### Dans le v1 (dogfood founder)

- **Objectif en langage naturel** donné au copilote, persistant comme campagne active.
- **Scoring de pertinence** des contacts vs l'objectif actif (LLM, via la clé Claude déjà en place).
- **Signal "changement de poste"** via enrichment People Data Labs, sur les seuls contacts liés à l'objectif (l'objectif borne le coût ET l'exposition privacy).
- **Signaux internes gratuits** : froideur + relance en suspens (zéro API).
- **Liste du jour** : courte (quota), chaque entrée portant son "pourquoi" (split hybride : l'app calcule le signal brut, le copilote le met en mots).
- **Dormant réintégré** : un contact dormant remonte s'il est lié à l'objectif **ou** porteur d'un signal — jamais une liste froide brute.
- **Privacy** : enrichment activé en **opt-in explicite** pour le founder ; "privacy par défaut" préservé.

### Explicitement hors v1

- **Sourcing net-new externe** (inconnus hors réseau).
- **Scraping LinkedIn** — banni définitivement.
- **News par boîte** (levée/recrutement) → v2 : 2e source externe, signal plus faible.
- **Enrichment de tout le réseau** — seuls les contacts liés à l'objectif sont enrichis (coût + privacy).
- **Multi-campagnes parallèles** — une campagne active à la fois au v1.
- **Ouverture SaaS de l'enrichment** — décision reportée ; pas en core, premium opt-in ultra-cadré ou rien.

## Vision

Aujourd'hui Plume t'aide à écrire et à ne rien oublier. Si Campagne marche, il t'aide aussi à **décider où mettre ton énergie** — et la boucle devient complète : *un objectif → les bonnes personnes au bon moment → un message dans ta voix → un suivi sans fuite.* La campagne pilotée par objectif devient la colonne vertébrale de Plume, là où sourcing, voix et relance se rejoignent en un seul flux.

À 2-3 ans, si l'ouverture SaaS se confirme : **le copilote d'outreach relationnel qui respecte la vie privée** — celui qui aide chacun à activer son réseau vers un but, sans aspirer le monde ni sonner comme un robot. Un positionnement défendable précisément là où le marché du sourcing ne l'est pas. Ambition tenue par une condition simple et mesurable d'abord : que le north star (réponse × timing) batte nettement le hasard, sur le founder, en dogfood.

## Open Questions

- **N (fenêtre "bien timé")** : 7 ou 14 jours ? À fixer au PRD avec un premier jeu de données.
- **Volume de validation dogfood** : combien de messages avant de déclarer GO sur le north star (esprit R1, 20-30) ?
- **Modèle de coût PDL au-delà du palier gratuit** : seuil d'enrichment / quota par campagne.
- **Déclencheur d'ouverture SaaS de l'enrichment** : à quelles conditions (et avec quel cadrage RGPD / DPA) le rendre disponible hors founder.
- **Séquencement vs roadmap** : Campagne = Epic 8, à planifier après la clôture d'Epic 7 et le jalon R1 redéfini.
