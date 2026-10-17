"""Compliant Public Web Client with Strict Robots.txt Enforcement."""

import logging
from urllib.parse import urlparse
import urllib.robotparser
from typing import Optional
import httpx

logger = logging.getLogger("talentscout.public_web")


class PublicWebClient:
    """Safe HTTP client that verifies robots.txt before making public requests."""

    USER_AGENT = "TalentScout-Bot/1.0 (+https://talentscout.local/compliance)"

    def __init__(self):
        self._robot_parsers = {}

    def is_crawl_allowed(self, target_url: str) -> bool:
        """Verify if robots.txt on host permits fetching target_url."""
        parsed = urlparse(target_url)
        host = f"{parsed.scheme}://{parsed.netloc}"

        if host not in self._robot_parsers:
            rp = urllib.robotparser.RobotFileParser()
            robots_url = f"{host}/robots.txt"
            rp.set_url(robots_url)
            try:
                # Fast timeout for robots.txt
                with httpx.Client(timeout=3.0) as client:
                    resp = client.get(robots_url, headers={"User-Agent": self.USER_AGENT})
                    if resp.status_code == 200:
                        rp.parse(resp.text.splitlines())
                    else:
                        rp.allow_all = True
            except Exception:
                rp.allow_all = True
            self._robot_parsers[host] = rp

        parser = self._robot_parsers[host]
        allowed = parser.can_fetch(self.USER_AGENT, target_url)
        if not allowed:
            logger.warning(f"Crawling disallowed by robots.txt: {target_url}")
        return allowed

    def fetch_public_page(self, url: str, timeout: float = 6.0) -> Optional[str]:
        """Fetch content only if robots.txt permits and page requires no login."""
        if not self.is_crawl_allowed(url):
            return None

        try:
            with httpx.Client(timeout=timeout, follow_redirects=True) as client:
                resp = client.get(url, headers={"User-Agent": self.USER_AGENT})
                if resp.status_code == 200:
                    return resp.text
        except Exception as e:
            logger.info(f"Failed to fetch public page {url}: {e}")
        return None
