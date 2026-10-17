"""Outreach Helper Service.

Generates personalized, high-conversion multi-channel outreach drafts:
1. LinkedIn Connection Request (Strictly <= 300 characters)
2. Recruiter InMail Message
3. Formal Email (Subject + Structured Body)
4. WhatsApp Template with Emoji Accents & Direct Form Link

Tracks outreach lifecycle in OutreachEvent (generated -> copied -> sent).
"""

from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional
from sqlmodel import Session, select
from app.db import engine
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.match import Match
from app.models.pipeline import OutreachEvent


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class OutreachService:
    """Multi-channel candidate outreach generator and tracker."""

    def generate_candidate_outreach(
        self,
        candidate_id: str,
        job_id: str,
        recruiter_name: str = "Talent Acquisition Team",
        company_name: str = "Our Client / In-House Engineering",
        base_form_url: str = "http://localhost:5173/interest"
    ) -> Dict[str, Any]:
        """Generate tailored outreach messages across 4 distinct communication channels."""
        with Session(engine, expire_on_commit=False) as session:
            candidate = session.get(Candidate, candidate_id)
            job = session.get(Job, job_id)

            if not candidate or not job:
                raise ValueError("Candidate or Job not found.")

            # Retrieve candidate match data if available
            match = session.exec(
                select(Match).where(
                    Match.candidate_id == candidate_id,
                    Match.job_id == job_id
                )
            ).first()

            skills_matched = []
            if match and match.breakdown_json:
                try:
                    bd = json.loads(match.breakdown_json)
                    skills_matched = bd.get("matched_skills", [])
                except Exception:
                    pass

            # Fallback to candidate headline/skills or job skills
            cand_skills = json.loads(candidate.skills_json) if candidate.skills_json else []
            must_skills = json.loads(job.must_have_skills) if job.must_have_skills else []
            highlight_skills = skills_matched or cand_skills[:3] or must_skills[:3] or ["Software Engineering"]
            skills_str = ", ".join(highlight_skills[:2])

            first_name = candidate.full_name.split()[0] if candidate.full_name else "Hi"
            job_title = job.title or "Software Developer"
            locations_list = json.loads(job.locations) if job.locations else []
            location = locations_list[0] if locations_list else "India"
            work_mode = "Remote" if job.is_remote else "Hybrid / Full-Time"
            budget_str = f"up to ₹{job.max_ctc:.1f} LPA" if job.max_ctc else "competitive market CTC"

            # 1. Candidate reference URL for consent-based interest form
            prefilled_form_url = f"{base_form_url}?ref={candidate.id}&job={job.id}"

            # -----------------------------------------------------------------
            # 1. LinkedIn Connection Request Note (STRICT <= 300 CHARACTERS)
            # -----------------------------------------------------------------
            li_note = (
                f"Hi {first_name}, impressed by your work in {skills_str}. "
                f"We're hiring a {job_title} ({work_mode}, {location}). "
                f"Would love to connect & share quick details if you're open to exploring new roles!"
            )
            # Enforce 300 char hard limit
            if len(li_note) > 300:
                li_note = (
                    f"Hi {first_name}, noticed your background in {highlight_skills[0]}. "
                    f"We have an opening for a {job_title} in {location}. "
                    f"Would love to connect if you're open to exploring!"
                )
            if len(li_note) > 300:
                li_note = li_note[:297] + "..."

            # -----------------------------------------------------------------
            # 2. LinkedIn InMail
            # -----------------------------------------------------------------
            inmail_subject = f"Exciting Role: {job_title} Opportunity @ {company_name}"
            inmail_body = (
                f"Hi {first_name},\n\n"
                f"I came across your profile and was very impressed by your experience with {skills_str}. "
                f"Our engineering team is actively seeking a {job_title} to build high-scale, mission-critical systems.\n\n"
                f"Role Highlights:\n"
                f"• Position: {job_title}\n"
                f"• Location: {location} ({work_mode})\n"
                f"• Core Stack: {', '.join(must_skills[:4]) if must_skills else skills_str}\n"
                f"• Compensation: {budget_str}\n\n"
                f"If you are open to a confidential chat, feel free to review the brief and share your interest here:\n"
                f"👉 {prefilled_form_url}\n\n"
                f"Looking forward to hearing from you!\n\n"
                f"Best regards,\n"
                f"{recruiter_name}\n"
                f"{company_name}"
            )

            # -----------------------------------------------------------------
            # 3. Formal Email Outreach
            # -----------------------------------------------------------------
            email_subject = f"Opportunity: {job_title} | {company_name}"
            email_body = (
                f"Dear {candidate.full_name},\n\n"
                f"I hope this email finds you well.\n\n"
                f"I am reaching out from {company_name}. We reviewed your background in {skills_str} and believe your skills "
                f"align strongly with our open role for a {job_title}.\n\n"
                f"Key Information:\n"
                f"- Job Title: {job_title}\n"
                f"- Location / Work Mode: {location} ({work_mode})\n"
                f"- Primary Technologies: {', '.join(must_skills[:5]) if must_skills else skills_str}\n"
                f"- Compensation Band: {budget_str}\n\n"
                f"Under the Digital Personal Data Protection (DPDP) Act, we respect your privacy. If you would like to "
                f"learn more or share your updated preferences confidentially, please complete our quick 1-minute consent form:\n\n"
                f"Direct Link: {prefilled_form_url}\n\n"
                f"If you are not looking for new roles right now, no action is needed, and we will not send further unprompted emails.\n\n"
                f"Sincerely,\n\n"
                f"{recruiter_name}\n"
                f"Talent Acquisition | {company_name}"
            )

            # -----------------------------------------------------------------
            # 4. WhatsApp Template
            # -----------------------------------------------------------------
            whatsapp_body = (
                f"Hi {first_name}! 👋\n\n"
                f"This is {recruiter_name} from {company_name}. "
                f"We noticed your profile and solid experience in *{skills_str}*.\n\n"
                f"We are hiring for a *{job_title}* in *{location}* ({work_mode}, {budget_str}). 🚀\n\n"
                f"Are you currently open to exploring new career opportunities? "
                f"You can view the role details and indicate your interest in 30 seconds here:\n"
                f"🔗 {prefilled_form_url}\n\n"
                f"Thanks, and have a great day!"
            )

            # Return response bundle
            return {
                "candidate_id": candidate.id,
                "candidate_name": candidate.full_name,
                "job_id": job.id,
                "job_title": job.title,
                "prefilled_form_url": prefilled_form_url,
                "channels": {
                    "linkedin_note": {
                        "name": "LinkedIn Connection Note",
                        "character_count": len(li_note),
                        "character_limit": 300,
                        "content": li_note,
                        "description": "Short invitation note for connection request (max 300 chars)."
                    },
                    "inmail": {
                        "name": "LinkedIn InMail",
                        "subject": inmail_subject,
                        "content": inmail_body,
                        "description": "Structured pitch message for direct InMail messaging."
                    },
                    "email": {
                        "name": "Formal Email",
                        "subject": email_subject,
                        "content": email_body,
                        "description": "Complete cold outreach email with DPDP compliance statement."
                    },
                    "whatsapp": {
                        "name": "WhatsApp Broadcast",
                        "content": whatsapp_body,
                        "description": "Conversational, emoji-formatted instant messenger template."
                    }
                }
            }

    def record_outreach_event(
        self,
        candidate_id: str,
        job_id: str,
        channel: str,
        content_draft: str,
        form_prefilled_url: Optional[str] = None,
        status: str = "copied"
    ) -> OutreachEvent:
        """Record copy/send event in audit database."""
        with Session(engine, expire_on_commit=False) as session:
            event = OutreachEvent(
                candidate_id=candidate_id,
                job_id=job_id,
                channel=channel,
                content_draft=content_draft,
                form_prefilled_url=form_prefilled_url,
                status=status,
                created_at=get_utc_now()
            )
            session.add(event)
            session.commit()
            session.refresh(event)
            return event

    def get_candidate_outreach_history(self, candidate_id: str) -> List[Dict[str, Any]]:
        """Retrieve timeline of previous outreach generation and copy actions."""
        with Session(engine, expire_on_commit=False) as session:
            events = session.exec(
                select(OutreachEvent)
                .where(OutreachEvent.candidate_id == candidate_id)
                .order_by(OutreachEvent.created_at.desc())
            ).all()
            return [
                {
                    "id": ev.id,
                    "channel": ev.channel,
                    "status": ev.status,
                    "created_at": ev.created_at.isoformat() if ev.created_at else None,
                    "content_snippet": ev.content_draft[:100] + "..." if len(ev.content_draft) > 100 else ev.content_draft,
                }
                for ev in events
            ]
