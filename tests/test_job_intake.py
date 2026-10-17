"""Unit and Integration Tests for Phase 1: Job Intake, JD Parser, and Database Models."""

import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.jd_parser import parse_job_description, rule_based_extract
from app.services.job_service import JobService
from app.models.job import Job
from app.models.audit import AuditLog
from app.db import init_db, engine
from sqlmodel import Session, select


@pytest.fixture(autouse=True)
def setup_db():
    """Ensure database schema is ready before tests."""
    init_db()


def test_rule_based_jd_extraction():
    """Verify rule-based extraction correctly identifies Indian recruitment fields."""
    sample_jd = """
    Urgent Hiring: Senior Java Developer
    We are looking for an experienced Java Spring Boot developer with 3 to 6 years of experience.
    Must have hands-on experience in Java, Spring Boot, Microservices, and REST API.
    Nice to have: Docker, AWS.
    Locations: Bhopal or Indore (Hybrid / Remote options available).
    Notice Period: Immediate joiner preferred (max 15 days).
    Budget: 8 - 14 LPA based on experience.
    Candidate must be open to relocate if needed.
    """
    res = rule_based_extract(sample_jd)

    assert "Java" in res["must_have_skills"]
    assert "Spring Boot" in res["must_have_skills"]
    assert res["min_experience"] == 3.0
    assert res["max_experience"] == 6.0
    assert "Bhopal" in res["locations"] or "Indore" in res["locations"]
    assert res["notice_period"] in ["Immediate", "15 Days"]
    assert res["min_ctc"] == 8.0
    assert res["max_ctc"] == 14.0
    assert res["is_remote"] is True
    assert res["open_to_relocate"] is True


def test_job_service_lifecycle():
    """Verify Job CRUD lifecycle and corresponding AuditLog trail."""
    job_data = {
        "title": "Java Spring Boot Developer",
        "alternate_titles": ["Backend Engineer", "Java Developer"],
        "must_have_skills": ["Java", "Spring Boot"],
        "nice_to_have_skills": ["Docker", "Kubernetes"],
        "min_experience": 3.0,
        "max_experience": 6.0,
        "locations": ["Bhopal", "Indore"],
        "notice_period": "Immediate",
        "min_ctc": 8.0,
        "max_ctc": 14.0,
        "client_name": "Acme Tech",
        "positions_count": 2,
    }

    # 1. Create
    job = JobService.create_job(job_data, performed_by="TestRecruiter")
    assert job.id is not None
    assert job.title == "Java Spring Boot Developer"

    # Verify AuditLog
    with Session(engine, expire_on_commit=False) as session:
        audit = session.exec(
            select(AuditLog).where(AuditLog.entity_id == job.id, AuditLog.action == "create")
        ).first()
        assert audit is not None
        assert audit.performed_by == "TestRecruiter"

    # 2. Duplicate
    dup_job = JobService.duplicate_job(job.id, performed_by="TestRecruiter")
    assert dup_job is not None
    assert dup_job.title == "Java Spring Boot Developer (Copy)"
    assert dup_job.id != job.id

    # 3. Close
    closed_job = JobService.close_job(job.id, performed_by="TestRecruiter")
    assert closed_job.status == "closed"

    # 4. Delete
    deleted = JobService.delete_job(dup_job.id, performed_by="TestRecruiter")
    assert deleted is True


def test_api_endpoints():
    """Test FastAPI REST endpoints for Phase 1."""
    client = TestClient(app)

    # Health
    health_resp = client.get("/health")
    assert health_resp.status_code == 200
    assert health_resp.json()["status"] == "healthy"

    # Parse JD
    jd_payload = {"jd_text": "Java Spring Boot engineer with 3-6 years exp in Indore."}
    parse_resp = client.post("/api/jobs/parse-jd", json=jd_payload)
    assert parse_resp.status_code == 200
    data = parse_resp.json()["data"]
    assert "Java" in data["must_have_skills"] or "Spring Boot" in data["must_have_skills"]

    # Create Job
    job_payload = {
        "title": "Full Stack Python Developer",
        "must_have_skills": ["Python", "FastAPI", "React"],
        "min_experience": 2.0,
        "max_experience": 5.0,
        "locations": ["Pune", "Bengaluru"],
        "positions_count": 1,
    }
    create_resp = client.post("/api/jobs", json=job_payload)
    assert create_resp.status_code == 201
    created_id = create_resp.json()["data"]["id"]

    # List Jobs
    list_resp = client.get("/api/jobs")
    assert list_resp.status_code == 200
    assert any(j["id"] == created_id for j in list_resp.json()["data"])
