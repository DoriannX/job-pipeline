"""Test de construction de l'e-mail de digest (aucun envoi réseau)."""
from src.digest.mailer import build_message


def test_build_message_entetes_et_corps():
    """L'e-mail porte sujet / from / to et le corps du digest."""
    msg = build_message(
        sujet="Digest emploi — 2026-06-14 (3 offres)",
        corps="# Digest\n\n3 offres.",
        destinataire="moi@example.com",
        expediteur="moi@example.com",
    )
    assert msg["Subject"] == "Digest emploi — 2026-06-14 (3 offres)"
    assert msg["To"] == "moi@example.com"
    assert msg["From"] == "moi@example.com"
    assert "3 offres." in msg.get_content()
