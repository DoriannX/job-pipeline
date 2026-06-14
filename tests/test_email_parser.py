"""Tests du parsing des alertes e-mail et de la normalisation d'URL.

Aucun réseau : on lit un e-mail d'alerte figé dans
`tests/fixtures/sample_alert_email.eml`.
"""
import email
from pathlib import Path

from src.sources.email_parser import extract_offres_from_email
from src.storage.models import normalize_url

FIXTURE = Path(__file__).parent / "fixtures" / "sample_alert_email.eml"


def _charger_mail():
    return email.message_from_bytes(FIXTURE.read_bytes())


# --------------------------------------------------------------------------- #
# extract_offres_from_email
# --------------------------------------------------------------------------- #
def test_extraction_garde_les_offres_exclut_le_reste():
    """3 vraies offres extraites ; désabo / préférences / fil exclus."""
    offres = extract_offres_from_email(_charger_mail(), categorie="cdi")

    # LinkedIn (doublon de tracking fusionné), Indeed, HelloWork = 3 uniques.
    assert len(offres) == 3
    # Catégorie propagée depuis le label, source devinée depuis l'expéditeur.
    assert all(o.categorie == "cdi" for o in offres)
    assert all(o.source == "email:linkedin" for o in offres)
    # Identifiants (URL normalisées) tous distincts.
    assert len({o.id for o in offres}) == 3


def test_extraction_dedup_tracking_linkedin():
    """Deux liens LinkedIn vers la même offre (trackers différents) → 1 seule."""
    offres = extract_offres_from_email(_charger_mail())
    ids = {o.id for o in offres}
    assert "https://www.linkedin.com/jobs/view/3911112233" in ids


def test_extraction_indeed_conserve_l_id_jk():
    """L'URL Indeed garde le paramètre `jk` (id) et perd le tracking."""
    offres = extract_offres_from_email(_charger_mail())
    indeed = next(o for o in offres if "indeed" in o.url)
    assert indeed.id == "https://fr.indeed.com/viewjob?jk=abcdef123456"


def test_extraction_titre_generique_remplace():
    """Un libellé générique ('Postuler') est remplacé par un placeholder."""
    offres = extract_offres_from_email(_charger_mail())
    hellowork = next(o for o in offres if "hellowork" in o.url)
    assert hellowork.intitule == "(titre à vérifier sur la page)"


# --------------------------------------------------------------------------- #
# normalize_url
# --------------------------------------------------------------------------- #
def test_normalize_strip_tracking_garde_id():
    """Retire utm_*/from, conserve le paramètre d'identifiant `jk`."""
    url = "https://fr.indeed.com/viewjob?jk=XYZ&from=alert&utm_source=email"
    assert normalize_url(url) == "https://fr.indeed.com/viewjob?jk=XYZ"


def test_normalize_host_minuscule_et_slash_final():
    """Hôte/schéma en minuscule, slash final retiré, query de tracking supprimée."""
    url = "HTTPS://WWW.LinkedIn.com/jobs/view/12345/?trk=abc"
    assert normalize_url(url) == "https://www.linkedin.com/jobs/view/12345"


def test_normalize_sans_query():
    """URL sans paramètre : juste hôte minuscule + chemin sans slash final."""
    assert normalize_url("https://www.hellowork.com/fr-fr/emplois/99.html") == (
        "https://www.hellowork.com/fr-fr/emplois/99.html"
    )
