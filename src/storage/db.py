"""Stockage SQLite des offres + déduplication par identifiant.

La table `offres` utilise `id` comme clé primaire : un `INSERT OR IGNORE`
ignore silencieusement une offre déjà connue (déduplication). La colonne
`first_seen` enregistre la date de première détection, ce qui permet au digest
de ne lister que les nouveautés du jour.
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


def connect(db_path=None) -> sqlite3.Connection:
    """Ouvre (et crée si besoin) la base SQLite, lignes accessibles par nom."""
    path = db_path or config.DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    """Crée les tables et l'index s'ils n'existent pas, puis migre si besoin."""
    conn.execute(_CREATE_TABLE)
    conn.execute(_CREATE_INDEX)
    conn.execute(_CREATE_PROCESSED)
    _ensure_columns(conn)
    conn.commit()


def _ensure_columns(conn: sqlite3.Connection) -> None:
    """Ajoute les colonnes manquantes sur une base déjà existante (migration douce)."""
    existantes = {row["name"] for row in conn.execute("PRAGMA table_info(offres)")}
    for colonne, sql in _MIGRATIONS.items():
        if colonne not in existantes:
            logger.info("Migration base : ajout de la colonne %s.", colonne)
            conn.execute(sql)


def insert_offres(
    conn: sqlite3.Connection,
    offres: list[Offre],
    today: str | None = None,
) -> int:
    """Insère les offres en ignorant les doublons (par `id`).

    Renvoie le nombre de NOUVELLES offres réellement insérées. Les offres déjà
    présentes sont ignorées (leur `first_seen` d'origine est conservé).
    """
    today = today or date.today().isoformat()
    placeholders = ", ".join("?" for _ in _COLUMNS)
    sql = f"INSERT OR IGNORE INTO offres ({', '.join(_COLUMNS)}) VALUES ({placeholders})"

    new_count = 0
    for offre in offres:
        row = offre.as_row()
        row["first_seen"] = today
        values = [row.get(col) for col in _COLUMNS]
        cursor = conn.execute(sql, values)
        # rowcount = 1 si insérée, 0 si ignorée (doublon).
        if cursor.rowcount > 0:
            new_count += 1
    conn.commit()
    logger.info(
        "%d offres reçues, %d nouvelles insérées (le reste = doublons).",
        len(offres),
        new_count,
    )
    return new_count


def get_offres_since(conn: sqlite3.Connection, day: str) -> list[sqlite3.Row]:
    """Renvoie les offres détectées pour la première fois à la date `day`."""
    cursor = conn.execute(
        "SELECT * FROM offres WHERE first_seen = ? ORDER BY date_creation DESC",
        (day,),
    )
    return cursor.fetchall()


def count_offres(conn: sqlite3.Connection) -> int:
    """Nombre total d'offres stockées (utile pour le résumé / les tests)."""
    return conn.execute("SELECT COUNT(*) FROM offres").fetchone()[0]


# --------------------------------------------------------------------------- #
# Suivi des e-mails traités (idempotence de l'ingestion IMAP)
# --------------------------------------------------------------------------- #
def get_processed_email_ids(conn: sqlite3.Connection) -> set[str]:
    """Renvoie l'ensemble des Message-ID d'e-mails déjà traités."""
    return {row["message_id"] for row in conn.execute("SELECT message_id FROM processed_emails")}


def mark_email_processed(
    conn: sqlite3.Connection,
    message_id: str,
    when: str | None = None,
) -> None:
    """Marque un e-mail comme traité (ignore les doublons)."""
    when = when or date.today().isoformat()
    conn.execute(
        "INSERT OR IGNORE INTO processed_emails (message_id, processed_at) VALUES (?, ?)",
        (message_id, when),
    )
    conn.commit()
