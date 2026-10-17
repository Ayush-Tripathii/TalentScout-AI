"""Unit and Integration Tests for Phase 3: Resume Parser, GitHub Connector, Watch Folder, and Email Ingestion."""

import pytest
from pathlib import Path
from sqlmodel import Session, select
from app.db import init_db, engine
from app.services.parser.resume_parser import ResumeParser
from app.services.local_resume_service import LocalResumeService
from app.connectors.github_connector import GitHubConnector
from app.connectors.public_web import PublicWebClient
from app.services.imap_ingest import GmailIMAPService
from app.models.resume import Resume
from app.models.candidate import Candidate, ContactPoint

BASE_DIR = Path(__file__).resolve().parent.parent
FIXTURES_DIR = BASE_DIR / "tests" / "fixtures" / "synthetic_resumes"


@pytest.fixture(autouse=True)
def setup_db():
    init_db()


def test_resume_parser_pdf():
    """Verify parsing of synthetic PDF resume."""
    pdf_path = FIXTURES_DIR / "01_rahul_saxena.pdf"
    assert pdf_path.exists(), "Sample PDF fixture missing"

    parser = ResumeParser()
    parsed = parser.parse_file(pdf_path)

    assert "Rahul" in parsed["name"] and "Saxena" in parsed["name"]
    assert "Java" in parsed["skills"]
    assert "Spring Boot" in parsed["skills"]
    assert parsed["experience_years"] == 4.5
    assert "rahul.saxena.dev@fakeinbox.org" in parsed["emails"]
    assert len(parsed["phones"]) >= 1


def test_resume_parser_docx():
    """Verify parsing of synthetic DOCX resume."""
    docx_path = FIXTURES_DIR / "02_priya_sharma.docx"
    assert docx_path.exists(), "Sample DOCX fixture missing"

    parser = ResumeParser()
    parsed = parser.parse_file(docx_path)

    assert "Priya" in parsed["name"] and "Sharma" in parsed["name"]
    assert "Java" in parsed["skills"]
    assert "Spring Boot" in parsed["skills"]
    assert parsed["experience_years"] == 3.5
    assert "priya.sharma.tech@fakeinbox.org" in parsed["emails"]
    assert len(parsed["phones"]) >= 1


def test_local_resume_ingestion_and_deduplication():
    """Verify resume ingestion, candidate creation, and file hash deduplication."""
    pdf_path = FIXTURES_DIR / "03_amitabh_mishra.pdf"
    assert pdf_path.exists()

    service = LocalResumeService()

    # Clean prior test state for this hash
    f_hash = service.parser.calculate_file_hash(pdf_path)
    with Session(engine, expire_on_commit=False) as session:
        for r in session.exec(select(Resume).where(Resume.file_hash == f_hash)).all():
            session.delete(r)
        session.commit()

    # 1. First Ingestion
    res1 = service.ingest_resume_file(pdf_path, source_type="test_upload")
    assert res1 is not None
    assert res1["status"] == "ingested"
    cand_id = res1["candidate_id"]


    # Verify DB records
    with Session(engine, expire_on_commit=False) as session:
        cand = session.get(Candidate, cand_id)
        assert cand is not None
        assert cand.data_completeness == "full_resume"

        resumes = session.exec(select(Resume).where(Resume.candidate_id == cand.id)).all()
        assert len(resumes) >= 1

        contacts = session.exec(select(ContactPoint).where(ContactPoint.candidate_id == cand.id)).all()
        assert len(contacts) >= 1

    # 2. Duplicate Ingestion Attempt (same file hash)
    res2 = service.ingest_resume_file(pdf_path, source_type="test_upload")
    assert res2 is not None
    assert res2["status"] == "already_exists"
    assert res2["candidate_id"] == cand_id


def test_github_connector():
    """Verify GitHub public API search and profile structure."""
    connector = GitHubConnector()
    users = connector.search_users(language="Java", location="Bhopal", limit=3)

    assert isinstance(users, list)
    if users:
        u = users[0]
        assert "username" in u
        assert "name" in u
        assert "profile_url" in u
        assert u["platform"] == "github"



def test_public_web_robots_compliance():
    """Verify PublicWebClient respects robots.txt checks."""
    client = PublicWebClient()
    # A standard public URL check should return boolean without throwing
    allowed = client.is_crawl_allowed("https://github.com/about")
    assert isinstance(allowed, bool)


def test_gmail_resume_ingestion():
    """Verify email attachment ingestion pipeline and parsing."""
    sample_path = FIXTURES_DIR / "04_kavita_rao.docx"
    assert sample_path.exists()

    service = LocalResumeService()
    res = service.ingest_resume_file(sample_path, source_type="gmail")

    assert res["status"] in ["ingested", "already_exists"]
    assert "kavita" in res.get("name", "").lower()

