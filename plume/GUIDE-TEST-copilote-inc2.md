# Guide de test — Copilote inc.2 (UI + sync temps réel)

Serveur lancé : **http://localhost:3000** (`corepack pnpm dev`, Turbopack).
Provider dev : **Gemini Flash** (`AGENT_PROVIDER` vide → défaut `dev`). Tool-calling plus
faible que Sonnet : formule tes demandes simplement et explicitement.

---

## 0. Prérequis (1 min)

1. Ouvre http://localhost:3000 → tu es redirigé vers `/login`.
2. Connecte-toi via **Google** (Auth.js). Sans session, le copilote répond 401 (testé).
3. Ouvre les **DevTools navigateur** (F12) → onglet **Réseau/Network**. Laisse-le ouvert
   pour les checks sécu.

---

## 1. CAP-1 — l'icône flottante + popup (sur les 3 onglets)

| Étape | Action | Attendu |
|-------|--------|---------|
| 1.1 | Va sur l'onglet **Réseau** | Icône flottante ronde **mauve** avec la mascotte plume, en bas à droite, au-dessus de la TabBar |
| 1.2 | Va sur **Aujourd'hui** puis **Réglages** | L'icône est présente sur les 3 onglets (montée 1 fois dans le layout) |
| 1.3 | Clique l'icône | Popup chat s'ouvre (bottom-sheet, contour plein + offset net, titre « Copilote » en Fraunces) |
| 1.4 | Tape **« combien j'ai de contacts »** + Entrée | La réponse de l'agent **se streame** dans une bulle (compte réel scopé à ton compte) |
| 1.5 | Ferme (Échap, croix, ou clic backdrop) puis rouvre | Le fil de conversation est conservé (état en-session) |

**Check design :** police Quicksand/Fraunces (jamais Inter/emoji), aucun gradient, aucune
ombre molle (flou=0), mauve uniquement sur l'icône + bouton envoyer.

---

## 2. CAP-2 — sync temps réel (le cœur)

| Étape | Action | Attendu |
|-------|--------|---------|
| 2.1 | Reste sur l'onglet **Réseau**, popup ouvert. Note le nombre de contacts visibles dans la galerie | — |
| 2.2 | Tape **« crée 10 contacts au hasard »** + Entrée | L'agent appelle `seedContacts`, répond qu'il a créé les contacts |
| 2.3 | **NE RECHARGE PAS la page** | Les nouveaux contacts apparaissent **dans la galerie tout seuls** dès la fin du tour (1 seul `router.refresh()`) |
| 2.4 | Re-pose **« combien j'ai de contacts »** | Le compte a augmenté de ~10 |

> Si Gemini n'appelle pas le tool (modèle dev faible), reformule : **« utilise seedContacts
> pour créer 10 contacts de test »**. La galerie doit se mettre à jour sans reload.

**Preuve du « single refresh » :** dans l'onglet Réseau des DevTools, à la fin du tour tu vois
**une seule** requête de re-render du segment (pas une par token).

**Read-only ne refresh pas :** une demande sans écriture (« combien de contacts ») ne déclenche
**aucun** refresh de galerie.

---

## 3. CAP-3 — erreur in-band (fin terminale douce)

But : prouver qu'une erreur mid-stream s'affiche comme bulle douce, jamais un flux figé.

**Option A (la plus simple) — couper la clé provider :**
1. Arrête le serveur (Ctrl+C dans le terminal dev).
2. Édite le store central `~/.config/plume/.env.local` : commente/vide
   `GOOGLE_GENERATIVE_AI_API_KEY`.
3. Relance `corepack pnpm dev`, recharge, ouvre le copilote, envoie un message.
4. **Attendu :** bulle d'erreur **douce** (fond note, texte encre-soft, jamais rouge/stack) du
   type « Le copilote est indisponible un court instant. ». Le champ reste utilisable.
5. **Remets la clé** + relance après le test.

**Option B — couper le réseau en plein stream :**
1. Envoie une demande longue (« résume mes 5 contacts les plus froids »).
2. Pendant que ça streame, passe les DevTools en **Offline** (onglet Réseau → throttling Offline).
3. **Attendu :** bulle d'erreur douce terminale, pas une bulle tronquée prise pour un succès.

---

## 4. Sécurité — la clé API ne touche jamais le navigateur

| Étape | Action | Attendu |
|-------|--------|---------|
| 4.1 | DevTools → Réseau, envoie un message au copilote | Une requête **POST `/api/agent/chat`** apparaît |
| 4.2 | Inspecte la requête (Payload + Réponse) | **Aucune** clé API (`ANTHROPIC_API_KEY`/`GOOGLE_*`) nulle part. Body = `{messages:[...]}`, réponse = flux SSE `data: {...}` |
| 4.3 | Cherche `sk-`, `AIza`, `ANTHROPIC` dans les sources/requêtes | Rien côté client (tout reste derrière la route serveur) |

---

## 5. Bonus — robustesse (optionnel)

- **Double-Entrée rapide** : tape un message, presse Entrée 2× très vite → **un seul** tour part
  (garde de ré-entrance), pas de bulle fantôme bloquée.
- **Conversation multi-tours** : enchaîne quelques questions → le fil reste cohérent, le champ se
  reverrouille pendant chaque génération (« La plume réfléchit… », jamais de spinner).

---

## Récap auto déjà validé (pas à refaire à la main)

- `pnpm exec tsc --noEmit` → 0 erreur
- `pnpm exec eslint src/app src/features src/lib/agent` → 0 violation (barrières SDK/drizzle)
- `pnpm exec vitest run` → **366 verts** (dont CAP-3 erreur terminale, sync didWrite incl.
  écriture-puis-erreur, part abort, 401)
