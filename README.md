# Job Pipeline — recherche d'emploi semi-automatisée

Pipeline personnel (mono-utilisateur) qui **ingère les alertes job que tu reçois
par e-mail** (LinkedIn, Indeed, HelloWork, WTTJ…), les stocke localement, les
déduplique et produit chaque matin un digest des nouvelles offres à postuler.
**L'humain garde toujours la main sur les candidatures** — l'outil prépare, il
n'envoie pas.

> **Pourquoi par e-mail ?** Les sites à fort volume (LinkedIn, Indeed) ont fermé
> leurs APIs publiques, et le scraping est interdit (ToS + règle du projet). Mais
> ces sites t'envoient *eux-mêmes* les nouvelles offres par **alertes e-mail**.
> Parser ta propre boîte mail = tes données reçues → **légal, zéro scraping**.
> C'est la porte d'entrée légale vers LinkedIn/Indeed.

Sources :
- **Alertes e-mail** (principal) — IMAP sur ta boîte Gmail.
- **Adzuna** (complément API officiel, gratuit) — agrégateur, filet structuré.
- **France Travail** (optionnel/dormant) — actif seulement si tu renseignes des
  identifiants FT.

Scope : **alternance (FR)** + **CDI (FR + Europe anglophone** : Irlande, Pays-Bas…**)**.
Le pipeline avale ce qui arrive : c'est **toi** qui crées les alertes avec les bons
filtres géo/langue.

---

## 1. Pré-requis

- **Python 3.11+** (testé jusqu'à 3.14).
- Une boîte **Gmail** qui reçoit (ou recevra) les alertes job.

---

## 2. Installation

```powershell
cd C:\Users\P0ulpy\Documents\GitHub\job-pipeline

python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

copy .env.example .env   # puis remplir .env (voir §4)
```

Sous Linux/macOS : `source .venv/bin/activate`.

Le fichier `.env` est ignoré par git — **ne jamais le committer**.

---

## 3. Setup côté Gmail (à faire une fois)

### 3.1 Activer l'accès IMAP + créer un App Password
1. Active la **validation en 2 étapes** sur ton compte Google (obligatoire pour
   les App Passwords) : Compte Google → **Sécurité**.
2. Active **IMAP** dans Gmail : ⚙️ → **Voir tous les paramètres** →
   **Transfert et POP/IMAP** → *Activer IMAP* → Enregistrer.
3. Crée un **mot de passe d'application** : Compte Google → **Sécurité** →
   **Mots de passe des applications** → génère-en un (nom libre, ex. « job-pipeline »).
   Copie les 16 caractères → ça va dans `IMAP_APP_PASSWORD` (PAS ton mot de passe Gmail).

### 3.2 Créer les alertes
Sur LinkedIn, Indeed, HelloWork, WTTJ, etc. : crée des **alertes e-mail** pour
tes recherches (alternance FR ; CDI FR + Irlande/Pays-Bas/autres pays anglophones EU).

### 3.3 Ranger les alertes dans des labels Gmail (tri automatique)
Crée des **filtres Gmail** (⚙️ → Filtres → Créer un filtre) qui appliquent un
label selon l'expéditeur/objet, par exemple :
- alertes d'alternance → label **`jobs/alternance`**
- alertes CDI France → label **`jobs/cdi-fr`**
- alertes CDI Europe → label **`jobs/cdi-eu`**

Le pipeline lit chaque label et en déduit la catégorie (voir `EMAIL_LABELS`).

---

## 4. Remplir `.env`

Minimum vital pour l'ingestion e-mail :

```
IMAP_USER=ton.adresse@gmail.com
IMAP_APP_PASSWORD=xxxxxxxxxxxxxxxx
EMAIL_LABELS=jobs/alternance:alternance
```

`EMAIL_LABELS` = `label:catégorie` séparés par des virgules. La catégorie sert au
regroupement dans le digest (libre : `alternance`, `cdi`, `stage`…).

Optionnel : `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` (voir §7), `FT_CLIENT_ID` /
`FT_CLIENT_SECRET` (France Travail, dormant sinon).

---

## 5. Lancement

```powershell
.\.venv\Scripts\python.exe main.py
```

Flux : ingestion alertes e-mail → stockage SQLite (dédup) → digest du jour → résumé.

Sorties (créées au runtime, ignorées par git) :
- `data/offers.db` — base SQLite (toutes les offres connues + e-mails traités).
- `output/digest-AAAA-MM-JJ.md` — digest lisible, **groupé par catégorie**.
- `output/digest-AAAA-MM-JJ.csv` — même contenu, exploitable en tableur.

Idempotence : on **ne modifie pas** l'état lu/non-lu de ta boîte ; les e-mails
déjà traités sont mémorisés (table `processed_emails`) et ignorés au run suivant.

---

## 6. Déploiement cloud (recommandé — marche PC éteint)

Le pipeline tourne dans le cloud via **GitHub Actions** (cron quotidien gratuit),
persiste sa base entre deux exécutions, et **t'envoie le digest par e-mail**. Plus
besoin d'allumer le PC.

**Architecture cloud :** le repo est **public** (minutes Actions gratuites illimitées),
mais il ne contient **que du code générique** — aucune donnée, aucun secret. Les
offres sont stockées dans **Turso** (base libSQL cloud, privée, gratuite) et les
identifiants vivent dans **GitHub Secrets**. Rien de personnel n'est exposé.

### 6.1 Rendre le repo public
Repo GitHub → **Settings → General → Danger Zone → Change repository visibility →
Make public**. (Sûr : le code ne contient ni secret ni données ; tout est dans les
Secrets et dans Turso.)

### 6.2 Créer la base Turso
1. Crée un compte sur **turso.tech** (gratuit) et une base de données.
2. Récupère l'**URL** (`libsql://...`) et génère un **token d'authentification**.

### 6.3 Déclarer les secrets GitHub
Dépôt GitHub → **Settings → Secrets and variables → Actions → New repository secret** :

| Secret | Valeur |
|--------|--------|
| `IMAP_USER` | ton adresse Gmail |
| `IMAP_APP_PASSWORD` | l'App Password 16 caractères |
| `EMAIL_LABELS` | `jobs/alternance:alternance` |
| `MAIL_TO` | ton adresse Gmail (destinataire du digest) |
| `TURSO_DATABASE_URL` | l'URL `libsql://...` de ta base Turso |
| `TURSO_AUTH_TOKEN` | le token Turso |

> ⚠️ Les secrets sont chiffrés côté GitHub et n'apparaissent jamais dans le repo
> public. Ne mets JAMAIS ces valeurs dans le code ni dans un `.env` committé
> (`.env` est gitignored). App Password et token Turso révocables à tout moment.

### 6.4 C'est tout
Le workflow [`.github/workflows/daily.yml`](.github/workflows/daily.yml) tourne chaque
jour à **06:00 UTC** (≈ 08:00 Paris). Il :
1. ingère les nouvelles alertes (IMAP),
2. dédup + stocke les offres dans **Turso**,
3. t'**envoie le digest par e-mail** s'il y a des nouveautés.

Lancement manuel pour tester : onglet **Actions** → *Digest emploi quotidien* →
**Run workflow**. Ajuste l'heure en éditant la ligne `cron`.

---

## 6bis. Alternative — démarrage local (PC allumé)

### Windows — Tâche planifiée « à l'ouverture de session »
1. **Planificateur de tâches** → **Créer une tâche**.
2. Onglet **Déclencheurs** : nouveau → *Au démarrage de la session*.
3. Onglet **Actions** : *Démarrer un programme* :
   - **Programme/script** : `C:\Users\P0ulpy\Documents\GitHub\job-pipeline\.venv\Scripts\python.exe`
   - **Arguments** : `main.py`
   - **Commencer dans** : `C:\Users\P0ulpy\Documents\GitHub\job-pipeline`
4. Enregistre. (L'ouverture auto du digest sera ajoutée en Couche 4bis.)

### Linux/macOS — cron (au login ou horaire)
```cron
0 8 * * * cd /chemin/vers/job-pipeline && ./.venv/bin/python main.py >> cron.log 2>&1
```

---

## 7. Adzuna (complément API — optionnel)

1. Crée un compte développeur Adzuna et une application → récupère `app_id` + `app_key`.
2. Renseigne `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` (+ `ADZUNA_PAYS=fr,ie,nl,gb`) dans `.env`.

> Le client Adzuna est implémenté en **Couche 2bis** (pas encore actif).

---

## 8. Tests

```powershell
pytest -q
```

Couvre : parsing des alertes e-mail (extraction des liens d'offres, exclusion
désabo/footer, dédup des liens de tracking), normalisation d'URL, ingestion IMAP
(client mocké), mapping & dédup France Travail. **Aucun appel réseau ni IMAP réel.**

---

## 9. Limites connues (honnêtes)

- **Parsing best-effort.** Le parser générique ne garde que les liens dont l'URL
  contient un motif d'offre (`/jobs/`, `viewjob`, `/emploi`…). Les liens de
  redirection **opaques** (tracking sans motif) ne sont pas captés tant qu'un
  **parser dédié** par expéditeur n'est pas écrit (Couche 3bis — nécessite de
  vrais e-mails `.eml`).
- **Dédup approximative.** Même offre via 2 alertes = 2 URLs ; on normalise (on
  retire le tracking, on garde l'id type `jk`), mais deux redirections vraiment
  différentes ne fusionnent pas toujours.
- **LinkedIn/Indeed en direct = impossible** légalement ; on passe par leurs alertes.

---

## 10. Structure du projet

```
job-pipeline/
├─ config.py                       # .env : IMAP, labels, Adzuna, FT, quotas, chemins
├─ main.py                         # orchestration : ingest mail → stockage → digest
├─ conftest.py                     # racine projet importable par pytest
├─ requirements.txt
├─ .env.example
├─ src/
│  ├─ sources/email_ingest.py      # connexion IMAP + récup messages non traités par label
│  ├─ sources/email_parser.py      # extraction générique des liens d'offres + normalize_url
│  ├─ sources/france_travail.py    # (dormant) recherche API FT paginée
│  ├─ auth/france_travail_auth.py  # (dormant) OAuth2 FT
│  ├─ storage/models.py            # Offre + from_email / from_france_travail + categorie/pays
│  ├─ storage/db.py                # SQLite : offres (dédup) + processed_emails (idempotence)
│  └─ digest/digest.py             # digest Markdown (groupé par catégorie) + CSV
├─ tests/                          # pytest : parsing mail, normalize, ingest mocké, dédup FT
├─ data/                           # runtime, gitignored → offers.db
└─ output/                         # runtime, gitignored → digest-*.md/.csv
```
