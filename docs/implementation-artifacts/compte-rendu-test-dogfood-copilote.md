# Compte-rendu — test dogfood de l'application (copilote + composeur)

- **Date :** 2026-06-21
- **Testeur :** Doriann
- **Build testé :** worktree isolé `dogfood/manual-test` @ commit `7c10f02` (copilote 3-A landé)
- **Environnement :** serveur preview isolé sur `http://localhost:3001` (séparé du repo principal où un agent code la phase 3b — base Turso partagée)
- **Objectif :** valider l'usage réel du copilote et la qualité de la Voix du composeur (moat anti-robot), trouver les manques produit en utilisant l'app pour de vrai.

---

## Méthode

1. Lancer un build stable isolé (worktree séparé, port dédié) pour ne pas entrer en collision avec l'agent qui code en parallèle.
2. Utiliser le copilote avec de **vrais** contacts.
3. Générer des messages d'outreach et juger : « j'enverrais tel quel ? oui / non + pourquoi ».
4. Consigner chaque friction brute (le « pourquoi non » = matière à corriger le prompt).

---

## Findings

### F1 — BUG (RÉSOLU) : copilote indisponible (503) au 1er message

- **Symptôme :** chaque message au copilote renvoyait « Le copilote est momentanément indisponible. Réessaie dans un instant. »
- **Fausse piste écartée :** collision avec l'agent qui édite en parallèle — reproduit aussi dans le worktree **isolé**, donc pas la cause.
- **Cause racine :** la migration `0010` (tables `conversations` + `chat_messages`) n'avait **jamais été appliquée sur Turso**. Le code 3-A persiste le tour `user` *avant* le stream (`runAgentChat`) → `INSERT` dans une table inexistante → exception → la route renvoie 503 (message doux générique, non-`AgentConfigError`).
- **Preuve :** requête lecture-seule sur `sqlite_master` → `conversations` et `chat_messages` ABSENTES avant, EXISTENT après.
- **Fix appliqué :** `drizzle-kit migrate` (migration `0010`, `CREATE TABLE` + `CREATE INDEX` purement additifs, zéro destructif). Débloque aussi l'agent sur la phase 3b (base partagée).
- **Leçon process :** une migration générée et committée n'est pas une migration **appliquée**. Manque un garde-fou : appliquer/vérifier les migrations en attente au démarrage dev, ou un check CI « schéma DB == migrations ». → voir Suivi.

### F2 — FEATURE DEMANDÉE : tool « éditer un contact » pour le copilote  ⭐ PRIORITÉ HAUTE

- **Besoin :** le copilote peut aujourd'hui créer / importer / archiver des contacts et rédiger des brouillons, mais **pas modifier** un contact existant (changer entreprise, canal préféré, handles, notes, historique…).
- **Demande :** ajouter un write-tool d'**édition de contact**.
- **Confirmé live au dogfood (2026-06-21) — friction réelle « vraiment ennuyant » :** le copilote bute dessus en pleine conversation et le dit lui-même : « *je ne peux pas modifier une fiche existante avec un nouveau champ directement — mais je retiens que son LinkedIn est linkedin.com/in/amoussous* » → il propose un fallback manuel (lien vers la fiche). Le manque casse le flux et fait retomber l'utilisateur dans le manuel. Recoupe F8 (handles). À prioriser.
- **Contrainte clé :** **confirmation utilisateur obligatoire avant d'écrire** — comme l'archivage qui confirme déjà la cible (nom annoncé) avant d'agir. Jamais de modif silencieuse sur instruction ambiguë.
- **Pistes d'implémentation (à confirmer en spec) :**
  - nouveau tool `updateContact` dans `tools.server.ts`, ajouté à `WRITE_TOOL_NAMES` (déclenche `didWrite` → `router.refresh`).
  - journaliser l'op au `action_log` avec `prev_state` = champs avant modif → rend le **rewind** possible (parité `merged`/`reactivated`).
  - le copilote doit d'abord résoudre le contact via `queryContacts` (id réel, jamais inventé) puis annoncer NOM + champ(s) ciblé(s) avant d'écrire.

### F4 — MANQUE : le copilote ne peut pas dupliquer un contact

- **Besoin :** pouvoir demander au copilote de **dupliquer** un contact existant (repartir d'une fiche pour en créer une variante proche : même entreprise, handles à ajuster, etc.).
- **État actuel :** impossible — le copilote crée à partir de zéro (`createContact`) ou importe en bloc, mais ne sait pas copier une fiche existante.
- **Contrainte :** comme toute écriture, **confirmation utilisateur** avant de créer le doublon (annoncer la source + ce qui change).
- **Friction dédup à anticiper :** une duplication entre en tension directe avec l'unicité par tenant (`uq_contacts_user_dedup` sur `dedup_key` = email normalisé, sinon nom+entreprise). Dupliquer à l'identique violerait la contrainte / réactiverait la même ligne. Le tool doit donc soit forcer une `dedup_key` distincte (au moins un champ discriminant changé), soit expliquer pourquoi la copie pure est refusée. → à trancher en spec.
- **Lien F2 :** proche du tool d'édition — possible de mutualiser (un `updateContact` + un `duplicateContact` qui s'appuie sur la résolution `queryContacts` + journalisation `action_log` pour le rewind).

### F5 — MANQUE : impossible d'arrêter le copilote pendant qu'il travaille

- **Besoin :** un bouton **Stop** pour interrompre un tour en cours (génération / boucle tool-use longue) sans attendre la fin ni fermer la fenêtre.
- **État actuel :** une fois lancé, le tour va à son terme — pas d'annulation.
- **Pistes :** côté client, `AbortController` sur le `fetch` du stream (`stream-client.ts`) ; le `streamText` du SDK supporte un `abortSignal` (à propager depuis la route). Décider du sort de la persistance d'un tour interrompu (tour `user` déjà écrit avant le stream en phase 3 → soit marquer le tour annulé, soit ne pas persister l'`assistant` partiel).

### F6 — MANQUE : impossible de modifier un message déjà envoyé au copilote

- **Besoin :** rééditer un message `user` déjà envoyé dans le fil (corriger une faute / reformuler) et **relancer** le tour à partir de là.
- **État actuel :** un message envoyé est figé ; il faut en renvoyer un nouveau.
- **Friction phase 3 :** le contexte est désormais reconstruit côté serveur depuis le fil persisté. Éditer un tour passé implique de tronquer/réécrire la suite du fil (les tours postérieurs deviennent caducs) — pas un simple patch d'affichage. À cadrer en spec (réécriture vs nouveau fil-fork).

### F7 — BUG/MANQUE : le markdown n'est pas rendu dans l'historique de chat

- **Symptôme :** le markdown (liens, gras, listes) s'affiche **brut** dans l'historique du chat au lieu d'être rendu.
- **Indice :** `react-markdown` + `remark-gfm` sont déjà des dépendances → le rendu existe probablement pour le **stream live**, mais pas pour les tours **réhydratés** depuis la DB (régression introduite par la persistance phase 3, où l'historique rechargé n'emprunte pas le même chemin de rendu).
- **Impact direct dogfood :** les liens markdown vers les fiches (`[Voir la fiche](/reseau/<id>)` que le system prompt demande au copilote de produire) restent en texte brut sur l'historique → non cliquables après reload.
- **Fix probable :** faire passer les messages réhydratés (`CopiloteSheet` au 1er dépliage) par le même composant de rendu markdown que le stream live.

### F8 — MANQUE : le copilote ne peut pas ajouter de coordonnées à une fiche

- **Besoin :** dicter au copilote des coordonnées d'un contact existant — **numéro de téléphone, lien LinkedIn** (et e-mail, WhatsApp) — et qu'il les enregistre sur la fiche.
- **État actuel :** impossible. Le copilote crée/archive mais n'écrit pas dans les coordonnées d'une fiche existante.
- **Cible technique :** champ `handles` du contact (`{linkedin, email, phone, whatsapp}`, JSON — voir [schema.ts](plume/src/lib/db/schema.ts) `contacts.handles`). Le tool doit fusionner (ne pas écraser les autres canaux déjà remplis).
- **Lien F2 :** cas concret du tool d'édition `updateContact` — `handles` est précisément un des champs modifiables. À couvrir dans la même spec/tool. Confirmation utilisateur avant écriture + journalisation `action_log` pour le rewind (idem F2).

### F9 — BUG UI : pas de label de locuteur devant les messages du chat

- **Symptôme :** dans le chat copilote, **rien n'indique qui a envoyé quel message** — pas de nom/label devant chaque tour. À l'œil, on ne distingue pas l'utilisateur de l'assistant.
- **Cause :** purement d'AFFICHAGE (pas l'IA, pas la persistance). Le rendu des messages ([CopiloteSheet.tsx](plume/src/features/copilote/CopiloteSheet.tsx)) n'affiche pas de label de locuteur ni de distinction visuelle suffisante par rôle.
- **Fix :** afficher l'attribution par tour — label (« Moi » / « Copilote ») et/ou alignement + couleur distincts selon `role` (`user` vs `assistant`). La donnée `role` est déjà présente sur chaque tour (persistée en DB), il s'agit seulement de la rendre visible.

### F10 — MANQUE : ajouter Discord comme canal

- **Besoin :** **Discord** dans les canaux d'outreach (à côté de LinkedIn / E-mail / WhatsApp / SMS).
- **Cible technique :**
  - étendre l'union `Canal` (`@/lib/domain/enums`) avec `discord` ;
  - ajouter `discord?` au type `ContactHandles` (`{linkedin, email, phone, whatsapp, …}` dans [schema.ts](plume/src/lib/db/schema.ts)) ;
  - libellé FR dans `lib/copy.ts` ; exposer le canal dans l'UI (sélecteur canal préféré + saisie du handle) et au composeur.
- **Note :** colonne JSON `handles` → pas de migration pour le handle ; vérifier le canal `discord` partout où `Canal` est exhaustif (switch/validation) pour éviter un cas non géré.

### F11 — BUG : création en double d'un contact

- **Symptôme :** demande de créer UN nouveau contact → le copilote l'a créé **deux fois**, sans intention.
- **Anormal vu l'invariant :** un `uniqueIndex` `uq_contacts_user_dedup` (sur `userId` + `dedupKey`) est censé empêcher les doublons par tenant. Deux INSERT réussis ⇒ soit la contrainte n'a pas matché, soit le chemin de création ne passe pas par le dédoublonnage.
- **Causes candidates (à investiguer) :**
  1. **Double appel tool** — l'agent (LLM) a émis `createContact` deux fois dans le même run (boucle tool-use `MAX_STEPS`), produisant 2 lignes. Pas d'idempotence côté tool.
  2. **Clés de dédup divergentes** — les deux appels ont des données légèrement différentes (ex. `entreprise` nulle d'un côté, renseignée de l'autre) → `dedupKey` différentes → pas de collision, 2 lignes.
  3. **`createContact` ne réactive pas** sur clé existante (le contrat attendu : re-créer à la même `dedup_key` doit RÉACTIVER/fusionner, pas dupliquer).
- **À durcir :** idempotence de la création copilote — soit le tool dédoublonne avant insert (résoudre via la `dedupKey`, réactiver si existant), soit la boucle empêche un second `createContact` identique dans le même tour. Voir `tools.server.ts` (`createContact`) + le repository contacts (calcul `dedupKey` / upsert).

### F12 — UI : deux boutons « Générer » redondants dans la barre du composeur

- **Symptôme :** dans la barre d'actions du composeur, **deux** affordances de génération coexistent — l'icône étincelle (✦) tout à gauche ET le bouton rose « ✦ Générer » à droite. Prête à confusion (« lequel je clique ? »).
- **Barre observée (gauche→droite) :** ✦ (étincelle) · ⧉ (copier) · ✓ (valider) · **[ ✦ Générer ]** (rose).
- **Confirmé au test :** les deux boutons déclenchent **exactement la même action** — doublon pur, aucune différence de comportement.
- **Fix :** retirer l'icône étincelle de gauche, garder le seul bouton rose « ✦ Générer ». Vérifier qu'aucun handler/état n'est uniquement câblé sur l'icône supprimée.

### F13 — MANQUE : pas de palier Sonnet dans le registre du composeur

- **Symptôme :** le registre (sélecteur de modèle) du composeur n'offre que **2 paliers** — « rapide » (Haiku) et « soigné » (Opus). Manque l'intermédiaire.
- **Besoin :** un **3ᵉ palier Sonnet**, entre les deux (équilibre coût/qualité).
- **Repères de prix /1M tokens :** Haiku $1/$5 · **Sonnet $3/$15** · Opus $5/$25 — Sonnet = milieu naturel (3× moins cher qu'Opus, nettement meilleur que Haiku pour le ton).
- **Cible technique :** ajouter le palier dans le mapping registre→modèle du composeur (`claude.server.ts` / config du composer), libellé FR (ex. « équilibré »), exposer dans le sélecteur UI.
- **DÉCISION (Doriann) :** ajouter Sonnet comme 3ᵉ palier mais **garder Haiku « rapide » comme défaut** (pas Sonnet par défaut). NB : le sélecteur de modèle migrera vers le copilote selon la décision d'archi (voir Piste produit majeure).

### F14 — UX : la dernière conversation se relance toute seule au refresh

- **Symptôme :** au rechargement de la page, le copilote **reprend automatiquement le dernier fil actif**. Doriann n'aime pas — comportement intrusif.
- **Origine :** feature délibérée de la Phase 3 (CAP-2 « reprise du dernier fil actif » / réhydratation au 1er dépliage) — [bootstrap.actions.ts](plume/src/features/copilote/bootstrap.actions.ts) + [CopiloteSheet.tsx](plume/src/features/copilote/CopiloteSheet.tsx). Techniquement ça marche ; c'est le **choix UX** qui est remis en cause.
- **DÉCISION (Doriann) :** au refresh, le copilote démarre **fermé / vide** — aucun fil rouvert d'office. L'ancien fil reste accessible via la liste d'historique (multi-fils 3-B) si l'utilisateur le rouvre explicitement. Donc : couper la réhydratation auto au boot/1er dépliage, ne réhydrater un fil que sur sélection explicite dans l'historique.
- **NB :** la persistance elle-même (le fil reste sauvé en DB) n'est PAS en cause — seulement le déclenchement automatique de sa reprise à l'ouverture/refresh.

### F3 — Dogfood composeur (Voix anti-robot) — *à remplir pendant le test*

| # | Contact (réel) | Intention | Verdict (envoyer ?) | Pourquoi non / friction |
|---|----------------|-----------|---------------------|--------------------------|
| 1 | Discord — ancien élève de l'école, bosse chez Programisto (entreprise associée), même âge, pas proches mais entretien passé ensemble il y a qqs mois | Demander s'il a des contacts dans le milieu pour une alternance | **Non** | Ouverture présume l'OUBLI (« j'sais pas si tu te souviens de moi ») alors que contact récent (entretien il y a qqs mois) → froid, pas fluide. Bonus : « on s'était croisés » **minimise** l'interaction (c'était un entretien, pas un croisement). |
| 2 | Floribert — contact existant (relation déjà établie) | Demander s'il y a une place d'alternant dans sa boîte, ou au moins un nom pour décrocher un entretien | **Plutôt oui** (« j'aime bien ») | RAS sur le fond/ton. Ouverture juste (« je me permets de revenir vers toi pour autre chose » → suppose une relation existante, pas d'oubli présumé — contraste net avec le tour 1). Seul manque : l'IA devrait poser des questions de clarification → déjà couvert par le PIVOT. |
| 3 |  |  |  |  |
| 4 |  |  |  |  |
| 5 |  |  |  |  |

> Chaque « pourquoi non » = un fix de prompt précis. Exemples de motifs à guetter : trop formel, effet copié-collé, ne dit pas *pourquoi ce contact en particulier*, longueur, ton générique.

#### Pistes de correction du prompt composeur (tirées des verdicts)

- **P1 — Calibrer la familiarité sur la RÉCENCE, pas seulement sur la proximité (ex. tour 1).** Le composeur a traduit « pas spécialement proches » en « il m'a probablement oublié » et a ouvert sur « tu te souviens de moi ? ». Or un événement partagé concret et récent (un entretien il y a quelques mois) implique que l'autre se souvient. Règle à injecter : *quand il existe un point de contact concret et récent, NE PAS présumer l'oubli ; référencer l'événement en supposant que l'autre s'en souvient (« suite à notre entretien Programisto… »), pas en s'excusant d'exister.*
- **P2 — Ne pas minimiser l'interaction passée.** « on s'était croisés » sous-vend un entretien. Le composeur doit nommer l'interaction réelle au bon niveau (un entretien = un entretien), à partir des faits fournis, sans la diluer en rencontre anodine.
- **Principe transverse :** la distance sociale (proches / pas proches) et la mémoire (se souvient / a oublié) sont **deux axes distincts** — « pas proches » n'implique pas « m'a oublié ». Le prompt doit les traiter séparément.

---

## Piste produit majeure — composeur conversationnel (adaptatif)

**Origine :** émergée du tour 1 (F3). La génération one-shot a échoué parce qu'elle a **deviné** la relation (présumé l'oubli). Une étape de questions de clarification aurait sorti le bon contexte (« vous vous connaissez comment ? c'est récent ? ») → bug évité.

**Idée (Doriann) :** passer du bouton « Générer » one-shot à une **discussion avec l'IA** :
- **à la création d'un contact** — l'IA pose des questions sur la personne (comment tu le connais, dernière interaction, ton) ;
- **à la rédaction** — tu donnes une idée, l'IA pose des questions sur l'idée avant de rédiger.

**Reco (à valider) — rendre la conversation ADAPTATIVE, pas systématique :**
- La valeur du produit = outreach **rapide / anti-friction**. Un interrogatoire à chaque message tue la vitesse → piège classique du pivot conversationnel.
- Modèle « **générer-ou-demander** » : l'IA génère direct quand le contexte suffit ; elle pose **1-2 questions ciblées uniquement** quand un élément clé manque/est ambigu (relation ? récence ? objectif ?).
- **Création de contact** = le bon moment pour capter le contexte relationnel **une fois** (alimente le champ `historique`/contexte au lieu d'un textarea brut) → réutilisé pour CHAQUE message futur. C'est exactement ce qui manquait au tour 1.

**Leviers déjà en place :** le **copilote** existe déjà (chat conversationnel, tools `composeMessage`/`createContact`, persistance Phase 3). Le pivot ≈ router la rédaction à travers un flux conversationnel, pas une nouvelle infra.

**DÉCISIONS VERROUILLÉES (Doriann, 2026-06-21) :**
- **Choix utilisateur IA / manuel :** l'utilisateur décide, message par message, s'il veut l'IA ou pas. Pas d'imposition.
- **Si IA → FULL conversationnel** (et non adaptatif) : l'IA pose **toujours** des questions avant de rédiger, et **à la création d'un contact**. Angle assumé : la qualité/personnalisation prime sur la vitesse quand l'utilisateur a choisi l'IA.
- **Frontière des surfaces :** **le copilote gère TOUTE la partie IA** ; **l'application gère TOUT le manuel** (écrire son message soi-même, sans IA). Conséquence : le composeur one-shot « Générer » disparaît comme concept — la rédaction assistée vit dans le copilote (conversationnel), la rédaction manuelle dans l'app.
- **Implications :** F12 (double bouton « Générer ») et le registre F13 appartiennent au composeur one-shot → à réévaluer une fois la rédaction IA déplacée dans le copilote (peut rendre F12 caduc ; le registre/sélecteur de modèle migre vers le copilote).

## Synthèse de session

**Verdict composeur :** la Voix marche **quand la relation est claire** (tour 2, « j'aime bien »). Elle déraille **quand l'IA doit deviner la relation** (tour 1 : a présumé l'oubli sur un contact récent). C'est le constat central qui motive le pivot : ne pas laisser l'IA deviner → lui faire **poser les questions**.

**Bug résolu en séance :** F1 (migration 0010 non appliquée → 503 copilote).

**Priorités (ordre proposé) :**
1. **F11** — bug double-création de contact (viole un invariant ; à root-causer).
2. **F2 / F8** — tool `updateContact` (+ handles) : friction réelle confirmée live, casse le flux.
3. **PIVOT** — composeur full conversationnel ; copilote = IA, app = manuel (refonte structurante, à spécifier).
4. **F14** — refresh : copilote fermé/vide (UX, petit).
5. **Quick wins** — F12 (bouton dupliqué), F9 (label locuteur), F13 (palier Sonnet), F10 (canal Discord).
6. **Prompt composeur** — P1 (récence ≠ oubli) / P2 (ne pas minimiser) : utile même si le pivot arrive, car le pivot réutilise la génération.

**Décisions verrouillées cette séance :** pivot full conversationnel · copilote=IA / app=manuel · F13 Haiku reste défaut · F14 refresh fermé/vide. (Aussi en mémoire : `copilote-pivot-conversationnel`.)

## Suivi / actions

- [ ] **F1 (process)** : ajouter un garde-fou migrations (apply/check au boot dev OU check CI schéma↔migrations) pour éviter qu'un schéma DB diverge des migrations committées.
- [ ] **F2** : reporter la feature « tool `updateContact` (avec confirmation + rewind via action_log) » dans `docs/implementation-artifacts/deferred-work.md` une fois l'agent libéré du fichier (ne pas l'éditer pendant qu'il y travaille).
- [ ] **F3** : compléter le tableau composeur, puis itérer sur le prompt du composeur à partir des « pourquoi non ».
- [ ] **F4** : spec + tool `duplicateContact` (avec confirmation, gestion de la `dedup_key`, rewind via action_log) — à mutualiser avec F2 (`updateContact`).
- [ ] **F5** : bouton Stop — `AbortController` côté client + `abortSignal` propagé à `streamText` ; décider du sort de la persistance d'un tour interrompu.
- [ ] **F6** : édition d'un message `user` passé + relance (réécriture du fil aval vs fork) — à cadrer en spec.
- [ ] **F7** : rendre le markdown des tours réhydratés (même composant de rendu que le stream live) — débloque les liens fiches cliquables après reload.
- [ ] **F8** : édition du champ `handles` (téléphone, LinkedIn, e-mail, WhatsApp) via le tool `updateContact` (F2), avec fusion non-destructive des canaux existants.
- [ ] **F9** : afficher le locuteur dans le chat copilote (label « Moi »/« Copilote » + style distinct par `role`) — donnée `role` déjà dispo, c'est du rendu UI ([CopiloteSheet.tsx](plume/src/features/copilote/CopiloteSheet.tsx)).
- [ ] **F10** : ajouter le canal `discord` — union `Canal` + `ContactHandles.discord` + libellé `copy.ts` + UI + composeur ; auditer les `switch`/validations exhaustifs sur `Canal`.
- [ ] **F11** : durcir l'idempotence de `createContact` (dédoublonner via `dedupKey` / réactiver si existant ; éviter le double appel dans un même tour). Investiguer `tools.server.ts` + repository contacts.
- [ ] **F12** : retirer l'icône étincelle redondante du composeur (doublon pur confirmé du bouton rose « Générer »).
- [ ] **F13** : ajouter le palier Sonnet (« équilibré ») au registre du composeur (mapping `claude.server.ts` + libellé + UI) ; candidat défaut.
- [ ] **F14** : au refresh, copilote **fermé/vide** — couper la réhydratation auto (CAP-2) ; reprise d'un fil seulement sur sélection explicite dans l'historique.
- [ ] **PIVOT** : composeur conversationnel **full** (l'IA pose toujours des questions) quand l'utilisateur choisit l'IA ; copilote = toute l'IA, app = tout le manuel. Voir « Piste produit majeure ».
