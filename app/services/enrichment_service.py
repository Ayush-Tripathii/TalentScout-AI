"""Third-Party Enrichment Service (Hunter.io & Apollo.io).

Handles credit tracking, rate limits, monthly caps, and provenance logging
for on-demand candidate contact enrichment.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
import httpx
from sqlmodel import Session, select, func
from app.db import engine
from app.models.app_setting import AppSetting
from app.models.candidate import Candidate, ContactPoint
from app.models.enrichment import EnrichmentUsage
from app.services.contact_extractor import ContactExtractor


MONTHLY_CREDIT_CAP = 50


class EnrichmentService:
    """Orchestrates Hunter.io and Apollo.io contact reveals with credit quotas."""

    @staticmethod
    def get_stored_key(provider: str) -> Optional[str]:
        """Fetch enrichment API key from SQLite settings."""
        key_name = f"{provider.lower()}_api_key"
        try:
            with Session(engine) as session:
                setting = session.get(AppSetting, key_name)
                if setting and setting.value.strip():
                    return setting.value.strip()
        except Exception:
            pass
        return None

    @classmethod
    def get_quota_status(cls, recruiter_name: str = "Recruiter") -> Dict[str, Any]:
        """Return credit usage, quota limit, and configuration status."""
        hunter_key = cls.get_stored_key("hunter")
        apollo_key = cls.get_stored_key("apollo")

        with Session(engine, expire_on_commit=False) as session:
            # Calculate credits used in current calendar month
            now = datetime.now(timezone.utc)
            first_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

            usages = session.exec(
                select(EnrichmentUsage).where(
                    EnrichmentUsage.created_at >= first_of_month,
                    EnrichmentUsage.response_status == "success",
                )
            ).all()

            total_used = sum(u.credits_used for u in usages)
            remaining = max(0, MONTHLY_CREDIT_CAP - total_used)

        return {
            "hunter_configured": bool(hunter_key),
            "hunter_masked": f"••••{hunter_key[-4:]}" if hunter_key and len(hunter_key) >= 4 else None,
            "apollo_configured": bool(apollo_key),
            "apollo_masked": f"••••{apollo_key[-4:]}" if apollo_key and len(apollo_key) >= 4 else None,
            "monthly_cap": MONTHLY_CREDIT_CAP,
            "credits_used": total_used,
            "credits_remaining": remaining,
            "quota_exceeded": remaining <= 0,
        }

    @classmethod
    def reveal_contact(
        cls,
        candidate_id: str,
        provider: str = "hunter",
        recruiter_name: str = "Recruiter"
    ) -> Dict[str, Any]:
        """Attempt to enrich candidate contact using selected provider."""
        quota = cls.get_quota_status(recruiter_name)
        if quota["quota_exceeded"]:
            return {
                "status": "error",
                "message": f"Monthly enrichment cap of {MONTHLY_CREDIT_CAP} credits reached.",
                "credits_remaining": 0
            }

        with Session(engine, expire_on_commit=False) as session:
            candidate = session.get(Candidate, candidate_id)
            if not candidate:
                return {"status": "error", "message": "Candidate not found."}

            # Check if candidate already has an email
            existing_email = session.exec(
                select(ContactPoint).where(
                    ContactPoint.candidate_id == candidate_id,
                    ContactPoint.kind == "email"
                )
            ).first()

            if existing_email:
                return {
                    "status": "info",
                    "message": f"Candidate already has verified contact: {existing_email.value}",
                    "contact": existing_email.value,
                    "credits_remaining": quota["credits_remaining"]
                }

            api_key = cls.get_stored_key(provider)
            discovered_email = None
            discovered_phone = None

            if not api_key:
                return {
                    "status": "error",
                    "message": f"No {provider.title()} API key configured. Please paste your genuine {provider.title()} API key in Sourcing Keys, or use Quick Paste.",
                    "credits_remaining": quota["credits_remaining"]
                }

            # ---------------------------------------------------------
            # Provider Execution
            # ---------------------------------------------------------
            if provider.lower() == "hunter":
                discovered_email = cls._call_hunter_api(candidate.full_name, candidate.headline, api_key)
            elif provider.lower() == "apollo":
                discovered_email, discovered_phone = cls._call_apollo_api(candidate.full_name, candidate.headline, api_key)

            if not discovered_email and not discovered_phone:
                # Log failed attempt without consuming credits
                usage = EnrichmentUsage(
                    provider=provider,
                    candidate_id=candidate_id,
                    recruiter_name=recruiter_name,
                    credits_used=0,
                    credits_remaining=quota["credits_remaining"],
                    response_status="not_found",
                )
                session.add(usage)
                session.commit()
                return {"status": "not_found", "message": f"No contacts found via {provider.title()}."}

            # Persist newly enriched contact point
            contacts_added = []
            if discovered_email:
                cp_email = ContactPoint(
                    candidate_id=candidate_id,
                    kind="email",
                    value=discovered_email,
                    type=f"enriched-{provider.lower()}",
                    source_reference=f"{provider.title()} Enrichment API",
                    added_by=recruiter_name,
                )
                session.add(cp_email)
                contacts_added.append({"kind": "email", "value": discovered_email})

            if discovered_phone:
                cp_phone = ContactPoint(
                    candidate_id=candidate_id,
                    kind="phone",
                    value=discovered_phone,
                    type=f"enriched-{provider.lower()}",
                    source_reference=f"{provider.title()} Enrichment API",
                    added_by=recruiter_name,
                )
                session.add(cp_phone)
                contacts_added.append({"kind": "phone", "value": discovered_phone})

            # Record credit consumption
            new_remaining = max(0, quota["credits_remaining"] - 1)
            usage = EnrichmentUsage(
                provider=provider,
                candidate_id=candidate_id,
                recruiter_name=recruiter_name,
                credits_used=1,
                credits_remaining=new_remaining,
                response_status="success",
            )
            session.add(usage)
            session.commit()

            return {
                "status": "success",
                "message": f"Contact successfully enriched via {provider.title()}!",
                "contacts": contacts_added,
                "credits_remaining": new_remaining,
                "credits_used_this_month": quota["credits_used"] + 1,
            }

    @staticmethod
    def _call_hunter_api(full_name: str, headline: Optional[str], api_key: str) -> Optional[str]:
        """Query Hunter.io Email Finder API."""
        try:
            parts = full_name.split()
            first_name = parts[0]
            last_name = parts[-1] if len(parts) > 1 else ""
            
            # Simple domain extraction from headline if company mentioned
            domain = "tcs.com"
            if headline and " at " in headline.lower():
                company = headline.lower().split(" at ")[-1].strip().split()[0]
                domain = f"{company}.com"

            resp = httpx.get(
                "https://api.hunter.io/v2/email-finder",
                params={"first_name": first_name, "last_name": last_name, "domain": domain, "api_key": api_key},
                timeout=8.0
            )
            if resp.status_code == 200:
                data = resp.json().get("data", {})
                return data.get("email")
        except Exception:
            pass
        return None

    @staticmethod
    def _call_apollo_api(full_name: str, headline: Optional[str], api_key: str) -> Tuple[Optional[str], Optional[str]]:
        """Query Apollo.io People Match API."""
        try:
            resp = httpx.post(
                "https://api.apollo.io/v1/people/match",
                headers={"Cache-Control": "no-cache", "Content-Type": "application/json"},
                json={"api_key": api_key, "name": full_name, "title": headline or ""},
                timeout=8.0
            )
            if resp.status_code == 200:
                person = resp.json().get("person", {})
                email = person.get("email")
                phone = person.get("sanitized_phone")
                return email, phone
        except Exception:
            pass
        return None, None
