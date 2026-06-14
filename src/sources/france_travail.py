"""Client de l'API France Travail « Offres d'emploi v2 ».

Responsabilités :
- lancer une recherche paginée par mot-clé selon les filtres de `config` ;
- respecter le quota (~4 req/s) via un throttling simple ;
- réessayer avec back-off exponentiel sur 429 (quota) et 5xx (erreur serveur) ;
- agréger et dédupliquer les résultats par identifiant d'offre.

Pagination : l'API utilise le paramètre `range=<debut>-<fin>` (max 150 par page)
et renvoie l'en-tête `Content-Range: offres <debut>-<fin>/<total>` qui donne le
nombre total de résultats, ce qui permet de savoir quand s'arrêter.
"""
import logging
import time

import requests

import config
from src.auth.france_travail_auth import FranceTravailAuth

logger = logging.getLogger(__name__)


def parse_total_from_content_range(header: str | None) -> int | None:
    """Extrait le total depuis un en-tête `Content-Range: offres 0-149/1234`.

    Renvoie None si l'en-tête est absent ou non parsable (on arrête alors la
    pagination par sécurité plutôt que de boucler indéfiniment).
    """
    if not header or "/" not in header:
        return None
    total_part = header.rsplit("/", 1)[1].strip()
    try:
        return int(total_part)
    except ValueError:
        return None


class FranceTravailSource:
    """Recherche d'offres sur l'API France Travail v2."""

    def __init__(self, auth: FranceTravailAuth, session: requests.Session | None = None):
        self._auth = auth
        self._session = session or requests.Session()
        # Intervalle minimal entre 2 requêtes pour tenir le quota req/s.
        self._min_interval = 1.0 / config.MAX_REQ_PER_SEC if config.MAX_REQ_PER_SEC else 0.0
        self._last_request_ts = 0.0

    # ------------------------------------------------------------------ #
    # API publique
    # ------------------------------------------------------------------ #
    def search_all(self) -> list[dict]:
        """Recherche pour TOUS les mots-clés configurés, agrégés + dédupliqués.

        Renvoie la liste des objets bruts d'offres (clés API), dédupliqués par
        `id`. Le mapping vers le modèle `Offre` est fait par l'appelant.
        """
        seen: dict[str, dict] = {}
        for mot_cle in config.MOTS_CLES:
            logger.info("Recherche France Travail pour le mot-clé : %r", mot_cle)
            for offre in self._search_keyword(mot_cle):
                offre_id = offre.get("id")
                if offre_id is not None:
                    seen[str(offre_id)] = offre
        logger.info("Total %d offres uniques agrégées depuis France Travail.", len(seen))
        return list(seen.values())

    # ------------------------------------------------------------------ #
    # Interne
    # ------------------------------------------------------------------ #
    def _search_keyword(self, mot_cle: str):
        """Génère les offres d'un mot-clé, page par page, jusqu'à épuisement."""
        start = 0
        while start < config.MAX_OFFERS:
            end = min(start + config.PAGE_SIZE, config.MAX_OFFERS) - 1
            params = {
                "motsCles": mot_cle,
                "departement": config.DEPARTEMENT,
                "range": f"{start}-{end}",
            }
            if config.TYPE_CONTRATS:
                # L'API accepte plusieurs codes séparés par des virgules.
                params["typeContrat"] = ",".join(config.TYPE_CONTRATS)
            if config.NATURE_CONTRATS_ALTERNANCE:
                params["natureContrat"] = ",".join(config.NATURE_CONTRATS_ALTERNANCE)

            response = self._request(params)

            # 204 = aucun résultat pour cette recherche.
            if response.status_code == 204:
                return

            data = response.json() or {}
            # La réponse v2 place les offres sous la clé "resultats".
            resultats = data.get("resultats", [])
            for offre in resultats:
                yield offre

            total = parse_total_from_content_range(response.headers.get("Content-Range"))
            # Conditions d'arrêt : plus de total connu, page incomplète, ou
            # on a atteint/dépassé le total annoncé.
            if (
                total is None
                or len(resultats) < config.PAGE_SIZE
                or end + 1 >= total
            ):
                return
            start += config.PAGE_SIZE

    def _request(self, params: dict) -> requests.Response:
        """Effectue une requête GET avec throttling + retry exponentiel."""
        last_exc: Exception | None = None
        for attempt in range(config.MAX_RETRIES):
            self._throttle()
            headers = {"Accept": "application/json", **self._auth.auth_header()}
            try:
                response = self._session.get(
                    config.FT_SEARCH_URL,
                    params=params,
                    headers=headers,
                    timeout=config.HTTP_TIMEOUT,
                )
            except requests.RequestException as exc:
                # Erreur réseau : on réessaie avec back-off.
                last_exc = exc
                self._sleep_backoff(attempt, reason=str(exc))
                continue

            # 200 (complet), 206 (partiel/paginé), 204 (vide) = OK.
            if response.status_code in (200, 206, 204):
                return response

            # 429 (quota) ou 5xx (serveur) : on réessaie.
            if response.status_code == 429 or response.status_code >= 500:
                self._sleep_backoff(
                    attempt, reason=f"HTTP {response.status_code}"
                )
                last_exc = requests.HTTPError(
                    f"HTTP {response.status_code}", response=response
                )
                continue

            # Autres codes (4xx hors 429) : erreur définitive, on remonte.
            response.raise_for_status()

        # Toutes les tentatives ont échoué.
        raise RuntimeError(
            f"Échec de la requête France Travail après {config.MAX_RETRIES} tentatives"
        ) from last_exc

    def _throttle(self) -> None:
        """Attend si nécessaire pour respecter le quota de requêtes/seconde."""
        if self._min_interval <= 0:
            return
        elapsed = time.monotonic() - self._last_request_ts
        wait = self._min_interval - elapsed
        if wait > 0:
            time.sleep(wait)
        self._last_request_ts = time.monotonic()

    @staticmethod
    def _sleep_backoff(attempt: int, reason: str) -> None:
        """Back-off exponentiel : 1s, 2s, 4s, ... entre les tentatives."""
        delay = 2 ** attempt
        logger.warning(
            "Requête France Travail en échec (%s) — nouvelle tentative dans %ss.",
            reason,
            delay,
        )
        time.sleep(delay)
