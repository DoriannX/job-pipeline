"""Envoi du digest par e-mail via SMTP (Gmail).

Sert au mode cloud : le pipeline tourne sur un serveur (PC éteint) et t'envoie le
digest sur ta propre boîte. Réutilise l'App Password Gmail (valable IMAP + SMTP).
"""
import logging
import smtplib
import ssl
from email.message import EmailMessage

import config

logger = logging.getLogger(__name__)


def build_message(sujet: str, corps: str, destinataire: str, expediteur: str) -> EmailMessage:
    """Construit l'e-mail (texte brut). Isolé pour être testable sans réseau."""
    msg = EmailMessage()
    msg["Subject"] = sujet
    msg["From"] = expediteur
    msg["To"] = destinataire
    msg.set_content(corps)
    return msg


def send_digest(
    corps: str,
    sujet: str,
    to: str | None = None,
    user: str | None = None,
    password: str | None = None,
    host: str | None = None,
    port: int | None = None,
) -> None:
    """Envoie le digest par SMTP SSL. Lève ValueError si les identifiants manquent."""
    user = user or config.IMAP_USER
    password = password or config.IMAP_APP_PASSWORD
    to = to or config.MAIL_TO or user
    host = host or config.SMTP_HOST
    port = port or config.SMTP_PORT
    if not user or not password:
        raise ValueError(
            "Envoi e-mail impossible : IMAP_USER / IMAP_APP_PASSWORD manquants."
        )

    msg = build_message(sujet, corps, to, user)
    contexte = ssl.create_default_context()
    with smtplib.SMTP_SSL(host, port, context=contexte) as smtp:
        smtp.login(user, password)
        smtp.send_message(msg)
    logger.info("Digest envoyé par e-mail à %s.", to)
