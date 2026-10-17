"""Sourcing Service.

Orchestrates query execution, result parsing, candidate ingestion, and contact extraction.
"""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlmodel import Session, select
from app.db import engine
from app.models.job import Job, SearchQuery, SearchRun
from app.models.candidate import Candidate, CandidateSource, ContactPoint
from app.models.pipeline import PipelineStatus
from app.models.match import Match
from app.models.audit import AuditLog
from app.connectors.live_search import LiveSearchProvider
from app.connectors.xray_parser import XRayParser
from app.services.query_builder import QueryBuilder
from app.services.ranking_engine import RankingEngine


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


JUNK_PATTERNS = [
    "resume example", "resume sample", "resume template", "enhancv", "zety",
    "job description", "salary", "jobs in", "hiring for", "interview question",
    "tutorial", "course", "cheatsheet", "cheat sheet", "top 10", "top 20",
    "vacancy", "vacancies", "career guide", "how to become", "glassdoor", "indeed",
    "roadmap", "cheat-sheet", "job board", "job-board", "free download"
]


class SourcingService:
    """End-to-end Candidate Sourcing and Ingestion Pipeline."""

    def __init__(self):
        self.query_builder = QueryBuilder()
        self.search_provider = LiveSearchProvider()
        self.xray_parser = XRayParser()

    def generate_job_queries(self, job_id: str, contact_visible: bool = False) -> List[Dict[str, Any]]:
        """Generate platform queries for a given job."""
        with Session(engine, expire_on_commit=False) as session:
            job = session.get(Job, job_id)
            if not job:
                return []

            alt_titles = json.loads(job.alternate_titles) if job.alternate_titles else []
            must_skills = json.loads(job.must_have_skills) if job.must_have_skills else []
            locations = json.loads(job.locations) if job.locations else []

            return self.query_builder.build_queries_for_job(
                title=job.title,
                alternate_titles=alt_titles,
                must_have_skills=must_skills,
                locations=locations,
                contact_visible=contact_visible,
            )

    def execute_query(
        self,
        job_id: str,
        platform: str,
        query_text: str,
        limit: int = 15,
        performed_by: str = "Recruiter",
    ) -> List[Dict[str, Any]]:
        """Run search query, parse results, persist candidates and contacts."""
        # 1. Execute search using LiveSearchProvider with platform hint
        results = self.search_provider.search(query_text, limit=limit, platform=platform)
        parsed_candidates: List[Dict[str, Any]] = []

        with Session(engine, expire_on_commit=False) as session:
            # 2. Find or create SearchQuery record for this job
            sq = session.exec(
                select(SearchQuery).where(
                    SearchQuery.job_id == job_id,
                    SearchQuery.platform == platform,
                    SearchQuery.query_text == query_text,
                )
            ).first()
            if not sq:
                sq = SearchQuery(
                    job_id=job_id,
                    platform=platform,
                    query_text=query_text,
                    is_active=True,
                    created_at=get_utc_now(),
                )
                session.add(sq)
                session.commit()
                session.refresh(sq)

            # Record SearchRun
            search_run = SearchRun(
                query_id=sq.id,
                platform=platform,
                executed_at=get_utc_now(),
                results_count=len(results),
                cached=False,
            )
            session.add(search_run)
            session.commit()


            # 3. Process each raw result with quality filtering and live ranking
            ranking_engine = RankingEngine()
            job = session.get(Job, job_id)

            for res in results:
                # Discard non-profile junk (SEO blog posts, resume builder landing pages, cheatsheets)
                raw_check = f"{res.title} {res.url}".lower()
                if any(jp in raw_check for jp in JUNK_PATTERNS):
                    continue

                parsed = self.xray_parser.parse_result(
                    raw_url=res.url,
                    title=res.title,
                    snippet=res.snippet,
                    platform=res.platform,
                )

                # Check if CandidateSource URL already exists in DB
                existing_source = session.exec(
                    select(CandidateSource).where(CandidateSource.url == parsed["url"])
                ).first()

                if existing_source:
                    candidate = session.get(Candidate, existing_source.candidate_id)
                    # Ensure candidate is linked to this job's pipeline
                    existing_pipeline = session.exec(
                        select(PipelineStatus).where(
                            PipelineStatus.job_id == job_id,
                            PipelineStatus.candidate_id == candidate.id,
                        )
                    ).first()
                    if not existing_pipeline:
                        pipeline = PipelineStatus(
                            job_id=job_id,
                            candidate_id=candidate.id,
                            stage="new",
                            updated_at=get_utc_now(),
                        )
                        session.add(pipeline)
                        session.commit()
                else:
                    # Create new Candidate
                    candidate = Candidate(
                        full_name=parsed["name"],
                        headline=parsed["headline"],
                        current_location=parsed["location"],
                        skills_json=json.dumps(parsed["skills"]),
                        data_completeness="low_data_snippet",
                        created_at=get_utc_now(),
                        updated_at=get_utc_now(),
                    )
                    session.add(candidate)
                    session.commit()
                    session.refresh(candidate)

                    # Create CandidateSource
                    source = CandidateSource(
                        candidate_id=candidate.id,
                        platform=parsed["platform"],
                        url=parsed["url"],
                        raw_title=parsed["raw_title"],
                        raw_snippet=parsed["raw_snippet"],
                        retrieved_at=get_utc_now(),
                    )
                    session.add(source)

                    # Initial pipeline status for this job
                    pipeline = PipelineStatus(
                        job_id=job_id,
                        candidate_id=candidate.id,
                        stage="new",
                        updated_at=get_utc_now(),
                    )
                    session.add(pipeline)

                    # Create ContactPoints from snippet if found
                    for email in parsed["emails"]:
                        session.add(
                            ContactPoint(
                                candidate_id=candidate.id,
                                kind="email",
                                value=email,
                                type="public-snippet",
                                source_reference=parsed["url"],
                                found_at=get_utc_now(),
                                added_by="snippet_extractor",
                            )
                        )

                    for phone in parsed["phones"]:
                        session.add(
                            ContactPoint(
                                candidate_id=candidate.id,
                                kind="phone",
                                value=phone,
                                type="public-snippet",
                                source_reference=parsed["url"],
                                found_at=get_utc_now(),
                                added_by="snippet_extractor",
                            )
                        )

                    session.commit()

                # Automatically evaluate match against the active job
                if job:
                    eval_res = ranking_engine.evaluate_candidate(job, candidate)
                    match_rec = session.exec(
                        select(Match).where(Match.job_id == job_id, Match.candidate_id == candidate.id)
                    ).first()
                    if not match_rec:
                        match_rec = Match(
                            job_id=job_id,
                            candidate_id=candidate.id,
                            total_score=eval_res["total_score"],
                            breakdown_json=json.dumps(eval_res["breakdown"]),
                            why_bullets_json=json.dumps(eval_res["why_bullets"]),
                            missing_skills_json=json.dumps(eval_res["missing_skills"]),
                            evaluated_at=get_utc_now(),
                        )
                        session.add(match_rec)
                    else:
                        match_rec.total_score = eval_res["total_score"]
                        match_rec.breakdown_json = json.dumps(eval_res["breakdown"])
                        match_rec.why_bullets_json = json.dumps(eval_res["why_bullets"])
                        match_rec.missing_skills_json = json.dumps(eval_res["missing_skills"])
                        session.add(match_rec)
                    session.commit()

                parsed["candidate_id"] = candidate.id
                parsed["id"] = candidate.id
                parsed["full_name"] = parsed.get("name")
                parsed["profile_url"] = parsed.get("url")
                parsed["score"] = eval_res["total_score"]
                parsed["breakdown"] = eval_res["breakdown"]
                parsed["why_bullets"] = eval_res["why_bullets"]
                parsed["missing_skills"] = eval_res["missing_skills"]

                # Precision filter: only return candidates meeting base requirements (score >= 35.0)
                if eval_res["total_score"] >= 35.0:
                    parsed_candidates.append(parsed)

            # Sort descending by match score so top candidates appear first
            parsed_candidates.sort(key=lambda x: x.get("score", 0.0), reverse=True)

            # Record in AuditLog
            audit = AuditLog(
                action="search",
                entity_type="job",
                entity_id=job_id,
                performed_by=performed_by,
                details_json=json.dumps({
                    "platform": platform,
                    "query": query_text,
                    "found_count": len(parsed_candidates),
                }),
                timestamp=get_utc_now(),
            )
            session.add(audit)
            session.commit()

        return parsed_candidates

    def get_candidates_for_job(self, job_id: str) -> List[Dict[str, Any]]:
        """Retrieve all candidates associated with a job via PipelineStatus."""
        ranking_engine = RankingEngine()
        with Session(engine, expire_on_commit=False) as session:
            job = session.get(Job, job_id)
            pipeline_records = session.exec(
                select(PipelineStatus).where(PipelineStatus.job_id == job_id)
            ).all()

            results = []
            for prec in pipeline_records:
                candidate = session.get(Candidate, prec.candidate_id)
                if not candidate:
                    continue

                sources = session.exec(
                    select(CandidateSource).where(CandidateSource.candidate_id == candidate.id)
                ).all()

                contacts = session.exec(
                    select(ContactPoint).where(ContactPoint.candidate_id == candidate.id)
                ).all()

                match = session.exec(
                    select(Match).where(Match.job_id == job_id, Match.candidate_id == candidate.id)
                ).first()

                if not match and job:
                    eval_res = ranking_engine.evaluate_candidate(job, candidate)
                    match = Match(
                        job_id=job_id,
                        candidate_id=candidate.id,
                        total_score=eval_res["total_score"],
                        breakdown_json=json.dumps(eval_res["breakdown"]),
                        why_bullets_json=json.dumps(eval_res["why_bullets"]),
                        missing_skills_json=json.dumps(eval_res["missing_skills"]),
                        evaluated_at=get_utc_now(),
                    )
                    session.add(match)
                    session.commit()
                    session.refresh(match)

                score = match.total_score if match else 0.0
                breakdown = json.loads(match.breakdown_json) if (match and match.breakdown_json) else {}
                why_bullets = json.loads(match.why_bullets_json) if (match and match.why_bullets_json) else []
                missing_skills = json.loads(match.missing_skills_json) if (match and match.missing_skills_json) else []

                results.append({
                    "id": candidate.id,
                    "full_name": candidate.full_name,
                    "headline": candidate.headline,
                    "current_location": candidate.current_location,
                    "skills": json.loads(candidate.skills_json) if candidate.skills_json else [],
                    "score": score,
                    "breakdown": breakdown,
                    "why_bullets": why_bullets,
                    "missing_skills": missing_skills,
                    "stage": prec.stage,
                    "sources": [{"platform": s.platform, "url": s.url} for s in sources],
                    "contacts": [{"kind": c.kind, "value": c.value, "type": c.type} for c in contacts],
                    "emails": [c.value for c in contacts if c.kind == "email"],
                    "phones": [c.value for c in contacts if c.kind == "phone"],
                    "email": next((c.value for c in contacts if c.kind == "email"), None),
                    "phone": next((c.value for c in contacts if c.kind == "phone"), None),
                    "platform": sources[0].platform if sources else "web",
                    "profile_url": sources[0].url if sources else None,
                    "do_not_contact": candidate.do_not_contact,
                })

            results.sort(key=lambda x: x.get("score", 0.0), reverse=True)
            return results
