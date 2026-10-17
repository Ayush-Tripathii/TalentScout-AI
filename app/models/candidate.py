"""Candidate, CandidateSource, CandidateLink, and ContactPoint Models."""

from datetime import datetime, timezone, timedelta
import uuid
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_default_retention() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=180)


class Candidate(SQLModel, table=True):
    """Canonical Candidate Record."""

    __tablename__ = "candidates"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    full_name: str = Field(index=True)
    headline: Optional[str] = Field(default=None)
    current_location: Optional[str] = Field(default=None, index=True)
    experience_years: Optional[float] = Field(default=None)
    skills_json: str = Field(default="[]")  # List of normalized skills
    data_completeness: str = Field(default="low_data_snippet", index=True)  # low_data_snippet, full_resume
    do_not_contact: bool = Field(default=False, index=True)
    retention_expires_at: datetime = Field(default_factory=get_default_retention, index=True)
    created_at: datetime = Field(default_factory=get_utc_now)
    updated_at: datetime = Field(default_factory=get_utc_now)

    # Relationships
    sources: List["CandidateSource"] = Relationship(back_populates="candidate", cascade_delete=True)
    contacts: List["ContactPoint"] = Relationship(back_populates="candidate", cascade_delete=True)
    resumes: List["Resume"] = Relationship(back_populates="candidate", cascade_delete=True)
    matches: List["Match"] = Relationship(back_populates="candidate", cascade_delete=True)
    pipeline_records: List["PipelineStatus"] = Relationship(back_populates="candidate", cascade_delete=True)
    notes: List["Note"] = Relationship(back_populates="candidate", cascade_delete=True)
    form_responses: List["FormResponse"] = Relationship(back_populates="candidate", cascade_delete=True)


class CandidateSource(SQLModel, table=True):
    """Platform provenance record for Candidate."""

    __tablename__ = "candidate_sources"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    candidate_id: str = Field(foreign_key="candidates.id", index=True)
    platform: str = Field(index=True)  # linkedin, github, naukri, etc.
    url: str = Field(index=True)
    raw_title: Optional[str] = Field(default=None)
    raw_snippet: Optional[str] = Field(default=None)
    retrieved_at: datetime = Field(default_factory=get_utc_now)

    # Relationships
    candidate: Optional[Candidate] = Relationship(back_populates="sources")


class CandidateLink(SQLModel, table=True):
    """Cross-platform identity merge suggestion/link."""

    __tablename__ = "candidate_links"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    source_candidate_id: str = Field(foreign_key="candidates.id", index=True)
    target_candidate_id: str = Field(foreign_key="candidates.id", index=True)
    confidence: float = Field(default=0.0)  # 0.0 to 1.0
    reasons_json: str = Field(default="[]")
    status: str = Field(default="suggested", index=True)  # suggested, confirmed, rejected
    created_at: datetime = Field(default_factory=get_utc_now)


class ContactPoint(SQLModel, table=True):
    """Acquired Contact Detail with strict provenance tracking."""

    __tablename__ = "contact_points"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    candidate_id: str = Field(foreign_key="candidates.id", index=True)
    kind: str = Field(index=True)  # email, phone, url
    value: str = Field(index=True)
    # Provenance hierarchy: consented > public > public-snippet > enriched > manual-public
    type: str = Field(index=True)
    source_reference: Optional[str] = Field(default=None)  # URL, snippet hash, provider, etc.
    found_at: datetime = Field(default_factory=get_utc_now)
    added_by: Optional[str] = Field(default="system")  # system, recruiter name

    # Relationships
    candidate: Optional[Candidate] = Relationship(back_populates="contacts")
