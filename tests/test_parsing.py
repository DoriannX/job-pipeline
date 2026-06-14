"""Tests du mapping `Offre.from_france_travail` et du parsing du Content-Range.

Aucun appel réseau : on lit un échantillon de réponse FT figé dans
`tests/fixtures/france_travail_sample.json`.
"""
import json
from pathlib import Path

from src.sources.france_travail import parse_total_from_content_range
from src.storage.models import Offre

FIXTURE = Path(__file__).parent / "fixtures" / "france_travail_sample.json"


def _charger_resultats() -> list[dict]:
    """Renvoie la liste brute des offres de l'échantillon FT."""
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return data["resultats"]


# --------------------------------------------------------------------------- #
# Offre.from_france_travail
# --------------------------------------------------------------------------- #
def test_mapping_offre_complete():
    """Une offre complète mappe tous les champs vers le modèle pivot."""
    brut = _charger_resultats()[0]
    offre = Offre.from_france_travail(brut)

    assert offre.id == "190FQRT"
    assert offre.intitule == "Développeur Web Full Stack (H/F)"
    assert offre.entreprise == "Acme Software"
    assert offre.lieu == "33 - BORDEAUX"
    assert offre.code_postal == "33000"
    assert offre.type_contrat == "CDI"
    assert offre.nature_contrat == "Contrat travail"
    assert offre.date_creation == "2026-06-10T09:15:00.000Z"
    assert offre.url == "https://candidat.francetravail.fr/offres/recherche/detail/190FQRT"
    assert offre.source == "france_travail"
    # Le payload brut est conservé pour la traçabilité.
    assert json.loads(offre.raw_json)["id"] == "190FQRT"


def test_mapping_champs_imbriques_absents():
    """Si les objets imbriqués manquent, les champs optionnels valent None."""
    brut = _charger_resultats()[1]  # offre minimale : id + intitule seulement
    offre = Offre.from_france_travail(brut)

    assert offre.id == "190FQRU"
    assert offre.intitule == "Développeur Backend Python (H/F)"
    # Aucun bloc entreprise / lieuTravail / origineOffre -> None partout.
    assert offre.entreprise is None
    assert offre.lieu is None
    assert offre.code_postal is None
    assert offre.type_contrat is None
    assert offre.nature_contrat is None
    assert offre.date_creation is None
    assert offre.description is None
    assert offre.url is None


def test_mapping_objets_imbriques_vides():
    """Des objets imbriqués présents mais vides ne lèvent pas d'erreur."""
    brut = _charger_resultats()[2]
    offre = Offre.from_france_travail(brut)

    # `id` numérique converti en chaîne (clé de dédup homogène).
    assert offre.id == "190990012"
    # entreprise = {} -> nom absent -> None ; origineOffre = {} -> url None.
    assert offre.entreprise is None
    assert offre.url is None
    # codePostal absent mais libelle présent.
    assert offre.lieu == "33 - MERIGNAC"
    assert offre.code_postal is None


# --------------------------------------------------------------------------- #
# parse_total_from_content_range
# --------------------------------------------------------------------------- #
def test_content_range_bien_forme():
    """Un en-tête bien formé renvoie le total entier."""
    assert parse_total_from_content_range("offres 0-149/1234") == 1234


def test_content_range_une_seule_page():
    """Cas page unique : total extrait correctement."""
    assert parse_total_from_content_range("offres 0-2/3") == 3


def test_content_range_absent_ou_invalide():
    """En-tête absent, vide ou non parsable -> None (arrêt sûr de la pagination)."""
    assert parse_total_from_content_range(None) is None
    assert parse_total_from_content_range("") is None
    assert parse_total_from_content_range("offres 0-149") is None  # pas de '/'
    assert parse_total_from_content_range("offres 0-149/abc") is None  # total non entier
