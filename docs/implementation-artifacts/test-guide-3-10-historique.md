# Guide de test manuel — Story 3.10 : Historique de conversation → génération en continuité

**App :** http://localhost:3000 (serveur dev déjà lancé, Turso dev DB migrée).
**Pré-requis :** être connecté (login dev preview sans Google). Migration `0009` appliquée.

> Couvre les 6 critères d'acceptation (AC). Coche chaque ✅ attendu.

---

## AC 1 — Saisie & persistance

1. Aller sur **Réseau** → **Ajouter un contact** (ou ouvrir un contact existant → **Modifier**).
2. Repérer le champ **« Historique de conversation »** (sous *Notes*).
   - ✅ Textarea libre, label FR, sous-texte « Optionnel. Utilisé pour écrire en continuité… », **aucun rouge**.
3. Saisir un nom + coller un historique, ex. :
   ```
   Moi : on s'était dit qu'on se recroiserait au meetup React.
   Lui : oui ! je te tiens au courant de la date exacte.
   ```
4. Enregistrer.
   - ✅ Contact créé, retour galerie.
5. Ouvrir la fiche du contact.
   - ✅ Section **« Historique de conversation »** affichée avec le texte (sauts de ligne préservés).
6. **Modifier** → le textarea est **pré-rempli** avec l'historique. Le modifier, enregistrer.
   - ✅ La fiche reflète la nouvelle valeur (éditable à tout moment).
7. **Distinct de Notes** : remplir *Notes* ≠ *Historique*, vérifier que les deux coexistent séparément.
   - ✅ Deux encarts distincts sur la fiche.

---

## AC 2 — Injection en continuité (le cœur)

1. Sur la fiche d'un contact **avec historique**, toucher **« Écrire »** (ouvre le Composeur).
2. Laisser le champ idée **vide** (ou une idée courte), choisir un canal, toucher **Générer**.
   - ✅ Le message généré **rebondit sur le dernier point** de l'historique (ici : la date du meetup), pas un message générique hors-sol.
   - ✅ Ne se contente pas de résumer l'historique — écrit la *suite*.
3. Régénérer 2-3 fois pour juger la tendance (l'IA varie).

> 💡 Test fin : mettre un historique qui finit sur une **question ouverte** (« tu es dispo quand ? »). Le message généré devrait y répondre / la relancer.

---

## AC 3 — Non-régression SANS historique

1. Créer (ou prendre) un contact **sans** historique (champ vide).
2. Ouvrir le Composeur, **Générer**.
   - ✅ Comportement **identique à avant** (génération few-shot seule). Aucun bloc parasite, aucune mention d'historique inexistant.
3. Comparer subjectivement avec un contact à historique : la différence de continuité doit être nette.

---

## AC 4 — Transparence API

1. **Réinitialiser le flag one-time** : la micro-ligne ne s'affiche qu'à la *première* sollicitation API. Pour la revoir, vider le localStorage —
   console navigateur (F12) :
   ```js
   localStorage.removeItem("plume.composer.apiNoticeSeen")
   ```
   (clé approximative ; sinon onglet navigation privée).
2. Contact **avec** historique → Composeur → Générer.
   - ✅ Micro-ligne : « Pour générer, **ton texte et l'historique de ce contact** sont envoyés à l'API Claude. »
3. Contact **sans** historique → Générer.
   - ✅ Micro-ligne d'origine : « Pour générer, ton texte est envoyé à l'API Claude. » (pas de mention historique).

---

## AC 5 — Borne / troncature serveur

1. **Borne de saisie (8000)** : coller un historique > 8000 caractères dans le formulaire.
   - ✅ Message doux « Cet historique est un peu long. » (rejet à la frontière, jamais un 500).
2. **Borne d'injection (4000)** : coller ~5000-7000 caractères (accepté par la saisie), avec une **phrase repère unique tout à la FIN** (ex. `=== DERNIER POINT XYZ ===`).
   - Générer.
   - ✅ Le serveur tronque à 4000 char en **gardant la fin** (la phrase repère doit influencer la génération — c'est l'échange le plus récent qui compte). Couvert par test auto, mais vérifiable à la main.
3. Le texte **stocké/affiché** reste complet (jusqu'à 8000) ; seul l'envoi à Claude est borné à 4000.

---

## AC 6 — Frontières produit

- ✅ La génération passe par le **Composeur** (bouton « Écrire »/« Générer »), **jamais** le Copilote.
- ✅ Le champ **idée reste optionnel** (Générer marche champ vide).
- ✅ Pas de boutons-intention, écran de confiance, jauge, multi-fils — hors scope, absents.

---

## Sécurité (cross-tenant) — couvert par test auto

`tests/security/cross-tenant.test.ts` prouve qu'un user B ne lit ni n'écrase jamais l'historique de A. Pas de test manuel requis (un seul compte dev).

---

## Commandes de vérif (terminal, dossier `plume/`)

```bash
# pnpm pas sur le PATH → node + corepack
node "C:/Users/P0ulpy/AppData/Local/node/corepack/v1/pnpm/10.33.0/bin/pnpm.cjs" test       # 416 tests
node "C:/Users/P0ulpy/AppData/Local/node/corepack/v1/pnpm/10.33.0/bin/pnpm.cjs" typecheck
node "C:/Users/P0ulpy/AppData/Local/node/corepack/v1/pnpm/10.33.0/bin/pnpm.cjs" lint
```

---

## Checklist rapide

- [ ] Champ historique visible (création + édition), distinct de Notes, jamais rouge
- [ ] Persiste + s'affiche sur la fiche, éditable
- [ ] Génération AVEC historique → continuité (rebondit sur le dernier point)
- [ ] Génération SANS historique → identique à avant (non-régression)
- [ ] Micro-ligne transparence change selon présence historique
- [ ] > 8000 char rejeté doux ; > 4000 tronqué côté serveur (garde la fin)
- [ ] Génération = Composeur, idée optionnelle
