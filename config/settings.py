"""Application Settings Module.

Loads configuration from environment variables and .env file using Pydantic Settings.
"""

from functools import lru_cache
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Global application settings and environment variables."""

    # Application
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT_API: int = 8000
    PORT_UI: int = 5173

    # Cryptographic Security & Authentication
    SECRET_KEY: str = "4148ca42609942bb0becbe8dfbf7000bac861d77953a357c23cd95d551b351b1"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000"
    SECURITY_HEADERS_ENABLED: bool = True
    CONTENT_SECURITY_POLICY_ENABLED: bool = True
    MAX_UPLOAD_SIZE_BYTES: int = 10485760  # 10 MB
    RATE_LIMITING_ENABLED: bool = True
    RATE_LIMIT_AUTH_PER_MINUTE: int = 60
    RATE_LIMIT_SEARCH_PER_MINUTE: int = 60
    RATE_LIMIT_GLOBAL_PER_MINUTE: int = 300
    WEBHOOK_SIGNING_SECRET: str = "1458f7bc0526df40e4cd43daabb6cf51bb9a90384bf32c0f"

    @property
    def allowed_origins_list(self) -> list[str]:
        if not self.ALLOWED_ORIGINS or self.ALLOWED_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    # Database
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'data' / 'talentscout.db'}"
    TURSO_AUTH_TOKEN: Optional[str] = None

    # Search & Caching
    SEARCH_PROVIDER: str = "searxng"
    SEARXNG_URL: str = "http://localhost:8080"
    CACHE_TTL_HOURS: int = 24
    RATE_LIMIT_DELAY_SECONDS: float = 1.0

    # Local Ollama LLM
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:7b"

    # External APIs
    GITHUB_TOKEN: Optional[str] = None
    HUNTER_API_KEY: Optional[str] = None
    APOLLO_API_KEY: Optional[str] = None
    SERPAPI_API_KEY: Optional[str] = None
    BRAVE_API_KEY: Optional[str] = None
    DDG_PROXY: Optional[str] = None

    # Gmail IMAP
    GMAIL_IMAP_SERVER: str = "imap.gmail.com"
    GMAIL_EMAIL: Optional[str] = None
    GMAIL_APP_PASSWORD: Optional[str] = None
    GMAIL_CHECK_INTERVAL_MINUTES: int = 15

    # Google Sheets
    GOOGLE_SHEETS_CREDENTIALS_FILE: str = str(BASE_DIR / "config" / "google_service_account.json")
    GOOGLE_SHEET_ID: Optional[str] = None

    # Compliance & DPDP
    RETENTION_DAYS: int = 180
    AUTO_FLAG_EXPIRED: bool = True

    # Ranking Weights
    WEIGHT_MUST_HAVE: float = 0.35
    WEIGHT_NICE_HAVE: float = 0.15
    WEIGHT_EXPERIENCE: float = 0.15
    WEIGHT_LOCATION: float = 0.15
    WEIGHT_TITLE: float = 0.10
    WEIGHT_SEMANTIC: float = 0.10

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
