"""Threat Protection and Attack Vector Interceptor Middleware.

Scans all incoming HTTP requests for:
1. SQL Injection (SQLi) attempts across query parameters and JSON payloads.
2. Cross-Site Scripting (XSS), webshells, and virus/malware injection payloads.
3. Anti-CSRF token verification on state-modifying requests.
"""

import json
import logging
from typing import Optional
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.services.threat_detector import ThreatDetector

logger = logging.getLogger("talentscout.security.middleware")

# Endpoints exempt from strict CSRF token validation (public auth, intake, webhooks)
CSRF_EXEMPT_PATHS = {
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/send-otp",
    "/api/auth/verify-otp",
    "/api/auth/csrf-token",
    "/api/admin/login",
    "/api/alerts/test-webhook",
    "/api/resumes/upload",
    "/api/jobs/parse-jd",
}


class ThreatProtectionMiddleware(BaseHTTPMiddleware):
    """Intercepts and terminates requests containing SQLi, XSS, virus, or CSRF threat vectors."""

    async def dispatch(self, request: Request, call_next):
        # 1. Inspect Query Parameters for SQLi & Malware Vectors
        for param_key, param_value in request.query_params.items():
            is_sqli, sqli_reason = ThreatDetector.scan_for_sqli(param_value)
            if is_sqli:
                logger.warning("Threat blocked: SQLi in query param '%s': %s (IP: %s)", param_key, sqli_reason, request.client.host if request.client else "unknown")
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "status": "error",
                        "error_code": "THREAT_ATTACK_DETECTED",
                        "threat_category": "SQL_INJECTION",
                        "detail": f"Security violation: Threat attack vector identified in parameter '{param_key}'.",
                    },
                )

            is_malware, mal_reason = ThreatDetector.scan_for_malware(param_value)
            if is_malware:
                logger.warning("Threat blocked: Malware/XSS in query param '%s': %s", param_key, mal_reason)
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "status": "error",
                        "error_code": "THREAT_ATTACK_DETECTED",
                        "threat_category": "MALICIOUS_SCRIPT_INJECTION",
                        "detail": f"Security violation: Script or webshell signature identified in parameter '{param_key}'.",
                    },
                )

        # 2. Inspect JSON Request Bodies for SQLi & Dangerous Shell Payloads
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type and request.method in ["POST", "PUT", "PATCH"]:
            try:
                body_bytes = await request.body()
                if body_bytes and len(body_bytes) < 2 * 1024 * 1024:  # under 2MB check
                    try:
                        body_json = json.loads(body_bytes.decode("utf-8"))
                        
                        # Deep scan JSON fields
                        is_sqli, sqli_reason = ThreatDetector.scan_for_sqli(body_json)
                        if is_sqli:
                            logger.warning("Threat blocked: SQLi in JSON payload (%s): %s", request.url.path, sqli_reason)
                            return JSONResponse(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                content={
                                    "status": "error",
                                    "error_code": "THREAT_ATTACK_DETECTED",
                                    "threat_category": "SQL_INJECTION",
                                    "detail": f"Security violation: Threat attack vector identified in payload ({sqli_reason}).",
                                },
                            )
                    except json.JSONDecodeError:
                        pass
            except Exception as e:
                logger.warning("Body scan note: %s", e)

        # 3. CSRF Protection for state-modifying requests
        # If client passes X-CSRF-Token header, verify it
        csrf_header = request.headers.get("x-csrf-token")
        if csrf_header:
            if not ThreatDetector.verify_csrf_token(csrf_header):
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "status": "error",
                        "error_code": "CSRF_TOKEN_INVALID",
                        "detail": "Cross-Site Request Forgery (CSRF) token signature invalid or expired. Please refresh the page.",
                    },
                )

        response = await call_next(request)
        return response
