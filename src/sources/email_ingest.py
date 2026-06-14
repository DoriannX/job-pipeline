"""Ingestion des alertes e-mail via IMAP (Gmail).

Se connecte à la boîte, lit les messages de chaque label configuré (mapping
label → catégorie), extrait les offres et les renvoie. Idempotent : les
Message-ID déjà traités sont mémorisés en base (table `processed_emails`), et
on ne modifie PAS l'état lu/non-lu de la boîte (sélection IMAP en readonly).
"""
import email
import imaplib
import logging
from datetime import date, timedelta
from email.message import Message

import config
from src.sources.email_parser import extract_offres_from_email
from src.storage import db

logger = logging.getLogger(__name__)


def connect_imap(host=None, port=None, user=None, password=None) -> imaplib.IMAP4_SSL:
    """Ouvre une connexion IMAP SSL et s'authentifie (App Password Gmail)."""
    host = host or config.IMAP_HOST
    port = port or config.IMAP_PORT
    user = user or config.IMAP_USER
    password = password or config.IMAP_APP_PASSWORD
    if not user or not password:
        raise ValueError(
            "IMAP_USER / IMAP_APP_PASSWORD manquants. Renseigne ton adresse Gmail "
            "et un App Password (2FA + IMAP activés) dans .env."
        )
    imap = imaplib.IMAP4_SSL(host, port)
    imap.login(user, password)
    return imap


def _since_criterion(lookback_days: int) -> str:
    """Critère IMAP `SINCE` au format attendu (ex. 06-Jun-2026)."""
    depuis = date.today() - timedelta(days=lookback_days)
    return depuis.strftime("%d-%b-%Y")


def fetch_messages(imap, label: str, since: str) -> list[tuple[str, Message]]:
    """Renvoie [(message_id, Message)] d'un label, bornés par `SINCE`.

    Sélection en lecture seule (readonly=True) pour ne pas marquer les mails lus.
    """
    statut, _ = imap.select(f'"{label}"', readonly=True)
    if statut != "OK":
        logger.warning("Label IMAP introuvable ou inaccessible : %r — ignoré.", label)
        return []

    statut, data = imap.search(None, "SINCE", since)
    if statut != "OK" or not data or not data[0]:
        return []

    resultats: list[tuple[str, Message]] = []
    for num in data[0].split():
        statut, fetched = imap.fetch(num, "(RFC822)")
        if statut != "OK" or not fetched or not fetched[0]:
            continue
        msg = email.message_from_bytes(fetched[0][1])
        message_id = (msg.get("Message-ID") or msg.get("Message-Id") or "").strip()
        if not message_id:
            # Pas de Message-ID : on fabrique une clé stable de repli.
            message_id = f"{msg.get('Date', '')}|{msg.get('Subject', '')}|{msg.get('From', '')}"
        resultats.append((message_id, msg))
    return resultats


def ingest(conn, imap=None) -> tuple[list, list[str]]:
    """Extrait les offres des mails non encore traités de tous les labels.

    Renvoie (offres, nouveaux_message_ids). `imap` est injectable pour les tests ;
    sinon une connexion réelle est ouverte (et fermée) ici. L'appelant est
    responsable de stocker les offres et de marquer les Message-ID traités.
    """
    proprietaire = imap is None
    if imap is None:
        imap = connect_imap()

    since = _since_criterion(config.EMAIL_LOOKBACK_DAYS)
    deja_vus = db.get_processed_email_ids(conn)

    offres: list = []
    nouveaux_ids: list[str] = []
    try:
        for label, categorie in config.EMAIL_LABELS:
            for message_id, msg in fetch_messages(imap, label, since):
                if message_id in deja_vus:
                    continue
                offres.extend(extract_offres_from_email(msg, categorie=categorie))
                nouveaux_ids.append(message_id)
                deja_vus.add(message_id)  # évite les doublons inter-labels
    finally:
        if proprietaire:
            try:
                imap.logout()
            except Exception:  # noqa: BLE001 — fermeture best-effort
                pass

    logger.info(
        "Ingestion mail : %d offre(s) extraite(s) depuis %d nouveau(x) mail(s).",
        len(offres),
        len(nouveaux_ids),
    )
    return offres, nouveaux_ids
