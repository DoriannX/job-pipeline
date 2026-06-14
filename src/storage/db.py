"""Stockage des offres + déduplication par identifiant.

Backend double, même SQL (Turso = SQLite compatible) :
- local / tests : SQLite (fichier ou `:memory:`),
- cloud : Turso (libSQL) en remote-only si `TURSO_DATABASE_URL` est défini.

La table `offres` utilise `id` comme clé primaire ; un `INSERT OR IGNORE` ignore
silencieusement une offre déjà connue (déduplication). La colonne `first_seen`
enregistre la date de première détection (digest des nouveautés du jour). La table
`processed_emails` garantit l'idempotence de l'ingestion IMAP.
"""
import logging
import sqlite3
from datetime import date

import config
from src.storage.models import Offre

logger = logging.getLogger(__name__)

# Colonnes persistées (ordre = ordre d'insertion).
_COLUMNS = [
    "id",
    "intitule",
    "entreprise",
    "lieu",
    "code_postal",
    "type_contrat",
    "nature_contrat",
    "date_creation",
    "description",
    "url",
    "source",
    "raw_json",
    "categorie",
    "pays",
    "first_seen",
]

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS offres (
    id             TEXT PRIMARY KEY,
    intitule       TEXT NOT NULL,
    entreprise     TEXT,
    lieu           TEXT,
    code_postal    TEXT,
    type_contrat   TEXT,
    nature_contrat TEXT,
    date_creation  TEXT,
    description    TEXT,
    url            TEXT,
    source         TEXT NOT NULL,
    raw_json       TEXT,
    categorie      TEXT,
    pays           TEXT,
    first_seen     TEXT NOT NULL
);
"""

# Index pour accélérer la sélection des nouveautés par date.
_CREATE_INDEX = (
    "CREATE INDEX IF NOT EXISTS idx_offres_first_seen ON offres(first_seen);"
)

# Mémorise les e-mails déjà traités (par Message-ID) pour rester idempotent sans
# toucher à l'état lu/non-lu de la boîte mail.
_CREATE_PROCESSED = """
CREATE TABLE IF NOT EXISTS processed_emails (
    message_id   TEXT PRIMARY KEY,
    processed_at TEXT NOT NULL
);
"""

# Colonnes susceptibles de manquer dans une base créée avant l'ajout du mail.
_MIGRATIONS = {
    "categorie": "ALTER TABLE offres ADD COLUMN categorie TEXT;",
    "pays": "ALTER TABLE offres ADD COLUMN pays TEXT;",
}


def _import_libsql():
    """Importe le client libSQL (nom de package récent puis ancien en repli)."""
    try:
        import libsql
        return libsql
    except ImportError:
        import libsql_experimental as libsql
        return libsql


def connect(db_path=None):
    """Ouvre la base : Turso (remote libSQL) si configuré, sinon SQLite local."""
    if config.TURSO_DATABASE_URL:
        libsql = _import_libsql()
        logger.info("Connexion Turso (remote libSQL).")
        return libsql.connect(
            database=config.TURSO_DATABASE_URL,
            auth_token=config.TURSO_AUTH_TOKEN,
        )
    path = db_path or config.DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def _query(conn, sql: str, params=()) -> list[dict]:
    """Exécute un SELECT et renvoie une liste de dict (compatible SQLite + libSQL).

    libSQL n'implémente pas `row_factory` : on reconstruit les dict à partir de
    `cursor.description`. Marche aussi pour SQLite (les `Row` sont indexables).
    """
    cur = conn.execute(sql, params)
    colonnes = [d[0] for d in cur.description]
    return [dict(zip(colonnes, ligne)) for ligne in cur.fetchall()]


def init_db(conn) -> None:
    """Crée les tables et l'index s'ils n'existent pas, puis migre si besoin."""
    conn.execute(_CREATE_TABLE)
    conn.execute(_CREATE_INDEX)
    conn.execute(_CREATE_PROCESSED)
    _ensure_columns(conn)
    conn.commit()


def _ensure_columns(conn) -> None:
    """Ajoute les colonnes manquantes sur une base déjà existante (migration douce)."""
    try:
        existantes = {r["name"] for r in _query(conn, "PRAGMA table_info(offres)")}
    except Exception as exc:  # noqa: BLE001 — PRAGMA indispo : table neuve = schéma complet
        logger.debug("PRAGMA table_info indisponible (%s) — migration ignorée.", exc)
        return
    for colonne, sql in _MIGRATIONS.items():
        if colonne not in existantes:
            logger.info("Migration base : ajout de la colonne %s.", colonne)
            conn.execute(sql)


def insert_offres(conn, offres: list[Offre], today: str | None = None) -> int:
    """Insère les offres en ignorant les doublons (par `id`).

    Renvoie le nombre de NOUVELLES offres insérées, calculé par différence de
    total (robuste quel que soit le backend, sans dépendre de `rowcount`).
    """
    today = today or date.today().isoformat()
    placeholders = ", ".join("?" for _ in _COLUMNS)
    sql = f"INSERT OR IGNORE INTO offres ({', '.join(_COLUMNS)}) VALUES ({placeholders})"

    avant = count_offres(conn)
    for offre in offres:
        row = offre.as_row()
        row["first_seen"] = today
        conn.execute(sql, [row.get(col) for col in _COLUMNS])
    conn.commit()
    new_count = count_offres(conn) - avant

    logger.info(
        "%d offres reçues, %d nouvelles insérées (le reste = doublons).",
        len(offres),
        new_count,
    )
    return new_count


def get_offres_since(conn, day: str) -> list[dict]:
    """Renvoie les offres détectées pour la première fois à la date `day`."""
    return _query(
        conn,
        "SELECT * FROM offres WHERE first_seen = ? ORDER BY date_creation DESC",
        (day,),
    )


def count_offres(conn) -> int:
    """Nombre total d'offres stockées (utile pour le résumé / les tests)."""
    return _query(conn, "SELECT COUNT(*) AS n FROM offres")[0]["n"]


# --------------------------------------------------------------------------- #
# Suivi des e-mails traités (idempotence de l'ingestion IMAP)
# --------------------------------------------------------------------------- #
def get_processed_email_ids(conn) -> set[str]:
    """Renvoie l'ensemble des Message-ID d'e-mails déjà traités."""
    return {r["message_id"] for r in _query(conn, "SELECT message_id FROM processed_emails")}


def mark_email_processed(conn, message_id: str, when: str | None = None) -> None:
    """Marque un e-mail comme traité (ignore les doublons)."""
    when = when or date.today().isoformat()
    conn.execute(
        "INSERT OR IGNORE INTO processed_emails (message_id, processed_at) VALUES (?, ?)",
        (message_id, when),
    )
    conn.commit()
