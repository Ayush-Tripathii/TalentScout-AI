"""Audit Log Database Model for DPDP and Compliance Tracking."""

from datetime import datetime, timezone
from typing import Optional
import uuid
from sqlmodel import SQLModel, Field


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AuditLog(SQLModel, table=True):
    """Immutable Audit Record for Compliance and Activity Trails."""

    __tablename__ = "audit_logs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    action: str = Field(default="system_action", index=True)  # search, contact_reveal, export, delete, update, consent_update
    entity_type: Optional[str] = Field(default="system", index=True)  # candidate, job, contact, export
    entity_id: Optional[str] = Field(default="", index=True)
    performed_by: str = Field(default="system")
    details_json: str = Field(default="{}")
    timestamp: datetime = Field(default_factory=get_utc_now, index=True)
