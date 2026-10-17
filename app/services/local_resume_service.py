"""Local Resume Ingestion and Watch Folder Service.

Handles bulk file upload, deduplication by file hash, candidate creation,
and background directory monitoring via watchdog.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from sqlmodel import Session, select
from app.db import engine
from app.models.candidate import Candidate, CandidateSource, ContactPoint
from app.models.resume import Resume
from app.models.audit import AuditLog
from app.services.parser.resume_parser import ResumeParser

logger = logging.getLogger("talentscout.local_resume")
BASE_DIR = Path(__file__).resolve().parent.parent.parent


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class LocalResumeService:
    """Service for local PDF/DOCX resume ingestion and watch folder management."""

    def __init__(self):
        self.parser = ResumeParser()
        self.upload_dir = BASE_DIR / "uploads" / "resumes"
        self.watch_dir = BASE_DIR / "uploads" / "watch_folder"
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.watch_dir.mkdir(parents=True, exist_ok=True)

    def ingest_resume_file(
        self,
        filepath: Path,
        source_type: str = "upload",
        performed_by: str = "Recruiter",
    ) -> Optional[Dict[str, Any]]:
        """Ingest and parse a resume file, persisting candidate and resume to DB."""
        if not filepath.exists() or filepath.suffix.lower() not in [".pdf", ".docx", ".doc"]:
            return None

        # 1. Parse document
        parsed = self.parser.parse_file(filepath)
        file_hash = parsed["file_hash"]

        with Session(engine, expire_on_commit=False) as session:
            # 2. Prevent duplicate file ingestion
            existing_resume = session.exec(
                select(Resume).where(Resume.file_hash == file_hash)
            ).first()
            if existing_resume:
                logger.info(f"Resume {filepath.name} already ingested (hash match).")
                cand = session.get(Candidate, existing_resume.candidate_id)
                return {
                    "status": "already_exists",
                    "resume_id": existing_resume.id,
                    "candidate_id": cand.id if cand else None,
                    "name": cand.full_name if cand else parsed["name"],
                }

            # 3. Create or find Candidate
            # Check by primary email if present
            candidate = None
            if parsed["emails"]:
                primary_email = parsed["emails"][0]
                existing_contact = session.exec(
                    select(ContactPoint).where(
                        ContactPoint.kind == "email",
                        ContactPoint.value == primary_email,
                    )
                ).first()
                if existing_contact:
                    candidate = session.get(Candidate, existing_contact.candidate_id)

            if not candidate:
                candidate = Candidate(
                    full_name=parsed["name"],
                    headline=parsed["headline"],
                    current_location=parsed["location"],
                    experience_years=parsed["experience_years"],
                    skills_json=json.dumps(parsed["skills"]),
                    data_completeness="full_resume",
                    created_at=get_utc_now(),
                    updated_at=get_utc_now(),
                )
                session.add(candidate)
                session.commit()
                session.refresh(candidate)
            else:
                # Upgrade completeness to full_resume
                candidate.data_completeness = "full_resume"
                candidate.updated_at = get_utc_now()
                session.add(candidate)

            # 4. Save Resume record
            resume = Resume(
                candidate_id=candidate.id,
                file_path=str(filepath),
                file_hash=file_hash,
                file_format=parsed["file_format"],
                parsed_raw_text=parsed["raw_text"],
                parsed_fields_json=json.dumps({
                    "skills": parsed["skills"],
                    "education": parsed["education"],
                    "experience_years": parsed["experience_years"],
                }),
                ingested_source=source_type,
                created_at=get_utc_now(),
            )
            session.add(resume)

            # 5. Save CandidateSource
            source = CandidateSource(
                candidate_id=candidate.id,
                platform=source_type,
                url=f"file://{filepath}",
                raw_title=f"Resume: {filepath.name}",
                raw_snippet=parsed["raw_text"][:300],
                retrieved_at=get_utc_now(),
            )
            session.add(source)

            # 6. Save ContactPoints
            for email in parsed["emails"]:
                session.add(
                    ContactPoint(
                        candidate_id=candidate.id,
                        kind="email",
                        value=email,
                        type="public",
                        source_reference=str(filepath),
                        found_at=get_utc_now(),
                        added_by=performed_by,
                    )
                )

            for phone in parsed["phones"]:
                session.add(
                    ContactPoint(
                        candidate_id=candidate.id,
                        kind="phone",
                        value=phone,
                        type="public",
                        source_reference=str(filepath),
                        found_at=get_utc_now(),
                        added_by=performed_by,
                    )
                )

            # 7. AuditLog
            audit = AuditLog(
                action="ingest_resume",
                entity_type="resume",
                entity_id=resume.id,
                performed_by=performed_by,
                details_json=json.dumps({
                    "filename": filepath.name,
                    "candidate_id": candidate.id,
                    "source": source_type,
                }),
                timestamp=get_utc_now(),
            )
            session.add(audit)
            session.commit()

            return {
                "status": "ingested",
                "resume_id": resume.id,
                "candidate_id": candidate.id,
                "name": candidate.full_name,
                "skills": parsed["skills"],
                "experience_years": parsed["experience_years"],
                "contacts": parsed["emails"] + parsed["phones"],
            }

    def process_watch_folder(self) -> List[Dict[str, Any]]:
        """Scan watch folder and ingest any unparsed PDF or DOCX files."""
        results = []
        for file in self.watch_dir.iterdir():
            if file.is_file() and file.suffix.lower() in [".pdf", ".docx", ".doc"]:
                res = self.ingest_resume_file(file, source_type="watch_folder")
                if res:
                    results.append(res)
        return results

    def list_ingested_resumes(self) -> List[Dict[str, Any]]:
        """List all parsed resumes with associated candidate details."""
        with Session(engine, expire_on_commit=False) as session:
            resumes = session.exec(select(Resume).order_by(Resume.created_at.desc())).all()
            output = []
            for r in resumes:
                cand = session.get(Candidate, r.candidate_id)
                fields = json.loads(r.parsed_fields_json) if r.parsed_fields_json else {}
                output.append({
                    "id": r.id,
                    "candidate_id": r.candidate_id,
                    "candidate_name": cand.full_name if cand else "Unknown",
                    "file_name": Path(r.file_path).name,
                    "file_format": r.file_format,
                    "ingested_source": r.ingested_source,
                    "skills": fields.get("skills", []),
                    "experience_years": fields.get("experience_years", 0),
                    "created_at": r.created_at.strftime("%Y-%m-%d %H:%M"),
                })
            return output
