---
name: Plume
status: final
updated: 2026-06-16
design_ref: ./DESIGN.md
sources:
  - ../../prds/prd-job-pipeline-2026-06-15/prd.md
  - ../../prfaq-job-pipeline.md
  - ../../prfaq-job-pipeline-distillate.md
  - ../../../brainstorming/brainstorming-session-2026-06-15.md
---

<!-- Spine distillée au Finalize depuis .decision-log.md, .working/, sources. Référence les tokens DESIGN.md via {chemin.du.token}. Ne pas éditer à la main pendant la Discovery. -->

# Plume — Experience Spine

> Le « comment ça marche » de Plume : architecture d'info, comportements, états, interactions, accessibilité, parcours. Le « à quoi ça ressemble » vit dans `DESIGN.md` ; ici on le **référence par token** (`{chemin.du.token}`), on ne le redécrit pas. En cas de conflit avec un mock, c'est cette spine et `.decision-log.md` qui gagnent.

## Foundation

PWA mobile-first, **utilisable au pouce** sur téléphone, installable sur l'écran d'accueil. Migration Capacitor prévue plus tard, sans réécriture ni store. **Aucun système d'UI tiers** : la direction artistique est maison, spécifiée dans `DESIGN.md`, qui est la référence d'identité visuelle de cette spine. La promesse comportementale fondatrice est **zéro courbe d'apprentissage** : l'utilisatrice comprend instantanément où elle est, quoi faire et comment, et ne se sent jamais perdue. Ton transverse : warm, humain, intime ; texte minimal partout (« zéro bloat ») ; jamais « dashboard ». Persona pilote : **Camille** (développeuse, recherche active, sur téléphone, ~5 min/jour). Premier utilisateur dogfooding : Doriann.

Le squelette d'app est constant : une zone de contenu plein écran au-dessus d'une **barre d'onglets à 3 entrées** (`{components.tabbar}`) ancrée en bas. Le composeur et l'onboarding sortent de ce squelette (voir IA).

## Information Architecture

| Surface | Atteinte depuis | Rôle |
|---|---|---|
| Aujourd'hui | Ouverture de l'app (écran par défaut, déjà connectée) · onglet | Le deck du jour : nouveaux contacts à joindre + relances dues, une carte à la fois |
| Réseau | Onglet | Galerie d'avatars de tout le réseau, triée par froideur |
| Fiche contact | Tap sur un avatar du Réseau | Histoire/timeline des échanges + froideur + canaux + bouton Écrire |
| Réglages | Onglet | Compte, voix, relances, modèle, consommation, confidentialité, à propos |
| Composeur | **En flow** : depuis « Écrire » (carte d'Aujourd'hui ou fiche contact) | Bottom-sheet montant pour rédiger un message, contact en contexte |
| Onboarding | Premier lancement uniquement | 5 écrans < 2 min, une décision par écran |

**Trois onglets maximum**, jamais plus (Stats prendra la 3e place en v1, hors MVP). Le **composeur est en flow, hors barre d'onglets** : il monte par-dessus le contexte du contact courant, jamais comme onglet de navigation. L'**onboarding** précède le squelette d'onglets. Aucun labyrinthe de menus, 2 à 3 zones par écran, une action à la fois.

→ Référence de composition (mocks promus, ce que chacun illustre) :
- [`mockups/plume-hero-v2.html`](mockups/plume-hero-v2.html) — **Aujourd'hui** (deck swipe) + **état vide**.
- [`mockups/plume-composeur-v2.html`](mockups/plume-composeur-v2.html) — **composeur** (bottom-sheet, champ unique, bouton intelligent, canal, tokens).
- [`mockups/plume-reseau-v1.html`](mockups/plume-reseau-v1.html) — **Réseau** (galerie d'avatars par froideur) + **fiche contact** (timeline).
- [`mockups/plume-onboarding-v1.html`](mockups/plume-onboarding-v1.html) — **onboarding** (5 écrans, pager).
- [`mockups/plume-reglages-v1.html`](mockups/plume-reglages-v1.html) — **réglages** (groupes, consommation, confidentialité).

(La règle « les spines gagnent en cas de conflit » est énoncée une fois, dans la blockquote d'en-tête.)

## Voice and Tone

Microcopy : le ton des **chaînes de l'app**. La personnalité de marque visuelle vit dans `DESIGN.Brand & Style`. Tutoiement systématique, chaleureux, jamais culpabilisant, jamais « dashboard ». **Aucun tiret cadratin, aucun tell d'IA** (formule ampoulée, ton lisse, emoji cliché) dans aucun texte, généré ou d'interface.

| Faire | Éviter |
|---|---|
| « Salut Camille » · « Par qui on commence ? » | « Bienvenue sur votre tableau de bord » |
| « C'est tout pour aujourd'hui. » · « Quatre liens repris, en douceur. » | « 0 tâche restante ✓ » · streaks, points, exclamations |
| « Un mot à Léa, ou laisse Plume proposer. » | « Saisissez votre message ci-dessous » |
| « Relance due depuis 2 jours, le bon moment pour reprendre le fil. » | « ALERTE : relance en retard » |
| « Léa t'a répondu ? » → Oui / Non | « Confirmer le changement de statut » |
| « Plume apprend de tous tes messages envoyés. » | « Vos données alimentent notre modèle d'IA. » |
| « Encore de la marge ce mois-ci. » | « Quota : 62 % consommé » |
| « Repose ta plume, elle t'attendra demain. » | « Revenez demain pour de nouvelles tâches ! » |
| Phrases courtes et complètes ; warm. | Bloat, texte explicatif, badges décoratifs, jargon. |

## Component Patterns

Comportement des composants. L'apparence vit dans `DESIGN.Components`. Rendus : deck/état vide → [`plume-hero-v2.html`](mockups/plume-hero-v2.html) ; composeur (champ, bouton intelligent, canal, tokens) → [`plume-composeur-v2.html`](mockups/plume-composeur-v2.html) ; avatar-blob/timeline → [`plume-reseau-v1.html`](mockups/plume-reseau-v1.html) ; toggle/stepper/segmented/consommation → [`plume-reglages-v1.html`](mockups/plume-reglages-v1.html).

| Composant | Surface | Règles comportementales |
|---|---|---|
| Deck de cartes (`{components.card-deck}`) | Aujourd'hui | Une carte plein écran à la fois, pile de cartes derrière. Gestes : voir Interaction Primitives. La carte courante porte le liseré `{colors.accent}` (celle qu'on s'apprête à écrire). Traiter une carte fait monter la suivante sans quitter l'écran. |
| Boutons d'action chunky (`{components.button-primary}` / `{components.button-secondary}`) | Aujourd'hui (sous le deck) | **Écrire** et **Plus tard** doublent les gestes verticaux (découvrabilité + accessibilité). Tap = même effet que le swipe correspondant. |
| Pager (`{components.pager}`) | Sous le deck · onboarding | Reflète la position dans le paquet / la séquence. Non interactif au tap (le feuilletage se fait au swipe horizontal). |
| Avatar-blob (`{components.avatar-blob}`) | Partout | Sa **couleur porte la froideur** (`{colors.cold.*}`) ; c'est le signal premier, pas le texte. Dans le Réseau, tap → fiche contact. |
| Bottom-sheet composeur (`{components.bottom-sheet}`) | Composeur (en flow) | Monte du bas ; le contexte du contact (blob + nom + canal) reste visible au-dessus. Se referme par geste vers le bas ou retour. |
| Sélecteur de canal (`{components.channel-selector}`) | Composeur | 4 segments (LinkedIn / Email / WhatsApp / SMS). Le **canal préféré du contact est pré-sélectionné** ; changeable en **1 tap**. Changer de canal réadapte le ton/la longueur du message (canal-aware). |
| Champ unique (`{components.field}`) | Composeur | **Source de vérité unique : le texte affiché EST le message.** Vide par défaut, jamais pré-généré. Éditable à tout moment, y compris après génération et en cas d'échec IA. |
| Bouton intelligent (Générer ↔ Améliorer) | Composeur | Champ **vide → « Générer »** ; dès qu'il y a du texte → **« Améliorer »**. Même bouton primaire, seuls libellé et picto changent. Améliorer retravaille en place (garde idées et ton). |
| Bouton Copier | Composeur (état généré) | **Copier = commit.** Met le message au presse-papier puis propose de marquer Envoyé (envoi MVP = copier-coller manuel, tous canaux). |
| Régénérer (mini, `{components.button-secondary}` carré) | Composeur (état généré) | Relance une génération sur le même contexte. Discret, secondaire. |
| Segmented Rapide/Soigné (`{components.segmented}`) | Composeur · Réglages | Choix de modèle (alias Haiku/Opus discrets). Dans le composeur : par message. Dans Réglages : défaut global. |
| Pill de tokens (`{components.token-pill}`) | Composeur (état généré) | N'apparaît **qu'après génération**. Affiche les tokens du message (« 1 180 tokens »). **Tappable → détail** de consommation. Absente tant que rien n'est généré. |
| Chip de relance (`{components.chip-relance}`) | Carte du deck · fiche | « Relance · 5 j ». Le point reprend la **froideur** du contact. |
| Coldtag (`{components.coldtag}`) | Carte · fiche | Étiquette texte discrète de l'état de froideur ; redondance accessible de la couleur de l'avatar, jamais le signal premier. |
| Hints de gestes | Pied de carte | Micro-indications discrètes (↑ écrire · ‹ › feuilleter · ↓ plus tard) pour rendre les gestes découvrables. |
| Repère « Relance due » | Fiche contact | Encart `{colors.accent-tint}` : rappelle qu'une relance est due, ton non alarmiste. |
| Timeline (group d'événements) | Fiche contact | Histoire chronologique des échanges (du plus récent au plus ancien), narrative, jamais une grille de données. Les messages envoyés sont marqués `{colors.accent}`. Sert d'anti-doublon (on voit ce qui a déjà été dit). |
| Carte de groupe / réglages (`{components.group-card}`) | Réglages | Lignes groupées, une intention par ligne. Tap → détail/toggle/stepper. Groupes « voix » et « confidentialité » portent l'offset accent. |
| Toggle (`{components.toggle}`) | Réglages | Activé = piste `{colors.accent}`. Rappels push. |
| Stepper (`{components.stepper}`) | Réglages | Délai de relance par défaut (− / valeur / +), « 5 jours » par défaut. |
| Bouton + (icon-button accent) | Réseau (en-tête) | Ouvre l'ajout de contact : manuel · ajout rapide multiple · import CSV. |
| Recherche | Réseau (en-tête) | Champ discret pour retrouver un contact par nom. |
| État vide | Aujourd'hui | Voir State Patterns. Jamais un écran blanc. |

## State Patterns

États rendus dans les mocks : deck non vide / vide serein → [`plume-hero-v2.html`](mockups/plume-hero-v2.html) ; composeur vide / généré → [`plume-composeur-v2.html`](mockups/plume-composeur-v2.html). Les apparences référencent les tokens `DESIGN.md`.

| État | Surface | Traitement |
|---|---|---|
| Ouverture à froid | Aujourd'hui | App déjà connectée, arrive directement sur le deck du jour. Pas de page d'accueil intermédiaire. |
| Deck non vide | Aujourd'hui | Carte courante au premier plan, pile derrière, pager + boutons + hints. |
| Deck terminé (vide serein) | Aujourd'hui | « C'est tout pour aujourd'hui. » + ligne douce + plume-mascotte qui plane + compteur rassurant (« 4 cartes feuilletées »). Jamais alarmiste, jamais blanc. |
| Premier lancement, réseau vide | Aujourd'hui | État vide explicite invitant à ajouter un premier contact (cold-start). Couvert logiquement ; rendu visuel précis non figé (voir Lacunes). |
| Composeur, champ vide | Composeur | Placeholder warm, bouton « Générer », pas de pill de tokens. |
| Génération en cours | Composeur | Cible perçue quasi instantanée (< 5 s avant le premier texte). Traitement de chargement précis non spécifié (voir Lacunes). |
| Composeur, texte généré | Composeur | Le message remplit le champ ; apparaissent Copier (primaire) + Améliorer + régénérer + pill de tokens. |
| Échec IA / hors-ligne | Composeur | **Le champ reste éditable, aucune saisie perdue** : Camille écrit/ajuste à la main et copie. Signalé clairement, sans casser le flow. Forme visuelle du signal non figée (voir Lacunes). |
| Relance due dans le deck | Aujourd'hui | Apparaît le jour de l'échéance (et toujours in-app même si le push a échoué). En retard = distinct des relances à venir. |
| Confirmation de relance | Aujourd'hui (deck) | « Léa t'a répondu ? » → **Oui** clôt la relance · **Non** ouvre le composeur de relance. 1 tap. Forme exacte (carte spéciale ?) non rendue (voir Lacunes). |
| Message après Envoyé | Fiche / timeline | Texte **figé read-only**, bouton Modifier discret pour rouvrir. Statut modifiable d'un tap (brouillon → envoyé → vu → répondu / ignoré). |
| Réseau, tri froideur | Réseau | Les liens qui refroidissent remontent ; repère « À relancer » en haut, « Plus au chaud » en dessous. Légende de froideur discrète. |
| Import CSV en cours | Réseau (arrière-plan) | Backfill asynchrone (~24 h), découplé du cold-start. Compte-rendu N créés / N fusionnés / N ignorés ; fusion manuelle proposée si dédup ambiguë. UI de résolution non designée (voir Lacunes). |
| Suppression | Fiche / Réglages | Confirmée et irréversible (contact + ses messages/relances, ou message seul). Destructif **soft** (`{colors.accent}` mesuré), jamais rouge alarme. |
| **Focus (clavier)** | Tout élément interactif | Anneau de focus net et visible (pas un halo flou : cohérent avec « flou = 0 » de DESIGN), en `{colors.accent}` sur un élément, en `{colors.ink}` sur fond mauve. L'ordre de focus suit l'ordre de lecture ; le bottom-sheet capture le focus tant qu'il est ouvert. |
| **Hover (pointeur)** | Boutons, lignes de réglages, avatars | Renforcement discret du contour `{colors.ink}` et/ou léger raccourcissement de l'offset (l'objet « s'enfonce » d'un cran). Aucun changement de couleur de remplissage diffus, aucune ombre molle. Secondaire au MVP (cible = tactile). |
| **Pressed (appui)** | Boutons chunky | L'offset dur se réduit voire s'annule (le bouton « se pose » sur sa base), translation de quelques px vers l'offset. Pas de ripple, pas de flou. Rend la matière physique du bouton. |
| **Disabled** | Bouton primaire (pendant « Génération en cours »), actions indispo | Opacité réduite + offset supprimé (l'objet « décolle » moins), `{colors.ink-hint}` pour le libellé, curseur non interactif. **Cas porteur : le bouton intelligent (Générer/Améliorer) passe disabled le temps de la génération** (champ envoyé à l'API), puis redevient actif. Aucun rouge, ton neutre. |
| **Permission push refusée** | Onboarding (écran 4) / Réglages | **Aucun blocage.** Si l'utilisateur refuse (ou ne l'accorde jamais) la permission de notification, la garantie **zéro-fuite tient in-app** : les relances dues apparaissent toujours en haut du deck (le push est best-effort, pas le filet). L'app ne re-demande pas en boucle : rappel doux et **ré-invite ponctuelle** possible (depuis Réglages, ou au moment où une relance échoit), jamais de modale insistante ni de culpabilisation. |

## Interaction Primitives

**Geste-first sur le deck, boutons en doublure partout.**

- **Deck Aujourd'hui (`{components.card-deck}`)** :
  - **Swipe horizontal (gauche/droite)** = **feuilleter le paquet / choisir sa carte** (navigation, pas d'action destructive). Sépare navigation de l'action.
  - **Swipe vers le haut** = **agir (écrire le message)** → ouvre le composeur. Doublé par le bouton **Écrire**.
  - **Swipe vers le bas** = **repousser à plus tard** (snooze). Doublé par le bouton **Plus tard**.
  - Les boutons chunky doublent **toujours** les gestes verticaux : découvrabilité + accessibilité (le swipe reste pour la vitesse).
- **Tap** : agir (ouvrir une fiche, choisir un canal, basculer un toggle, marquer un statut). 1 tap pour les décisions rapides (canal, « répondu ? », statut).
- **Composeur** : monte en bottom-sheet ; se referme par geste vers le bas ou bouton retour. Le contexte du contact reste ancré en haut.
- **Banni** : labyrinthe de menus, listes denses / tableur, swipe pour supprimer un contact (la suppression est une action confirmée, pas un geste), envoi automatique (aucun chemin n'envoie sans action humaine).

## Accessibility Floor

Comportemental. Le contraste visuel vit dans `DESIGN.md`.

- **Tout signal porté par la couleur a un doublon non-couleur.** La froideur (couleur de l'avatar) est redoublée par le **coldtag** texte et la légende ; le canal actif (aplat mauve) par son **libellé** ; l'onglet actif par label + soulignement + pastille.
- **Tout geste a un équivalent au tap.** Écrire et Plus tard existent en boutons ; choisir sa carte reste au swipe horizontal — prévoir un équivalent tap pour la navigation entre cartes (voir Lacunes).
- **Cibles tactiles confortables**, utilisables au pouce (boutons chunky pleine largeur ou dominants).
- **Lecteur d'écran** : chaque élément interactif annonce rôle + état (toggle « activé/désactivé », statut de message, froideur du contact, canal sélectionné). Le compteur zéro-fuite et l'état vide sont annoncés.
- **Ordre de focus = ordre de lecture** sur chaque écran ; le composeur (bottom-sheet) capture le focus tant qu'il est ouvert.
- **Pas de dépendance au mouvement** : les animations (plume qui plane, étincelles, dérive des nuages) sont décoratives ; rien d'essentiel ne repose dessus. Respecter Reduce Motion.
- **Pas de dictée micro au MVP** (feature v2) : aucune entrée vocale n'est requise pour accomplir une tâche.

## Le moat voix

Le cœur de valeur : « Plume part de ta voix : il apprend ta façon d'écrire et te la rend, plus vite. »

- **Few-shot, pas de fine-tuning** : la génération injecte en contexte les messages passés de l'utilisateur. La technologie disparaît, il ne reste que la voix de Camille.
- **Apprentissage continu, sans opt-out** : **tous les messages écrits servent à l'apprentissage** (consentement donné aux CGU au téléchargement). Pas de toggle, pas d'exclusion par message, pas de « Mode sans-IA » (supprimé). L'UI ne porte donc aucune complexité de mode. Réglages le dit franchement : « Plume apprend de tous tes messages envoyés. »
- **Seed de voix optionnel** : à l'onboarding, coller 1-2 anciens messages amorce immédiatement le few-shot. **« Passer » est évident** ; sans seed, ton neutre par défaut, et Plume apprend au fil de l'eau. Gérable plus tard depuis Réglages (« Gérer mes exemples de voix »).
- **Anti-tells d'IA** : l'utilisateur donne le fond (idée, intention) ; Plume met en forme dans son registre (n'impose ni tutoiement ni vouvoiement). Jamais de tiret cadratin, de formule ampoulée, d'emoji cliché, de ton lisse. Le climax recherché : « le message sonne comme elle, pas comme un robot ».
- **Revue humaine obligatoire** : aucun envoi automatique. Le commit passe toujours par Copier puis une action humaine.

## Coût & transparence

Un produit perso → SaaS où le coût par message compte ; la transparence est rassurante, pas anxiogène.

- **Compteur de tokens par message** : pill discret après chaque génération (« 1 180 tokens »), **tappable → détail**. Soigné consomme plus que Rapide.
- **Choix de modèle Rapide / Soigné** (Haiku/Opus) : dans le composeur (par message) et en défaut dans Réglages. Compact, jamais bavard.
- **Bloc Consommation** (Réglages) : messages + tokens du mois, barre de progression, ligne rassurante (« Encore de la marge ce mois-ci. »).
- **Transparence API** : mention claire qu'une génération envoie le contexte à l'API. Sans alourdir le composeur ni angoisser. Emplacement exact non figé (voir Lacunes).

## Modèle de froideur

Une échelle sémantique à **4 états, jamais alarmistes**, portée par **la couleur des avatars** (`{colors.cold.*}`), pas par du texte ni des icônes anxiogènes.

| État | Token | Sens |
|---|---|---|
| Jamais contacté | `{colors.cold.never}` | Contact sans aucun message ; pas de score de froideur ; bucket « nouveaux à joindre », pas les relances. |
| Frais | `{colors.cold.fresh}` | Échange récent. |
| Tiède | `{colors.cold.warm}` | Le lien commence à refroidir. |
| Froid | `{colors.cold.cold}` | Lien à reprendre avant de le perdre. |

Le **tri par froideur** (Réseau) fait remonter les liens qui refroidissent → pousse à entretenir avant la perte, en douceur. Aucune froideur n'est « chaude » (pas de jaune, corail, rouge). Le coldtag texte double la couleur pour l'accessibilité.

## Relances zéro-fuite

Garantie : aucune relance due n'est oubliée. Le compteur de touches perdues reste à zéro.

- **Next-action auto** : un message envoyé sans « répondu » programme une relance (J+5 par défaut, réglable au stepper).
- **Rappel push** : Web Push quand la relance est due. iOS exige l'ajout PWA à l'écran d'accueil → **l'app guide explicitement** vers cette étape (onboarding écran 4, skippable).
- **Garantie in-app indépendante du push** : une relance due **apparaît toujours dans le deck**, même si le push a échoué (refusé, iOS non installé, navigateur non supporté). Le push est best-effort, pas le filet de sécurité.
- **Confirmation 1 tap** : « Léa t'a répondu ? » → **Oui** clôt la relance · **Non** ouvre le composeur de relance (garde-fou anti-faux-pas). Décaler/annuler possible.
- **Couplage relance ↔ statut** : marquer « répondu » clôt la relance ; rester « envoyé » la maintient.
- **Relance = valeur, pas relance sèche** : le composeur propose un angle nouveau (article, update) plutôt qu'un « alors ? ».

## Inspiration & Anti-patterns

- **Repris de Headspace / Unpacking** : la chaleur cozy intime, le sentiment de carnet à soi.
- **Repris d'Alto's Odyssey** : la sérénité poétique du **grand vide** sur l'état vide (ciel, plume qui plane), au lieu d'un écran blanc culpabilisant.
- **Repris de Duolingo** : les **gros boutons chunky** et le micro-délice (étincelles), **sans** la mécanique de streak/punition.
- **Repris de Gumroad** : **couleur plate et confiante, zéro ombre molle**, profondeur par contour + offset net.
- **Principe transverse** : l'**illustration maison** (plume-mascotte, avatars blobs) est l'âme anti-template ; tout le reste la met en valeur.
- **Rejeté — le bleu corporate de LinkedIn** : Plume est un carnet intime, pas un réseau pro froid.
- **Rejeté — le tableur / CRM** : le Réseau est une galerie de blobs colorés par froideur, jamais une liste dense ; la fiche raconte une histoire, pas des données.
- **Rejeté — le « look IA »** : cartes génériques noyées d'ombres molles, dégradés pastel, police système, emojis-icônes, symétrie molle. Bannis.
- **Rejeté — les streaks / badges / gamification** au MVP : Plume soulage la charge mentale, ne cadence pas. Pas de compteur qui punit.
- **Rejeté — le paradigme liste-de-cartes-à-lire** (rejet total des 4 directions initiales pour densité de texte) : remplacé par le deck à une carte, texte minimal, action au geste.

## Responsive & Platform

PWA mobile-first, conçue pour le pouce sur une colonne unique. Pas de breakpoint desktop au MVP : Plume est un compagnon de téléphone, quelques minutes par jour.

| Plateforme | Comportement |
|---|---|
| PWA mobile (cible) | Installable sur l'écran d'accueil. Tout parcours utilisable au pouce. |
| iOS | Le push exige l'ajout PWA à l'écran d'accueil → **guidage explicite** (onboarding écran 4) ; sans ça, la garantie zéro-fuite tient quand même in-app. |
| Capacitor (plus tard) | Migration sans réécriture ni store ; même DA, même expérience. |

## Key Flows

Surfaces traversées (rendus) : Aujourd'hui + état vide → [`plume-hero-v2.html`](mockups/plume-hero-v2.html) ; composeur → [`plume-composeur-v2.html`](mockups/plume-composeur-v2.html) ; fiche/timeline → [`plume-reseau-v1.html`](mockups/plume-reseau-v1.html) ; onboarding → [`plume-onboarding-v1.html`](mockups/plume-onboarding-v1.html).

### Flow 1 — La boucle matinale de Camille (dans le métro, ~5 min)

1. Camille ouvre Plume ; déjà connectée, elle arrive sur **Aujourd'hui**, le deck du jour (« Salut Camille »).
2. Trois nouveaux contacts + deux relances dues, priorisés. La carte du dessus : **Léa Marchand**, tiède, chip « Relance · 5 j », note « Un petit mot pour reprendre le fil ? ».
3. Elle **feuillette** au swipe horizontal pour choisir sa carte ; elle s'arrête sur Léa.
4. Elle **swipe vers le haut** sur Léa (ou tape **Écrire**) → le **composeur** monte en bottom-sheet, Léa en contexte, canal **LinkedIn pré-réglé** (son canal préféré).
5. Le champ est vide ; elle tape une idée brute, ou laisse tel quel. Le bouton dit **« Générer »** ; elle le touche.
6. En moins de 5 s, le message remplit le champ : court (canal LinkedIn), dans son registre, **sans tiret cadratin ni formule ampoulée**. La pill « 1 180 tokens » apparaît.
7. Elle relit, change deux mots directement dans le champ (bouton bascule sur **« Améliorer »** dès qu'elle édite, mais elle n'en a pas besoin).
8. **[CLIMAX]** Elle relit une dernière fois : **le message sonne comme elle, pas comme un robot.** C'est elle, en plus rapide. Aucune honte d'un texte générique.
9. Elle touche **Copier** (= commit) → le texte part au presse-papier ; elle bascule sur LinkedIn, colle, envoie.
10. Elle revient ; Plume propose de **marquer Envoyé** → 1 tap. Le message se fige (read-only) dans la timeline de Léa, une **relance J+5** se programme, la carte disparaît et la suivante monte.

*Échec :* la génération échoue (réseau coupé dans le métro) → le champ reste éditable, signalé sans drame ; Camille écrit à la main et copie, aucune saisie perdue.

### Flow 2 — L'onboarding de Camille (premier lancement, < 2 min)

1. **Bienvenue** : la plume-mascotte plane, promesse « Tes messages à ton réseau, écrits comme toi. Jamais comme un robot. » → **Continuer avec Google**.
2. **Ta voix (optionnel)** : « Apprends ta voix à Plume » — coller 1-2 anciens messages. **« Passer pour l'instant »** est évident ; « j'apprends à chaque message ».
3. **Premier contact** : « Par qui on commence ? » — juste un **prénom et nom** → **Ajouter**. Liens discrets : Ajouter plusieurs · Importer mon réseau (CSV).
4. **Écran d'accueil (optionnel)** : « Garde Plume sous la main » → **Ajouter à l'écran d'accueil** (pour les rappels push) · **Plus tard** évident.
5. **[CLIMAX]** « Tout est prêt, Camille. » → **Voir ma journée** : elle arrive sur **Aujourd'hui** avec son premier contact déjà dans le deck, en moins de deux minutes, **sans avoir attendu le moindre import CSV**. Zéro tutoriel, une décision par écran.

*Découplage :* l'import CSV LinkedIn (backfill ~24 h) tourne en arrière-plan plus tard ; le cold-start n'en dépend jamais.

### Flow 3 — La relance zéro-fuite (J+5, sans réponse)

1. J+5 après le message à Sofiane, sans réponse : **notification push** « Relance due : Sofiane (Algolia) ».
2. Camille ouvre Plume ; la relance est **déjà en haut du deck** (et y serait même si le push avait échoué — garantie in-app).
3. La carte pose la question en **1 tap** : « **Sofiane t'a répondu ?** » → **Oui** / **Non**.
4. Elle touche **Non** → le **composeur** s'ouvre et propose une relance **à valeur ajoutée** (un angle nouveau), pas un « alors ? ».
5. **[CLIMAX]** Elle envoie, marque Envoyé, une nouvelle relance se reprogramme : **le compteur zéro-fuite reste à zéro.** Aucune touche perdue, aucune charge mentale.

*Variante :* si elle touche **Oui**, la relance se clôt, le statut passe à « répondu », rien d'autre à faire.

### Flow 4 — Améliorer un brouillon écrit à la main (UJ-2)

*Dérivé de UJ-2 (« Améliorer un brouillon écrit à la main », PRD §2.3 / source-extract §3) : le seul parcours où Camille part d'un texte qu'elle a tapé elle-même, champ non vide → Améliorer.*

1. Camille veut relancer **Sofiane** sur un point qui compte ; elle ouvre sa fiche depuis le **Réseau** et touche **Écrire** → le **composeur** monte, Sofiane en contexte, canal **Email** (son canal préféré pour ce sujet).
2. Plutôt que de générer, elle **tape elle-même 3 phrases maladroites** : ses idées sont là, la formulation non. Comme le champ n'est plus vide, le bouton intelligent affiche **« Améliorer »** (et non « Générer »).
3. Elle touche **Améliorer**. Plume **retravaille en place** : il garde ses idées et son ton, ne réécrit pas un texte étranger, et **adapte au canal Email** (un peu plus structuré que LinkedIn).
4. Le champ se met à jour avec sa version améliorée ; la pill de tokens apparaît. Elle relit, ajuste **deux mots directement dans le champ** (le champ reste l'unique source de vérité, éditable).
5. **[CLIMAX]** C'est toujours **son** message — ses idées, son ton — juste plus net : aucune impression d'un texte générique recraché, **pas un robot qui parle à sa place**, elle en plus claire.
6. Elle touche **Copier** (= commit), colle dans son client mail, envoie, revient et **marque Envoyé** → le message se **fige read-only** dans la timeline de Sofiane, avec un bouton **Modifier** discret pour le rouvrir ; une relance se programme.

*Échec :* si Améliorer échoue (réseau/IA), **le champ garde le texte tapé à la main intact** — aucune saisie perdue ; Camille peut copier son brouillon tel quel ou réessayer.

## [Décisions tranchées — 2026-06-16]

Lacunes comportementales tranchées lors de la création des epics/stories (validées par Monsieur). Référence canonique testable : `epics.md` (UX-DR13..UX-DR24).

- **Gestion d'erreur réseau / IA → TRANCHÉ** (UX-DR14) : bandeau **inline** sous le champ (jamais modale ni toast), teinte douce désaturée + picto maison, microcopy warm ; Générer/Améliorer grisé. Jamais de rouge.
- **États de chargement → TRANCHÉ** (UX-DR15) : le **streaming token-par-token EST le chargement** ; avant le 1er token, plume-mascotte qui « écrit » (Reduce Motion respecté) ; pas de skeleton/spinner ; timeout doux 5 s.
- **Edge cases d'import CSV → TRANCHÉ** (UX-DR16) : carte-bilan non bloquante (« N ajoutés / fusionnés / à vérifier ») + file de revue 1-par-1 des doublons ambigus. **Lien Gmail RETIRÉ du MVP** (UX-DR9, tension Gmail résolue).
- **Confirmation de relance → TRANCHÉ** (UX-DR17) : variante de la carte courante du deck (pas d'interstitiel), Oui clôt / Non ouvre le composeur de relance, 1 tap.
- **Compteur zéro-fuite → TRANCHÉ** (UX-DR18) : cadrage positif (« Tout est repris, rien d'oublié »), chip mauve discret en cas de retard ; jamais de badge rouge.
- **Équivalent tap au feuilletage horizontal → TRANCHÉ** (UX-DR20) : flèches latérales ‹ › + pager tappable + flèches clavier.
- **Transparence API — emplacement → TRANCHÉ** (UX-DR21) : Réglages > Confidentialité + micro-ligne one-time à la 1re génération + lien depuis la pill de tokens ; pas dans le composeur.
- **Cycle de statut au-delà d'« envoyé » → TRANCHÉ** (UX-DR22) : tap sur la pastille de statut dans la timeline → mini-sheet (vu / répondu / ignoré) ; la confirmation deck reste le chemin principal.
- **État vide de premier lancement (réseau vide) → TRANCHÉ** (UX-DR23) : distinct du « deck terminé » — plume + CTA « Ajouter un premier contact », microcopy « Par qui on commence ? ».

**Reste à élicité (hors des 12 tranchées) :**
- **Notifications push détaillées** : regroupement de plusieurs relances dues, horaire/fréquence d'envoi, son/silencieux → non spécifiés. Cohérent avec le **build push différé au 1er user non-founder** (archi AR-14) ; à instruire à ce moment. (Refus de permission déjà cadré : State Patterns « Permission push refusée ».)

---

### Tensions repérées entre décisions

- **Scan Gmail dans l'onboarding → RÉSOLU** (UX-DR9, 2026-06-16) : le lien Gmail est **retiré du MVP** (scan Gmail = v1). Plus de tension.
- **« Mode sans-IA » résiduel → RÉSOLU** (#30 clos, 2026-06-16) : FR-15 supprimé du PRD, aligné sur l'UX (#18/#19). Tous les messages envoyés alimentent l'apprentissage, aucune exclusion.
- **« Stats » vs froideur** : l'onglet Stats reste différé en v1 ; le compteur zéro-fuite (UX-DR18) vit dans Aujourd'hui, cadrage positif. **Garde-fou maintenu** : ne pas faire fuir de logique analytics/Stats dans le MVP.
