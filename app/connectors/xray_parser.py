"""X-Ray Search Snippet Parser.

Parses public candidate identity, headline, location, skills, and snippet-embedded contacts
from search engine metadata (Title + Snippet) ONLY, adhering to the zero-scraping constraint.
"""

import re
from typing import Any, Dict, List, Optional
import phonenumbers
from app.services.jd_parser import load_synonyms, load_city_aliases


class XRayParser:
    """Parser for search engine titles and snippets."""

    def __init__(self):
        self.synonyms = load_synonyms()
        self.city_aliases = load_city_aliases()

    def parse_name(self, title: str, platform: str) -> str:
        """Extract candidate's public name from search result title."""
        cleaned = re.sub(r"\s*\|\s*(LinkedIn|Naukri|foundit|Shine|Apna|GitHub|Kaggle|Behance|Dribbble).*", "", title, flags=re.I).strip()
        cleaned = re.sub(r"\s*-\s*(LinkedIn|Naukri|foundit|Shine|Apna|GitHub|Kaggle).*", "", cleaned, flags=re.I).strip()

        if platform == "github":
            # Format: "username (Full Name) · GitHub"
            m = re.search(r"\(([^)]+)\)", cleaned)
            if m:
                return m.group(1).strip()
            return cleaned.split("·")[0].strip()

        # Clean file indicators and resume labels
        cleaned = re.sub(r"^\[(?:PDF|DOC|DOCX)\]\s*", "", cleaned, flags=re.I).strip()
        cleaned = re.sub(r"\.(pdf|docx|doc)$", "", cleaned, flags=re.I).strip()
        cleaned = re.sub(r"(?i)\b(?:resume|cv|curriculum vitae)\s+of\s+", "", cleaned).strip()
        cleaned = re.sub(r"(?i)\s+[-–—_]?\s*(?:resume|cv|curriculum vitae|portfolio)\b", "", cleaned).strip()

        # Split on standard delimiters including pipe and bullet
        parts = re.split(r"\s*[-–—|·]\s*", cleaned)
        if parts:
            first_part = re.sub(r"(?i)\b(resume|cv|profile)\b", "", parts[0]).strip()
            # If first part looks like a human name (1-4 words, no verbs/roles)
            words = first_part.split()
            if 1 <= len(words) <= 4 and not any(w.lower() in ["developer", "engineer", "lead", "architect", "manager", "hiring", "trainee", "full", "stack"] for w in words):
                return first_part

        return parts[0].strip() if parts else "Anonymous Candidate"

    def parse_headline(self, title: str, snippet: str) -> str:
        """Extract professional headline/designation from title or snippet."""
        parts = re.split(r"\s*[-–—|]\s*", title)
        if len(parts) >= 2:
            headline = parts[1].strip()
            if len(headline) > 5 and not headline.lower().startswith("linkedin"):
                return headline

        # Fallback to first sentence of snippet
        sentences = re.split(r"[.!?]\s*", snippet)
        return sentences[0].strip() if sentences else "Professional Profile"

    def parse_location(self, text: str) -> Optional[str]:
        """Detect Indian city or region in title/snippet."""
        lower = text.lower()
        # Pass 1: Prioritize exact canonical city name
        for canonical in self.city_aliases.keys():
            if re.search(rf"\b{re.escape(canonical.lower())}\b", lower):
                return canonical

        # Pass 2: Check aliases and regional clusters
        for canonical, aliases in self.city_aliases.items():
            for alias in aliases:
                if re.search(rf"\b{re.escape(alias.lower())}\b", lower):
                    return canonical
        return None


    def extract_skills(self, text: str) -> List[str]:
        """Extract matched technical skills from text."""
        lower = text.lower()
        matched = []
        for canonical, variants in self.synonyms.items():
            for variant in variants:
                if re.search(rf"\b{re.escape(variant.lower())}\b", lower):
                    if canonical not in matched:
                        matched.append(canonical)
                    break
        return matched

    def extract_contacts(self, text: str) -> Dict[str, List[str]]:
        """Extract public email addresses and validated Indian phone numbers from snippet."""
        emails: List[str] = []
        phones: List[str] = []

        # Email regex
        raw_emails = re.findall(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)
        for e in raw_emails:
            clean_e = e.strip(".,;:()")
            if not any(clean_e.lower().endswith(ign) for ign in [".png", ".jpg", ".svg", ".js"]):
                if clean_e.lower() not in [x.lower() for x in emails]:
                    emails.append(clean_e)

        # Phone extraction for Indian numbers
        phone_matches = re.finditer(r"(?:\+91[\-\s]?)?[6-9]\d{4}[\-\s]?\d{5}|0[6-9]\d{9}", text)
        for m in phone_matches:
            raw_phone = m.group(0).replace(" ", "").replace("-", "")
            try:
                parsed = phonenumbers.parse(raw_phone, "IN")
                if phonenumbers.is_valid_number_for_region(parsed, "IN"):
                    formatted = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
                    if formatted not in phones:
                        phones.append(formatted)
            except Exception:
                pass

        return {"emails": emails, "phones": phones}

    def parse_result(self, raw_url: str, title: str, snippet: str, platform: str) -> Dict[str, Any]:
        """Comprehensive parse of a search engine result."""
        full_text = f"{title} {snippet}"
        name = self.parse_name(title, platform)
        headline = self.parse_headline(title, snippet)
        location = self.parse_location(full_text)
        skills = self.extract_skills(full_text)
        contacts = self.extract_contacts(full_text)

        return {
            "name": name,
            "headline": headline,
            "location": location or "India",
            "skills": skills,
            "emails": contacts["emails"],
            "phones": contacts["phones"],
            "url": raw_url,
            "platform": platform,
            "raw_title": title,
            "raw_snippet": snippet,
        }
