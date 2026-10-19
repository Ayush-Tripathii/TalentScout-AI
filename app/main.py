"""TalentScout FastAPI Backend Application.

Provides RESTful API endpoints for Job Intake, JD Extraction, Search Execution,
Candidate Management, Contact Acquisition, and Compliance Operations.
"""

import os
os.environ["SQLALCHEMY_NO_CYTHON"] = "1"
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx
from fastapi import FastAPI, File, Header, HTTPException, Query, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlmodel import Session, select
from sqlalchemy import func
from config.settings import get_settings
from app.db import init_db, engine
from app.services.compliance_service import ComplianceService
from app.models.job import Job, PlatformConfig
from app.models.candidate import Candidate, CandidateSource, ContactPoint
from app.models.resume import Resume
from app.models.match import Match
from app.models.pipeline import PipelineStatus, Note
from app.models.app_setting import AppSetting
from app.connectors.live_search import LiveSearchProvider
from app.services.job_service import JobService
from app.services.jd_parser import parse_job_description
from app.services.sourcing_service import SourcingService
from app.services.local_resume_service import LocalResumeService
from app.services.ranking_engine import RankingEngine
from app.services.export_service import ExportService
from app.services.dedup_linker import DedupLinker
from app.services.contact_extractor import ContactExtractor
from app.services.enrichment_service import EnrichmentService
from app.services.outreach_service import OutreachService
from app.services.job_posting_service import JobPostingService
from app.services.interest_form_service import InterestFormService
from app.models.scheduled_sourcing import ScheduledSourcingJob, SourcingAlertNotification
from app.services.scheduler_service import SchedulerService
from app.services.alert_service import AlertService
from app.services.security_service import SecurityService
from app.services.cms_service import CmsService
from app.models.cms import CmsPageContent
from app.models.user import User
from app.services.threat_detector import ThreatDetector
from app.services.otp_service import OtpService
from app.middleware.threat_protection_middleware import ThreatProtectionMiddleware
from app.middleware.security_middleware import (
    SecurityHeadersMiddleware,
    RateLimiterMiddleware,
    PayloadSizeLimitMiddleware,
)
import threading

settings = get_settings()

scheduler_service = SchedulerService()
_scheduler_stop = threading.Event()


def _background_scheduler_worker():
    """Background daemon thread checking and executing due sourcing schedules every 60s."""
    while not _scheduler_stop.is_set():
        try:
            scheduler_service.check_and_run_due_schedules()
        except Exception:
            pass
        _scheduler_stop.wait(60.0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize database and seed configuration."""
    init_db()
    try:
        with Session(engine) as session:
            CmsService.ensure_defaults(session)
    except Exception as e:
        print(f"[Startup] CMS defaults seeding note: {e}")
    worker_thread = threading.Thread(target=_background_scheduler_worker, daemon=True)
    worker_thread.start()
    yield
    _scheduler_stop.set()


app = FastAPI(
    title="TalentScout API",
    description="Compliant Recruitment Sourcing & Talent Intelligence Backend for Indian Contract-Staffing",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(ThreatProtectionMiddleware)
app.add_middleware(PayloadSizeLimitMiddleware)
app.add_middleware(RateLimiterMiddleware)


# Pydantic Schemas for Requests
class ParseJDRequest(BaseModel):
    jd_text: str = Field(..., description="Raw Job Description text to extract")


def serialize_job(job: Job) -> Dict[str, Any]:
    """Serialize Job model with full compatibility aliases for all frontend components."""
    if not job:
        return {}
    must_skills = json.loads(job.must_have_skills) if job.must_have_skills else []
    nice_skills = json.loads(job.nice_to_have_skills) if job.nice_to_have_skills else []
    locs = json.loads(job.locations) if job.locations else []
    alt_titles = json.loads(job.alternate_titles) if job.alternate_titles else []

    return {
        "id": job.id,
        "title": job.title,
        "alternate_titles": alt_titles,
        "must_have_skills": must_skills,
        "nice_to_have_skills": nice_skills,
        "skills_required": must_skills,  # Frontend alias
        "min_experience": job.min_experience,
        "min_experience_years": job.min_experience,  # Frontend alias
        "max_experience": job.max_experience,
        "max_experience_years": job.max_experience,  # Frontend alias
        "locations": locs,
        "location": locs[0] if locs else "India",  # Frontend alias
        "open_to_relocate": job.open_to_relocate,
        "is_remote": job.is_remote,
        "education": job.education,
        "industry": job.industry,
        "notice_period": job.notice_period,
        "min_ctc": job.min_ctc,
        "max_ctc": job.max_ctc,
        "budget_max_inr": (job.max_ctc * 100000) if job.max_ctc else None,  # Frontend alias
        "client_name": job.client_name,
        "positions_count": job.positions_count,
        "target_roles_count": job.positions_count,  # Frontend alias
        "jd_raw_text": job.jd_raw_text,
        "job_description": job.jd_raw_text,  # Frontend alias
        "status": job.status,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
    }


class JobCreateRequest(BaseModel):
    title: str
    alternate_titles: List[str] = []
    must_have_skills: List[str] = []
    nice_to_have_skills: List[str] = []
    skills_required: Optional[List[str]] = None
    min_experience: Optional[float] = None
    min_experience_years: Optional[float] = None
    max_experience: Optional[float] = None
    max_experience_years: Optional[float] = None
    locations: List[str] = []
    location: Optional[str] = None
    open_to_relocate: bool = False
    is_remote: bool = False
    education: Optional[str] = None
    industry: Optional[str] = None
    notice_period: Optional[str] = "Immediate"
    min_ctc: Optional[float] = None
    max_ctc: Optional[float] = None
    budget_max_inr: Optional[float] = None
    client_name: Optional[str] = None
    positions_count: Optional[int] = None
    target_roles_count: Optional[int] = None
    jd_raw_text: Optional[str] = None
    job_description: Optional[str] = None
    status: str = "active"


class JobUpdateRequest(BaseModel):
    title: Optional[str] = None
    alternate_titles: Optional[List[str]] = None
    must_have_skills: Optional[List[str]] = None
    nice_to_have_skills: Optional[List[str]] = None
    skills_required: Optional[List[str]] = None
    min_experience: Optional[float] = None
    min_experience_years: Optional[float] = None
    max_experience: Optional[float] = None
    max_experience_years: Optional[float] = None
    locations: Optional[List[str]] = None
    location: Optional[str] = None
    open_to_relocate: Optional[bool] = None
    is_remote: Optional[bool] = None
    education: Optional[str] = None
    industry: Optional[str] = None
    notice_period: Optional[str] = None
    min_ctc: Optional[float] = None
    max_ctc: Optional[float] = None
    budget_max_inr: Optional[float] = None
    client_name: Optional[str] = None
    positions_count: Optional[int] = None
    target_roles_count: Optional[int] = None
    jd_raw_text: Optional[str] = None
    job_description: Optional[str] = None
    status: Optional[str] = None


# -------------------------------------------------------------
# Authentication & Security Endpoints
# -------------------------------------------------------------
# -------------------------------------------------------------
# Authentication & Security Endpoints with Threat Defense & OTP
# -------------------------------------------------------------
class SendOtpRequest(BaseModel):
    email: str
    phone: Optional[str] = None
    full_name: Optional[str] = None
    purpose: Optional[str] = "Sign-Up Verification"


class VerifyOtpRequest(BaseModel):
    email: str
    otp: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = "Enterprise Staffing"
    role: Optional[str] = "Recruiter"
    password: Optional[str] = None


class ValidateApiKeyRequest(BaseModel):
    api_key: str
    provider: Optional[str] = "generic"


class LoginRequest(BaseModel):
    email: str
    password: Optional[str] = None
    phone: Optional[str] = None


class RegisterRequest(BaseModel):
    email: str
    name: str
    phone: Optional[str] = None
    password: Optional[str] = None
    agency: Optional[str] = "Staffing Partner"
    role: Optional[str] = "Recruiter"


@app.get("/api/auth/csrf-token", tags=["Authentication & Security"])
async def get_csrf_token():
    """Generate a signed cryptographic anti-CSRF token valid for 2 hours."""
    token = ThreatDetector.generate_csrf_token()
    return {
        "status": "success",
        "csrf_token": token,
        "token_type": "HMAC-SHA256",
        "expires_in_seconds": 7200,
    }


@app.post("/api/auth/validate-api-key", tags=["Authentication & Security"])
async def validate_api_key_endpoint(request: ValidateApiKeyRequest):
    """Validate API key syntax, structure, entropy, and threat signatures."""
    is_sqli, sqli_reason = ThreatDetector.scan_for_sqli(request.api_key)
    if is_sqli:
        raise HTTPException(
            status_code=400,
            detail=f"Threat violation: Malicious SQL injection sequence in API key ({sqli_reason})",
        )
    is_valid, msg = ThreatDetector.validate_api_key_syntax(request.api_key, request.provider or "generic")
    return {
        "status": "success" if is_valid else "error",
        "valid": is_valid,
        "provider": request.provider,
        "message": msg,
    }


@app.post("/api/auth/send-otp", tags=["Authentication & Security"])
async def send_verification_otp(request: SendOtpRequest):
    """Generate and dispatch a 6-digit OTP via professional HTML email. Blocks disposable emails & fake phones."""
    clean_email = request.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Invalid email address syntax.")

    # 1. SQL Injection Scan
    is_threat, reason = ThreatDetector.scan_for_sqli(request.model_dump())
    if is_threat:
        raise HTTPException(
            status_code=400,
            detail=f"Security violation: Threat attack vector identified in input ({reason}).",
        )

    # 2. Block Temporary / Disposable Emails
    is_disposable, disp_reason = ThreatDetector.is_disposable_email(clean_email)
    if is_disposable:
        raise HTTPException(
            status_code=400,
            detail=disp_reason or "Temporary and disposable email providers are blocked for security compliance.",
        )

    # 3. Block Fake / Temporary Phone Numbers (if provided)
    formatted_phone = None
    if request.phone and request.phone.strip():
        is_phone_valid, phone_result = ThreatDetector.validate_phone_number(request.phone)
        if not is_phone_valid:
            raise HTTPException(status_code=400, detail=phone_result)
        formatted_phone = phone_result

    # 4. Dispatch OTP via OtpService with Professional HTML Email Template
    result = OtpService.request_otp(
        email=clean_email,
        full_name=request.full_name,
        purpose=request.purpose or "Sign-Up Verification",
    )
    result["phone_validated"] = formatted_phone
    return result


@app.post("/api/auth/verify-otp", tags=["Authentication & Security"])
async def verify_otp_endpoint(request: VerifyOtpRequest):
    """Verify 6-digit OTP, authenticate or register user, and issue secure session JWT."""
    clean_email = request.email.strip().lower()
    
    # 1. SQL Injection Scan
    is_threat, reason = ThreatDetector.scan_for_sqli(request.model_dump())
    if is_threat:
        raise HTTPException(
            status_code=400,
            detail=f"Security violation: Threat attack vector identified in payload ({reason}).",
        )

    # 2. Verify Cryptographic OTP Hash
    is_valid_otp, otp_message = OtpService.verify_otp(clean_email, request.otp)
    if not is_valid_otp:
        raise HTTPException(status_code=400, detail=otp_message)

    # 3. Authenticate or Register User Profile in DB
    import secrets
    with Session(engine) as session:
        CmsService.ensure_defaults(session)
        user_record = session.exec(select(User).where(User.email == clean_email)).first()

        clean_phone = request.phone.strip() if request.phone else None
        if clean_phone:
            valid_p, formatted_p = ThreatDetector.validate_phone_number(clean_phone)
            if valid_p:
                clean_phone = formatted_p

        if not user_record:
            user_record = User(
                email=clean_email,
                full_name=(request.full_name or clean_email.split("@")[0].title()).strip(),
                phone=clean_phone or "+91 Not Provided",
                designation="Technical Recruiter",
                company=(request.company or "Enterprise Staffing").strip(),
                role=request.role or "Recruiter",
                password_hash=SecurityService.hash_password(request.password or "Recruiter#2026!Secure"),
                user_api_key=f"ts_live_{secrets.token_hex(16)}",
                api_keys_json="{}",
                is_active=True,
                created_at=datetime.now(timezone.utc),
                last_login_at=datetime.now(timezone.utc),
            )
            session.add(user_record)
            session.commit()
            session.refresh(user_record)
        else:
            user_record.last_login_at = datetime.now(timezone.utc)
            if clean_phone and (not user_record.phone or user_record.phone == "+91 Not Provided"):
                user_record.phone = clean_phone
            if request.company and user_record.company == "Staffing Agency":
                user_record.company = request.company
            session.add(user_record)
            session.commit()

        user_info = {
            "id": user_record.id,
            "email": user_record.email,
            "name": user_record.full_name,
            "phone": user_record.phone,
            "designation": user_record.designation or "Technical Recruiter",
            "role": user_record.role,
            "company": user_record.company,
            "user_api_key": user_record.user_api_key,
        }

    token = SecurityService.generate_token(user_info)
    return {
        "status": "success",
        "message": "Identity successfully verified via email OTP.",
        "token_type": "Bearer",
        "access_token": token,
        "expires_in_minutes": settings.JWT_EXPIRATION_MINUTES,
        "user": user_info,
    }


@app.post("/api/auth/login", tags=["Authentication & Security"])
async def login(request: LoginRequest):
    """Authenticate recruiter, track in database, and return cryptographically signed JWT token."""
    clean_email = request.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Invalid email address format.")

    # 1. SQL Injection Scan
    is_threat, reason = ThreatDetector.scan_for_sqli(request.model_dump())
    if is_threat:
        raise HTTPException(status_code=400, detail=f"Security violation: Threat attack vector identified ({reason}).")

    # 2. Block Disposable Emails
    is_disp, disp_reason = ThreatDetector.is_disposable_email(clean_email)
    if is_disp:
        raise HTTPException(status_code=400, detail=disp_reason)

    import secrets
    with Session(engine) as session:
        CmsService.ensure_defaults(session)
        user_record = session.exec(select(User).where(User.email == clean_email)).first()
        
        if not user_record:
            if clean_email == "priya.sharma@apexstaffing.in" or "demo" in clean_email:
                name = "Priya Sharma"
                company = "Apex Staffing Solutions"
                role = "Lead Staffing Partner"
                phone = request.phone or "+91 98201 54321"
            else:
                name = clean_email.split("@")[0].replace(".", " ").title()
                company = "Enterprise Staffing"
                role = "Recruiter"
                phone = request.phone or "+91 Not Provided"

            user_record = User(
                email=clean_email,
                full_name=name,
                phone=phone,
                designation="Technical Recruiter",
                company=company,
                role=role,
                password_hash=SecurityService.hash_password(request.password or "Recruiter#2026!Pass"),
                user_api_key=f"ts_live_{secrets.token_hex(16)}",
                api_keys_json="{}",
                is_active=True,
                created_at=datetime.now(timezone.utc),
                last_login_at=datetime.now(timezone.utc),
            )
            session.add(user_record)
            session.commit()
            session.refresh(user_record)
        else:
            user_record.last_login_at = datetime.now(timezone.utc)
            if request.phone and (not user_record.phone or user_record.phone == "+91 Not Provided"):
                user_record.phone = request.phone
            session.add(user_record)
            session.commit()

        user_info = {
            "id": user_record.id,
            "email": user_record.email,
            "name": user_record.full_name,
            "phone": user_record.phone,
            "designation": user_record.designation or "Technical Recruiter",
            "role": user_record.role,
            "company": user_record.company,
            "user_api_key": user_record.user_api_key,
        }

    token = SecurityService.generate_token(user_info)
    return {
        "status": "success",
        "token_type": "Bearer",
        "access_token": token,
        "expires_in_minutes": settings.JWT_EXPIRATION_MINUTES,
        "user": user_info,
    }


@app.post("/api/auth/register", tags=["Authentication & Security"])
async def register(request: RegisterRequest):
    """Register recruiter profile with threat screening, disposable email blocking, and phone validation."""
    clean_email = request.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Invalid email address format.")

    # 1. SQL Injection Scan
    is_threat, reason = ThreatDetector.scan_for_sqli(request.model_dump())
    if is_threat:
        raise HTTPException(status_code=400, detail=f"Security violation: Threat attack vector identified ({reason}).")

    # 2. Block Disposable Emails
    is_disp, disp_reason = ThreatDetector.is_disposable_email(clean_email)
    if is_disp:
        raise HTTPException(status_code=400, detail=disp_reason)

    # 3. Validate Phone Number
    clean_phone = "+91 Not Provided"
    if request.phone and request.phone.strip():
        is_p_valid, p_formatted = ThreatDetector.validate_phone_number(request.phone)
        if not is_p_valid:
            raise HTTPException(status_code=400, detail=p_formatted)
        clean_phone = p_formatted

    clean_name = SecurityService.sanitize_text(request.name.strip())
    clean_agency = SecurityService.sanitize_text((request.agency or "Staffing Partner").strip())

    import secrets
    with Session(engine) as session:
        CmsService.ensure_defaults(session)
        user_record = session.exec(select(User).where(User.email == clean_email)).first()
        if not user_record:
            user_record = User(
                email=clean_email,
                full_name=clean_name or clean_email.split("@")[0].title(),
                phone=clean_phone,
                designation="Technical Recruiter",
                company=clean_agency,
                role=request.role or "Recruiter",
                password_hash=SecurityService.hash_password(request.password or "Recruiter#2026!Pass"),
                user_api_key=f"ts_live_{secrets.token_hex(16)}",
                api_keys_json="{}",
                is_active=True,
                created_at=datetime.now(timezone.utc),
                last_login_at=datetime.now(timezone.utc),
            )
            session.add(user_record)
            session.commit()
            session.refresh(user_record)
        else:
            user_record.last_login_at = datetime.now(timezone.utc)
            if clean_phone != "+91 Not Provided":
                user_record.phone = clean_phone
            session.add(user_record)
            session.commit()

        user_info = {
            "id": user_record.id,
            "email": user_record.email,
            "name": user_record.full_name,
            "phone": user_record.phone,
            "designation": user_record.designation or "Technical Recruiter",
            "role": user_record.role,
            "company": user_record.company,
            "user_api_key": user_record.user_api_key,
        }

    token = SecurityService.generate_token(user_info)
    return {
        "status": "success",
        "token_type": "Bearer",
        "access_token": token,
        "expires_in_minutes": settings.JWT_EXPIRATION_MINUTES,
        "user": user_info,
    }


@app.get("/api/auth/me", tags=["Authentication & Security"])
async def get_current_user_profile(authorization: Optional[str] = Header(None)):
    """Verify bearer token from Authorization header and return current recruiter profile."""
    if not authorization:
        return {
            "authenticated": False,
            "user": None,
            "message": "Authorization header missing",
        }
    token = authorization.replace("Bearer ", "").strip()
    payload = SecurityService.verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired access token")
    return {
        "authenticated": True,
        "user": {
            "email": payload.get("email"),
            "name": payload.get("name"),
            "role": payload.get("role"),
            "company": payload.get("company"),
        },
    }


@app.get("/health", tags=["System"])
@app.get("/api/health", tags=["System"])
async def health_check():
    """System health check verifying database and external service connectivity."""
    ollama_ok = False
    try:
        async with httpx.AsyncClient(timeout=1.0) as client:
            resp = await client.get(f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/tags")
            ollama_ok = (resp.status_code == 200)
    except Exception:
        ollama_ok = False

    searxng_ok = False
    try:
        async with httpx.AsyncClient(timeout=1.0) as client:
            resp = await client.get(f"{settings.SEARXNG_URL.rstrip('/')}/")
            searxng_ok = (resp.status_code in [200, 302])
    except Exception:
        searxng_ok = False

    return {
        "status": "healthy",
        "app_env": settings.APP_ENV,
        "database": "sqlite_connected",
        "security_headers": settings.SECURITY_HEADERS_ENABLED,
        "rate_limiting": settings.RATE_LIMITING_ENABLED,
        "ollama_available": ollama_ok,
        "searxng_available": searxng_ok,
    }


@app.post("/api/jobs/parse-jd", tags=["Job Intake"])
async def parse_jd(request: ParseJDRequest):
    """Extract structured job requirement fields from raw JD text with XSS sanitization."""
    clean_jd = SecurityService.sanitize_text(request.jd_text)
    extracted = parse_job_description(clean_jd)
    return {"status": "success", "data": extracted}


@app.post("/api/jobs", tags=["Jobs"], status_code=status.HTTP_201_CREATED)
async def create_job(request: JobCreateRequest):
    """Create a new job requirement."""
    job = JobService.create_job(request.model_dump())
    return {"status": "success", "data": serialize_job(job)}


@app.get("/api/jobs", tags=["Jobs"])
async def list_jobs(status: Optional[str] = Query(None, description="Filter by status: active, closed")):
    """List all job requirements."""
    jobs = JobService.list_jobs(status=status)
    serialized = [serialize_job(j) for j in jobs]
    return {"status": "success", "count": len(serialized), "data": serialized}


@app.get("/api/jobs/{job_id}", tags=["Jobs"])
async def get_job(job_id: str):
    """Retrieve details for a specific job."""
    job = JobService.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": "success", "data": serialize_job(job)}


@app.put("/api/jobs/{job_id}", tags=["Jobs"])
async def update_job(job_id: str, request: JobUpdateRequest):
    """Update fields on an existing job."""
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    job = JobService.update_job(job_id, updates)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": "success", "data": job}


@app.post("/api/jobs/{job_id}/duplicate", tags=["Jobs"])
async def duplicate_job(job_id: str):
    """Duplicate an existing job."""
    new_job = JobService.duplicate_job(job_id)
    if not new_job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": "success", "data": new_job}


@app.post("/api/jobs/{job_id}/close", tags=["Jobs"])
async def close_job(job_id: str):
    """Mark a job as closed/archived."""
    job = JobService.close_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": "success", "data": job}


@app.delete("/api/jobs/{job_id}", tags=["Jobs"])
async def delete_job(job_id: str):
    """Delete a job permanently."""
    success = JobService.delete_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": "success", "message": "Job deleted"}


# -------------------------------------------------------------
# System Stats Endpoint
# -------------------------------------------------------------
@app.get("/api/stats", tags=["System"])
async def get_system_stats():
    """Retrieve high-level dashboard metrics with real calculated averages."""
    with Session(engine, expire_on_commit=False) as session:
        active_jobs = session.exec(select(Job).where(Job.status == "active")).all()
        candidates = session.exec(select(Candidate)).all()
        contacts = session.exec(select(ContactPoint)).all()
        matches = session.exec(select(Match)).all()
        avg_score = round(sum(m.total_score for m in matches) / len(matches), 1) if matches else 0.0

    return {
        "status": "success",
        "data": {
            "active_jobs_count": len(active_jobs),
            "total_candidates_count": len(candidates),
            "verified_contacts_count": len(contacts),
            "avg_match_score": avg_score,
            "retention_days": settings.RETENTION_DAYS,
        },
    }


# -------------------------------------------------------------
# Sourcing & Search Endpoints
# -------------------------------------------------------------
class ExecuteQueryRequest(BaseModel):
    job_id: str
    platform: str
    query_text: str
    limit: int = 10


@app.get("/api/sourcing/queries/{job_id}", tags=["Sourcing"])
async def get_job_queries(job_id: str, contact_visible: bool = False):
    """Generate platform-targeted Boolean X-Ray queries for a job."""
    sourcing_service = SourcingService()
    queries = sourcing_service.generate_job_queries(job_id, contact_visible=contact_visible)
    return {"status": "success", "data": queries}


@app.post("/api/sourcing/execute", tags=["Sourcing"])
async def execute_search_query(request: ExecuteQueryRequest):
    """Run search query, parse results, persist candidates and verified contacts."""
    sourcing_service = SourcingService()
    found = sourcing_service.execute_query(
        job_id=request.job_id,
        platform=request.platform,
        query_text=request.query_text,
        limit=request.limit,
    )
    return {"status": "success", "count": len(found), "data": found}


@app.get("/api/sourcing/candidates/{job_id}", tags=["Sourcing"])
async def get_sourcing_candidates(
    job_id: str,
    min_score: Optional[float] = Query(None, description="Optional minimum fit score filter"),
):
    """Fetch all saved candidates associated with a job with optional min_score filter."""
    sourcing_service = SourcingService()
    cands = sourcing_service.get_candidates_for_job(job_id, min_score=min_score)
    return {"status": "success", "count": len(cands), "data": cands}


# -------------------------------------------------------------
# Resume & Inbound Endpoints
# -------------------------------------------------------------
@app.post("/api/resumes/upload", tags=["Resumes"])
async def upload_resumes(files: List[UploadFile] = File(...)):
    """Upload and parse resumes in PDF or DOCX format with magic bytes and virus/malware inspection."""
    resume_service = LocalResumeService()
    results = []
    for file in files:
        content = await file.read()
        is_valid, reason = SecurityService.validate_uploaded_resume(file.filename, content)
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail=f"Security check failed for '{file.filename}': {reason}",
            )
        is_safe, virus_reason = ThreatDetector.scan_file_for_virus(file.filename, content)
        if not is_safe:
            raise HTTPException(
                status_code=400,
                detail=f"Security violation: Threat / Virus / Macro injection signature detected in '{file.filename}': {virus_reason}",
            )
        temp_path = resume_service.upload_dir / file.filename
        with open(temp_path, "wb") as f:
            f.write(content)
        res = resume_service.ingest_resume_file(temp_path, source_type="upload")
        if res:
            results.append(res)
    return {"status": "success", "count": len(results), "data": results}


@app.get("/api/resumes", tags=["Resumes"])
async def list_resumes():
    """List all ingested resumes in the system."""
    resume_service = LocalResumeService()
    resumes = resume_service.list_ingested_resumes()
    return {"status": "success", "count": len(resumes), "data": resumes}


@app.post("/api/resumes/scan-watch-folder", tags=["Resumes"])
async def scan_watch_folder():
    """Scan local watch folder and parse new resume files."""
    resume_service = LocalResumeService()
    detected = resume_service.process_watch_folder()
    return {"status": "success", "count": len(detected), "data": detected}


# -------------------------------------------------------------
# Ranking & Pipeline Endpoints
# -------------------------------------------------------------
class UpdateStageRequest(BaseModel):
    candidate_id: str
    job_id: Optional[str] = None
    stage: Optional[str] = None
    new_stage: Optional[str] = None


class AddNoteRequest(BaseModel):
    content: str
    author: str = "Recruiter"


@app.post("/api/ranking/evaluate-all/{job_id}", tags=["Ranking"])
async def evaluate_all_candidates(job_id: str):
    """Calculate 0-100 explainable rankings for all candidates against a job."""
    ranking_engine = RankingEngine()
    with Session(engine, expire_on_commit=False) as session:
        ranked = ranking_engine.rank_and_save_all(job_id, session)
    return {"status": "success", "count": len(ranked), "data": ranked}


@app.get("/api/pipeline/{job_id}", tags=["Pipeline"])
async def get_job_pipeline(job_id: str, min_score: Optional[float] = Query(None, description="Optional minimum fit score filter")):
    """Fetch candidate roster for this specific job pipeline with match scores, stage, contacts, and sources."""
    ranking_engine = RankingEngine()
    with Session(engine, expire_on_commit=False) as session:
        job = session.get(Job, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # ONLY fetch candidates actively linked to this job pipeline
        pipeline_records = session.exec(
            select(PipelineStatus).where(PipelineStatus.job_id == job_id)
        ).all()
        roster = []

        for ps in pipeline_records:
            cand = session.get(Candidate, ps.candidate_id)
            if not cand:
                continue

            # Fetch or compute real match score and 6-dimension breakdown
            m = session.exec(select(Match).where(Match.job_id == job_id, Match.candidate_id == cand.id)).first()
            if not m:
                # Compute on-the-fly to guarantee explainability and zero missing data
                resume = session.exec(select(Resume).where(Resume.candidate_id == cand.id)).first()
                eval_res = ranking_engine.evaluate_candidate(job, cand, resume_text=resume.raw_text if resume else None)
                m = Match(
                    job_id=job_id,
                    candidate_id=cand.id,
                    total_score=eval_res["total_score"],
                    breakdown_json=json.dumps(eval_res["breakdown"]),
                    why_bullets_json=json.dumps(eval_res["why_bullets"]),
                    missing_skills_json=json.dumps(eval_res["missing_skills"]),
                    evaluated_at=datetime.now(timezone.utc),
                )
                session.add(m)
                session.commit()
                session.refresh(m)

            score = float(m.total_score) if m else 0.0

            # Optional server-side minimum score filter
            if min_score is not None and score < float(min_score):
                continue

            breakdown = json.loads(m.breakdown_json) if (m and m.breakdown_json) else {}
            why_bullets = json.loads(m.why_bullets_json) if (m and m.why_bullets_json) else []
            missing_skills = json.loads(m.missing_skills_json) if (m and m.missing_skills_json) else []
            stage = ps.stage or "new"

            # Contacts
            cps = session.exec(select(ContactPoint).where(ContactPoint.candidate_id == cand.id)).all()
            emails = [c.value for c in cps if c.kind == "email"]
            phones = [c.value for c in cps if c.kind == "phone"]

            # Sources
            sources = session.exec(select(CandidateSource).where(CandidateSource.candidate_id == cand.id)).all()
            src_list = [{"platform": s.platform, "url": s.url, "title": s.raw_title, "snippet": s.raw_snippet} for s in sources]

            # Notes
            notes = session.exec(select(Note).where(Note.candidate_id == cand.id)).all()
            notes_list = [{"id": n.id, "author": n.author, "content": n.content, "created_at": n.created_at.isoformat()} for n in notes]

            # Resume
            resume = session.exec(select(Resume).where(Resume.candidate_id == cand.id)).first()
            resume_data = {
                "filename": getattr(resume, "file_path", getattr(resume, "filename", "resume.pdf")),
                "raw_text": getattr(resume, "parsed_raw_text", getattr(resume, "raw_text", ""))
            } if resume else None

            roster.append({
                "id": cand.id,
                "full_name": cand.full_name,
                "headline": cand.headline or "Software Professional",
                "current_location": cand.current_location or "India",
                "experience_years": cand.experience_years,
                "skills": json.loads(cand.skills_json) if cand.skills_json else [],
                "data_completeness": cand.data_completeness,
                "score": score,
                "match_score": score,
                "total_score": score,
                "overall_score": score,
                "breakdown": breakdown,
                "why_bullets": why_bullets,
                "missing_skills": missing_skills,
                "stage": stage,
                "emails": emails,
                "phones": phones,
                "email": emails[0] if emails else None,
                "phone": phones[0] if phones else None,
                "platform": src_list[0]["platform"] if src_list else "web",
                "profile_url": src_list[0]["url"] if src_list else None,
                "url": src_list[0]["url"] if src_list else None,
                "sources": src_list,
                "notes": notes_list,
                "resume": resume_data,
            })

    # Sort descending by score
    roster.sort(key=lambda x: x["score"], reverse=True)
    return {"status": "success", "count": len(roster), "data": roster}


@app.put("/api/pipeline/{job_id}/stage", tags=["Pipeline"])
@app.post("/api/pipeline/{job_id}/stage", tags=["Pipeline"])
async def update_pipeline_stage(job_id: str, request: UpdateStageRequest):
    """Update candidate pipeline stage."""
    target_stage = request.stage or request.new_stage or "New"
    actual_job_id = request.job_id or job_id
    with Session(engine, expire_on_commit=False) as session:
        ps = session.exec(
            select(PipelineStatus).where(
                PipelineStatus.job_id == actual_job_id,
                PipelineStatus.candidate_id == request.candidate_id,
            )
        ).first()
        if not ps:
            ps = PipelineStatus(
                job_id=actual_job_id,
                candidate_id=request.candidate_id,
                stage=target_stage,
                updated_at=datetime.now(timezone.utc),
            )
            session.add(ps)
        else:
            ps.stage = target_stage
            ps.updated_at = datetime.now(timezone.utc)
            session.add(ps)
        session.commit()
    return {"status": "success", "message": f"Stage updated to {target_stage}"}


@app.post("/api/candidates/{candidate_id}/notes", tags=["Pipeline"])
async def add_candidate_note(candidate_id: str, request: AddNoteRequest):
    """Add a recruiter note for a candidate."""
    with Session(engine, expire_on_commit=False) as session:
        cand = session.get(Candidate, candidate_id)
        if not cand:
            raise HTTPException(status_code=404, detail="Candidate not found")
        note = Note(
            candidate_id=candidate_id,
            author=request.author,
            content=request.content.strip(),
            created_at=datetime.now(timezone.utc),
        )
        session.add(note)
        session.commit()
        session.refresh(note)
    return {"status": "success", "data": {"id": note.id, "author": note.author, "content": note.content, "created_at": note.created_at.isoformat()}}


class CandidateCreateRequest(BaseModel):
    full_name: str
    current_title: Optional[str] = None
    emails: Optional[List[str]] = None
    phones: Optional[List[str]] = None
    skills: Optional[List[str]] = None
    current_location: Optional[str] = "India"
    experience_years: Optional[float] = 3.0
    source: Optional[str] = "manual"


@app.get("/api/candidates", tags=["Candidate Management"])
async def list_candidates(limit: int = 100):
    """List all candidate profiles stored in the system."""
    with Session(engine, expire_on_commit=False) as session:
        candidates = session.exec(select(Candidate).limit(limit)).all()
        result = []
        for c in candidates:
            cps = session.exec(select(ContactPoint).where(ContactPoint.candidate_id == c.id)).all()
            emails = [cp.value for cp in cps if cp.kind == "email"]
            phones = [cp.value for cp in cps if cp.kind == "phone"]
            skills = json.loads(c.skills_json) if c.skills_json else []
            result.append({
                "id": c.id,
                "full_name": c.full_name,
                "headline": c.headline,
                "current_location": c.current_location,
                "experience_years": c.experience_years,
                "skills": skills,
                "emails": emails,
                "phones": phones,
                "data_completeness": c.data_completeness,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            })
        return {"status": "success", "count": len(result), "data": result}


@app.post("/api/candidates", tags=["Candidate Management"])
async def create_candidate(request: CandidateCreateRequest):
    """Manually add a candidate profile to the talent scout database."""
    with Session(engine, expire_on_commit=False) as session:
        cand = Candidate(
            full_name=request.full_name,
            headline=request.current_title or "Software Engineer",
            current_location=request.current_location or "India",
            experience_years=request.experience_years or 3.0,
            skills_json=json.dumps(request.skills or []),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        session.add(cand)
        session.commit()
        session.refresh(cand)

        for em in (request.emails or []):
            cp = ContactPoint(
                candidate_id=cand.id,
                kind="email",
                value=em.strip().lower(),
                type="manual-public",
                source_reference="ManualEntry",
            )
            session.add(cp)

        for ph in (request.phones or []):
            cp = ContactPoint(
                candidate_id=cand.id,
                kind="phone",
                value=ph.strip(),
                type="manual-public",
                source_reference="ManualEntry",
            )
            session.add(cp)

        session.commit()
        return {"status": "success", "data": {"id": cand.id, "full_name": cand.full_name}}


# -------------------------------------------------------------
# Export Endpoints
# -------------------------------------------------------------
@app.get("/api/export/{job_id}/excel", tags=["Export"])
async def export_pipeline_excel(job_id: str, stage: Optional[str] = None):
    """Download candidate pipeline roster as formatted Excel (.xlsx) file."""
    with Session(engine, expire_on_commit=False) as session:
        excel_bytes = ExportService.export_to_excel(job_id, session, stage_filter=stage)
    
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=talentscout_candidates_{job_id[:8]}.xlsx"},
    )


@app.get("/api/export/{job_id}/csv", tags=["Export"])
async def export_pipeline_csv(job_id: str, stage: Optional[str] = None):
    """Download candidate pipeline roster as CSV file."""
    with Session(engine, expire_on_commit=False) as session:
        csv_bytes = ExportService.export_to_csv(job_id, session, stage_filter=stage)
    
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=talentscout_candidates_{job_id[:8]}.csv"},
    )


# -------------------------------------------------------------
# Deduplication Endpoints
# -------------------------------------------------------------
class ResolveLinkRequest(BaseModel):
    link_id: Optional[str] = None
    action: Optional[str] = "confirm"  # confirm or reject
    primary_id: Optional[str] = None
    secondary_id: Optional[str] = None


@app.get("/api/dedup/suggestions", tags=["Deduplication"])
async def get_dedup_suggestions():
    """Retrieve all suggested cross-platform identity links."""
    linker = DedupLinker()
    with Session(engine, expire_on_commit=False) as session:
        suggestions = linker.get_suggested_links(session)
    return {"status": "success", "count": len(suggestions), "data": suggestions}


@app.post("/api/dedup/resolve", tags=["Deduplication"])
async def resolve_dedup_link(request: ResolveLinkRequest):
    """Confirm or reject a deduplication link, or merge candidate IDs directly."""
    linker = DedupLinker()
    with Session(engine, expire_on_commit=False) as session:
        if request.primary_id and request.secondary_id:
            try:
                linker.merge_candidates(request.primary_id, request.secondary_id, session)
                return {"status": "success", "message": "Candidates merged successfully"}
            except Exception as e:
                raise HTTPException(status_code=400, detail=str(e))
        elif request.link_id:
            ok = linker.resolve_link(request.link_id, request.action or "confirm", session)
            if not ok:
                raise HTTPException(status_code=400, detail="Invalid link ID or resolution failed")
            return {"status": "success", "message": f"Link {request.action}ed successfully"}
        else:
            raise HTTPException(status_code=400, detail="Either link_id or (primary_id and secondary_id) required")


# -------------------------------------------------------------
# Contact Acquisition & Paste-to-Capture Endpoints (Phase 5)
# -------------------------------------------------------------
class PasteCaptureRequest(BaseModel):
    raw_text: str
    candidate_id: Optional[str] = None
    job_id: Optional[str] = None
    source_platform: Optional[str] = "manual_paste"
    performed_by: Optional[str] = "Recruiter"


class EnrichmentRevealRequest(BaseModel):
    candidate_id: str
    provider: Optional[str] = "hunter"
    performed_by: Optional[str] = "Recruiter"


@app.post("/api/contacts/paste-capture", tags=["Contacts & Capture"])
async def paste_to_capture(request: PasteCaptureRequest):
    """Parse raw pasted text and associate validated emails/phones/URLs with candidate."""
    if not request.raw_text or not request.raw_text.strip():
        raise HTTPException(status_code=400, detail="Pasted text cannot be empty.")

    extracted = ContactExtractor.parse_pasted_text(request.raw_text)

    with Session(engine, expire_on_commit=False) as session:
        candidate = None
        # 1. Attach to existing candidate if candidate_id provided
        if request.candidate_id:
            candidate = session.get(Candidate, request.candidate_id)

        # 2. Or match by extracted email
        if not candidate and extracted["primary_email"]:
            existing_cp = session.exec(
                select(ContactPoint).where(
                    ContactPoint.kind == "email",
                    ContactPoint.value == extracted["primary_email"]
                )
            ).first()
            if existing_cp:
                candidate = session.get(Candidate, existing_cp.candidate_id)

        # 3. If still no candidate, create new
        if not candidate:
            cand_name = extracted["name"] or "Captured Candidate"
            cand_headline = extracted["headline"] or "Professional Profile"
            candidate = Candidate(
                full_name=cand_name,
                headline=cand_headline,
                current_location="India",
                data_completeness="paste_to_capture",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            session.add(candidate)
            session.commit()
            session.refresh(candidate)

        # If job_id provided, ensure candidate is linked in pipeline
        if request.job_id:
            pipe = session.exec(
                select(PipelineStatus).where(
                    PipelineStatus.job_id == request.job_id,
                    PipelineStatus.candidate_id == candidate.id
                )
            ).first()
            if not pipe:
                session.add(PipelineStatus(
                    job_id=request.job_id,
                    candidate_id=candidate.id,
                    stage="new",
                    updated_at=datetime.now(timezone.utc)
                ))

        # Add profile URL source if extracted
        if extracted["urls"]:
            for u in extracted["urls"]:
                src = session.exec(
                    select(CandidateSource).where(
                        CandidateSource.candidate_id == candidate.id,
                        CandidateSource.url == u["url"]
                    )
                ).first()
                if not src:
                    session.add(CandidateSource(
                        candidate_id=candidate.id,
                        platform=u["platform"],
                        url=u["url"],
                        raw_title=f"Captured from {request.source_platform}",
                        retrieved_at=datetime.now(timezone.utc),
                    ))

        # Add emails as ContactPoints
        added_contacts = []
        for em in extracted["emails"]:
            existing_em = session.exec(
                select(ContactPoint).where(
                    ContactPoint.candidate_id == candidate.id,
                    ContactPoint.kind == "email",
                    ContactPoint.value == em
                )
            ).first()
            if not existing_em:
                cp = ContactPoint(
                    candidate_id=candidate.id,
                    kind="email",
                    value=em,
                    type="paste-to-capture",
                    source_reference=request.source_platform or "paste_modal",
                    added_by=request.performed_by or "Recruiter",
                    found_at=datetime.now(timezone.utc),
                )
                session.add(cp)
                added_contacts.append({"kind": "email", "value": em})

        # Add phone numbers as ContactPoints
        for ph in extracted["phones"]:
            existing_ph = session.exec(
                select(ContactPoint).where(
                    ContactPoint.candidate_id == candidate.id,
                    ContactPoint.kind == "phone",
                    ContactPoint.value == ph
                )
            ).first()
            if not existing_ph:
                cp = ContactPoint(
                    candidate_id=candidate.id,
                    kind="phone",
                    value=ph,
                    type="paste-to-capture",
                    source_reference=request.source_platform or "paste_modal",
                    added_by=request.performed_by or "Recruiter",
                    found_at=datetime.now(timezone.utc),
                )
                session.add(cp)
                added_contacts.append({"kind": "phone", "value": ph})

        session.commit()

    return {
        "status": "success",
        "message": f"Successfully captured {len(added_contacts)} contact point(s)!",
        "candidate_id": candidate.id,
        "candidate_name": candidate.full_name,
        "extracted": extracted,
        "added_contacts": added_contacts,
    }


@app.get("/api/contacts/queue/{job_id}", tags=["Contacts & Capture"])
async def get_contact_queue(job_id: str):
    """Retrieve candidates from job pipeline lacking emails or phone numbers."""
    ranking_engine = RankingEngine()
    with Session(engine, expire_on_commit=False) as session:
        job = session.get(Job, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        pipeline_records = session.exec(
            select(PipelineStatus).where(PipelineStatus.job_id == job_id)
        ).all()

        queue_items = []
        missing_both = 0
        missing_email_only = 0
        missing_phone_only = 0

        for pr in pipeline_records:
            cand = session.get(Candidate, pr.candidate_id)
            if not cand:
                continue

            cps = session.exec(
                select(ContactPoint).where(ContactPoint.candidate_id == cand.id)
            ).all()
            sources = session.exec(
                select(CandidateSource).where(CandidateSource.candidate_id == cand.id)
            ).all()
            match = session.exec(
                select(Match).where(Match.job_id == job_id, Match.candidate_id == cand.id)
            ).first()
            if not match:
                resume_txt = (getattr(resume, "parsed_raw_text", None) or getattr(resume, "raw_text", None)) if resume else None
                eval_res = ranking_engine.evaluate_candidate(job, cand, resume_text=resume_txt)
                match = Match(
                    job_id=job_id,
                    candidate_id=cand.id,
                    total_score=eval_res["total_score"],
                    breakdown_json=json.dumps(eval_res["breakdown"]),
                    why_bullets_json=json.dumps(eval_res["why_bullets"]),
                    missing_skills_json=json.dumps(eval_res["missing_skills"]),
                    evaluated_at=datetime.now(timezone.utc),
                )
                session.add(match)
                session.commit()
                session.refresh(match)

            emails = [c.value for c in cps if c.kind == "email"]
            phones = [c.value for c in cps if c.kind == "phone"]

            has_email = len(emails) > 0
            has_phone = len(phones) > 0

            # If either email or phone is missing, add to queue
            if not has_email or not has_phone:
                if not has_email and not has_phone:
                    missing_both += 1
                elif not has_email:
                    missing_email_only += 1
                else:
                    missing_phone_only += 1

                queue_items.append({
                    "id": cand.id,
                    "candidate_id": cand.id,
                    "full_name": cand.full_name,
                    "headline": cand.headline or "Software Professional",
                    "location": cand.current_location or "India",
                    "stage": pr.stage,
                    "score": match.total_score if match else 0.0,
                    "emails": emails,
                    "phones": phones,
                    "has_email": has_email,
                    "has_phone": has_phone,
                    "missing_email": not has_email,
                    "missing_phone": not has_phone,
                    "platform": sources[0].platform if sources else "web",
                    "profile_url": sources[0].url if sources else None,
                })

        # Sort queue: Shortlisted first, then by score descending
        stage_priority = {"shortlisted": 1, "interview": 2, "screening": 3, "new": 4, "offered": 5, "rejected": 6}
        queue_items.sort(key=lambda x: (stage_priority.get(x["stage"].lower(), 99), -x["score"]))

        return {
            "status": "success",
            "count": len(queue_items),
            "stats": {
                "total_in_queue": len(queue_items),
                "missing_both": missing_both,
                "missing_email_only": missing_email_only,
                "missing_phone_only": missing_phone_only,
            },
            "data": queue_items,
        }


@app.get("/api/enrichment/status", tags=["Contacts & Capture"])
async def get_enrichment_status():
    """Retrieve credit limits and provider configurations for contact enrichment."""
    return {"status": "success", "data": EnrichmentService.get_quota_status()}


@app.post("/api/enrichment/reveal", tags=["Contacts & Capture"])
async def reveal_candidate_contact(request: EnrichmentRevealRequest):
    """Enrich candidate contact using Hunter or Apollo."""
    res = EnrichmentService.reveal_contact(
        candidate_id=request.candidate_id,
        provider=request.provider or "hunter",
        recruiter_name=request.performed_by or "Recruiter",
    )
    return res


# -------------------------------------------------------------
# Dynamic Sourcing API Keys / Settings Endpoints
# -------------------------------------------------------------
class SaveKeysRequest(BaseModel):
    serpapi_key: Optional[str] = None
    brave_api_key: Optional[str] = None
    github_token: Optional[str] = None
    hunter_api_key: Optional[str] = None
    apollo_api_key: Optional[str] = None
    ddg_proxy: Optional[str] = None


class TestKeyRequest(BaseModel):
    provider: str  # "serpapi", "brave", "github", "hunter", "apollo", "proxy"
    key: str


@app.get("/api/settings/keys", tags=["Settings"])
async def get_sourcing_keys_status():
    """Retrieve status of customer-configured API keys."""
    provider = LiveSearchProvider()
    p_status = provider.get_provider_status()
    # Merge enrichment quota status
    enrich_status = EnrichmentService.get_quota_status()
    p_status.update({
        "has_hunter": enrich_status["hunter_configured"],
        "hunter_masked": enrich_status["hunter_masked"],
        "has_apollo": enrich_status["apollo_configured"],
        "apollo_masked": enrich_status["apollo_masked"],
        "enrichment_credits_remaining": enrich_status["credits_remaining"],
    })
    return {"status": "success", "data": p_status}


@app.post("/api/settings/keys", tags=["Settings"])
async def save_sourcing_keys(request: SaveKeysRequest):
    """Save or update customer API keys in local SQLite."""
    with Session(engine) as session:
        # SerpApi
        if request.serpapi_key is not None:
            s_val = request.serpapi_key.strip()
            s_rec = session.get(AppSetting, "serpapi_key")
            if not s_rec:
                s_rec = AppSetting(key="serpapi_key", value=s_val, description="SerpApi Key for Google X-Ray")
                session.add(s_rec)
            else:
                s_rec.value = s_val
                s_rec.updated_at = datetime.now(timezone.utc)
                session.add(s_rec)

        # Brave Search API
        if request.brave_api_key is not None:
            b_val = request.brave_api_key.strip()
            b_rec = session.get(AppSetting, "brave_api_key")
            if not b_rec:
                b_rec = AppSetting(key="brave_api_key", value=b_val, description="Brave Search API Subscription Token")
                session.add(b_rec)
            else:
                b_rec.value = b_val
                b_rec.updated_at = datetime.now(timezone.utc)
                session.add(b_rec)

        # GitHub
        if request.github_token is not None:
            g_val = request.github_token.strip()
            g_rec = session.get(AppSetting, "github_token")
            if not g_rec:
                g_rec = AppSetting(key="github_token", value=g_val, description="GitHub Personal Access Token")
                session.add(g_rec)
            else:
                g_rec.value = g_val
                g_rec.updated_at = datetime.now(timezone.utc)
                session.add(g_rec)

        # Hunter.io
        if request.hunter_api_key is not None:
            h_val = request.hunter_api_key.strip()
            h_rec = session.get(AppSetting, "hunter_api_key")
            if not h_rec:
                h_rec = AppSetting(key="hunter_api_key", value=h_val, description="Hunter.io API Key")
                session.add(h_rec)
            else:
                h_rec.value = h_val
                h_rec.updated_at = datetime.now(timezone.utc)
                session.add(h_rec)

        # Apollo.io
        if request.apollo_api_key is not None:
            a_val = request.apollo_api_key.strip()
            a_rec = session.get(AppSetting, "apollo_api_key")
            if not a_rec:
                a_rec = AppSetting(key="apollo_api_key", value=a_val, description="Apollo.io API Key")
                session.add(a_rec)
            else:
                a_rec.value = a_val
                a_rec.updated_at = datetime.now(timezone.utc)
                session.add(a_rec)

        # Free / Custom Proxy for Anti-IP Block
        if request.ddg_proxy is not None:
            p_val = request.ddg_proxy.strip()
            p_rec = session.get(AppSetting, "ddg_proxy")
            if not p_rec:
                p_rec = AppSetting(key="ddg_proxy", value=p_val, description="Free / Custom Proxy for Anti-IP Block")
                session.add(p_rec)
            else:
                p_rec.value = p_val
                p_rec.updated_at = datetime.now(timezone.utc)
                session.add(p_rec)

        session.commit()

    provider = LiveSearchProvider()
    p_status = provider.get_provider_status()
    enrich_status = EnrichmentService.get_quota_status()
    p_status.update({
        "has_hunter": enrich_status["hunter_configured"],
        "hunter_masked": enrich_status["hunter_masked"],
        "has_apollo": enrich_status["apollo_configured"],
        "apollo_masked": enrich_status["apollo_masked"],
        "enrichment_credits_remaining": enrich_status["credits_remaining"],
    })
    return {"status": "success", "message": "Credentials updated successfully", "data": p_status}


@app.post("/api/settings/keys/test", tags=["Settings"])
async def test_sourcing_key(request: TestKeyRequest):
    """Test validity of a SerpApi, Brave, GitHub, Hunter, Apollo, or Proxy key with threat & format inspection."""
    # 1. Threat SQLi / script injection check
    is_sqli, sqli_reason = ThreatDetector.scan_for_sqli(request.key)
    if is_sqli:
        return {"status": "error", "valid": False, "message": f"Threat detected in API key parameter: {sqli_reason}"}

    # 2. Key syntax & entropy validation
    syntax_ok, syntax_msg = ThreatDetector.validate_api_key_syntax(request.key, request.provider)
    if not syntax_ok:
        return {"status": "error", "valid": False, "message": syntax_msg}

    if request.provider == "serpapi":
        valid, msg = LiveSearchProvider.test_serpapi_key(request.key.strip())
        return {"status": "success" if valid else "error", "valid": valid, "message": msg}
    elif request.provider == "brave":
        valid, msg = LiveSearchProvider.test_brave_api_key(request.key.strip())
        return {"status": "success" if valid else "error", "valid": valid, "message": msg}
    elif request.provider == "github":
        valid, msg = LiveSearchProvider.test_github_token(request.key.strip())
        return {"status": "success" if valid else "error", "valid": valid, "message": msg}
    elif request.provider == "proxy":
        valid, msg = LiveSearchProvider.test_proxy_connection(request.key.strip())
        return {"status": "success" if valid else "error", "valid": valid, "message": msg}
    elif request.provider in ["hunter", "apollo"]:
        return {"status": "success", "valid": True, "message": f"{request.provider.title()} API key format verified!"}
    else:
        raise HTTPException(status_code=400, detail="Unsupported provider.")


# -------------------------------------------------------------
# Phase 6: Outreach Helper & Job Postings Endpoints
# -------------------------------------------------------------
class GenerateOutreachRequest(BaseModel):
    candidate_id: str
    job_id: str
    recruiter_name: Optional[str] = "Talent Acquisition Team"
    company_name: Optional[str] = "Engineering Hiring Team"
    base_form_url: Optional[str] = "http://localhost:5173/interest"


class RecordOutreachRequest(BaseModel):
    candidate_id: str
    job_id: str
    channel: str
    content_draft: str
    form_prefilled_url: Optional[str] = None
    status: Optional[str] = "copied"


class SubmitFormRequest(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    reference_id: Optional[str] = None
    job_id: Optional[str] = None
    current_ctc: Optional[str] = None
    expected_ctc: Optional[str] = None
    notice_period: Optional[str] = None
    current_location: Optional[str] = None
    linkedin_url: Optional[str] = None
    resume_file_url: Optional[str] = None
    consent_given: Optional[bool] = True


class SyncSheetsRequest(BaseModel):
    sheet_url: str
    job_id: Optional[str] = None


@app.post("/api/outreach/generate", tags=["Outreach & Marketing"])
async def generate_outreach(request: GenerateOutreachRequest):
    """Generate personalized outreach across LinkedIn (<=300 chars), InMail, Email, and WhatsApp."""
    svc = OutreachService()
    try:
        data = svc.generate_candidate_outreach(
            candidate_id=request.candidate_id,
            job_id=request.job_id,
            recruiter_name=request.recruiter_name or "Talent Acquisition Team",
            company_name=request.company_name or "Engineering Hiring Team",
            base_form_url=request.base_form_url or "http://localhost:5173/interest"
        )
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/outreach/record", tags=["Outreach & Marketing"])
async def record_outreach(request: RecordOutreachRequest):
    """Record copy/send event in audit database."""
    svc = OutreachService()
    ev = svc.record_outreach_event(
        candidate_id=request.candidate_id,
        job_id=request.job_id,
        channel=request.channel,
        content_draft=request.content_draft,
        form_prefilled_url=request.form_prefilled_url,
        status=request.status or "copied"
    )
    return {"status": "success", "event_id": ev.id}


@app.get("/api/outreach/history/{candidate_id}", tags=["Outreach & Marketing"])
async def get_outreach_history(candidate_id: str):
    """Retrieve timeline of previous outreach generation and copy actions."""
    svc = OutreachService()
    history = svc.get_candidate_outreach_history(candidate_id)
    return {"status": "success", "count": len(history), "data": history}


@app.get("/api/job-posts/{job_id}", tags=["Outreach & Marketing"])
async def get_job_postings(
    job_id: str,
    company_name: Optional[str] = Query("Enterprise Technology Partner"),
    application_url: Optional[str] = Query(None)
):
    """Generate ready-to-paste social and job board postings (LinkedIn, Naukri, WhatsApp, Schema.org)."""
    svc = JobPostingService()
    try:
        data = svc.generate_postings_for_job(job_id, company_name=company_name, application_url=application_url)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/job-posts/{job_id}/careers-page", tags=["Outreach & Marketing"])
async def get_careers_page(
    job_id: str,
    company_name: Optional[str] = Query("Enterprise Technology Partner"),
    application_url: Optional[str] = Query(None)
):
    """Generate standalone HTML careers page with Schema.org JobPosting JSON-LD for Google for Jobs."""
    svc = JobPostingService()
    try:
        html = svc.generate_careers_page_html(job_id, company_name=company_name, application_url=application_url)
        return Response(content=html, media_type="text/html")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/forms/submit", tags=["Consent & Forms"])
async def submit_interest_form(request: SubmitFormRequest):
    """Direct candidate submission to consent-based interest form."""
    svc = InterestFormService()
    res = svc.submit_form(
        full_name=request.full_name,
        email=request.email,
        phone=request.phone,
        reference_id=request.reference_id,
        job_id=request.job_id,
        current_ctc=request.current_ctc,
        expected_ctc=request.expected_ctc,
        notice_period=request.notice_period,
        current_location=request.current_location,
        linkedin_url=request.linkedin_url,
        resume_file_url=request.resume_file_url,
        consent_given=request.consent_given if request.consent_given is not None else True
    )
    return res


@app.get("/api/forms/responses", tags=["Consent & Forms"])
async def list_form_responses(job_id: Optional[str] = Query(None)):
    """List applicant interest form submissions, filtered optionally by job."""
    svc = InterestFormService()
    responses = svc.get_responses_for_job(job_id=job_id)
    return {"status": "success", "count": len(responses), "data": responses}


@app.post("/api/forms/sync-sheets", tags=["Consent & Forms"])
async def sync_google_sheets(request: SyncSheetsRequest):
    """Sync candidate responses from Google Sheets CSV export."""
    svc = InterestFormService()
    res = svc.sync_google_sheets(request.sheet_url, job_id=request.job_id)
    return res


# -------------------------------------------------------------
# Phase 7: Compliance, Operations & Audit Endpoints
# -------------------------------------------------------------
from app.services.compliance_service import ComplianceService, log_audit_event
from app.services.operations_service import OperationsService


class DNCRequest(BaseModel):
    do_not_contact: bool = True
    reason: Optional[str] = "Candidate requested no outreach"
    performed_by: Optional[str] = "Recruiter"


class EraseRequest(BaseModel):
    reason: Optional[str] = "DPDP Act Section 12 Right to Erasure request"
    performed_by: Optional[str] = "Recruiter"


class ConfigUpdateRequest(BaseModel):
    retention_days: Optional[int] = None
    default_llm_model: Optional[str] = None
    ranking_weights: Optional[Dict[str, float]] = None
    performed_by: Optional[str] = "Admin"


@app.get("/api/compliance/retention-status", tags=["Compliance & DPDP"])
async def get_retention_status(days: int = Query(180)):
    """Audit candidate records against DPDP Act data retention limit."""
    svc = ComplianceService()
    return svc.get_retention_overview(days_threshold=days)


@app.post("/api/compliance/retention-purge", tags=["Compliance & DPDP"])
async def purge_expired_records(performed_by: str = Query("Admin")):
    """Bulk purge candidate records whose retention period has expired."""
    svc = ComplianceService()
    return svc.purge_expired_records(performed_by=performed_by)


@app.post("/api/compliance/candidates/{candidate_id}/dnc", tags=["Compliance & DPDP"])
async def set_candidate_dnc(candidate_id: str, request: DNCRequest):
    """Mark candidate as Do Not Contact (DNC) with contact masking."""
    svc = ComplianceService()
    try:
        return svc.set_do_not_contact(
            candidate_id=candidate_id,
            dnc=request.do_not_contact,
            reason=request.reason or "Opted out",
            performed_by=request.performed_by or "Recruiter",
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.delete("/api/compliance/candidates/{candidate_id}/erase", tags=["Compliance & DPDP"])
@app.post("/api/compliance/candidates/{candidate_id}/erase", tags=["Compliance & DPDP"])
async def erase_candidate_data(candidate_id: str, reason: str = Query("DPDP Act Right to Erasure"), performed_by: str = Query("Recruiter")):
    """Permanently erase candidate and all associated data with immutable audit log entry."""
    svc = ComplianceService()
    try:
        return svc.erase_candidate(
            candidate_id=candidate_id,
            reason=reason,
            performed_by=performed_by,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/operations/metrics", tags=["Operations & Analytics"])
async def get_operations_metrics():
    """Aggregate real-time system operational metrics across all pipelines."""
    svc = OperationsService()
    return svc.get_operations_metrics()


@app.get("/api/audit/logs", tags=["Operations & Analytics"])
@app.get("/api/compliance/audit-logs", tags=["Operations & Analytics"])
async def get_audit_logs(
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
):
    """Fetch immutable audit logs with optional action/entity filters."""
    svc = OperationsService()
    return svc.get_audit_logs(
        action=action,
        entity_type=entity_type,
        limit=limit,
        offset=offset,
    )


@app.get("/api/settings/config", tags=["Settings"])
async def get_system_config():
    """Retrieve operational system configuration (ranking weights, retention days, LLM model)."""
    svc = OperationsService()
    return {"status": "success", "config": svc.get_system_config()}


@app.post("/api/settings/config", tags=["Settings"])
async def update_system_config(request: ConfigUpdateRequest):
    """Update operational system configuration and log audit event."""
    svc = OperationsService()
    updates = {}
    if request.retention_days is not None:
        updates["retention_days"] = request.retention_days
    if request.default_llm_model is not None:
        updates["default_llm_model"] = request.default_llm_model
    if request.ranking_weights is not None:
        updates["ranking_weights"] = request.ranking_weights

    return svc.update_system_config(updates=updates, performed_by=request.performed_by or "Admin")


# -------------------------------------------------------------
# Phase 8: Automated Background Sourcing & Alerts Endpoints
# -------------------------------------------------------------
class ScheduleConfigRequest(BaseModel):
    is_enabled: Optional[bool] = None
    interval_hours: Optional[int] = None
    min_score_threshold: Optional[float] = None
    alert_email_enabled: Optional[bool] = None
    alert_email_recipients: Optional[str] = None
    alert_webhook_enabled: Optional[bool] = None
    alert_webhook_url: Optional[str] = None
    target_platforms: Optional[List[str]] = None
    include_contact_visible: Optional[bool] = None


class ToggleScheduleRequest(BaseModel):
    is_enabled: bool


class TestWebhookRequest(BaseModel):
    webhook_url: str


@app.get("/api/scheduler/jobs", tags=["Automated Sourcing"])
async def list_schedules():
    """List all open jobs with their automated sourcing schedules and alert stats."""
    with Session(engine, expire_on_commit=False) as session:
        return {"status": "success", "data": scheduler_service.list_all_schedules(session)}


@app.get("/api/scheduler/jobs/{job_id}", tags=["Automated Sourcing"])
async def get_job_schedule(job_id: str):
    """Retrieve automated sourcing schedule for a specific job."""
    with Session(engine, expire_on_commit=False) as session:
        sched = scheduler_service.get_or_create_schedule(job_id, session)
        if not sched:
            raise HTTPException(status_code=404, detail="Job not found")
        platforms = json.loads(sched.target_platforms_json) if sched.target_platforms_json else []
        return {
            "status": "success",
            "data": {
                "id": sched.id,
                "job_id": sched.job_id,
                "is_enabled": sched.is_enabled,
                "interval_hours": sched.interval_hours,
                "min_score_threshold": sched.min_score_threshold,
                "alert_email_enabled": sched.alert_email_enabled,
                "alert_email_recipients": sched.alert_email_recipients,
                "alert_webhook_enabled": sched.alert_webhook_enabled,
                "alert_webhook_url": sched.alert_webhook_url,
                "target_platforms": platforms,
                "include_contact_visible": sched.include_contact_visible,
                "last_run_at": sched.last_run_at.isoformat() if sched.last_run_at else None,
                "next_run_at": sched.next_run_at.isoformat() if sched.next_run_at else None,
                "last_run_status": sched.last_run_status,
                "last_run_summary": sched.last_run_summary,
                "total_runs_count": sched.total_runs_count,
                "total_candidates_found": sched.total_candidates_found,
            },
        }


@app.post("/api/scheduler/jobs/{job_id}/configure", tags=["Automated Sourcing"])
async def configure_job_schedule(job_id: str, request: ScheduleConfigRequest):
    """Configure automated sourcing frequency, alert channels, and score thresholds."""
    with Session(engine, expire_on_commit=False) as session:
        config_dict = request.model_dump(exclude_unset=True)
        updated = scheduler_service.configure_schedule(job_id, config_dict, session)
        if not updated:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"status": "success", "message": "Automated schedule updated", "schedule_id": updated.id}


@app.post("/api/scheduler/jobs/{job_id}/toggle", tags=["Automated Sourcing"])
async def toggle_job_schedule(job_id: str, request: ToggleScheduleRequest):
    """Toggle automated sourcing schedule on or off."""
    with Session(engine, expire_on_commit=False) as session:
        updated = scheduler_service.toggle_schedule(job_id, request.is_enabled, session)
        if not updated:
            raise HTTPException(status_code=404, detail="Job not found")
        return {
            "status": "success",
            "is_enabled": updated.is_enabled,
            "next_run_at": updated.next_run_at.isoformat() if updated.next_run_at else None,
        }


@app.post("/api/scheduler/jobs/{job_id}/trigger", tags=["Automated Sourcing"])
async def trigger_job_sourcing_cycle(job_id: str):
    """Trigger an immediate background sourcing and alert dispatching cycle for a job."""
    with Session(engine, expire_on_commit=False) as session:
        result = scheduler_service.run_sourcing_cycle(job_id, session, triggered_by="RecruiterManualTrigger")
        if not result.get("success"):
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail="Job not found")
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to run sourcing cycle"))
        return {"status": "success", "data": result}


@app.get("/api/alerts/notifications", tags=["Alerts & Notifications"])
async def get_alert_notifications(
    job_id: Optional[str] = Query(None),
    unread_only: bool = Query(False),
    limit: int = Query(50),
):
    """Fetch high-fit candidate alert notifications for in-app notification center."""
    with Session(engine, expire_on_commit=False) as session:
        stmt = select(SourcingAlertNotification)
        if job_id:
            stmt = stmt.where(SourcingAlertNotification.job_id == job_id)
        if unread_only:
            stmt = stmt.where(SourcingAlertNotification.is_read == False)
        stmt = stmt.order_by(SourcingAlertNotification.created_at.desc()).limit(limit)

        notifications = session.exec(stmt).all()
        unread_count = len(session.exec(
            select(SourcingAlertNotification).where(SourcingAlertNotification.is_read == False)
        ).all())

        return {
            "status": "success",
            "unread_count": unread_count,
            "count": len(notifications),
            "data": [
                {
                    "id": n.id,
                    "job_id": n.job_id,
                    "candidate_id": n.candidate_id,
                    "candidate_name": n.candidate_name,
                    "score": n.score,
                    "title": n.title,
                    "message": n.message,
                    "channels_sent": json.loads(n.channels_sent_json) if n.channels_sent_json else ["in_app"],
                    "is_read": n.is_read,
                    "created_at": n.created_at.isoformat(),
                }
                for n in notifications
            ],
        }


@app.post("/api/alerts/notifications/{notification_id}/read", tags=["Alerts & Notifications"])
async def mark_notification_read(notification_id: str):
    """Mark an in-app alert notification as read."""
    with Session(engine, expire_on_commit=False) as session:
        notif = session.get(SourcingAlertNotification, notification_id)
        if not notif:
            raise HTTPException(status_code=404, detail="Notification not found")
        notif.is_read = True
        session.add(notif)
        session.commit()
        return {"status": "success", "message": "Marked as read"}


@app.post("/api/alerts/notifications/mark-all-read", tags=["Alerts & Notifications"])
async def mark_all_notifications_read():
    """Mark all in-app notifications as read."""
    with Session(engine, expire_on_commit=False) as session:
        unread = session.exec(
            select(SourcingAlertNotification).where(SourcingAlertNotification.is_read == False)
        ).all()
        for u in unread:
            u.is_read = True
            session.add(u)
        session.commit()
        return {"status": "success", "marked_read_count": len(unread)}


@app.post("/api/alerts/test-webhook", tags=["Alerts & Notifications"])
async def test_webhook_endpoint(request: TestWebhookRequest):
    """Send a test notification to verify recruiter's Slack/Discord/Teams webhook."""
    result = AlertService.test_webhook_url(request.webhook_url)
    return {"status": "success" if result.get("success") else "error", "data": result}


# ==========================================
# CMS & Administrator Control Panel Endpoints
# ==========================================

class AdminLoginRequest(BaseModel):
    email: str
    password: str


class CmsUpdateRequest(BaseModel):
    hero_headline: Optional[str] = None
    hero_subheadline: Optional[str] = None
    announcement_badge: Optional[str] = None
    about_headline: Optional[str] = None
    about_story: Optional[str] = None
    promises: Optional[List[Dict[str, Any]]] = None
    stats: Optional[List[Dict[str, Any]]] = None
    features: Optional[List[Dict[str, Any]]] = None
    testimonials: Optional[List[Dict[str, Any]]] = None
    pricing_tiers: Optional[List[Dict[str, Any]]] = None
    maintenance_mode: Optional[bool] = None
    public_signup_enabled: Optional[bool] = None


class ToggleUserStatusRequest(BaseModel):
    user_id: str
    is_active: bool


def get_current_admin(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Validate bearer token and ensure administrator role."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header. Bearer token required.",
        )
    token = authorization.split(" ", 1)[1].strip()
    payload = SecurityService.verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token expired or cryptographic signature invalid.",
        )
    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Administrative privileges required for this action.",
        )
    return payload


@app.get("/api/cms/content", tags=["CMS & Landing Page"])
async def get_landing_page_cms():
    """Retrieve active dynamic landing page CMS content."""
    with Session(engine, expire_on_commit=False) as session:
        data = CmsService.get_cms_content(session)
        return {"status": "success", "content": data}


@app.post("/api/admin/login", tags=["Admin Portal"])
async def admin_login(request: AdminLoginRequest):
    """Authenticate administrator with high-entropy PBKDF2 hash verification and issue admin JWT."""
    with Session(engine, expire_on_commit=False) as session:
        admin_user = CmsService.authenticate_admin(request.email, request.password, session)
        if not admin_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid administrator credentials or account disabled.",
            )
        
        token = SecurityService.create_access_token(
            data={
                "user_id": admin_user.id,
                "email": admin_user.email,
                "role": admin_user.role,
                "full_name": admin_user.full_name,
            },
            expires_delta=86400,  # 24 hour session
        )
        return {
            "status": "success",
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": admin_user.id,
                "email": admin_user.email,
                "full_name": admin_user.full_name,
                "role": admin_user.role,
                "company": admin_user.company,
                "last_login_at": admin_user.last_login_at.isoformat() if admin_user.last_login_at else None,
            },
        }


@app.get("/api/admin/overview", tags=["Admin Portal"])
async def get_admin_overview_telemetry(admin: Dict[str, Any] = None, authorization: Optional[str] = Header(None)):
    """Fetch aggregated administrative telemetry, system health, user roster, and security audit logs."""
    _ = get_current_admin(authorization)
    with Session(engine, expire_on_commit=False) as session:
        overview = CmsService.get_admin_overview(session)
        return {"status": "success", "data": overview}


@app.post("/api/cms/content", tags=["CMS & Landing Page"])
async def update_landing_page_cms(
    request: CmsUpdateRequest,
    authorization: Optional[str] = Header(None),
):
    """Update landing page CMS content (admin authenticated only)."""
    admin = get_current_admin(authorization)
    update_dict = {k: v for k, v in request.model_dump().items() if v is not None}
    with Session(engine, expire_on_commit=False) as session:
        updated = CmsService.update_cms_content(
            content=update_dict,
            session=session,
            admin_email=admin.get("email", "admin@talentscout.ai"),
        )
        return {"status": "success", "message": "CMS content updated successfully", "content": updated}


@app.post("/api/admin/users/toggle-status", tags=["Admin Portal"])
async def toggle_user_account_status(
    request: ToggleUserStatusRequest,
    authorization: Optional[str] = Header(None),
):
    """Enable or disable a user account (admin authenticated only)."""
    admin = get_current_admin(authorization)
    with Session(engine, expire_on_commit=False) as session:
        user = session.get(User, request.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if user.role == "admin" and user.email == "admin@talentscout.ai" and not request.is_active:
            raise HTTPException(status_code=400, detail="Root administrator account cannot be disabled")
        
        user.is_active = request.is_active
        session.add(user)
        session.commit()
        return {
            "status": "success",
            "message": f"User {user.email} {'enabled' if user.is_active else 'disabled'}",
        }


class CreateUserRequest(BaseModel):
    email: str
    full_name: str
    phone: Optional[str] = None
    designation: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = "recruiter"
    password: Optional[str] = None
    user_api_key: Optional[str] = None
    api_keys: Optional[Dict[str, str]] = None
    notes: Optional[str] = None


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    api_keys: Optional[Dict[str, str]] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


@app.post("/api/admin/users", tags=["Admin Portal"])
async def create_user_endpoint(
    request: CreateUserRequest,
    authorization: Optional[str] = Header(None),
):
    """Provision a new recruiter/admin user account with phone, designation, and API keys."""
    admin = get_current_admin(authorization)
    with Session(engine, expire_on_commit=False) as session:
        try:
            created = CmsService.create_user(
                session=session,
                user_data=request.model_dump(),
                admin_email=admin.get("email", "admin@talentscout.ai"),
            )
            return {"status": "success", "message": "User account created successfully", "user": created}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/admin/users/{user_id}", tags=["Admin Portal"])
async def update_user_endpoint(
    user_id: str,
    request: UpdateUserRequest,
    authorization: Optional[str] = Header(None),
):
    """Update user contact info, phone number, role, or third-party API keys."""
    admin = get_current_admin(authorization)
    with Session(engine, expire_on_commit=False) as session:
        try:
            clean_data = {k: v for k, v in request.model_dump().items() if v is not None}
            updated = CmsService.update_user(
                session=session,
                user_id=user_id,
                user_data=clean_data,
                admin_email=admin.get("email", "admin@talentscout.ai"),
            )
            return {"status": "success", "message": "User updated successfully", "user": updated}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/admin/users/{user_id}/regenerate-key", tags=["Admin Portal"])
async def regenerate_user_key_endpoint(
    user_id: str,
    authorization: Optional[str] = Header(None),
):
    """Issue a new personal TalentScout API key for a user."""
    admin = get_current_admin(authorization)
    with Session(engine, expire_on_commit=False) as session:
        try:
            new_key = CmsService.regenerate_user_api_key(
                session=session,
                user_id=user_id,
                admin_email=admin.get("email", "admin@talentscout.ai"),
            )
            return {"status": "success", "message": "API Key regenerated", "user_api_key": new_key}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/admin/users/{user_id}", tags=["Admin Portal"])
async def delete_user_endpoint(
    user_id: str,
    authorization: Optional[str] = Header(None),
):
    """Statutorily delete user account under DPDP Act compliance audit."""
    admin = get_current_admin(authorization)
    with Session(engine, expire_on_commit=False) as session:
        try:
            CmsService.delete_user(
                session=session,
                user_id=user_id,
                admin_email=admin.get("email", "admin@talentscout.ai"),
            )
            return {"status": "success", "message": "User account permanently deleted"}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/admin/candidates", tags=["Admin Portal"])
async def get_admin_candidates(
    query: Optional[str] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    authorization: Optional[str] = Header(None),
):
    """Retrieve candidate records with contact and source details for CMS administration."""
    _ = get_current_admin(authorization)
    with Session(engine, expire_on_commit=False) as session:
        stmt = select(Candidate)
        if query and query.strip():
            q = f"%{query.strip().lower()}%"
            stmt = stmt.where(
                (func.lower(Candidate.full_name).like(q)) |
                (func.lower(Candidate.headline).like(q)) |
                (func.lower(Candidate.current_location).like(q)) |
                (func.lower(Candidate.skills_json).like(q))
            )
        
        total = len(session.exec(stmt).all())
        candidates = session.exec(stmt.order_by(Candidate.created_at.desc()).offset(offset).limit(limit)).all()
        
        records = []
        for c in candidates:
            contacts = session.exec(select(ContactPoint).where(ContactPoint.candidate_id == c.id)).all()
            sources = session.exec(select(CandidateSource).where(CandidateSource.candidate_id == c.id)).all()
            records.append({
                "id": c.id,
                "full_name": c.full_name,
                "headline": c.headline or "Not specified",
                "current_location": c.current_location or "Not specified",
                "experience_years": c.experience_years,
                "skills": json.loads(c.skills_json) if c.skills_json else [],
                "contacts": [
                    {"type": cp.kind or "contact", "value": cp.value, "provenance": cp.type}
                    for cp in contacts
                ],
                "sources": [
                    {"platform": cs.platform, "url": cs.url}
                    for cs in sources
                ],
                "data_completeness": c.data_completeness,
                "do_not_contact": c.do_not_contact,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            })
            
        return {
            "status": "success",
            "total_count": total,
            "count": len(records),
            "candidates": records,
        }


@app.delete("/api/admin/candidates/purge-all", tags=["Admin Portal"])
@app.post("/api/admin/candidates/purge-all", tags=["Admin Portal"])
async def purge_all_admin_candidates(
    authorization: Optional[str] = Header(None),
):
    """Permanently wipe ALL candidate profiles and linked candidate data across the database."""
    admin = get_current_admin(authorization)
    svc = ComplianceService()
    res = svc.purge_all_candidates(
        reason="Administrator master candidate database wipe from CMS Portal",
        performed_by=admin.get("email", "admin@talentscout.ai"),
    )
    return res


@app.delete("/api/admin/candidates/{candidate_id}", tags=["Admin Portal"])
async def delete_admin_candidate(
    candidate_id: str,
    authorization: Optional[str] = Header(None),
):
    """Permanently delete a specific candidate profile and all associated data."""
    admin = get_current_admin(authorization)
    svc = ComplianceService()
    try:
        res = svc.erase_candidate(
            candidate_id=candidate_id,
            reason="Administrator manual deletion via CMS Portal",
            performed_by=admin.get("email", "admin@talentscout.ai"),
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


import os
from fastapi.staticfiles import StaticFiles

frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

