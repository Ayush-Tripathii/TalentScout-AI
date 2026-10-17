"""Candidate Pipeline, Explainable Ranking & Export Console Page."""

import sys
from pathlib import Path

# Ensure project root is first in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import json
import textwrap
import streamlit as st
from sqlmodel import Session, select
from datetime import datetime, timezone

from app.db import engine
from app.models.job import Job
from app.models.candidate import Candidate, CandidateSource, ContactPoint
from app.models.match import Match
from app.models.pipeline import PipelineStatus, Note
from app.models.resume import Resume
from app.services.job_service import JobService
from app.services.ranking_engine import RankingEngine
from app.services.dedup_linker import DedupLinker
from app.services.export_service import ExportService
from ui.components.header import render_workflow_header

st.set_page_config(page_title="Candidate Pipeline & Ranking | TalentScout", page_icon="📊", layout="wide")

# Custom CSS
css_file = Path(__file__).resolve().parent.parent / "styles" / "custom.css"
if css_file.exists():
    with open(css_file, "r", encoding="utf-8") as f:
        st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

# Top Workflow Navigator
render_workflow_header(current_page=4)

ranking_engine = RankingEngine()
dedup_linker = DedupLinker()

st.title("📊 Candidate Pipeline & Explainable Ranking")
st.caption("Review 0–100 weighted match scores, inspect transparent 'Why this candidate' breakdowns, manage stages, and export candidate lists.")

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

# 1. Suggested Identity Links / Deduplication Alerts
with Session(engine, expire_on_commit=False) as session:
    suggested_links = dedup_linker.get_suggested_links(session)

if suggested_links:
    with st.expander(f"⚠️ **Cross-Platform Identity Links Detected ({len(suggested_links)})**", expanded=True):
        st.caption("TalentScout detected high-confidence profile similarities across multiple platforms. Review and confirm to merge profiles.")
        for sl in suggested_links:
            col_info, col_act = st.columns([4, 1.2])
            with col_info:
                st.markdown(
                    f"""
                    **Suggested Link ({int(sl['confidence']*100)}% Confidence):**  
                    • **Candidate A:** `{sl['source']['name']}` ({sl['source']['location'] or 'No loc'}) — *{sl['source']['headline'] or 'No headline'}*  
                    • **Candidate B:** `{sl['target']['name']}` ({sl['target']['location'] or 'No loc'}) — *{sl['target']['headline'] or 'No headline'}*  
                    • **Reasons:** {', '.join(sl['reasons'])}
                    """
                )
            with col_act:
                c_btn1, c_btn2 = st.columns(2)
                with c_btn1:
                    if st.button("✓ Merge", key=f"conf_link_{sl['link_id']}", type="primary"):
                        with Session(engine, expire_on_commit=False) as s:
                            dedup_linker.resolve_link(sl['link_id'], "confirm", s)
                        st.success("Merged successfully!")
                        st.rerun()
                with c_btn2:
                    if st.button("✗ Dismiss", key=f"rej_link_{sl['link_id']}"):
                        with Session(engine, expire_on_commit=False) as s:
                            dedup_linker.resolve_link(sl['link_id'], "reject", s)
                        st.info("Link dismissed.")
                        st.rerun()

# 2. Actions & Metrics Toolbar
with Session(engine, expire_on_commit=False) as session:
    all_candidates = session.exec(select(Candidate)).all()
    all_matches = session.exec(select(Match).where(Match.job_id == selected_job_id)).all()
    all_pipeline = session.exec(select(PipelineStatus).where(PipelineStatus.job_id == selected_job_id)).all()
    all_contacts = session.exec(select(ContactPoint)).all()

shortlisted_count = sum(1 for p in all_pipeline if p.stage == "shortlisted")
avg_score = round(sum(m.total_score for m in all_matches) / len(all_matches), 1) if all_matches else 0.0

col_act1, col_act2, col_act3 = st.columns([2.5, 2, 2.5])
with col_act1:
    if st.button("⚡ Evaluate / Re-Rank All Candidates", type="primary", use_container_width=True):
        with st.spinner("Computing 0–100 explainable multi-dimensional rankings with CPU sentence embeddings..."):
            with Session(engine, expire_on_commit=False) as session:
                ranked = ranking_engine.rank_and_save_all(selected_job_id, session)
            st.success(f"Evaluated {len(ranked)} candidates against job criteria!")
            st.rerun()

# Export Buttons in Header
with col_act2:
    with Session(engine, expire_on_commit=False) as session:
        excel_bytes = ExportService.export_to_excel(selected_job_id, session)
    st.download_button(
        label="📥 Export Excel (.xlsx)",
        data=excel_bytes,
        file_name=f"talentscout_{active_job.title[:20].lower().replace(' ', '_')}_pipeline.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        use_container_width=True,
    )

with col_act3:
    with Session(engine, expire_on_commit=False) as session:
        csv_bytes = ExportService.export_to_csv(selected_job_id, session)
    st.download_button(
        label="📄 Export CSV (.csv)",
        data=csv_bytes,
        file_name=f"talentscout_{active_job.title[:20].lower().replace(' ', '_')}_pipeline.csv",
        mime="text/csv",
        use_container_width=True,
    )

# High-Level Metrics
m1, m2, m3, m4 = st.columns(4)
with m1:
    st.markdown(f"<div class='metric-box'><div class='metric-number'>{len(all_candidates)}</div><div class='metric-label'>Total Candidates</div></div>", unsafe_allow_html=True)
with m2:
    st.markdown(f"<div class='metric-box'><div class='metric-number'>{shortlisted_count}</div><div class='metric-label'>Shortlisted</div></div>", unsafe_allow_html=True)
with m3:
    st.markdown(f"<div class='metric-box'><div class='metric-number'>{avg_score}</div><div class='metric-label'>Avg Match Score</div></div>", unsafe_allow_html=True)
with m4:
    st.markdown(f"<div class='metric-box'><div class='metric-number'>{len(all_contacts)}</div><div class='metric-label'>Verified Contacts</div></div>", unsafe_allow_html=True)

st.write("")

# 3. Filters & Search Toolbar
col_f1, col_f2, col_f3, col_f4 = st.columns([1.5, 1.5, 1.5, 2.5])
with col_f1:
    min_score_filter = st.slider("Min Match Score", min_value=0, max_value=100, value=0, step=5)
with col_f2:
    stage_options = ["all", "new", "shortlisted", "linkedin_note_sent", "form_sent", "replied", "form_submitted", "called", "interested", "not_interested", "submitted_to_client", "placed", "rejected"]
    selected_stage = st.selectbox("Pipeline Stage", options=stage_options, format_func=lambda x: x.replace("_", " ").title())
with col_f3:
    has_contact_only = st.checkbox("Only with Verified Contact", value=False)
with col_f4:
    search_term = st.text_input("🔎 Search candidate name, skill, or location", value="")

st.divider()

# 4. Candidate Cards & Detailed Drawer
STAGES_LIST = [
    "new", "shortlisted", "linkedin_note_sent", "form_sent", "replied",
    "form_submitted", "called", "interested", "not_interested", "submitted_to_client", "placed", "rejected"
]

with Session(engine, expire_on_commit=False) as session:
    candidates = session.exec(select(Candidate)).all()

    # Build candidate display models
    display_candidates = []
    for cand in candidates:
        # Match
        m = session.exec(select(Match).where(Match.job_id == selected_job_id, Match.candidate_id == cand.id)).first()
        score = m.total_score if m else 0.0
        breakdown = json.loads(m.breakdown_json) if (m and m.breakdown_json) else {}
        why_bullets = json.loads(m.why_bullets_json) if (m and m.why_bullets_json) else []
        missing_skills = json.loads(m.missing_skills_json) if (m and m.missing_skills_json) else []

        # Pipeline
        ps = session.exec(select(PipelineStatus).where(PipelineStatus.job_id == selected_job_id, PipelineStatus.candidate_id == cand.id)).first()
        stage = ps.stage if ps else "new"

        # Contacts
        cps = session.exec(select(ContactPoint)).where(ContactPoint.candidate_id == cand.id).all() if hasattr(session.exec(select(ContactPoint)), "where") else [cp for cp in all_contacts if cp.candidate_id == cand.id]
        emails = [c.value for c in cps if c.kind == "email"]
        phones = [c.value for c in cps if c.kind == "phone"]

        # Sources
        sources = session.exec(select(CandidateSource).where(CandidateSource.candidate_id == cand.id)).all()

        # Resumes
        resumes = session.exec(select(Resume).where(Resume.candidate_id == cand.id)).all()

        # Notes
        notes = session.exec(select(Note).where(Note.candidate_id == cand.id)).all()

        # Filter application
        if score < min_score_filter:
            continue
        if selected_stage != "all" and stage != selected_stage:
            continue
        if has_contact_only and not (emails or phones):
            continue
        if search_term:
            skills_str = " ".join(json.loads(cand.skills_json)) if cand.skills_json else ""
            haystack = f"{cand.full_name} {cand.headline or ''} {skills_str} {cand.current_location or ''}".lower()
            if search_term.lower() not in haystack:
                continue

        display_candidates.append({
            "candidate": cand,
            "score": score,
            "breakdown": breakdown,
            "why_bullets": why_bullets,
            "missing_skills": missing_skills,
            "stage": stage,
            "pipeline_id": ps.id if ps else None,
            "emails": emails,
            "phones": phones,
            "sources": sources,
            "resumes": resumes,
            "notes": notes,
        })

    # Sort descending by score
    display_candidates.sort(key=lambda x: x["score"], reverse=True)

if not display_candidates:
    st.info("No candidates match your current filter criteria or no candidates have been sourced yet. Navigate to **Sourcing and Search** or **Inbound and Resumes** to discover profiles.")
else:
    st.markdown(f"#### 👥 Ranked Candidates ({len(display_candidates)})")

    for item in display_candidates:
        cand = item["candidate"]
        score = item["score"]
        stage = item["stage"]
        breakdown = item["breakdown"]
        why_bullets = item["why_bullets"]
        missing_skills = item["missing_skills"]
        emails = item["emails"]
        phones = item["phones"]
        sources = item["sources"]
        resumes = item["resumes"]
        notes = item["notes"]

        score_color = "#10b981" if score >= 75 else "#f59e0b" if score >= 50 else "#64748b"
        completeness_badge = (
            "<span class='badge badge-success'>📄 Full Resume</span>"
            if cand.data_completeness == "full_resume"
            else "<span class='badge badge-info'>🔍 Snippet Profile</span>"
        )

        sources_html = "".join([f"<span class='badge badge-primary'>{s.platform.upper()}</span>" for s in sources])
        email_badge = f"<span class='badge badge-success'>✉️ {emails[0]}</span>" if emails else "<span class='badge' style='background: rgba(255,255,255,0.04); color: #64748b; border: 1px solid rgba(255,255,255,0.08);'>✉️ Email: —</span>"
        phone_badge = f"<span class='badge badge-success'>📞 {phones[0]}</span>" if phones else "<span class='badge' style='background: rgba(255,255,255,0.04); color: #64748b; border: 1px solid rgba(255,255,255,0.08);'>📞 Phone: —</span>"

        with st.container():
            st.markdown(
                textwrap.dedent(
                    f"""
                    <div class="ts-card" style="border-left: 5px solid {score_color};">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
                        <div style="flex: 1;">
                          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                            <h3 style="margin: 0; color: #f8fafc; font-size: 1.2rem;">{cand.full_name}</h3>
                            <span class="score-badge" style="color: {score_color}; background: rgba(0,0,0,0.35); border: 1px solid {score_color};">
                              🎯 {score:.1f} / 100
                            </span>
                            {completeness_badge}
                          </div>
                          <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 0.95rem;">{cand.headline or 'Software Professional'}</p>
                          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px;">
                            <span class="badge badge-info">📍 {cand.current_location or 'India'}</span>
                            <span class="badge badge-primary">⏱️ {cand.experience_years if cand.experience_years is not None else '—'} Yrs Exp</span>
                            {sources_html}
                          </div>
                        </div>
                      </div>
                      <div style="margin-top: 8px; display: flex; gap: 10px; flex-wrap: wrap;">
                        {email_badge}
                        {phone_badge}
                      </div>
                    </div>
                    """
                ),
                unsafe_allow_html=True,
            )

            # Stage Selector and Controls
            col_stg, col_exp = st.columns([2.5, 4.5])
            with col_stg:
                new_stage = st.selectbox(
                    f"Pipeline Stage for {cand.full_name}",
                    options=STAGES_LIST,
                    index=STAGES_LIST.index(stage) if stage in STAGES_LIST else 0,
                    format_func=lambda x: x.replace("_", " ").title(),
                    key=f"stg_sel_{cand.id}",
                    label_visibility="collapsed",
                )
                if new_stage != stage:
                    with Session(engine, expire_on_commit=False) as s:
                        ps_rec = s.exec(select(PipelineStatus).where(PipelineStatus.job_id == selected_job_id, PipelineStatus.candidate_id == cand.id)).first()
                        if ps_rec:
                            ps_rec.stage = new_stage
                            ps_rec.updated_at = datetime.now(timezone.utc)
                            s.add(ps_rec)
                            s.commit()
                    st.success(f"Updated {cand.full_name} stage to {new_stage.replace('_', ' ').title()}")
                    st.rerun()

            with col_exp:
                with st.expander("🔍 Explainable Match Breakdown & Profile Details"):
                    st.markdown("##### 🎯 Multi-Dimensional Score Breakdown")
                    if breakdown:
                        b_cols = st.columns(6)
                        b_cols[0].metric("Must-Have (35%)", f"{breakdown.get('must_have', 0):.0f}%")
                        b_cols[1].metric("Nice-to-Have (15%)", f"{breakdown.get('nice_to_have', 0):.0f}%")
                        b_cols[2].metric("Experience (15%)", f"{breakdown.get('experience', 0):.0f}%")
                        b_cols[3].metric("Location (15%)", f"{breakdown.get('location', 0):.0f}%")
                        b_cols[4].metric("Title (10%)", f"{breakdown.get('title', 0):.0f}%")
                        b_cols[5].metric("Semantic (10%)", f"{breakdown.get('semantic', 0):.0f}%")

                    st.markdown("##### 💡 Why This Candidate")
                    if why_bullets:
                        for b in why_bullets:
                            st.markdown(f"- {b}")
                    else:
                        st.caption("No evaluation bullets generated yet.")

                    if missing_skills:
                        st.markdown(f"**⚠️ Missing Skills:** {', '.join([f'`{ms}`' for ms in missing_skills])}")

                    st.divider()

                    st.markdown("##### 🔗 Multi-Platform Sources")
                    if sources:
                        for s in sources:
                            st.markdown(f"- **{s.platform.upper()}**: [{s.url}]({s.url}) — *{s.raw_title or 'Profile'}*")
                            if s.raw_snippet:
                                st.caption(f"Snippet: {s.raw_snippet}")
                    else:
                        st.caption("No external platform links recorded.")

                    if resumes:
                        st.markdown("##### 📄 Ingested Resume Details")
                        for r in resumes:
                            st.caption(f"Filename: `{r.filename}` | Uploaded: {r.parsed_at.strftime('%Y-%m-%d %H:%M')}")
                            if r.raw_text:
                                st.text_area("Parsed Resume Text", value=r.raw_text[:800] + ("..." if len(r.raw_text) > 800 else ""), height=150, key=f"txt_res_{cand.id}", disabled=True)

                    st.divider()
                    st.markdown("##### 📝 Recruiter Notes")
                    if notes:
                        for n in notes:
                            st.markdown(f"**{n.author}** ({n.created_at.strftime('%Y-%m-%d %H:%M')}): {n.content}")

                    new_note = st.text_input("Add a recruiter note...", key=f"note_in_{cand.id}")
                    if st.button("Add Note", key=f"btn_note_{cand.id}"):
                        if new_note.strip():
                            with Session(engine, expire_on_commit=False) as s:
                                note_obj = Note(
                                    candidate_id=cand.id,
                                    author="Recruiter",
                                    content=new_note.strip(),
                                    created_at=datetime.now(timezone.utc),
                                )
                                s.add(note_obj)
                                s.commit()
                            st.success("Note saved.")
                            st.rerun()

            st.write("")
