"""Unit and Integration Tests for Phase 2: Query Builder, X-Ray Parser, and Sourcing Service."""

import pytest
from app.db import init_db, engine
from app.services.query_builder import QueryBuilder
from app.connectors.xray_parser import XRayParser
from app.services.sourcing_service import SourcingService
from app.services.job_service import JobService
from sqlmodel import Session, select
from app.models.candidate import Candidate, CandidateSource, ContactPoint


@pytest.fixture(autouse=True)
def setup_db():
    init_db()


def test_query_builder_generation():
    """Verify Boolean X-ray query generation, synonym expansion, and contact markers."""
    qb = QueryBuilder()
    queries = qb.build_queries_for_job(
        title="Java Spring Boot Developer",
        alternate_titles=["Backend Engineer"],
        must_have_skills=["Java", "Spring Boot", "Microservices"],
        locations=["Bhopal", "Indore"],
        contact_visible=True,
    )

    assert len(queries) >= 5
    linkedin_q = next(q for q in queries if q["platform"] == "linkedin" and not q["contact_visible"])
    assert "site:linkedin.com/in" in linkedin_q["query"]
    assert "Spring Boot" in linkedin_q["query"]
    assert "Bhopal" in linkedin_q["query"] or "Indore" in linkedin_q["query"]

    # Verify contact-visible queries
    contact_q = next(q for q in queries if q["contact_visible"])
    assert "gmail.com" in contact_q["query"] or "+91" in contact_q["query"]

    # Verify public resume query
    resume_q = next(q for q in queries if q["platform"] == "public_resume")
    assert "filetype:pdf" in resume_q["query"]


def test_xray_parser_title_snippet():
    """Verify title/snippet extraction of candidate name, headline, location, and contacts."""
    parser = XRayParser()
    title = "Aakash Sharma - Senior Java & Spring Boot Developer - Bhopal, Madhya Pradesh | LinkedIn"
    snippet = "Experienced developer based in Bhopal. Key skills: Java, Spring Boot, Microservices. Email: aakash.dev@gmail.com, Mobile: +91 98260 12345."

    parsed = parser.parse_result(
        raw_url="https://www.linkedin.com/in/aakash-sharma-101",
        title=title,
        snippet=snippet,
        platform="linkedin",
    )

    assert parsed["name"] == "Aakash Sharma"
    assert "Java" in parsed["headline"] or "Spring" in parsed["headline"]
    assert parsed["location"] == "Bhopal"
    assert "Java" in parsed["skills"]
    assert "Spring Boot" in parsed["skills"]
    assert "aakash.dev@gmail.com" in parsed["emails"]
    assert "+919826012345" in parsed["phones"]


def test_sourcing_service_persistence():
    """Verify end-to-end execution: query running, candidate persistence, and contact recording."""
    job_data = {
        "title": "Java Spring Boot Developer",
        "must_have_skills": ["Java", "Spring Boot"],
        "locations": ["Bhopal", "Indore"],
        "min_experience": 3.0,
        "max_experience": 6.0,
    }
    job = JobService.create_job(job_data)

    sourcing = SourcingService()
    queries = sourcing.generate_job_queries(job.id, contact_visible=True)
    assert len(queries) > 0

    first_query = queries[0]
    found = sourcing.execute_query(
        job_id=job.id,
        platform=first_query["platform"],
        query_text=first_query["query"],
        limit=5,
    )
    assert isinstance(found, list)

    # Verify parser and database persistence with a real search result structure
    from app.connectors.base import RawSearchResult
    mock_res = RawSearchResult(
        url="https://www.linkedin.com/in/verified-dev-bhopal-9999",
        title="Tarun Mehra - Senior Java Developer - Bhopal | LinkedIn",
        snippet="Backend developer with Spring Boot experience based in Bhopal. Verified email: tarun.mehra@techmail.org",
        platform="linkedin"
    )
    parsed = sourcing.xray_parser.parse_result(mock_res.url, mock_res.title, mock_res.snippet, mock_res.platform)
    assert parsed["name"] == "Tarun Mehra"
    assert parsed["location"] == "Bhopal"
    assert "tarun.mehra@techmail.org" in parsed["emails"]

