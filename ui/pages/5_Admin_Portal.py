"""TalentScout Administrator, CMS & DPDP Compliance Portal (Streamlit)."""

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
    ROOT_DIR = current_path.parent.parent.parent

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import json
from datetime import datetime, timezone
import streamlit as st
from sqlmodel import Session, select

from app.db import init_db, engine
from app.models.user import User
from app.models.cms import CmsPageContent
from app.models.audit import AuditLog
from app.services.cms_service import CmsService, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_RAW_PASS
from app.services.security_service import SecurityService

init_db()

# Page Setup
st.set_page_config(
    page_title="Admin & CMS Portal | TalentScout",
    page_icon="🛡️",
    layout="wide",
)

# Custom Styling
css_file = ROOT_DIR / "ui" / "styles" / "custom.css"
if css_file.exists():
    with open(css_file, "r", encoding="utf-8") as f:
        st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

# Authentication State
if "auth_user" not in st.session_state:
    st.session_state["auth_user"] = None

user = st.session_state["auth_user"]
is_admin = bool(user and user.get("role") == "admin")

# Top Header Banner
st.markdown(
    """
    <div class="talentscout-hero" style="background: linear-gradient(135deg, rgba(124, 58, 237, 0.2) 0%, rgba(79, 70, 229, 0.1) 100%); border-color: rgba(139, 92, 246, 0.35);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="color: #c4b5fd; margin: 0 0 4px 0;">🛡️ Administrator & CMS Portal</h1>
          <p style="color: #cbd5e1; margin: 0;">Centralized control plane for landing page CMS, user API keys, system telemetry, and DPDP Act statutory compliance.</p>
        </div>
      </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# Gatekeeper: Login if not authenticated as Admin
if not is_admin:
    st.warning("🔐 Administrative Privileges Required. Please authenticate to access the Control Plane.")
    
    col_l1, col_l2, col_l3 = st.columns([1, 2, 1])
    with col_l2:
        with st.container(border=True):
            st.subheader("Administrator Sign-In")
            st.caption("Secured with PBKDF2 100,000-iteration salted hashing & DPDP statutory audit trail.")
            
            admin_email = st.text_input("Administrator Email", value=DEFAULT_ADMIN_EMAIL)
            admin_pass = st.text_input("Master Password", value=DEFAULT_ADMIN_RAW_PASS, type="password")
            
            col_b1, col_b2 = st.columns(2)
            with col_b1:
                if st.button("Authenticate as Admin", type="primary", use_container_width=True):
                    with Session(engine, expire_on_commit=False) as session:
                        admin_user = CmsService.authenticate_admin(admin_email.strip(), admin_pass.strip(), session)
                        if admin_user:
                            st.session_state["auth_user"] = {
                                "id": admin_user.id,
                                "email": admin_user.email,
                                "name": admin_user.full_name,
                                "role": "admin",
                                "company": admin_user.company,
                            }
                            st.success(f"Authenticated as {admin_user.full_name}")
                            st.rerun()
                        else:
                            st.error("Invalid administrator credentials or account disabled.")
            with col_b2:
                if st.button("Auto-Fill Default Root Admin", use_container_width=True):
                    st.rerun()
    st.stop()
    sys.exit(0)

user_name = (user or {}).get('name', 'Admin')
user_email = (user or {}).get('email', '')

# Render Admin Navigation & Logout Button in Sidebar
with st.sidebar:
    st.markdown("### 🛡️ **Admin Session Active**")
    st.write(f"Logged in as: **{user_name}**")
    st.caption(f"{user_email}")
    if st.button("Log Out of Admin Portal", type="secondary"):
        st.session_state["auth_user"] = None
        st.rerun()

# Tabs for Administrator Sub-Systems
tab_telemetry, tab_users, tab_cms, tab_audit = st.tabs([
    "📊 System Telemetry & Health",
    "👥 User Roster & API Keys",
    "📝 Landing Page CMS Editor",
    "🔒 DPDP Audit & Security Logs"
])

# -------------------------------------------------------------
# TAB 1: System Telemetry & Health
# -------------------------------------------------------------
with tab_telemetry:
    st.subheader("📊 Enterprise Telemetry Dashboard")
    with Session(engine, expire_on_commit=False) as session:
        overview = CmsService.get_admin_overview(session)
        stats = overview.get("stats", {})
    
    col1, col2, col3, col4, col5 = st.columns(5)
    with col1:
        st.metric("Total Users", stats.get("total_users", 0), help="Registered recruiters and administrators")
    with col2:
        st.metric("Active Openings", stats.get("active_jobs", 0), help="Live sourcing mandates")
    with col3:
        st.metric("Talent Pool", stats.get("total_candidates", 0), help="Sourced candidate profiles")
    with col4:
        st.metric("Verified Contacts", stats.get("verified_contacts", 0), help="Phone numbers & verified emails")
    with col5:
        st.metric("Audit Events", stats.get("total_audit_events", 0), help="DPDP Act 2023 compliance records")

    st.write("")
    col_h1, col_h2 = st.columns(2)
    with col_h1:
        with st.container(border=True):
            st.markdown("#### ⚡ Infrastructure Status")
            st.markdown("• **Primary Database**: `SQLite (WAL Mode Active)`")
            st.markdown("• **Search Provider**: `DuckDuckGo Live Sourcing Connector`")
            st.markdown("• **Cryptographic Engine**: `PBKDF2-HMAC-SHA256 (100,000 iterations)`")
            st.markdown("• **Threat Shield**: `SQLi Regex Heuristics + Anti-CSRF Tokenizer`")
            st.markdown("• **Email Security**: `Disposable Domain Filter + OTP Verification`")
    
    with col_h2:
        with st.container(border=True):
            st.markdown("#### 📜 Statutory DPDP Act 2023 Compliance")
            st.markdown("• **Data Retention Limit**: `180 Days (Configurable)`")
            st.markdown("• **Candidate PII Protection**: `Direct Verification & Explicit Consent Tracking`")
            st.markdown("• **Right to Erasure**: `Statutory Hard Delete with Tamper-Evident Audit Logging`")
            st.markdown("• **Access Control**: `Role-Based Multi-Tenant Isolation`")

# -------------------------------------------------------------
# TAB 2: User Roster & API Key Manager
# -------------------------------------------------------------
with tab_users:
    st.subheader("👥 User Account & API Key Management")
    st.caption("Track user roles, mobile numbers, company affiliations, and issue dedicated TalentScout API keys.")
    
    with Session(engine, expire_on_commit=False) as session:
        users = session.exec(select(User).order_by(User.created_at.desc())).all()
    
    # Create New User Expandable Form
    with st.expander("➕ Create New Recruiter User Account"):
        with st.form("new_user_form"):
            col_u1, col_u2 = st.columns(2)
            with col_u1:
                new_name = st.text_input("Full Name *", placeholder="e.g. Vikram Malhotra")
                new_email = st.text_input("Work Email Address *", placeholder="e.g. vikram@apexstaffing.in")
                new_role = st.selectbox("Role", ["recruiter", "manager", "admin"])
            with col_u2:
                new_phone = st.text_input("Mobile Number (+91)", placeholder="e.g. +91 98201 54321")
                new_company = st.text_input("Agency / Organization", placeholder="e.g. Apex Staffing Solutions")
                new_password = st.text_input("Initial Password", value="Recruiter#2026!Pass", type="password")
            
            submit_user = st.form_submit_button("Create User & Issue API Key", type="primary")
            if submit_user:
                if not new_email or "@" not in new_email:
                    st.error("Please provide a valid work email.")
                else:
                    try:
                        with Session(engine) as session:
                            created = CmsService.create_user(
                                session=session,
                                user_data={
                                    "email": new_email.strip().lower(),
                                    "full_name": new_name.strip() or new_email.split("@")[0].title(),
                                    "role": new_role,
                                    "phone": new_phone.strip() or "+91 Not Provided",
                                    "company": new_company.strip() or "Staffing Agency",
                                    "password": new_password,
                                },
                                admin_email=(user or {}).get("email", DEFAULT_ADMIN_EMAIL),
                            )
                            st.success(f"User {created['email']} successfully created! Issued API Key: {created['user_api_key']}")
                            st.rerun()
                    except Exception as e:
                        st.error(f"Error creating user: {e}")

    # User Roster Table
    st.write("")
    for u in users:
        with st.container(border=True):
            col_a, col_b, col_c = st.columns([2.5, 2, 1.5])
            with col_a:
                st.markdown(f"**{u.full_name}** ({u.email})")
                st.caption(f"Role: `{u.role.upper()}` • Organization: {u.company} • Phone: {u.phone or 'Not Provided'}")
                st.code(f"API Key: {u.user_api_key or 'None issued'}", language="text")
            
            with col_b:
                created_str = u.created_at.strftime("%d %b %Y, %H:%M") if u.created_at else "N/A"
                last_login_str = u.last_login_at.strftime("%d %b %Y, %H:%M") if u.last_login_at else "Never"
                st.caption(f"Registered: {created_str}")
                st.caption(f"Last Login: {last_login_str}")
                status_color = "green" if u.is_active else "red"
                st.markdown(f"Status: <span style='color:{status_color}; font-weight:bold;'>{'Active' if u.is_active else 'Disabled'}</span>", unsafe_allow_html=True)

            with col_c:
                col_btn1, col_btn2 = st.columns(2)
                with col_btn1:
                    if st.button("🔑 New Key", key=f"regen_{u.id}", help="Regenerate TalentScout API Key"):
                        with Session(engine) as session:
                            new_key = CmsService.regenerate_user_api_key(session, u.id, (user or {}).get("email", DEFAULT_ADMIN_EMAIL))
                            st.toast(f"New API Key issued for {u.full_name}: {new_key}", icon="🔑")
                            st.rerun()
                with col_btn2:
                    if u.email != DEFAULT_ADMIN_EMAIL:
                        btn_label = "Disable" if u.is_active else "Enable"
                        if st.button(btn_label, key=f"toggle_{u.id}"):
                            with Session(engine) as session:
                                db_u = session.get(User, u.id)
                                if db_u:
                                    db_u.is_active = not db_u.is_active
                                    session.add(db_u)
                                    session.commit()
                                    st.rerun()

# -------------------------------------------------------------
# TAB 3: Landing Page CMS Editor
# -------------------------------------------------------------
with tab_cms:
    st.subheader("📝 Dynamic Landing Page CMS Editor")
    st.caption("Update public landing page headlines, hero banners, statistics, and messaging in real-time.")
    
    with Session(engine, expire_on_commit=False) as session:
        cms_data = CmsService.get_cms_content(session)
    
    with st.form("cms_edit_form"):
        col_c1, col_c2 = st.columns(2)
        with col_c1:
            hero_badge = st.text_input("Hero Pill Badge", value=cms_data.get("hero_badge", "Autonomous Talent Intelligence Engine • India 2026"))
            hero_title = st.text_input("Hero Main Headline", value=cms_data.get("hero_title", "Source Top 1% Verified Indian Talent at Lightning Speed"))
            hero_subtitle = st.text_area("Hero Sub-headline", value=cms_data.get("hero_subtitle", "Local-first recruitment intelligence for high-velocity Indian staffing agencies."), height=100)
        
        with col_c2:
            cta_primary = st.text_input("Primary CTA Button Text", value=cms_data.get("cta_primary_text", "Start Sourcing Now"))
            cta_secondary = st.text_input("Secondary CTA Button Text", value=cms_data.get("cta_secondary_text", "Explore Live Demo"))
            compliance_badge = st.text_input("Compliance Footnote Badge", value=cms_data.get("compliance_badge", "DPDP Act 2023 Compliant • Zero Web Scraping • Enterprise Security"))
        
        save_cms = st.form_submit_button("Publish Landing Page Updates", type="primary")
        if save_cms:
            with Session(engine) as session:
                updated = CmsService.update_cms_content(
                    content={
                        "hero_badge": hero_badge,
                        "hero_title": hero_title,
                        "hero_subtitle": hero_subtitle,
                        "cta_primary_text": cta_primary,
                        "cta_secondary_text": cta_secondary,
                        "compliance_badge": compliance_badge,
                    },
                    session=session,
                    admin_email=(user or {}).get("email", DEFAULT_ADMIN_EMAIL),
                )
                st.success("Landing Page CMS content successfully updated & published live!")
                st.rerun()

# -------------------------------------------------------------
# TAB 4: DPDP Audit & Security Logs
# -------------------------------------------------------------
with tab_audit:
    st.subheader("🔒 DPDP Act 2023 Statutory Audit Trail")
    st.caption("Tamper-evident logs of administrative actions, user authentication, and data modifications.")
    
    with Session(engine, expire_on_commit=False) as session:
        logs = session.exec(select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(50)).all()
    
    if not logs:
        st.info("No audit logs recorded yet. User creations, updates, and compliance events will appear here.")
    else:
        log_rows = []
        for l in logs:
            log_rows.append({
                "Timestamp": l.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC") if l.timestamp else "N/A",
                "Action": l.action,
                "Entity": f"{l.entity_type} ({l.entity_id or 'Global'})",
                "Performer": l.actor or "System",
                "Details": l.details or "N/A"
            })
        st.dataframe(log_rows, use_container_width=True)
