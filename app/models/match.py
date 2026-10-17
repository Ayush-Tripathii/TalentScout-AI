"""Match and Scoring Models."""

from datetime import datetime, timezone
import uuid
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Match(SQLModel, table=True):
    """Job to Candidate Match and Explainable Ranking Score."""

    __tablename__ = "matches"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    job_id: str = Field(foreign_key="jobs.id", index=True)
    candidate_id: str = Field(foreign_key="candidates.id", index=True)
    total_score: float = Field(default=0.0, index=True)  # 0.0 - 100.0
    breakdown_json: str = Field(default="{}")  # must_have, nice_have, experience, location, title, semantic
    why_bullets_json: str = Field(default="[]")  # list of explainability points
    missing_skills_json: str = Field(default="[]")  # list of skills lacking
    evaluated_at: datetime = Field(default_factory=get_utc_now)

    # Relationships
    job: Optional["Job"] = Relationship(back_populates="matches")
    candidate: Optional["Candidate"] = Relationship(back_populates="matches")
