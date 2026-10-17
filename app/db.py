"""Database Engine, Session Management, and Initialization."""

import os
os.environ["SQLALCHEMY_NO_CYTHON"] = "1"
from pathlib import Path
from typing import Generator
import yaml
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy import event
from sqlalchemy.engine import Engine
from config.settings import get_settings
from app.models import (
    Job,
    SearchQuery,
    SearchRun,
    PlatformConfig,
    Candidate,
    CandidateSource,
    CandidateLink,
    ContactPoint,
    Resume,
    Match,
    PipelineStatus,
    OutreachEvent,
    Note,
    FormResponse,
    EnrichmentUsage,
    AuditLog,
    AppSetting,
    ScheduledSourcingJob,
    SourcingAlertNotification,
)

settings = get_settings()

db_url_str = str(settings.DATABASE_URL).strip()
is_turso = (
    db_url_str.startswith("libsql://")
    or "turso.io" in db_url_str
    or db_url_str.startswith("sqlite+libsql://")
)

if is_turso:
    # Turso Cloud LibSQL database
    if db_url_str.startswith("libsql://"):
        engine_url = f"sqlite+{db_url_str}?secure=true"
    else:
        engine_url = db_url_str

    auth_token = settings.TURSO_AUTH_TOKEN or os.getenv("TURSO_AUTH_TOKEN", "")
    connect_args = {}
    if auth_token:
        connect_args["auth_token"] = auth_token

    engine = create_engine(
        engine_url,
        echo=False,
        connect_args=connect_args,
    )
else:
    # Local SQLite
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    if db_path.startswith("./"):
        db_path = str(Path(__file__).resolve().parent.parent / db_path[2:])
    db_dir = Path(db_path).parent
    db_dir.mkdir(parents=True, exist_ok=True)

    # Create engine with check_same_thread=False for SQLite multi-threaded access
    engine = create_engine(
        f"sqlite:///{db_path}",
        echo=False,
        connect_args={"check_same_thread": False},
    )


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable SQLite foreign key support and WAL mode for high concurrency."""
    if is_turso:
        return
    try:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()
    except Exception:
        pass


def init_db():
    """Create all database tables and seed default platforms if needed."""
    SQLModel.metadata.create_all(engine)

    # Seed default platform configs from config/platforms.yaml
    platforms_file = Path(__file__).resolve().parent.parent / "config" / "platforms.yaml"
    if platforms_file.exists():
        with open(platforms_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
            platforms_dict = data.get("platforms", {})

        with Session(engine) as session:
            for key, pdata in platforms_dict.items():
                existing = session.exec(
                    select(PlatformConfig).where(PlatformConfig.platform_key == key)
                ).first()
                if not existing:
                    config = PlatformConfig(
                        platform_key=key,
                        name=pdata.get("name", key),
                        site_pattern=pdata.get("site_pattern", ""),
                        url_regex=pdata.get("url_regex", ""),
                        category=pdata.get("category", "general"),
                        active=pdata.get("active", True),
                    )
                    session.add(config)
            session.commit()


def get_session() -> Generator[Session, None, None]:
    """Dependency for yielding database sessions."""
    with Session(engine, expire_on_commit=False) as session:
        yield session

