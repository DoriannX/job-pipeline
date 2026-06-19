---
stepsCompleted: [1, 2, 3, 4]
ideas_generated: 17
session_active: false
workflow_completed: true
inputDocuments: []
session_topic: 'Agent IA testeur intégré dans Plume — chat in-app (bas-droite), commandes en langage naturel (ex: "crée 10 contacts au hasard"), exécution directe dans l''app, intégration Claude (Sonnet)'
session_goals: 'Archi technique (comment Claude/Sonnet exécute des actions réelles dans Plume — tools/function-calling, sandbox données test, sécurité) + UX du chat (look, déclencheurs, feedback, confirmations)'
selected_approach: 'AI-Recommended Techniques'
techniques_used: ['First Principles Thinking', 'What If Scenarios', 'Role Playing', 'Reverse Brainstorming']
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Monsieur
**Date:** 2026-06-19

## Session Overview

**Topic:** Agent IA testeur intégré dans Plume — petit chat en bas à droite, commandes en langage naturel ("crée 10 personnes au hasard"), exécution directe, intégration Claude (Sonnet suffit).

**Goals:** Archi technique (Claude/Sonnet exécute actions réelles dans Plume — tools/function-calling, sandbox données test, sécurité) + UX du chat (look, déclencheurs, feedback, confirmations).

## Technique Selection

**Approach:** AI-Recommended Techniques (séquence 3 phases, ~25min)

- **Phase 1 — First Principles Thinking (deep):** décaper l'archi "LLM agit vraiment dans l'app" jusqu'aux fondamentaux.
- **Phase 2 — What If Scenarios + Role Playing (creative/collaborative):** explorer capacités de l'agent + UX chat vue par 3 rôles (testeur, dev, agent).
- **Phase 3 — Reverse Brainstorming / Pre-mortem (creative/wild):** durcir sécu/sandbox, frontière données test vs prod.

---

## Idea Generation

### Phase 1 — First Principles Thinking (archi)

**Stack confirmée:** Next.js 16 (App Router), `@anthropic-ai/sdk` déjà installé, Drizzle ORM + libsql (SQLite/Turso), next-auth, zod, dexie.

**[Archi #1] Wrapper test fin sur muscle métier (i+ii)**
_Concept_: la couche d'actions test (ii) n'implémente aucune logique BDD — elle orchestre les vraies fonctions métier (i). Ex: `seedContacts(10)` boucle 10× sur le vrai `createContact()`, injecte des données fakées (faker) + flag `isTestData`. Claude n'appelle que la couche ii.
_Novelty_: l'agent teste le vrai chemin de code tout en restant trivialement nettoyable et impossible à confondre avec de la vraie donnée.

**[Archi #2] Catalogue fermé + escape hatch générique gradué**
_Concept_: 90% des besoins = actions nommées sûres (`seedContacts`, `simulateOutreach`, `resetTestData`…). Quand Claude bute, il dégaine `runGeneric` (query read-only / script sandbox) avec un cran de sécu supérieur : confirmation explicite, read-only par défaut, scope test-DB only.
_Novelty_: pas 200 actions à coder, mais pas d'improvisation libre non plus. Tout le risque concentré dans UNE porte surveillée. (→ point clé pour Phase 3 sécu.)

**[Archi #3] Boucle tool-use dans une route API Next (cerveau serveur)**
_Concept_: `POST /api/agent/chat`. Le serveur tient la boucle Anthropic tool-use : message user → Claude + catalogue tools → `tool_use` → serveur exécute la vraie fonction Drizzle → `tool_result` → boucle → stream texte au chat. Clé API jamais exposée au navigateur.
_Novelty_: une seule route porte toute la dangerosité, protégée par next-auth ; le front reste bête (afficher le stream).
_Décision sécu_: cerveau côté serveur = non négociable (clé API ne doit jamais atteindre le client).

### Phase 2 — What If Scenarios + Role Playing (capacités + UX + identité produit)

**Pivot majeur de la session :** le concept a glissé de « outil de test jetable » → « copilote, feature phare du produit ». Contrôle d'UI envisagé puis abandonné (jugé inutile → archi 100% serveur conservée).

**[Capacité #1] Catalogue = miroir des actions utilisateur**
_Concept_: règle de complétude = « si un humain peut le faire via l'UI, l'agent a un tool pour ça ». On expose les server actions / endpoints existants comme tools. « Tout faisable » devient une cible finie et auditable (couverture = nb d'actions UI mappées en tools).
_Novelty_: transforme « il peut tout faire » (flou, infini) en cible mesurable ; on sait exactement ce qui manque.

**[UX #1] Icône flottante → popup smooth**
_Concept_: petite icône (logo Claude ou Plume) bas-droite. Clic → ouverture fluide d'un popup chat. PC = popup compact ancré. Mobile = grand panneau quasi-plein-écran, bordures légèrement détachées (pas fullscreen brut).
_Novelty_: présent partout, jamais intrusif ; une icône = un compagnon.

**[Capacité #3] Agent advisor-puis-doer (pas juste seeder)**
_Concept_: le même chat enchaîne conseil pur (zéro action) → parsing texte-libre en vrac → exécution réelle (`createContact` + composeur IA). La frontière « test » se brouille : c'est aussi un vrai assistant de prod ; le seeding aléatoire devient un mode parmi d'autres.
_Novelty_: l'outil de test EST l'assistant produit — on dogfoode l'assistant en testant l'app.

**[Capacité #4] Import vrac texte-libre → contacts + messages**
_Concept_: coller « Sophie Martin, CTO chez Acme, vue à la conf X » ×20 → l'agent parse → structure → appelle le vrai `createContact` + le composeur IA (1 message/personne). Données réelles.
_Novelty_: zéro formulaire ; le chat devient le chemin d'entrée le plus rapide de toute l'app.

**[Capacité #5] Accès web (recherche) + comptes connectés (OAuth)**
_Concept_: l'agent sort de Plume. Web search/fetch pour rechercher une boîte/personne avant d'écrire ; comptes connectés (LinkedIn, email…) via OAuth pour naviguer les sources de l'user. Nouveaux tools dans le même catalogue.
_Novelty_: passe de « remplit ta BDD » à « va chercher la matière première dehors et la transforme en contacts+messages ».
_⚠ Poids sécu (Phase 3)_: web = injection de contenu non fiable ; OAuth = tokens sensibles + actions au nom de l'user.

**[Stratégie #1] Un moteur, deux niveaux de confiance (test = v0 du copilote produit)**
_Concept_: boucle tool-use + catalogue d'actions = fondation unique. « Mode test » vs « copilote SaaS » ne diffèrent que par : source données (fake vs réel), périmètre users (toi vs multi), accès externe (off vs web+comptes). Codé une fois.
_Novelty_: dissout le faux dilemme « outil interne OU feature produit » — même artefact, crans de confiance différents. Cheval de Troie de la feature phare. Colle à la roadmap perso→SaaS.

**[Stratégie #2] Positionnement — spécialiste prospection, contrôle total Plume**
_Concept_: personnalité/expertise centrée outreach-réseau (conseil prospection, messages anti-robot), MAIS catalogue de tools couvrant 100% des actions Plume. Spécialisé en ton, généraliste en capacités.
_Novelty_: identité produit nette (« ton coach de prospection ») sans amputer les capacités.

**[Stratégie #3] Copilote ≠ cannibale de l'UI (même couche d'actions, 2 interfaces)**
_Concept_: aucune feature rendue inutile tant que UI et chat tapent la même couche d'actions (« 1 action, 2 surfaces »). UI = précision/visuel/confiance/découverte ; chat = vitesse/vrac/intention floue. Bonus : les flows où on préfère le chat = signal d'une UI à refaire.
_Novelty_: transforme la peur « le copilote tue mes écrans » en outil de diagnostic UX, et empêche le double-code.

**[Archi #4] Couche provider-agnostique via Vercel AI SDK (gratuit en dev, Sonnet en prod)**
_Concept_: tools définis une fois, derrière le **Vercel AI SDK** (tool-calling unifié Anthropic / Google / Groq / Ollama). Dev/test = LLM gratuit (Gemini Flash free, ou Groq Llama 3.3 70B), prod = Claude Sonnet ; swap = une ligne / env var.
_Novelty_: test à coût zéro sans réécrire l'archi.
_Piège_: les modèles gratuits appellent les tools moins bien que Sonnet → en dev on teste la plomberie (la boucle marche ?), pas la qualité de raisonnement (ça → Sonnet).
_Décision_: Vercel AI SDK validé. À trancher au moment de coder : remplacer `@anthropic-ai/sdk` par l'AI SDK multi-provider, ou garder Anthropic SDK + swap manuel.

### Phase 3 — Reverse Brainstorming / Pre-mortem (durcissement sécu)

Méthode : on a cherché comment le copilote casse les choses ; chaque catastrophe → un garde-fou.

**[Sécu #1] Rewind transactionnel (à la Claude) — annule la conv ET ses effets**
_Scénario neutralisé_: massacre de données (`deleteContacts` en masse).
_Concept_: chaque tour d'agent = checkpoint ; mutations BDD journalisées et groupées par tour. Rewind la conversation = undo exact des mutations depuis ce point (combiné au soft-delete : rien n'est jamais perdu). Suppose un **journal d'actions** (message ↔ mutations), qui sert aussi d'audit SaaS.
_Novelty_: la sécu ne vient pas d'empêcher l'agent d'agir mais de rendre tout réversible par construction.

**[Sécu #2] Frontière lecture/écriture — écriture vers l'intérieur seulement**
_Scénario neutralisé_: injection de prompt via web → exfiltration.
_Concept_: aucun droit d'écriture sur l'auth / les comptes connectés (OAuth read-only) ; web read-only. Seules écritures autorisées = actions internes Plume (soft-delete + rewindables). Une injection ne peut donc ni agir dehors ni exfiltrer via un compte.
_Novelty_: neutralise l'injection en retirant les tools dangereux, pas en filtrant le texte (course perdue).
_Résidu noté_: `webFetch` reste un canal d'exfil potentiel (GET vers `evil.com/?data=…`) → mitiger via proxy/URL contrôlée plus tard.

**[Sécu #3] Scope tenant imposé côté serveur, jamais par l'agent**
_Scénario neutralisé_: fuite de données entre clients (multi-tenant).
_Concept_: chaque tool reçoit le `user_id` injecté depuis la session next-auth, jamais depuis un argument contrôlé par l'agent. Le périmètre est verrouillé sous la couche tool ; même une injection ne peut pas l'élargir.
_Novelty_: sécu multi-tenant structurelle, pas dépendante du bon vouloir de l'agent.

**[Sécu #4] Human-in-the-loop sur tout ce qui sort (l'agent rédige, l'humain envoie)**
_Concept_: l'agent prépare message + destinataire et affiche un bouton « Envoyer » ; l'envoi réel via comptes connectés = clic humain explicite. Autonome à l'intérieur (réversible), confirmé à la sortie (irréversible).
_Novelty_: ré-ouvre l'action externe puissante (envoyer pour de vrai) sans rouvrir le trou d'injection — le clic humain EST le filtre.

**[Sécu #5] Crédits par abonnement (cap coût + anti-DoS-portefeuille)**
_Scénario neutralisé_: boucle folle qui crame le budget API.
_Concept_: chaque plan SaaS = quota de crédits façon Claude ; l'usage agent décrémente, à zéro l'agent s'arrête jusqu'au refill. Borne la facture ET neutralise l'attaque par épuisement de budget (l'attaquant crame ses propres crédits).
_Novelty_: la limite de coût devient une feature business (tiers d'abonnement).

**[Sécu #6] Retry-cap + loop-breaker sur la boucle tool-use**
_Concept_: après N échecs sur un tool → l'agent arrête et rend la main ; plafond de tours par requête (max N tool-calls) ; détection « même tool + mêmes args répétés = stop ».
_Novelty_: échoue proprement au lieu de s'acharner — robustesse + protection coût d'un seul mécanisme.

**[Capacité #6] Mémoire persistante + historique des conversations**
_Concept_: mémoire minimale globale (qui est l'user, son style de prospection, ses préférences) à la Claude ; historique des convos stocké/consultable ; l'agent peut relire d'anciennes conversations pour du contexte.
_Novelty_: passe d'outil sans mémoire à compagnon qui connaît l'user dans la durée — clé rétention SaaS.
_⚠ Note sécu_: mémoire + historique = surface d'injection persistante (faux souvenir empoisonné rejoué chaque session) — à traiter à la construction de la mémoire.

---

## Idea Organization and Prioritization

### Organisation thématique (17 idées → 4 thèmes)

**🔧 Thème A — Le Moteur** (fondation, tout en dépend)
Archi #1 (wrapper test sur métier), Archi #2 (catalogue fermé + escape hatch gradué), Archi #3 (boucle tool-use serveur), Archi #4 (Vercel AI SDK multi-provider), Capacité #1 (catalogue = miroir des actions UI).
_Pattern: une boucle tool-use serveur + un catalogue d'actions = miroir de l'app._

**⚡ Thème B — Ce qu'il fait** (capacités)
Capacité #3 (advisor-puis-doer), #4 (import vrac → contacts+messages), #5 (web + comptes OAuth), #6 (mémoire + historique).
_Pattern: conseille, parse du vrac, agit pour de vrai, va chercher dehors, se souvient._

**🎨 Thème C — UX & Identité produit**
UX #1 (icône flottante → popup), Stratégie #1 (un moteur, 2 niveaux test/prod), #2 (spécialiste prospection + contrôle total), #3 (pas cannibale de l'UI).
_Pattern: l'outil de test EST la feature phare ; même moteur, crans de confiance différents._

**🛡️ Thème D — Garde-fous**
Sécu #1 (rewind transactionnel), #2 (écriture interne only), #3 (scope tenant serveur), #4 (human-in-loop send), #5 (crédits/abonnement), #6 (retry-cap + loop-breaker).
_Pattern: tout réversible + rien de dangereux dehors + scope verrouillé sous l'agent._

### Résultats de priorisation (validée par l'utilisateur)

**Roadmap MVP → produit :**

**MVP « ça marche pour toi »** — Thème A + minimum D
1. Boucle tool-use serveur (Archi #3) + Vercel AI SDK sur modèle gratuit (Archi #4).
2. 3-4 actions du catalogue (Capacité #1) : `seedContacts`, `createContact`, `composeMessage`, `queryContacts`.
3. Wrapper test (Archi #1) pour le faux-aléatoire.
4. Garde-fous de base : scope tenant (Sécu #3) + soft-delete (déjà en place) + retry-cap (Sécu #6).
5. UX : icône flottante + popup chat (UX #1).

**V1 « vraie feature »** — Thème B + D complet
6. Import vrac (Capacité #4) + advisor (Capacité #3).
7. Rewind transactionnel + journal d'actions (Sécu #1).
8. Human-in-loop send (Sécu #4).

**V2 « produit SaaS »** — le reste
9. Web + OAuth read-only (Capacité #5) + frontière R/W (Sécu #2).
10. Mémoire + historique (Capacité #6).
11. Crédits / abonnement (Sécu #5).

### Plan d'action — MVP (premiers pas concrets)

**Idée prioritaire : Le Moteur (Thème A) + filet de sécu de base.**
_Pourquoi : rien d'autre ne peut être testé tant que la boucle tool-use ne tourne pas. C'est le déblocage._

**Next steps (semaine 1) :**
1. `pnpm add ai @ai-sdk/google @ai-sdk/anthropic` dans `plume/` ; clé Gemini (free tier) en `.env.local` pour le dev.
2. Créer la route `POST /api/agent/chat` (App Router) protégée par next-auth ; y mettre la boucle tool-use de l'AI SDK (`generateText` / `streamText` avec `tools` + `maxSteps`).
3. Définir 4 tools en zod (déjà dans les deps) : `seedContacts`, `createContact`, `composeMessage`, `queryContacts`. Chaque tool reçoit le `userId` injecté depuis la session (Sécu #3), jamais en argument.
4. Câbler ces tools sur les vraies fonctions Drizzle existantes (Archi #1 : le wrapper orchestre, ne réimplémente pas).
5. `maxSteps` + retry-cap sur la boucle (Sécu #6) pour borner le coût dès le départ.
6. Front : icône flottante bas-droite + popup (UX #1), composant client qui POST vers la route et stream la réponse.

**Ressources :** clé API Gemini (gratuite) pour dev ; clé Anthropic (déjà présente) pour le swap prod ultérieur.
**Frein potentiel :** qualité de tool-calling des modèles gratuits — en dev on valide la plomberie, on garde Sonnet pour le vrai test produit.
**Indicateur de succès :** taper « crée 10 contacts au hasard » dans le popup → 10 lignes `isTestData` apparaissent en BDD, scoppées à l'user courant, annulables.

## Session Summary and Insights

**Réalisations clés :**
- 17 idées structurées en 4 thèmes, roadmap MVP→SaaS priorisée.
- Pivot conceptuel majeur : « agent de test jetable » → « copilote, feature phare du produit » (même moteur, deux niveaux de confiance).
- 6 garde-fous de sécurité cohérents, issus d'un pre-mortem (soft-delete+rewind, frontière R/W, scope tenant, human-in-loop, crédits, retry-cap).
- Décisions d'archi fermes : cerveau serveur, Vercel AI SDK multi-provider, catalogue = miroir des actions UI.

**Réflexions :**
- La meilleure idée n'est pas venue d'une capacité mais d'une question d'identité (« sert-il vraiment dans l'app ? ») → a redéfini tout le scope.
- Stratégie de sécurité dominante : ne pas filtrer le danger (course perdue contre l'injection) mais retirer les tools dangereux et rendre tout réversible.



