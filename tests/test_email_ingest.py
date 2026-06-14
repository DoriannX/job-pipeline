"""Tests de l'ingestion IMAP avec un client mocké (aucun réseau, aucune boîte réelle).

Vérifie : extraction des offres d'un label, catégorie propagée, et idempotence
(un mail déjà marqué traité n'est pas ré-ingéré).
"""
import sqlite3
from pathlib import Path

import config
from src.sources import email_ingest
from src.storage import db

FIXTURE = Path(__file__).parent / "fixtures" / "sample_alert_email.eml"


class _FakeIMAP:
    """Client IMAP factice : sert les mails d'un dict {label: [raw_bytes]}."""

    def __init__(self, par_label):
        self._par_label = par_label
        self._courant = None
        self.deconnecte = False

    def select(self, label, readonly=False):
        label = label.strip('"')
        self._courant = label
        return ("OK" if label in self._par_label else "NO", [b"0"])

    def search(self, charset, *criteres):
        n = len(self._par_label.get(self._courant, []))
        nums = b" ".join(str(i + 1).encode() for i in range(n))
        return ("OK", [nums])

    def fetch(self, num, spec):
        i = int(num) - 1
        raw = self._par_label[self._courant][i]
        return ("OK", [(b"meta", raw)])

    def logout(self):
        self.deconnecte = True


def _conn_memoire() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    db.init_db(conn)
    return conn


def test_ingest_extrait_et_categorise(monkeypatch):
    """Les offres d'un label sont extraites avec la bonne catégorie."""
    monkeypatch.setattr(config, "EMAIL_LABELS", [("jobs/cdi", "cdi")])
    fake = _FakeIMAP({"jobs/cdi": [FIXTURE.read_bytes()]})
    conn = _conn_memoire()

    offres, nouveaux_ids = email_ingest.ingest(conn, imap=fake)

    assert len(offres) == 3
    assert all(o.categorie == "cdi" for o in offres)
    assert nouveaux_ids == ["<alert-abc123@linkedin.com>"]
    # imap injecté -> ingest ne doit PAS le fermer (l'appelant le possède).
    assert fake.deconnecte is False

    conn.close()


def test_ingest_idempotent(monkeypatch):
    """Un mail déjà marqué traité n'est pas ré-ingéré au passage suivant."""
    monkeypatch.setattr(config, "EMAIL_LABELS", [("jobs/cdi", "cdi")])
    fake = _FakeIMAP({"jobs/cdi": [FIXTURE.read_bytes()]})
    conn = _conn_memoire()

    _, ids_1 = email_ingest.ingest(conn, imap=fake)
    for message_id in ids_1:
        db.mark_email_processed(conn, message_id)

    offres_2, ids_2 = email_ingest.ingest(conn, imap=fake)
    assert offres_2 == []
    assert ids_2 == []

    conn.close()


def test_ingest_label_absent(monkeypatch):
    """Un label introuvable est ignoré sans erreur."""
    monkeypatch.setattr(config, "EMAIL_LABELS", [("jobs/inexistant", "cdi")])
    fake = _FakeIMAP({"jobs/cdi": [FIXTURE.read_bytes()]})
    conn = _conn_memoire()

    offres, ids = email_ingest.ingest(conn, imap=fake)
    assert offres == []
    assert ids == []

    conn.close()
