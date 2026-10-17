"""Explainable 0-100 Candidate Ranking and Match Engine."""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np
from rapidfuzz import fuzz
from sqlmodel import Session, select

from app.models.job import Job
from app.models.candidate import Candidate
from app.models.resume import Resume
from app.models.match import Match
from app.models.pipeline import PipelineStatus

logger = logging.getLogger("talentscout.ranking")
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Lazy global model variable for sentence-transformers
_EMBED_MODEL = None


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_embed_model():
    """Lazy load sentence-transformers model on CPU to avoid cold-start overhead."""
    global _EMBED_MODEL
    if _EMBED_MODEL is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading sentence-transformers/all-MiniLM-L6-v2 model on CPU...")
            _EMBED_MODEL = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
        except Exception as e:
            logger.warning(f"Could not load SentenceTransformer: {e}. Fallback similarity will be used.")
            _EMBED_MODEL = False
    return _EMBED_MODEL if _EMBED_MODEL is not False else None


class RankingEngine:
    """Explainable Multi-Dimensional Candidate Ranking Engine."""

    DEFAULT_WEIGHTS = {
        "must_have": 0.35,
        "nice_to_have": 0.15,
        "experience": 0.15,
        "location": 0.15,
        "title": 0.10,
        "semantic": 0.10,
    }

    def __init__(self, weights: Optional[Dict[str, float]] = None):
        self.weights = weights or self._load_configured_weights() or self.DEFAULT_WEIGHTS
        self.city_aliases = self._load_city_aliases()
        self.synonyms = self._load_synonyms()

    def _load_configured_weights(self) -> Optional[Dict[str, float]]:
        """Load recruiter-configured ranking weights if available."""
        cfg_path = BASE_DIR / "config" / "system_settings.json"
        if cfg_path.exists():
            try:
                with open(cfg_path, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    rw = cfg.get("ranking_weights")
                    if rw and isinstance(rw, dict):
                        total = sum(float(v) for v in rw.values())
                        if total > 0:
                            return {k: float(v) / total for k, v in rw.items()}
            except Exception:
                pass
        return None

    def _load_city_aliases(self) -> Dict[str, List[str]]:
        alias_file = BASE_DIR / "config" / "city_aliases.json"
        if alias_file.exists():
            try:
                with open(alias_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def _load_synonyms(self) -> Dict[str, List[str]]:
        syn_file = BASE_DIR / "config" / "synonyms.json"
        if syn_file.exists():
            try:
                with open(syn_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def _expand_skill_synonyms(self, skill: str) -> Set[str]:
        """Expand skill into synonym cluster."""
        s_lower = skill.lower().strip()
        cluster = {s_lower}
        for canon, syns in self.synonyms.items():
            canon_lower = canon.lower()
            all_syns = {canon_lower} | {s.lower() for s in syns}
            if s_lower in all_syns:
                cluster.update(all_syns)
        return cluster

    def _match_skill_in_set(self, target_skill: str, candidate_skills: Set[str], candidate_text: str) -> bool:
        """Check if target skill or any synonym appears in candidate skills or text."""
        syns = self._expand_skill_synonyms(target_skill)
        # Check against candidate skill tokens
        for s in syns:
            if s in candidate_skills:
                return True
            # Fuzzy match for multi-word skills
            for cs in candidate_skills:
                if fuzz.token_sort_ratio(s, cs) >= 90:
                    return True
            # Word boundary search in text
            if f" {s} " in f" {candidate_text.lower()} ":
                return True
        return False

    def _score_must_have_skills(
        self,
        must_skills: List[str],
        candidate_skills: Set[str],
        candidate_text: str,
    ) -> Tuple[float, List[str], List[str]]:
        """Calculate must-have skill match score (0-100)."""
        if not must_skills:
            return 100.0, ["✓ No must-have skill constraints specified"], []

        matched = []
        missing = []
        for s in must_skills:
            if self._match_skill_in_set(s, candidate_skills, candidate_text):
                matched.append(s)
            else:
                missing.append(s)

        score = (len(matched) / len(must_skills)) * 100.0
        bullets = []
        if len(matched) == len(must_skills):
            bullets.append(f"✓ 100% Must-Have Skills matched ({', '.join(matched)})")
        elif matched:
            bullets.append(f"⚠️ Partial Must-Have Skills matched ({len(matched)}/{len(must_skills)}: {', '.join(matched)})")
        else:
            bullets.append("✗ 0 Must-Have Skills found")

        return score, bullets, missing

    def _score_nice_to_have_skills(
        self,
        nice_skills: List[str],
        candidate_skills: Set[str],
        candidate_text: str,
    ) -> Tuple[float, List[str]]:
        """Calculate nice-to-have skill match score (0-100)."""
        if not nice_skills:
            return 100.0, []

        matched = []
        for s in nice_skills:
            if self._match_skill_in_set(s, candidate_skills, candidate_text):
                matched.append(s)

        score = (len(matched) / len(nice_skills)) * 100.0
        bullets = []
        if matched:
            bullets.append(f"✓ Bonus Nice-to-Have Skills: {', '.join(matched)}")
        return score, bullets

    def _score_experience(
        self,
        min_exp: float,
        max_exp: float,
        cand_exp: Optional[float],
    ) -> Tuple[float, List[str]]:
        """Calculate experience fit score (0-100)."""
        if cand_exp is None or cand_exp == 0.0:
            return 60.0, ["ℹ️ Experience not explicitly quantified in profile snippet"]

        if min_exp <= cand_exp <= max_exp:
            return 100.0, [f"✓ Experience ({cand_exp} yrs) fits target range ({min_exp}–{max_exp} yrs)"]
        elif cand_exp < min_exp:
            diff = min_exp - cand_exp
            if diff <= 1.0:
                return 75.0, [f"⚠️ Slightly junior ({cand_exp} yrs vs {min_exp} yrs min)"]
            else:
                score = max(20.0, 75.0 - (diff * 20.0))
                return score, [f"✗ Below minimum experience requirement ({cand_exp} yrs vs {min_exp} yrs)"]
        else:  # cand_exp > max_exp
            diff = cand_exp - max_exp
            if diff <= 2.0:
                return 85.0, [f"✓ Seasoned profile ({cand_exp} yrs vs {max_exp} yrs max)"]
            else:
                score = max(40.0, 85.0 - (diff * 10.0))
                return score, [f"⚠️ Significantly over-experienced ({cand_exp} yrs vs {max_exp} yrs max)"]

    def _score_location(
        self,
        job_locations: List[str],
        is_remote: bool,
        cand_location: Optional[str],
    ) -> Tuple[float, List[str]]:
        """Calculate location fit score (0-100)."""
        if is_remote:
            return 100.0, ["✓ Remote position — candidate location fully compatible"]

        if not cand_location:
            return 50.0, ["ℹ️ Candidate location not specified"]

        cand_loc_lower = cand_location.lower().strip()

        # Check exact or cluster match
        for jl in job_locations:
            jl_lower = jl.lower().strip()
            if jl_lower in cand_loc_lower or cand_loc_lower in jl_lower:
                return 100.0, [f"✓ Location match: {cand_location} ({jl})"]

            # Check cluster aliases
            cluster = {jl_lower}
            for canon, aliases in self.city_aliases.items():
                if canon.lower() == jl_lower or jl_lower in [a.lower() for a in aliases]:
                    cluster.update([canon.lower()] + [a.lower() for a in aliases])

            if any(term in cand_loc_lower for term in cluster):
                return 95.0, [f"✓ Regional cluster location match: {cand_location} ({jl})"]

        # Adjacent or Tier 1/2 IT city in India
        it_hubs = {"bengaluru", "bangalore", "hyderabad", "pune", "delhi", "noida", "gurgaon", "mumbai", "chennai", "indore", "bhopal"}
        if any(hub in cand_loc_lower for hub in it_hubs):
            return 60.0, [f"⚠️ Located in another Indian tech hub: {cand_location}"]

        return 30.0, [f"⚠️ Located in {cand_location} (outside target locations)"]

    def _score_title(
        self,
        job_title: str,
        alternate_titles: List[str],
        cand_title: Optional[str],
    ) -> Tuple[float, List[str]]:
        """Calculate title similarity score (0-100)."""
        if not cand_title:
            return 50.0, ["ℹ️ Candidate headline not available"]

        all_titles = [job_title] + (alternate_titles or [])
        best_ratio = 0.0
        best_target = job_title

        for t in all_titles:
            ratio = fuzz.token_set_ratio(t.lower(), cand_title.lower())
            if ratio > best_ratio:
                best_ratio = ratio
                best_target = t

        bullets = []
        if best_ratio >= 80:
            bullets.append(f"✓ Strong role title match ({best_ratio:.0f}%): {cand_title}")
        elif best_ratio >= 60:
            bullets.append(f"✓ Relevant role title match ({best_ratio:.0f}%): {cand_title}")
        else:
            bullets.append(f"⚠️ Divergent role title ({best_ratio:.0f}%): {cand_title}")

        return best_ratio, bullets

    def _score_semantic(
        self,
        job_text: str,
        cand_text: str,
    ) -> Tuple[float, List[str]]:
        """Calculate semantic similarity between JD and candidate profile."""
        embedder = get_embed_model()
        if embedder is not None:
            try:
                embeddings = embedder.encode([job_text, cand_text], normalize_embeddings=True)
                cosine_sim = float(np.dot(embeddings[0], embeddings[1]))
                # Map cosine [-0.2, 0.8] to [0, 100]
                scaled = max(0.0, min(100.0, (cosine_sim + 0.1) / 0.9 * 100.0))
                return round(scaled, 1), [f"✓ Semantic JD alignment: {scaled:.0f}%"]
            except Exception as e:
                logger.warning(f"Error computing semantic embedding: {e}")

        # Fallback: token overlap Jaccard
        tokens_job = set(job_text.lower().split())
        tokens_cand = set(cand_text.lower().split())
        if not tokens_job or not tokens_cand:
            return 60.0, []
        jaccard = len(tokens_job & tokens_cand) / len(tokens_job | tokens_cand)
        scaled = min(100.0, jaccard * 400.0)
        return round(scaled, 1), [f"✓ Keyword semantic alignment: {scaled:.0f}%"]

    def evaluate_candidate(
        self,
        job: Job,
        candidate: Candidate,
        resume_text: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Evaluate a single candidate against a job and return explainable match breakdown."""
        must_skills = json.loads(job.must_have_skills) if job.must_have_skills else []
        nice_skills = json.loads(job.nice_to_have_skills) if job.nice_to_have_skills else []
        alt_titles = json.loads(job.alternate_titles) if job.alternate_titles else []
        job_locations = json.loads(job.locations) if job.locations else []

        cand_skills = set(s.lower() for s in (json.loads(candidate.skills_json) if candidate.skills_json else []))
        cand_text_parts = [candidate.full_name, candidate.headline or "", candidate.current_location or "", " ".join(cand_skills)]
        if resume_text:
            cand_text_parts.append(resume_text)
        candidate_text = " ".join(cand_text_parts)

        job_text = f"{job.title} {' '.join(alt_titles)} {' '.join(must_skills)} {job.jd_raw_text or ''}"

        # 1. Dimension Scores
        s_must, b_must, missing_skills = self._score_must_have_skills(must_skills, cand_skills, candidate_text)
        s_nice, b_nice = self._score_nice_to_have_skills(nice_skills, cand_skills, candidate_text)
        s_exp, b_exp = self._score_experience(job.min_experience, job.max_experience, candidate.experience_years)
        s_loc, b_loc = self._score_location(job_locations, job.is_remote, candidate.current_location)
        s_title, b_title = self._score_title(job.title, alt_titles, candidate.headline)
        s_sem, b_sem = self._score_semantic(job_text, candidate_text)

        # 2. Weighted Total
        total_score = (
            self.weights["must_have"] * s_must
            + self.weights["nice_to_have"] * s_nice
            + self.weights["experience"] * s_exp
            + self.weights["location"] * s_loc
            + self.weights["title"] * s_title
            + self.weights["semantic"] * s_sem
        )
        total_score = round(max(0.0, min(100.0, total_score)), 1)

        breakdown = {
            "must_have": round(s_must, 1),
            "nice_to_have": round(s_nice, 1),
            "experience": round(s_exp, 1),
            "location": round(s_loc, 1),
            "title": round(s_title, 1),
            "semantic": round(s_sem, 1),
        }

        why_bullets = b_must + b_nice + b_exp + b_loc + b_title + b_sem

        return {
            "candidate_id": candidate.id,
            "job_id": job.id,
            "total_score": total_score,
            "breakdown": breakdown,
            "why_bullets": why_bullets,
            "missing_skills": missing_skills,
            "data_completeness": candidate.data_completeness,
        }

    def rank_and_save_all(self, job_id: str, session: Session) -> List[Dict[str, Any]]:
        """Rank all candidates for a job and persist Match records in database."""
        job = session.get(Job, job_id)
        if not job:
            return []

        candidates = session.exec(select(Candidate)).all()
        results: List[Dict[str, Any]] = []

        for cand in candidates:
            # Check for candidate resume text
            resume = session.exec(select(Resume).where(Resume.candidate_id == cand.id)).first()
            resume_text = resume.raw_text if resume else None

            eval_res = self.evaluate_candidate(job, cand, resume_text=resume_text)

            # Persist or update Match record
            match_rec = session.exec(
                select(Match).where(Match.job_id == job.id, Match.candidate_id == cand.id)
            ).first()

            if not match_rec:
                match_rec = Match(
                    job_id=job.id,
                    candidate_id=cand.id,
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
                match_rec.evaluated_at = get_utc_now()
                session.add(match_rec)

            # Ensure PipelineStatus record exists
            ps = session.exec(
                select(PipelineStatus).where(PipelineStatus.job_id == job.id, PipelineStatus.candidate_id == cand.id)
            ).first()
            if not ps:
                ps = PipelineStatus(job_id=job.id, candidate_id=cand.id, stage="new", updated_at=get_utc_now())
                session.add(ps)

            results.append(eval_res)

        session.commit()
        # Sort descending by total score
        results.sort(key=lambda x: x["total_score"], reverse=True)
        return results
