"""SearXNG Search Provider Implementation with 24h SQLite Cache and Backoff."""

import hashlib
import json
import logging
import sqlite3
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional
import httpx
from config.settings import get_settings
from app.connectors.base import SearchProvider, RawSearchResult

logger = logging.getLogger("talentscout.searxng")
settings = get_settings()
BASE_DIR = Path(__file__).resolve().parent.parent.parent


class SearXNGProvider(SearchProvider):
    """SearXNG Search Engine Client with caching and rate limit resilience."""

    def __init__(self, base_url: Optional[str] = None, cache_hours: int = 24):
        self.base_url = (base_url or settings.SEARXNG_URL).rstrip("/")
        self.cache_hours = cache_hours
        self.db_path = BASE_DIR / "data" / "search_cache.db"
        self._init_cache_db()

    def _init_cache_db(self):
        """Create the SQLite cache database and table if not existing."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS search_cache (
                    query_hash TEXT PRIMARY KEY,
                    query_text TEXT,
                    results_json TEXT,
                    cached_at TIMESTAMP,
                    expires_at TIMESTAMP
                )
                """
            )
            conn.commit()

    def _get_from_cache(self, query: str) -> Optional[List[RawSearchResult]]:
        """Retrieve results from cache if not expired."""
        q_hash = hashlib.sha256(query.encode("utf-8")).hexdigest()
        now = datetime.now(timezone.utc)
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT results_json, expires_at FROM search_cache WHERE query_hash = ?",
                    (q_hash,),
                )
                row = cursor.fetchone()
                if row:
                    results_json, expires_at_str = row
                    expires_at = datetime.fromisoformat(expires_at_str)
                    if expires_at > now:
                        logger.info(f"Cache HIT for query: {query[:40]}...")
                        data = json.loads(results_json)
                        return [RawSearchResult(**item) for item in data]
        except Exception as e:
            logger.warning(f"Cache read error: {e}")
        return None

    def _save_to_cache(self, query: str, results: List[RawSearchResult]):
        """Save results to SQLite cache."""
        q_hash = hashlib.sha256(query.encode("utf-8")).hexdigest()
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=self.cache_hours)
        data = [r.__dict__ for r in results]
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO search_cache 
                    (query_hash, query_text, results_json, cached_at, expires_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (q_hash, query, json.dumps(data), now.isoformat(), expires_at.isoformat()),
                )
                conn.commit()
        except Exception as e:
            logger.warning(f"Cache write error: {e}")

    def _detect_platform(self, url: str) -> str:
        """Infer target platform from result URL."""
        lower = url.lower()
        if "linkedin.com/in" in lower:
            return "linkedin"
        elif "naukri.com" in lower:
            return "naukri"
        elif "foundit.in" in lower:
            return "foundit"
        elif "shine.com" in lower:
            return "shine"
        elif "apna.co" in lower:
            return "apna"
        elif "indeed.com" in lower:
            return "indeed"
        elif "github.com" in lower:
            return "github"
        elif "stackoverflow.com" in lower:
            return "stackoverflow"
        elif "kaggle.com" in lower:
            return "kaggle"
        elif "behance.net" in lower:
            return "behance"
        elif "dribbble.com" in lower:
            return "dribbble"
        elif lower.endswith(".pdf") or lower.endswith(".docx"):
            return "public_resume"
        return "web"

    def search(self, query: str, limit: int = 20) -> List[RawSearchResult]:
        """Execute search with cache check, backoff, and graceful fallback."""
        # Check cache first
        cached = self._get_from_cache(query)
        if cached is not None:
            return cached[:limit]

        # Attempt SearXNG request with retry
        params = {
            "q": query,
            "format": "json",
            "engines": "google,bing,duckduckgo,brave",
        }
        backoff_delays = [1.0, 2.0]

        for attempt in range(len(backoff_delays) + 1):
            try:
                response = httpx.get(
                    f"{self.base_url}/search",
                    params=params,
                    timeout=5.0,
                    headers={"User-Agent": "TalentScout-Recruitment-Engine/1.0"},
                )
                if response.status_code == 200:
                    data = response.json()
                    results: List[RawSearchResult] = []
                    for item in data.get("results", []):
                        url = item.get("url", "")
                        title = item.get("title", "")
                        snippet = item.get("content", "")
                        if url:
                            platform = self._detect_platform(url)
                            results.append(
                                RawSearchResult(
                                    url=url,
                                    title=title,
                                    snippet=snippet,
                                    platform=platform,
                                    engine=item.get("engine", "searxng"),
                                    score=item.get("score", 0.0),
                                )
                            )
                    self._save_to_cache(query, results)
                    return results[:limit]
                elif response.status_code in [429, 503]:
                    logger.warning(f"SearXNG throttling ({response.status_code}), backing off...")
            except Exception as e:
                logger.warning(f"SearXNG request failed: {e}")

            if attempt < len(backoff_delays):
                time.sleep(backoff_delays[attempt])

        # Never return fake or dummy data. If search engine is unreachable or returns nothing, return empty.
        logger.info("Search returned 0 results or SearXNG is offline. Returning empty results.")
        return []


