"""Extraction générique des offres depuis une alerte e-mail (HTML).

Best-effort et SANS réseau : on lit le corps HTML du mail, on repère les liens
qui ressemblent à des offres d'emploi, on en fait des `Offre`. Les templates
diffèrent par expéditeur et changent dans le temps → parsing approximatif,
affiné par des parsers dédiés en Couche 3bis (sur de vrais `.eml`).
"""
import logging
import re
from email.message import Message

from bs4 import BeautifulSoup

from src.storage.models import Offre, normalize_url

logger = logging.getLogger(__name__)

# Indices, dans l'URL, qu'un lien pointe vers une offre. Le parser générique se
# fie UNIQUEMENT à ces motifs (haute précision, faible bruit) ; les liens de
# redirection opaques sans motif reconnu sont traités par les parsers dédiés
# par expéditeur (Couche 3bis).
_JOB_URL_HINTS = (
    "/jobs/view", "/jobs/", "/job/", "viewjob", "jobid=", "jk=",
    "/offre", "/offres", "/emploi", "/emplois", "/annonce", "/postuler",
    "/vacancy", "/vacatures", "/stelle", "/career", "/careers",
)
# Liens à exclure (pieds de page, gestion du compte, désabonnement…).
_EXCLUDE_HINTS = (
    "unsubscribe", "désabonn", "desabonn", "optout", "opt-out", "/settings",
    "/preferences", "/help", "/privacy", "/legal", "/account", "manage",
    "mailto:",
)
# Libellés trop génériques pour servir d'intitulé.
_GENERIC_ANCHORS = {
    "postuler", "apply", "apply now", "voir l'offre", "voir loffre",
    "voir plus", "see job", "view job", "en savoir plus", "détails", "details",
}
_PLACEHOLDER_TITRE = "(titre à vérifier sur la page)"


def _html_body(msg: Message) -> str:
    """Renvoie le corps HTML du mail (ou, à défaut, le texte brut)."""
    if msg.is_multipart():
        html = texte = None
        for part in msg.walk():
            if part.get_content_disposition() == "attachment":
                continue
            payload = part.get_payload(decode=True)
            if payload is None:
                continue
            charset = part.get_content_charset() or "utf-8"
            try:
                contenu = payload.decode(charset, errors="replace")
            except LookupError:
                contenu = payload.decode("utf-8", errors="replace")
            ctype = part.get_content_type()
            if ctype == "text/html" and html is None:
                html = contenu
            elif ctype == "text/plain" and texte is None:
                texte = contenu
        return html or texte or ""

    payload = msg.get_payload(decode=True)
    if payload is None:
        brut = msg.get_payload()
        return brut if isinstance(brut, str) else ""
    charset = msg.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except LookupError:
        return payload.decode("utf-8", errors="replace")


def _source_from_sender(msg: Message) -> str:
    """Devine la source à partir du domaine de l'expéditeur (ex. "email:linkedin")."""
    correspondance = re.search(r"@([\w.-]+)", msg.get("From", "") or "")
    host = correspondance.group(1).lower() if correspondance else ""
    for cle in (
        "linkedin", "indeed", "hellowork", "welcometothejungle", "wttj",
        "adzuna", "apec", "jobteaser", "glassdoor", "monster",
    ):
        if cle in host:
            return f"email:{cle}"
    return "email"


def _looks_like_job(href: str) -> bool:
    """Heuristique : ce lien pointe-t-il vers une offre d'emploi ?"""
    bas = href.lower()
    if not bas.startswith("http"):
        return False
    if any(x in bas for x in _EXCLUDE_HINTS):
        return False
    return any(x in bas for x in _JOB_URL_HINTS)


def extract_offres_from_email(
    msg: Message,
    categorie: str | None = None,
    pays: str | None = None,
) -> list[Offre]:
    """Extrait les offres d'un e-mail d'alerte. Dédup interne par URL normalisée."""
    source = _source_from_sender(msg)
    body = _html_body(msg)

    if "<a" in body.lower() or "<html" in body.lower():
        soup = BeautifulSoup(body, "html.parser")
        liens = [(a.get("href", ""), a.get_text(" ", strip=True)) for a in soup.find_all("a")]
    else:
        # Corps en texte brut : on récupère les URLs nues (sans intitulé).
        liens = [(u, "") for u in re.findall(r"https?://\S+", body)]

    offres: list[Offre] = []
    vus: set[str] = set()
    for href, libelle in liens:
        href = (href or "").strip()
        libelle = (libelle or "").strip()
        if not href or not _looks_like_job(href):
            continue
        cle = normalize_url(href)
        if cle in vus:
            continue
        vus.add(cle)
        titre = libelle if libelle and libelle.lower() not in _GENERIC_ANCHORS else _PLACEHOLDER_TITRE
        offres.append(
            Offre.from_email(
                url=href,
                intitule=titre,
                source=source,
                categorie=categorie,
                pays=pays,
            )
        )

    logger.info("%d offre(s) extraite(s) d'un mail (%s).", len(offres), source)
    return offres
