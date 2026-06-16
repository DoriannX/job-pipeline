---
title: "Revue edge-cases — PRD Plume (job-pipeline)"
status: draft
created: 2026-06-15
method: "Parcours de chaque FR (FR-1..FR-34) et de chaque UJ (UJ-1..UJ-3). Liste UNIQUEMENT les conditions limites et chemins d'échec NON traités par le PRD ni l'addendum. Factuel, orthogonal à la revue adversariale (pas d'avis stratégie)."
---

# Revue edge-cases — Plume

Une ligne par edge case non traité. Colonnes : ID · FR/UJ concerné · description du bord non traité · gravité (Bloquant / Élevé / Moyen / Faible).

Gravité = impact sur la boucle MVP si non spécifié : **Bloquant** = casse un parcours clé ou corrompt des données ; **Élevé** = comportement indéfini sur un chemin fréquent ; **Moyen** = chemin moins fréquent ou dégradation gérable ; **Faible** = cosmétique / rare.

---

## 4.1 Import et gestion des Contacts

### FR-1 — Import CSV LinkedIn

| ID | FR | Edge case non traité | Gravité |
|---|---|---|---|
| EC-1 | FR-1 | **Critère d'identité pour la dédup non défini.** FR-1 et FR-34 disent "même identité = fusion", mais l'identité n'est jamais spécifiée (nom seul ? nom+entreprise ? email ?). Or FR-2 permet un Contact avec "au minimum un nom", et l'export LinkedIn rédige souvent l'email. Sans clé d'identité, la dédup est indéfinie. | Bloquant |
| EC-2 | FR-1 | **CSV LinkedIn sans email** (LinkedIn masque/rédige fréquemment l'email export). Si l'email est la clé d'identité, ces lignes ne peuvent pas dédupliquer ; si le nom est la clé, deux homonymes fusionnent à tort. Comportement non spécifié. | Élevé |
| EC-3 | FR-1 | **Homonymes** (deux "Jean Martin" distincts dans le réseau). Une dédup par nom les fusionne et écrase des données. Non traité. | Élevé |
| EC-4 | FR-1 | **Encodage du CSV** (UTF-8 vs Latin-1, BOM, accents/caractères non-ASCII des noms). L'export LinkedIn et Excel produisent des encodages variables ; aucune mention. | Moyen |
| EC-5 | FR-1 | **Conflit de données à la fusion** : un Contact manuel a un Canal de prédilection / notes ; le CSV apporte d'autres valeurs. Qui gagne ? Merge, écrasement, ou conservation ? Non spécifié. | Élevé |
| EC-6 | FR-1 | **Définition de "ligne malformée"** : colonnes manquantes, ligne entièrement vide, en-têtes absents/renommés, séparateur `;` vs `,` (export FR), guillemets/virgules dans un champ. "Ignorée sans bloquer" ne dit pas ce qui qualifie. | Moyen |
| EC-7 | FR-1 | **Fichier non-CSV ou mauvais format** (utilisateur upload un PDF, un XLSX, un CSV non-LinkedIn, un fichier vide). Comportement et message non spécifiés. | Moyen |
| EC-8 | FR-1 | **Très gros CSV** (export complet = plusieurs milliers de lignes). Le "backfill async" implique un job long : timeout, taille max, feedback de progression, échec à mi-parcours ? Non traité. | Moyen |
| EC-9 | FR-1 | **Deux imports CSV successifs / réimport du même fichier.** Idempotence non spécifiée (re-fusion propre vs création de doublons). | Élevé |
| EC-10 | FR-1 | **Une ligne CSV met à jour un Contact qui a déjà une timeline de Messages.** "Crée ou met à jour" — la mise à jour préserve-t-elle la timeline (cf. FR-2 le garantit pour l'édition manuelle, mais pas pour l'import) ? Non traité. | Moyen |
| EC-11 | FR-1 | **Import lancé alors qu'un import précédent tourne encore** (double upload). Concurrence non traitée. | Moyen |

### FR-2 / FR-34 — Ajout manuel et rapide

| ID | FR | Edge case non traité | Gravité |
|---|---|---|---|
| EC-12 | FR-2 | **Création de deux Contacts manuels identiques** (même nom saisi deux fois). FR-34 déduplique "contre l'existant", mais FR-2 ne dit rien d'un doublon manuel↔manuel. | Moyen |
| EC-13 | FR-2 | **Nom vide ou seulement des espaces** au minimum requis. Validation non spécifiée. | Faible |
| EC-14 | FR-34 | **Lignes collées ambiguës** : ligne vide, ligne avec plusieurs virgules ("Nom, Entreprise, Ville"), doublons internes au coller (même nom deux fois dans la liste collée), une seule longue ligne sans retour. Best-effort mentionné mais bords non décrits. | Moyen |
| EC-15 | FR-34 | **Très grand coller** (500 lignes d'un coup) : limite, feedback, partiel. Non traité. | Faible |
| EC-16 | FR-34 | **Compte-rendu de l'ajout rapide** (N créés / N fusionnés / N ignorés) non prévu, alors qu'il l'est pour le CSV (FR-1). Incohérence : l'utilisateur ne sait pas ce qui a fusionné. | Moyen |

### FR-3 / FR-4 / FR-5 — Fiche, Froideur, Liste

| ID | FR | Edge case non traité | Gravité |
|---|---|---|---|
| EC-17 | FR-4 | **Contact sans aucun Message** (jamais contacté, juste importé). Le Score de froideur est "fonction de la récence du dernier Message" — sans Message, le score est indéfini. Or c'est le cas majoritaire après un import CSV. Faut-il un état "jamais contacté" distinct de "froid" ? Non traité. | Élevé |
| EC-18 | FR-4 | **Date du dernier échange dans le futur ou incohérente** (import avec date erronée, message daté à la main). Effet sur le score non borné. | Faible |
| EC-19 | FR-5 | **Liste Réseau vide** (avant tout ajout/import). Que voit l'utilisateur sur l'onglet Réseau ? État vide non décrit (parallèle de la File vide, infra). | Moyen |
| EC-20 | FR-5 | **Tri/filtre quand tous les Contacts ont le même score** ou aucun Message (ordre stable indéfini). Faible mais non spécifié. | Faible |
| EC-21 | FR-3 | **Suppression d'un Contact** : aucun FR ne décrit la suppression d'un Contact individuel (FR-31 couvre la suppression globale du compte). Que deviennent ses Messages, ses Relances, ses voice_samples ? Non traité. | Élevé |

---

## 4.2 Composeur "ta voix"

| ID | FR | Edge case non traité | Gravité |
|---|---|---|---|
| EC-22 | FR-7 | **L'appel API échoue / API Claude down / timeout / 5xx.** Aucun comportement d'erreur ni de retry défini pour Générer. Chemin d'échec central du moat non traité. | Bloquant |
| EC-23 | FR-7/14 | **Quota / rate-limit / 429 de l'API Anthropic atteint** (même en mono-utilisateur : pics, Opus). FR-14 dit "pas de plafonnement avant SaaS" côté produit, mais le rate-limit fournisseur existe. Dégradation non spécifiée. | Élevé |
| EC-24 | FR-7 | **Hors-ligne / perte réseau pendant la génération** (PWA mobile dans le métro, cf. UJ-1). Pas de connexion = pas d'API. Comportement offline du Composeur non décrit. | Bloquant |
| EC-25 | FR-7 | **Idée brute vide** : l'utilisateur touche Générer sans rien taper. Génère quoi ? Bloqué ? Non spécifié. | Moyen |
| EC-26 | FR-15 | **Contact basculé en Mode sans-IA pendant l'édition** (scénario explicitement listé par le demandeur) : une génération est en vol ou un texte généré est déjà dans le champ quand le Mode sans-IA est activé. Annule-t-on l'appel ? Garde-t-on le texte déjà généré ? Non traité. | Élevé |
| EC-27 | FR-8 | **"Améliorer" sur un champ vide** ou sur un texte d'un seul mot. Rien à améliorer ; comportement non défini. | Moyen |
| EC-28 | FR-8 | **"Améliorer" appelé en boucle** (l'utilisateur clique 5 fois) : dérive du texte, accumulation, idempotence. Non traité. | Faible |
| EC-29 | FR-7/8 | **Double-clic / clics rapides sur Générer** pendant qu'un appel est déjà en cours (requêtes concurrentes, ordre des réponses). Pas de mention d'état "en cours" / désactivation. | Moyen |
| EC-30 | FR-11 | **La sortie API contient malgré tout un Tell** (tiret cadratin, formule ampoulée) — la Liste noire échoue à le filtrer. FR-11 dit "absentes ou signalées" : que se passe-t-il quand un Tell passe (re-génération auto ? avertissement bloquant ? laissé tel quel) ? Non tranché. | Élevé |
| EC-31 | FR-11 | **L'utilisateur tape lui-même un Tell** (un tiret cadratin dans son texte) puis envoie sans IA. La Liste noire s'applique-t-elle au texte non généré (FR-6) ? Non traité — risque de faux positif anti-robot. | Moyen |
| EC-32 | FR-9 | **Aucun Canal sélectionné** sur le Contact (FR-2 rend le Canal optionnel : "Canal de prédilection"). La génération canal-aware n'a pas de canal. Défaut non spécifié. | Élevé |
| EC-33 | FR-7 | **Réponse API tronquée / vide / non textuelle / dépassant la longueur attendue.** Gestion de sortie dégénérée non décrite. | Moyen |
| EC-34 | FR-10 | **Few-shot avec corpus très volumineux** (utilisateur prolifique) : sélection des N exemples, dépassement de la fenêtre de contexte, coût. FR-17 dit "N récents/édités" mais N et le plafond de tokens ne sont pas fixés ; débordement non traité. | Moyen |
| EC-35 | FR-12 | **Copier sans jamais marquer Envoyé** : l'utilisateur copie, colle ailleurs, ne revient pas. Le Message reste brouillon → pas de Relance auto (FR-25 part de "Envoyé"). Fuite silencieuse possible. Non traité. | Élevé |
| EC-36 | FR-13 | **Quitter le Composeur avec du texte non sauvegardé** (back, switch d'app, kill PWA). Brouillon perdu ou persisté ? Non spécifié. | Élevé |

---

## 4.3 Apprentissage de la Voix

| ID | FR | Edge case non traité | Gravité |
|---|---|---|---|
| EC-37 | FR-16 | **Seed de voix dans une autre langue / très court / vide collé / énorme.** "Pas de multilingue au MVP" (§5) mais le Seed peut être non-français ; effet non décrit. | Faible |
| EC-38 | FR-17 | **Message envoyé en Mode sans-IA** : alimente-t-il le corpus de Voix ? C'est du texte 100% humain (idéal pour la Voix) mais jamais passé à l'API. Inclusion/exclusion non tranchée. | Moyen |
| EC-39 | FR-17 | **Message envoyé puis le texte est modifié (FR-20 Modifier) ou le Contact supprimé.** Le voice_sample déjà versé est-il mis à jour / retiré du corpus ? Cohérence corpus↔Message non traitée. | Moyen |
| EC-40 | FR-17 | **Message généré accepté sans aucune édition.** FR-17 alimente le corpus avec les "édités et envoyés" — un message non édité (généré tel quel) pollue-t-il la Voix avec du texte IA ? Critère d'inclusion ambigu. | Moyen |

---

## 4.4 Messages et Statut

| ID | FR | Edge case non traité | Gravité |
|---|---|---|---|
| EC-41 | FR-19/25 | **Message marqué Envoyé, puis "répondu" reçu : la Relance auto se désactive-t-elle ?** (scénario explicitement listé). FR-25 crée une Relance "sans réponse" ; FR-19 passe le Statut à répondu manuellement. Le lien entre transition de Statut et annulation/déclenchement de la Relance n'est pas spécifié. | Bloquant |
| EC-42 | FR-25 | **Plusieurs Messages envoyés au même Contact : quelle Relance ?** (scénario explicitement listé). Une Relance par Message ou une par Contact ? Deux Messages "sans réponse" génèrent-ils deux Relances dues ? Dédup des Relances par Contact non traitée. | Élevé |
| EC-43 | FR-19 | **Transitions de Statut hors séquence / régressives** : marquer "vu" puis revenir à "envoyé", marquer "ignoré" puis "répondu", "répondu" → de nouveau "envoyé". Le cycle est listé en avant ; les retours arrière et leurs effets (sur la Relance, le compteur) non définis. | Moyen |
| EC-44 | FR-20 | **Modifier un Message déjà Envoyé** (FR-20) : le texte modifié re-déclenche-t-il quelque chose (voice_sample, date, Relance) ? Modifier = nouveau Message ou édition en place ? Effet de bord non décrit. | Moyen |
| EC-45 | FR-18 | **Message sans Canal** enregistré (Canal optionnel). FR-18 stocke un Canal ; valeur si absent ? Non spécifié. | Faible |
| EC-46 | FR-19 | **Suppression d'un Message individuel** : aucun FR ne la prévoit (typo, mauvais Contact). Annulation d'un "Envoyé" par erreur non traitée. | Moyen |

---

## 4.5 File du jour

| ID | FR | Edge case non traité | Gravité |
|---|---|---|---|
| EC-47 | FR-22/23 | **File du jour vide** (aucun nouveau Contact, aucune Relance due) — scénario explicitement listé. Que voit l'utilisateur ? État vide / message d'encouragement / compteur zéro-fuite à zéro non décrit. C'est l'écran par défaut au lancement : un nouvel utilisateur arrive forcément sur une file vide. | Élevé |
| EC-48 | FR-23 | **File très longue** (gros backfill CSV → des dizaines de "nouveaux Contacts à joindre"). Plafond quotidien, pagination, sentiment de noyade vs principe "5 min". §6.1 et SM-C3 (anti-spray) impliquent un plafond, mais FR-23 n'en pose aucun. | Moyen |
| EC-49 | FR-24 | **Snooze : durée et destination** (snoozé à quand ? réapparaît demain ? choix de date ?). "snooze" listé en assumption sans sémantique. | Moyen |
| EC-50 | FR-24 | **Skip : définitif ou récurrent ?** Skipper un nouveau Contact le retire-t-il de la file pour toujours, ou il revient ? Effet sur le compteur zéro-fuite non précisé. | Moyen |
| EC-51 | FR-23 | **Fuseau horaire / changement de jour** : "le jour de son échéance" et "File du jour" dépendent du fuseau. Voyage, minuit, device en UTC. Définition du "jour" non posée. | Moyen |
| EC-52 | FR-23 | **Relance due un jour non ouvert** (utilisateur n'ouvre pas l'app ce jour-là) : les Relances s'empilent-elles le lendemain ? Backlog cumulé non décrit (lien avec FR-27 "en retard"). | Moyen |

---

## 4.6 Relances zéro-fuite

| ID | FR | Edge case non traité | Gravité |
|---|---|---|---|
| EC-53 | FR-26 | **Utilisateur pas abonné au push** (a refusé la permission, ou jamais demandée). Scénario explicitement listé. FR-26 dit "utilisateur abonné" ; le chemin "non abonné" (la Relance est-elle quand même visible dans la file ? rappel alternatif ?) n'est pas traité. | Élevé |
| EC-54 | FR-26 | **iOS sans ajout à l'écran d'accueil** : l'assumption dit "l'app le signale", mais le comportement si l'utilisateur ne le fait pas (aucun push jamais reçu, fuite garantie de toutes les Relances) n'est pas couvert au-delà du "signalement". | Élevé |
| EC-55 | FR-26 | **Navigateur non supporté Web Push** (anciens, certains in-app browsers, desktop spécifiques). Scénario explicitement listé. Dégradation gracieuse non décrite. | Moyen |
| EC-56 | FR-26 | **Permission push révoquée après abonnement** (l'utilisateur la coupe dans les réglages OS). Détection et re-prompt non traités. | Moyen |
| EC-57 | FR-26 | **Push cliqué : deep-link** vers la bonne Relance / le bon Contact. UJ-3 décrit "la relance est déjà en haut de la file" mais le routage du clic notification n'est pas spécifié (app fermée, plusieurs relances). | Faible |
| EC-58 | FR-25 | **L'utilisateur ne traite jamais une Relance** : elle reste "en retard" indéfiniment. Le compteur zéro-fuite passe-t-il alors à >0 (contredisant "maintenu à zéro") ? Sémantique exacte du compteur quand une Relance pourrit non définie. | Élevé |
| EC-59 | FR-25 | **Notification répétée / fréquence** : une Relance en retard re-notifie-t-elle chaque jour ? Anti-harcèlement vs anti-fuite. Non spécifié. | Moyen |
| EC-60 | FR-27 | **Définition opérationnelle de "touche perdue"** : qu'est-ce qui incrémente le compteur ? Une Relance ignorée ? expirée ? Le "zéro-fuite" est une garantie produit centrale mais son déclencheur d'échec n'est pas défini. | Élevé |

---

## 4.7 PWA, Auth, Privacy

| ID | FR | Edge case non traité | Gravité |
|---|---|---|---|
| EC-61 | FR-31/7 | **Suppression des données pendant qu'une génération est en vol** (scénario explicitement listé). La requête API en cours référence des données supprimées ; ordre, annulation, état final non traités. | Élevé |
| EC-62 | FR-30/1 | **Export pendant un import** (CSV backfill async en cours) — scénario explicitement listé. Snapshot incohérent (export partiel d'un import en cours). Concurrence non traitée. | Moyen |
| EC-63 | FR-31 | **Suppression partielle vs totale + confirmation + irréversibilité.** FR-31 "supprime ses données" sans granularité ni garde-fou (confirmation, délai, undo). Risque de perte accidentelle de tout le corpus de Voix. | Élevé |
| EC-64 | FR-29 | **Échec / refus / expiration OAuth Google** : token expiré en pleine session, compte Google révoqué, refus de consentement. Re-auth et état des données non décrits. | Élevé |
| EC-65 | FR-29 | **Aucune session / session expirée au lancement** alors que l'app "ouvre directement sur Aujourd'hui" (UJ-1 suppose déjà connecté). Le chemin déconnecté → écran par défaut n'est pas spécifié. | Moyen |
| EC-66 | FR-28 | **PWA hors-ligne au lancement** : que fonctionne sans réseau (lecture de la file, Composeur sans-IA, marquage Envoyé) vs quoi échoue ? §8 PWA/service worker mais périmètre offline non défini. Important vu le persona "dans le métro". | Élevé |
| EC-67 | FR-28 | **Mises à jour PWA / cache service worker périmé** : nouvelle version vs données locales, invalidation. Non traité. | Faible |
| EC-68 | FR-30 | **Export volumineux / format des Relances et voice_samples** : FR-30 cite "Contacts et Messages" — les Relances et le corpus de Voix sont-ils exportés ? Portabilité réelle (RGPD) incomplète. | Moyen |
| EC-69 | FR-32 | **Transparence sur le contenu exact envoyé à l'API** : FR-32 mentionne "le contexte du Message", mais le Few-shot injecte aussi des Messages passés vers d'AUTRES Contacts (voice_samples). L'utilisateur sait-il que des messages adressés à un tiers partent dans le prompt d'un autre ? Implication privacy non explicitée. | Élevé |

---

## Onboarding et parcours transverses

| ID | FR/UJ | Edge case non traité | Gravité |
|---|---|---|---|
| EC-70 | FR-33/UJ-1 | **Tout premier lancement = file vide + corpus vide + zéro Contact.** UJ-1 démarre "déjà connectée, 3 contacts + 2 relances". Le J0 réel (rien) n'a pas de parcours décrit : génération sans Voix (FR-10 ton neutre, OK) mais file vide (EC-47) et "premier Message en <2 min" suppose des Contacts déjà saisis. Chaînage onboarding→première action sur état vierge non bouclé. | Moyen |
| EC-71 | UJ-1 | **Le contenu collé hors de l'app (LinkedIn) ne revient pas** : l'utilisateur copie, part dans LinkedIn, l'OS tue la PWA en arrière-plan ; au retour, état du Composeur/Message perdu ? (lié EC-36). Parcours "copie → app tierce → retour marquer Envoyé" fragile sur mobile, non traité. | Élevé |
| EC-72 | §5/FR-7 | **Idée brute ou Seed dans une langue non-française** alors que "pas de multilingue au MVP". Comportement de génération (force le français ? suit l'entrée ?) non défini. | Faible |
| EC-73 | FR-14 | **Bascule Haiku↔Opus en cours de génération** ou indisponibilité d'un des modèles côté API. Persistance + fallback non traités. | Faible |
| EC-74 | Global | **Concurrence multi-onglets / multi-devices** (PWA ouverte sur téléphone + desktop) : même utilisateur, éditions simultanées, état de la file divergent. "Mono-utilisateur" ≠ mono-session. Non traité. | Moyen |

---

## Synthèse

- **Total edge cases non traités : 74.**
- Par gravité : **Bloquant : 5** · **Élevé : 24** · **Moyen : 31** · **Faible : 14**.
- Concentrations : critère d'identité/dédup (FR-1), chemins d'échec API du Composeur (FR-7), couplage Statut↔Relance (FR-19/25), états vides (file, réseau, J0), et frontières privacy/offline.

### Top 5 (Bloquants)

1. **EC-1 (FR-1)** — Le critère d'identité de la dédup n'est jamais défini ; toute la promesse "fusion, pas duplication" repose dessus.
2. **EC-22 (FR-7)** — Aucun comportement d'erreur quand l'API Claude échoue/timeout ; c'est le chemin d'échec du moat.
3. **EC-24 (FR-7)** — Génération hors-ligne non traitée, alors que le persona cœur est "dans le métro".
4. **EC-41 (FR-19/25)** — Une réponse reçue ne désactive pas explicitement la Relance auto ; couplage Statut↔Relance non spécifié (risque de relancer un contact qui a répondu = anti-pattern produit).
5. **EC-47 (FR-22/23)** — File du jour vide non décrite, alors que c'est l'écran par défaut et l'état garanti du tout premier lancement.
