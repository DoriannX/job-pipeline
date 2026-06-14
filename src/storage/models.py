"""Modèle de données normalisé d'une offre d'emploi.

`Offre` est le format pivot stocké en base, indépendant de la source. Chaque
source fournit une fabrique `from_*` qui mappe sa structure brute vers ce pivot.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# Paramètres de requête qui PORTENT un identifiant d'offre (à conserver lors de
# la normalisation). Le reste (utm_*, trk, tracking divers) est retiré.
_ID_QUERY_PARAMS = {"jk", "currentjobid", "id", "offerid", "jobid", "joboffer"}


def normalize_url(url: str) -> str:
    """Normalise une URL d'offre pour servir de clé de déduplication.

    Stratégie best-effort : minuscule schéma + hôte, chemin sans slash final,
    on ne garde que les paramètres porteurs d'identifiant (ex. `jk` pour Indeed),
    on retire le tracking. NE collapse PAS deux liens de redirection différents
    pointant vers la même offre (limite connue — voir HANDOFF).
    """
    parts = urlsplit(url.strip())
    scheme = (parts.scheme or "https").lower()
    netloc = parts.netloc.lower()
    query = sorted(
        (k, v) for k, v in parse_qsl(parts.query) if k.lower() in _ID_QUERY_PARAMS
    )
    path = parts.path.rstrip("/")
    return urlunsplit((scheme, netloc, path, urlencode(query), ""))


@dataclass
class Offre:
    """Offre normalisée, commune à toutes les sources."""

    id: str                      # identifiant unique de l'offre (clé de dédup)
    intitule: str                # intitulé du poste
    entreprise: str | None       # nom de l'entreprise (si communiqué)
    lieu: str | None             # libellé du lieu de travail
    code_postal: str | None      # code postal du lieu
    type_contrat: str | None     # ex. CDI, CDD...
    nature_contrat: str | None   # ex. alternance (apprentissage/pro)
    date_creation: str | None    # date de création (ISO, telle que renvoyée)
    description: str | None       # description du poste
    url: str | None              # URL d'origine de l'offre
    source: str = "france_travail"  # source d'origine
    raw_json: str | None = None  # payload brut sérialisé (traçabilité)
    categorie: str | None = None  # ex. alternance, cdi (issu du label Gmail)
    pays: str | None = None       # ex. fr, ie, nl (utile pour les CDI hors FR)

    @classmethod
    def from_france_travail(cls, raw: dict) -> "Offre":
        """Construit une `Offre` depuis un objet brut de l'API Offres v2.

        Les clés imbriquées peuvent être absentes selon les offres : on protège
        chaque accès pour ne jamais lever de KeyError sur un champ optionnel.
        Le seul champ obligatoire est `id` (identifiant de l'offre).
        """
        entreprise = (raw.get("entreprise") or {}).get("nom")
        lieu_travail = raw.get("lieuTravail") or {}
        origine = raw.get("origineOffre") or {}

        return cls(
            id=str(raw["id"]),
            intitule=raw.get("intitule", ""),
            entreprise=entreprise,
            lieu=lieu_travail.get("libelle"),
            code_postal=lieu_travail.get("codePostal"),
            type_contrat=raw.get("typeContrat"),
            nature_contrat=raw.get("natureContrat"),
            date_creation=raw.get("dateCreation"),
            description=raw.get("description"),
            url=origine.get("urlOrigine"),
            source="france_travail",
            raw_json=json.dumps(raw, ensure_ascii=False),
        )

    @classmethod
    def from_email(
        cls,
        *,
        url: str,
        intitule: str,
        entreprise: str | None = None,
        lieu: str | None = None,
        categorie: str | None = None,
        pays: str | None = None,
        date_creation: str | None = None,
        source: str = "email",
        raw: str | None = None,
    ) -> "Offre":
        """Construit une `Offre` depuis un lien extrait d'une alerte e-mail.

        L'identifiant de dédup est l'URL normalisée (pas d'id stable fourni par
        les alertes). `source` peut préciser l'expéditeur (ex. "email:linkedin").
        """
        return cls(
            id=normalize_url(url),
            intitule=intitule or "",
            entreprise=entreprise,
            lieu=lieu,
            code_postal=None,
            type_contrat=None,
            nature_contrat=None,
            date_creation=date_creation,
            description=None,
            url=url,
            source=source,
            raw_json=raw,
            categorie=categorie,
            pays=pays,
        )

    def as_row(self) -> dict:
        """Représentation dict prête pour l'insertion SQLite."""
        return asdict(self)
