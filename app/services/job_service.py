"""Job Management Service.

Handles full lifecycle operations for Job Requirements (create, read, update, duplicate, close, delete).
"""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlmodel import Session, select
from app.db import engine
from app.models.job import Job, SearchQuery
from app.models.audit import AuditLog


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class JobService:
    """Service layer for Job entity CRUD operations."""

    @staticmethod
    def create_job(data: Dict[str, Any], performed_by: str = "Recruiter") -> Job:
        """Create and persist a new Job record with full alias normalization."""
        with Session(engine, expire_on_commit=False) as session:
            # Normalize list fields to JSON strings if they are passed as lists
            alternate_titles = data.get("alternate_titles", [])
            if isinstance(alternate_titles, list):
                alternate_titles = json.dumps(alternate_titles)

            must_have = data.get("must_have_skills") or data.get("skills_required") or []
            if isinstance(must_have, str):
                must_have = [s.strip() for s in must_have.split(",") if s.strip()]
            if isinstance(must_have, list):
                must_have = json.dumps(must_have)

            nice_have = data.get("nice_have_skills") or data.get("nice_to_have_skills") or []
            if isinstance(nice_have, str):
                nice_have = [s.strip() for s in nice_have.split(",") if s.strip()]
            if isinstance(nice_have, list):
                nice_have = json.dumps(nice_have)

            locations = data.get("locations") or ([data["location"]] if data.get("location") else [])
            if isinstance(locations, str):
                locations = [l.strip() for l in locations.split(",") if l.strip()]
            if isinstance(locations, list):
                locations = json.dumps(locations)

            min_exp = data.get("min_experience")
            if min_exp is None and data.get("min_experience_years") is not None:
                min_exp = data.get("min_experience_years")
            if min_exp is None:
                min_exp = 0.0

            max_exp = data.get("max_experience")
            if max_exp is None and data.get("max_experience_years") is not None:
                max_exp = data.get("max_experience_years")
            if max_exp is None:
                max_exp = 30.0

            positions = data.get("positions_count")
            if positions is None and data.get("target_roles_count") is not None:
                positions = data.get("target_roles_count")
            if positions is None:
                positions = 1

            max_ctc = data.get("max_ctc")
            if max_ctc is None and data.get("budget_max_inr") is not None:
                budget = float(data["budget_max_inr"])
                max_ctc = round(budget / 100000.0, 1) if budget > 1000 else budget

            min_ctc = float(data["min_ctc"]) if data.get("min_ctc") is not None else None
            jd_text = data.get("jd_raw_text") or data.get("job_description")

            job = Job(
                title=data.get("title", "Untitled Job"),
                alternate_titles=alternate_titles,
                must_have_skills=must_have,
                nice_to_have_skills=nice_have,
                min_experience=float(min_exp),
                max_experience=float(max_exp),
                locations=locations,
                open_to_relocate=bool(data.get("open_to_relocate", False)),
                is_remote=bool(data.get("is_remote", False)),
                education=data.get("education"),
                industry=data.get("industry"),
                notice_period=data.get("notice_period", "Immediate"),
                min_ctc=min_ctc,
                max_ctc=float(max_ctc) if max_ctc is not None else None,
                client_name=data.get("client_name"),
                positions_count=int(positions),
                jd_raw_text=jd_text,
                status=data.get("status", "active"),
                created_at=get_utc_now(),
                updated_at=get_utc_now(),
            )
            session.add(job)
            session.commit()
            session.refresh(job)

            # Record in AuditLog
            audit = AuditLog(
                action="create",
                entity_type="job",
                entity_id=job.id,
                performed_by=performed_by,
                details_json=json.dumps({"title": job.title, "status": job.status}),
                timestamp=get_utc_now(),
            )
            session.add(audit)
            session.commit()
            return job

    @staticmethod
    def get_job(job_id: str) -> Optional[Job]:
        """Fetch a single Job by ID."""
        with Session(engine, expire_on_commit=False) as session:
            return session.get(Job, job_id)

    @staticmethod
    def list_jobs(status: Optional[str] = None) -> List[Job]:
        """List all Jobs, optionally filtered by status ('active', 'closed')."""
        with Session(engine, expire_on_commit=False) as session:
            query = select(Job)
            if status:
                query = query.where(Job.status == status)
            query = query.order_by(Job.created_at.desc())
            return list(session.exec(query).all())

    @staticmethod
    def update_job(job_id: str, updates: Dict[str, Any], performed_by: str = "Recruiter") -> Optional[Job]:
        """Update fields on an existing Job."""
        with Session(engine, expire_on_commit=False) as session:
            job = session.get(Job, job_id)
            if not job:
                return None

            for key, val in updates.items():
                if key in ["alternate_titles", "must_have_skills", "nice_to_have_skills", "locations"] and isinstance(val, list):
                    val = json.dumps(val)
                if hasattr(job, key):
                    setattr(job, key, val)

            job.updated_at = get_utc_now()
            session.add(job)

            audit = AuditLog(
                action="update",
                entity_type="job",
                entity_id=job.id,
                performed_by=performed_by,
                details_json=json.dumps({"updated_fields": list(updates.keys())}),
                timestamp=get_utc_now(),
            )
            session.add(audit)
            session.commit()
            session.refresh(job)
            return job

    @staticmethod
    def duplicate_job(job_id: str, performed_by: str = "Recruiter") -> Optional[Job]:
        """Duplicate an existing Job with a '(Copy)' suffix."""
        with Session(engine, expire_on_commit=False) as session:
            orig = session.get(Job, job_id)
            if not orig:
                return None

            new_job = Job(
                title=f"{orig.title} (Copy)",
                alternate_titles=orig.alternate_titles,
                must_have_skills=orig.must_have_skills,
                nice_to_have_skills=orig.nice_to_have_skills,
                min_experience=orig.min_experience,
                max_experience=orig.max_experience,
                locations=orig.locations,
                open_to_relocate=orig.open_to_relocate,
                is_remote=orig.is_remote,
                education=orig.education,
                industry=orig.industry,
                notice_period=orig.notice_period,
                min_ctc=orig.min_ctc,
                max_ctc=orig.max_ctc,
                client_name=orig.client_name,
                positions_count=orig.positions_count,
                jd_raw_text=orig.jd_raw_text,
                status="active",
                created_at=get_utc_now(),
                updated_at=get_utc_now(),
            )
            session.add(new_job)
            session.commit()
            session.refresh(new_job)

            audit = AuditLog(
                action="duplicate",
                entity_type="job",
                entity_id=new_job.id,
                performed_by=performed_by,
                details_json=json.dumps({"source_job_id": orig.id, "new_title": new_job.title}),
                timestamp=get_utc_now(),
            )
            session.add(audit)
            session.commit()
            return new_job

    @staticmethod
    def close_job(job_id: str, performed_by: str = "Recruiter") -> Optional[Job]:
        """Mark a job as closed/archived."""
        return JobService.update_job(job_id, {"status": "closed"}, performed_by=performed_by)

    @staticmethod
    def delete_job(job_id: str, performed_by: str = "Recruiter") -> bool:
        """Hard delete a job and record audit with clean cascade cleanup."""
        from app.models.match import Match
        from app.models.pipeline import PipelineStatus, OutreachEvent
        from app.models.scheduled_sourcing import ScheduledSourcingJob, SourcingAlertNotification

        with Session(engine, expire_on_commit=False) as session:
            job = session.get(Job, job_id)
            if not job:
                return False
            title = job.title

            # Clean up child records referencing job_id
            for sched in session.exec(select(ScheduledSourcingJob).where(ScheduledSourcingJob.job_id == job_id)).all():
                session.delete(sched)
            for alert in session.exec(select(SourcingAlertNotification).where(SourcingAlertNotification.job_id == job_id)).all():
                session.delete(alert)
            for m in session.exec(select(Match).where(Match.job_id == job_id)).all():
                session.delete(m)
            for ps in session.exec(select(PipelineStatus).where(PipelineStatus.job_id == job_id)).all():
                session.delete(ps)
            for oe in session.exec(select(OutreachEvent).where(OutreachEvent.job_id == job_id)).all():
                session.delete(oe)
            for sq in session.exec(select(SearchQuery).where(SearchQuery.job_id == job_id)).all():
                session.delete(sq)

            session.delete(job)

            audit = AuditLog(
                action="delete",
                entity_type="job",
                entity_id=job_id,
                performed_by=performed_by,
                details_json=json.dumps({"deleted_title": title}),
                timestamp=get_utc_now(),
            )
            session.add(audit)
            session.commit()
            return True
