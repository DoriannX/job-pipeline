---
title: "PRD — Plume (job-pipeline)"
status: final
created: 2026-06-15
updated: 2026-06-16
---

# PRD : Plume
*Nom de travail confirmé. Le repo technique reste `job-pipeline`.*

## 0. Objet du document

Ce PRD s'adresse au fondateur-développeur (rôle PM + dev), à de futurs contributeurs, et aux workflows aval (UX, architecture, epics/stories). Il décrit le périmètre **MVP en profondeur** ; v1/v2/SaaS sont résumés en annexe Roadmap (§14), le phasage détaillé vivant dans le brainstorming source. Il s'appuie sur trois inputs amont qu'il ne duplique pas : le [PRFAQ](../../prfaq-job-pipeline.md), son [distillat PRD](../../prfaq-job-pipeline-distillate.md) et la [session de brainstorming](../../../brainstorming/brainstorming-session-2026-06-15.md). Structure : vocabulaire ancré par le Glossaire (§3), features groupées avec FRs numérotés globalement (FR-1..N), hypothèses taguées `[ASSUMPTION]` inline et indexées (§13). Les choix techniques (entités de données, transport, mécanismes) vivent dans `addendum.md`, pas ici.

**Gouvernance — préséance UX :** en cas de conflit entre ce PRD et l'UX/design (plus récent), **l'UX prime** et ce PRD est mis à jour en conséquence. Ce document reste la source de vérité produit pour tout ce que l'UX ne tranche pas.

Garde-fou rédactionnel appliqué à ce document : pas de tirets cadratins, pas de formules ampoulées, pas de tics d'IA. Cohérence avec le garde-fou produit "tout doit sentir l'humain".

## 1. Vision

Plume aide un chercheur d'emploi à activer son réseau personnel pour décrocher un poste, en écrivant des messages dans **sa propre voix** en quelques secondes, sans que rien ne sonne jamais comme un copier-coller d'IA. Le produit supprime un compromis que tout le monde subit : plus tu veux bien faire, plus c'est lent ; plus tu vas vite, plus ça sonne faux. Plume part de ta voix, apprend ta façon d'écrire, et te la rend plus vite. La technologie disparaît, il ne reste que toi.

Le cœur de valeur, le seul différenciateur, est le **composeur "ta voix"** : un champ unique où tu notes une idée brute et qui ressort dans ton ton, prête à envoyer, sans les tics qui font justement "IA". Autour, un **pipeline d'opportunités** (Contacts, et plus tard Opportunités et Messages) et des **relances zéro-fuite** assurent que rien ne se perd : à qui as-tu écrit, où ça en est, quand relancer. Le pipeline et les relances sont des table stakes, copiables ; le composeur est le moat.

Plume se construit d'abord comme outil personnel (dogfooding par le fondateur), puis pour quelques proches, puis comme SaaS si la valeur se confirme. Le livrable garanti est l'outil perso et son effet portfolio ; la thèse SaaS est un pari à valider, pas un acquis. L'architecture est SaaS-ready dès le départ (auth, données scopées par utilisateur), l'exploitation reste mono-utilisateur pour l'instant.

## 2. Utilisateur cible

### 2.1 Jobs To Be Done

- **Fonctionnel** : écrire vite un message personnel et pertinent à un contact du réseau, sur le bon canal, sans repartir d'une page blanche à chaque fois.
- **Fonctionnel** : ne jamais perdre le fil (à qui ai-je écrit, quel était le dernier échange, qui dois-je relancer aujourd'hui).
- **Émotionnel** : ne pas avoir honte d'un message générique ; envoyer quelque chose dont on est fier, qui sonne humain.
- **Émotionnel** : garder le moral pendant une recherche longue (sentir une progression, pas seulement des refus).
- **Social** : entretenir des liens sans paraître intéressé ou robotique ; demander une intro ou un referral de façon naturelle.
- **Contextuel** : gérer son outreach depuis le téléphone, en déplacement, en quelques minutes par jour.
- **Builder** : le fondateur se sert du produit lui-même comme levier (dogfooding + portfolio) pour décrocher son propre poste.

### 2.2 Non-utilisateurs (MVP)

- **Freelances / prospection commerciale** : cible d'un futur SaaS (willingness to pay supérieure), explicitement hors persona MVP pour ne pas le diluer.
- **Recruteurs / sourcing sortant à fort volume** : Plume n'est pas un outil de cold outreach de masse.
- **Quiconque cherche un automate d'envoi** : Plume assiste la composition, n'automatise pas l'envoi.

### 2.3 Parcours utilisateurs clés

*Protagoniste : Camille, dev en recherche active, qui chasse via son réseau perso depuis son téléphone. Numérotés UJ-1..N ; les FRs y réfèrent inline.*

- **UJ-1. Camille passe sa file du jour en cinq minutes, dans le métro.**
  > Camille, dev en recherche depuis trois semaines, ouvre Plume sur son téléphone (déjà connectée via Google sur une session précédente). L'app s'ouvre directement sur **Aujourd'hui** : trois nouveaux contacts à joindre et deux relances dues, priorisés. Elle prend la première carte, tape "ex-collègue, est passé chez Datadog, lui demander s'ils recrutent" dans le champ unique du composeur, touche **Générer**. Le texte ressort dans son ton, court (canal LinkedIn), sans formule ampoulée. Elle change deux mots, copie, colle dans LinkedIn, revient, marque **Envoyé**. La carte disparaît, la suivante monte. Cinq minutes, cinq touches envoyées, zéro page blanche. **Edge case** : dans un tunnel sans réseau, Générer est indisponible (grisé) ; le champ reste éditable, elle écrit à la main et marque Envoyé, rien n'est perdu (FR-7).

- **UJ-2. Camille améliore un brouillon qu'elle a écrit elle-même.**
  > Sur une relance qui compte (un hiring manager rencontré à un meetup), Camille préfère écrire son jet à la main. Elle tape trois phrases maladroites dans le champ unique, touche **Améliorer**. Plume retravaille en place, garde ses idées et son ton, enlève la lourdeur, propose une version canal-email plus structurée. Elle relit, ajuste, copie, envoie, marque Envoyé. Le message est figé dans la timeline du contact (verrou read-only) ; un bouton Modifier discret reste si besoin.

- **UJ-3. Plume rattrape Camille avant qu'une piste refroidisse.**
  > Cinq jours après un premier message resté sans réponse, Camille reçoit une **notification push** sur son téléphone : "Relance due : Sofiane (Algolia)". Elle ouvre Plume, la relance est déjà en haut de la file du jour. Le composeur propose une relance qui apporte de la valeur (un angle nouveau) plutôt qu'un "alors ?". Elle envoie. Le compteur "zéro fuite" reste à zéro touche perdue.

## 3. Glossaire

*Termes à utiliser verbatim dans les FRs, UJs et SMs. Pas de synonyme ailleurs dans le document.*

- **Contact** — une personne du réseau de l'utilisateur. Possède une identité, une source d'import, un Score de froideur, et une timeline de Messages. Un utilisateur a N Contacts.
- **Message** — une communication adressée à un Contact, sur un Canal donné. Possède une date, un Canal, un Statut, et un texte figé. Un Contact a N Messages.
- **Canal** — le support d'un Message : LinkedIn, Email, WhatsApp, SMS. Conditionne le comportement canal-aware du Composeur. Au MVP, tous les Canaux fonctionnent en copier-vers-Envoyé (pas d'envoi direct).
- **Statut** — état d'un Message dans son cycle de vie : brouillon, envoyé, vu, répondu, ignoré. Modifiable d'un tap. Au MVP, les transitions au-delà d'"envoyé" sont saisies manuellement.
- **Composeur** — l'écran (en flow, hors barre d'onglets) où l'utilisateur rédige un Message via un champ unique, avec les actions Générer et Améliorer.
- **Voix** — la façon d'écrire propre à l'utilisateur, que le Composeur cherche à reproduire.
- **Few-shot voix** — mécanisme du Composeur : injection en contexte d'exemples des Messages passés de l'utilisateur (pas de fine-tuning) pour générer dans sa Voix.
- **Seed de voix** — exemples de messages collés optionnellement à l'onboarding pour amorcer la Voix avant tout envoi.
- **Tell d'IA** — marqueur qui trahit un texte généré (tiret cadratin, formule ampoulée, emoji cliché, ton trop lisse). Le Composeur applique une **Liste noire des Tells**.
- **Score de froideur** — indicateur, par Contact, de l'ancienneté du dernier échange. Sert au tri et aux alertes de refroidissement.
- **File du jour** — la liste priorisée affichée sur l'onglet Aujourd'hui : nouveaux Contacts à joindre + relances dues.
- **Relance** — une Next-action datée rattachée à un Contact, qui déclenche une notification et alimente la File du jour quand elle est due.
- **Zéro-fuite** — garantie qu'aucune Relance due n'est oubliée (compteur de touches perdues maintenu à zéro).
- **Opportunité** *(v1, défini pour référence amont)* — un poste ciblé chez une entreprise, reliant N Contacts et N Messages, avec un stade et une next-action. Absente du MVP.

## 4. Features (MVP)

*Chaque sous-section est une feature cohérente : description comportementale, puis FRs numérotés globalement. Les FRs réfèrent aux UJs inline.*

### 4.1 Import et gestion des Contacts (onglet Réseau)

**Description :** L'utilisateur peuple son réseau par trois voies, du plus instantané au plus volumineux : ajout manuel d'un Contact, ajout rapide multiple (coller une liste, N Contacts d'un coup), et import CSV de l'export LinkedIn officiel. **Le démarrage ne dépend pas du CSV** : l'export LinkedIn complet peut prendre jusqu'à 24h, ce qui casserait le cold-start ; les voies manuelle et rapide permettent de commencer en quelques secondes (les 5-10 personnes à contacter aujourd'hui), et le CSV s'importe en **backfill asynchrone** quand il arrive. Pas de scraping LinkedIn (CGU, risque de ban) ni de scan Gmail au MVP (reporté en v1). Chaque Contact a une fiche qui est une timeline complète de ses Messages. Un Score de froideur signale les liens qui refroidissent. L'onglet Réseau liste les Contacts, triables et filtrables. Réalise le socle de UJ-1.

**Functional Requirements :**

#### FR-1 : Import CSV LinkedIn en backfill asynchrone (optionnel)
L'utilisateur peut importer un fichier CSV issu de l'export LinkedIn officiel pour enrichir son réseau en masse, à tout moment, sans que ce soit un prérequis au démarrage.
**Consequences (testable) :**
- L'app est pleinement utilisable (ajout, composeur, file du jour) **avant** tout import CSV ; aucun parcours ne bloque sur l'attente du CSV.
- Un CSV LinkedIn standard est parsé ; chaque ligne valide crée ou met à jour un Contact.
- Les doublons sont fusionnés, pas dupliqués, y compris avec des Contacts déjà ajoutés à la main (FR-2) ou en rapide (FR-34). `[ASSUMPTION: clé d'identité = email si présent, sinon nom normalisé + entreprise ; en cas d'ambiguïté, proposer une fusion manuelle plutôt que fusionner à tort. L'export LinkedIn rédige souvent l'email, donc le fallback nom+entreprise est le cas courant.]`
- Une ligne malformée est ignorée sans bloquer l'import ; un compte-rendu (N créés, N fusionnés, N ignorés) est affiché.
**Out of Scope :** scraping LinkedIn ; import Google Contacts ; scan Gmail (v1).

#### FR-2 : Ajout et édition manuelle d'un Contact
L'utilisateur peut créer et éditer un Contact à la main (identité, Canal de prédilection, notes).
**Consequences (testable) :**
- Un Contact peut être créé sans import, avec au minimum un nom.
- Un Contact créé à la main est immédiatement actionnable (ouvre le Composeur en flow, FR-13).
- L'édition met à jour la fiche sans casser la timeline existante.
- L'utilisateur peut supprimer un Contact (et ses Messages/Relances) ou un Message individuel ; la suppression est confirmée et irréversible.

#### FR-34 : Ajout rapide multiple
L'utilisateur peut créer plusieurs Contacts d'un coup en collant une liste (un par ligne, ex. "Nom, Entreprise"). Voie d'entrée instantanée pour saisir les cibles du jour sans attendre le CSV. Réalise le cold-start de UJ-1.
**Consequences (testable) :**
- Coller N lignes crée N Contacts en une action.
- Les Contacts ainsi créés sont dédupliqués contre l'existant (et le seront contre un CSV ultérieur, FR-1).
- `[ASSUMPTION: format minimal = un nom par ligne ; "Nom, Entreprise" parsé en best-effort ; pas d'enrichissement automatique au MVP.]`

#### FR-3 : Fiche Contact = timeline complète
L'utilisateur peut consulter une fiche Contact présentant l'historique chronologique de tous ses Messages.
**Consequences (testable) :**
- La fiche liste les Messages par date, avec Canal et Statut.
- Depuis la fiche, l'utilisateur peut ouvrir le Composeur en flow pour ce Contact. Réalise UJ-1, UJ-2.

#### FR-4 : Score de froideur
Le système calcule et affiche, par Contact, un Score de froideur fondé sur l'ancienneté du dernier échange. `[ASSUMPTION: au MVP, score = fonction de la récence du dernier Message (ex. fraîcheur < 30j, tiède 30-90j, froid > 90j) ; pas de pondération par fréquence ni par tier. Seuils à ajuster.]`
**Consequences (testable) :**
- Un Contact jamais contacté (cas majoritaire juste après un import CSV) a un état distinct "jamais contacté", pas un Score de froideur ; il alimente le bucket "nouveaux Contacts à joindre" de la File du jour (FR-23), pas les relances.
- Un Contact avec au moins un échange et sans nouvel échange depuis le seuil "froid" est marqué froid.
- Le tri du Réseau par froideur fait remonter les liens qui refroidissent.

#### FR-5 : Liste et tri du Réseau
L'utilisateur peut parcourir, trier et filtrer ses Contacts depuis l'onglet Réseau.
**Consequences (testable) :**
- Tri par Score de froideur et par date de dernier Message.
- Filtre par Statut du dernier Message (ex. en attente de réponse).

### 4.2 Composeur "ta voix" (le héros)

**Description :** Cœur du produit et seul moat. Un **champ unique** est la source de vérité : le texte affiché EST le Message. Deux actions : **Générer** (à partir d'une idée brute, champ vide par défaut, jamais de pré-génération automatique) et **Améliorer** (retravaille le texte existant en place). La génération est canal-aware (LinkedIn court, Email structuré, WhatsApp court). Elle s'appuie sur le **Few-shot voix** (injection des Messages passés de l'utilisateur, pas de fine-tuning) et applique systématiquement la **Liste noire des Tells d'IA**. La revue humaine est obligatoire : Plume ne génère pas pour envoyer à ta place, il génère pour que tu relises et envoies. Le Composeur s'ouvre **en flow** depuis un Contact, jamais depuis un menu. Réalise UJ-1, UJ-2.

**Functional Requirements :**

#### FR-6 : Champ unique source de vérité
L'utilisateur dispose d'une zone éditable unique dont le contenu est exactement le Message à envoyer.
**Consequences (testable) :**
- Sans action IA, le texte tapé est directement le Message (aucune séparation prompt/sortie).
- Le champ est vide par défaut à l'ouverture (pas de brouillon pré-généré).

#### FR-7 : Générer un Message
À partir d'une idée brute, l'utilisateur peut générer un Message dans sa Voix via l'API Claude.
**Consequences (testable) :**
- L'entrée "idée brute" produit un texte éditable inséré dans le champ unique.
- La génération respecte le Canal sélectionné (FR-9) et la Liste noire des Tells (FR-11). Réalise UJ-1.
- En cas d'échec API (timeout, 5xx, quota) ou hors-ligne (cas fréquent en mobilité, UJ-1), l'app le signale clairement, le champ unique reste éditable et l'utilisateur peut écrire/envoyer son Message à la main ; aucune saisie n'est perdue.
- Pour instrumenter le moat (SM-1), le texte généré est conservé en regard du texte finalement marqué Envoyé (couple généré / envoyé) afin de mesurer le taux d'édition. Ces données restent celles de l'utilisateur (privacy §7.2).

#### FR-8 : Améliorer un Message
L'utilisateur peut faire retravailler en place un texte qu'il a écrit, en conservant ses idées et sa Voix.
**Consequences (testable) :**
- "Améliorer" modifie le contenu du champ unique sans le remplacer par un texte hors-sujet.
- Le résultat reste éditable. Réalise UJ-2.

#### FR-9 : Génération canal-aware
La génération adapte longueur et registre au Canal (LinkedIn court, Email structuré, WhatsApp court). `[ASSUMPTION: SMS traité comme WhatsApp (très court) au MVP.]`
**Consequences (testable) :**
- Le même prompt sur Canal LinkedIn vs Email produit des longueurs/structures distinctes.

#### FR-10 : Few-shot voix minimal
Le Composeur injecte en contexte des exemples des Messages passés de l'utilisateur (et le Seed de voix s'il existe) pour générer dans sa Voix. Pas de fine-tuning.
**Consequences (testable) :**
- En présence d'exemples, le texte généré reflète le ton de l'utilisateur (évalué qualitativement via SM-1).
- En l'absence d'exemples, un ton neutre et sobre par défaut est utilisé (pas d'échec).

#### FR-11 : Liste noire des Tells d'IA
Chaque génération applique une liste noire de marqueurs d'IA (tiret cadratin, formules ampoulées, emoji clichés, ton trop lisse).
**Consequences (testable) :**
- Aucun tiret cadratin dans un texte généré.
- Les formules de la liste noire sont absentes ou signalées avant envoi.

#### FR-12 : Revue humaine obligatoire
Aucun Message n'est envoyé automatiquement ; l'utilisateur relit et déclenche l'action d'envoi (au MVP : copier puis marquer Envoyé).
**Consequences (testable) :**
- Il n'existe aucun chemin produit qui envoie un Message sans action humaine explicite.

#### FR-13 : Composeur en flow
Le Composeur s'ouvre depuis un Contact (ou une carte de la File du jour), pas depuis la barre d'onglets.
**Consequences (testable) :**
- Le Composeur n'apparaît pas comme un onglet de navigation.
- Il porte toujours le contexte du Contact courant.

#### FR-14 : Choix du modèle
La génération utilise Claude Haiku par défaut ; Opus est sélectionnable. `[ASSUMPTION: au MVP mono-utilisateur, Opus est disponible en réglage manuel sans paywall ; le plafonnement/quota n'intervient qu'au SaaS.]`
**Consequences (testable) :**
- Le modèle par défaut est Haiku.
- Le choix de modèle est persistant par utilisateur.

#### FR-15 : Mode sans-IA par Contact — SUPPRIMÉ (2026-06-16, décision #30 close)
Retiré du périmètre, aligné sur l'UX (#18/#19). Inutile : le champ unique EST le Message (FR-6) et n'appelle l'API que sur action explicite Générer/Améliorer — ne pas générer = déjà aucun appel IA. Le cas hors-ligne / IA indisponible est couvert par FR-7 (champ éditable, écriture et envoi manuels). Le consentement à l'usage de l'IA est donné aux CGU à l'inscription ; pas d'opt-out par Contact. Conséquence data : plus de réglage par Contact, plus d'exclusion du corpus — tous les Messages envoyés alimentent la Voix (cf. FR-17), y compris ceux tapés à la main.

#### FR-35 : Historique de conversation par Contact (ajout 2026-06-21)
L'utilisateur peut coller et éditer l'historique brut de ses échanges passés avec un Contact (textarea libre, saisissable à la création du Contact et éditable ensuite). Quand un historique existe, il est injecté au prompt du Composeur (taille **bornée** côté serveur, cohérent NFR-5 coût / NFR-1 perf) pour produire un message en **continuité** : il rebondit sur le dernier point laissé en suspens plutôt que de seulement rappeler le passé. Le champ intention (FR-7) reste optionnel. Aucun parsing de format : le bloc est avalé tel quel (pas de démêlage qui-a-dit-quoi). Génération = Composeur, jamais le Copilote. Stockage brut sur le Contact ; curation/vie privée = responsabilité de l'utilisateur (il censure ce qu'il colle).
**Consequences (testable) :**
- Un Contact **avec** historique génère un message qui reprend le dernier point en suspens.
- Un Contact **sans** historique : génération inchangée (few-shot seul), aucune régression.
- L'historique injecté est tronqué au-delà de la borne serveur (jamais honoré tel quel).
- L'historique est scopé `user_id` et passe le test cross-tenant ; sanitizé à l'écriture.
- **Transparence (extension FR-32)** : quand une génération est lancée sur un Contact ayant un historique, ce dernier fait partie du contexte transmis à Claude — explicité au même titre que l'idée et le few-shot.

### 4.3 Apprentissage de la Voix

**Description :** La Voix s'amorce optionnellement à l'onboarding (Seed de voix) et s'affine au fil des envois : chaque Message édité puis envoyé devient un nouvel exemple. Friction d'onboarding minimale (priorité adoption) : on ne bloque pas à l'entrée.

**Functional Requirements :**

#### FR-16 : Seed de voix optionnel
L'utilisateur peut, à l'onboarding, coller des messages passés pour amorcer sa Voix ; c'est facultatif.
**Consequences (testable) :**
- L'onboarding se termine sans Seed (ton neutre par défaut).
- Un Seed fourni est immédiatement utilisé par le Few-shot voix (FR-10).

#### FR-17 : Apprentissage au fil de l'eau
Chaque Message marqué Envoyé (généré puis édité, ou tapé entièrement à la main) alimente le corpus de Voix utilisé par le Few-shot. `[ASSUMPTION: sélection des exemples = N Messages envoyés les plus récents et/ou les plus édités ; modélisation du corpus (entité voice_samples) traitée en addendum.]`
**Consequences (testable) :**
- Après plusieurs envois, les générations s'appuient sur des exemples réels de l'utilisateur.
- Tous les Messages envoyés alimentent le corpus, y compris ceux tapés à la main (signal de voix le plus pur) ; aucune exclusion par Contact (Mode sans-IA supprimé, FR-15).

### 4.4 Messages et Statut

**Description :** Un Message est enregistré avec sa date, son Canal, son Statut et un texte figé, rattaché à un Contact. Le Statut suit un cycle (brouillon, envoyé, vu, répondu, ignoré) modifiable d'un tap. Après passage à Envoyé, le texte est verrouillé en lecture seule, avec un bouton Modifier discret. L'action centrale du MVP est copier puis marquer Envoyé, valable pour tous les Canaux.

**Functional Requirements :**

#### FR-18 : Enregistrer un Message
Le système enregistre chaque Message (date, Canal, Statut, texte figé) dans la timeline du Contact.
**Consequences (testable) :**
- Un Message envoyé apparaît dans la fiche Contact (FR-3) avec son Canal et son Statut.

#### FR-19 : Cycle de Statut
L'utilisateur peut faire évoluer le Statut d'un Message d'un tap. `[ASSUMPTION: au MVP, les Statuts vu/répondu/ignoré sont saisis manuellement ; pas de détection automatique (auto-statut email = v1).]`
**Consequences (testable) :**
- Les transitions brouillon -> envoyé -> vu -> répondu/ignoré sont possibles en un tap.

#### FR-20 : Verrou après Envoyé
Un Message marqué Envoyé devient read-only ; un bouton Modifier discret permet de le rouvrir.
**Consequences (testable) :**
- Le texte d'un Message Envoyé n'est pas éditable sans passer par Modifier. Réalise UJ-2.

#### FR-21 : Copier puis marquer Envoyé
Pour tout Canal, l'utilisateur peut copier le texte du Composeur et marquer le Message Envoyé.
**Consequences (testable) :**
- L'action "Copier" place le texte dans le presse-papier et propose de marquer Envoyé.
- Aucune intégration d'envoi sortante n'est requise au MVP. Réalise UJ-1.

### 4.5 File du jour (onglet Aujourd'hui)

**Description :** Écran par défaut au lancement. Présente une file priorisée (nouveaux Contacts à joindre + relances dues), une action à la fois, pour exécuter sans réfléchir. Réalise UJ-1, UJ-3.

**Functional Requirements :**

#### FR-22 : Écran par défaut
Au lancement, l'app ouvre sur l'onglet Aujourd'hui et sa File du jour.
**Consequences (testable) :**
- Aucune navigation n'est nécessaire pour voir la première action.

#### FR-23 : File priorisée
La File du jour agrège et priorise les nouveaux Contacts à joindre et les relances dues. `[ASSUMPTION: priorisation MVP = relances dues d'abord (par retard), puis nouveaux Contacts par Score de froideur ; pas de scoring multi-critères (v1).]`
**Consequences (testable) :**
- Une Relance due apparaît dans la File le jour de son échéance.
- File vide (aucun Contact, aucune Relance, premier lancement) : un état vide explicite invite à ajouter un premier Contact (manuel/rapide), pas un écran blanc.

#### FR-24 : Action-first
La File présente une action à la fois, avec des gestes rapides. `[ASSUMPTION: actions = envoyé / skip / snooze, accessibles par bouton ou swipe.]`
**Consequences (testable) :**
- Traiter une carte (envoyer ou reporter) fait passer à la suivante sans quitter l'écran.

### 4.6 Relances zéro-fuite

**Description :** Après un échange, Plume programme automatiquement une Next-action datée. Une notification push prévient sur le téléphone quand une Relance est due. Un compteur garantit qu'aucune Relance n'est oubliée. Réalise UJ-3.

**Functional Requirements :**

#### FR-25 : Next-action automatique
Le système crée automatiquement une Relance datée après un Message envoyé resté sans réponse. `[ASSUMPTION: cadence par défaut = relance à J+5 si pas de réponse ; valeur ajustable, pas de cadence par tier au MVP.]`
**Consequences (testable) :**
- Un Message Envoyé sans Statut "répondu" génère une Relance à l'échéance par défaut.
- Marquer un Message "répondu" (ou "ignoré") clôt automatiquement la Relance en attente associée : Plume ne relance jamais un Contact déjà marqué comme ayant répondu.
- Le Statut étant manuel au MVP (FR-19), quand une Relance devient due la File la présente comme une confirmation en un tap ("Sofiane t'a répondu ?" -> Oui clôt la Relance / Non ouvre le Composeur de relance), garde-fou anti-faux-pas avant tout envoi.
- L'utilisateur peut décaler ou annuler une Relance.

#### FR-26 : Notification push de Relance
Le système envoie une notification push (Web Push via service worker) quand une Relance est due.
**Consequences (testable) :**
- Une Relance due déclenche une notification sur le téléphone de l'utilisateur abonné. Réalise UJ-3.
- `[ASSUMPTION: sur iOS, le Web Push exige l'ajout de la PWA à l'écran d'accueil ; l'app le signale explicitement.]`

#### FR-27 : Compteur zéro-fuite
L'utilisateur voit les Relances dues et en retard, et un compteur de touches perdues maintenu à zéro.
**Consequences (testable) :**
- Une Relance en retard est visible distinctement des Relances à venir.
- La garantie Zéro-fuite est délivrée in-app (File du jour + compteur), indépendamment du push : une Relance due apparaît toujours dans la File même si la notification (FR-26) n'a pas pu être envoyée (push refusé, iOS sans ajout à l'écran d'accueil, navigateur non supporté). Le push est une amélioration best-effort, pas l'unique canal.

### 4.7 Coquille PWA, Auth et Privacy

**Description :** Plume est une PWA installable, mobile-first, pensée pour un wrap natif ultérieur (Capacitor-ready) sans réécriture. L'authentification se fait via Google OAuth, les données sont scopées par utilisateur dès le départ (SaaS-ready) même si l'exploitation reste mono-utilisateur. La privacy est de première classe : données chez l'utilisateur, zéro partage tiers, export et suppression à la demande, transparence sur ce qui part vers l'API Claude.

**Functional Requirements :**

#### FR-28 : PWA installable
L'utilisateur peut installer Plume comme PWA sur mobile et desktop (service worker), sans store.
**Consequences (testable) :**
- L'app est installable et fonctionne en plein écran depuis l'écran d'accueil.
- L'architecture front n'empêche pas un wrap Capacitor ultérieur.

#### FR-29 : Auth Google OAuth, données scopées par utilisateur
L'utilisateur se connecte via Google OAuth ; toutes ses données sont scopées par son identité.
**Consequences (testable) :**
- Aucune donnée n'est lisible hors du périmètre de l'utilisateur connecté.
- Le schéma data porte un identifiant utilisateur sur les entités (Contacts, Messages, Relances).

#### FR-30 : Export des données
L'utilisateur peut exporter ses données à tout moment dans un format ouvert.
**Consequences (testable) :**
- Un export produit un fichier lisible (ex. JSON/CSV) contenant Contacts et Messages.

#### FR-31 : Suppression des données
L'utilisateur peut supprimer ses données à tout moment.
**Consequences (testable) :**
- La suppression retire les données de l'utilisateur de la base.

#### FR-32 : Transparence API
L'app explicite ce qui est transmis à l'API Claude et quand.
**Consequences (testable) :**
- Une mention claire indique qu'une génération (Générer/Améliorer) envoie le contexte du Message à l'API Claude, et qu'un Message tapé sans générer ne transmet rien.
- Quand le Contact a un historique (FR-35), la mention reflète que cet historique fait partie du contexte transmis à Claude lors d'une génération.

#### FR-33 : Onboarding court
L'onboarding (connexion Google, Seed optionnel, ajout des premiers Contacts en manuel/rapide) se fait en moins de deux minutes, **sans dépendre du CSV LinkedIn** (qui arrive en différé, FR-1).
**Consequences (testable) :**
- Un nouvel utilisateur atteint la File du jour et envoie un premier Message en moins de deux minutes sans étape bloquante.
- Aucune étape d'onboarding n'attend la livraison d'un export LinkedIn.

## 5. Non-Goals (explicites)

- **Pas un automate d'envoi** : aucun envoi sans revue humaine ; pas d'envoi auto LinkedIn (CGU, ban).
- **Pas de scraping LinkedIn** : import CSV officiel uniquement.
- **Pas un humanizer anti-détecteur** : Plume écrit comme toi, il ne cherche pas à tromper un détecteur d'IA.
- **Pas multi-utilisateur au MVP** : archi scopée par utilisateur, mais exploitation mono-utilisateur (multi-user = SaaS/v3).
- **Pas de pipeline d'Opportunités, d'analytics/funnel, de gamification au MVP** (v1).
- **Pas d'agent nocturne, de signaux de timing, de vocal, d'A/B test, de campagnes multi-contacts** (v2).
- **Pas de prédiction de chances de succès ni de simulation de la réponse du contact** (jugés spéculatifs/contre-productifs, exclus à toutes phases).
- **Pas de brouillon toujours pré-généré** (champ vide par défaut).
- **Pas de multilingue au MVP.**

## 6. Périmètre MVP

### 6.1 Dans le périmètre

- Contacts : ajout manuel + ajout rapide multiple (entrée instantanée) + import CSV LinkedIn en backfill asynchrone, dédup, Score de froideur, fiche timeline, onglet Réseau.
- Composeur "ta voix" : champ unique, Générer / Améliorer, canal-aware, Few-shot voix minimal, Liste noire des Tells, revue humaine, en flow, Haiku par défaut.
- Apprentissage Voix : Seed optionnel + apprentissage au fil de l'eau.
- Messages & Statut : enregistrement, cycle de Statut, verrou après Envoyé, copier puis marquer Envoyé (tous Canaux).
- File du jour : écran par défaut, file priorisée, action-first.
- Relances zéro-fuite : Next-action auto, notification push, compteur.
- Coquille PWA mobile-first + Auth Google OAuth + Privacy de base (export, suppression, transparence).

### 6.2 Hors périmètre MVP

- **Scan Gmail / enrichissement / auto-statut email** (v1). `[NOTE FOR PM: frontière émotionnellement neutre ; valeur d'import différée assumée.]`
- **Envoi direct (Email, WhatsApp, SMS via Twilio)** (v1). Tout passe par copier puis Envoyé au MVP.
- **Extension navigateur pré-remplissant LinkedIn** (fast-follow post-MVP).
- **Onglet Stats / analytics / funnel** (v1). `[ASSUMPTION: la navigation MVP se limite à Aujourd'hui + Réseau + Réglages ; l'onglet Stats apparaît en v1.]`
- **Pipeline d'Opportunités, gamification, style appris RAG complet, expansion réseau, signaux de timing** (v1).
- **Agent nocturne, recherche web avant écriture, saisie vocale, séquences multi-étapes, campagnes** (v2).
- **Multi-utilisateur, billing, social/squad, cible freelance** (v3 / SaaS).

## 7. Contraintes et garde-fous

### 7.1 Anti-robot / authenticité (sécurité produit)

- Liste noire des Tells d'IA appliquée à chaque génération (FR-11), tiret cadratin proscrit en tête.
- Revue humaine obligatoire avant tout envoi (FR-12) ; aucun envoi automatique.
- Écriture 100% manuelle toujours possible : le champ est éditable et l'envoi n'exige aucune génération (FR-6, FR-7) ; pour un échange sensible, ne pas générer suffit.
- Principe directeur : tout doit sentir l'humain, jamais le dashboard automatisé.

### 7.2 Privacy et données

- Données dans la base de l'utilisateur, scopées par utilisateur (FR-29), zéro partage tiers.
- Export (FR-30) et suppression (FR-31) à la demande, formats ouverts.
- Transparence sur ce qui part vers l'API Claude (FR-32) ; pas d'entraînement sur les données utilisateur, rétention limitée côté API.
- Export (FR-30) et suppression (FR-31) couvrent les données de l'utilisateur ; les droits des personnes fichées (Contacts, qui sont des tiers) relèvent du cadrage RGPD ci-dessous.
- `[NOTE FOR PM: base légale RGPD pour les données de tiers importées (Contacts) à cadrer (intérêt légitime, minimisation, information/droit à l'effacement des personnes fichées, transfert vers l'API tierce) AVANT toute ouverture SaaS. Tolérable en usage perso single-user ; non tolérable en multi-utilisateur. Owner : fondateur. Revisite : avant le jalon SaaS.]`

### 7.3 Coût (unit economics)

- Few-shot/RAG en contexte, pas de fine-tuning : génération quasi instantanée, coût par génération sous 1 centime (Haiku) à quelques centimes (Opus).
- Haiku par défaut (FR-14). Free tier SaaS à plafonner (quota de générations) pour ne pas laisser l'API manger la marge. `[NOTE FOR PM: quota non chiffré ; à définir au moment du SaaS.]`

### 7.4 Conformité plateforme

- Pas de scraping LinkedIn, pas d'envoi auto LinkedIn (CGU, ban). Import CSV officiel uniquement au MVP.

## 8. Plateforme

- **PWA mobile-first** (Next.js), installable mobile + desktop sans store, **Capacitor-ready** pour un wrap natif ultérieur sans réécriture.
- **Web Push** via service worker. Contrainte iOS : nécessite l'ajout à l'écran d'accueil (FR-26).
- Stack en place : Next.js + Turso + API Claude + Tailwind + Google OAuth. (Détail technique en addendum.)

## 9. Esthétique et ton

- **Ton des textes générés** : celui de l'utilisateur (Voix), sobre et neutre par défaut tant que la Voix n'est pas amorcée. Le texte généré adopte le registre de l'utilisateur (tutoiement ou vouvoiement) ; Plume ne l'impose pas. Proscrire tiret cadratin, formules ampoulées, emoji clichés, ton trop lisse.
- **Argument d'authenticité (à préserver dans le produit et sa comm)** : l'utilisateur donne le fond (l'idée, le contexte, l'intention), Plume met en forme dans sa voix ; ce n'est pas un robot qui se fait passer pour lui, c'est lui en plus rapide. C'est ce qui rend le produit honnête et désamorce le paradoxe "IA = faux".
- **Feel recherché** : soulagement de la charge mentale, pas une machine de productivité. La File du jour vise le "zéro décision" (une action à la fois) pour enlever le poids, pas pour cadencer. Tout doit sentir l'humain, jamais le dashboard automatisé.
- **Ton de l'UI** : minimal, action-first, humain et non "dashboard". 2-3 zones maximum, vue action du jour par défaut.
- **Ancrage de marque** : "Plume part de ta voix : il apprend ta façon d'écrire et te la rend, plus vite. La technologie disparaît, il ne reste que toi." Nom = Plume (la plume d'écriture, touche directe sur le héros).

## 10. Architecture de l'information (navigation)

- **3 onglets cible** : Aujourd'hui · Réseau · Stats, plus Réglages. Au MVP, Stats est différé (v1) ; navigation MVP = **Aujourd'hui · Réseau · Réglages**. `[ASSUMPTION]`
- **Composeur en flow** (hors barre d'onglets), ouvert depuis un Contact ou une carte (FR-13).
- **Aujourd'hui** : File du jour, relances dues, compteur zéro-fuite.
- **Réseau** : Contacts (liste, tri, fiche timeline, Score de froideur, import).
- **Réglages** : Canaux, Privacy (export/suppression/transparence), Seed/Voix, PWA/notifications, compte.

## 11. NFRs transverses

- **Perf composeur** : exemples injectés en contexte (pas de fine-tuning) ; génération perçue comme quasi instantanée (cible < 5 s avant le premier texte).
- **Archi SaaS-ready** : entités scopées par utilisateur dès J1 (FR-29), même en mono-utilisateur ; pas de sur-ingénierie multi-tenant prématurée.
- **Mobile-first strict** : tout parcours utilisable au pouce sur téléphone.
- **Privacy first-class** : voir §7.2.
- **Coût maîtrisé** : voir §7.3.
- **Résilience import** : un import partiellement invalide ne bloque pas (FR-1).

## 12. Risques et mitigations

- **R1 (n°1) - Faisabilité de la Voix.** Le Composeur ne produit pas une voix convaincante -> pas de moat, "un CRM de plus". *Mitigation :* instrumenter dès le MVP (SM-1), tester sur 20-30 vrais messages, comparer généré vs édité ; valider le nombre minimal d'exemples et la qualité de Haiku.
- **R2 - Personne ne paie.** Segment chercheur d'emploi transitoire et price-sensitive. *Mitigation :* l'outil perso + portfolio reste le livrable garanti ; tester un paywall sur 10-20 utilisateurs avant d'investir dans le SaaS.
- **R3 - Durcissement CGU (LinkedIn/Gmail).** *Mitigation :* CSV officiel, pas de scraping ; Gmail différé en v1.
- **R4 - Exposition RGPD (données de tiers).** *Mitigation :* minimisation, export/suppression dès le MVP ; cadrer la base légale avant SaaS (voir §7.2).
- **R5 - Burnout solo / point unique de défaillance.** *Mitigation :* scope MVP serré, build in public, livrer la boucle avant d'élargir.
- **R6 - Moat copiable (fenêtre, pas forteresse).** Folk est le fast-follower le plus crédible : il a déjà le pipeline/CRM, il ne lui manque que la voix few-shot orientée job. *Mitigation :* vitesse d'exécution + focus job-search + données de Voix accumulées par utilisateur (coût de sortie).

## 13. Pourquoi maintenant

La recherche d'emploi par le réseau est la voie efficace (54% des embauches via une connexion en 2025 ; cooptation ~10x plus de chances) mais difficile à exécuter régulièrement. En parallèle, l'outreach générique assisté par IA arrive en fin de cycle : les destinataires repèrent le ton IA, les plateformes filtrent le contenu détecté comme automatisé, les taux de réponse s'effondrent. Le différenciateur n'est donc plus "écrire avec l'IA" (commodité) mais "écrire comme toi" plus le contexte relationnel. Le wedge est ouvert : aucun acteur ne combine pipeline orienté-personnes (Contacts/Opportunités/Messages) + composeur few-shot "ta voix" + relances zéro-fuite. Careerflow s'en approche (networking tracker + IA de referral) mais reste sur des templates génériques, pas sur ta voix. C'est une fenêtre, pas une forteresse : l'avantage se joue sur la vitesse.

## 14. Roadmap (annexe)

*Phasage issu du brainstorming ; résumé, non détaillé en FRs.*

- **v1 - valeur ajoutée :** scan Gmail + enrichissement + auto-statut email ; pipeline d'Opportunités (Contacts <-> Opportunités <-> Messages, stade + next-action) ; analytics funnel + recettes gagnantes (anti-vanity) ; onglet Stats ; gamification (streak, XP, achievements, heatmap, récap dimanche) ; style appris (RAG complet) ; expansion réseau + "l'app choisit qui contacter" ; signaux de timing (remonté en v1, priorité haute) ; envoi direct (Email/WhatsApp/SMS) ; extension navigateur LinkedIn ; composeur avancé : 3 variantes (court / chaleureux / direct) et clarté de l'ask (flag des demandes vagues) ; import d'un Contact par URL avec auto-remplissage (couplé à l'extension navigateur).
- *Note phasage : la notification push (FR-26) a été remontée du v1 au MVP (cohérence avec la promesse zéro-fuite / UJ-3). Le scheduler serveur des relances est une dépendance d'infra à cadrer en architecture.*
- **v2 - ambitieux :** agent nocturne (file de brouillons) ; recherche web avant écriture ; A/B test ; saisie vocale ; séquences de relance multi-étapes ; campagnes multi-contacts.
- **v3 - SaaS :** multi-utilisateur ; billing ; social / squad d'accountability ; cible freelance.

## 15. Métriques de succès

**Primaires**
- **SM-1 : Faisabilité de la Voix.** Sur 20-30 vrais messages, taux d'édition faible (distance d'édition généré -> envoyé) : le généré est "assez toi" pour partir presque tel quel. Mesurable grâce à la conservation du couple (généré, envoyé) (FR-7). Métrique figée : **distance de Levenshtein normalisée par la longueur du texte envoyé** (généré→envoyé). Cible indicative : médiane < 20 % ; seuil **et** taille d'échantillon à calibrer au 1er test voix. Valide FR-7, FR-8, FR-10, FR-11. *Proxy direct du moat (R1).*
- **SM-2 : Usage perso soutenu.** Le fondateur utilise Plume chaque semaine pour son propre outreach et ne l'abandonne pas après un mois. Valide la boucle MVP (FR-22..FR-27).

**Secondaires (jalons de vérité)**
- **SM-3 : Un proche l'utilise sans le fondateur derrière.** Valide l'onboarding et l'ergonomie (FR-33, FR-24).
- **SM-4 : Un inconnu l'utilise sans le fondateur derrière.**
- **SM-5 : Quelqu'un paie** (test paywall sur 10-20 utilisateurs). Valide la thèse SaaS (R2).

**Contre-métriques (ne pas optimiser)**
- **SM-C1 : Sonner "IA".** Zéro Tell d'IA détecté à l'envoi (tiret cadratin, formules ampoulées). Ne jamais sacrifier l'authenticité à la rapidité. Contrebalance SM-1.
- **SM-C2 : Coût API par utilisateur actif.** Surveiller, ne pas laisser dépasser quelques dizaines de centimes à 1-2 EUR/mois. Contrebalance le réflexe "tout en Opus".
- **SM-C3 : Volume de messages.** Ne pas optimiser le nombre de messages envoyés : qualité > quantité, anti-spray. Contrebalance SM-2.

## 16. Questions ouvertes

1. **Pricing / willingness to pay** : modèle et palier non arrêtés (hypothèse freemium plafonné -> premium ~9-15 EUR/mois). À valider par paywall (SM-5).
2. **Faisabilité de la Voix** : à partir de combien d'exemples la Voix devient-elle convaincante ? Haiku suffit-il ou faut-il Opus ? (SM-1).
3. **RGPD** : base légale pour les données de tiers importées, à cadrer avant SaaS (§7.2).
4. **Seuils froideur / relance** : valeurs par défaut (FR-4, FR-25) à valider à l'usage.
5. **Acquisition / go-to-market** : taux de conversion organique inconnu ; plan concret à produire (2-3 communautés tech, build in public, + une boucle de feedback utilisateurs). Beachhead assumé = profils tech/devs en recherche.
6. **Détection du Statut "vu"** : confirmé manuel au MVP (FR-19) ? Auto-statut email en v1.
7. **Segment SaaS durable** (freelance / entretien réseau continu) : en roadmap, pas encore instruit.
8. **Estimation de delivery** : pièges connus (PWA + Web Push iOS, import CSV/dédup propre) susceptibles de déborder ; pas de découpage chiffré (à produire en epics/stories).

## 17. Index des hypothèses

*Chaque `[ASSUMPTION]` du document, pour confirmation explicite :*

- **§4.1 / FR-4** — Score de froideur = fonction de la récence du dernier Message (seuils 30j / 90j), sans pondération fréquence/tier.
- **§4.2 / FR-9** — SMS traité comme WhatsApp (très court) au MVP.
- **§4.2 / FR-14** — Opus disponible sans paywall au MVP mono-utilisateur ; quota seulement au SaaS.
- **§4.3 / FR-17** — Sélection des exemples de Voix = N Messages récents/édités ; modélisation du corpus en addendum.
- **§4.4 / FR-19** — Statuts vu/répondu/ignoré saisis manuellement au MVP.
- **§4.5 / FR-23** — Priorisation MVP = relances dues d'abord, puis nouveaux Contacts par froideur.
- **§4.5 / FR-24** — Actions de la File = envoyé / skip / snooze (bouton ou swipe).
- **§4.6 / FR-25** — Cadence de relance par défaut = J+5 sans réponse, ajustable, pas de cadence par tier.
- **§4.6 / FR-26** — iOS : Web Push nécessite l'ajout de la PWA à l'écran d'accueil.
- **§4.1 / FR-34** — Ajout rapide : format minimal un nom par ligne, "Nom, Entreprise" parsé best-effort, pas d'enrichissement auto au MVP.
- **§4.1 / FR-1** — Clé d'identité dédup = email si présent, sinon nom normalisé + entreprise ; fusion manuelle si ambigu.
- **§15 / SM-1** — Métrique = **distance de Levenshtein normalisée par la longueur du texte envoyé** (généré→envoyé) ; cible indicative médiane < 20 % ; algorithme figé, seuil + taille d'échantillon à calibrer au 1er test voix.
- **§6.2 / §10** — Navigation MVP limitée à Aujourd'hui + Réseau + Réglages ; onglet Stats en v1.
