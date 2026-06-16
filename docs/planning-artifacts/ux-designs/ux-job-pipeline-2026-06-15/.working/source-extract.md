> ⚠️ **Extrait brut pré-distillation — input, pas un livrable.** Ce fichier capture les sources avant distillation. En cas de divergence avec `EXPERIENCE.md` / `DESIGN.md` (spines `final`), **les spines priment**. Notamment : **« Mode sans-IA » supprimé** (UX #18/#19, PRD FR-15 supprimé #30) et **Stats = différé v1** — hors scope MVP malgré leur mention ci-dessous.

---

# Extraction UX des sources — Plume

*Sources lues : PRD (`prds/prd-job-pipeline-2026-06-15/prd.md`), Addendum, Decision-log (`.decision-log.md`), PRFAQ (`prfaq-job-pipeline.md`), Distillat PRFAQ (`prfaq-job-pipeline-distillate.md`), Brainstorming (`brainstorming/brainstorming-session-2026-06-15.md`). Références abrégées : PRD §/FR/UJ/SM ; ADD = Addendum ; DLOG = decision-log ; PRFAQ ; DIST ; BRAIN #feature.*

## 1. Surfaces / écrans nommés

- **3 onglets cible : Aujourd'hui · Réseau · Stats** + Réglages. **Au MVP, Stats est différé (v1)** → navigation MVP = **Aujourd'hui · Réseau · Réglages** (PRD §10, §6.2 ; DIST ; BRAIN Phase 4).
- **Onglet Aujourd'hui** (écran par défaut / "cockpit") : File du jour, relances dues, compteur zéro-fuite (PRD §10, FR-22 ; BRAIN 🟢).
- **Onglet Réseau** : liste des Contacts (tri, filtre), fiche Contact = timeline complète, Score de froideur, import (manuel / ajout rapide / CSV) (PRD §10, §4.1, FR-3/FR-5 ; BRAIN 🔵).
- **Onglet Stats** (v1, hors MVP) : funnel, stats canal/tier, recettes gagnantes, anti-vanity, wins, XP/achievements, heatmap, récap dimanche (BRAIN 🟣 ; PRD §6.2).
- **Réglages** : Canaux, Privacy (export / suppression / transparence API), Seed/Voix, PWA/notifications, compte (PRD §10 ; BRAIN ⚙️).
- **Composeur** : écran **en flow, hors barre d'onglets**, ouvert depuis un Contact ou une carte de la File (PRD FR-13, §10 ; BRAIN ✍️). Contient : champ unique, boutons Générer / Améliorer (PRD §4.2).
- **Fiche Contact** : timeline chronologique des Messages (date, Canal, Statut) ; bouton pour ouvrir le Composeur (PRD FR-3).
- **Onboarding** : connexion Google + Seed optionnel + ajout premiers Contacts, < 2 min (PRD FR-33).
- **État vide File du jour** : écran explicite invitant à ajouter un premier Contact (PRD FR-23).
- *(v1, mentionné pour référence amont)* **Carte outreach unifiée** : contact + opportunité + fil messages + next action sur une carte (BRAIN #40) ; **graphe de referral** (BRAIN #17) — hors MVP.

## 2. Entités & modèle mental

*Vocabulaire à utiliser verbatim (PRD §3 Glossaire) :*

- **Contact** — personne du réseau. A : identité, source d'import (csv/manuel), Score de froideur, réglage Mode sans-IA, Canal de prédilection, et une timeline de N Messages. Un user a N Contacts (PRD §3, ADD A).
- **Message** — communication adressée à un Contact, sur un Canal. A : date, Canal, Statut, texte figé (après Envoyé). Un Contact a N Messages (PRD §3, FR-18).
- **Canal** — support du Message : **LinkedIn, Email, WhatsApp, SMS**. Conditionne le comportement canal-aware du Composeur. Au MVP tous en copier-vers-Envoyé (PRD §3, FR-9, ADD A/B).
- **Statut** — cycle de vie du Message : **brouillon → envoyé → vu → répondu / ignoré**. Modifiable d'un tap. Au-delà d'"envoyé" = saisie manuelle au MVP (PRD §3, FR-19, BRAIN #8).
- **Voix** — façon d'écrire propre à l'utilisateur que le Composeur reproduit (PRD §3).
- **Few-shot voix** — injection en contexte des Messages passés (pas de fine-tuning) (PRD §3, FR-10).
- **Seed de voix** — exemples collés optionnellement à l'onboarding (PRD §3, FR-16).
- **Tell d'IA** — marqueur trahissant un texte généré (tiret cadratin, formule ampoulée, emoji cliché, ton lisse) → **Liste noire des Tells** (PRD §3, FR-11).
- **Mode sans-IA** — réglage **par Contact** : aucun appel API, texte tapé = Message. Pour échanges sensibles (PRD §3, FR-15).
- **Score de froideur** — par Contact, ancienneté du dernier échange ; sert au tri et aux alertes (PRD §3, FR-4 ; BRAIN #4).
- **File du jour** — liste priorisée de l'onglet Aujourd'hui : nouveaux Contacts + relances dues (PRD §3, FR-23).
- **Relance** — Next-action datée rattachée à un Contact ; déclenche notification, alimente la File quand due (PRD §3, FR-25).
- **Zéro-fuite** — garantie qu'aucune Relance due n'est oubliée (compteur de touches perdues à zéro) (PRD §3, FR-27).
- **Opportunité** *(v1, défini pour référence, ABSENT du MVP)* — poste @ entreprise, reliant N Contacts et N Messages, avec stade + next-action (PRD §3, ADD A).
- **Relations** (ADD A) : user 1—N {contacts, messages, next_actions, voice_samples} ; contact 1—N messages ; contact 1—N next_actions ; message N—1 channel. v1 : opportunity N—N contacts, opportunity 1—N messages.
- **État distinct "jamais contacté"** : un Contact sans aucun Message n'a PAS de Score de froideur ; il va dans le bucket "nouveaux Contacts à joindre", pas dans les relances (PRD FR-4).

## 3. Parcours utilisateur décrits

- **UJ-1 — Boucle quotidienne (la file en 5 min, dans le métro)** (PRD §2.3) : app s'ouvre sur Aujourd'hui (déjà connectée) → 3 nouveaux + 2 relances priorisés → prend la 1re carte → tape une idée brute dans le champ unique → touche **Générer** → texte dans son ton, court (LinkedIn), sans formule ampoulée → change deux mots → copie → colle dans LinkedIn → revient → marque **Envoyé** → la carte disparaît, la suivante monte. "Zéro page blanche." Edge case : contact en Mode sans-IA → pas d'appel API, le texte tapé est le message.
- **UJ-2 — Améliorer un brouillon écrit à la main** (PRD §2.3) : relance qui compte → tape 3 phrases maladroites → **Améliorer** → Plume retravaille **en place**, garde idées et ton, propose une version canal-email plus structurée → relit, ajuste, copie, envoie, marque Envoyé → message figé dans la timeline (verrou read-only) + bouton **Modifier** discret.
- **UJ-3 — Rattrapage avant refroidissement** (PRD §2.3) : J+5 sans réponse → **notification push** "Relance due : Sofiane (Algolia)" → ouvre Plume, relance déjà en haut de la file → Composeur propose une relance **à valeur ajoutée** (angle nouveau) plutôt qu'un "alors ?" → envoie → compteur zéro-fuite reste à zéro.
- **Boucle "Comment ça marche"** (PRFAQ) : importer le réseau en 2 min (CSV LinkedIn + scan Gmail au PRFAQ, mais Gmail = v1 dans le PRD) → tri/dédup/flag liens froids → chaque matin file Aujourd'hui → ouvrir contact → composeur → idée brute (ou rien) → Améliorer/Générer → corriger → copier → "Envoyé" (message figé dans l'historique) → prochaine relance programmée auto → push à échéance.
- **Cold-start / onboarding** (PRD FR-33, DLOG #8) : connexion Google → Seed optionnel → ajout des premiers Contacts en **manuel/rapide** (5-10 personnes du jour) → atteindre la File du jour et envoyer un 1er Message **en < 2 min**, **sans attendre le CSV** (export LinkedIn jusqu'à 24h).
- **Backfill CSV** (PRD FR-1) : import CSV LinkedIn **à tout moment, en arrière-plan, optionnel** ; chaque ligne crée/met à jour un Contact ; dédup/fusion (y compris contre contacts manuels) ; ligne malformée ignorée → compte-rendu (N créés / N fusionnés / N ignorés).
- **Composer → envoyer → marquer envoyé** (PRD FR-6/7/8/12/20/21) : champ vide par défaut → Générer (idée brute) OU Améliorer (texte existant) → revue humaine obligatoire → Copier (presse-papier) → proposition de marquer Envoyé → verrou read-only + bouton Modifier.
- **Relance** (PRD FR-25) : Message Envoyé sans "répondu" → Relance auto J+5 → quand due, la File la présente comme **confirmation 1 tap** : "Sofiane t'a répondu ?" → Oui clôt la Relance / Non ouvre le Composeur de relance (garde-fou anti-faux-pas). Décaler/annuler possible.
- **Seed voix** (PRD FR-16) : à l'onboarding, coller d'anciens messages (facultatif) → immédiatement utilisé par le Few-shot ; sinon ton neutre par défaut.

## 4. Comportements & états

- **État vide File du jour** (premier lancement, aucun Contact/Relance) : écran explicite invitant à ajouter un premier Contact (manuel/rapide), **pas un écran blanc** (PRD FR-23).
- **État "jamais contacté"** vs Score de froideur : deux états visuels distincts (PRD FR-4).
- **États de froideur** : frais < 30j / tiède 30-90j / froid > 90j (seuils ASSUMPTION, FR-4).
- **Chargement IA / génération** : perçue **quasi instantanée**, cible < 5 s avant le premier texte (PRD §11 NFR).
- **Échec API / hors-ligne** (cas fréquent en mobilité, UJ-1) : signalé clairement, le champ unique reste éditable, l'utilisateur écrit/envoie à la main, **aucune saisie perdue** (PRD FR-7).
- **Mode sans-IA** : sur un Contact concerné, **Générer/Améliorer désactivés**, rien transmis à l'API ; ses messages exclus du corpus de Voix (PRD FR-15/FR-17).
- **Relance due** : apparaît dans la File le jour de l'échéance ; en retard = visible **distinctement** des relances à venir (PRD FR-23/FR-27).
- **Zéro-fuite in-app** : garantie indépendante du push ; une relance due apparaît toujours dans la File même si la notif a échoué (push refusé, iOS sans ajout écran d'accueil, navigateur non supporté). Push = best-effort (PRD FR-27).
- **Action-first / file** : une carte à la fois ; gestes rapides **envoyé / skip / snooze** (bouton ou swipe) ; traiter une carte fait monter la suivante sans quitter l'écran (PRD FR-24 ; BRAIN #1).
- **Verrou après Envoyé** : texte read-only, bouton Modifier discret pour rouvrir (PRD FR-20).
- **Statut modifiable d'un tap** : transitions brouillon→envoyé→vu→répondu/ignoré (PRD FR-19).
- **Multicanal** : LinkedIn / Email / WhatsApp / SMS. Au MVP **tous en copier-vers-Envoyé** (pas d'envoi direct). Génération canal-aware : LinkedIn court / Email structuré / WhatsApp court / SMS = comme WhatsApp (très court) (PRD FR-9/FR-21, ADD B). Envoi direct (Email/WhatsApp/SMS via Twilio) = v1 ; LinkedIn reste manuel à toutes phases (PRD §6.2, ADD B).
- **Notification push** : Web Push via service worker quand relance due ; iOS exige l'ajout PWA à l'écran d'accueil, **signalé explicitement** par l'app (PRD FR-26).
- **Transparence API in-app** : mention claire qu'une génération envoie le contexte à l'API Claude, et que le Mode sans-IA ne transmet rien (PRD FR-32).
- **Compte-rendu import CSV** : N créés / N fusionnés / N ignorés (PRD FR-1).
- **Fusion manuelle** proposée en cas d'ambiguïté de dédup, plutôt que fusionner à tort (PRD FR-1).
- **Suppression confirmée et irréversible** d'un Contact (et ses messages/relances) ou d'un Message individuel (PRD FR-2).

## 5. Voix & ton / microcopy

- **Personnalité produit** : "tout doit sentir l'humain, jamais le dashboard automatisé" — garde-fou récurrent du fondateur (PRD §7.1, §9 ; BRAIN insights ; PRFAQ coaching-notes-1).
- **Feel recherché** : **soulagement de la charge mentale**, pas une machine de productivité. La File du jour vise le **"zéro décision"** (une action à la fois) pour enlever le poids, **pas pour cadencer** (PRD §9).
- **Ton de l'UI** : minimal, action-first, humain et **non "dashboard"** ; 2-3 zones max, vue action du jour par défaut (PRD §9).
- **Ton des textes générés** = celui de l'utilisateur (sa Voix) ; sobre et neutre par défaut tant que la Voix n'est pas amorcée. Plume **n'impose pas** le tutoiement/vouvoiement, il adopte le registre du user (PRD §9, FR-10).
- **Contraintes anti-tells-IA** (Liste noire) : **jamais de tiret cadratin** (proscrit en tête), pas de formules ampoulées, pas d'emoji clichés, pas de ton trop lisse (PRD §3, FR-11, §7.1, §9 ; SM-C1). Le PRD lui-même est rédigé sans tiret cadratin par cohérence (PRD §0, §1).
- **Positionnement "ta voix"** : "Plume part de ta voix : il apprend ta façon d'écrire et te la rend, plus vite. La technologie disparaît, il ne reste que toi." = ancrage de marque (PRD §9, §1 ; PRFAQ titre/citation Doriann).
- **Argument d'authenticité** : l'utilisateur donne le fond (idée, contexte, intention), Plume met en forme ; "ce n'est pas un robot qui se fait passer pour lui, c'est lui en plus rapide" (PRD §9, FR-12 ; PRFAQ Q2).
- **Microcopy attesté dans les sources** : "Générer", "Améliorer", "Envoyé", "Modifier" (boutons) ; "Relance due : Sofiane (Algolia)" (push, UJ-3) ; "Sofiane t'a répondu ?" → Oui/Non (confirmation relance, FR-25) ; "jamais contacté", compteur "touches perdues" / "zéro fuite" (FR-4/FR-27). Tonalité tutoiement dans toute la doc produit ("ta voix", "à qui as-tu écrit").
- **Relance = valeur, pas relance sèche** : la relance pousse à apporter un angle/article/update plutôt qu'un "alors ?" (PRD UJ-3, FR-25 ; BRAIN #15).

## 6. Indices d'identité visuelle

- **Nom = "Plume"** : la plume d'écriture, "ta plume = ta voix d'écriture", touche directe sur le héros (PRD §9, ADD E ; DIST). Métaphore d'écriture manuscrite / légèreté implicite dans le nom, mais **non développée** en direction artistique.
- **Mood / feel** : minimal, action-first, humain, soulagement de charge mentale, anti-"dashboard", zéro décision (PRD §9). C'est le seul registre esthétique explicite, et il est **comportemental, pas visuel**.
- **Contraintes de densité** : 2-3 zones max par écran, une action à la fois, peu de menus (PRD §9, §10 ; BRAIN #72).
- **Mobile-first strict** : tout parcours utilisable **au pouce** sur téléphone ; PWA installable ; Capacitor-ready (PRD §8, §11, FR-28).
- **Stack UI** : Tailwind (ADD B) — implique un design system utilitaire, mais aucune palette/échelle imposée.
- **ÉTAT DES INDICES VISUELS = PAUVRE.** Aucune source ne spécifie **couleurs, typographie, logo, iconographie, illustrations, ni direction artistique concrète**. Les seuls codes couleur présents sont les **émojis d'onglets du brainstorming** (🟢 Aujourd'hui, 🔵 Réseau, 🟣 Stats, ⚙️ Réglages — BRAIN Phase 4), qui sont organisationnels et non un parti pris graphique validé. Tout le reste (palette, type, logo, traitement de la métaphore "plume") est à élicité (voir §10).

## 7. Contraintes & non-négociables UX

- **3 onglets max** (Aujourd'hui · Réseau · Stats) + Réglages ; **MVP = Aujourd'hui · Réseau · Réglages** (Stats en v1) (PRD §10, §6.2 ; DIST).
- **Pas de labyrinthe de menus** : 2-3 zones max, architecture simple, vue "action du jour" par défaut (PRD §9, §10 ; BRAIN #72).
- **Composeur EN FLOW** : s'ouvre depuis un Contact / une carte, **jamais depuis la barre d'onglets**, n'apparaît pas comme onglet de navigation ; porte toujours le contexte du Contact courant (PRD FR-13, §10).
- **Champ unique = source de vérité** : le texte affiché EST le Message ; vide par défaut, pas de pré-génération (PRD FR-6 ; BRAIN #7 ; ADD D).
- **Revue humaine obligatoire** : aucun envoi automatique, aucun chemin produit n'envoie sans action humaine (PRD FR-12, §7.1).
- **Onboarding < 2 min, sans dépendre du CSV LinkedIn** (PRD FR-33, DLOG #8).
- **PWA mobile-first → Capacitor-ready**, sans réécriture, sans store (PRD §8, FR-28).
- **Pas de scraping LinkedIn, pas d'envoi auto LinkedIn** (CGU, ban) ; copier→Envoyé pour LinkedIn à toutes phases (PRD §5, §7.4, FR-21).
- **Privacy first-class** : données scopées par user, zéro partage tiers, export + suppression à la demande, transparence sur ce qui part à l'API, Mode sans-IA par Contact (PRD §7.2, §11, FR-29/30/31/32, FR-15).
- **Zéro-fuite garantie in-app** (pas seulement via push) (PRD FR-27).
- **Pas de tiret cadratin / tells d'IA** dans tout texte généré, contrainte produit ET rédactionnelle (PRD §7.1, FR-11, SM-C1).
- **Pas un automate, pas un humanizer anti-détecteur, pas multi-utilisateur au MVP** (PRD §5).
- **Phasage qui touche l'UX** : Stats=v1, Opportunités/pipeline=v1, gamification=v1, envoi direct=v1, extension LinkedIn=fast-follow post-MVP, 3 variantes / clarté de l'ask=v1, vocal/campagnes/séquences=v2 (PRD §6.2, §14).

## 8. Personas / protagonistes

- **Camille** — développeuse, en recherche active depuis ~3 semaines, chasse via son réseau perso **depuis son téléphone**, peu de temps (5 min/jour, dans le métro). Protagoniste de tous les UJ. Cas d'usage : nouveaux contacts + relances, contacts sensibles (Mode sans-IA), hiring manager rencontré à un meetup, ex-collègue, contact à J+5 sans réponse (PRD §2.3 ; PRFAQ citation Camille).
- **Doriann** — fondateur-développeur, **premier utilisateur (dogfooding)**, rôle PM + dev, en recherche d'emploi lui-même (effet méta / portfolio). Persona "Builder" dans les JTBD (PRD §0, §2.1 ; PRFAQ citation Doriann).
- **Beachhead** : profils **tech / devs** en recherche via réseau (PRD §13, DIST).
- **Non-utilisateurs MVP** : freelances / prospection commerciale (cible SaaS future), recruteurs / sourcing volume, chercheurs d'automate d'envoi (PRD §2.2).
- **JTBD** (PRD §2.1) : fonctionnel (écrire vite + perso ; ne pas perdre le fil), émotionnel (ne pas avoir honte d'un message générique ; garder le moral sur une recherche longue), social (demander intro/referral naturellement), contextuel (gérer depuis le téléphone, quelques min/jour).

## 9. Périmètre MVP vs plus tard (côté UX)

**MVP (surfaces & comportements à designer) :**
- Navigation **2 onglets + Réglages** : Aujourd'hui, Réseau, Réglages (PRD §10, §6.2).
- **Onglet Aujourd'hui** : File du jour priorisée, action-first (envoyé/skip/snooze), état vide, compteur zéro-fuite (FR-22/23/24/27).
- **Onglet Réseau** : liste/tri/filtre, fiche Contact timeline, Score de froideur, import manuel + ajout rapide multiple + CSV backfill (FR-1..5, FR-34).
- **Composeur en flow** : champ unique, Générer/Améliorer, canal-aware, few-shot voix, liste noire tells, revue humaine, Mode sans-IA, choix modèle Haiku/Opus (FR-6..15).
- **Apprentissage Voix** : Seed optionnel + au fil de l'eau (FR-16/17).
- **Messages & Statut** : enregistrement, cycle statut, verrou, copier→Envoyé (FR-18..21).
- **Relances** : next-action auto, push, compteur, confirmation 1 tap (FR-25/26/27).
- **Coquille PWA** + Auth Google + Privacy (export/suppression/transparence) + onboarding < 2 min (FR-28..33).

**v1 (plus tard) :** onglet **Stats** (funnel, recettes, anti-vanity), **pipeline d'Opportunités** (Contacts↔Opportunités↔Messages, stade+next-action, carte outreach unifiée, graphe referral, fiche pitch), **gamification** (streak, XP, achievements, heatmap, récap dimanche), scan Gmail + auto-statut, **envoi direct** (Email/WhatsApp/SMS), extension navigateur LinkedIn (fast-follow), **3 variantes** (court/chaleureux/direct), clarté de l'ask, détecteur copier-coller, temps de lecture, import par URL, expansion réseau, signaux de timing, RAG complet (PRD §6.2, §14 ; BRAIN phasage).

**v2 :** agent nocturne, recherche web, A/B test, saisie vocale, séquences multi-étapes, campagnes multi-contacts (PRD §14).

**v3 / SaaS :** multi-utilisateur, billing, social/squad, cible freelance (PRD §14).

**Exclus à toutes phases :** prédiction de chances, simulation de la réponse, brouillon toujours pré-généré, scraping LinkedIn (PRD §5 ; BRAIN rejetées).

## 10. Questions ouvertes / zones grises UX

*Ce qui n'est PAS tranché côté design et devra être élicité auprès de l'utilisateur :*

1. **Direction artistique entière** — aucune palette, typographie, logo, iconographie ni traitement de la métaphore "plume" n'existe dans les sources. À définir de zéro. (Indices visuels = pauvres, §6.)
2. **Gestes de la File du jour** — "envoyé / skip / snooze par bouton OU swipe" est une ASSUMPTION (FR-24) ; le modèle d'interaction exact (swipe vs boutons, tinder-like ou liste) n'est pas tranché.
3. **Forme du Composeur en flow** — modale plein écran ? bottom-sheet ? page dédiée ? Comment "Générer" vs "Améliorer" coexistent visuellement, placement du sélecteur de Canal, du choix de modèle (Haiku/Opus), de l'indicateur Mode sans-IA. Non spécifié.
4. **Sélection / affichage du Canal** — comment l'utilisateur choisit le Canal avant génération, et comment l'UI signale le mode canal-aware (LinkedIn court vs Email structuré). Non décrit visuellement.
5. **Confirmation de relance "Sofiane t'a répondu ?"** — où et comment elle s'insère dans la File (carte spéciale ? interstitiel ?). Logique définie (FR-25), forme UI non.
6. **Représentation du Score de froideur** — badge couleur, label, icône ? frais/tiède/froid + "jamais contacté" = 4 états à différencier visuellement (FR-4). Aucune convention visuelle fixée (les émojis 🟢🔵🟣 du brainstorming sont pour les onglets, pas pour la froideur).
7. **Flux de transparence API** — comment matérialiser "voici ce qui part à l'API" (FR-32) sans alourdir le composeur ni angoisser.
8. **Onboarding < 2 min** — séquence d'écrans concrète (Google → Seed → premiers contacts) non designée ; comment rendre le Seed clairement optionnel.
9. **Compteur zéro-fuite** — forme exacte (chiffre, jauge, ton) ; comment afficher "touches perdues = 0" de façon rassurante et non culpabilisante.
10. **Compte-rendu d'import CSV et fusion manuelle de doublons** — UI de résolution d'ambiguïté (FR-1) non spécifiée.
11. **Densité réelle du verrou/Modifier, du cycle de Statut d'un tap** — placement et affordance dans la fiche/timeline.
12. **Signal hors-ligne / échec API** — comment communiquer le fallback manuel (FR-7) sans casser le flow.
13. **iOS "ajout à l'écran d'accueil"** — comment guider l'utilisateur vers cette étape requise pour le push (FR-26), connue pour sa friction.
14. **Place de Réglages** dans une navigation à 2 onglets — 3e onglet ? icône ? menu ? Non tranché (Stats viendra prendre la 3e place en v1).
