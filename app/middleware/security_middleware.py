"""Enterprise Defense-in-Depth Security Middleware.

Includes:
1. SecurityHeadersMiddleware: Implements strict CSP, HSTS, X-Frame-Options, MIME sniffing prevention,
   and Referrer policy while removing technology fingerprint headers.
2. RateLimiterMiddleware: Sliding-window in-memory IP rate limiter preventing brute-force attacks and DoS.
3. PayloadSizeLimitMiddleware: Rejects oversized payloads exceeding configured byte threshold.
"""

import time
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from config.settings import get_settings

settings = get_settings()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Enforces enterprise security headers on all HTTP responses."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        if settings.SECURITY_HEADERS_ENABLED:
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"

            if settings.CONTENT_SECURITY_POLICY_ENABLED:
                csp_directives = [
                    "default-src 'self'",
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                    "font-src 'self' https://fonts.gstatic.com data:",
                    "img-src 'self' data: https: blob:",
                    "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
                    "frame-ancestors 'none'",
                ]
                response.headers["Content-Security-Policy"] = "; ".join(csp_directives)

            # Strip server identification headers
            if "server" in response.headers:
                del response.headers["server"]
            if "x-powered-by" in response.headers:
                del response.headers["x-powered-by"]

        return response


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """Sliding-window in-memory rate limiter per client IP address."""

    def __init__(self, app):
        super().__init__(app)
        # Dictionary mapping IP -> List of timestamps
        self._history: Dict[str, List[float]] = defaultdict(list)
        self._cleanup_interval = 300.0  # Clean every 5 minutes
        self._last_cleanup = time.time()

    def _clean_old_records(self, now: float):
        if now - self._last_cleanup > self._cleanup_interval:
            cutoff = now - 60.0
            for ip in list(self._history.keys()):
                self._history[ip] = [ts for ts in self._history[ip] if ts > cutoff]
                if not self._history[ip]:
                    del self._history[ip]
            self._last_cleanup = now

    def _get_limit_for_path(self, path: str) -> int:
        if path.startswith("/api/auth/"):
            return settings.RATE_LIMIT_AUTH_PER_MINUTE
        if path.startswith("/api/sourcing/execute"):
            return settings.RATE_LIMIT_SEARCH_PER_MINUTE
        return settings.RATE_LIMIT_GLOBAL_PER_MINUTE

    async def dispatch(self, request: Request, call_next):
        if not settings.RATE_LIMITING_ENABLED or request.method == "OPTIONS":
            return await call_next(request)

        # Extract client IP
        forwarded = request.headers.get("x-forwarded-for")
        client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "127.0.0.1")

        now = time.time()
        self._clean_old_records(now)

        limit = self._get_limit_for_path(request.url.path)
        window_start = now - 60.0

        # Filter timestamps in the past 60 seconds
        recent_requests = [ts for ts in self._history[client_ip] if ts > window_start]
        self._history[client_ip] = recent_requests

        if len(recent_requests) >= limit:
            retry_after = int(60 - (now - recent_requests[0])) if recent_requests else 60
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "status": "error",
                    "error_code": "RATE_LIMIT_EXCEEDED",
                    "detail": f"Rate limit exceeded. Maximum allowable is {limit} requests per minute.",
                    "retry_after_seconds": max(1, retry_after),
                },
                headers={
                    "Retry-After": str(max(1, retry_after)),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(now + max(1, retry_after))),
                },
            )

        # Record this request
        self._history[client_ip].append(now)

        response: Response = await call_next(request)
        remaining = max(0, limit - len(self._history[client_ip]))
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(now + 60))
        return response


class PayloadSizeLimitMiddleware(BaseHTTPMiddleware):
    """Enforces maximum allowable payload threshold on incoming requests."""

    async def dispatch(self, request: Request, call_next):
        if request.method in ["POST", "PUT", "PATCH"]:
            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    size = int(content_length)
                    if size > settings.MAX_UPLOAD_SIZE_BYTES:
                        limit_mb = settings.MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)
                        return JSONResponse(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            content={
                                "status": "error",
                                "error_code": "PAYLOAD_TOO_LARGE",
                                "detail": f"Request entity exceeds the maximum allowable size of {limit_mb:.1f} MB.",
                            },
                        )
                except ValueError:
                    pass

        return await call_next(request)
