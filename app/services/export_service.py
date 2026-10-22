import io
import csv
import json
from typing import Any, Dict, List, Optional
from sqlmodel import Session, select

from app.models.job import Job
from app.models.candidate import Candidate, CandidateSource, ContactPoint
from app.models.match import Match
from app.models.pipeline import PipelineStatus


class ExportService:
    """Generates structured CSV and Excel exports of candidates and evaluation scores."""

    @staticmethod
    def get_export_rows(job_id: str, session: Session, stage_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """Fetch candidate pipeline records formatted for tabular export."""
        job = session.get(Job, job_id)
        if not job:
            return []

        # Query candidates who have a pipeline record or match for this job
        candidates = session.exec(select(Candidate)).all()
        rows = []

        for cand in candidates:
            # Check pipeline stage
            ps = session.exec(
                select(PipelineStatus).where(PipelineStatus.job_id == job_id, PipelineStatus.candidate_id == cand.id)
            ).first()
            stage = ps.stage if ps else "new"

            if stage_filter and stage != stage_filter:
                continue

            # Check Match
            match_rec = session.exec(
                select(Match).where(Match.job_id == job_id, Match.candidate_id == cand.id)
            ).first()
            score = match_rec.total_score if match_rec else 0.0
            why_bullets = " | ".join(json.loads(match_rec.why_bullets_json)) if (match_rec and match_rec.why_bullets_json) else ""
            missing_skills = ", ".join(json.loads(match_rec.missing_skills_json)) if (match_rec and match_rec.missing_skills_json) else ""

            # Check Contacts
            contacts = session.exec(select(ContactPoint).where(ContactPoint.candidate_id == cand.id)).all()
            emails = [c.value for c in contacts if c.kind == "email"]
            phones = [c.value for c in contacts if c.kind == "phone"]

            # Check Sources / URLs
            sources = session.exec(select(CandidateSource).where(CandidateSource.candidate_id == cand.id)).all()
            source_urls = " | ".join([f"{s.platform.upper()}: {s.url}" for s in sources])

            skills_list = json.loads(cand.skills_json) if cand.skills_json else []

            rows.append({
                "Full Name": cand.full_name,
                "Match Score": score,
                "Pipeline Stage": stage.replace("_", " ").title(),
                "Headline / Title": cand.headline or "—",
                "Location": cand.current_location or "—",
                "Experience (Yrs)": cand.experience_years if cand.experience_years is not None else "—",
                "Skills": ", ".join(skills_list),
                "Data Completeness": "Full Resume" if cand.data_completeness == "full_resume" else "Snippet Profile",
                "Verified Emails": ", ".join(emails) if emails else "—",
                "Verified Phones": ", ".join(phones) if phones else "—",
                "Profile URLs": source_urls or "—",
                "Why Matched": why_bullets or "—",
                "Missing Skills": missing_skills or "None",
                "Target Job": job.title,
            })

        # Sort descending by Match Score
        rows.sort(key=lambda r: r["Match Score"], reverse=True)
        return rows

    @classmethod
    def export_to_csv(cls, job_id: str, session: Session, stage_filter: Optional[str] = None) -> bytes:
        """Export candidates to UTF-8 encoded CSV bytes."""
        rows = cls.get_export_rows(job_id, session, stage_filter=stage_filter)
        if not rows:
            return b""
        output = io.StringIO()
        fieldnames = list(rows[0].keys())
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
        return output.getvalue().encode("utf-8")

    @classmethod
    def export_to_excel(cls, job_id: str, session: Session, stage_filter: Optional[str] = None) -> bytes:
        """Export candidates to styled Excel (.xlsx) bytes."""
        rows = cls.get_export_rows(job_id, session, stage_filter=stage_filter)
        try:
            from openpyxl import Workbook
            wb = Workbook()
            ws = wb.active
            ws.title = "Candidate Pipeline"
            if rows:
                headers = list(rows[0].keys())
                ws.append(headers)
                for r in rows:
                    ws.append([r.get(h, "") for h in headers])
                for col in ws.columns:
                    max_len = max(len(str(cell.value or "")) for cell in col)
                    col_letter = col[0].column_letter
                    ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 45)
            output = io.BytesIO()
            wb.save(output)
            return output.getvalue()
        except ImportError:
            import pandas as pd
            df = pd.DataFrame(rows)
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                df.to_excel(writer, sheet_name="Candidate Pipeline", index=False)
            return output.getvalue()
