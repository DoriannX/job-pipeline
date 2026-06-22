# Deferred Work

Travail repéré mais hors scope de la story courante. À traiter dans une story dédiée.

## Copilote — durcissement injection (depuis review Phase 1, 2026-06-19)

- ~~**Historique `assistant` falsifiable par le client.**~~ **RÉSOLU (Phase 2 inc.1, 2026-06-19)** → CAP-3 livrée : `selectTrustedTurns` (filtre `user`-only) à la frontière HTTP (`route.ts`, 400 si vide) ET en défense-en-profondeur dans `runAgentChat`. Tests : un faux tour `assistant` est écarté, un body 100% `assistant` ne déclenche aucune génération. Renégociation future notée dans le code (multi-tour réel ⇒ valider/signer les tours `assistant` côté serveur plutôt que les écarter). **SPEC'D (Phase 3, 2026-06-21)** → résolu par construction dans [`docs/specs/spec-copilote-phase-3-historique-persistant/SPEC.md`](../specs/spec-copilote-phase-3-historique-persistant/SPEC.md) CAP-3 : le contexte multi-tour est chargé CÔTÉ SERVEUR depuis le fil persisté (le client n'envoie plus que `{conversationId, message}`), donc le serveur devient la source de vérité des tours `assistant` au lieu de les écarter. Pas encore codé.
- **Erreur in-band côté client.** ~~En Phase 1, une erreur en cours de stream est journalisée (`onError`) mais pas renvoyée au client (pas d'UI).~~ **SPEC'D / IN-FLIGHT (Phase 2 inc.2, 2026-06-19)** → CAP-3 de `docs/specs/spec-copilote-phase-2-ui-sync/SPEC.md` : passage à `toUIMessageStreamResponse` pour émettre un token d'erreur terminal visible dans le popup. Pas encore codé.

## Copilote — sync UI temps réel des mutations agent (validé au checkpoint Phase 2 inc.1, 2026-06-19)

> **SPEC'D / IN-FLIGHT (Phase 2 inc.2, 2026-06-19)** → CAP-1 (UI copilote) + CAP-2 (sync temps réel)
> de `docs/specs/spec-copilote-phase-2-ui-sync/SPEC.md`. Mécanisme tranché = pont d'invalidation
> (`router.refresh()` unique en fin de stream si ≥1 write-tool). Pas encore codé.

- **Toute écriture de l'agent doit se refléter en TEMPS RÉEL dans l'UI, sans reload.** Constaté au checkpoint : `seedContacts` crée bien 10 contacts, mais il faut recharger la page Réseau pour les voir. Besoin Monsieur : pas seulement `seedContacts` — **toute** mutation déclenchée par le copilote (createContact, composeMessage, statut, import…) doit apparaître live.
  - **Scope** : transverse, pas un tool précis. Mécanisme générique (l'UI s'abonne au résultat des actions agent ; revalidation/invalidation du cache de données, ou push serveur→client) plutôt qu'un patch par feature.
  - **Pré-requis** : l'UI du copilote (icône flottante / popup chat) — actuellement non-goal. Le temps réel arrive AVEC ou APRÈS cette UI.
  - **Pistes** (à trancher au design, après lecture des guides Next dans `node_modules/next/dist/docs/`) : invalidation après tour d'écriture (revalidate / refresh du segment de données) ; ou flux serveur→client (le stream agent émet des events de mutation que le front applique) ; ou souscription store côté client. Préférer le mécanisme le plus haut niveau qui couvre TOUTES les mutations d'un coup.

## Deferred from: code review of PR #23 (archive-tools + dev-login) (2026-06-21)

- **W3 (durcissement dev-auth, defense-in-depth).** Le bypass `devSignIn` repose sur la seule garde `NODE_ENV !== "production"`. Vérifié inoffensif sur Vercel (`next build` force `NODE_ENV=production`, prod ET preview ; aucune réf `VERCEL_ENV`), mais un déploiement hors-Vercel avec `NODE_ENV` non-production (Docker mal configuré, `next start` sans env) rendrait le bouton + la session dev atteignables. Durcir : opt-in explicite `PLUME_DEV_AUTH=1` EN PLUS de `NODE_ENV`, et/ou assert host loopback. Fichiers : `plume/src/lib/auth-dev.ts`. Cf. SPEC inc.5 Non-goals.
- **W1 (cleanup sessions dev).** `createDevSession` insère une ligne `sessions` jamais purgée à chaque connexion dev → accumulation + anciens tokens dev valides 30 j. Dev-only, non critique. Option : supprimer les sessions du user dev avant insert, ou upsert. Fichier : `plume/src/lib/db/dev-auth.ts`.
- **W2 (observabilité rewind).** `replayRewind` ignore le booléen de retour de `restoreDraft`/`archiveDraft`/`remove` → un no-op/échec d'inverse pendant le replay est silencieux (attendu car idempotent, mais aucune trace). Pattern pré-existant (chemin `created` le faisait déjà). Option : logguer un warn quand un inverse rejoué matche 0 ligne. Fichier : `plume/src/features/copilote/rewind.ts`.
