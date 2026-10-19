"""Phase 8 Scheduler Service.

Manages automated background sourcing schedules per job, executes autonomous search
runs, calculates candidate match scores, and dispatches high-fit alerts.
"""

import json
import logging
import threading
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from sqlmodel import Session, select

from app.db import engine
from app.models.job import Job
from app.models.candidate import Candidate
from app.models.pipeline import PipelineStatus
from app.models.match import Match
from app.models.audit import AuditLog
from app.models.scheduled_sourcing import ScheduledSourcingJob, SourcingAlertNotification
from app.services.sourcing_service import SourcingService
from app.services.alert_service import AlertService

logger = logging.getLogger("talentscout.scheduler_service")


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SchedulerService:
    """Manages persistent automated sourcing schedules and executes background cycles."""

    def __init__(self):
        self.sourcing_service = SourcingService()
        self._background_thread = None
        self._stop_event = threading.Event()

    def get_or_create_schedule(self, job_id: str, session: Session) -> Optional[ScheduledSourcingJob]:
        """Fetch existing schedule for job, or initialize default."""
        job = session.get(Job, job_id)
        if not job:
            return None

        schedule = session.exec(
            select(ScheduledSourcingJob).where(ScheduledSourcingJob.job_id == job_id)
        ).first()

        if not schedule:
            schedule = ScheduledSourcingJob(
                job_id=job_id,
                is_enabled=False,
                interval_hours=12,
                min_score_threshold=75.0,
                alert_email_enabled=False,
                alert_email_recipients="",
                alert_webhook_enabled=False,
                alert_webhook_url="",
                target_platforms_json=json.dumps(["linkedin", "github", "naukri", "foundit"]),
                include_contact_visible=True,
                last_run_status="idle",
                next_run_at=get_utc_now() + timedelta(hours=12),
                created_at=get_utc_now(),
                updated_at=get_utc_now(),
            )
            session.add(schedule)
            session.commit()
            session.refresh(schedule)

        return schedule

    def list_all_schedules(self, session: Session) -> List[Dict[str, Any]]:
        """Return list of all jobs with their schedule and alert status."""
        jobs = session.exec(select(Job).where(Job.status == "active")).all()
        result = []

        for job in jobs:
            schedule = self.get_or_create_schedule(job.id, session)
            platforms = json.loads(schedule.target_platforms_json) if schedule.target_platforms_json else []
            
            # Count high-fit alerts for this job
            alerts_count = len(session.exec(
                select(SourcingAlertNotification).where(SourcingAlertNotification.job_id == job.id)
            ).all())

            # Count unread alerts for this job
            unread_alerts = len(session.exec(
                select(SourcingAlertNotification).where(
                    SourcingAlertNotification.job_id == job.id,
                    SourcingAlertNotification.is_read == False,
                )
            ).all())

            result.append({
                "job_id": job.id,
                "job_title": job.title,
                "client_name": job.client_name or "In-House",
                "schedule_id": schedule.id,
                "is_enabled": schedule.is_enabled,
                "interval_hours": schedule.interval_hours,
                "min_score_threshold": schedule.min_score_threshold,
                "alert_email_enabled": schedule.alert_email_enabled,
                "alert_email_recipients": schedule.alert_email_recipients,
                "alert_webhook_enabled": schedule.alert_webhook_enabled,
                "alert_webhook_url": schedule.alert_webhook_url,
                "target_platforms": platforms,
                "include_contact_visible": schedule.include_contact_visible,
                "last_run_at": schedule.last_run_at.isoformat() if schedule.last_run_at else None,
                "next_run_at": schedule.next_run_at.isoformat() if schedule.next_run_at else None,
                "last_run_status": schedule.last_run_status,
                "last_run_summary": schedule.last_run_summary,
                "total_runs_count": schedule.total_runs_count,
                "total_candidates_found": schedule.total_candidates_found,
                "alerts_count": alerts_count,
                "unread_alerts": unread_alerts,
            })

        return result

    def configure_schedule(
        self,
        job_id: str,
        config: Dict[str, Any],
        session: Session,
    ) -> Optional[ScheduledSourcingJob]:
        """Update schedule configuration parameters for a job."""
        schedule = self.get_or_create_schedule(job_id, session)
        if not schedule:
            return None

        if "is_enabled" in config:
            schedule.is_enabled = bool(config["is_enabled"])
        if "interval_hours" in config:
            schedule.interval_hours = max(1, int(config["interval_hours"]))
        if "min_score_threshold" in config:
            schedule.min_score_threshold = float(config["min_score_threshold"])
        if "alert_email_enabled" in config:
            schedule.alert_email_enabled = bool(config["alert_email_enabled"])
        if "alert_email_recipients" in config:
            schedule.alert_email_recipients = str(config["alert_email_recipients"]).strip()
        if "alert_webhook_enabled" in config:
            schedule.alert_webhook_enabled = bool(config["alert_webhook_enabled"])
        if "alert_webhook_url" in config:
            schedule.alert_webhook_url = str(config["alert_webhook_url"]).strip()
        if "target_platforms" in config:
            platforms = config["target_platforms"]
            schedule.target_platforms_json = json.dumps(platforms if isinstance(platforms, list) else ["linkedin", "github"])
        if "include_contact_visible" in config:
            schedule.include_contact_visible = bool(config["include_contact_visible"])

        # Reset next run time if enabled
        if schedule.is_enabled and (not schedule.next_run_at or schedule.next_run_at <= get_utc_now()):
            schedule.next_run_at = get_utc_now() + timedelta(hours=schedule.interval_hours)

        schedule.updated_at = get_utc_now()
        session.add(schedule)
        session.commit()
        session.refresh(schedule)

        # Audit log entry
        audit = AuditLog(
            action="configure_automated_sourcing",
            entity_type="job",
            entity_id=job_id,
            performed_by="Recruiter",
            details_json=json.dumps({
                "enabled": schedule.is_enabled,
                "interval_hours": schedule.interval_hours,
                "threshold": schedule.min_score_threshold,
            }),
            timestamp=get_utc_now(),
        )
        session.add(audit)
        session.commit()

        return schedule

    def toggle_schedule(self, job_id: str, is_enabled: bool, session: Session) -> ScheduledSourcingJob:
        """Toggle active auto-sourcing schedule on or off."""
        return self.configure_schedule(job_id, {"is_enabled": is_enabled}, session)

    def run_sourcing_cycle(
        self,
        job_id: str,
        session: Session,
        triggered_by: str = "AutomatedScheduler",
    ) -> Dict[str, Any]:
        """Execute a full automated sourcing and scoring cycle for a job."""
        job = session.get(Job, job_id)
        if not job:
            return {"success": False, "error": "Job not found"}

        schedule = self.get_or_create_schedule(job_id, session)
        schedule.last_run_status = "running"
        session.add(schedule)
        session.commit()

        start_time = get_utc_now()
        target_platforms = json.loads(schedule.target_platforms_json) if schedule.target_platforms_json else ["linkedin", "github"]
        
        try:
            # 1. Generate platform queries for this job
            queries = self.sourcing_service.generate_job_queries(
                job_id=job_id,
                contact_visible=schedule.include_contact_visible,
            )

            # Filter queries to target platforms only
            active_queries = [q for q in queries if q.get("platform") in target_platforms]
            if not active_queries:
                active_queries = queries[:3]  # fallback to top queries

            newly_ingested = []
            alerts_dispatched = []

            # 2. Execute each query
            for q in active_queries:
                platform = q.get("platform", "web")
                q_text = q.get("query_text", "")
                if not q_text:
                    continue

                results = self.sourcing_service.execute_query(
                    job_id=job_id,
                    platform=platform,
                    query_text=q_text,
                    limit=10,
                    performed_by=triggered_by,
                )

                for r in results:
                    cid = r.get("candidate_id")
                    if cid and cid not in [c["candidate_id"] for c in newly_ingested]:
                        newly_ingested.append(r)

            # 3. Check for high-fit candidates exceeding threshold
            for r in newly_ingested:
                cid = r.get("candidate_id")
                score_val = r.get("match_score") or r.get("score") or r.get("total_score") or r.get("overall_score") or 0.0
                score = float(score_val)
                
                if score >= schedule.min_score_threshold:
                    cand = session.get(Candidate, cid)
                    if cand:
                        # Check if an alert was already dispatched recently for this candidate & job
                        existing_alert = session.exec(
                            select(SourcingAlertNotification).where(
                                SourcingAlertNotification.job_id == job_id,
                                SourcingAlertNotification.candidate_id == cand.id,
                            )
                        ).first()

                        if not existing_alert:
                            alert_res = AlertService.dispatch_candidate_alert(
                                job=job,
                                candidate=cand,
                                score=score,
                                schedule=schedule,
                                session=session,
                            )
                            alerts_dispatched.append({
                                "candidate_name": cand.full_name,
                                "score": score,
                                "channels": alert_res["channels_dispatched"],
                            })

            # 4. Update schedule tracking state
            run_summary = (
                f"Discovered {len(newly_ingested)} candidates "
                f"({len(alerts_dispatched)} high-fit alerts sent ≥ {schedule.min_score_threshold}%)"
            )

            schedule.last_run_at = get_utc_now()
            schedule.next_run_at = get_utc_now() + timedelta(hours=schedule.interval_hours)
            schedule.last_run_status = "success"
            schedule.last_run_summary = run_summary
            schedule.total_runs_count += 1
            schedule.total_candidates_found += len(newly_ingested)
            schedule.updated_at = get_utc_now()
            session.add(schedule)

            # Audit log
            audit = AuditLog(
                action="automated_sourcing_cycle_completed",
                entity_type="job",
                entity_id=job.id,
                performed_by=triggered_by,
                details_json=json.dumps({
                    "summary": run_summary,
                    "candidates_discovered": len(newly_ingested),
                    "alerts_sent": len(alerts_dispatched),
                }),
                timestamp=get_utc_now(),
            )
            session.add(audit)
            session.commit()

            return {
                "success": True,
                "job_id": job.id,
                "job_title": job.title,
                "candidates_discovered": len(newly_ingested),
                "alerts_sent": len(alerts_dispatched),
                "alerts_details": alerts_dispatched,
                "summary": run_summary,
                "duration_seconds": (get_utc_now() - start_time).total_seconds(),
            }

        except Exception as e:
            logger.exception("Error executing automated sourcing cycle for job %s: %s", job_id, str(e))
            schedule.last_run_status = "failed"
            schedule.last_run_summary = f"Execution error: {str(e)[:150]}"
            session.add(schedule)
            session.commit()
            return {"success": False, "error": str(e)}

    def check_and_run_due_schedules(self) -> List[Dict[str, Any]]:
        """Run all enabled schedules that have reached or passed their next_run_at time."""
        now = get_utc_now()
        results = []

        with Session(engine, expire_on_commit=False) as session:
            due_schedules = session.exec(
                select(ScheduledSourcingJob).where(
                    ScheduledSourcingJob.is_enabled == True,
                    ScheduledSourcingJob.next_run_at <= now,
                    ScheduledSourcingJob.last_run_status != "running",
                )
            ).all()

            for sched in due_schedules:
                logger.info("Executing due automated sourcing for job %s", sched.job_id)
                res = self.run_sourcing_cycle(sched.job_id, session, triggered_by="SystemCron")
                results.append(res)

        return results
