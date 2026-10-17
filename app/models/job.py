"""Job and Search Query Database Models."""

from datetime import datetime, timezone
import uuid
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Job(SQLModel, table=True):
    """Job Requirement Schema."""

    __tablename__ = "jobs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    title: str = Field(index=True)
    alternate_titles: str = Field(default="[]")  # JSON list
    must_have_skills: str = Field(default="[]")  # JSON list
    nice_to_have_skills: str = Field(default="[]")  # JSON list
    min_experience: float = Field(default=0.0)
    max_experience: float = Field(default=30.0)
    locations: str = Field(default="[]")  # JSON list
    open_to_relocate: bool = Field(default=False)
    is_remote: bool = Field(default=False)
    education: Optional[str] = Field(default=None)
    industry: Optional[str] = Field(default=None)
    notice_period: Optional[str] = Field(default="Immediate")  # Immediate, 15 days, 30 days, etc.
    min_ctc: Optional[float] = Field(default=None)  # LPA
    max_ctc: Optional[float] = Field(default=None)  # LPA
    client_name: Optional[str] = Field(default=None)  # Internal use only
    positions_count: int = Field(default=1)
    jd_raw_text: Optional[str] = Field(default=None)
    status: str = Field(default="active", index=True)  # active, closed
    created_at: datetime = Field(default_factory=get_utc_now)
    updated_at: datetime = Field(default_factory=get_utc_now)

    # Relationships
    queries: List["SearchQuery"] = Relationship(back_populates="job", cascade_delete=True)
    matches: List["Match"] = Relationship(back_populates="job", cascade_delete=True)
    pipeline_records: List["PipelineStatus"] = Relationship(back_populates="job", cascade_delete=True)


class SearchQuery(SQLModel, table=True):
    """Boolean Search Query linked to a Job."""

    __tablename__ = "search_queries"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    job_id: str = Field(foreign_key="jobs.id", index=True)
    platform: str = Field(index=True)  # linkedin, github, naukri, etc.
    query_text: str
    contact_visible: bool = Field(default=False)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=get_utc_now)

    # Relationships
    job: Optional[Job] = Relationship(back_populates="queries")
    runs: List["SearchRun"] = Relationship(back_populates="query", cascade_delete=True)


class SearchRun(SQLModel, table=True):
    """Execution history of a SearchQuery."""

    __tablename__ = "search_runs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    query_id: Optional[str] = Field(default=None, foreign_key="search_queries.id", nullable=True, index=True)
    platform: str = Field(index=True)
    executed_at: datetime = Field(default_factory=get_utc_now)
    results_count: int = Field(default=0)
    cached: bool = Field(default=False)
    error_message: Optional[str] = Field(default=None)

    # Relationships
    query: Optional[SearchQuery] = Relationship(back_populates="runs")



class PlatformConfig(SQLModel, table=True):
    """Declarative platform runtime state and toggles."""

    __tablename__ = "platform_configs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    platform_key: str = Field(unique=True, index=True)
    name: str
    site_pattern: str
    url_regex: str
    category: str = Field(default="general")
    active: bool = Field(default=True)
