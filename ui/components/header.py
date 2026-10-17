"""Shared Header and Workflow Navigator Component for TalentScout."""

import textwrap
import streamlit as st
from app.services.job_service import JobService


def render_workflow_header(current_page: int = 1):
    """Render top-level workflow step indicator and active job context banner."""
    steps = [
        (1, "1. 📝 Job Intake", "pages/1_Jobs_and_Intake.py"),
        (2, "2. 🔍 X-Ray Sourcing", "pages/2_Sourcing_and_Search.py"),
        (3, "3. 📥 Inbound & Resumes", "pages/3_Inbound_and_Resumes.py"),
        (4, "4. 📊 Pipeline & Ranking", "pages/4_Candidate_Pipeline.py"),
    ]

    # Workflow Navigator Bar
    nav_html = ['<div class="workflow-nav">']
    for idx, label, _ in steps:
        active_class = "active" if idx == current_page else ""
        nav_html.append(f'<span class="workflow-step {active_class}">{label}</span>')
        if idx < len(steps):
            nav_html.append('<span class="workflow-arrow">➔</span>')
    nav_html.append('</div>')
    st.markdown("".join(nav_html), unsafe_allow_html=True)

    # Active Job Context Banner
    jobs = JobService.list_jobs(status="active")
    if jobs:
        selected_id = st.session_state.get("selected_job_id", jobs[0].id)
        current_job = next((j for j in jobs if j.id == selected_id), jobs[0])
        st.session_state["selected_job_id"] = current_job.id
        
        col_banner, col_switch = st.columns([4, 1.5])
        with col_banner:
            st.markdown(
                textwrap.dedent(
                    f"""
                    <div class="active-job-banner">
                      <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 1.3rem;">🎯</span>
                        <div>
                          <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #a5b4fc; font-weight: 700;">Active Requirement</div>
                          <div style="font-size: 1.05rem; font-weight: 700; color: #f8fafc;">{current_job.title}</div>
                        </div>
                      </div>
                      <div style="display: flex; gap: 8px;">
                        <span class="badge badge-primary">{current_job.min_experience}–{current_job.max_experience} Yrs</span>
                        <span class="badge badge-info">{current_job.notice_period}</span>
                        <span class="badge badge-success">{current_job.positions_count} Openings</span>
                      </div>
                    </div>
                    """
                ),
                unsafe_allow_html=True,
            )
        with col_switch:
            job_dict = {j.id: j.title for j in jobs}
            new_selection = st.selectbox(
                "Switch Job",
                options=list(job_dict.keys()),
                format_func=lambda x: job_dict[x],
                index=list(job_dict.keys()).index(current_job.id),
                label_visibility="collapsed",
                key="global_job_switcher",
            )
            if new_selection != current_job.id:
                st.session_state["selected_job_id"] = new_selection
                st.rerun()
