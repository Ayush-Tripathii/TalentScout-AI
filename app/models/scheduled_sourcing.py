"""Phase 8 Models: Scheduled Sourcing Jobs and In-App / External Alert Notifications."""

from datetime import datetime, timezone, timedelta
import uuid
from typing import Optional
from sqlmodel import SQLModel, Field


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_default_next_run() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=12)


class ScheduledSourcingJob(SQLModel, table=True):
    """Configuration and state for automated background candidate sourcing on a Job."""

    __tablename__ = "scheduled_sourcing_jobs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    job_id: str = Field(foreign_key="jobs.id", index=True, unique=True)
    is_enabled: bool = Field(default=False, index=True)
    interval_hours: int = Field(default=12)  # 4, 6, 12, 24, 48
    min_score_threshold: float = Field(default=75.0)  # Trigger alert if candidate score >= threshold
    
    # Alert Channels
    alert_email_enabled: bool = Field(default=False)
    alert_email_recipients: Optional[str] = Field(default="")  # Comma-separated emails
    alert_webhook_enabled: bool = Field(default=False)
    alert_webhook_url: Optional[str] = Field(default="")  # Slack/Discord/Teams webhook URL
    
    # Search parameters
    target_platforms_json: str = Field(default='["linkedin", "github", "naukri", "foundit"]')
    include_contact_visible: bool = Field(default=True)
    
    # Execution Tracking
    last_run_at: Optional[datetime] = Field(default=None)
    next_run_at: Optional[datetime] = Field(default_factory=get_default_next_run)
    last_run_status: str = Field(default="idle", index=True)  # idle, running, success, failed
    last_run_summary: Optional[str] = Field(default=None)
    total_runs_count: int = Field(default=0)
    total_candidates_found: int = Field(default=0)
    
    created_at: datetime = Field(default_factory=get_utc_now)
    updated_at: datetime = Field(default_factory=get_utc_now)


class SourcingAlertNotification(SQLModel, table=True):
    """In-App and Dispatched Alert Notifications for High-Fit Candidates."""

    __tablename__ = "sourcing_alert_notifications"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    job_id: str = Field(foreign_key="jobs.id", index=True)
    candidate_id: str = Field(foreign_key="candidates.id", index=True)
    candidate_name: str = Field(default="")
    score: float = Field(default=0.0)
    title: str = Field(default="")
    message: str = Field(default="")
    channels_sent_json: str = Field(default='["in_app"]')  # ["in_app", "email", "webhook"]
    is_read: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=get_utc_now)
