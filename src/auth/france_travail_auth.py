"""Authentification OAuth2 (flux `client_credentials`) pour l'API France Travail.

Obtient un token d'accès et le met en cache jusqu'à peu avant son expiration,
afin d'éviter une requête de token à chaque appel. Le flux et l'endpoint sont
ceux de la documentation officielle francetravail.io (realm "partenaire").
"""
import logging
import time

import requests

import config

logger = logging.getLogger(__name__)

# Marge de sécurité (secondes) : on renouvelle le token un peu avant l'expiration.
_EXPIRY_MARGIN = 30


class FranceTravailAuth:
    """Gère le token OAuth2 client_credentials de l'API France Travail."""

    def __init__(
        self,
        client_id: str = config.FT_CLIENT_ID,
        client_secret: str = config.FT_CLIENT_SECRET,
        token_url: str = config.FT_TOKEN_URL,
        scope: str = config.FT_SCOPE,
        timeout: int = config.HTTP_TIMEOUT,
    ) -> None:
        if not client_id or not client_secret:
            raise ValueError(
                "FT_CLIENT_ID / FT_CLIENT_SECRET manquants. "
                "Copie .env.example vers .env et renseigne tes identifiants."
            )
        self._client_id = client_id
        self._client_secret = client_secret
        self._token_url = token_url
        self._scope = scope
        self._timeout = timeout
        # Cache interne.
        self._token: str | None = None
        self._expires_at: float = 0.0

    def get_token(self) -> str:
        """Renvoie un token valide, en le renouvelant si nécessaire."""
        if self._token and time.monotonic() < self._expires_at - _EXPIRY_MARGIN:
            return self._token
        return self._fetch_token()

    def auth_header(self) -> dict[str, str]:
        """Construit l'en-tête Authorization Bearer prêt à l'emploi."""
        return {"Authorization": f"Bearer {self.get_token()}"}

    def _fetch_token(self) -> str:
        """Demande un nouveau token au serveur OAuth2 de France Travail."""
        # Le flux client_credentials envoie les identifiants en form-urlencoded.
        payload = {
            "grant_type": "client_credentials",
            "client_id": self._client_id,
            "client_secret": self._client_secret,
            "scope": self._scope,
        }
        logger.debug("Demande d'un token OAuth2 (scope=%s)", self._scope)
        response = requests.post(self._token_url, data=payload, timeout=self._timeout)
        response.raise_for_status()
        data = response.json()

        self._token = data["access_token"]
        # `expires_in` est en secondes ; valeur par défaut prudente si absente.
        expires_in = int(data.get("expires_in", 1499))
        self._expires_at = time.monotonic() + expires_in
        logger.info("Token France Travail obtenu (valide %ss).", expires_in)
        return self._token
