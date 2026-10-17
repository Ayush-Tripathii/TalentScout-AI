"""Advanced Security & Cryptographic Protection Service.

Provides:
1. Cryptographically signed JWT tokens with configurable expiration and algorithms.
2. Hardened password hashing (PBKDF2-HMAC-SHA256 with 100,000 iterations & salt).
3. Payload and text sanitization against Cross-Site Scripting (XSS) and injection attacks.
4. Magic byte and extension verification for secure resume uploads.
5. HMAC-SHA256 webhook signatures for tamper-proof external notification delivery.
"""

from datetime import datetime, timezone, timedelta
import hashlib
import hmac
import html
import re
import secrets
from typing import Any, Dict, Optional, Tuple
import jwt
from config.settings import get_settings

settings = get_settings()


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SecurityService:
    """Enterprise-grade security controls and cryptographic token manager."""

    @staticmethod
    def generate_token(
        data: Dict[str, Any],
        expires_minutes: Optional[int] = None,
    ) -> str:
        """Create a cryptographically signed JWT access token."""
        to_encode = data.copy()
        expire_delta = timedelta(minutes=expires_minutes or settings.JWT_EXPIRATION_MINUTES)
        expire_at = get_utc_now() + expire_delta

        to_encode.update({
            "exp": expire_at,
            "iat": get_utc_now(),
            "iss": "talentscout-auth",
        })

        encoded_jwt = jwt.encode(
            to_encode,
            settings.SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )
        return encoded_jwt

    @staticmethod
    def create_access_token(data: Dict[str, Any], expires_delta: Optional[int] = None) -> str:
        """Alias for generate_token with seconds-based or minutes expiration."""
        minutes = int(expires_delta / 60) if expires_delta else None
        return SecurityService.generate_token(data, expires_minutes=minutes)

    @staticmethod
    def verify_token(token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT signature, issuer, and expiration time."""
        if not token:
            return None
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
                issuer="talentscout-auth",
            )
            return payload
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            return None

    @staticmethod
    def hash_password(password: str, salt: Optional[str] = None) -> str:
        """Hash password using PBKDF2-HMAC-SHA256 with 100,000 iterations."""
        if not salt:
            salt = secrets.token_hex(16)
        pwd_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            100000,
        ).hex()
        return f"{salt}${pwd_hash}"

    @staticmethod
    def verify_password(plain_password: str, stored_hash: str) -> bool:
        """Verify plain password against stored salt$hash in constant time."""
        try:
            if "$" not in stored_hash:
                return False
            salt, expected_hash = stored_hash.split("$", 1)
            calculated_hash = hashlib.pbkdf2_hmac(
                "sha256",
                plain_password.encode("utf-8"),
                salt.encode("utf-8"),
                100000,
            ).hex()
            return secrets.compare_digest(calculated_hash, expected_hash)
        except Exception:
            return False

    @staticmethod
    def sanitize_text(text: Optional[str]) -> str:
        """Strip dangerous script tags, javascript: URI schemas, and event handlers."""
        if not text:
            return ""
        # Strip script tags and content
        cleaned = re.sub(r"(?i)<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>", "", text)
        # Strip iframe, object, embed tags
        cleaned = re.sub(r"(?i)<\/?(?:iframe|object|embed|applet|meta|link)[^>]*>", "", cleaned)
        # Strip javascript: and vbscript: URIs
        cleaned = re.sub(r"(?i)javascript:[^\s\"'>]+", "[removed_script]", cleaned)
        cleaned = re.sub(r"(?i)vbscript:[^\s\"'>]+", "[removed_script]", cleaned)
        # Strip dangerous inline handlers like onerror=, onclick=, onload=
        cleaned = re.sub(r"(?i)\bon\w+\s*=\s*['\"][^'\"]*['\"]", "", cleaned)
        cleaned = re.sub(r"(?i)\bon\w+\s*=\s*[^>\s]+", "", cleaned)
        return cleaned.strip()

    @staticmethod
    def validate_uploaded_resume(
        filename: str,
        content: bytes,
        max_size_bytes: Optional[int] = None,
    ) -> Tuple[bool, str]:
        """Verify file extension, header magic bytes, size limits, and absence of malicious code."""
        limit = max_size_bytes or settings.MAX_UPLOAD_SIZE_BYTES
        if len(content) > limit:
            return False, f"File exceeds maximum allowable size of {limit / (1024 * 1024):.1f} MB."

        if len(content) < 4:
            return False, "File is empty or corrupted."

        lower_name = filename.lower()
        if not (lower_name.endswith(".pdf") or lower_name.endswith(".docx")):
            return False, "Unsupported file format. Only verified PDF (.pdf) and Word (.docx) documents are permitted."

        # Verify magic bytes
        if lower_name.endswith(".pdf"):
            if not content.startswith(b"%PDF-"):
                return False, "File content does not match genuine PDF header signature."
        elif lower_name.endswith(".docx"):
            # DOCX files are zip archives starting with PK\x03\x04
            if not content.startswith(b"PK\x03\x04"):
                return False, "File content does not match genuine DOCX header signature."

        # Scan for obvious embedded executable payloads
        suspicious_signatures = [b"MZ", b"\x7fELF", b"<?php", b"<script", b"eval("]
        for sig in suspicious_signatures:
            if sig in content[:1024]:
                return False, "File contains suspicious or executable header signatures."

        return True, "Valid"

    @staticmethod
    def generate_webhook_signature(payload: str, secret: Optional[str] = None) -> str:
        """Compute HMAC-SHA256 signature for outgoing webhook payload."""
        sec = secret or settings.WEBHOOK_SIGNING_SECRET
        return hmac.new(sec.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()

    @staticmethod
    def verify_webhook_signature(payload: str, signature: str, secret: Optional[str] = None) -> bool:
        """Verify incoming webhook signature in constant time."""
        expected = SecurityService.generate_webhook_signature(payload, secret)
        return secrets.compare_digest(expected, signature)
