"""Operations Dashboard & System Analytics Service.

Aggregates daily sourcing metrics, pipeline funnel metrics, enrichment usage,
immutable audit log filtering, and ranking engine weight configuration.
"""

from datetime import datetime, timezone, timedelta
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from sqlmodel import Session, select, func, desc

from app.db import engine
from app.models.candidate import Candidate, CandidateSource, ContactPoint
from app.models.job import Job
from app.models.pipeline import PipelineStatus, OutreachEvent
from app.models.form_response import FormResponse
from app.models.enrichment import EnrichmentUsage
from app.models.audit import AuditLog

logger = logging.getLogger("talentscout.operations")

CONFIG_FILE = Path(__file__).resolve().parent.parent.parent / "config" / "system_settings.json"


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class OperationsService:
    """Operations Monitoring & System Configuration Engine."""

    def __init__(self):
        self._ensure_config_file()

    def _ensure_config_file(self):
        if not CONFIG_FILE.exists():
            default_config = {
                "retention_days": 180,
                "default_llm_model": "qwen2.5:7b",
                "ranking_weights": {
                    "must_have": 40,
                    "nice_to_have": 15,
                    "experience": 15,
                    "location": 10,
                    "title": 10,
                    "semantic": 10,
                },
                "dnc_auto_mask": True,
            }
            CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(default_config, f, indent=2)

    def get_system_config(self) -> Dict[str, Any]:
        """Load system configuration from JSON."""
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {
                "retention_days": 180,
                "default_llm_model": "qwen2.5:7b",
                "ranking_weights": {
                    "must_have": 40,
                    "nice_to_have": 15,
                    "experience": 15,
                    "location": 10,
                    "title": 10,
                    "semantic": 10,
                },
            }

    def update_system_config(self, updates: Dict[str, Any], performed_by: str = "Admin") -> Dict[str, Any]:
        """Update system settings with audit log recording."""
        cfg = self.get_system_config()
        cfg.update(updates)

        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)

        with Session(engine) as session:
            log_entry = AuditLog(
                action="settings_update",
                entity_type="system_config",
                entity_id="global",
                performed_by=performed_by,
                details_json=json.dumps(updates),
                timestamp=get_utc_now(),
            )
            session.add(log_entry)
            session.commit()

        return {"status": "success", "config": cfg}

    def get_operations_metrics(self) -> Dict[str, Any]:
        """Aggregate comprehensive system operational metrics."""
        with Session(engine) as session:
            total_jobs = session.exec(select(func.count(Job.id))).one()
            total_candidates = session.exec(select(func.count(Candidate.id))).one()
            total_sources = session.exec(select(func.count(CandidateSource.id))).one()
            total_contacts = session.exec(select(func.count(ContactPoint.id))).one()

            # Contact point breakdown
            email_contacts = session.exec(
                select(func.count(ContactPoint.id)).where(ContactPoint.kind == "email")
            ).one()
            phone_contacts = session.exec(
                select(func.count(ContactPoint.id)).where(ContactPoint.kind == "phone")
            ).one()
            verified_contacts = session.exec(
                select(func.count(ContactPoint.id)).where(
                    ContactPoint.type.in_(["consented", "enriched", "public-snippet", "public"])
                )
            ).one()

            # Pipeline stage distribution
            pipeline_records = session.exec(select(PipelineStatus)).all()
            stages_count: Dict[str, int] = {
                "new": 0,
                "screening": 0,
                "shortlisted": 0,
                "interview": 0,
                "offered": 0,
                "rejected": 0,
            }
            for p in pipeline_records:
                st = (p.stage or "new").lower()
                stages_count[st] = stages_count.get(st, 0) + 1

            # Platform breakdown from sources
            sources = session.exec(select(CandidateSource)).all()
            platform_counts: Dict[str, int] = {}
            for s in sources:
                p = (s.platform or "other").lower()
                platform_counts[p] = platform_counts.get(p, 0) + 1

            # Outreach and forms
            outreach_count = session.exec(select(func.count(OutreachEvent.id))).one()
            forms_count = session.exec(select(func.count(FormResponse.id))).one()

            # Enrichment usage
            enrichments = session.exec(select(EnrichmentUsage)).all()
            enrichment_stats = {
                "total_requests": len(enrichments),
                "successful": sum(1 for e in enrichments if e.response_status == "success"),
                "hunter_calls": sum(1 for e in enrichments if e.provider == "hunter"),
                "apollo_calls": sum(1 for e in enrichments if e.provider == "apollo"),
            }

            # Compliance stats
            dnc_count = session.exec(
                select(func.count(Candidate.id)).where(Candidate.do_not_contact == True)
            ).one()
            now = get_utc_now()
            expired_count = session.exec(
                select(func.count(Candidate.id)).where(Candidate.retention_expires_at <= now)
            ).one()

            return {
                "summary": {
                    "total_jobs": total_jobs,
                    "total_candidates": total_candidates,
                    "total_sources": total_sources,
                    "total_contacts": total_contacts,
                    "verified_contacts": verified_contacts,
                    "verified_emails": email_contacts,
                    "verified_phones": phone_contacts,
                    "outreach_events": outreach_count,
                    "form_submissions": forms_count,
                    "dnc_records": dnc_count,
                    "expired_records": expired_count,
                },
                "pipeline_funnel": stages_count,
                "platform_distribution": platform_counts,
                "enrichment_usage": enrichment_stats,
            }

    def get_audit_logs(
        self,
        action: Optional[str] = None,
        entity_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Fetch immutable audit logs with optional filtering."""
        with Session(engine) as session:
            stmt = select(AuditLog)
            if action:
                stmt = stmt.where(AuditLog.action == action)
            if entity_type:
                stmt = stmt.where(AuditLog.entity_type == entity_type)

            total_count = len(session.exec(stmt).all())
            logs = session.exec(
                stmt.order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit)
            ).all()

            formatted = []
            for item in logs:
                details = {}
                if item.details_json:
                    try:
                        details = json.loads(item.details_json)
                    except Exception:
                        details = {"raw": item.details_json}

                formatted.append({
                    "id": item.id,
                    "action": item.action,
                    "entity_type": item.entity_type,
                    "entity_id": item.entity_id,
                    "performed_by": item.performed_by,
                    "timestamp": item.timestamp.isoformat() if item.timestamp else None,
                    "details": details,
                })

            return {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "logs": formatted,
            }
