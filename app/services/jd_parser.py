"""Job Description Extraction Service.

Extracts structured recruitment fields from raw Job Description text using
local Ollama LLM (qwen2.5:7b/3b) with an instant rule-based fallback when Ollama is offline.
"""

import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx
from config.settings import get_settings

logger = logging.getLogger("talentscout.jd_parser")
settings = get_settings()

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def load_synonyms() -> Dict[str, List[str]]:
    """Load skill synonyms dictionary."""
    syn_file = BASE_DIR / "config" / "synonyms.json"
    if syn_file.exists():
        try:
            with open(syn_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Error loading synonyms.json: {e}")
    return {}


def load_city_aliases() -> Dict[str, List[str]]:
    """Load Indian city aliases."""
    city_file = BASE_DIR / "config" / "city_aliases.json"
    if city_file.exists():
        try:
            with open(city_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Error loading city_aliases.json: {e}")
    return {}


def rule_based_extract(text: str) -> Dict[str, Any]:
    """Deterministic, regex & keyword-based JD field extraction fallback."""
    synonyms = load_synonyms()
    city_aliases = load_city_aliases()
    lower_text = text.lower()

    # 1. Experience extraction
    min_exp, max_exp = 0.0, 5.0
    exp_range_match = re.search(r"(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)", lower_text)
    if exp_range_match:
        min_exp = float(exp_range_match.group(1))
        max_exp = float(exp_range_match.group(2))
    else:
        single_exp_match = re.search(r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?|yr)\b", lower_text)
        if single_exp_match:
            min_exp = float(single_exp_match.group(1))
            max_exp = min_exp + 3.0

    # 2. CTC / Salary extraction
    min_ctc, max_ctc = None, None
    ctc_range = re.search(r"(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|lac|inr)", lower_text)
    if ctc_range:
        min_ctc = float(ctc_range.group(1))
        max_ctc = float(ctc_range.group(2))
    else:
        single_ctc = re.search(r"(?:ctc|salary|budget)[:\s]*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?)", lower_text)
        if single_ctc:
            max_ctc = float(single_ctc.group(1))

    # 3. Location extraction
    found_locations = []
    for canonical_city, aliases in city_aliases.items():
        for alias in aliases:
            if re.search(rf"\b{re.escape(alias.lower())}\b", lower_text):
                if canonical_city not in found_locations:
                    found_locations.append(canonical_city)
                break

    # 4. Notice Period
    notice_period = "Immediate"
    if re.search(r"\b(?:immediate|immediately|serving notice|0\s*days?)\b", lower_text):
        notice_period = "Immediate"
    elif re.search(r"\b(?:15\s*days?)\b", lower_text):
        notice_period = "15 Days"
    elif re.search(r"\b(?:30\s*days?|1\s*month)\b", lower_text):
        notice_period = "30 Days"
    elif re.search(r"\b(?:60\s*days?|2\s*months?)\b", lower_text):
        notice_period = "60 Days"
    elif re.search(r"\b(?:90\s*days?|3\s*months?)\b", lower_text):
        notice_period = "90 Days"

    # 5. Remote / Relocation
    is_remote = bool(re.search(r"\b(?:remote|work from home|wfh|hybrid)\b", lower_text))
    open_to_relocate = bool(re.search(r"\b(?:relocat|open to relocate)\b", lower_text))

    # 6. Skill extraction
    matched_skills = []
    for canonical_skill, variants in synonyms.items():
        for variant in variants:
            if re.search(rf"\b{re.escape(variant.lower())}\b", lower_text):
                if canonical_skill not in matched_skills:
                    matched_skills.append(canonical_skill)
                break

    # Partition skills into must-have and nice-to-have
    must_have = matched_skills[:4] if matched_skills else ["Java", "Spring Boot"]
    nice_have = matched_skills[4:] if len(matched_skills) > 4 else []

    # 7. Job Title heuristic
    title = "Software Engineer"
    lines = [line.strip() for line in text.strip().split("\n") if line.strip()]
    if lines:
        first_line = lines[0]
        if len(first_line) < 70 and not any(k in first_line.lower() for k in ["about us", "hiring", "job description"]):
            title = first_line.title()
        else:
            # Check for standard patterns
            role_match = re.search(
                r"\b(?:senior\s+|lead\s+|junior\s+)?(?:java|backend|frontend|full\s*stack|python|devops|data|software|react|node)\s+(?:developer|engineer|architect|lead)\b",
                lower_text,
            )
            if role_match:
                title = role_match.group(0).title()

    alternate_titles = [f"{title} - Backend", f"Senior {title}"] if "senior" not in title.lower() else [title.replace("Senior ", "")]

    return {
        "title": title,
        "alternate_titles": alternate_titles,
        "must_have_skills": must_have,
        "nice_to_have_skills": nice_have,
        "min_experience": min_exp,
        "max_experience": max_exp,
        "locations": found_locations if found_locations else ["Indore", "Bhopal"],
        "open_to_relocate": open_to_relocate,
        "is_remote": is_remote,
        "education": "B.Tech / B.E. / MCA or equivalent",
        "industry": "IT Services / Software",
        "notice_period": notice_period,
        "min_ctc": min_ctc,
        "max_ctc": max_ctc,
        "positions_count": 1,
        "extraction_method": "rule_based_fallback",
    }


def parse_job_description(jd_text: str) -> Dict[str, Any]:
    """Parse unstructured Job Description into structured recruitment fields.

    Attempts local Ollama LLM first; gracefully falls back to deterministic rules if offline.
    """
    if not jd_text or not jd_text.strip():
        return rule_based_extract("")

    # Try Ollama if configured
    ollama_url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/generate"
    prompt = f"""You are an expert technical recruitment analyst. Extract structured job requirements from the following Job Description (JD).
Respond strictly in valid JSON format only, matching this structure:
{{
  "title": "string",
  "alternate_titles": ["string"],
  "must_have_skills": ["string"],
  "nice_to_have_skills": ["string"],
  "min_experience": float,
  "max_experience": float,
  "locations": ["string"],
  "open_to_relocate": boolean,
  "is_remote": boolean,
  "education": "string or null",
  "industry": "string or null",
  "notice_period": "Immediate | 15 Days | 30 Days | 60 Days | 90 Days",
  "min_ctc": float or null,
  "max_ctc": float or null,
  "positions_count": integer
}}

Job Description:
\"\"\"
{jd_text[:4000]}
\"\"\"
"""

    try:
        response = httpx.post(
            ollama_url,
            json={
                "model": settings.OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
            },
            timeout=3.0,
        )
        if response.status_code == 200:
            data = response.json()
            raw_response = data.get("response", "{}")
            extracted = json.loads(raw_response)
            extracted["extraction_method"] = f"ollama_{settings.OLLAMA_MODEL}"
            # Ensure required keys exist
            rule_fallback = rule_based_extract(jd_text)
            for k, v in rule_fallback.items():
                if k not in extracted or extracted[k] is None:
                    extracted[k] = v
            return extracted
    except Exception as e:
        logger.info(f"Ollama unavailable or timed out ({e}). Using rule-based extraction fallback.")

    return rule_based_extract(jd_text)
