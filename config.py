"""Configuration centrale du pipeline.

Charge les variables d'environnement depuis `.env` (jamais de secret en dur)
et expose les constantes utilisées par tous les modules : endpoints France
Travail, filtres de recherche, quotas réseau et chemins de fichiers.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Racine du projet = dossier contenant ce fichier.
BASE_DIR = Path(__file__).resolve().parent
# Charge le `.env` situé à la racine si présent (sinon on lit l'environnement).
load_dotenv(BASE_DIR / ".env")


# --------------------------------------------------------------------------- #
# Identifiants API France Travail
# Ils proviennent EXCLUSIVEMENT de `.env` — aucune valeur en dur ici.
# --------------------------------------------------------------------------- #
FT_CLIENT_ID = os.getenv("FT_CLIENT_ID", "")
FT_CLIENT_SECRET = os.getenv("FT_CLIENT_SECRET", "")


# --------------------------------------------------------------------------- #
# Endpoints France Travail (API « Offres d'emploi v2 »)
# Valeurs vérifiées sur la documentation officielle francetravail.io.
# --------------------------------------------------------------------------- #
# URL d'obtention du token OAuth2 (realm "partenaire").
FT_TOKEN_URL = (
    "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire"
)
# Base de l'API Offres d'emploi v2.
FT_API_BASE = "https://api.francetravail.io/partenaire/offresdemploi/v2"
# Endpoint de recherche d'offres.
FT_SEARCH_URL = f"{FT_API_BASE}/offres/search"

# Scopes OAuth2 demandés lors du client_credentials.
# Valeur courante documentée. Surchargeable via .env car elle PEUT différer
# selon l'application déclarée sur francetravail.io.
# TODO(API): vérifier les scopes exacts affichés dans TON application FT et
#            ajuster FT_SCOPE dans `.env` si besoin. Ne rien deviner d'autre.
FT_SCOPE = os.getenv("FT_SCOPE", "api_offresdemploiv2 o2dsoffre")


# --------------------------------------------------------------------------- #
# Filtres de recherche (À PERSONNALISER — surchargeables via .env)
# --------------------------------------------------------------------------- #
# Mots-clés "filet large" pour les métiers du développement.
# Une recherche distincte est lancée par mot-clé, puis les résultats sont
# dédupliqués par identifiant d'offre (sémantique multi-mots-clés de l'API
# non documentée de façon certaine -> on évite de la deviner).
MOTS_CLES = [
    m.strip()
    for m in os.getenv(
        "MOTS_CLES",
        "développeur,développeuse,développement,logiciel,software,"
        "web,backend,frontend,fullstack",
    ).split(",")
    if m.strip()
]

# Département ciblé (Gironde par défaut). Paramètre `departement` de l'API.
DEPARTEMENT = os.getenv("DEPARTEMENT", "33")

# Types de contrat (codes France Travail). "CDI" est confirmé.
TYPE_CONTRATS = [
    c.strip() for c in os.getenv("TYPE_CONTRATS", "CDI").split(",") if c.strip()
]

# Codes `natureContrat` pour l'alternance (apprentissage / professionnalisation).
# TODO(API): les codes EXACTS ne sont pas connus de façon certaine. Les récupérer
#            depuis le référentiel officiel France Travail (voir README, section
#            "TODO API"). Tant que cette liste est vide, la recherche FT ne filtre
#            QUE sur TYPE_CONTRATS ci-dessus. La source dédiée à l'alternance
#            (La Bonne Alternance) arrive en Couche 2.
NATURE_CONTRATS_ALTERNANCE = [
    c.strip()
    for c in os.getenv("NATURE_CONTRATS_ALTERNANCE", "").split(",")
    if c.strip()
]


# --------------------------------------------------------------------------- #
# Ingestion e-mail (alertes job → IMAP Gmail)
# Cœur du pipeline : on lit les alertes reçues, on ne scrape rien.
# --------------------------------------------------------------------------- #
# Serveur IMAP (Gmail par défaut). Login = adresse Gmail + App Password.
IMAP_HOST = os.getenv("IMAP_HOST", "imap.gmail.com")
IMAP_PORT = int(os.getenv("IMAP_PORT", "993"))
IMAP_USER = os.getenv("IMAP_USER", "")
# App Password Google (PAS le mot de passe du compte). Exige 2FA + IMAP activés.
IMAP_APP_PASSWORD = os.getenv("IMAP_APP_PASSWORD", "")


def _parse_email_labels(raw: str) -> list[tuple[str, str]]:
    """Parse `EMAIL_LABELS` : "label:categorie,label2:categorie2".

    Chaque entrée associe un label Gmail (= dossier IMAP) à une catégorie
    (`alternance`, `cdi`...). Une entrée sans `:` prend la catégorie "autre".
    Renvoie une liste de tuples (label, categorie) ; les labels vides sont ignorés.
    """
    paires: list[tuple[str, str]] = []
    for bloc in raw.split(","):
        bloc = bloc.strip()
        if not bloc:
            continue
        if ":" in bloc:
            label, categorie = bloc.split(":", 1)
            label, categorie = label.strip(), categorie.strip() or "autre"
        else:
            label, categorie = bloc, "autre"
        if label:
            paires.append((label, categorie))
    return paires


# Mapping label Gmail → catégorie. Défaut = INBOX non catégorisée.
# Exemple .env : EMAIL_LABELS=jobs/alternance:alternance,jobs/cdi-fr:cdi,jobs/cdi-eu:cdi
EMAIL_LABELS = _parse_email_labels(os.getenv("EMAIL_LABELS", "INBOX:autre"))

# Fenêtre de recherche IMAP (jours) — borne la commande SINCE pour ne pas tout relire.
EMAIL_LOOKBACK_DAYS = int(os.getenv("EMAIL_LOOKBACK_DAYS", "7"))


# --------------------------------------------------------------------------- #
# Envoi du digest par e-mail (SMTP) — pour recevoir les offres PC éteint (cloud)
# Réutilise l'App Password Gmail (IMAP_APP_PASSWORD fonctionne aussi en SMTP).
# --------------------------------------------------------------------------- #
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))  # SSL implicite
# Destinataire du digest (par défaut : soi-même).
MAIL_TO = os.getenv("MAIL_TO", "") or IMAP_USER
# Envoi activé ? Off par défaut en local ; mis à "true" par le workflow cloud.
SEND_EMAIL = os.getenv("SEND_EMAIL", "false").strip().lower() in ("1", "true", "yes", "on")


# --------------------------------------------------------------------------- #
# Adzuna (API agrégateur officielle — complément structuré, Couche 2bis)
# Identifiants EXCLUSIVEMENT depuis `.env`.
# --------------------------------------------------------------------------- #
ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID", "")
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY", "")
# Base documentée. {pays} ∈ fr, gb, nl, ie, de... ; page ajoutée à l'appel.
ADZUNA_API_BASE = "https://api.adzuna.com/v1/api/jobs"
# Pays interrogés (codes Adzuna). FR + Europe anglophone pour les CDI.
ADZUNA_PAYS = [
    p.strip() for p in os.getenv("ADZUNA_PAYS", "fr").split(",") if p.strip()
]


# --------------------------------------------------------------------------- #
# Quotas / réseau
# --------------------------------------------------------------------------- #
# Quota documenté : ~4 requêtes / seconde / application.
MAX_REQ_PER_SEC = float(os.getenv("MAX_REQ_PER_SEC", "4"))
# Taille de page maximale autorisée par l'API (paramètre `range`).
PAGE_SIZE = 150
# Borne supérieure de pagination (premier index max = 1000 côté API).
MAX_OFFERS = int(os.getenv("MAX_OFFERS", "1000"))
HTTP_TIMEOUT = 30  # secondes
MAX_RETRIES = 4    # tentatives sur 429 / 5xx


# --------------------------------------------------------------------------- #
# Base cloud Turso (libSQL) — pour le mode cloud (repo public, état hors repo)
# Si TURSO_DATABASE_URL est défini : connexion remote-only (HTTP, pas de fichier).
# Sinon : SQLite local (DB_PATH ci-dessous). Les tests utilisent toujours SQLite.
# --------------------------------------------------------------------------- #
TURSO_DATABASE_URL = os.getenv("TURSO_DATABASE_URL", "")
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN", "")


# --------------------------------------------------------------------------- #
# Chemins de fichiers
# --------------------------------------------------------------------------- #
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
DB_PATH = Path(os.getenv("DB_PATH", str(DATA_DIR / "offers.db")))
