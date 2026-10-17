"""Resume and Document Database Models."""

from datetime import datetime, timezone
import uuid
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Resume(SQLModel, table=True):
    """Parsed Resume Document Record."""

    __tablename__ = "resumes"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    candidate_id: str = Field(foreign_key="candidates.id", index=True)
    file_path: str
    file_hash: str = Field(index=True)  # SHA256 checksum to prevent duplicate ingestion
    file_format: str = Field(default="pdf")  # pdf, docx
    parsed_raw_text: Optional[str] = Field(default=None)
    parsed_fields_json: str = Field(default="{}")  # education, experience, extracted skills
    ingested_source: str = Field(default="upload", index=True)  # upload, watch_folder, gmail, form, public_crawler
    created_at: datetime = Field(default_factory=get_utc_now)

    # Relationships
    candidate: Optional["Candidate"] = Relationship(back_populates="resumes")

    @property
    def raw_text(self) -> Optional[str]:
        return self.parsed_raw_text

    @property
    def filename(self) -> str:
        from pathlib import Path
        return Path(self.file_path).name if self.file_path else "resume.pdf"

    @property
    def parsed_at(self) -> datetime:
        return self.created_at
