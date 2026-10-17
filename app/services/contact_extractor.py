"""Contact Extraction & Privacy-Aware Data Normalization Service.

Validates Indian phone numbers, extracts clean emails, and strips non-recruitment PII
(DOB, marital status, aadhaar, passport) strictly adhering to DPDP Act principles.
"""

import re
from typing import Any, Dict, List, Optional
import phonenumbers
from phonenumbers import PhoneNumberFormat, PhoneNumberType


class ContactExtractor:
    """Robust extractor and validator for contact points and recruiter pasted profiles."""

    # Sensitive personal information patterns to strip for DPDP Act compliance
    SENSITIVE_PATTERNS = [
        r"(?i)\b(date of birth|dob|d\.o\.b\.?)\s*[:\-]?\s*[\d\w\s,/-]+",
        r"(?i)\b(marital status|married|single|divorced|unmarried)\b",
        r"(?i)\b(aadhaar|aadhar|uidai)\s*(number|no\.?)?\s*[:\-]?\s*[\d\s]{12,14}",
        r"(?i)\b(passport)\s*(number|no\.?)?\s*[:\-]?\s*[a-zA-Z0-9\s]{8,10}",
        r"(?i)\b(gender|sex)\s*[:\-]?\s*(male|female|other)\b",
        r"(?i)\b(father'?s?\s*name|mother'?s?\s*name)\s*[:\-]?\s*[\w\s]+",
        r"(?i)\b(religion|caste|community)\s*[:\-]?\s*[\w\s]+",
    ]

    @classmethod
    def sanitize_raw_text(cls, text: str) -> str:
        """Strip non-recruitment PII from raw pasted text (DPDP data minimization)."""
        clean = text
        for pat in cls.SENSITIVE_PATTERNS:
            clean = re.sub(pat, "[PII REMOVED]", clean)
        return clean.strip()

    @classmethod
    def extract_emails(cls, text: str) -> List[str]:
        """Extract valid RFC email addresses, ignoring asset/file noise."""
        raw_emails = re.findall(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)
        valid_emails: List[str] = []
        for e in raw_emails:
            clean = e.strip(".,;:()<>[]{}'\"")
            # Filter image or web assets
            if any(clean.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp", ".js", ".css"]):
                continue
            if "@" in clean and "." in clean.split("@")[-1]:
                if clean.lower() not in [x.lower() for x in valid_emails]:
                    valid_emails.append(clean)
        return valid_emails

    @classmethod
    def extract_phones(cls, text: str) -> List[str]:
        """Extract and validate Indian mobile and landline phone numbers."""
        valid_phones: List[str] = []
        # Match standard Indian patterns (+91, 0-prefix, 10-digit mobile starting with 6-9)
        matches = re.finditer(r"(?:\+91[\-\s]?)?[6-9]\d{4}[\-\s]?\d{5}|0[6-9]\d{9}|\b[6-9]\d{9}\b", text)
        for m in matches:
            raw_phone = m.group(0).replace(" ", "").replace("-", "")
            try:
                parsed = phonenumbers.parse(raw_phone, "IN")
                if phonenumbers.is_valid_number_for_region(parsed, "IN"):
                    formatted = phonenumbers.format_number(parsed, PhoneNumberFormat.E164)
                    if formatted not in valid_phones:
                        valid_phones.append(formatted)
            except Exception:
                pass
        return valid_phones

    @classmethod
    def extract_profile_urls(cls, text: str) -> List[Dict[str, str]]:
        """Extract public profile and portfolio URLs (LinkedIn, GitHub, Portfolio)."""
        urls: List[Dict[str, str]] = []
        found_links = re.findall(r"https?://[^\s<>\"']+", text)

        for u in found_links:
            clean_u = u.strip(".,;:()")
            platform = "web"
            if "linkedin.com/in" in clean_u.lower():
                platform = "linkedin"
            elif "github.com" in clean_u.lower():
                platform = "github"
            elif "naukri.com" in clean_u.lower():
                platform = "naukri"
            elif any(d in clean_u.lower() for d in ["medium.com", "dev.to", "kaggle.com", "behance.net", "dribbble.com"]):
                platform = "portfolio"

            if not any(x["url"] == clean_u for x in urls):
                urls.append({"platform": platform, "url": clean_u})

        return urls

    @classmethod
    def parse_pasted_text(cls, raw_text: str) -> Dict[str, Any]:
        """Comprehensive parse of pasted text (e.g. LinkedIn Contact Info or resume snippet)."""
        sanitized = cls.sanitize_raw_text(raw_text)
        emails = cls.extract_emails(sanitized)
        phones = cls.extract_phones(sanitized)
        urls = cls.extract_profile_urls(sanitized)

        # Candidate name inference from first non-noise lines
        lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
        candidate_name = None
        headline = None

        noise_tokens = {"contact", "info", "experience", "education", "linkedin", "profile", "skills", "email", "phone", "website"}
        for line in lines[:4]:
            lower = line.lower()
            if not any(t in lower for t in noise_tokens) and not re.search(r"[@\d:]", line):
                words = line.split()
                if 2 <= len(words) <= 4:
                    candidate_name = line.title()
                    break

        # Headline inference from remaining top lines
        if candidate_name and len(lines) >= 2:
            for line in lines[1:5]:
                if line != candidate_name and len(line) > 6 and not any(t in line.lower() for t in noise_tokens):
                    headline = line.strip()
                    break

        return {
            "name": candidate_name,
            "headline": headline,
            "emails": emails,
            "phones": phones,
            "urls": urls,
            "primary_email": emails[0] if emails else None,
            "primary_phone": phones[0] if phones else None,
            "profile_url": urls[0]["url"] if urls else None,
            "sanitized_text": sanitized,
        }
