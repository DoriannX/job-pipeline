# Guide pas-à-pas : brancher prod + dev (Turso · Vercel · Google · GitHub)

Suis dans l'ordre, de haut en bas. Coche au fur et à mesure.
Tu auras besoin de tes 2 fichiers : `plume/.env.prod` et `plume/.env.dev`.
À chaque secret trouvé, tu le **colles dans le bon fichier** tout de suite.

---

## ÉTAPE 0 — Outils installés

- [ ] **Turso CLI** installé. Test dans un terminal : `turso --version`
  - Pas installé ? Windows (PowerShell) : `irm https://get.tur.so/install.ps1 | iex`
    (ou via WSL : `curl -sSfL https://get.tur.so/install.sh | bash`)
- [ ] Connecté : `turso auth login` (ouvre le navigateur, login GitHub)

---

## ÉTAPE 1 — Créer les 2 bases Turso

Dans le terminal :

- [ ] `turso db create plume-prod`
- [ ] `turso db create plume-dev`

Récupère les infos **PROD** :
- [ ] `turso db show plume-prod --url`
      → copie la ligne `libsql://...` dans `plume/.env.prod` → `TURSO_DATABASE_URL=`
- [ ] `turso db tokens create plume-prod`
      → copie le long token dans `plume/.env.prod` → `TURSO_AUTH_TOKEN=`

Récupère les infos **DEV** :
- [ ] `turso db show plume-dev --url`
      → dans `plume/.env.dev` → `TURSO_DATABASE_URL=`
- [ ] `turso db tokens create plume-dev`
      → dans `plume/.env.dev` → `TURSO_AUTH_TOKEN=`

---

## ÉTAPE 2 — Générer les 2 secrets d'auth

Dans le terminal (2 fois, valeurs différentes) :

- [ ] `openssl rand -base64 32` → colle dans `plume/.env.prod` → `AUTH_SECRET=`
- [ ] `openssl rand -base64 32` → colle dans `plume/.env.dev` → `AUTH_SECRET=`

> Pas d'`openssl` sur Windows ? PowerShell :
> `[Convert]::ToBase64String((1..32 | ForEach-Object {Get-Random -Max 256}))`

---

## ÉTAPE 3 — Clé Anthropic

- [ ] Va sur **console.anthropic.com** → **API Keys** → **Create Key**
- [ ] Colle la clé dans `plume/.env.prod` → `ANTHROPIC_API_KEY=`
- [ ] (Tu peux réutiliser la même en dev) → colle aussi dans `plume/.env.dev`

---

## ÉTAPE 4 — Faire le 1er déploiement Vercel (pour obtenir les URLs)

> On déploie AVANT de configurer Google, parce que Google a besoin de connaître
> l'adresse du site (qui n'existe pas encore).

### 4a — Importer le projet (si pas déjà fait)
- [ ] Va sur **vercel.com** → connecté avec GitHub
- [ ] **Add New…** (bouton haut droite) → **Project**
- [ ] Trouve `job-pipeline` dans la liste → **Import**
- [ ] **NE déploie pas encore** : règle d'abord ci-dessous

### 4b — Root Directory = plume
- [ ] Sur l'écran d'import, section **Root Directory** → **Edit** → choisis le dossier **`plume`** → **Continue**
  - (Si projet déjà importé : **Settings** → **Build and Deployment** → **Root Directory** → **Edit** → `plume` → **Save**)

### 4c — Lancer le déploiement
- [ ] Clique **Deploy**. Attends que ça finisse (qq minutes).
- [ ] Note l'**URL de prod** affichée (genre `https://job-pipeline-xxxx.vercel.app`)

### 4d — Fixer la branche de production = main
- [ ] **Settings** (du projet) → **Environments**
- [ ] Clique l'environnement **Production**
- [ ] Section **Branch Tracking** → mets **`main`** → **Save**

> Résultat : push sur `main` = site **Production** ; push sur `dev`/autres = **Preview**.

---

## ÉTAPE 5 — Google OAuth (2 clients : prod + dev)

> Maintenant que tu as les URLs Vercel, tu peux remplir les redirect URIs.

### 5a — Projet + écran de consentement
- [ ] Va sur **console.cloud.google.com**
- [ ] En haut, sélecteur de projet → **New Project** → nom `Plume` → **Create**
- [ ] Menu ☰ → **APIs & Services** → **OAuth consent screen**
- [ ] Type **External** → **Create** → remplis nom appli + ton email → **Save and Continue** jusqu'au bout
- [ ] (Test users : ajoute ton email Google si l'appli reste en "Testing")

### 5b — Client PROD
- [ ] Menu ☰ → **APIs & Services** → **Credentials**
- [ ] **+ Create Credentials** (en haut) → **OAuth client ID**
- [ ] Application type : **Web application**
- [ ] Name : `Plume prod`
- [ ] **Authorized redirect URIs** → **+ Add URI** :
      `https://<ton-domaine-prod>/api/auth/callback/google`
      (utilise l'URL Vercel de prod si pas de domaine perso)
- [ ] **Create** → popup avec **Client ID** + **Client secret**
- [ ] Colle dans `plume/.env.prod` : `AUTH_GOOGLE_ID=` et `AUTH_GOOGLE_SECRET=`

### 5c — Client DEV
- [ ] Encore **+ Create Credentials** → **OAuth client ID** → **Web application**
- [ ] Name : `Plume dev`
- [ ] **Authorized redirect URIs**, ajoute 2 lignes :
      `http://localhost:3000/api/auth/callback/google`
      `https://<une-preview>.vercel.app/api/auth/callback/google`
- [ ] **Create** → colle dans `plume/.env.dev` : `AUTH_GOOGLE_ID=` et `AUTH_GOOGLE_SECRET=`

> Les URLs de preview changent à chaque deploy → l'auth Google marche surtout en
> local (`localhost`) en dev. Pour une preview stable, on verra plus tard
> (domaine preview fixe). Pas bloquant pour démarrer.

---

## ÉTAPE 6 — Mettre les variables dans Vercel

> Tes 2 fichiers `.env.prod` / `.env.dev` sont maintenant remplis. On les recopie.

- [ ] **Settings** (projet Vercel) → **Environment Variables**
- [ ] Pour CHAQUE ligne de `plume/.env.prod` (sauf les commentaires `#`) :
  - **Key** = nom (ex `TURSO_DATABASE_URL`), **Value** = la valeur
  - **décoche "All Environments"** → coche **seulement Production**
  - secrets (`*_TOKEN`, `*_SECRET`, `ANTHROPIC_API_KEY`) → coche **Sensitive**
  - **Save**
- [ ] Recommence pour CHAQUE ligne de `plume/.env.dev` :
  - même Key, valeur dev → coche **seulement Preview**
  - (option : "Preview" → cible la branche **dev**)
  - **Save**

> Tu auras donc 2 entrées `TURSO_DATABASE_URL` (une Production, une Preview), etc.

- [ ] Une fois tout collé : **Deployments** → dernier deploy → **⋯** → **Redeploy**
      (les variables ne s'appliquent qu'au prochain build)

---

## ÉTAPE 7 — Secrets GitHub (seulement si CI/cron en a besoin)

> Utile pour le cron Python (`daily.yml`) ou des tests CI qui touchent la vraie DB.
> Si tu ne fais que du Vercel pour l'instant, tu peux SAUTER cette étape.

- [ ] Va sur **github.com/DoriannX/job-pipeline** → **Settings**
- [ ] Menu gauche → **Environments**
- [ ] Clique **production** → **Add secret** → ajoute les valeurs prod (Turso, etc.)
- [ ] Reviens → clique **development** → **Add secret** → valeurs dev

---

## ÉTAPE 8 — Vérifier que tout marche

- [ ] **Local** : copie `plume/.env.dev` → `plume/.env.local`, puis dans `plume/` :
      `pnpm install` puis `pnpm dev` → ouvre http://localhost:3000 → teste login Google
- [ ] **Preview** : push sur `dev` → Vercel crée une Preview → ouvre l'URL preview
- [ ] **Prod** : fais une PR `dev → main`, merge → Vercel déploie en Production

---

## Récap mental

| Tu travailles | Branche | Vercel | Base Turso | Google client |
|---|---|---|---|---|
| sur ton PC | (local) | — | `plume-dev` ou `file:./local.db` | localhost |
| tu testes | `dev` | Preview | `plume-dev` | dev |
| tu sors une version | `main` | Production | `plume-prod` | prod |

Ce qui est DÉJÀ fait (par moi, côté GitHub) : branche défaut `dev`, protections
`dev`/`main`, CI requise, environments GitHub créés. Toi = Turso + Vercel + Google.
