---
title: 'Copilote Phase 1 — boucle tool-use serveur + route /api/agent/chat'
type: 'feature'
created: '2026-06-19'
status: 'done'
baseline_commit: '8c8f41a106e76f86d66b0b3c22f04e2b6c8fb82f'
context:
  - '{project-root}/docs/brainstorming/brainstorming-session-2026-06-19.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le copilote IA in-app (feature phare de Plume) n'a aucun moteur. Rien ne peut être testé tant que la boucle tool-use serveur ne tourne pas — c'est le déblocage du MVP (Thème A du brainstorm).

**Approach:** Poser le squelette minimal : une route serveur `POST /api/agent/chat` qui tient la boucle tool-use via le Vercel AI SDK, avec UN seul tool read-only (`queryContacts`). Provider swappable par env var (Gemini gratuit en dev / Sonnet en prod). Pas d'UI cette phase — validation par curl (Checkpoint 1 = plomberie OK).

## Boundaries & Constraints

**Always:**
- Cerveau 100% serveur : la clé API ne touche JAMAIS le client (modules `server-only`, comme `claude.server.ts`).
- Scope tenant imposé sous la couche tool (Sécu #3) : chaque tool reçoit `userId` injecté depuis la session next-auth, JAMAIS depuis un argument contrôlé par l'agent. Accès données uniquement via `forUser(userId)`.
- Borne de coût dès le départ (Sécu #6) : `stopWhen: stepCountIs(N)` + garde anti-boucle.
- Accès schéma/drizzle uniquement dans `src/lib/db/**` (barrière ESLint AR-2/AR-13) ; le tool passe par les repositories.
- Zod à la frontière HTTP (valider le body avant toute logique), erreurs douces (jamais de 500 brut / stack au client), `auth()`→401 si pas de session.

**Ask First:**
- Migrer le composer existant (`claude.server.ts`) vers l'AI SDK — HORS scope, ne pas toucher. Les 2 SDK cohabitent.
- Ajouter un tool en écriture (createContact, seedContacts) — c'est Phase 2, ne pas anticiper.

**Never:**
- Pas d'UI front (icône/popup) cette phase.
- Pas d'`escape hatch` générique (`runGeneric`), pas d'accès web/OAuth, pas de mémoire/historique.
- Le tool ne réimplémente aucune logique BDD : il orchestre le repository existant (Archi #1).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | Session valide + `{message:"combien j'ai de contacts"}` | Agent appelle `queryContacts` → stream texte avec le compte réel scopé à l'user | N/A |
| Filtre | `{message:"contacts chez Acme"}` | `queryContacts({search:"Acme"})` → liste filtrée (projection légère) | liste vide → réponse « aucun » |
| Non authentifié | Pas de session | 401, aucune génération | JSON `{error}` |
| Body invalide | JSON malformé / champ manquant | 400, zod issues | pas de boucle agent |
| Boucle folle | Modèle rappelle le même tool en boucle | Stop à N steps, rend la main proprement | message d'arrêt, pas de crash |
| Clé API absente | `GOOGLE_GENERATIVE_AI_API_KEY`/`ANTHROPIC_API_KEY` manquante | Erreur douce lisible | jamais de stack |

</frozen-after-approval>

## Code Map

- `plume/package.json` -- ajouter deps `ai`, `@ai-sdk/google`, `@ai-sdk/anthropic`.
- `plume/src/app/api/composer/route.ts` -- SQUELETTE de référence (auth→zod→stream→erreurs douces) à imiter, ne pas modifier.
- `plume/src/lib/claude.server.ts` -- patron d'encapsulation `server-only` + lecture clé `process.env` à imiter.
- `plume/src/lib/db/index.ts` -- surface autorisée : `forUser(userId)` → `gate.contacts.list()` (déjà scopé tenant + soft-delete).
- `plume/src/lib/auth.ts` -- `auth()` (session next-auth, `session.user.id`).
- `plume/.env.local` (hardlink store central) -- ajouter `AGENT_PROVIDER`, `GOOGLE_GENERATIVE_AI_API_KEY`.

## Tasks & Acceptance

**Execution:**
- [x] `plume/package.json` -- `pnpm add ai @ai-sdk/google @ai-sdk/anthropic` -- moteur tool-use multi-provider. (installé : ai 6.0.208, @ai-sdk/anthropic 3.0.85, @ai-sdk/google 3.0.83)
- [x] `plume/src/lib/agent/provider.server.ts` -- module `server-only` : `getAgentModel()` lit `AGENT_PROVIDER` (`prod`→`anthropic("claude-sonnet-4-6")`, défaut→`google("gemini-2.0-flash")`), `AgentConfigError` douce si clé absente -- swap provider 1 endroit.
- [x] `plume/src/lib/agent/tools.server.ts` -- module `server-only` : logique pure `queryContacts(repo, {search})` + `buildTools(userId)` (tool zod `{search?}`, `execute` câblé sur `forUser(userId).contacts.list()` + filtre + projection légère + cap 50) -- `userId` clos par closure (Sécu #3).
- [x] `plume/src/lib/agent/run.server.ts` -- wrapper boucle tool-use : `runAgentChat({userId, messages})` → `streamText({ model, system, tools, stopWhen: stepCountIs(8) })` → `toTextStreamResponse()` -- la route passe par CE wrapper, jamais le SDK nu.
- [x] `plume/src/app/api/agent/chat/route.ts` -- route `POST` (`runtime nodejs`, `dynamic force-dynamic`) : `auth()`→401, zod body `{message|messages}`, délègue à `runAgentChat`, erreurs douces (503).
- [x] `plume/tests/agent/tools.test.ts` -- vitest : isolement cross-tenant, filtre `search` casse-insensible, projection, liste vide (4 tests verts).
- [x] `plume/eslint.config.mjs` -- barrière 2 généralisée : `ai` + `@ai-sdk/*` server-only (parité sécu avec `@anthropic-ai/sdk`).
- [x] `plume/.env.example` + `.env.local` -- `AGENT_PROVIDER`, `GOOGLE_GENERATIVE_AI_API_KEY`.

**Acceptance Criteria:**
- Given une session valide, when je POST `{"message":"combien j'ai de contacts"}` sur `/api/agent/chat`, then la réponse streamée contient le compte réel des contacts de l'user courant (Checkpoint 1).
- Given aucune session, when je POST, then 401 sans aucun appel modèle.
- Given un body invalide, when je POST, then 400 avec issues zod, sans lancer la boucle agent.
- Given le tool `queryContacts`, when un test tente de lire les contacts d'un autre tenant, then c'est impossible (scope verrouillé sous le tool).

## Spec Change Log

- **Itération 1 (review adversariale 3 angles).** Findings classés patch/defer/reject, aucun intent_gap/bad_spec (pas de loopback). Patches appliqués sans renégocier l'intent gelé :
  - Erreurs EN PLEIN STREAM silencieuses (`streamText` échoue après le renvoi de la Response, hors try/catch route ; `toTextStreamResponse` ignore les events non-texte) → `onError` ajouté + `getAgentModel()` hissé en synchrone. *Évite : échec invisible / flux tronqué pris pour un succès.*
  - Tool `execute` non absorbé (DB indispo en plein tour tuait le flux) → try/catch renvoyant un résultat structuré `{error}` (posture du composer). *Évite : boucle agent qui meurt sur un blip DB.*
  - Payload non borné (cost/DoS) → zod `.trim().max(8000)` sur le contenu + array `.max(50)` + `search` `.max(200)`. *Évite : amplification de coût par un user authentifié.*
  - Troncature à 50 non signalée → champ `truncated` + mention dans la `description` du tool. *Évite : le modèle énumère un échantillon comme si c'était tout.*
  - Provider fail-open (tout ≠ "prod" → dev) → allowlist `prod|dev`, throw sur inconnu. *Évite : un typo `AGENT_PROVIDER` shippe le modèle de dev en prod.*
  - **KEEP** (préserver à toute re-dérivation) : scope tenant clos par closure (jamais argument agent), wrapper `*.server` (route ne touche pas le SDK nu), barrière ESLint généralisée aux SDK LLM, logique pure `queryContacts` testable. *Reviewers : zéro fuite cross-tenant, zéro bypass auth confirmés.*
  - **Defer** : historique `assistant` falsifiable par le client = levier d'injection (borné car tool read-only + scope tenant) → durcissement = frontière R/W, Checkpoint 5 / V2.

## Design Notes

AI SDK **v6** (installé : ai 6.0.208, @ai-sdk/* 3.x) : `tool({ description, inputSchema: z.object(...), execute })`, `streamText({ ..., stopWhen: stepCountIs(N), onError })`, providers `google()` / `anthropic()`. Google lit `GOOGLE_GENERATIVE_AI_API_KEY`, Anthropic lit `ANTHROPIC_API_KEY` (déjà présent). `toTextStreamResponse(init?)` ne prend qu'un `ResponseInit` (pas de `getErrorMessage`) → les erreurs en cours de stream sont journalisées via `onError` ; l'erreur in-band côté client viendra avec l'UI (`toUIMessageStreamResponse`). `toTextStreamResponse()` suffit pour le test curl (pas d'UI). ⚠ Modèles gratuits appellent les tools moins bien que Sonnet → en dev on valide la plomberie (la boucle tourne ?), pas la qualité de raisonnement.

## Verification

**Commands:**
- `cd plume && pnpm exec tsc --noEmit` -- expected: 0 erreur type.
- `cd plume && pnpm exec eslint src/lib/agent src/app/api/agent` -- expected: 0 violation (notamment barrière schéma/drizzle).
- `cd plume && pnpm exec vitest run tests/agent` -- expected: tests scope/filtre verts.

**Manual checks (Checkpoint 1 — curl, fait par l'humain après swap clé) :**
- Démarrer `pnpm dev`, POST `{"message":"crée 0… combien de contacts ai-je"}` avec cookie de session → le stream cite le compte réel ; vérifier qu'aucune clé API n'apparaît dans la réponse réseau côté client.

## Suggested Review Order

**Frontière HTTP (entrée)**

- Point d'entrée : auth→401, zod borné, délégation au wrapper, erreurs douces 503.
  [`route.ts:31`](../../plume/src/app/api/agent/chat/route.ts#L31)
- Bornes anti-coût/DoS : contenu trimmé+plafonné, nombre de tours plafonné.
  [`route.ts:26`](../../plume/src/app/api/agent/chat/route.ts#L26)

**Cœur serveur (boucle tool-use)**

- Wrapper : modèle hissé en synchrone, `stopWhen`, `onError` (erreurs mid-stream).
  [`run.server.ts:39`](../../plume/src/lib/agent/run.server.ts#L39)
- Provider fail-closed : allowlist prod|dev, throw sur inconnu.
  [`provider.server.ts:35`](../../plume/src/lib/agent/provider.server.ts#L35)

**Scope tenant + tool (sécu)**

- `userId` clos par closure, jamais argument agent (Sécu #3) ; execute absorbé.
  [`tools.server.ts:70`](../../plume/src/lib/agent/tools.server.ts#L70)
- Logique pure testable : filtre + projection + flag `truncated`.
  [`tools.server.ts:41`](../../plume/src/lib/agent/tools.server.ts#L41)

**Barrière & périphériques**

- Barrière ESLint généralisée : `ai` + `@ai-sdk/*` server-only (parité clé).
  [`eslint.config.mjs:35`](../../plume/eslint.config.mjs#L35)
- Tests : isolement cross-tenant, filtre, projection, vide, troncature.
  [`tools.test.ts:24`](../../plume/tests/agent/tools.test.ts#L24)
