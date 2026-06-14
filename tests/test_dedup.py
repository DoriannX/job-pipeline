"""Tests de déduplication, à deux niveaux et SANS réseau :

1. Stockage SQLite (`:memory:`) : un même `id` réinséré ne crée pas de doublon.
2. Source France Travail : `search_all` agrège plusieurs mots-clés et déduplique
   par `id`, avec une session HTTP factice (aucun appel réseau réel).
"""
import sqlite3

import config
from src.sources.france_travail import FranceTravailSource
from src.storage import db
from src.storage.models import Offre


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _conn_memoire() -> sqlite3.Connection:
    """Connexion SQLite en mémoire, schéma initialisé."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    db.init_db(conn)
    return conn


def _offre(id_: str, intitule: str = "Dev") -> Offre:
    """Construit une Offre minimale pour les tests."""
    return Offre(
        id=id_,
        intitule=intitule,
        entreprise=None,
        lieu=None,
        code_postal=None,
        type_contrat="CDI",
        nature_contrat=None,
        date_creation="2026-06-13",
        description=None,
        url=None,
    )


# --------------------------------------------------------------------------- #
# Déduplication au niveau SQLite
# --------------------------------------------------------------------------- #
def test_insert_ignore_les_doublons():
    """Réinsérer la même offre ne crée pas de seconde ligne."""
    conn = _conn_memoire()
    offres = [_offre("A1"), _offre("A2")]

    nouvelles_1 = db.insert_offres(conn, offres, today="2026-06-13")
    assert nouvelles_1 == 2  # 2 offres insérées au 1er passage

    # 2e passage avec les MÊMES ids -> aucune nouvelle, total inchangé.
    nouvelles_2 = db.insert_offres(conn, offres, today="2026-06-14")
    assert nouvelles_2 == 0
    assert db.count_offres(conn) == 2

    conn.close()


def test_insert_compte_seulement_les_nouvelles():
    """Un lot mêlant connues et inédites ne compte que les inédites."""
    conn = _conn_memoire()
    db.insert_offres(conn, [_offre("A1")], today="2026-06-13")

    # A1 déjà connue, B1 nouvelle -> 1 seule nouvelle.
    nouvelles = db.insert_offres(conn, [_offre("A1"), _offre("B1")], today="2026-06-14")
    assert nouvelles == 1
    assert db.count_offres(conn) == 2

    conn.close()


def test_get_offres_since_filtre_par_date():
    """`get_offres_since` ne renvoie que les offres détectées ce jour-là.

    `first_seen` est figé à la 1re détection : une offre revue plus tard
    n'est PAS reclassée à la nouvelle date.
    """
    conn = _conn_memoire()
    db.insert_offres(conn, [_offre("A1")], today="2026-06-13")
    db.insert_offres(conn, [_offre("A1"), _offre("B1")], today="2026-06-14")

    jour_1 = db.get_offres_since(conn, "2026-06-13")
    jour_2 = db.get_offres_since(conn, "2026-06-14")

    assert {r["id"] for r in jour_1} == {"A1"}
    assert {r["id"] for r in jour_2} == {"B1"}  # A1 garde son first_seen du 13

    conn.close()


# --------------------------------------------------------------------------- #
# Déduplication au niveau source (API mockée)
# --------------------------------------------------------------------------- #
class _FakeResponse:
    """Réponse HTTP factice minimale pour FranceTravailSource."""

    def __init__(self, resultats, total):
        self.status_code = 200
        self._resultats = resultats
        self.headers = {"Content-Range": f"offres 0-{len(resultats)}/{total}"}

    def json(self):
        return {"resultats": self._resultats}


class _FakeSession:
    """Session factice : renvoie toujours le même jeu d'offres, compte les appels."""

    def __init__(self, resultats):
        self._resultats = resultats
        self.calls = 0

    def get(self, url, params=None, headers=None, timeout=None):
        self.calls += 1
        return _FakeResponse(self._resultats, total=len(self._resultats))


class _FakeAuth:
    """Auth factice : pas de réseau, en-tête vide."""

    def auth_header(self):
        return {}


def test_search_all_dedup_entre_mots_cles(monkeypatch):
    """Le même id renvoyé pour 2 mots-clés n'apparaît qu'une fois."""
    # Deux mots-clés, throttle désactivé pour un test rapide.
    monkeypatch.setattr(config, "MOTS_CLES", ["python", "java"])
    monkeypatch.setattr(config, "MAX_REQ_PER_SEC", 0)

    # Les deux recherches renvoient les mêmes ids (1 commun, donc chevauchement).
    resultats = [{"id": "X1", "intitule": "Dev Python"}, {"id": "X2", "intitule": "Dev Java"}]
    session = _FakeSession(resultats)
    source = FranceTravailSource(_FakeAuth(), session=session)

    bruts = source.search_all()

    # 2 mots-clés interrogés -> 2 appels, mais résultat dédupliqué à 2 offres.
    assert session.calls == 2
    assert {o["id"] for o in bruts} == {"X1", "X2"}
    assert len(bruts) == 2
