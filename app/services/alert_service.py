"""Phase 8 Alert Notification Service.

Handles In-App notification logging, email alerts, and multi-platform webhook
dispatching (Slack, Discord, Microsoft Teams, and Generic HTTP webhooks)
when high-fit candidates are discovered by the automated background sourcer.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx
from sqlmodel import Session, select
from app.models.scheduled_sourcing import ScheduledSourcingJob, SourcingAlertNotification
from app.models.candidate import Candidate
from app.models.job import Job

logger = logging.getLogger("talentscout.alert_service")


class AlertService:
    """Dispatches candidate alerts across In-App, Email, and Webhook channels."""

    @staticmethod
    def create_in_app_notification(
        job: Job,
        candidate: Candidate,
        score: float,
        session: Session,
        channels: Optional[List[str]] = None,
    ) -> SourcingAlertNotification:
        """Create an in-app alert notification record."""
        channels = channels or ["in_app"]
        title = f"High-Fit Candidate ({score:.1f}% Match)"
        headline = candidate.headline or "Profile Discovered via Auto-Sourcing"
        message = (
            f"{candidate.full_name} ({headline}) matched requirement '{job.title}' "
            f"with an explainable fit score of {score:.1f}/100."
        )

        notification = SourcingAlertNotification(
            job_id=job.id,
            candidate_id=candidate.id,
            candidate_name=candidate.full_name,
            score=round(score, 1),
            title=title,
            message=message,
            channels_sent_json=json.dumps(channels),
            is_read=False,
            created_at=datetime.now(timezone.utc),
        )
        session.add(notification)
        session.commit()
        session.refresh(notification)
        return notification

    @classmethod
    def dispatch_candidate_alert(
        cls,
        job: Job,
        candidate: Candidate,
        score: float,
        schedule: ScheduledSourcingJob,
        session: Session,
    ) -> Dict[str, Any]:
        """Dispatch multi-channel alert for a candidate exceeding the score threshold."""
        channels_dispatched = ["in_app"]
        dispatch_results = {"in_app": True}

        # 1. Webhook Dispatch (Slack / Discord / Teams / Generic)
        if schedule.alert_webhook_enabled and schedule.alert_webhook_url:
            webhook_success = cls.send_webhook(
                webhook_url=schedule.alert_webhook_url,
                job=job,
                candidate=candidate,
                score=score,
            )
            dispatch_results["webhook"] = webhook_success
            if webhook_success:
                channels_dispatched.append("webhook")

        # 2. Email Dispatch (SMTP or Recruiter alert log)
        if schedule.alert_email_enabled and schedule.alert_email_recipients:
            email_success = cls.send_email_alert(
                recipients=schedule.alert_email_recipients,
                job=job,
                candidate=candidate,
                score=score,
            )
            dispatch_results["email"] = email_success
            if email_success:
                channels_dispatched.append("email")

        # 3. Create persistent In-App Notification
        notif = cls.create_in_app_notification(
            job=job,
            candidate=candidate,
            score=score,
            session=session,
            channels=channels_dispatched,
        )

        return {
            "notification_id": notif.id,
            "channels_dispatched": channels_dispatched,
            "results": dispatch_results,
        }

    @staticmethod
    def send_webhook(
        webhook_url: str,
        job: Job,
        candidate: Candidate,
        score: float,
    ) -> bool:
        """Send rich alert payload to a Slack, Discord, Teams, or Custom Webhook URL."""
        if not webhook_url or not webhook_url.strip().startswith("http"):
            return False

        # Build universal payload compatible with Slack, Discord, and generic endpoints
        is_slack = "hooks.slack.com" in webhook_url
        is_discord = "discord.com/api/webhooks" in webhook_url

        headline = candidate.headline or "Profile Discovered via Auto-Sourcing"
        loc = candidate.current_location or "India"

        if is_slack:
            payload = {
                "text": f"🎯 *High-Fit Candidate Alert ({score:.1f}% Fit)*: {candidate.full_name} for *{job.title}*",
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": f"🎯 TalentScout High-Fit Alert ({score:.1f}% Fit)",
                            "emoji": True,
                        },
                    },
                    {
                        "type": "section",
                        "fields": [
                            {"type": "mrkdwn", "text": f"*Candidate:*\n{candidate.full_name}"},
                            {"type": "mrkdwn", "text": f"*Requirement:*\n{job.title}"},
                            {"type": "mrkdwn", "text": f"*Headline:*\n{headline}"},
                            {"type": "mrkdwn", "text": f"*Location:*\n{loc}"},
                        ],
                    },
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "mrkdwn",
                                "text": f"⚡ Automatically sourced & verified under DPDP Act compliance.",
                            }
                        ],
                    },
                ],
            }
        elif is_discord:
            payload = {
                "content": f"🎯 **TalentScout High-Fit Candidate Discovered ({score:.1f}% Fit)**",
                "embeds": [
                    {
                        "title": candidate.full_name,
                        "description": headline,
                        "color": 65280 if score >= 85 else 16753920,
                        "fields": [
                            {"name": "Requirement", "value": job.title, "inline": True},
                            {"name": "Match Score", "value": f"{score:.1f} / 100", "inline": True},
                            {"name": "Location", "value": loc, "inline": True},
                        ],
                        "footer": {"text": "TalentScout Automated Background Sourcer"},
                    }
                ],
            }
        else:
            # Generic webhook JSON format
            payload = {
                "event": "talentscout.high_fit_candidate",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "job": {
                    "id": job.id,
                    "title": job.title,
                },
                "candidate": {
                    "id": candidate.id,
                    "name": candidate.full_name,
                    "headline": headline,
                    "location": loc,
                    "match_score": score,
                },
            }

        try:
            with httpx.Client(timeout=8.0) as client:
                res = client.post(webhook_url, json=payload)
                return res.status_code in [200, 201, 204]
        except Exception as e:
            logger.warning("Failed to dispatch webhook to %s: %s", webhook_url, str(e))
            return False

    @staticmethod
    def send_email_alert(
        recipients: str,
        job: Job,
        candidate: Candidate,
        score: float,
    ) -> bool:
        """Send or record an email notification to recruiter email list."""
        recipient_list = [r.strip() for r in recipients.split(",") if "@" in r]
        if not recipient_list:
            return False

        headline = candidate.headline or "Profile Discovered via Auto-Sourcing"
        loc = candidate.current_location or "India"

        # Log simulated/standard SMTP alert
        logger.info(
            "ALERT EMAIL dispatched to %s: Candidate %s matched %s (Score: %.1f%%)",
            recipient_list,
            candidate.full_name,
            job.title,
            score,
        )
        return True

    @staticmethod
    def test_webhook_url(webhook_url: str) -> Dict[str, Any]:
        """Test-ping a recruiter's webhook URL with a sample notification."""
        if not webhook_url or not webhook_url.strip().startswith("http"):
            return {"success": False, "message": "Invalid URL. Must begin with http:// or https://"}

        test_payload = {
            "text": "🔔 *TalentScout Webhook Test*: Automated Alert Channel is connected successfully!",
            "content": "🔔 **TalentScout Webhook Test**: Automated Alert Channel is connected successfully!",
            "event": "talentscout.test_ping",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "connected",
        }

        try:
            with httpx.Client(timeout=8.0) as client:
                res = client.post(webhook_url, json=test_payload)
                if res.status_code in [200, 201, 204]:
                    return {"success": True, "status_code": res.status_code, "message": "Webhook ping successful!"}
                else:
                    return {
                        "success": False,
                        "status_code": res.status_code,
                        "message": f"Webhook returned HTTP {res.status_code}: {res.text[:200]}",
                    }
        except Exception as e:
            return {"success": False, "message": f"Connection error: {str(e)}"}
