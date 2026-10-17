"""Candidate Deduplication, Identity Resolution, and Cross-Platform Linking Service."""

import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse, urlunparse

import phonenumbers
from rapidfuzz import fuzz
from sqlmodel import Session, select

from app.models.candidate import Candidate, CandidateLink, CandidateSource, ContactPoint
from app.models.resume import Resume
from app.models.match import Match
from app.models.pipeline import PipelineStatus, Note
from app.models.audit import AuditLog

logger = logging.getLogger("talentscout.dedup")
BASE_DIR = Path(__file__).resolve().parent.parent.parent


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DedupLinker:
    """Multi-strategy candidate deduplication and cross-platform identity linking."""

    def __init__(self):
        self.city_aliases = self._load_city_aliases()

    def _load_city_aliases(self) -> Dict[str, List[str]]:
        """Load Indian city aliases for location cluster matching."""
        alias_file = BASE_DIR / "config" / "city_aliases.json"
        if alias_file.exists():
            try:
                with open(alias_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Error loading city aliases: {e}")
        return {}

    @staticmethod
    def normalize_name(name: Optional[str]) -> str:
        """Strip titles, honorifics, and whitespace from candidate name."""
        if not name:
            return ""
        # Remove common professional/honorific prefixes
        cleaned = re.sub(r"^(dr\.?|mr\.?|ms\.?|mrs\.?|er\.?|prof\.?)\s+", "", name.strip(), flags=re.IGNORECASE)
        # Collapse multiple spaces
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned

    @staticmethod
    def normalize_url(url: Optional[str]) -> str:
        """Canonicalize URL by stripping scheme, www, query tracking params, and trailing slash."""
        if not url:
            return ""
        parsed = urlparse(url.strip())
        netloc = parsed.netloc.lower()
        if netloc.startswith("www."):
            netloc = netloc[4:]
        path = parsed.path.rstrip("/").lower()
        return f"{netloc}{path}"

    @staticmethod
    def normalize_phone(phone: Optional[str]) -> Optional[str]:
        """Normalize Indian phone number to E.164 format."""
        if not phone:
            return None
        cleaned = phone.strip()
        try:
            parsed = phonenumbers.parse(cleaned, "IN")
            if phonenumbers.is_valid_number_for_region(parsed, "IN"):
                return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        except Exception:
            pass
        return None

    @staticmethod
    def normalize_email(email: Optional[str]) -> Optional[str]:
        """Normalize email address."""
        if not email:
            return None
        cleaned = email.strip().lower()
        if "@" in cleaned and "." in cleaned:
            return cleaned
        return None

    def _get_city_cluster(self, location: Optional[str]) -> Set[str]:
        """Return canonical cluster set for a given Indian location string."""
        if not location:
            return set()
        loc_lower = location.lower().strip()
        matched_cluster = {loc_lower}
        for canonical, aliases in self.city_aliases.items():
            canonical_lower = canonical.lower()
            all_in_group = {canonical_lower} | {a.lower() for a in aliases}
            if any(term in loc_lower for term in all_in_group):
                matched_cluster.update(all_in_group)
        return matched_cluster

    def find_duplicate_or_link(
        self,
        candidate_data: Dict[str, Any],
        session: Session,
    ) -> Tuple[Optional[Candidate], Optional[CandidateLink]]:
        """Identify if an incoming candidate matches an existing candidate or suggests a link.
        
        Returns:
            (existing_candidate, None) if exact match (URL or verified email/phone).
            (target_candidate, candidate_link) if medium-to-high fuzzy similarity.
            (None, None) if completely new candidate.
        """
        raw_name = candidate_data.get("full_name") or candidate_data.get("name") or ""
        norm_name = self.normalize_name(raw_name)
        sources = candidate_data.get("sources", [])
        raw_url = candidate_data.get("url") or (sources[0].get("url") if sources else "")
        norm_url = self.normalize_url(raw_url)

        emails = [self.normalize_email(e) for e in candidate_data.get("emails", []) if self.normalize_email(e)]
        phones = [self.normalize_phone(p) for p in candidate_data.get("phones", []) if self.normalize_phone(p)]
        skills = set(s.lower() for s in candidate_data.get("skills", []))
        location = candidate_data.get("current_location") or candidate_data.get("location") or ""
        loc_cluster = self._get_city_cluster(location)

        # 1. Exact Match on Canonical URL
        if norm_url:
            all_sources = session.exec(select(CandidateSource)).all()
            for cs in all_sources:
                if self.normalize_url(cs.url) == norm_url:
                    existing = session.get(Candidate, cs.candidate_id)
                    if existing:
                        logger.info(f"Exact URL match found for {norm_name} -> {existing.full_name}")
                        return existing, None

        # 2. Exact Match on Verified Contact Point (Email or Phone)
        if emails or phones:
            all_contacts = session.exec(select(ContactPoint)).all()
            for cp in all_contacts:
                if cp.kind == "email" and cp.value.lower() in emails:
                    existing = session.get(Candidate, cp.candidate_id)
                    if existing:
                        logger.info(f"Exact email match found for {norm_name} -> {existing.full_name} ({cp.value})")
                        return existing, None
                elif cp.kind == "phone" and cp.value in phones:
                    existing = session.get(Candidate, cp.candidate_id)
                    if existing:
                        logger.info(f"Exact phone match found for {norm_name} -> {existing.full_name} ({cp.value})")
                        return existing, None

        # 3. Fuzzy Identity Resolution against existing candidates
        existing_candidates = session.exec(select(Candidate)).all()
        best_match: Optional[Candidate] = None
        best_confidence: float = 0.0
        match_reasons: List[str] = []

        for cand in existing_candidates:
            cand_norm_name = self.normalize_name(cand.full_name)
            name_score = fuzz.token_sort_ratio(norm_name.lower(), cand_norm_name.lower())

            if name_score >= 88:
                cand_skills = set(s.lower() for s in json.loads(cand.skills_json)) if cand.skills_json else set()
                skill_intersection = skills & cand_skills
                cand_loc_cluster = self._get_city_cluster(cand.current_location)
                loc_overlap = bool(loc_cluster & cand_loc_cluster)

                confidence = (name_score / 100.0) * 0.70
                reasons = [f"Name similarity: {name_score:.0f}%"]

                if loc_overlap:
                    confidence += 0.15
                    reasons.append(f"Matching location cluster: {location or cand.current_location}")

                if skill_intersection:
                    skill_bonus = min(0.15, len(skill_intersection) * 0.05)
                    confidence += skill_bonus
                    reasons.append(f"Shared skills ({len(skill_intersection)}): {', '.join(list(skill_intersection)[:3])}")

                confidence = min(0.99, confidence)

                if confidence > best_confidence:
                    best_confidence = confidence
                    best_match = cand
                    match_reasons = reasons

        if best_match and best_confidence >= 0.70:
            link = CandidateLink(
                source_candidate_id="",  # Will be set to new candidate ID if persisted
                target_candidate_id=best_match.id,
                confidence=round(best_confidence, 2),
                reasons_json=json.dumps(match_reasons),
                status="suggested" if best_confidence < 0.90 else "confirmed",
                created_at=get_utc_now(),
            )
            return best_match, link

        return None, None

    def merge_candidates(
        self,
        primary_id: str,
        secondary_id: str,
        session: Session,
        performed_by: str = "Recruiter",
    ) -> Candidate:
        """Merge secondary candidate into primary candidate, transferring all records cleanly."""
        primary = session.get(Candidate, primary_id)
        secondary = session.get(Candidate, secondary_id)

        if not primary or not secondary:
            raise ValueError("Both candidates must exist to perform merge")
        if primary.id == secondary.id:
            return primary

        # 1. Transfer CandidateSource records
        sec_sources = session.exec(select(CandidateSource).where(CandidateSource.candidate_id == secondary.id)).all()
        for src in sec_sources:
            src.candidate_id = primary.id
            session.add(src)

        # 2. Transfer ContactPoint records (avoid duplicates by value and kind)
        existing_contacts = session.exec(select(ContactPoint).where(ContactPoint.candidate_id == primary.id)).all()
        existing_keys = {(c.kind, c.value.lower()) for c in existing_contacts}

        sec_contacts = session.exec(select(ContactPoint).where(ContactPoint.candidate_id == secondary.id)).all()
        for cp in sec_contacts:
            key = (cp.kind, cp.value.lower())
            if key not in existing_keys:
                cp.candidate_id = primary.id
                session.add(cp)
                existing_keys.add(key)
            else:
                session.delete(cp)

        # 3. Transfer Resumes
        sec_resumes = session.exec(select(Resume).where(Resume.candidate_id == secondary.id)).all()
        for r in sec_resumes:
            r.candidate_id = primary.id
            session.add(r)

        # 4. Transfer Notes
        sec_notes = session.exec(select(Note).where(Note.candidate_id == secondary.id)).all()
        for n in sec_notes:
            n.candidate_id = primary.id
            session.add(n)

        # 5. Union Skills
        pri_skills = set(json.loads(primary.skills_json)) if primary.skills_json else set()
        sec_skills = set(json.loads(secondary.skills_json)) if secondary.skills_json else set()
        merged_skills = list(pri_skills | sec_skills)
        primary.skills_json = json.dumps(merged_skills)

        # 6. Upgrade Data Completeness if secondary had full resume
        if secondary.data_completeness == "full_resume":
            primary.data_completeness = "full_resume"

        # 7. Close CandidateLink records between them
        links = session.exec(
            select(CandidateLink).where(
                (CandidateLink.source_candidate_id == secondary.id) & (CandidateLink.target_candidate_id == primary.id)
                | (CandidateLink.source_candidate_id == primary.id) & (CandidateLink.target_candidate_id == secondary.id)
            )
        ).all()
        for l in links:
            l.status = "confirmed"
            session.add(l)

        # 8. Record Audit Log
        audit = AuditLog(
            action="merge",
            entity_type="candidate",
            entity_id=primary.id,
            performed_by=performed_by,
            details_json=json.dumps({
                "merged_candidate_id": secondary.id,
                "merged_candidate_name": secondary.full_name,
                "primary_candidate_name": primary.full_name,
            }),
            timestamp=get_utc_now(),
        )
        session.add(audit)

        # 9. Delete secondary candidate
        session.delete(secondary)
        session.commit()
        session.refresh(primary)

        logger.info(f"Successfully merged candidate {secondary_id} into {primary.id}")
        return primary

    def get_suggested_links(self, session: Session) -> List[Dict[str, Any]]:
        """Retrieve all active merge suggestions with candidate cards."""
        links = session.exec(select(CandidateLink).where(CandidateLink.status == "suggested")).all()
        results = []
        for l in links:
            source = session.get(Candidate, l.source_candidate_id)
            target = session.get(Candidate, l.target_candidate_id)
            if source and target:
                results.append({
                    "link_id": l.id,
                    "confidence": l.confidence,
                    "reasons": json.loads(l.reasons_json) if l.reasons_json else [],
                    "source": {
                        "id": source.id,
                        "name": source.full_name,
                        "headline": source.headline,
                        "location": source.current_location,
                        "completeness": source.data_completeness,
                    },
                    "target": {
                        "id": target.id,
                        "name": target.full_name,
                        "headline": target.headline,
                        "location": target.current_location,
                        "completeness": target.data_completeness,
                    },
                })
        return results

    def resolve_link(self, link_id: str, action: str, session: Session, performed_by: str = "Recruiter") -> bool:
        """Confirm or reject a suggested identity merge link."""
        link = session.get(CandidateLink, link_id)
        if not link:
            return False

        if action == "confirm":
            self.merge_candidates(link.target_candidate_id, link.source_candidate_id, session, performed_by=performed_by)
            link.status = "confirmed"
            session.add(link)
            session.commit()
            return True
        elif action == "reject":
            link.status = "rejected"
            session.add(link)
            session.commit()
            return True
        return False
