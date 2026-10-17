"""TalentScout Main Streamlit Application Entry Point."""

import sys
from pathlib import Path

# Ensure project root is first in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import json
import textwrap
import streamlit as st
import httpx
from sqlmodel import Session, select
from app.db import init_db, engine
from app.models.candidate import Candidate, ContactPoint, CandidateSource
from app.models.match import Match
from app.services.job_service import JobService
from config.settings import get_settings

# Initialize DB on start
init_db()
settings = get_settings()

st.set_page_config(
    page_title="TalentScout | Recruitment Sourcing Intelligence",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Load custom CSS
css_file = Path(__file__).resolve().parent / "styles" / "custom.css"
if css_file.exists():
    with open(css_file, "r", encoding="utf-8") as f:
        st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)


def check_service_status():
    """Check connectivity to Ollama and SearXNG."""
    ollama_online = False
    searxng_online = False
    try:
        r = httpx.get(f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/tags", timeout=0.8)
        ollama_online = (r.status_code == 200)
    except Exception:
        ollama_online = False

    try:
        r = httpx.get(f"{settings.SEARXNG_URL.rstrip('/')}/", timeout=0.8)
        searxng_online = (r.status_code in [200, 302])
    except Exception:
        searxng_online = False

    return ollama_online, searxng_online


ollama_ok, searxng_ok = check_service_status()

# Sidebar Navigation and Branding
with st.sidebar:
    st.markdown("### 🎯 **TalentScout**")
    st.caption("Contract-Staffing Sourcing Intelligence (India)")
    st.divider()

    st.markdown("#### ⚡ System Health")
    st.markdown("**Database:** <span class='badge badge-success'>SQLite (Active)</span>", unsafe_allow_html=True)
    if ollama_ok:
        st.markdown(f"**LLM:** <span class='badge badge-success'>Ollama Online ({settings.OLLAMA_MODEL})</span>", unsafe_allow_html=True)
    else:
        st.markdown("**LLM:** <span class='badge badge-warning'>Rule-Based Fallback</span>", unsafe_allow_html=True)

    if searxng_ok:
        st.markdown("**Search Engine:** <span class='badge badge-success'>SearXNG Connected</span>", unsafe_allow_html=True)
    else:
        st.markdown("**Search Engine:** <span class='badge badge-info'>SearXNG Standby / Live</span>", unsafe_allow_html=True)

    st.divider()
    st.markdown("🔒 **100% Free & DPDP Compliant**")
    st.caption("Zero automated logins or web scraping. All candidate data stored strictly on this local machine.")

# Hero Header
st.markdown(
    """
    <div class="talentscout-hero">
      <h1>TalentScout</h1>
      <p>Local-first recruitment intelligence for Indian staffing: Boolean X-Ray sourcing, resume parsing, explainable 0–100 matching, and compliant contact acquisition.</p>
    </div>
    """,
    unsafe_allow_html=True,
)

# High-Level KPI Metrics
jobs = JobService.list_jobs()
active_jobs = [j for j in jobs if j.status == "active"]

with Session(engine, expire_on_commit=False) as session:
    total_candidates_count = len(session.exec(select(Candidate)).all())
    total_contacts_count = len(session.exec(select(ContactPoint)).all())

col1, col2, col3, col4 = st.columns(4)
with col1:
    st.markdown(f"<div class='metric-box'><div class='metric-number'>{len(active_jobs)}</div><div class='metric-label'>Active Job Openings</div></div>", unsafe_allow_html=True)
with col2:
    st.markdown(f"<div class='metric-box'><div class='metric-number'>{total_candidates_count}</div><div class='metric-label'>Sourced Profiles</div></div>", unsafe_allow_html=True)
with col3:
    st.markdown(f"<div class='metric-box'><div class='metric-number'>{total_contacts_count}</div><div class='metric-label'>Verified Contacts</div></div>", unsafe_allow_html=True)
with col4:
    st.markdown(f"<div class='metric-box'><div class='metric-number'>{settings.RETENTION_DAYS}d</div><div class='metric-label'>DPDP Retention</div></div>", unsafe_allow_html=True)

st.write("")

# Quick Workflow Navigation Cards
st.subheader("🚀 Recruiter Sourcing Workflow")
col_w1, col_w2, col_w3, col_w4 = st.columns(4)

with col_w1:
    st.markdown(
        """
        <div class="feature-card">
          <div>
            <div class="feature-icon">📝</div>
            <div class="feature-title">1. Job Intake</div>
            <div class="feature-desc">Structure job requirements manually or extract must-haves & budgets from raw JDs using local AI.</div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    if st.button("Open Job Intake ➔", key="btn_nav_intake", use_container_width=True):
        st.switch_page("pages/1_Jobs_and_Intake.py")

with col_w2:
    st.markdown(
        """
        <div class="feature-card">
          <div>
            <div class="feature-icon">🔍</div>
            <div class="feature-title">2. X-Ray Sourcing</div>
            <div class="feature-desc">Generate precision Boolean queries for LinkedIn, GitHub, Naukri, & execute compliant searches.</div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    if st.button("Launch Sourcing ➔", key="btn_nav_sourcing", use_container_width=True):
        st.switch_page("pages/2_Sourcing_and_Search.py")

with col_w3:
    st.markdown(
        """
        <div class="feature-card">
          <div>
            <div class="feature-icon">📥</div>
            <div class="feature-title">3. Inbound Resumes</div>
            <div class="feature-desc">Ingest applicant PDFs/DOCXs, monitor watch folders, and auto-parse skills & contact points.</div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    if st.button("Upload Resumes ➔", key="btn_nav_resumes", use_container_width=True):
        st.switch_page("pages/3_Inbound_and_Resumes.py")

with col_w4:
    st.markdown(
        """
        <div class="feature-card">
          <div>
            <div class="feature-icon">📊</div>
            <div class="feature-title">4. Pipeline & Ranking</div>
            <div class="feature-desc">Review 0–100 explainable rankings, manage candidate pipeline stages, and export to Excel/CSV.</div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    if st.button("View Pipeline ➔", key="btn_nav_pipeline", use_container_width=True, type="primary"):
        st.switch_page("pages/4_Candidate_Pipeline.py")

st.divider()

# Active Recruitment Jobs Section
st.subheader("📋 Active Job Requirements")

if not jobs:
    st.info("No job requirements created yet. Click below to create your first job.")
    if st.button("➕ Create First Job Requirement", type="primary"):
        st.switch_page("pages/1_Jobs_and_Intake.py")
else:
    for job in jobs:
        must_skills = json.loads(job.must_have_skills) if job.must_have_skills else []
        locs = json.loads(job.locations) if job.locations else []
        skills_chips = "".join([f"<span class='badge' style='background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1);'>✓ {s}</span>" for s in must_skills[:5]])
        remote_badge = "<span class='badge badge-info'>Remote</span>" if job.is_remote else ""
        ctc_badge = f"<span class='badge badge-warning'>💰 {job.min_ctc}–{job.max_ctc} LPA</span>" if job.max_ctc else ""
        client_line = f"<div style='font-size: 0.82rem; color: #64748b; margin-top: 4px;'>Client: {job.client_name}</div>" if job.client_name else ""

        with st.container():
            st.markdown(
                textwrap.dedent(
                    f"""
                    <div class="ts-card">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
                        <div style="flex: 1;">
                          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                            <h3 style="margin: 0; color: #f8fafc; font-size: 1.25rem;">{job.title}</h3>
                            <span class="badge {'badge-success' if job.status == 'active' else 'badge-warning'}">{job.status.upper()}</span>
                            {remote_badge}
                          </div>
                          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                            <span class="badge badge-primary">⏱️ {job.min_experience}–{job.max_experience} Yrs Exp</span>
                            <span class="badge badge-info">⚡ {job.notice_period}</span>
                            <span class="badge badge-success">📍 {', '.join(locs)}</span>
                            {ctc_badge}
                          </div>
                          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            {skills_chips}
                          </div>
                        </div>
                        <div style="text-align: right; min-width: 140px;">
                          <div style="font-size: 0.88rem; color: #94a3b8;">Openings: <strong>{job.positions_count}</strong></div>
                          {client_line}
                        </div>
                      </div>
                    </div>
                    """
                ),
                unsafe_allow_html=True,
            )
            col_b1, col_b2, col_b3, col_b4 = st.columns([1.5, 1.5, 1.2, 3])
            with col_b1:
                if st.button("🔍 Source Profiles", key=f"src_hm_{job.id}", type="primary", use_container_width=True):
                    st.session_state["selected_job_id"] = job.id
                    st.switch_page("pages/2_Sourcing_and_Search.py")
            with col_b2:
                if st.button("📊 View Pipeline", key=f"pip_hm_{job.id}", use_container_width=True):
                    st.session_state["selected_job_id"] = job.id
                    st.switch_page("pages/4_Candidate_Pipeline.py")
            with col_b3:
                if st.button("📋 Duplicate", key=f"dup_hm_{job.id}", use_container_width=True):
                    JobService.duplicate_job(job.id)
                    st.rerun()
            with col_b4:
                if job.status == "active":
                    if st.button("🔒 Close Job", key=f"cls_hm_{job.id}"):
                        JobService.close_job(job.id)
                        st.rerun()

st.divider()

# Recent Sourced Candidates Preview
with Session(engine, expire_on_commit=False) as session:
    recent_cands = session.exec(select(Candidate).order_by(Candidate.created_at.desc())).all()[:5]

if recent_cands:
    st.subheader("👥 Recently Sourced Candidate Profiles")
    for rc in recent_cands:
        with Session(engine, expire_on_commit=False) as session:
            sources = session.exec(select(CandidateSource).where(CandidateSource.candidate_id == rc.id)).all()
            contacts = session.exec(select(ContactPoint).where(ContactPoint.candidate_id == rc.id)).all()
            primary_src = sources[0] if sources else None
            emails = [c.value for c in contacts if c.kind == "email"]
            phones = [c.value for c in contacts if c.kind == "phone"]

            plat_badge = f"<span class='badge badge-primary'>{primary_src.platform.upper()}</span>" if primary_src else ""
            email_badge = f"<span class='badge badge-success'>✉️ {emails[0]}</span>" if emails else "<span class='badge' style='background: rgba(255,255,255,0.04); color: #64748b; border: 1px solid rgba(255,255,255,0.08);'>✉️ Email: —</span>"
            phone_badge = f"<span class='badge badge-success'>📞 {phones[0]}</span>" if phones else "<span class='badge' style='background: rgba(255,255,255,0.04); color: #64748b; border: 1px solid rgba(255,255,255,0.08);'>📞 Phone: —</span>"
            profile_link = f"<a href='{primary_src.url}' target='_blank' style='text-decoration: none;'><span class='badge badge-primary'>🔗 Profile</span></a>" if primary_src else ""

        with st.container():
            st.markdown(
                textwrap.dedent(
                    f"""
                    <div class="ts-card" style="padding: 16px 20px; margin-bottom: 12px;">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <strong style="font-size: 1.05rem; color: #f8fafc;">{rc.full_name}</strong>
                            <span class="badge badge-info">📍 {rc.current_location or 'India'}</span>
                            {plat_badge}
                          </div>
                          <div style="font-size: 0.9rem; color: #94a3b8; margin-top: 4px;">{rc.headline or 'Software Professional'}</div>
                        </div>
                        <div style="display: flex; gap: 10px; align-items: center;">
                          {email_badge}
                          {phone_badge}
                          {profile_link}
                        </div>
                      </div>
                    </div>
                    """
                ),
                unsafe_allow_html=True,
            )
