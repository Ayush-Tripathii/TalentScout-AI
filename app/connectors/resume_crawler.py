"""Public Resume Downloader.

Downloads login-free public PDF and DOCX resumes discovered via search queries,
verifying robots.txt permissions before fetching.
"""

import logging
from pathlib import Path
from typing import Optional
import httpx
from app.connectors.public_web import PublicWebClient

logger = logging.getLogger("talentscout.resume_crawler")
BASE_DIR = Path(__file__).resolve().parent.parent.parent


class PublicResumeCrawler:
    """Compliant public resume file fetcher."""

    def __init__(self, download_dir: Optional[Path] = None):
        self.download_dir = download_dir or (BASE_DIR / "uploads" / "resumes" / "public")
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.web_client = PublicWebClient()

    def download_resume(self, url: str) -> Optional[Path]:
        """Download public PDF or DOCX file if permitted by robots.txt."""
        if not self.web_client.is_crawl_allowed(url):
            return None

        ext = Path(url.split("?")[0]).suffix.lower()
        if ext not in [".pdf", ".docx"]:
            return None

        filename = Path(url.split("?")[0]).name
        local_path = self.download_dir / filename

        try:
            with httpx.Client(timeout=8.0, follow_redirects=True) as client:
                resp = client.get(url, headers={"User-Agent": self.web_client.USER_AGENT})
                if resp.status_code == 200 and len(resp.content) > 1000:
                    with open(local_path, "wb") as f:
                        f.write(resp.content)
                    logger.info(f"Successfully downloaded public resume: {filename}")
                    return local_path
        except Exception as e:
            logger.info(f"Failed to download public resume {url}: {e}")

        return None
