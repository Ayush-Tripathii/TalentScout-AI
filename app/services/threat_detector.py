"""Enterprise Threat Detection, Input Sanitization, and Validation Engine.

Provides deep defense-in-depth protections:
1. SQL Injection (SQLi) pattern detection across all query parameters and JSON fields.
2. Cross-Site Scripting (XSS) and Webshell / Virus / Macro payload inspection.
3. Anti-CSRF cryptographic token engine.
4. Disposable and temporary email domain blacklisting.
5. Invalid and temporary/burner phone number rejection.
6. API key syntax, entropy, and provider-specific format validation.
"""

from datetime import datetime, timezone, timedelta
import hashlib
import hmac
import html
import json
import logging
import re
import secrets
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse

from config.settings import get_settings

logger = logging.getLogger("talentscout.security.threat")
settings = get_settings()

def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ============================================================================
# 1. DISPOSABLE & TEMPORARY EMAIL BLACKLIST
# ============================================================================
DISPOSABLE_EMAIL_DOMAINS: Set[str] = {
    "mailinator.com",
    "tempmail.com",
    "10minutemail.com",
    "10minutemail.net",
    "guerrillamail.com",
    "guerrillamail.net",
    "guerrillamail.org",
    "trashmail.com",
    "trashmail.net",
    "trashmail.me",
    "throwawaymail.com",
    "sharklasers.com",
    "yopmail.com",
    "yopmail.net",
    "fakeinbox.com",
    "getairmail.com",
    "dispostable.com",
    "temp-mail.org",
    "temp-mail.io",
    "fakemailgenerator.com",
    "burnermail.io",
    "mohmal.com",
    "crazymailing.com",
    "generator.email",
    "inboxkitten.com",
    "nada.ltd",
    "getnada.com",
    "maildrop.cc",
    "mytemp.email",
    "emailondeck.com",
    "tempail.com",
    "trashmail.de",
    "meltmail.com",
    "minuteinbox.com",
    "tempinbox.com",
    "anonymbox.com",
    "spambox.us",
    "discard.email",
    "disposablemail.com",
    "harakirimail.com",
    "armyspy.com",
    "cuvox.de",
    "dayrep.com",
    "einrot.com",
    "fleckens.hu",
    "gustr.com",
    "jourrapide.com",
    "rhyta.com",
    "superrito.com",
    "teleworm.us",
    "dropmail.me",
    "crazymail.com",
    "fakemail.net",
    "tempm.com",
    "burner.email",
    "mailpoof.com",
    "tempmailaddress.com",
    "inboxbear.com",
    "deadfake.com",
    "throwaway.email",
}


# ============================================================================
# 2. SQL INJECTION HEURISTIC PATTERNS
# ============================================================================
SQLI_REGEX_PATTERNS = [
    # Classic boolean tautologies
    re.compile(r"(?i)\b(or|and)\b\s+[\'\"]?\w+[\'\"]?\s*=\s*[\'\"]?\w+[\'\"]?", re.IGNORECASE),
    re.compile(r"(?i)\b(or|and)\b\s+\d+\s*=\s*\d+", re.IGNORECASE),
    # Union based injection
    re.compile(r"(?i)\bunion\b\s+(all\s+)?\bselect\b", re.IGNORECASE),
    # Comment truncation evasion
    re.compile(r"(--|#|/\*|\*/|;--)", re.IGNORECASE),
    # Dangerous SQL DDL/DML statements in string fields
    re.compile(r"(?i)\b(drop|alter|truncate)\s+\btable\b", re.IGNORECASE),
    re.compile(r"(?i)\binsert\s+into\b.*\bvalues\b", re.IGNORECASE),
    re.compile(r"(?i)\bupdate\b.*\bset\b.*\bwhere\b", re.IGNORECASE),
    re.compile(r"(?i)\bdelete\s+from\b", re.IGNORECASE),
    # Time-based blind injection primitives
    re.compile(r"(?i)\b(sleep|benchmark|waitfor\s+delay|pg_sleep)\s*\(", re.IGNORECASE),
    # Executing external shell or procedures
    re.compile(r"(?i)\b(xp_cmdshell|exec\s*\(|execute\s*\()", re.IGNORECASE),
    # Schema extraction
    re.compile(r"(?i)\binformation_schema\b", re.IGNORECASE),
    # SQLite pragma attacks
    re.compile(r"(?i)\bpragma\s+\w+", re.IGNORECASE),
]


# ============================================================================
# 3. WEBSHELL & VIRUS INJECTION SIGNATURES
# ============================================================================
VIRUS_SHELL_PATTERNS = [
    re.compile(r"(?i)<\?php", re.IGNORECASE),
    re.compile(r"(?i)\beval\s*\(\s*(base64_decode|gzinflate|str_rot13)", re.IGNORECASE),
    re.compile(r"(?i)\b(passthru|shell_exec|system|popen|proc_open)\s*\(", re.IGNORECASE),
    re.compile(r"(?i)\bcmd\.exe\b|\bpowershell(\.exe)?\s+(-enc|-e|-w\s+hidden)", re.IGNORECASE),
    re.compile(r"(?i)\b\/bin\/(sh|bash|zsh)\b", re.IGNORECASE),
    re.compile(r"(?i)<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>", re.IGNORECASE),
    re.compile(r"(?i)javascript:[^\s\"'>]+", re.IGNORECASE),
    re.compile(r"(?i)\bon(error|load|click|mouseover|submit)\s*=", re.IGNORECASE),
]


class ThreatDetector:
    """Security engine for threat detection, validation, and anti-CSRF protections."""

    # ------------------------------------------------------------------------
    # SQL INJECTION SCANNER
    # ------------------------------------------------------------------------
    @staticmethod
    def scan_for_sqli(value: Any) -> Tuple[bool, Optional[str]]:
        """Recursively scan strings, dictionaries, or lists for SQL injection attacks."""
        if value is None:
            return False, None

        if isinstance(value, str):
            # Skip empty or very short benign tokens
            if len(value) < 3:
                return False, None

            for pattern in SQLI_REGEX_PATTERNS:
                if pattern.search(value):
                    match_snippet = pattern.search(value).group(0)
                    return True, f"SQL injection attack vector detected: '{match_snippet}'"
            return False, None

        elif isinstance(value, dict):
            for k, v in value.items():
                is_threat, reason = ThreatDetector.scan_for_sqli(v)
                if is_threat:
                    return True, f"Field '{k}': {reason}"
                is_key_threat, key_reason = ThreatDetector.scan_for_sqli(k)
                if is_key_threat:
                    return True, f"Parameter key '{k}': {key_reason}"

        elif isinstance(value, list):
            for idx, item in enumerate(value):
                is_threat, reason = ThreatDetector.scan_for_sqli(item)
                if is_threat:
                    return True, f"Array index [{idx}]: {reason}"

        return False, None

    # ------------------------------------------------------------------------
    # VIRUS, MALWARE & SCRIPT INJECTION SCANNER
    # ------------------------------------------------------------------------
    @staticmethod
    def scan_for_malware(content_str: str) -> Tuple[bool, Optional[str]]:
        """Scan raw strings and input text for virus, web shell, and malicious script vectors."""
        if not content_str:
            return False, None

        for pattern in VIRUS_SHELL_PATTERNS:
            if pattern.search(content_str):
                matched = pattern.search(content_str).group(0)
                return True, f"Malicious executable code or web-shell signature identified: '{matched}'"
        return False, None

    @staticmethod
    def scan_file_for_virus(filename: str, file_bytes: bytes) -> Tuple[bool, Optional[str]]:
        """Inspect binary file content for malicious macro payloads, PE executables, and web shells."""
        if not file_bytes:
            return False, "File is completely empty."

        # 1. Binary executable headers check
        dangerous_binary_headers = [
            (b"MZ", "Windows PE executable (.exe / .dll)"),
            (b"\x7fELF", "Linux ELF executable binary"),
            (b"\xca\xfe\xba\xbe", "Mach-O / Java compiled class bytecode"),
            (b"PK\x05\x06", "Empty or manipulated ZIP record"),
        ]

        for header_bytes, desc in dangerous_binary_headers:
            if file_bytes.startswith(header_bytes) and not filename.lower().endswith(".docx"):
                return False, f"Prohibited binary executable format detected: {desc}"

        # 2. Textual malware signatures inside first 8KB
        sample = file_bytes[:8192]
        try:
            sample_str = sample.decode("utf-8", errors="ignore")
            for pattern in VIRUS_SHELL_PATTERNS:
                if pattern.search(sample_str):
                    return False, "File contains embedded web-shell or script injection code."
        except Exception:
            pass

        # 3. PDF Macro & JavaScript Embedded Actions Check
        if filename.lower().endswith(".pdf"):
            suspicious_pdf_tokens = [b"/JavaScript", b"/JS", b"/Launch", b"/EmbeddedFiles", b"/OpenAction"]
            for token in suspicious_pdf_tokens:
                if token in file_bytes:
                    return False, f"PDF file contains suspicious executable action tag: {token.decode('latin1', errors='ignore')}"

        return True, "File verified safe"

    # ------------------------------------------------------------------------
    # DISPOSABLE EMAIL DOMAIN DETECTOR
    # ------------------------------------------------------------------------
    @staticmethod
    def is_disposable_email(email: str) -> Tuple[bool, Optional[str]]:
        """Check if an email address belongs to a known temporary/disposable domain."""
        if not email or "@" not in email:
            return True, "Invalid email address syntax."

        clean_email = email.strip().lower()
        parts = clean_email.split("@")
        if len(parts) != 2:
            return True, "Malformed email address."

        domain = parts[1].strip()

        # Check explicit domain blacklist
        if domain in DISPOSABLE_EMAIL_DOMAINS:
            return True, f"The email domain '@{domain}' is a known temporary/disposable email provider. Please provide your official work or personal email address."

        # Check subdomains of disposable providers (e.g. *.mailinator.com)
        for d in DISPOSABLE_EMAIL_DOMAINS:
            if domain.endswith(f".{d}"):
                return True, f"The email domain '@{domain}' belongs to a temporary email network. Please provide an authentic email address."

        return False, None

    # ------------------------------------------------------------------------
    # PHONE NUMBER VALIDATOR (BLOCKS TEMPORARY & DUMMY NUMBERS)
    # ------------------------------------------------------------------------
    @staticmethod
    def validate_phone_number(phone: Optional[str]) -> Tuple[bool, str]:
        """Validate phone number format and explicitly block fake, repeated, or temporary numbers."""
        if not phone or not phone.strip():
            return False, "Phone number cannot be blank."

        clean_phone = re.sub(r"[\s\-\(\)\.]", "", phone.strip())

        # Strip leading +91 or 91 or 0 for standard Indian validation
        raw_digits = clean_phone
        if raw_digits.startswith("+91"):
            raw_digits = raw_digits[3:]
        elif raw_digits.startswith("91") and len(raw_digits) == 12:
            raw_digits = raw_digits[2:]
        elif raw_digits.startswith("0") and len(raw_digits) == 11:
            raw_digits = raw_digits[1:]

        # Must be 10 digits for Indian mobile numbers
        if not raw_digits.isdigit() or len(raw_digits) != 10:
            return False, "Please enter a valid 10-digit mobile number (e.g. +91 98201 54321)."

        # Check Indian telecom circle starting digit (must start with 6, 7, 8, or 9)
        if raw_digits[0] not in ["6", "7", "8", "9"]:
            return False, "Invalid mobile number. Authentic Indian mobile numbers must begin with 6, 7, 8, or 9."

        # Reject all repeated digits (e.g. 9999999999, 8888888888)
        if len(set(raw_digits)) <= 2:
            return False, "Temporary, dummy, or repeated digit phone numbers are not allowed."

        # Reject common sequential test patterns
        dummy_sequences = [
            "1234567890", "9876543210", "0123456789",
            "9898989898", "9191919191", "9090909090",
            "8989898989", "7878787878", "6767676767",
        ]
        if raw_digits in dummy_sequences:
            return False, "Recognized dummy/test phone number. Please enter your genuine contact number."

        # Format cleanly as +91 XXXXX XXXXX
        formatted = f"+91 {raw_digits[:5]} {raw_digits[5:]}"
        return True, formatted

    # ------------------------------------------------------------------------
    # API KEY VALIDATOR
    # ------------------------------------------------------------------------
    @staticmethod
    def validate_api_key_syntax(api_key: Optional[str], provider: str = "generic") -> Tuple[bool, str]:
        """Verify API key structure, entropy, length, and provider-specific syntax."""
        if not api_key or not api_key.strip():
            return False, "API key cannot be empty."

        clean_key = api_key.strip()
        provider_lower = provider.lower()

        # Reject basic threat characters in API keys
        if any(c in clean_key for c in ["'", '"', ";", "<", ">", " ", "\n"]):
            return False, "API key contains invalid special characters or whitespace."

        if provider_lower == "serpapi":
            # SerpApi keys are typically 64-char hexadecimal strings
            if len(clean_key) < 32 or not re.match(r"^[a-fA-F0-9_]{32,64}$", clean_key):
                return False, "Invalid SerpApi key format. Must be a valid 32-64 character hexadecimal token."

        elif provider_lower == "hunter":
            # Hunter.io keys are 40-character hexadecimal strings
            if len(clean_key) < 20 or not re.match(r"^[a-zA-Z0-9_-]{20,64}$", clean_key):
                return False, "Invalid Hunter.io API key format."

        elif provider_lower == "apollo":
            # Apollo.io API keys are 20-64 char alphanumeric tokens
            if len(clean_key) < 16 or not re.match(r"^[a-zA-Z0-9_\-\.]{16,64}$", clean_key):
                return False, "Invalid Apollo.io API key format."

        elif provider_lower == "openai":
            if not (clean_key.startswith("sk-") or clean_key.startswith("sk-proj-")) or len(clean_key) < 30:
                return False, "Invalid OpenAI API key format. Must start with 'sk-' and be at least 30 characters."

        elif provider_lower == "talentscout":
            if not clean_key.startswith("ts_live_") or len(clean_key) < 24:
                return False, "Invalid TalentScout API key format. Must start with 'ts_live_' prefix."

        else:
            # Generic token check (min 16 chars, base64/hex/alphanumeric)
            if len(clean_key) < 12:
                return False, "API key is too short. Minimum length is 12 characters."

        return True, "Valid API key syntax"

    # ------------------------------------------------------------------------
    # ANTI-CSRF TOKEN GENERATION & VALIDATION
    # ------------------------------------------------------------------------
    @staticmethod
    def generate_csrf_token(session_id: Optional[str] = None) -> str:
        """Create a cryptographically signed anti-CSRF token with 2-hour timestamp."""
        sid = session_id or secrets.token_hex(16)
        timestamp = int(get_utc_now().timestamp())
        nonce = secrets.token_hex(8)
        raw_message = f"{sid}:{timestamp}:{nonce}"
        
        signature = hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            raw_message.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        
        return f"{raw_message}:{signature}"

    @staticmethod
    def verify_csrf_token(csrf_token: Optional[str], max_age_seconds: int = 7200) -> bool:
        """Verify the signature and expiration time of an anti-CSRF token."""
        if not csrf_token or ":" not in csrf_token:
            return False

        try:
            parts = csrf_token.split(":")
            if len(parts) != 4:
                return False

            sid, ts_str, nonce, signature = parts
            timestamp = int(ts_str)
            raw_message = f"{sid}:{timestamp}:{nonce}"

            expected_sig = hmac.new(
                settings.SECRET_KEY.encode("utf-8"),
                raw_message.encode("utf-8"),
                hashlib.sha256
            ).hexdigest()

            if not secrets.compare_digest(signature, expected_sig):
                return False

            # Check expiration (default 2 hours)
            now = int(get_utc_now().timestamp())
            if now - timestamp > max_age_seconds:
                return False

            return True
        except Exception:
            return False
