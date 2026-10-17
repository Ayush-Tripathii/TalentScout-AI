"""User Model for Role-Based Access Control and Authentication."""

from datetime import datetime, timezone
from typing import Optional
import uuid
from sqlmodel import SQLModel, Field


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    """User account model for recruiters and system administrators."""

    __tablename__ = "users"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    email: str = Field(unique=True, index=True)
    full_name: str
    phone: Optional[str] = Field(default=None)
    designation: Optional[str] = Field(default=None)
    password_hash: str
    role: str = Field(default="recruiter", index=True)  # "admin", "recruiter", "manager"
    company: str = Field(default="Staffing Agency")
    user_api_key: Optional[str] = Field(default=None, index=True)
    api_keys_json: Optional[str] = Field(default="{}")
    notes: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=get_utc_now)
    last_login_at: Optional[datetime] = Field(default=None)
