"""Pipeline, Outreach, and Notes Models."""

from datetime import datetime, timezone
import uuid
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PipelineStatus(SQLModel, table=True):
    """Candidate Pipeline Stage for a specific Job."""

    __tablename__ = "pipeline_statuses"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    job_id: str = Field(foreign_key="jobs.id", index=True)
    candidate_id: str = Field(foreign_key="candidates.id", index=True)
    # Stages: new, shortlisted, rejected, linkedin_note_sent, form_sent, replied, form_submitted, called, interested, not_interested, submitted_to_client, placed
    stage: str = Field(default="new", index=True)
    updated_at: datetime = Field(default_factory=get_utc_now)

    # Relationships
    job: Optional["Job"] = Relationship(back_populates="pipeline_records")
    candidate: Optional["Candidate"] = Relationship(back_populates="pipeline_records")


class OutreachEvent(SQLModel, table=True):
    """Generated outreach events and copy records."""

    __tablename__ = "outreach_events"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    candidate_id: str = Field(foreign_key="candidates.id", index=True)
    job_id: Optional[str] = Field(default=None, foreign_key="jobs.id", index=True)
    channel: str = Field(index=True)  # linkedin_note, inmail, email, whatsapp
    content_draft: str
    form_prefilled_url: Optional[str] = Field(default=None)
    status: str = Field(default="generated", index=True)  # generated, copied, sent
    created_at: datetime = Field(default_factory=get_utc_now)


class Note(SQLModel, table=True):
    """Recruiter Notes on Candidate."""

    __tablename__ = "notes"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    candidate_id: str = Field(foreign_key="candidates.id", index=True)
    author: str = Field(default="Recruiter")
    content: str
    created_at: datetime = Field(default_factory=get_utc_now)

    # Relationships
    candidate: Optional["Candidate"] = Relationship(back_populates="notes")
