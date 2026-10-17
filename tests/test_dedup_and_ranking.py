"""Unit and Integration Tests for Phase 4: Deduplication, Linking, Ranking, and Export."""

import json
from sqlmodel import Session, select
from app.db import engine
from app.models.job import Job
from app.models.candidate import Candidate, CandidateSource, ContactPoint, CandidateLink
from app.models.match import Match
from app.models.pipeline import PipelineStatus
from app.services.dedup_linker import DedupLinker
from app.services.ranking_engine import RankingEngine
from app.services.export_service import ExportService


def test_normalization():
    """Verify name, URL, phone, and email normalization."""
    linker = DedupLinker()

    # Name normalization
    assert linker.normalize_name("Dr. Rahul Sharma") == "Rahul Sharma"
    assert linker.normalize_name("Mr.   Amitabh  Mishra  ") == "Amitabh Mishra"
    assert linker.normalize_name("Er. Priya Patel") == "Priya Patel"

    # URL normalization
    assert linker.normalize_url("https://www.linkedin.com/in/rahul-sharma/?trk=ref") == "linkedin.com/in/rahul-sharma"
    assert linker.normalize_url("http://github.com/rahuldev/") == "github.com/rahuldev"

    # Phone normalization (Indian E.164)
    assert linker.normalize_phone("09893022334") == "+919893022334"
    assert linker.normalize_phone("+91 97550 99881") == "+919755099881"
    assert linker.normalize_phone("invalid-phone") is None

    # Email normalization
    assert linker.normalize_email("  Rahul.Dev@Example.Com  ") == "rahul.dev@example.com"
    assert linker.normalize_email("invalid-email") is None


def test_dedup_exact_matches():
    """Verify exact match detection via canonical URL and contact point."""
    linker = DedupLinker()

    with Session(engine, expire_on_commit=False) as session:
        # Create test candidate
        cand = Candidate(
            full_name="Vikram Singh",
            headline="Senior Backend Engineer",
            current_location="Indore",
            skills_json=json.dumps(["Java", "Spring Boot"]),
        )
        session.add(cand)
        session.commit()
        session.refresh(cand)

        source = CandidateSource(
            candidate_id=cand.id,
            platform="linkedin",
            url="https://www.linkedin.com/in/vikram-singh-dev/",
            raw_title="Vikram Singh | LinkedIn",
        )
        session.add(source)

        contact = ContactPoint(
            candidate_id=cand.id,
            kind="email",
            value="vikram.singh@realmail.in",
            type="public",
        )
        session.add(contact)
        session.commit()

        # 1. Test exact URL match
        incoming_url = "https://linkedin.com/in/vikram-singh-dev/?trk=public_profile"
        match_cand, link = linker.find_duplicate_or_link({"url": incoming_url, "full_name": "Vikram S"}, session)
        assert match_cand is not None
        assert match_cand.id == cand.id
        assert link is None

        # 2. Test exact email match
        match_cand2, link2 = linker.find_duplicate_or_link({"emails": ["vikram.singh@realmail.in"], "full_name": "Different Name"}, session)
        assert match_cand2 is not None
        assert match_cand2.id == cand.id
        assert link2 is None


def test_dedup_fuzzy_linking_and_merging():
    """Verify fuzzy identity resolution, link suggestions, and candidate merging."""
    linker = DedupLinker()

    with Session(engine, expire_on_commit=False) as session:
        cand_primary = Candidate(
            full_name="Aakash Sharma",
            headline="Java Developer",
            current_location="Bhopal",
            skills_json=json.dumps(["Java", "Spring Boot", "MySQL"]),
            data_completeness="low_data_snippet",
        )
        session.add(cand_primary)
        session.commit()
        session.refresh(cand_primary)

        # Incoming secondary candidate with high fuzzy similarity
        incoming_data = {
            "full_name": "Akash Sharma",
            "current_location": "Bhopal",
            "skills": ["Java", "Spring Boot", "Docker"],
            "url": "https://github.com/akash-sharma",
        }

        match_cand, link = linker.find_duplicate_or_link(incoming_data, session)
        assert match_cand is not None
        assert match_cand.id == cand_primary.id
        assert link is not None
        assert link.confidence >= 0.70

        # Persist secondary candidate and test merge
        cand_secondary = Candidate(
            full_name="Akash Sharma",
            headline="Backend Engineer",
            current_location="Bhopal",
            skills_json=json.dumps(["Java", "Spring Boot", "Docker"]),
            data_completeness="full_resume",
        )
        session.add(cand_secondary)
        session.commit()
        session.refresh(cand_secondary)

        merged = linker.merge_candidates(cand_primary.id, cand_secondary.id, session, performed_by="Test")
        assert merged.id == cand_primary.id
        # Verify skills union
        merged_skills = json.loads(merged.skills_json)
        assert "Docker" in merged_skills
        assert "MySQL" in merged_skills
        # Verify completeness upgraded
        assert merged.data_completeness == "full_resume"

        # Verify secondary candidate deleted
        assert session.get(Candidate, cand_secondary.id) is None


def test_ranking_engine_evaluation():
    """Verify multi-dimensional 0-100 scoring, explainable bullets, and missing skills."""
    engine_scorer = RankingEngine()

    with Session(engine, expire_on_commit=False) as session:
        # Create test job
        job = Job(
            title="Senior Java Developer",
            must_have_skills=json.dumps(["Java", "Spring Boot", "Microservices"]),
            nice_to_have_skills=json.dumps(["Docker", "AWS"]),
            min_experience=3.0,
            max_experience=6.0,
            locations=json.dumps(["Indore", "Bhopal"]),
            is_remote=False,
            status="active",
        )
        session.add(job)
        session.commit()
        session.refresh(job)

        # Create candidate with strong match
        cand = Candidate(
            full_name="Rohan Verma",
            headline="Senior Java Developer & Microservices Lead",
            current_location="Indore",
            experience_years=4.5,
            skills_json=json.dumps(["Java", "Spring Boot", "Microservices", "Docker"]),
            data_completeness="full_resume",
        )
        session.add(cand)
        session.commit()
        session.refresh(cand)

        eval_res = engine_scorer.evaluate_candidate(job, cand)

        assert eval_res["total_score"] >= 80.0
        assert eval_res["breakdown"]["must_have"] == 100.0
        assert eval_res["breakdown"]["experience"] == 100.0
        assert eval_res["breakdown"]["location"] >= 95.0
        assert len(eval_res["missing_skills"]) == 0
        assert any("100% Must-Have Skills" in b for b in eval_res["why_bullets"])

        # Test batch ranking and persistence
        ranked = engine_scorer.rank_and_save_all(job.id, session)
        assert len(ranked) >= 1
        top_cand = ranked[0]
        assert top_cand["candidate_id"] == cand.id


def test_export_service_csv_and_excel():
    """Verify CSV and Excel export generation."""
    with Session(engine, expire_on_commit=False) as session:
        job = session.exec(select(Job)).first()
        assert job is not None

        csv_bytes = ExportService.export_to_csv(job.id, session)
        assert len(csv_bytes) > 0
        assert b"Full Name" in csv_bytes
        assert b"Match Score" in csv_bytes

        excel_bytes = ExportService.export_to_excel(job.id, session)
        assert len(excel_bytes) > 0
        assert excel_bytes.startswith(b"PK")  # Standard ZIP/XLSX header
