# Sync temps réel des mutations agent — pistes & recommandation

Companion de `SPEC.md` (CAP-2).

> **DÉCIDÉ (Monsieur, 2026-06-19) : piste A — pont d'invalidation.** Déclencheur retenu : un
> seul `router.refresh()` en fin de stream, conditionné à « le run a appelé ≥1 write-tool ».
> Ce document garde la trace des alternatives pesées (B, C) et du pourquoi du choix.

## Contexte du repo (état actuel)

- La page Réseau (`src/app/(app)/reseau/page.tsx`) est un **server component** : lit les
  contacts via la porte scopée `db.forUser(userId).contacts.list()`, dérive la froideur à
  la lecture, projette en `ContactView`, rend `ReseauClient`.
- Les mutations « normales » (formulaire, ajout rapide, import, suppression) passent par des
  **server actions** qui font `revalidatePath('/reseau')`, puis le client `ReseauClient`
  appelle `router.refresh()` → la page server-component se re-rend avec la liste à jour.
- Le copilote n'emprunte PAS ce chemin : il écrit pendant la boucle tool-use d'une **route
  de streaming** (`/api/agent/chat`), pas une server action. Aucun `revalidatePath` n'est
  émis, et le client chat n'a aucune raison de `router.refresh()`. → galerie périmée
  jusqu'au reload (trou constaté au checkpoint inc.1).
- **Guides Next non disponibles** : `node_modules/next/dist/docs/` n'existe pas dans cette
  version de Next (vérifié). Analyse basée sur le pattern repo + l'API Next 16 App Router.

## Les trois pistes

### A — Pont d'invalidation : signal de fin d'écriture → `router.refresh()` (RECOMMANDÉ)

Le serveur signale, en fin de tour d'écriture, qu'une mutation a eu lieu (via le flux UI
message, ou un flag de fin de stream). Le client copilote, quand il détecte ce signal,
appelle `router.refresh()` — exactement le levier que les server actions utilisent déjà.
La page server-component se re-rend, relit `db.forUser`, la galerie se met à jour.

- **+** Réutilise le contrat de sync EXISTANT (un seul concept dans le repo). Source de
  vérité unique = la base, relue par le server component. Pas de cache client à tenir.
- **+** **Générique par construction** : `router.refresh()` re-rend le segment courant quel
  que soit le tool qui a écrit → `createContact`/`composeMessage`/import héritent gratis.
  Un seul point de câblage côté client chat.
- **+** Marche quelle que soit la surface ouverte (Réseau, Aujourd'hui…) : on rafraîchit le
  segment courant.
- **−** Granularité = le segment entier (acceptable ici ; pas de besoin temps-réel fin).
- **Garde-fou** : ne PAS `router.refresh()` à chaque token. Déclencher une fois, sur un
  signal « le tour a comporté ≥1 écriture » (ou en fin de stream si une écriture a eu lieu).

### B — Events de mutation serveur→client dans le flux

Le stream agent émet des events structurés de mutation (« contact créé : … ») que le front
applique directement à un état local sans relire la base.

- **+** Mise à jour fine, potentiellement sans round-trip serveur de relecture.
- **−** Le front doit comprendre la FORME des mutations → fait fuiter de la logique métier
  côté client (viole « front bête », brainstorm Archi #3). Chaque nouveau tool = nouveau
  type d'event à mapper côté client → **pas générique** (anti-CAP-2).
- **−** Risque de divergence client↔base (l'event dit une chose, la dérivation serveur —
  ex. froideur — en dit une autre).

### C — Souscription store client (Zustand/Dexie) comme source de vérité

Le client maintient un store, l'abonne au résultat des actions agent.

- **−** Introduit une **seconde source de vérité** côté client, en concurrence avec le
  server component qui lit déjà la base. Divergence quasi garantie (la froideur est dérivée
  serveur à la lecture, pas stockée). Écarté par la contrainte SPEC « vérité serveur ».
- **−** Le plus de code, le plus de surface de bug, pour un besoin que A couvre déjà.

## Recommandation

**Piste A (pont d'invalidation).** Elle est la seule des trois qui soit à la fois (1) générique
— couvre toutes les mutations d'un point unique sans recâblage par tool — et (2) cohérente
avec la source de vérité serveur déjà en place. B et C font fuiter de la logique métier ou une
source de vérité côté client, en contradiction avec « front bête » et « vérité serveur » (SPEC,
Constraints).

## Interaction avec `toUIMessageStreamResponse` (CAP-3)

Le passage à `toUIMessageStreamResponse` est requis pour CAP-3 (erreur in-band) **de toute
façon**. Ce même flux UI message peut porter le signal de fin d'écriture de la piste A (data
part / event terminal), ce qui mutualise le changement de format de réponse : une seule
migration sert l'erreur visible ET le signal de sync. Si le design préfère, le signal de sync
peut aussi être un simple « refresh en fin de stream si le run a appelé ≥1 write-tool »,
déterminé serveur-side et exposé en fin de flux.
</content>
