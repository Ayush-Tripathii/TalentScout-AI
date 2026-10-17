"""CMS Landing Page & Platform Configuration Model."""

from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional
from sqlmodel import SQLModel, Field


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CmsPageContent(SQLModel, table=True):
    """CMS Content for dynamically managed landing page sections."""

    __tablename__ = "cms_contents"

    id: str = Field(default="landing_page", primary_key=True, index=True)
    hero_headline: str = Field(default="Autonomous Talent Sourcing & Match Intelligence for High-Growth Teams")
    hero_subheadline: str = Field(default="Stop scouring job boards manually. TalentScout combines multi-platform X-Ray search, contact intelligence, and 0-100 explainable ranking into one unified recruiter workflow.")
    announcement_badge: str = Field(default="🚀 Phase 8 Autopilot Sourcing Live: Automated 24/7 background crawls & instant fit alerts")
    about_headline: str = Field(default="Built by Recruiters, Engineered for Indian Contract Staffing")
    about_story: str = Field(default="Contract-staffing teams in India spend 70% of their bandwidth wrangling disconnected portals, verifying obsolete contact info, and re-reading duplicate resumes. TalentScout was engineered to eliminate this manual grind without paying prohibitive per-seat licensing fees.")
    promises_json: str = Field(default="[]")
    stats_json: str = Field(default="[]")
    features_json: str = Field(default="[]")
    testimonials_json: str = Field(default="[]")
    pricing_tiers_json: str = Field(default="[]")
    maintenance_mode: bool = Field(default=False)
    public_signup_enabled: bool = Field(default=True)
    updated_at: datetime = Field(default_factory=get_utc_now)
    updated_by: str = Field(default="admin@talentscout.ai")
