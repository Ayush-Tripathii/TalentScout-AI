"""Multi-Format Resume Parser.

Extracts text, candidate name, contact info, skills, education, and experience
from PDF (via pdfplumber) and DOCX (via python-docx) documents using spaCy and regex.
"""

import hashlib
import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
import pdfplumber
import docx
import phonenumbers
from app.services.jd_parser import load_synonyms, load_city_aliases

logger = logging.getLogger("talentscout.resume_parser")

_nlp = None

def get_nlp():
    """Lazy load spaCy English model on demand, failing gracefully if torch/spacy DLLs are restricted."""
    global _nlp
    if _nlp is None:
        try:
            import spacy
            _nlp = spacy.load("en_core_web_sm")
        except (Exception, OSError) as e:
            logger.warning(f"spaCy not available (using rule-based parser): {e}")
            _nlp = False
    return _nlp if _nlp is not False else None



class ResumeParser:
    """Parser for PDF and DOCX resume documents."""

    def __init__(self):
        self.synonyms = load_synonyms()
        self.city_aliases = load_city_aliases()

    @staticmethod
    def calculate_file_hash(filepath: Path) -> str:
        """Compute SHA-256 checksum of a file to prevent duplicate processing."""
        sha256 = hashlib.sha256()
        with open(filepath, "rb") as f:
            while chunk := f.read(8192):
                sha256.update(chunk)
        return sha256.hexdigest()

    def extract_text(self, filepath: Path) -> str:
        """Extract plain text from PDF or DOCX file."""
        ext = filepath.suffix.lower()
        text_parts = []

        if ext == ".pdf":
            try:
                with pdfplumber.open(filepath) as pdf:
                    for page in pdf.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text_parts.append(page_text)
            except Exception as e:
                logger.error(f"Error reading PDF {filepath}: {e}")
        elif ext in [".docx", ".doc"]:
            try:
                doc = docx.Document(filepath)
                for para in doc.paragraphs:
                    if para.text.strip():
                        text_parts.append(para.text)
                for table in doc.tables:
                    for row in table.rows:
                        row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                        if row_text:
                            text_parts.append(row_text)
            except Exception as e:
                logger.error(f"Error reading DOCX {filepath}: {e}")

        return "\n".join(text_parts).strip()

    def extract_name(self, text: str) -> str:
        """Heuristic name extraction using top lines and spaCy PERSON entities."""
        lines = [line.strip() for line in text.split("\n") if line.strip() and len(line.strip()) < 80]
        # Ignore common resume header words
        noise_words = ["resume", "curriculum", "vitae", "cv", "profile", "contact", "summary", "email", "phone"]

        # Strategy 1: Check first 3 lines
        for line in lines[:3]:
            lower = line.lower()
            if not any(n in lower for n in noise_words) and not re.search(r"[@\d:]", line):
                words = line.split()
                if 2 <= len(words) <= 4:
                    return line.title()

        # Strategy 2: spaCy PERSON entity in top 400 chars
        nlp_instance = get_nlp()
        if nlp_instance:
            doc = nlp_instance(text[:500])
            for ent in doc.ents:
                if ent.label_ == "PERSON" and len(ent.text.split()) >= 2:
                    return ent.text.strip().title()


        return lines[0].title() if lines else "Candidate"

    def extract_contacts(self, text: str) -> Dict[str, List[str]]:
        """Extract email addresses and Indian mobile numbers (+91, 0-prefix, 10-digit)."""
        emails = []
        phones = []

        # Emails
        raw_emails = re.findall(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)
        for e in raw_emails:
            clean = e.strip(".,;:()")
            if clean.lower() not in [x.lower() for x in emails]:
                emails.append(clean)

        # Phone numbers
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

    def extract_location(self, text: str) -> Optional[str]:
        """Detect Indian city or state in resume text."""
        lower = text.lower()
        for canonical in self.city_aliases.keys():
            if re.search(rf"\b{re.escape(canonical.lower())}\b", lower):
                return canonical
        for canonical, aliases in self.city_aliases.items():
            for alias in aliases:
                if re.search(rf"\b{re.escape(alias.lower())}\b", lower):
                    return canonical
        return None

    def extract_skills(self, text: str) -> List[str]:
        """Extract matching technical skills based on synonyms dictionary."""
        lower = text.lower()
        matched = []
        for canonical, variants in self.synonyms.items():
            for variant in variants:
                if re.search(rf"\b{re.escape(variant.lower())}\b", lower):
                    if canonical not in matched:
                        matched.append(canonical)
                    break
        return matched

    def estimate_experience_years(self, text: str) -> float:
        """Estimate total years of experience from summary or year spans."""
        lower = text.lower()
        # Direct pattern: "X+ years of experience" or "X years"
        m = re.search(r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)(?:\s*of)?\s*(?:experience|exp)", lower)
        if m:
            return float(m.group(1))

        # Year range pattern: 2018 - 2024 or 2019 - Present
        years = [int(y) for y in re.findall(r"\b(20\d{2}|19\d{2})\b", text)]
        if len(years) >= 2:
            span = max(years) - min(years)
            if 0 < span <= 35:
                return float(span)

        return 3.0

    def extract_education(self, text: str) -> List[str]:
        """Identify academic qualifications."""
        edu = []
        patterns = [
            r"\b(?:B\.?Tech|B\.?E\.?|Bachelor of Engineering|Bachelor of Technology)\b",
            r"\b(?:M\.?Tech|M\.?E\.?|Master of Technology)\b",
            r"\b(?:MCA|BCA|B\.?Sc|M\.?Sc)\b",
            r"\b(?:MBA|BBA)\b",
        ]
        for pat in patterns:
            found = re.findall(pat, text, re.I)
            for f in found:
                clean = f.strip().upper()
                if clean not in edu:
                    edu.append(clean)
        return edu

    def parse_file(self, filepath: Path) -> Dict[str, Any]:
        """Parse complete resume document into structured fields."""
        raw_text = self.extract_text(filepath)
        file_hash = self.calculate_file_hash(filepath)
        name = self.extract_name(raw_text)
        contacts = self.extract_contacts(raw_text)
        location = self.extract_location(raw_text)
        skills = self.extract_skills(raw_text)
        exp_years = self.estimate_experience_years(raw_text)
        education = self.extract_education(raw_text)

        # Generate a succinct headline
        headline = f"Software Professional | {', '.join(skills[:3])}" if skills else "Experienced Professional"

        return {
            "file_path": str(filepath),
            "file_hash": file_hash,
            "file_format": filepath.suffix.replace(".", "").lower(),
            "name": name,
            "headline": headline,
            "location": location or "India",
            "experience_years": exp_years,
            "skills": skills,
            "emails": contacts["emails"],
            "phones": contacts["phones"],
            "education": education,
            "raw_text": raw_text,
        }
