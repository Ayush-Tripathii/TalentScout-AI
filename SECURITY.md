# TalentScout - Enterprise Security Policy & Hardening Guide

## 1. Security Architecture Overview

TalentScout enforces defense-in-depth principles across all architectural tiers:

```
[ Client / Browser ]
         │
         ▼  (HTTPS / TLS 1.3)
[ Security Headers Middleware ]
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - Strict-Transport-Security: max-age=31536000
  - Content-Security-Policy (CSP)
  - Permissions-Policy
         │
         ▼
[ Rate Limiter Middleware ]
  - Sliding-window in-memory bucket
  - Auth routes: 10 req/min
  - Sourcing search: 30 req/min
  - Global: 180 req/min
         │
         ▼
[ Payload Limit Middleware ]
  - 10 MB strict threshold rejection
         │
         ▼
[ Authentication & Authorization Layer ]
  - Cryptographic JWT (HS256) with 256-bit entropy
  - PBKDF2-HMAC-SHA256 (100,000 rounds)
         │
         ▼
[ Input Sanitization & Magic Byte Validation ]
  - XSS tag stripping
  - %PDF- and PK\x03\x04 signature verification
         │
         ▼
[ Data Layer: SQLModel / SQLite WAL ]
  - Parameterized queries (SQLi immune)
  - DPDP Section 12 Right to Erasure cascade
  - Tamper-evident immutable audit logs
```

---

## 2. Environment Variables & Secret Management

| Variable Name | Security Purpose | Production Value Recommendation |
| :--- | :--- | :--- |
| `SECRET_KEY` | Signs and verifies JWT session tokens | 64-char hex string from `secrets.token_hex(32)` |
| `WEBHOOK_SIGNING_SECRET` | Computes HMAC-SHA256 signatures for alerts | 48-char hex string from `secrets.token_hex(24)` |
| `ALLOWED_ORIGINS` | Limits cross-origin resource sharing (CORS) | Explicit domain whitelist (e.g. `https://app.domain.com`) |
| `MAX_UPLOAD_SIZE_BYTES` | Prevents Denial of Service via huge uploads | Default `10485760` (10 MB) |
| `RATE_LIMITING_ENABLED` | Blocks brute-force attacks on auth and search | `true` |
| `RETENTION_DAYS` | Enforces DPDP Act statutory data limits | `180` days |

> [!CAUTION]
> Never commit `.env` or production credentials to Git. Always ensure `.env` is listed in `.gitignore` and distribute `.env.example` as a template only.

---

## 3. Cryptographic Token & Session Authentication

### 3.1 Token Generation
Recruiter access tokens are signed using `HS256` with the server's private `SECRET_KEY`. Each token contains standard JWT claims:
- `iss`: `"talentscout-auth"`
- `iat`: UTC generation timestamp
- `exp`: Configured expiration (default 24 hours / 1440 minutes)
- `email`, `name`, `role`, `company`

### 3.2 Password Hashing
User passwords are never stored in plaintext. They are hashed using **PBKDF2-HMAC-SHA256** with:
- `iterations`: 100,000 rounds
- `salt`: 16-byte cryptographically secure random salt
- `verification`: Constant-time comparison (`secrets.compare_digest`) against timing-attack vectors.

---

## 4. File Upload & Binary Defense

When candidate resumes are uploaded via `/api/resumes/upload`:
1. **Extension Whitelist**: Only `.pdf` and `.docx` extensions are accepted.
2. **Magic Byte Verification**:
   - PDF files must start with binary header `%PDF-`.
   - DOCX files must start with zip archive signature `PK\x03\x04`.
3. **Executable Payload Detection**: Files containing executable headers (`MZ`, `\x7fELF`, `<?php`, `<script`) are rejected with `HTTP 400 Security Check Failed`.
4. **Size Enforcement**: Files larger than 10 MB are rejected before disk writes.

---

## 5. DPDP Act 2023 Statutory Compliance

- **Immutable Audit Trail**: Every search, contact reveal, data export, and deletion is recorded in `AuditLog` with timestamp, recruiter ID, and operation details.
- **Section 12 Right to Erasure**: Hard delete cascades across candidate references, matches, contact points, pipeline history, and notes, leaving a permanent statutory audit record.
- **Data Minimization**: Non-recruitment sensitive PII (Aadhaar, Passport, Religion, Caste, Marital Status) is stripped during OCR and paste capture.

---

## 6. Vulnerability Disclosure

If you discover a security vulnerability in TalentScout, please report it privately:
- **Email**: `security@talentscout.ai`
- **Response SLA**: Initial triage within 24 hours.
