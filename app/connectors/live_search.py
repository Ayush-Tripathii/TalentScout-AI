"""Hybrid Live Search Provider.

Dynamically routes search requests based on available customer credentials:
1. SerpApi (Google X-Ray Engine): High-accuracy, live Google search for LinkedIn/Naukri/Web.
2. Authenticated GitHub API: High-rate (5,000 req/hr) live developer search.
3. Default Free Engine: DuckDuckGo + unauthenticated GitHub API (always active with zero setup).
"""

import os
import re
from typing import Any, Dict, List, Optional, Tuple
import httpx
from ddgs import DDGS
from sqlmodel import Session, select
from app.db import engine
from app.models.app_setting import AppSetting
from app.connectors.base import SearchProvider, RawSearchResult


def get_stored_key(key_name: str) -> Optional[str]:
    """Retrieve key from SQLite settings or environment variable."""
    # 1. Check SQLite
    try:
        with Session(engine) as session:
            setting = session.get(AppSetting, key_name)
            if setting and setting.value.strip():
                return setting.value.strip()
    except Exception:
        pass

    # 2. Check environment variable fallback
    env_mapping = {
        "serpapi_key": "SERPAPI_API_KEY",
        "github_token": "GITHUB_TOKEN",
    }
    env_var = env_mapping.get(key_name)
    if env_var and os.getenv(env_var):
        return os.getenv(env_var).strip()

    return None


class LiveSearchProvider(SearchProvider):
    """Hybrid Live Search Engine combining SerpApi, GitHub API, and free DuckDuckGo."""

    def __init__(self):
        self.ddgs = DDGS()

    def get_provider_status(self) -> Dict[str, Any]:
        """Return status of all search engines (free default + optional keys)."""
        serpapi = get_stored_key("serpapi_key")
        github = get_stored_key("github_token")
        return {
            "free_engine_active": True,
            "has_serpapi": bool(serpapi),
            "serpapi_masked": f"••••{serpapi[-4:]}" if serpapi and len(serpapi) >= 4 else None,
            "has_github": bool(github),
            "github_masked": f"••••{github[-4:]}" if github and len(github) >= 4 else None,
            "active_mode": "enterprise_hybrid" if (serpapi and github) else ("google_xray" if serpapi else ("github_pro" if github else "free_tier")),
        }

    def search(self, query: str, limit: int = 20, platform: Optional[str] = None) -> List[RawSearchResult]:
        """Execute live search using the best available provider."""
        platform_hint = (platform or "").lower()
        serpapi_key = get_stored_key("serpapi_key")
        github_token = get_stored_key("github_token")

        # -------------------------------------------------------------
        # Track 1: GitHub Tech Searches
        # -------------------------------------------------------------
        if platform_hint == "github" or "github.com" in query.lower():
            gh_results = self._search_github(query, limit, github_token)
            if gh_results:
                return gh_results[:limit]

        # -------------------------------------------------------------
        # Track 2: LinkedIn / Naukri / Web Searches
        # -------------------------------------------------------------
        # Tier A: If customer provided SerpApi key, use Google X-Ray
        if serpapi_key:
            serp_results = self._search_serpapi(query, limit, platform_hint, serpapi_key)
            if serp_results:
                return serp_results[:limit]

        # Tier B: Default Free Engine (DuckDuckGo with intelligent syntax fallback)
        return self._search_duckduckgo(query, limit, platform_hint)

    def _search_serpapi(self, query: str, limit: int, platform_hint: str, api_key: str) -> List[RawSearchResult]:
        """Execute real Google search via SerpApi."""
        results: List[RawSearchResult] = []
        try:
            params = {
                "engine": "google",
                "q": query,
                "api_key": api_key,
                "num": min(limit, 20),
                "gl": "in",  # India geographic focus
                "hl": "en",
            }
            resp = httpx.get("https://serpapi.com/search.json", params=params, timeout=15.0)
            if resp.status_code == 200:
                data = resp.json()
                organic_results = data.get("organic_results", [])
                for item in organic_results:
                    url = item.get("link") or ""
                    title = item.get("title") or ""
                    snippet = item.get("snippet") or ""

                    if not url or not title:
                        continue

                    # Filter out job directory pages
                    if "linkedin.com" in url.lower() and any(ign in url.lower() for ign in ["/jobs/", "/company/", "/pulse/"]):
                        continue

                    detected_platform = platform_hint or "web"
                    if "linkedin.com/in" in url.lower():
                        detected_platform = "linkedin"
                    elif "github.com" in url.lower():
                        detected_platform = "github"
                    elif "naukri.com" in url.lower():
                        detected_platform = "naukri"

                    results.append(RawSearchResult(
                        url=url,
                        title=title,
                        snippet=snippet,
                        platform=detected_platform,
                        engine="google_serpapi"
                    ))
        except Exception:
            pass

        return results

    def _search_duckduckgo(self, query: str, limit: int, platform_hint: str) -> List[RawSearchResult]:
        """Execute free DuckDuckGo search with normalized keywords."""
        results: List[RawSearchResult] = []
        clean_terms = self._extract_clean_keywords(query)
        keywords_str = " ".join(clean_terms[:5])

        queries_to_try = []
        is_public_resume = platform_hint in ["public_resume", "resume"] or "filetype:" in query.lower()
        if platform_hint == "linkedin" or "linkedin" in query.lower():
            queries_to_try.append(f"{keywords_str} LinkedIn profile")
            queries_to_try.append(f"site:in.linkedin.com/in {keywords_str}")
            queries_to_try.append(query)
        elif platform_hint == "naukri" or "naukri" in query.lower():
            queries_to_try.append(f"{keywords_str} Naukri resume profile")
            queries_to_try.append(f"site:naukri.com {keywords_str}")
            queries_to_try.append(query)
        elif platform_hint == "github":
            queries_to_try.append(f"{keywords_str} GitHub developer")
            queries_to_try.append(query)
        elif is_public_resume:
            queries_to_try.append(f"site:github.io {keywords_str} developer")
            queries_to_try.append(f"site:github.io {keywords_str} resume portfolio")
            queries_to_try.append(f"{keywords_str} candidate resume India")
            queries_to_try.append(f"{keywords_str} developer CV")
        else:
            queries_to_try.append(f"{keywords_str} resume profile")
            queries_to_try.append(query)

        for q_attempt in queries_to_try:
            if not q_attempt.strip():
                continue
            try:
                raw_items = list(self.ddgs.text(q_attempt.strip(), max_results=limit * 2))
                for item in raw_items:
                    url = item.get("href") or ""
                    title = item.get("title") or ""
                    snippet = item.get("body") or ""

                    if not url or not title:
                        continue

                    if any(bad in url.lower() for bad in ["duckduckgo.com", "bing.com", "google.com", "yahoo.com"]):
                        continue

                    if "linkedin.com" in url.lower():
                        if any(ign in url.lower() for ign in ["/jobs/", "/jobs", "/company/", "/pulse/", "/posts/", "/dir/", "/learning/"]):
                            continue

                    detected_platform = platform_hint or "web"
                    if "linkedin.com/in" in url.lower() or "linkedin.com/pub" in url.lower():
                        detected_platform = "linkedin"
                    elif "github.com" in url.lower():
                        detected_platform = "github"
                    elif "naukri.com" in url.lower():
                        detected_platform = "naukri"
                    elif "foundit.in" in url.lower() or "monsterindia" in url.lower():
                        detected_platform = "foundit"
                    elif is_public_resume or "github.io" in url.lower() or url.lower().endswith(".pdf") or url.lower().endswith(".docx"):
                        detected_platform = "public_resume"

                    if any(r.url == url for r in results):
                        continue

                    results.append(RawSearchResult(
                        url=url,
                        title=title,
                        snippet=snippet,
                        platform=detected_platform,
                        engine="ddgs"
                    ))

                    if len(results) >= limit:
                        break

                if len(results) >= limit:
                    break
            except Exception:
                continue

        return results[:limit]

    def _extract_clean_keywords(self, query: str) -> List[str]:
        """Strip operators into pure search terms."""
        q = re.sub(r'site:[a-zA-Z0-9\.\-_/]+', ' ', query, flags=re.I)
        q = re.sub(r'filetype:[a-zA-Z0-9]+', ' ', q, flags=re.I)
        q = re.sub(r'[-–][a-zA-Z0-9]+', ' ', q)
        q = re.sub(r'\b(AND|OR|NOT|in)\b', ' ', q, flags=re.I)
        words = re.findall(r'[a-zA-Z0-9+#]+', q)
        noise = {
            "profile", "developer", "engineer", "resume", "cv", "filetype",
            "pdf", "docx", "doc", "template", "sample", "job", "jobs",
            "free", "download", "example", "examples", "curriculum", "vitae",
            "site", "com", "in"
        }
        seen = set()
        clean = []
        for w in words:
            wl = w.lower()
            if len(w) > 1 and wl not in noise and wl not in seen:
                seen.add(wl)
                clean.append(w)
        return clean

    def _search_github(self, query: str, limit: int = 15, token: Optional[str] = None) -> List[RawSearchResult]:
        """Query GitHub Users API with optional Personal Access Token (PAT)."""
        results: List[RawSearchResult] = []
        try:
            stop_words = {"site", "github", "com", "and", "or", "not", "in", "the", "developer", "engineer"}
            words = re.findall(r'[a-zA-Z0-9]+', query)
            clean_words = [w for w in words if w.lower() not in stop_words and len(w) > 1]
            gh_query = " ".join(clean_words[:3]) or "developer"

            headers = {
                "User-Agent": "TalentScout-Engine/1.0",
                "Accept": "application/vnd.github.v3+json",
            }
            if token:
                headers["Authorization"] = f"Bearer {token}"

            resp = httpx.get(
                "https://api.github.com/search/users",
                params={"q": gh_query, "per_page": limit},
                headers=headers,
                timeout=8.0
            )

            if resp.status_code == 200:
                data = resp.json()
                items = data.get("items", [])
                for item in items[:limit]:
                    login = item.get("login")
                    profile_url = item.get("html_url")
                    if not login or not profile_url:
                        continue

                    name = login
                    bio = ""
                    loc = "India"
                    try:
                        u_resp = httpx.get(
                            f"https://api.github.com/users/{login}",
                            headers=headers,
                            timeout=3.0
                        )
                        if u_resp.status_code == 200:
                            u_data = u_resp.json()
                            name = u_data.get("name") or login
                            bio = u_data.get("bio") or ""
                            loc = u_data.get("location") or "Global"
                    except Exception:
                        pass

                    title = f"{name} ({login}) - GitHub Developer {loc}"
                    snippet = f"GitHub Profile for {name} ({login}). {bio}. Location: {loc}."

                    results.append(RawSearchResult(
                        url=profile_url,
                        title=title,
                        snippet=snippet,
                        platform="github",
                        engine="github_api_auth" if token else "github_api_free"
                    ))
        except Exception:
            pass

        return results

    @staticmethod
    def test_serpapi_key(key: str) -> Tuple[bool, str]:
        """Test validity of a SerpApi key."""
        try:
            r = httpx.get("https://serpapi.com/account", params={"api_key": key}, timeout=8.0)
            if r.status_code == 200:
                data = r.json()
                remaining = data.get("total_searches_left", "Active")
                return True, f"Valid! Total searches remaining: {remaining}"
            return False, f"Invalid key or error (HTTP {r.status_code})"
        except Exception as e:
            return False, f"Connection error: {str(e)}"

    @staticmethod
    def test_github_token(token: str) -> Tuple[bool, str]:
        """Test validity of a GitHub token."""
        try:
            r = httpx.get("https://api.github.com/user", headers={"Authorization": f"Bearer {token}"}, timeout=8.0)
            if r.status_code == 200:
                user = r.json().get("login")
                rate_limit = r.headers.get("x-ratelimit-remaining", "5000")
                return True, f"Valid! Authenticated as @{user} ({rate_limit} requests remaining)"
            return False, f"Invalid token (HTTP {r.status_code})"
        except Exception as e:
            return False, f"Connection error: {str(e)}"
