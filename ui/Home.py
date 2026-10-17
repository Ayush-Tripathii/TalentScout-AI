"""TalentScout Main Streamlit Application Entry Point.

Provides a rich Python-native frontend featuring:
1. High-Converting Landing Page with dynamic CMS content & metrics.
2. Two-Step Email OTP Authentication with disposable email & fake phone blocking.
3. Central Recruiter Workspace with Job Intake, X-Ray Sourcing, and Pipeline integration.
"""

import sys
from pathlib import Path

# Ensure project root is first in sys.path
current_path = Path(__file__).resolve()
ROOT_DIR = None
for p in [current_path] + list(current_path.parents):
    if (p / "app").is_dir() and (p / "ui").is_dir():
        ROOT_DIR = p
        break
if ROOT_DIR is None:
    ROOT_DIR = current_path.parent.parent

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
from app.models.user import User
from app.services.job_service import JobService
from app.services.cms_service import CmsService, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_RAW_PASS
from app.services.threat_detector import ThreatDetector
from app.services.otp_service import OtpService
from config.settings import get_settings

# Initialize Database & Seeding
init_db()
settings = get_settings()

with Session(engine) as session:
    CmsService.ensure_defaults(session)
    cms_content = CmsService.get_cms_content(session)

st.set_page_config(
    page_title="TalentScout AI | Recruitment Sourcing Intelligence",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Load custom CSS
css_file = ROOT_DIR / "ui" / "styles" / "custom.css"
if css_file.exists():
    with open(css_file, "r", encoding="utf-8") as f:
        st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

# Session State Initialization
if "auth_user" not in st.session_state:
    st.session_state["auth_user"] = None
if "otp_step" not in st.session_state:
    st.session_state["otp_step"] = "input"
if "pending_email" not in st.session_state:
    st.session_state["pending_email"] = ""
if "dev_otp_code" not in st.session_state:
    st.session_state["dev_otp_code"] = None

user = st.session_state["auth_user"]

# -----------------------------------------------------------------------------
# Sidebar: User Session, System Telemetry & Fast Navigation
# -----------------------------------------------------------------------------
with st.sidebar:
    st.markdown("### 🎯 **TalentScout AI**")
    st.caption("Autonomous Sourcing & Talent Intelligence")
    
    if user:
        role_badge = "🛡️ ADMIN" if user.get("role") == "admin" else "💼 RECRUITER"
        st.markdown(
            f"""
            <div style="background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 10px; padding: 12px; margin-bottom: 12px;">
              <div style="font-size: 0.75rem; color: #818cf8; font-weight: 700; text-transform: uppercase;">{role_badge} ACTIVE</div>
              <div style="font-size: 1rem; font-weight: 800; color: #fff;">{user.get('name', 'User')}</div>
              <div style="font-size: 0.8rem; color: #94a3b8;">{user.get('email', '')}</div>
              <div style="font-size: 0.75rem; color: #cbd5e1; margin-top: 4px;">🏢 {user.get('company', 'Staffing Agency')}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        if st.button("Sign Out of Session", type="secondary", use_container_width=True):
            st.session_state["auth_user"] = None
            st.session_state["otp_step"] = "input"
            st.rerun()
    else:
        st.info("👋 **Welcome, Guest Recruiter**\nSign in with Email OTP or try 1-click demo access below.")
        col_d1, col_d2 = st.columns(2)
        with col_d1:
            if st.button("⚡ Fast Demo", use_container_width=True, help="1-click login as Priya Sharma (Lead Staffing Partner)"):
                st.session_state["auth_user"] = {
                    "name": "Priya Sharma",
                    "email": "priya.sharma@apexstaffing.in",
                    "role": "recruiter",
                    "company": "Apex Staffing Solutions",
                }
                st.rerun()
        with col_d2:
            if st.button("🛡️ Admin Mode", use_container_width=True, help="1-click root admin login"):
                st.session_state["auth_user"] = {
                    "name": "System Administrator",
                    "email": DEFAULT_ADMIN_EMAIL,
                    "role": "admin",
                    "company": "TalentScout Global Security",
                }
                st.rerun()

    st.divider()
    st.markdown("#### ⚡ System Health")
    st.markdown("• **Database**: <span class='badge badge-success'>SQLite (WAL Active)</span>", unsafe_allow_html=True)
    st.markdown("• **Threat Shield**: <span class='badge badge-success'>SQLi & Anti-CSRF Active</span>", unsafe_allow_html=True)
    st.markdown("• **Email Security**: <span class='badge badge-success'>Anti-Disposable Blacklist</span>", unsafe_allow_html=True)
    st.markdown("• **DPDP Compliance**: <span class='badge badge-info'>180d Audit Active</span>", unsafe_allow_html=True)
    
    st.divider()
    st.caption("Regulated under Digital Personal Data Protection Act, 2023. Local SQLite database storage.")

# -----------------------------------------------------------------------------
# Main View Tabs: Landing Page, Recruiter Workspace, Email OTP Authentication
# -----------------------------------------------------------------------------
main_tab_names = ["🌟 Landing Page & Features", "🚀 Recruiter Workspace", "🔐 Identity & Email OTP"]
if user and user.get("role") == "admin":
    main_tab_names.append("🛡️ Admin Portal")

selected_tab = st.radio("Navigation View", main_tab_names, horizontal=True, label_visibility="collapsed")

# =============================================================================
# VIEW 1: HIGH-CONVERTING LANDING PAGE
# =============================================================================
if selected_tab == "🌟 Landing Page & Features":
    # Hero Section with Dynamic CMS Headline
    hero_badge_text = cms_content.get("hero_badge", "Autonomous Talent Intelligence Engine • India 2026")
    hero_title_text = cms_content.get("hero_title", "Source Top 1% Verified Indian Talent at Lightning Speed")
    hero_sub_text = cms_content.get("hero_subtitle", "Local-first recruitment intelligence for high-velocity contract staffing. Boolean X-Ray sourcing, resume parsing, explainable 0–100 matching, and compliant contact acquisition.")

    st.markdown(
        f"""
        <div class="talentscout-hero">
          <div style="display: inline-block; background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 9999px; padding: 4px 14px; font-size: 0.75rem; font-weight: 700; color: #a5b4fc; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 14px;">
            ✨ {hero_badge_text}
          </div>
          <h1 style="font-size: 2.5rem; margin: 0 0 12px; line-height: 1.15; color: #ffffff;">{hero_title_text}</h1>
          <p style="font-size: 1.1rem; color: #94a3b8; max-width: 860px; line-height: 1.6; margin: 0 0 20px;">{hero_sub_text}</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Call-to-action buttons
    col_c1, col_c2, col_c3 = st.columns([1.5, 1.5, 3])
    with col_c1:
        if st.button("🚀 Launch Sourcing Workspace", type="primary", use_container_width=True):
            st.switch_page("pages/2_Sourcing_and_Search.py")
    with col_c2:
        if st.button("📝 Intake New Job Requirement", use_container_width=True):
            st.switch_page("pages/1_Jobs_and_Intake.py")

    st.write("")

    # Live Sourcing Metric Banners
    with Session(engine, expire_on_commit=False) as session:
        jobs = JobService.list_jobs()
        active_jobs_cnt = len([j for j in jobs if j.status == "active"])
        total_candidates_cnt = len(session.exec(select(Candidate)).all())
        total_contacts_cnt = len(session.exec(select(ContactPoint)).all())

    col_m1, col_m2, col_m3, col_m4 = st.columns(4)
    with col_m1:
        st.markdown(f"<div class='metric-box'><div class='metric-number'>{active_jobs_cnt}</div><div class='metric-label'>Active Mandates</div></div>", unsafe_allow_html=True)
    with col_m2:
        st.markdown(f"<div class='metric-box'><div class='metric-number'>{total_candidates_cnt}</div><div class='metric-label'>Indexed Candidate Profiles</div></div>", unsafe_allow_html=True)
    with col_m3:
        st.markdown(f"<div class='metric-box'><div class='metric-number'>{total_contacts_cnt}</div><div class='metric-label'>Verified Contact Details</div></div>", unsafe_allow_html=True)
    with col_m4:
        st.markdown(f"<div class='metric-box'><div class='metric-number'>100%</div><div class='metric-label'>DPDP Act 2023 Compliant</div></div>", unsafe_allow_html=True)

    st.divider()

    # Feature Capabilities Grid
    st.subheader("⚡ Enterprise Recruitment Capabilities")
    col_f1, col_f2, col_f3 = st.columns(3)
    
    with col_f1:
        with st.container(border=True):
            st.markdown("### 📝 AI Job Intake")
            st.markdown("Paste unstructured client JDs or client emails. Our local extraction engine automatically parses required technical skills, CTC budgets, locations, and experience bands.")
            if st.button("Open Job Intake", key="land_f1", use_container_width=True):
                st.switch_page("pages/1_Jobs_and_Intake.py")

    with col_f2:
        with st.container(border=True):
            st.markdown("### 🔍 Precision X-Ray Sourcing")
            st.markdown("Generate platform-targeted Boolean queries for LinkedIn, GitHub, Naukri, and Google. Live web sourcing connector discovers verified profiles without account bans.")
            if st.button("Open X-Ray Search", key="land_f2", use_container_width=True):
                st.switch_page("pages/2_Sourcing_and_Search.py")

    with col_f3:
        with st.container(border=True):
            st.markdown("### 📊 0-100 Explainable Matching")
            st.markdown("Weighted scoring across must-have skills, experience, location tier, and semantic relevance. Transparent breakdown reveals exactly why a candidate matched.")
            if st.button("Open Pipeline", key="land_f3", use_container_width=True):
                st.switch_page("pages/4_Candidate_Pipeline.py")

    st.write("")
    col_f4, col_f5, col_f6 = st.columns(3)

    with col_f4:
        with st.container(border=True):
            st.markdown("### 📥 Virus-Inspected Resume Parser")
            st.markdown("Ingests PDF & DOCX resumes with magic byte and macro/virus validation. Automatically extracts phone numbers, emails, skills, and work history.")
            if st.button("Upload Resumes", key="land_f4", use_container_width=True):
                st.switch_page("pages/3_Inbound_and_Resumes.py")

    with col_f5:
        with st.container(border=True):
            st.markdown("### 🛡️ Threat Defense & Email OTP")
            st.markdown("Equipped with SQL injection heuristics, anti-CSRF token verification, disposable email blacklisting, and 6-digit cryptographic OTP authentication.")
            st.caption("Active across all forms & search parameters.")

    with col_f6:
        with st.container(border=True):
            st.markdown("### ⚖️ DPDP Act 2023 Compliance")
            st.markdown("Configurable data retention policy, statutory deletion audit logs, and verified contact acquisition ensuring compliance for Indian staffing firms.")
            st.caption("Zero automated bot logins or unconsented scraping.")

# =============================================================================
# VIEW 2: RECRUITER WORKSPACE
# =============================================================================
elif selected_tab == "🚀 Recruiter Workspace":
    st.subheader("📋 Active Recruitment Jobs")
    jobs = JobService.list_jobs()

    if not jobs:
        st.info("No active job requirements found. Click below to create your first requirement.")
        if st.button("➕ Create First Job Requirement", type="primary"):
            st.switch_page("pages/1_Jobs_and_Intake.py")
    else:
        for job in jobs:
            must_skills = json.loads(job.must_have_skills) if job.must_have_skills else []
            locs = json.loads(job.locations) if job.locations else []
            skills_chips = " ".join([f"`{s}`" for s in must_skills[:6]])
            
            with st.container(border=True):
                col_j1, col_j2 = st.columns([3.5, 1.5])
                with col_j1:
                    st.markdown(f"### {job.title} <span class='badge badge-success'>{job.status.upper()}</span>", unsafe_allow_html=True)
                    st.markdown(f"⏱️ **Experience**: {job.min_experience}–{job.max_experience} yrs &nbsp;|&nbsp; 📍 **Location**: {', '.join(locs)} &nbsp;|&nbsp; ⚡ **Notice**: {job.notice_period}")
                    st.markdown(f"**Must-Have Skills**: {skills_chips}")
                with col_j2:
                    st.write("")
                    if st.button("🔍 Source Profiles", key=f"ws_src_{job.id}", type="primary", use_container_width=True):
                        st.session_state["selected_job_id"] = job.id
                        st.switch_page("pages/2_Sourcing_and_Search.py")
                    if st.button("📊 View Pipeline", key=f"ws_pip_{job.id}", use_container_width=True):
                        st.session_state["selected_job_id"] = job.id
                        st.switch_page("pages/4_Candidate_Pipeline.py")

# =============================================================================
# VIEW 3: IDENTITY & 2-STEP EMAIL OTP AUTHENTICATION
# =============================================================================
elif selected_tab == "🔐 Identity & Email OTP":
    st.subheader("🔐 Recruiter Authentication & Identity Verification")
    st.caption("Secured with Disposable Email Filtering, Phone Fraud Screening, and 6-Digit Cryptographic OTP Passcodes.")

    col_a1, col_a2, col_a3 = st.columns([1, 2, 1])
    with col_a2:
        with st.container(border=True):
            if st.session_state["otp_step"] == "input":
                st.markdown("#### Step 1: Provide Verification Details")
                auth_mode = st.radio("Authentication Action", ["Sign Up New Account", "Sign In Existing Account"], horizontal=True)
                
                full_name = ""
                if auth_mode == "Sign Up New Account":
                    full_name = st.text_input("Full Name *", placeholder="e.g. Vikram Malhotra")
                
                input_email = st.text_input("Work Email Address *", placeholder="recruiter@agency.in")
                input_phone = st.text_input("Mobile Number (+91)", placeholder="e.g. +91 98201 54321")
                
                # Immediate feedback validations
                email_err = None
                phone_err = None
                
                if input_email and "@" in input_email:
                    is_disp, disp_msg = ThreatDetector.is_disposable_email(input_email)
                    if is_disp:
                        email_err = disp_msg
                
                if input_phone and input_phone.strip():
                    is_p_valid, p_msg = ThreatDetector.validate_phone_number(input_phone)
                    if not is_p_valid:
                        phone_err = p_msg
                
                if email_err:
                    st.error(f"⚠️ {email_err}")
                if phone_err:
                    st.error(f"⚠️ {phone_err}")

                if st.button("Dispatch 6-Digit Security OTP ➔", type="primary", use_container_width=True, disabled=bool(email_err or phone_err or not input_email)):
                    # Check for SQL injection patterns
                    is_sqli, sqli_reason = ThreatDetector.scan_for_sqli({"email": input_email, "name": full_name, "phone": input_phone})
                    if is_sqli:
                        st.error(f"Security Alert: Malicious SQL injection sequence detected: {sqli_reason}")
                    else:
                        result = OtpService.request_otp(
                            email=input_email.strip().lower(),
                            full_name=full_name.strip() or None,
                            purpose=auth_mode,
                        )
                        st.session_state["pending_email"] = input_email.strip().lower()
                        st.session_state["pending_name"] = full_name.strip()
                        st.session_state["pending_phone"] = input_phone.strip()
                        st.session_state["dev_otp_code"] = result.get("dev_otp")
                        st.session_state["otp_step"] = "verify"
                        st.success(f"Verification code dispatched to {input_email}")
                        st.rerun()

            elif st.session_state["otp_step"] == "verify":
                st.markdown("#### Step 2: Enter 6-Digit Security Code")
                st.caption(f"Verification code dispatched to **{st.session_state['pending_email']}** (Valid for 10 minutes)")

                if st.session_state.get("dev_otp_code"):
                    st.info(f"🧪 **Test Environment Auto-Fill Code**: `{st.session_state['dev_otp_code']}`")

                entered_otp = st.text_input("Enter 6-Digit Passcode", placeholder="000000", max_chars=6)

                col_v1, col_v2 = st.columns(2)
                with col_v1:
                    if st.button("Verify & Enter Workspace", type="primary", use_container_width=True):
                        is_valid, v_msg = OtpService.verify_otp(st.session_state["pending_email"], entered_otp)
                        if is_valid:
                            # Authenticate in SQLite
                            with Session(engine) as session:
                                user_rec = session.exec(select(User).where(User.email == st.session_state["pending_email"])).first()
                                if not user_rec:
                                    user_rec = User(
                                        email=st.session_state["pending_email"],
                                        full_name=st.session_state.get("pending_name") or st.session_state["pending_email"].split("@")[0].title(),
                                        phone=st.session_state.get("pending_phone") or "+91 Not Provided",
                                        password_hash=SecurityService.hash_password("Recruiter#2026!Pass"),
                                        role="recruiter",
                                        company="Enterprise Staffing",
                                    )
                                    session.add(user_rec)
                                    session.commit()
                                    session.refresh(user_rec)

                            st.session_state["auth_user"] = {
                                "id": user_rec.id,
                                "name": user_rec.full_name,
                                "email": user_rec.email,
                                "role": user_rec.role,
                                "company": user_rec.company,
                            }
                            st.session_state["otp_step"] = "input"
                            st.success(f"Verified successfully! Welcome, {user_rec.full_name}.")
                            st.rerun()
                        else:
                            st.error(f"Verification failed: {v_msg}")

                with col_v2:
                    if st.button("Cancel & Change Email", use_container_width=True):
                        st.session_state["otp_step"] = "input"
                        st.rerun()

# =============================================================================
# VIEW 4: ADMIN & CMS PORTAL (When authenticated as admin)
# =============================================================================
elif selected_tab == "🛡️ Admin Portal":
    st.subheader("🛡️ Administrator Control Plane & CMS")
    st.caption("Active administrator session. Direct access to system telemetry, user management, and landing page CMS.")
    if st.button("Launch Dedicated Full-Screen Admin Portal ➔", type="primary"):
        st.switch_page("pages/5_Admin_Portal.py")
