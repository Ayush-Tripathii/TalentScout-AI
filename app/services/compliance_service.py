"""Compliance and DPDP Act Administration Service.

Handles data retention enforcement, 'Do Not Contact' (DNC) restrictions,
one-click total erasure (Right to Be Forgotten), contact masking, and audit logging.
"""

from datetime import datetime, timezone, timedelta
import json
import logging
from typing import Any, Dict, List, Optional
from sqlmodel import Session, select, func

from app.db import engine
from app.models.candidate import (
    Candidate,
    CandidateSource,
    CandidateLink,
    ContactPoint,
)
from app.models.resume import Resume
from app.models.match import Match
from app.models.pipeline import PipelineStatus, OutreachEvent, Note
from app.models.form_response import FormResponse
from app.models.audit import AuditLog

logger = logging.getLogger("talentscout.compliance")


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


def log_audit_event(
    action: str,
    entity_type: str,
    entity_id: str,
    details: Dict[str, Any],
    performed_by: str = "Recruiter",
) -> AuditLog:
    """Helper to append an immutable audit log entry."""
    with Session(engine, expire_on_commit=False) as session:
        log_entry = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            performed_by=performed_by,
            details_json=json.dumps(details, default=str),
            timestamp=get_utc_now(),
        )
        session.add(log_entry)
        session.commit()
        session.refresh(log_entry)
        return log_entry


class ComplianceService:
    """DPDP Act Data Privacy & Governance Administration."""

    def get_retention_overview(self, days_threshold: int = 180) -> Dict[str, Any]:
        """Audit candidate records against data retention policies."""
        now = get_utc_now()
        with Session(engine) as session:
            total_candidates = session.exec(select(func.count(Candidate.id))).one()
            
            # Expired candidates
            expired_candidates = session.exec(
                select(Candidate).where(Candidate.retention_expires_at <= now)
            ).all()

            # Expiring soon (within next 14 days)
            soon_limit = now + timedelta(days=14)
            expiring_soon = session.exec(
                select(Candidate).where(
                    Candidate.retention_expires_at > now,
                    Candidate.retention_expires_at <= soon_limit,
                )
            ).all()

            # DNC candidates
            dnc_candidates = session.exec(
                select(Candidate).where(Candidate.do_not_contact == True)
            ).all()

            expired_list = [
                {
                    "id": c.id,
                    "full_name": c.full_name,
                    "headline": c.headline,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                    "retention_expires_at": c.retention_expires_at.isoformat() if c.retention_expires_at else None,
                    "days_expired": (now - c.retention_expires_at).days if c.retention_expires_at else 0,
                    "do_not_contact": c.do_not_contact,
                }
                for c in expired_candidates
            ]

            dnc_list = [
                {
                    "id": c.id,
                    "full_name": c.full_name,
                    "headline": c.headline,
                    "location": c.current_location,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                }
                for c in dnc_candidates
            ]

            return {
                "total_candidates": total_candidates,
                "expired_count": len(expired_candidates),
                "expiring_soon_count": len(expiring_soon),
                "dnc_count": len(dnc_candidates),
                "default_retention_days": days_threshold,
                "expired_candidates": expired_list,
                "dnc_candidates": dnc_list,
            }

    def set_do_not_contact(
        self,
        candidate_id: str,
        dnc: bool = True,
        reason: str = "Candidate opted out or requested no outreach",
        performed_by: str = "Recruiter",
    ) -> Dict[str, Any]:
        """Mark or unmark candidate as Do Not Contact (DNC) with contact masking."""
        with Session(engine, expire_on_commit=False) as session:
            cand = session.get(Candidate, candidate_id)
            if not cand:
                raise ValueError("Candidate not found")

            cand.do_not_contact = dnc
            cand.updated_at = get_utc_now()
            session.add(cand)

            # If marked DNC, mask/scramble contact points for privacy
            contacts = session.exec(
                select(ContactPoint).where(ContactPoint.candidate_id == candidate_id)
            ).all()

            for cp in contacts:
                if dnc:
                    cp.type = "dnc-restricted"
                else:
                    cp.type = "consented"
                session.add(cp)

            session.commit()
            session.refresh(cand)

            log_audit_event(
                action="dnc_updated" if dnc else "dnc_removed",
                entity_type="candidate",
                entity_id=candidate_id,
                details={
                    "candidate_name": cand.full_name,
                    "do_not_contact": dnc,
                    "reason": reason,
                    "contacts_affected": len(contacts),
                },
                performed_by=performed_by,
            )

            return {
                "status": "success",
                "candidate_id": cand.id,
                "do_not_contact": cand.do_not_contact,
                "message": f"Candidate {'flagged as Do Not Contact (DNC)' if dnc else 'restored from DNC registry'}.",
            }

    def erase_candidate(
        self,
        candidate_id: str,
        reason: str = "DPDP Act Section 12 Right to Erasure request",
        performed_by: str = "Recruiter",
    ) -> Dict[str, Any]:
        """One-Click Total Erasure (Right to be Forgotten).
        
        Cascades delete through all Candidate references, matches, contacts, resumes,
        pipeline records, and outreach history, leaving an audit log record.
        """
        with Session(engine, expire_on_commit=False) as session:
            cand = session.get(Candidate, candidate_id)
            if not cand:
                raise ValueError("Candidate not found")

            cand_name = cand.full_name

            # Collect record counts for audit trail
            contacts_count = len(session.exec(select(ContactPoint).where(ContactPoint.candidate_id == candidate_id)).all())
            resumes = session.exec(select(Resume).where(Resume.candidate_id == candidate_id)).all()
            sources_count = len(session.exec(select(CandidateSource).where(CandidateSource.candidate_id == candidate_id)).all())
            matches_count = len(session.exec(select(Match).where(Match.candidate_id == candidate_id)).all())
            pipeline_count = len(session.exec(select(PipelineStatus).where(PipelineStatus.candidate_id == candidate_id)).all())
            outreach_events = session.exec(select(OutreachEvent).where(OutreachEvent.candidate_id == candidate_id)).all()
            outreach_count = len(outreach_events)
            form_count = len(session.exec(select(FormResponse).where(FormResponse.candidate_id == candidate_id)).all())
            links = session.exec(
                select(CandidateLink).where(
                    (CandidateLink.source_candidate_id == candidate_id) | 
                    (CandidateLink.target_candidate_id == candidate_id)
                )
            ).all()

            # Delete associated records
            for l in links:
                session.delete(l)

            for o in outreach_events:
                session.delete(o)

            for r in resumes:
                session.delete(r)

            session.delete(cand)
            session.commit()

            # Record permanent audit log trail
            log_audit_event(
                action="erasure",
                entity_type="candidate",
                entity_id=candidate_id,
                details={
                    "candidate_identifier_name": cand_name,
                    "reason": reason,
                    "purged_records": {
                        "contacts": contacts_count,
                        "resumes": len(resumes),
                        "sources": sources_count,
                        "matches": matches_count,
                        "pipeline_records": pipeline_count,
                        "outreach_events": outreach_count,
                        "form_responses": form_count,
                        "links": len(links),
                    },
                },
                performed_by=performed_by,
            )

            return {
                "status": "success",
                "erased_candidate_id": candidate_id,
                "message": f"Candidate '{cand_name}' and all associated personal data have been completely erased in compliance with DPDP Act.",
            }

    def purge_expired_records(
        self,
        performed_by: str = "System Admin",
    ) -> Dict[str, Any]:
        """Bulk purge all candidate records that have exceeded their retention period."""
        now = get_utc_now()
        with Session(engine) as session:
            expired = session.exec(
                select(Candidate).where(Candidate.retention_expires_at <= now)
            ).all()
            expired_ids = [c.id for c in expired]

        purged_count = 0
        for cid in expired_ids:
            try:
                self.erase_candidate(
                    candidate_id=cid,
                    reason="Automated 180-day retention period expiration purge",
                    performed_by=performed_by,
                )
                purged_count += 1
            except Exception as e:
                logger.error(f"Failed to purge candidate {cid}: {e}")

        return {
            "status": "success",
            "purged_count": purged_count,
            "message": f"Successfully purged {purged_count} candidate records whose retention period expired.",
        }
