# HANDOFF — Pipeline recherche d'emploi (reprise de session)

> Document de reprise. Une nouvelle session Claude Code lancée **depuis ce dossier**
> (`job-pipeline`) doit lire ce fichier en premier pour continuer sans tout re-chercher.
> Mode caveman actif côté utilisateur (réponses ultra-condensées ; le code reste normal).

## 0. PIVOT (2026-06-13) — lire en premier

Le projet a changé de stratégie d'ingestion. **L'idée API-first (France Travail) est
abandonnée comme cœur** car les boards à fort volume (LinkedIn, Indeed) ont *fermé*
leurs APIs publiques et le scraping est interdit (règle projet + ToS).

**Nouveau cœur = ingestion des alertes e-mail.** L'utilisateur active des alertes
job sur tous les sites (LinkedIn, Indeed, HelloWork, WTTJ, Adzuna…). Les sites lui
*envoient eux-mêmes* les nouvelles offres par mail. Le pipeline lit SA boîte Gmail
en IMAP, parse les alertes, dédup en SQLite, et chaque matin (démarrage PC) produit
un digest des nouvelles offres à postuler. **C'est légal : ses propres données reçues,
aucun scraping.** Les alertes sont la porte légale vers LinkedIn/Indeed.

Décisions verrouillées avec l'utilisateur :
- **Auth Gmail** : IMAP + **App Password** (exige 2FA + IMAP activés). Pas d'OAuth.
- **Tri alternance/CDI/pays** : **labels Gmail**. L'utilisateur crée des filtres Gmail
  qui rangent chaque alerte dans un label ; le pipeline lit chaque label → catégorie.
- **Sources API en complément** : **Adzuna** (clé gratuite par e-mail, pas de compte
  France Travail) comme filet structuré fiable à côté du parsing mail (fragile).
- **Hébergement** : **CLOUD — GitHub Actions** (cron quotidien gratuit, marche PC éteint).
  État persisté en re-commitant `state/offers.db` dans un **repo GitHub privé**.
  Secrets (App Password…) dans **GitHub Secrets**. `DB_PATH=state/offers.db` en cloud.
- **Livraison digest** : **e-mail à soi-même** (SMTP Gmail, même App Password). Envoi
  activé par `SEND_EMAIL=true` (workflow), uniquement s'il y a des nouveautés.

Scope : **alternance (FR)** + **CDI (FR + Europe anglophone** : Irlande, Pays-Bas, etc.).
Le pipeline ignore le pays — il avale ce qui arrive ; c'est l'utilisateur qui crée les
alertes avec les bons filtres géo/langue.

## 1. Roadmap (couches) — STOP + accord en fin de chaque couche

| Couche | Contenu | Statut |
|--------|---------|--------|
| **1bis — Ingestion mail MVP** | config IMAP/labels, `email_ingest` (IMAP Gmail), parser générique de liens, `Offre.from_email` + `categorie`/`pays`, dédup par URL normalisée, table `processed_emails`, digest groupé par catégorie, tests mockés | **TERMINÉE — tests verts** |
| **Cloud — GitHub Actions** | `mailer.py` (SMTP envoi digest), `SEND_EMAIL`/`MAIL_TO`/SMTP en config, `.github/workflows/daily.yml` (cron + re-commit `state/offers.db`), `state/.gitkeep` | **TERMINÉE (code) — reste setup repo/secrets par l'utilisateur** |
| 2bis — Adzuna | `sources/adzuna.py` + `Offre.from_adzuna`, clé en `.env`, tests | à faire |
| 3bis — Parsers par expéditeur | parsers dédiés LinkedIn/Indeed/HelloWork/WTTJ à partir de vrais e-mails `.eml` fournis par l'utilisateur | à faire (besoin samples réels) |
| 4bis — Relances | statut candidature + relances >7 j | à faire |

> **Ancienne Couche 1 (API France Travail)** : code écrit, tests verts (11), conservé
> **dormant** (`src/auth/`, `src/sources/france_travail.py`). Réutilisable si compte FT
> créé un jour. Pas le chemin principal.

## 2. Contraintes IMPÉRATIVES (non négociables)

1. **Sources légales uniquement** — alertes e-mail reçues par l'utilisateur + API
   officielles (Adzuna). JAMAIS de scraping LinkedIn/Indeed/WTTJ/APEC, pas de CAPTCHA,
   pas de création de compte automatisée.
2. **Aucune invention d'endpoint/scope/param/sélecteur** — récupérer depuis doc
   officielle / vrais e-mails OU demander. En cas de doute : **TODO explicite**.
3. **Envoi humain par défaut** — le système prépare un digest, l'humain postule.
4. **Secrets via `.env`** — App Password Gmail, clés Adzuna. Rien en dur. `.env.example` fourni.
5. **Boîte mail = données privées** — ne jamais exfiltrer le contenu des mails ailleurs ;
   ne pas modifier l'état lu/non-lu (idempotence via table `processed_emails`).

## 3. Setup manuel attendu de l'utilisateur (prérequis test réel)

1. **Gmail** : activer la 2FA → activer IMAP (Paramètres Gmail → Transfert/POP-IMAP) →
   créer un **App Password** (Compte Google → Sécurité → Mots de passe d'application).
2. **Alertes** : créer des alertes job sur LinkedIn, Indeed, HelloWork, WTTJ, etc.
   (alternance FR ; CDI FR + Irlande/Pays-Bas/autres pays anglophones EU).
3. **Filtres Gmail** : router chaque alerte vers un label, ex. `jobs/alternance`,
   `jobs/cdi-fr`, `jobs/cdi-eu`. Mapping label→catégorie dans `.env` (`EMAIL_LABELS`).
4. **`.env`** : coller `IMAP_USER` (= adresse Gmail), `IMAP_APP_PASSWORD`, `EMAIL_LABELS`.
5. **Adzuna** (Couche 2bis) : créer un compte développeur Adzuna → récupérer
   `app_id` + `app_key` → `.env`.
6. **Laisser les alertes s'accumuler 1-2 jours** puis fournir quelques `.eml` réels
   (un par expéditeur) pour écrire les parsers dédiés (Couche 3bis).

## 4. Faits API déjà vérifiés (ne PAS re-chercher)

- **LinkedIn** : aucune API recherche publique ; scraping interdit. Inaccessible.
- **Indeed** : plus que des API partenaires/employeurs payantes (Sponsored Jobs, Job Sync),
  politique EU payante au 2026-02-01. Pas pour un candidat.
- **Adzuna** : API REST gratuite. `GET https://api.adzuna.com/v1/api/jobs/{pays}/search/{page}`
  avec `app_id` + `app_key` en query. Pays `fr`, `gb`, `nl`, `ie`, etc. Params : `what`
  (mots-clés), `where` (lieu), `results_per_page`, `what_or`, `sort_by`. Réponse JSON,
  offres sous clé `results` ; champs : `id`, `title`, `company.display_name`,
  `location.display_name`, `created`, `redirect_url`, `description`, `contract_type`.
  **TODO** : confirmer limites du tier gratuit (≈ req/jour) et nom exact des champs
  contrat à l'inscription. Ne rien deviner d'autre.
- **Jooble** : API gratuite (clé par inscription, POST). Non retenue pour l'instant.
- **France Travail** (dormant) : token `https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire`,
  base `https://api.francetravail.io/partenaire/offresdemploi/v2`, offres sous `resultats`.
  Codes `natureContrat` alternance non confirmés (laissés vides). Voir git/HANDOFF v1.

### IMAP Gmail (faits)
- Serveur : `imap.gmail.com:993` (SSL). Login = adresse Gmail + App Password.
- Les **labels Gmail apparaissent comme des dossiers IMAP** ; un label imbriqué
  `jobs/alternance` se sélectionne comme mailbox `"jobs/alternance"`.
- Idempotence : on ne marque PAS `\Seen` ; on mémorise les `Message-ID` traités dans
  une table `processed_emails`. Recherche bornée par `SINCE` (EMAIL_LOOKBACK_DAYS).

## 5. Code

Existant (Couche 1 dormante FT) : `config.py`, `main.py`, `conftest.py`,
`src/auth/france_travail_auth.py`, `src/sources/france_travail.py`,
`src/storage/{models,db}.py`, `src/digest/digest.py`, `tests/` (parsing+dedup FT verts).

À écrire/étendre (Couche 1bis) :
```
src/sources/email_ingest.py     # connexion IMAP + récup messages non traités par label
src/sources/email_parser.py     # extraction générique des liens d'offres + normalize_url
src/storage/models.py           # + Offre.from_email, champs categorie/pays, id = URL normalisée
src/storage/db.py               # + colonnes categorie/pays (migration), table processed_emails
src/digest/digest.py            # digest groupé par categorie
config.py / .env.example        # IMAP_*, EMAIL_LABELS, EMAIL_LOOKBACK_DAYS, ADZUNA_*
requirements.txt                # + beautifulsoup4 (parsing HTML des mails)
tests/                          # parse fixture mail synthétique, normalize_url, dedup par URL
```

Convention d'import : rooté racine → `import config`, `from src.x.y import Z`.
`conftest.py` garantit le `sys.path` pour pytest.

## 6. Méthode de travail attendue

- Demander / TODO pour tout point incertain (sélecteur HTML, param API) — **rien inventer**.
- Tests pytest avec **mocks** (pas de réseau, pas d'IMAP réel) + fixtures de mails.
- Gestion d'erreurs + logging. Code **commenté en français**.
- Fin de couche : tests verts, résumé court, **STOP + accord**.

## 7. Notes diverses

- `theodor.xav@gmail.com` est l'adresse présumée pour les alertes (à confirmer dans `.env`).
- **bmad-method** installé dans ce dossier (`_bmad/`, `docs/`, `.claude/skills/`) — d'où
  les `/bmad-*`. Cohabite sans conflit avec le projet Python.
- Mode **caveman** actif (hook session) : assistant condensé ; code/commits/sécurité normaux.
- Dépôt **pas encore git** (`git init` à faire si souhaité).
