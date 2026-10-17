"""Sourcing & Search Console Page."""

import sys
from pathlib import Path

# Ensure project root is first in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import json
import textwrap
import streamlit as st
from app.services.job_service import JobService
from app.services.sourcing_service import SourcingService
from ui.components.header import render_workflow_header

st.set_page_config(page_title="Sourcing Console | TalentScout", page_icon="🔍", layout="wide")

# Custom CSS
css_file = Path(__file__).resolve().parent.parent / "styles" / "custom.css"
if css_file.exists():
    with open(css_file, "r", encoding="utf-8") as f:
        st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

# Top Workflow Navigator
render_workflow_header(current_page=2)

sourcing_service = SourcingService()

st.title("🔍 Sourcing & Search Console")
st.caption("Generate targeted Boolean X-ray queries, execute public searches, and discover candidates with compliant snippet contacts.")

# Active Job Context Check
selected_job_id = st.session_state.get("selected_job_id")
active_job = JobService.get_job(selected_job_id) if selected_job_id else None

if not active_job:
    jobs = JobService.list_jobs(status="active")
    if not jobs:
        st.warning("No active jobs found. Please create a job first in **Jobs and Intake**.")
        if st.button("➕ Create Job Requirement", type="primary"):
            st.switch_page("pages/1_Jobs_and_Intake.py")
        st.stop()
    active_job = jobs[0]
    st.session_state["selected_job_id"] = active_job.id
    selected_job_id = active_job.id

# Query Generation Controls
col_ctrl1, col_ctrl2 = st.columns([3, 1])
with col_ctrl1:
    contact_visible = st.toggle(
        "⚡ Target Contact-Visible Profiles (adds email/phone marker queries)",
        value=st.session_state.get("contact_visible_toggle", False),
        help="Appends search operators like ('gmail.com' OR '+91') to prioritize profiles with published contact info in snippets.",
        key="toggle_contact_vis",
    )
    st.session_state["contact_visible_toggle"] = contact_visible

with col_ctrl2:
    if st.button("🔄 Regenerate Queries", use_container_width=True):
        st.session_state["queries"] = sourcing_service.generate_job_queries(selected_job_id, contact_visible)
        st.rerun()

# Cache generated queries in session state
if "queries" not in st.session_state or st.session_state.get("last_queried_job") != selected_job_id:
    st.session_state["queries"] = sourcing_service.generate_job_queries(selected_job_id, contact_visible)
    st.session_state["last_queried_job"] = selected_job_id

queries = st.session_state.get("queries", [])

st.markdown("### 📋 Generated Boolean X-Ray Queries")
st.caption("Review, customize, and choose which platform queries to run.")

selected_queries_to_run = []
for i, q in enumerate(queries):
    plat_lower = q["platform"].lower()
    badge_class = "badge-linkedin" if plat_lower == "linkedin" else "badge-github" if plat_lower == "github" else "badge-naukri" if plat_lower == "naukri" else "badge-primary"

    col_chk, col_plat, col_txt, col_run = st.columns([0.4, 1.3, 5.3, 1.0])
    with col_chk:
        is_checked = st.checkbox(f"Select query {i+1}", value=True, key=f"chk_q_{i}", label_visibility="collapsed")
    with col_plat:
        st.markdown(f"<span class='badge {badge_class}' style='margin-top: 6px;'>{q['platform'].upper()}</span>", unsafe_allow_html=True)
    with col_txt:
        edited_q = st.text_input(
            f"Query {i+1}",
            value=q["query"],
            key=f"txt_q_{i}",
            label_visibility="collapsed",
            help=q.get("description", ""),
        )
    with col_run:
        if st.button("▶ Run", key=f"btn_run_{i}", use_container_width=True):
            with st.spinner(f"Searching {q['platform']}..."):
                found = sourcing_service.execute_query(selected_job_id, q["platform"], edited_q, limit=10)
                st.session_state["latest_results"] = found
                st.success(f"Discovered {len(found)} candidate profiles!")

    if is_checked:
        selected_queries_to_run.append((q["platform"], edited_q))

col_bulk1, col_bulk2 = st.columns([2.5, 4.5])
with col_bulk1:
    if st.button(f"🚀 Execute Selected Queries ({len(selected_queries_to_run)})", type="primary", use_container_width=True):
        all_found = []
        progress_bar = st.progress(0)
        status_text = st.empty()
        for idx, (plat, q_str) in enumerate(selected_queries_to_run):
            status_text.text(f"Searching {plat.title()} ({idx+1}/{len(selected_queries_to_run)})...")
            res = sourcing_service.execute_query(selected_job_id, plat, q_str, limit=8)
            all_found.extend(res)
            progress_bar.progress((idx + 1) / len(selected_queries_to_run))
        status_text.text(f"Search complete! Discovered {len(all_found)} total candidate profiles.")
        st.session_state["latest_results"] = all_found

st.divider()

# Candidate Profiles Display Tabs
tab_latest, tab_all = st.tabs(["✨ Latest Search Results", "👥 All Candidates Sourced for this Job"])

with tab_latest:
    latest = st.session_state.get("latest_results", [])
    if not latest:
        st.info("No queries executed yet in this session. Click **'▶ Run'** or **'🚀 Execute Selected Queries'** above.")
    else:
        st.markdown(f"#### 🎯 Discovered {len(latest)} Profiles")
        for cand in latest:
            plat_class = "badge-linkedin" if cand['platform'] == "linkedin" else "badge-github" if cand['platform'] == "github" else "badge-naukri" if cand['platform'] == "naukri" else "badge-primary"
            cand_skills_html = "".join([f"<span class='badge badge-success'>✓ {s}</span>" for s in cand['skills'][:5]])
            email_badge = f"<span class='badge badge-success'>✉️ {cand['emails'][0]}</span>" if cand['emails'] else "<span class='badge' style='background: rgba(255,255,255,0.04); color: #64748b; border: 1px solid rgba(255,255,255,0.08);'>✉️ Email: —</span>"
            phone_badge = f"<span class='badge badge-success'>📞 {cand['phones'][0]}</span>" if cand['phones'] else "<span class='badge' style='background: rgba(255,255,255,0.04); color: #64748b; border: 1px solid rgba(255,255,255,0.08);'>📞 Phone: —</span>"

            with st.container():
                st.markdown(
                    textwrap.dedent(
                        f"""
                        <div class="ts-card">
                          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
                            <div style="flex: 1;">
                              <h3 style="margin: 0 0 4px 0; color: #f8fafc; font-size: 1.15rem;">{cand['name']}</h3>
                              <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 0.95rem;">{cand['headline']}</p>
                              <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
                                <span class="badge {plat_class}">{cand['platform'].upper()}</span>
                                <span class="badge badge-info">📍 {cand['location']}</span>
                                {cand_skills_html}
                              </div>
                            </div>
                            <div style="text-align: right; min-width: 140px;">
                              <a href="{cand['url']}" target="_blank" style="text-decoration: none;">
                                <span class="badge badge-primary" style="padding: 6px 14px; font-size: 0.85rem;">🔗 Open Profile</span>
                              </a>
                            </div>
                          </div>
                          <div style="font-size: 0.88rem; color: #cbd5e1; background: rgba(0,0,0,0.3); padding: 10px 14px; border-radius: 8px; margin-top: 8px; border-left: 3px solid #6366f1;">
                            <strong>Search Snippet:</strong> {cand['raw_snippet']}
                          </div>
                          <div style="display: flex; gap: 12px; margin-top: 10px;">
                            {email_badge}
                            {phone_badge}
                          </div>
                        </div>
                        """
                    ),
                    unsafe_allow_html=True,
                )

with tab_all:
    saved_candidates = sourcing_service.get_candidates_for_job(selected_job_id)
    if not saved_candidates:
        st.info("No candidates saved for this job yet. Run search queries above to populate candidates.")
    else:
        st.markdown(f"#### 👥 Total Pipeline Candidates: {len(saved_candidates)}")
        for sc in saved_candidates:
            with st.container():
                emails = [c["value"] for c in sc["contacts"] if c["kind"] == "email"]
                phones = [c["value"] for c in sc["contacts"] if c["kind"] == "phone"]
                primary_url = sc["sources"][0]["url"] if sc["sources"] else "#"
                primary_platform = sc["sources"][0]["platform"] if sc["sources"] else "web"
                plat_badge = "badge-linkedin" if primary_platform == "linkedin" else "badge-github" if primary_platform == "github" else "badge-primary"

                sc_skills_html = "".join([f"<span class='badge badge-primary'>✓ {s}</span>" for s in sc['skills'][:4]])
                sc_email_badge = f"<span class='badge badge-success'>✉️ {emails[0]}</span>" if emails else "<span class='badge' style='background: rgba(255,255,255,0.04); color: #64748b; border: 1px solid rgba(255,255,255,0.08);'>✉️ Email: —</span>"
                sc_phone_badge = f"<span class='badge badge-success'>📞 {phones[0]}</span>" if phones else "<span class='badge' style='background: rgba(255,255,255,0.04); color: #64748b; border: 1px solid rgba(255,255,255,0.08);'>📞 Phone: —</span>"

                st.markdown(
                    textwrap.dedent(
                        f"""
                        <div class="ts-card">
                          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
                            <div style="flex: 1;">
                              <h3 style="margin: 0 0 4px 0; color: #f8fafc; font-size: 1.15rem;">{sc['full_name']}</h3>
                              <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 0.95rem;">{sc['headline']}</p>
                              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                <span class="badge {plat_badge}">{primary_platform.upper()}</span>
                                <span class="badge badge-info">📍 {sc['current_location']}</span>
                                <span class="badge badge-success">Stage: {sc['stage'].upper()}</span>
                                {sc_skills_html}
                              </div>
                            </div>
                            <div style="text-align: right; min-width: 140px;">
                              <a href="{primary_url}" target="_blank" style="text-decoration: none;">
                                <span class="badge badge-primary" style="padding: 6px 14px; font-size: 0.85rem;">🔗 View Profile</span>
                              </a>
                            </div>
                          </div>
                          <div style="display: flex; gap: 12px; margin-top: 10px;">
                            {sc_email_badge}
                            {sc_phone_badge}
                          </div>
                        </div>
                        """
                    ),
                    unsafe_allow_html=True,
                )
