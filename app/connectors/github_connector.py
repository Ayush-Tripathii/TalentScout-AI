"""GitHub Official REST API Connector.

Searches GitHub users by language and Indian location, fetching only public
profile fields, public email, blog/portfolio, and top public repositories.
Strictly conforms to API terms (no harvesting from git commits).
"""

import logging
from typing import Any, Dict, List, Optional
import httpx
from config.settings import get_settings

logger = logging.getLogger("talentscout.github")
settings = get_settings()


class GitHubConnector:
    """Official GitHub REST API Client."""

    BASE_URL = "https://api.github.com"

    def __init__(self, token: Optional[str] = None):
        self.token = token or settings.GITHUB_TOKEN

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "TalentScout-Recruitment-Engine/1.0",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def search_users(self, language: str = "Java", location: str = "Bhopal", limit: int = 10) -> List[Dict[str, Any]]:
        """Search users via GitHub Search API: location:<loc> language:<lang>."""
        q = f"location:{location} language:{language}"
        url = f"{self.BASE_URL}/search/users"
        params = {"q": q, "per_page": min(limit, 30)}

        try:
            with httpx.Client(timeout=6.0) as client:
                resp = client.get(url, params=params, headers=self._get_headers())
                if resp.status_code == 200:
                    data = resp.json()
                    items = data.get("items", [])
                    users = []
                    for item in items[:limit]:
                        details = self.get_user_profile(item.get("login"))
                        if details:
                            users.append(details)
                    return users
                elif resp.status_code == 403:
                    logger.warning("GitHub API rate limit reached or token unauthorized. Returning empty list.")
        except Exception as e:
            logger.info(f"GitHub API search failed or offline ({e}).")

        # Never return fake or dummy data.
        return []

