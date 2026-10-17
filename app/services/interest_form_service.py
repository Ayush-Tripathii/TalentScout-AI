"""Consent-Based Interest Form & Google Sheets Sync Service.

Manages candidate interest form submissions, consent status upgrades,
and integration with Google Sheets / direct applicant intake.
"""

from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional
import uuid
import httpx
from sqlmodel import Session, select
from app.db import engine
from app.models.candidate import Candidate, ContactPoint
from app.models.pipeline import PipelineStatus
from app.models.form_response import FormResponse
from app.services.contact_extractor import ContactExtractor


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class InterestFormService:
    """Manages applicant consent submissions and Google Sheets synchronizations."""

    def submit_form(
        self,
        full_name: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        reference_id: Optional[str] = None,
        job_id: Optional[str] = None,
        current_ctc: Optional[str] = None,
        expected_ctc: Optional[str] = None,
        notice_period: Optional[str] = None,
        current_location: Optional[str] = None,
        linkedin_url: Optional[str] = None,
        resume_file_url: Optional[str] = None,
        consent_given: bool = True
    ) -> Dict[str, Any]:
        """Process candidate form submission, upgrade consent, and link to pipeline."""
        with Session(engine, expire_on_commit=False) as session:
            # 1. Identify candidate by reference_id or match email
            candidate = None
            if reference_id:
                candidate = session.get(Candidate, reference_id)

            if not candidate and email:
                cp = session.exec(
                    select(ContactPoint).where(
                        ContactPoint.kind == "email",
                        ContactPoint.value == email.strip().lower()
                    )
                ).first()
                if cp:
                    candidate = session.get(Candidate, cp.candidate_id)

            # 2. If new candidate, create record
            if not candidate:
                candidate = Candidate(
                    full_name=full_name.strip(),
                    headline="Applicant — Form Submission",
                    current_location=current_location or "India",
                    data_completeness="consented_form",
                    created_at=get_utc_now(),
                    updated_at=get_utc_now()
                )
                session.add(candidate)
                session.commit()
                session.refresh(candidate)

            # 3. Add or upgrade ContactPoints to consented
            if email:
                clean_email = email.strip().lower()
                existing_email = session.exec(
                    select(ContactPoint).where(
                        ContactPoint.candidate_id == candidate.id,
                        ContactPoint.kind == "email",
                        ContactPoint.value == clean_email
                    )
                ).first()
                if existing_email:
                    existing_email.type = "consented"
                    session.add(existing_email)
                else:
                    session.add(ContactPoint(
                        candidate_id=candidate.id,
                        kind="email",
                        value=clean_email,
                        type="consented",
                        source_reference="interest_form",
                        added_by="Applicant",
                        found_at=get_utc_now()
                    ))

            if phone:
                phone_res = ContactExtractor.extract_phones(phone)
                clean_phone = phone_res[0] if phone_res else phone.strip()
                existing_phone = session.exec(
                    select(ContactPoint).where(
                        ContactPoint.candidate_id == candidate.id,
                        ContactPoint.kind == "phone",
                        ContactPoint.value == clean_phone
                    )
                ).first()
                if existing_phone:
                    existing_phone.type = "consented"
                    session.add(existing_phone)
                else:
                    session.add(ContactPoint(
                        candidate_id=candidate.id,
                        kind="phone",
                        value=clean_phone,
                        type="consented",
                        source_reference="interest_form",
                        added_by="Applicant",
                        found_at=get_utc_now()
                    ))

            # 4. Ensure pipeline stage is updated to 'applied' or 'contacted'
            if job_id:
                ps = session.exec(
                    select(PipelineStatus).where(
                        PipelineStatus.job_id == job_id,
                        PipelineStatus.candidate_id == candidate.id
                    )
                ).first()
                if not ps:
                    session.add(PipelineStatus(
                        job_id=job_id,
                        candidate_id=candidate.id,
                        stage="applied",
                        updated_at=get_utc_now()
                    ))
                else:
                    if ps.stage in ["new", "sourced", "contacted"]:
                        ps.stage = "applied"
                        ps.updated_at = get_utc_now()
                        session.add(ps)

            # 5. Persist FormResponse
            form_resp = FormResponse(
                reference_id=reference_id,
                candidate_id=candidate.id,
                full_name=full_name.strip(),
                email=email.strip().lower() if email else None,
                phone=phone.strip() if phone else None,
                linkedin_url=linkedin_url,
                current_ctc=current_ctc,
                expected_ctc=expected_ctc,
                notice_period=notice_period,
                current_location=current_location,
                resume_file_url=resume_file_url,
                consent_given=consent_given,
                submitted_at=get_utc_now(),
                processed_at=get_utc_now()
            )
            session.add(form_resp)
            session.commit()
            session.refresh(form_resp)

            return {
                "status": "success",
                "message": "Interest form received and consent recorded.",
                "response_id": form_resp.id,
                "candidate_id": candidate.id,
                "candidate_name": candidate.full_name
            }

    def get_responses_for_job(self, job_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve all applicant form submissions with candidate links."""
        with Session(engine, expire_on_commit=False) as session:
            responses = session.exec(
                select(FormResponse).order_by(FormResponse.submitted_at.desc())
            ).all()

            results = []
            for r in responses:
                # If filtered by job_id, verify candidate is in that job's pipeline
                if job_id and r.candidate_id:
                    ps = session.exec(
                        select(PipelineStatus).where(
                            PipelineStatus.job_id == job_id,
                            PipelineStatus.candidate_id == r.candidate_id
                        )
                    ).first()
                    if not ps:
                        continue

                results.append({
                    "id": r.id,
                    "reference_id": r.reference_id,
                    "candidate_id": r.candidate_id,
                    "full_name": r.full_name,
                    "email": r.email,
                    "phone": r.phone,
                    "current_ctc": r.current_ctc,
                    "expected_ctc": r.expected_ctc,
                    "notice_period": r.notice_period,
                    "current_location": r.current_location,
                    "resume_file_url": r.resume_file_url,
                    "consent_given": r.consent_given,
                    "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
                })

            return results

    def sync_google_sheets(self, sheet_url_or_id: str, job_id: Optional[str] = None) -> Dict[str, Any]:
        """Sync form responses from a published Google Sheet CSV export or Sheets API."""
        # Convert standard Google Sheet sharing URL into CSV export URL
        csv_url = sheet_url_or_id
        if "docs.google.com/spreadsheets" in sheet_url_or_id:
            if "/edit" in sheet_url_or_id:
                csv_url = sheet_url_or_id.split("/edit")[0] + "/export?format=csv"
            elif not csv_url.endswith("/export?format=csv"):
                csv_url = csv_url.rstrip("/") + "/export?format=csv"

        imported_count = 0
        try:
            resp = httpx.get(csv_url, timeout=12.0)
            if resp.status_code == 200:
                lines = resp.text.splitlines()
                if len(lines) > 1:
                    import csv
                    reader = csv.DictReader(lines)
                    for row in reader:
                        # Attempt to locate standard column headers
                        name = row.get("Full Name") or row.get("Name") or row.get("Candidate Name")
                        email = row.get("Email") or row.get("Email Address")
                        phone = row.get("Phone") or row.get("Mobile Number") or row.get("Phone Number")
                        ref_id = row.get("Reference ID") or row.get("Candidate ID") or row.get("Ref ID")
                        curr_ctc = row.get("Current CTC") or row.get("CTC")
                        exp_ctc = row.get("Expected CTC")
                        notice = row.get("Notice Period")
                        loc = row.get("Current Location") or row.get("City")

                        if name:
                            self.submit_form(
                                full_name=name,
                                email=email,
                                phone=phone,
                                reference_id=ref_id,
                                job_id=job_id,
                                current_ctc=curr_ctc,
                                expected_ctc=exp_ctc,
                                notice_period=notice,
                                current_location=loc
                            )
                            imported_count += 1
            return {
                "status": "success",
                "synced_count": imported_count,
                "message": f"Successfully synced {imported_count} response(s) from sheet."
            }
        except Exception as e:
            return {
                "status": "error",
                "synced_count": 0,
                "message": f"Failed to sync sheet: {str(e)}"
            }
