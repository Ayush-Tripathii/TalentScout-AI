"""Query Builder Service.

Generates target-specific Boolean X-ray search queries for LinkedIn, Naukri,
Foundit, Shine, Indeed, Apna, and GitHub, incorporating skill synonyms,
Indian city aliases, role-based platform recommendations, and contact-visible markers.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from config.settings import get_settings

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class QueryBuilder:
    """Intelligent Boolean X-Ray Query Generator."""

    def __init__(self):
        self.synonyms = self._load_json(BASE_DIR / "config" / "synonyms.json")
        self.city_aliases = self._load_json(BASE_DIR / "config" / "city_aliases.json")

    @staticmethod
    def _load_json(filepath: Path) -> Dict[str, List[str]]:
        if filepath.exists():
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def expand_skill(self, skill: str) -> List[str]:
        """Return synonym variants for a given skill."""
        for canonical, variants in self.synonyms.items():
            if canonical.lower() == skill.lower() or skill.lower() in [v.lower() for v in variants]:
                return variants
        return [skill]

    def expand_location(self, location: str) -> List[str]:
        """Return alias variants for an Indian city/region."""
        for canonical, aliases in self.city_aliases.items():
            if canonical.lower() == location.lower() or location.lower() in [a.lower() for a in aliases]:
                return aliases
        return [location]

    def recommend_platforms(self, title: str, must_have_skills: List[str]) -> List[str]:
        """Automatically suggest appropriate search platforms based on role and skills."""
        combined = (title + " " + " ".join(must_have_skills)).lower()
        platforms = ["linkedin", "naukri", "foundit", "shine", "apna"]

        # Tech/developer roles
        if any(w in combined for w in ["developer", "engineer", "java", "python", "backend", "full stack", "react", "devops", "cloud"]):
            platforms.extend(["github", "stackoverflow"])

        # Design roles
        if any(w in combined for w in ["designer", "ui/ux", "product designer", "graphic", "figma", "illustrator"]):
            platforms.extend(["behance", "dribbble"])

        # Data roles
        if any(w in combined for w in ["data scientist", "machine learning", "ai", "deep learning", "kaggle", "data analyst"]):
            platforms.append("kaggle")

        return list(dict.fromkeys(platforms))

    def build_queries_for_job(
        self,
        title: str,
        alternate_titles: List[str],
        must_have_skills: List[str],
        locations: List[str],
        contact_visible: bool = False,
    ) -> List[Dict[str, Any]]:
        """Generate a list of Boolean search queries across target platforms."""
        queries: List[Dict[str, Any]] = []

        # 1. Prepare Titles Clause: ("Java Developer" OR "Backend Engineer")
        all_titles = [title] + [t for t in alternate_titles if t and t.lower() != title.lower()]
        titles_clause = " OR ".join([f'"{t}"' for t in all_titles[:3]])
        if len(all_titles) > 1:
            titles_clause = f"({titles_clause})"
        else:
            titles_clause = f'"{title}"'

        # 2. Prepare Skills Clause: "Java" "Spring Boot"
        top_skills = must_have_skills[:3] if must_have_skills else ["Java"]
        skills_clause = " ".join([f'"{s}"' for s in top_skills])

        # 3. Prepare Locations Clause
        # For top locations, expand aliases: ("Bhopal" OR "Indore" OR "Madhya Pradesh")
        expanded_locs: List[str] = []
        for loc in locations[:3]:
            aliases = self.expand_location(loc)
            expanded_locs.extend(aliases[:2])
        if expanded_locs:
            unique_locs = list(dict.fromkeys(expanded_locs))
            locs_clause = " OR ".join([f'"{l}"' for l in unique_locs[:4]])
            locs_clause = f"({locs_clause})"
        else:
            locs_clause = '("India")'

        # Contact marker suffixes
        email_domains = '("gmail.com" OR "yahoo.com" OR "outlook.com" OR "rediffmail.com")'
        phone_markers = '("+91" OR "contact me" OR "reach me at")'

        # Platform: LinkedIn
        base_linkedin = f"site:linkedin.com/in {titles_clause} {skills_clause} {locs_clause}"
        queries.append({
            "platform": "linkedin",
            "query": base_linkedin,
            "description": "LinkedIn X-Ray candidate search",
            "contact_visible": False,
        })
        if contact_visible:
            queries.append({
                "platform": "linkedin",
                "query": f"{base_linkedin} {email_domains}",
                "description": "LinkedIn profiles with public email addresses in snippet",
                "contact_visible": True,
            })
            queries.append({
                "platform": "linkedin",
                "query": f"{base_linkedin} {phone_markers}",
                "description": "LinkedIn profiles with phone/contact markers in snippet",
                "contact_visible": True,
            })

        # Platform: Naukri
        queries.append({
            "platform": "naukri",
            "query": f"site:naukri.com {titles_clause} {skills_clause} {locs_clause}",
            "description": "Naukri X-Ray public talent search",
            "contact_visible": False,
        })

        # Platform: Foundit (Monster)
        queries.append({
            "platform": "foundit",
            "query": f"site:foundit.in {titles_clause} {skills_clause} {locs_clause}",
            "description": "Foundit India public resumes",
            "contact_visible": False,
        })

        # Platform: Shine
        queries.append({
            "platform": "shine",
            "query": f"site:shine.com {titles_clause} {skills_clause} {locs_clause}",
            "description": "Shine India candidate search",
            "contact_visible": False,
        })

        # Platform: Apna
        queries.append({
            "platform": "apna",
            "query": f"site:apna.co {titles_clause} {skills_clause} {locs_clause}",
            "description": "Apna job seeker profiles",
            "contact_visible": False,
        })

        # Platform: GitHub
        github_skills = " ".join(top_skills)
        loc_single = locations[0] if locations else "India"
        queries.append({
            "platform": "github",
            "query": f'site:github.com "{loc_single}" {github_skills}',
            "description": "GitHub public developer profiles",
            "contact_visible": False,
        })

        # Platform: Public Resumes (PDF / DOCX)
        primary_skill = top_skills[0] if top_skills else "Java"
        queries.append({
            "platform": "public_resume",
            "query": f'(filetype:pdf OR filetype:docx) (resume OR CV) "{primary_skill}" {locs_clause} -template -sample -job',
            "description": "Publicly posted PDF/DOCX resumes (no login required)",
            "contact_visible": False,
        })

        return queries
