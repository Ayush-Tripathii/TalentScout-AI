"""Third-Party Enrichment Credit Tracking Model."""

from datetime import datetime, timezone
import uuid
from typing import Optional
from sqlmodel import SQLModel, Field


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class EnrichmentUsage(SQLModel, table=True):
    """Enrichment API Usage & Credit Consumption Record."""

    __tablename__ = "enrichment_usages"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    provider: str = Field(index=True)  # hunter, apollo
    candidate_id: str = Field(foreign_key="candidates.id", index=True)
    recruiter_name: str = Field(default="Recruiter")
    credits_used: int = Field(default=1)
    credits_remaining: Optional[int] = Field(default=None)
    response_status: str = Field(default="success")  # success, not_found, error, quota_exceeded
    created_at: datetime = Field(default_factory=get_utc_now)
