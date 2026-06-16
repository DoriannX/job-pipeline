---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Dashboard web de tracking outreach réseau (job search) — messages envoyés, relances, notifications mobile'
session_goals: 'Transformer job-pipeline en app web full-stack connectée BDD : tracker chaque message envoyé au réseau, gérer les relances, recevoir notif téléphone. Générer un max de features.'
selected_approach: 'ai-recommended'
techniques_used: ['Role Playing', 'SCAMPER Method', 'What If Scenarios']
ideas_generated: '~55 features retenues (numérotées 1-73, dont 4 rejetées + 4 différées)'
session_active: false
workflow_completed: true
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Monsieur
**Date:** 2026-06-15

## Session Overview

**Topic:** Dashboard web de tracking d'outreach réseau pour recherche d'opportunités — pivot depuis l'ingestion d'alertes email vers la prospection de son propre réseau.

**Goals:** Transformer le projet `job-pipeline` en application web full-stack connectée à une base de données. Dashboard complet pour :
- tracker tout ce qui est envoyé (messages, à qui, quand)
- savoir quand relancer
- recevoir des notifications sur le téléphone

L'utilisateur veut un maximum d'idées de features.

### Session Setup

Approche : **AI-Recommended**. Séquence 3 phases : Role Playing (breadth multi-acteurs) → SCAMPER (multiplication systématique sur la boucle cœur envoyer→tracker→relancer) → What If Scenarios (vision/black-swan).

## Technique Selection

**Approach:** AI-Recommended Techniques

**Recommended Techniques:**
- **Role Playing** (collaboratif) — incarner expéditeur, contact, recruteur, futur-soi pour couvrir tous les besoins → features.
- **SCAMPER Method** (structuré) — 7 lentilles sur la boucle cœur pour multiplier les features concrètes.
- **What If Scenarios** (créatif) — casser contraintes pour features ambitieuses / différenciantes.

**AI Rationale:** Séquence ordonnée breadth → systématique → wild ; chaque phase change de domaine créatif (anti-bias).

## Idées générées

### Phase 1 — Role Playing (4 personas) → 32 features

**Persona Expéditeur (toi qui envoies)**
1. **File d'attente du jour** — écran "À faire aujourd'hui" priorisé (nouveaux + relances dues), action-first / swipe (envoyé/skip/snooze). Zéro décision.
2. **Composeur assisté Claude** — form (prénom, point commun, boîte) + zone brouillon + bouton "Améliorer" → Claude réécrit sur ton jet + contexte fiche.
3. **Mémoire de contact + log par personne** — timeline complète par contact (dernier msg, réponse, où on en est). Anti-doublon.
4. **Score froideur du lien** — indicateur "dernière interaction il y a X", alerte quand le lien refroidit.
5. **Améliorer en 3 variantes** — court / chaleureux / direct, tu piques en 1 clic.
6. **Améliorer canal-aware** — Claude adapte au canal (LinkedIn court, email structuré, WhatsApp ultra court).
7. **Champ unique = source de vérité** — une seule zone éditable ; jet → Améliorer édite en place → re-modif manuelle → Copier → Envoyé. Pas d'IA = ton texte EST le message.
8. **Statut de message** — brouillon/envoyé/vu/répondu/ignoré, modifiable d'un tap.
9. **Verrou après envoi** — champ read-only dès "Envoyé" ; bouton "Modifier" discret pour corriger.
10. **Registre des canaux** — config canaux (email Gmail, WhatsApp API, SMS Twilio, LinkedIn manuel), taggés auto-send / manuel.
11. **Envoi direct selon canal** — bouton Envoyer pour canaux à API ; fallback Copier→Envoyé pour les autres.

**Persona Contact (qui reçoit)**
12. **Détecteur "ça pue le copier-coller"** — Claude note la perso (0-100) avant envoi, alerte si générique.
13. **Clarté de l'ask** — Claude flag les asks vagues, suggère un ask précis et facile à dire oui.
14. **Temps de lecture calibré canal** — badge "lecture : Xs", seuil selon le canal (email > LinkedIn > SMS).
15. **Relance = nouvelle valeur** — la relance pousse à ajouter un truc (article/update) au lieu de "alors ?".

**Persona Recruteur / Hiring Manager**
16. **L'opportunité comme entité** — objet "poste @ boîte" séparé, relie plusieurs contacts + messages, avec stade. Socle : Contacts ↔ Opportunités ↔ Messages.
17. **Graphe de referral glanceable** — qui t'a intro à qui, visible d'un coup d'œil ; meilleurs connecteurs en évidence.
18. **Fiche pitch par opportunité** — angle/compétences à mettre en avant, réutilisable.
19. **Stade & prochaine action** — chaque opportunité affiche stade + LA next action avec échéance (CRM job search).

**Persona Toi dans 3 mois (analytics/rétro)**
20. **Funnel de conversion** — envoyés → vus → répondus → calls → entretiens → offres, taux par étape.
21. **Stats par canal & par tier** — taux de réponse découpé canal × tier de lien.
22. **Recettes gagnantes** — tags auto (canal/longueur/ton/heure/tier/perso) × résultat → règles lisibles ("court + chaleureux + 8-10h = 38% vs 12%"). Comparaison de segments, pas de ML. Plus tard : Claude détecte les patterns.
23. **Garantie zéro fuite** — tableau relances dues/en retard, compteur "touches perdues".
24. **Constance / streak** — objectif hebdo + streak + courbe d'activité.
25. **Journal des wins** — log des bonnes nouvelles, soutien moral.

**Gamification**
26. **XP pondéré par valeur** — message +1, relance +2, call +20, intro +15 ; récompense le résultat pas le spam.
27. **Système d'achievements complet** — beaucoup de hauts faits, barres de progression, %, paliers bronze/argent/or, verrouillé/débloqué.
28. **Heatmap d'activité** — calendrier style contributions GitHub.
29. **Récap du dimanche soir** — notif + écran bilan hebdo + objectif semaine suivante.

**Architecture / Produit**
30. **Pivot SaaS multi-utilisateur** — ROADMAP PHASÉE : (1) app perso d'abord, (2) étendre aux potes, (3) SaaS payant. Archi propre dès le départ (auth + données scopées par user) mais single-user pour l'instant.
31. **PWA + Web Push** — app installable + notif push téléphone via service worker (couvre "notif sur mon tel" sans store). iOS : nécessite "ajout écran d'accueil".
32. **Mobile-first → Capacitor-ready** — UI mobile d'abord, marche sur PC, structurée pour wrap Capacitor en natif plus tard sans réécrire.

### Phase 2 — SCAMPER (boucle cœur : écrire → améliorer → envoyer → logger → relancer)

**S — Substitute**
33. **Saisie vocale du brouillon** — dicter à l'oral, Claude nettoie. Faisable gratuit (Web Speech API) ou Whisper (~0,006$/min).
34. **Import contact par lien multi-canal** — déposer l'URL du contact selon le canal ; auto-remplissage best-effort (partiel là où peu de donnée publique).
35. **L'app choisit QUI contacter** — Claude propose les contacts du jour (fit opportunité, froideur, potentiel). Prérequis. Nourrit la File du jour (#1).
36. **Claude trouve le point commun** — lit le contexte public et souffle l'accroche perso.
37. **Import massif de réseau** — LinkedIn export CSV officiel + scan Gmail. (Google Contacts/tél perso = opt-in DIFFÉRÉ tant que confiance pas établie. Scraping LinkedIn exclu = CGU + risque ban.)
38. **Tri & enrichissement auto par Claude** — assigne tier, déduplique cross-canal, flag liens froids, devine secteur.

**C — Combine**
40. **Carte outreach unifiée** — contact + opportunité + fil messages + next action sur une carte.
41. **Réponse "ok call" → booking direct** — lien de dispo / ajout Google Agenda depuis la carte.
42. **Relance via le composeur complet** — même composeur (écrire→améliorer→éditer OU générer de 0).
43. **Campagne multi-contacts pour une opportunité** — outreach groupé vers les contacts d'une même cible.
44. **Composeur mode "Générer de 0"** — bouton Générer (vs Améliorer) ; résultat dans le champ unique, éditable. Champ vide par défaut (pas de pré-génération auto).

**A — Adapt**
45. **Ton adapté à l'historique** — Claude cale le ton sur vos échanges passés.
46. **Adapté au niveau du destinataire** — registre selon séniorité/rôle. Objectif: max perso, ne jamais sentir le dashboard auto.
47. **Cadence de relance par contact** — rythme adapté par contact/tier (lié #22), ni trop ni pas assez.
48. **Séquences empruntées aux CRM de vente** — playbooks sales traduits pour le réseau.

**M — Modify/Magnify**
51. **A/B test de messages** — variante A/B sur campagne, mesure la conversion (tentatif).
52. **Recherche approfondie avant écriture** — web search sources publiques, à la demande (coût maîtrisé). Limite: LinkedIn login-walled, non navigable.
53. **Séquence de relance multi-étapes** — J+5 valeur, J+12 angle, J+20 breakup, validée à chaque étape.
54. **File infinie, zéro limite de batch** — propose des gens tant qu'il y en a ; file vide → bascule expansion.

**Croissance**
55. **Moteur d'expansion réseau** — file vide → pistes : 2e degré, dormants, alumni, events, demandes d'intro.

**P — Put to other use**
56. **Café / entretiens informationnels** — même moteur pour coffee chats.
57. **Entretien du réseau long terme** — garde les liens chauds après le job trouvé.
59. **Rappels dates clés** — anniversaires boulot / changements de poste détectés → prétexte de relance.

**Sécurité / Confiance**
39. **Privacy & propriété des données** — données dans ta base, zéro partage tiers, chiffrement, mode sans-IA par contact, transparence sur ce qui part vers Claude, export/suppression. (Honnête: l'IA implique l'envoi du texte à l'API Anthropic — pas de training, rétention limitée.)
50. **Garde-fou anti-robot + liste noire IA** — variation entre messages d'une campagne, timing d'envoi naturel, revue humaine, bannir les tells IA (tirets cadratins, formules ampoulées, emoji clichés).

**E — Eliminate**
60. **Auto-archivage des contacts morts** — sortis de la file active après relances épuisées (archivés, pas supprimés).
62. **Mort aux stats vanity** — n'afficher que l'actionnable. Humilité = progrès.

**R — Reverse/Rearrange**
64. **Opportunité d'abord → qui peut m'introduire** — partir d'une boîte cible, trouver qui dans le réseau peut connecter.
65. **Auto-statut depuis les réponses** — détection réponse email (Gmail) → passe en "répondu" auto.

**Différé / backlog (Phase 2)**
- 49 Multilingue (CDI étranger plus tard) · 58 Prospection freelance (+ freelances = cible du futur SaaS) · 63 Planif à rebours (à réconcilier avec l'expansion infinie).

**Rejetées (Phase 2)**
- 61 Brouillon toujours pré-généré (gênant) · 66 Pitch transférable (jugé inutile).

### Phase 3 — What If (vision / ambitieux)

67. **L'app bosse pendant que tu dors** — agent semi-autonome prépare chaque nuit une file de brouillons sur les bons contacts ; tu valides/édites en 5 min au réveil. Conditionné à #73.
68. **Timing parfait / signaux d'intention** — détection de signaux publics (changement de poste, levée de fonds, recrutement) → "Contacte X MAINTENANT, voici pourquoi". PRIORITÉ HAUTE (coup de cœur). Vrai levier opportuniste.
72. **Architecture simple, peu de menus** — UX non-négociable : 2-3 zones max, vue "action du jour" par défaut, onboarding 2 min. Mobile-first force la simplicité. À matérialiser en Phase 4 (organisation).
73. **Style personnel appris** — Claude apprend ta plume via few-shot/RAG sur tes meilleurs messages passés (PAS de fine-tuning : exemples injectés en contexte, instantané et quasi gratuit). Tout sonne comme toi → anti-robot par construction.

**Différé (Phase 3)**
- 69 Multijoueur / squad d'accountability + partage d'intros → phase 2 du SaaS (une fois décollé).

**Rejetées (Phase 3)**
- 70 Prédiction de chances (spéculation) · 71 Simuler la réponse (envoyer = la vraie réponse, anti-overthinking).

## Organisation & Architecture (Phase 4)

### Structure de l'app — 3 onglets + composeur en flow (mobile-first, exigence #72)

**🟢 AUJOURD'HUI** (écran par défaut, cockpit) — file du jour, quoi faire maintenant.
- #1 file du jour · #35 l'app choisit qui · #54 file infinie · #55 expansion réseau · #23 zéro fuite/relances dues · #68 alertes timing · #24 streak.

**🔵 RÉSEAU** (contacts + opportunités au même endroit).
- #3 mémoire contact · #4 froideur · #34 import par lien · #37 import massif · #38 tri auto · #10 canaux · #16 opportunités · #17 graphe referral · #18 pitch · #19 stade+next action · #64 opportunité-first · #59 dates clés.

**🟣 STATS** (humilité = progrès).
- #20 funnel · #21 stats canal/tier · #22 recettes gagnantes · #62 anti-vanity · #25 wins · #26 XP · #27 achievements · #28 heatmap · #29 récap dimanche.

**⚙️ RÉGLAGES** (config).
- #11 canaux/envoi · #39 privacy · #73 style appris · #31 PWA/notif · auth.

**✍️ COMPOSEUR** (flow, pas un menu — s'ouvre depuis un contact).
- #2 form+Améliorer · #5 3 variantes · #6 canal-aware · #7 champ unique · #9 verrou après envoi · #12 détecteur copier-coller · #13 clarté ask · #14 temps lecture · #33 vocal · #36 point commun · #42 relance via composeur · #44 générer de 0 · #45 ton historique · #46 adapté destinataire · #50 anti-robot · #8 statut.

### Phasage

**MVP (build d'abord) — la boucle qui marche, utilisable au quotidien**
- Contacts : ajout manuel + import LinkedIn CSV (#37 partiel).
- Composeur : écrire / Améliorer / Générer (#2 #44), champ unique (#7), copier→envoyé (#7), log multicanal (#34 canal), statut (#8), verrou (#9).
- File du jour basique (#1).
- Relances zéro fuite (#23).
- Coquille PWA mobile-first (#32) + auth + privacy de base (#39).

**v1 — valeur ajoutée**
- Opportunités/pipeline (#16 #18 #19 #64) · Analytics funnel + recettes (#20 #21 #22 #62) · Gamification (#24-29) · Style appris (#73) · Auto-statut email (#65) · Expansion réseau (#55) · **Timing/signaux #68 (remonté)** · Notif push (#31).

**v2 — ambitieux**
- Agent nocturne (#67) · Recherche avant écriture (#52) · A/B test (#51) · Vocal (#33) · Séquences relance multi-étapes (#53) · Campagnes (#43).

**v3 — SaaS**
- Multi-user · Social/squad (#69) · Billing · Freelances comme cible (#58).

### Plan d'action MVP (build order)
1. Setup : Next.js (PWA) + Turso (déjà en place) + auth single-user + Tailwind mobile-first.
2. Modèle data : `contacts`, `channels`, `messages` (date, canal, statut, texte figé), `next_actions`. Opportunités en v1.
3. Import LinkedIn CSV → table contacts.
4. Onglet Réseau : liste contacts + fiche contact (historique).
5. Composeur : champ unique, boutons Améliorer/Générer (API Claude), Copier, Envoyé → log message+canal+statut, verrou.
6. Onglet Aujourd'hui : file (nouveaux + relances dues).
7. Logique relance (next-action date) = zéro fuite.
8. PWA : manifest + service worker + Web Push (notif tel).

### Prochaines étapes concrètes (cette semaine)
- Exporter tes connexions LinkedIn (CSV) pour avoir la vraie donnée de test.
- Valider le modèle data (contacts ↔ messages ↔ canaux).
- Scaffold Next.js PWA + brancher Turso existant.
- Construire le Composeur en premier (cœur de valeur), tester sur 5 vrais contacts.

## Session Summary and Insights

**Réalisations :**
- Pivot stratégique acté : abandon de l'ingestion d'alertes email (cold apply) → outreach chaud sur le réseau personnel.
- ~55 features générées et organisées via 3 techniques, rangées en 3 onglets + composeur en flow (UX simple non-négociable).
- Phasage MVP → v1 → v2 → SaaS défini, avec build order et next steps concrets.

**Insights clés :**
- Le cœur de valeur n'est pas le tracking mais le **composeur IA anti-robot** + le **pipeline d'opportunités**. C'est ce qui n'existe pas packagé sur le marché (Dex/Clay = CRM relationnel sans composeur/pipeline ; Lemlist/Waalaxy = sales spammy/cher).
- Le projet a un **effet méta** : un dev qui livre un SaaS de recherche d'emploi = projet portfolio qui aide à décrocher le job.
- Contraintes techniques honnêtes intégrées : pas de scraping LinkedIn (ban), import CSV officiel ; IA few-shot (pas fine-tuning) ; iOS Web Push nécessite "ajout écran d'accueil".
- Garde-fou produit récurrent du user : tout doit sentir l'humain, jamais le dashboard automatisé (liste noire des tells IA, dont les tirets cadratins).

**Roadmap SaaS (vision long terme) :** (1) app perso → (2) extension aux potes → (3) SaaS payant (cible incluant freelances). Archi propre dès le départ (auth + données scopées par user) mais single-user pour l'instant.

---
_Session BMad Brainstorming clôturée — 2026-06-15._



