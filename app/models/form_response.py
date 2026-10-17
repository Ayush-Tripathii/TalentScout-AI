"""Consent-based Interest Form Response Model."""

from datetime import datetime, timezone
import uuid
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class FormResponse(SQLModel, table=True):
    """Inbound Google Sheet Interest Form Submission."""

    __tablename__ = "form_responses"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    reference_id: Optional[str] = Field(default=None, index=True)  # Candidate reference ID passed via form query
    candidate_id: Optional[str] = Field(default=None, foreign_key="candidates.id", index=True)
    full_name: str
    email: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)
    linkedin_url: Optional[str] = Field(default=None)
    current_ctc: Optional[str] = Field(default=None)
    expected_ctc: Optional[str] = Field(default=None)
    notice_period: Optional[str] = Field(default=None)
    current_location: Optional[str] = Field(default=None)
    resume_file_url: Optional[str] = Field(default=None)
    consent_given: bool = Field(default=True)
    submitted_at: datetime = Field(default_factory=get_utc_now)
    processed_at: Optional[datetime] = Field(default=None)

    # Relationships
    candidate: Optional["Candidate"] = Relationship(back_populates="form_responses")
