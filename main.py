"""Script unique à lancer (manuellement ou au démarrage du PC).

Flux principal : ingestion des alertes e-mail (IMAP Gmail) → stockage SQLite
(avec déduplication) → digest du jour (Markdown + CSV) → résumé console.

La source API France Travail reste disponible mais OPTIONNELLE : elle ne tourne
que si FT_CLIENT_ID / FT_CLIENT_SECRET sont renseignés dans `.env`.

Usage :
    python main.py

Pré-requis : copier `.env.example` vers `.env` et renseigner au minimum
IMAP_USER / IMAP_APP_PASSWORD / EMAIL_LABELS (voir README).
"""
import logging
import sys

import config
from src.digest import digest, mailer
from src.sources import email_ingest
from src.storage import db
from src.storage.models import Offre

logger = logging.getLogger("job_pipeline")


def _fermer(conn) -> None:
    """Ferme la connexion sans planter si le backend n'expose pas close()."""
    try:
        conn.close()
    except Exception:  # noqa: BLE001 — fermeture best-effort (libSQL remote)
        pass


def configurer_logs() -> None:
    """Configure un logging lisible sur la sortie standard."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def _ingerer_emails(conn) -> list[Offre]:
    """Ingestion des alertes e-mail. Renvoie les offres extraites (peut être vide)."""
    if not config.IMAP_USER or not config.IMAP_APP_PASSWORD:
        logger.warning(
            "IMAP non configuré (IMAP_USER / IMAP_APP_PASSWORD vides) — "
            "ingestion e-mail ignorée. Voir README."
        )
        return []
    offres, nouveaux_ids = email_ingest.ingest(conn)
    # Marque les mails traités APRÈS extraction (idempotence).
    for message_id in nouveaux_ids:
        db.mark_email_processed(conn, message_id)
    return offres


def _ingerer_france_travail() -> list[Offre]:
    """Source France Travail optionnelle (dormante tant que .env vide)."""
    if not config.FT_CLIENT_ID or not config.FT_CLIENT_SECRET:
        return []
    # Import local : évite de charger le client FT quand il n'est pas utilisé.
    from src.auth.france_travail_auth import FranceTravailAuth
    from src.sources.france_travail import FranceTravailSource

    logger.info("Source France Travail activée (identifiants présents).")
    source = FranceTravailSource(FranceTravailAuth())
    return [Offre.from_france_travail(brut) for brut in source.search_all()]


def main() -> int:
    configurer_logs()

    conn = db.connect()
    db.init_db(conn)

    # 1. Sources : alertes e-mail (principal) + France Travail (optionnel).
    offres = _ingerer_emails(conn)
    offres += _ingerer_france_travail()

    if not offres and not config.IMAP_USER:
        logger.error(
            "Aucune source configurée. Renseigne au minimum IMAP_* dans .env "
            "(voir README), puis relance."
        )
        _fermer(conn)
        return 1

    # 2. Stockage avec déduplication par identifiant (URL normalisée / id source).
    nb_nouvelles = db.insert_offres(conn, offres)

    # 3. Digest du jour.
    md_path, csv_path, nb_digest = digest.generate_digest(conn)
    total = db.count_offres(conn)
    _fermer(conn)

    # 3bis. Envoi e-mail (mode cloud) : seulement s'il y a des nouveautés.
    if config.SEND_EMAIL and nb_digest > 0:
        try:
            mailer.send_digest(
                corps=md_path.read_text(encoding="utf-8"),
                sujet=f"Digest emploi — {md_path.stem.replace('digest-', '')} ({nb_digest} offres)",
            )
        except Exception as exc:  # noqa: BLE001 — l'envoi ne doit pas faire échouer le run
            logger.error("Échec de l'envoi du digest par e-mail : %s", exc)

    # 4. Résumé console.
    print("\n=== Résumé du run ===")
    print(f"Offres récupérées (uniques)  : {len(offres)}")
    print(f"Nouvelles offres stockées    : {nb_nouvelles}")
    print(f"Total en base                : {total}")
    print(f"Digest ({nb_digest} offres)  : {md_path}")
    print(f"                               {csv_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
