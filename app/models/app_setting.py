"""Application Settings and Provider Keys Model."""

from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field


class AppSetting(SQLModel, table=True):
    """Dynamic key-value system settings stored locally in SQLite."""

    __tablename__ = "app_settings"

    key: str = Field(primary_key=True, index=True)
    value: str
    description: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
