# TalentScout: Autonomous Recruiter & Talent Sourcing Engine

TalentScout is an enterprise-grade autonomous recruitment platform combining intelligent multi-platform sourcing, zero-junk deterministic & semantic candidate ranking, dual-initial glassmorphic dashboards, contact acquisition intelligence, and statutory **DPDP Act (Digital Personal Data Protection Act)** compliance.

---

## 🚀 Key Highlights & Architectural Pillars

1. **Autonomous Multi-Platform Sourcing (100% Free Tier Default)**:
   - Built-in multi-search connectors (DuckDuckGo, SearXNG, Bing, Google Custom Search API, SerpAPI).
   - Generates and executes 7 autonomous sourcing query variations per role across LinkedIn, GitHub, and Public Resumes.
   - Batch multi-query runner: select individual templates, all, or custom filters.

2. **Zero Dummy Data & Explainable Match Scoring**:
   - Every candidate is scored across 6 dimensions: Must-Have Skills (40%), Nice-To-Have Skills (10%), Experience Years (20%), Location Match (10%), Title Relevance (10%), and Semantic Vector Embedding (10%).
   - Transparent, bullet-by-bullet explainability cards displaying matched skills, missing skills, and exact percentage match.
   - Junk filtering: strictly excludes non-profile junk, directory landing pages, and zero-match noise.

3. **Multi-Source Identity Deduplication & Merging**:
   - Cross-platform matching between LinkedIn, GitHub, and uploaded resumes using fuzzy token algorithms and email matching.
   - Recruiter-controlled identity merge with provenance retention.

4. **Contact Acquisition & Smart Verification**:
   - Multi-provenance contact tracking: `consented`, `public`, `public-snippet`, `enriched`, and `dnc-restricted`.
   - Contact reveal with Hunter and Apollo API integration.
   - Paste-to-Capture raw contact intelligence for immediate regex extraction and validation.

5. **DPDP Act Statutory Compliance & Operations**:
   - **Data Retention Enforcement**: Automated monitoring with 180-day statutory expiry limit.
   - **One-Click Total Erasure (Right to Be Forgotten)**: Cascading permanent deletion across candidates, contacts, resumes, matches, pipeline records, outreach events, and form responses.
   - **Do Not Contact (DNC) Registry**: Instant recruiter toggle that flags candidates and masks all contact points to `dnc-restricted`.
   - **Bulk Retention Purge**: One-click deletion of all expired candidate records.
   - **Immutable Audit Trail**: Append-only audit logger capturing searches, reveals, exports, DNC adjustments, config changes, and erasures.

---

## 📦 System Architecture & Technology Stack

- **Backend**: Python 3.11+, FastAPI, SQLModel (SQLAlchemy ORM + Pydantic v2), SQLite (WAL mode).
- **Frontend**: React 19, Vite, Lucide Icons, Vanilla CSS Glassmorphism Design System.
- **Search Connectors**: DuckDuckGo API (HTML/Lite/Instant fallback), SearXNG, SerpAPI, Google Custom Search.
- **LLM / Embedding Services**: Local Ollama (qwen2.5:7b, llama3.2, mistral), FastEmbed / Sentence-Transformers.

---

## ⚡ Quickstart & One-Click Launch

### Option A: Windows 1-Click Batch Launcher
Double-click `start.bat` in the repository root:
```cmd
start.bat
```
This automatically boots:
- FastAPI Backend on `http://127.0.0.1:8000`
- Vite Development Server on `http://127.0.0.1:5173`
- Opens your default web browser directly to the dashboard.

### Option B: PowerShell Launcher
```powershell
.\start.ps1
```

### Option C: Manual Launch

1. **Activate Virtual Environment & Install Dependencies**:
   ```powershell
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Start Backend Server**:
   ```powershell
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

3. **Start Frontend Client**:
   ```powershell
   cd frontend
   npm install
   npm run dev -- --host 127.0.0.1 --port 5173
   ```

4. **Access the Applications**:
   - Web App UI: [http://127.0.0.1:5173/](http://127.0.0.1:5173/)
   - Interactive OpenAPI Swagger Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 🛡️ DPDP Act Statutory Compliance Workflows

### 1. Data Retention Overview
- Access the **Compliance & Audit** view from the navigation sidebar.
- Inspect total candidates under management, active retention countdowns, expired candidate count, and DNC members.

### 2. Do Not Contact (DNC) Exclusion
- Toggle DNC directly on any candidate card or in the Compliance tab.
- Automatically transitions all contact points into `dnc-restricted`, preventing future outreach drafting or export.

### 3. One-Click Total Erasure (Right to Be Forgotten)
- When requested by a data principal, click **Erase Candidate Data**.
- Triggers deep cascading delete across all related tables:
  - `candidates`
  - `contact_points`
  - `resumes`
  - `candidate_sources`
  - `candidate_links`
  - `matches`
  - `pipeline_statuses`
  - `outreach_events`
  - `form_responses`
- Logs an immutable event in `audit_logs` recording the statutory action, requester, and timestamp while stripping all PII.

---

## 🧪 Comprehensive Verification & Test Suite

TalentScout includes an automated regression test suite covering all 7 phases:

```powershell
# 1. Run Phase 7 Compliance, Operations & Audit Suite (32 tests)
.venv\Scripts\python.exe C:\Users\Admin\.gemini\antigravity-ide\brain\5e8932c6-92f6-4484-8be2-a49e750d3461\scratch\test_phase7.py

# 2. Run Deep QA Regression Test Suite (102 tests)
.venv\Scripts\python.exe C:\Users\Admin\.gemini\antigravity-ide\brain\5e8932c6-92f6-4484-8be2-a49e750d3461\scratch\test_deep_qa.py
```

---

## ⚙️ Dynamic Engine Tuning & System Configuration

Recruiters and admins can tune scoring weights dynamically in **Compliance & Audit > System Settings**:

| Weight Dimension | Default Weight | Description |
| :--- | :--- | :--- |
| **Must-Have Skills** | `40%` | Strict keyword and synonym satisfaction |
| **Nice-To-Have Skills** | `10%` | Bonus technology stack proficiencies |
| **Experience Years** | `20%` | Closeness to min/max required experience |
| **Location Match** | `10%` | Candidate city / remote alignment |
| **Title Relevance** | `10%` | Semantic equivalence of candidate headline |
| **Semantic Embedding** | `10%` | Vector similarity between full JD and profile |

Changes take effect in real-time and are saved in `config/system_settings.json` with an accompanying immutable audit log entry.
