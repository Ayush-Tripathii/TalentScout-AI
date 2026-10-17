"""Job Requirement Intake & Management Page."""

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
import textwrap
import streamlit as st
from app.services.job_service import JobService
from app.services.jd_parser import parse_job_description
from ui.components.header import render_workflow_header

# Page setup
st.set_page_config(page_title="Job Intake | TalentScout", page_icon="📝", layout="wide")

# Custom CSS
css_file = ROOT_DIR / "ui" / "styles" / "custom.css"
if css_file.exists():
    with open(css_file, "r", encoding="utf-8") as f:
        st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

# Top Workflow Navigator
render_workflow_header(current_page=1)

st.title("📝 Job Requirement Intake")
st.caption("Create structured recruitment requirements manually or extract must-have skills, experience, and budgets instantly from raw Job Descriptions.")

# Tab structure
tab_create, tab_manage = st.tabs(["➕ Intake New Requirement", "📂 Manage Saved Requirements"])

with tab_create:
    st.markdown("#### 1. Paste Job Description (AI & Rule-Based Field Extraction)")
    
    # Pre-fill sample JD buttons
    col_smp1, col_smp2, col_smp3, _ = st.columns([1.5, 1.5, 1.5, 3])
    with col_smp1:
        if st.button("📋 Sample: Java Developer", key="btn_smp_java"):
            st.session_state["raw_jd_text"] = (
                "Job Title: Senior Java Developer\n"
                "Locations: Bhopal, Indore (Hybrid)\n"
                "Experience: 3 to 6 years\n"
                "Must-Have Skills: Java, Spring Boot, Microservices, REST APIs, Hibernate\n"
                "Nice-to-Have: Docker, Kubernetes, AWS, Kafka\n"
                "Notice Period: Immediate to 30 Days\n"
                "Budget: 8 to 14 LPA\n"
                "Client: Tech Mahindra / Tier-1 Enterprise Partner\n"
                "Positions: 3"
            )
            st.rerun()
    with col_smp2:
        if st.button("📋 Sample: React Frontend", key="btn_smp_react"):
            st.session_state["raw_jd_text"] = (
                "Job Title: React Frontend Engineer\n"
                "Locations: Pune, Indore, Remote\n"
                "Experience: 2 to 5 years\n"
                "Must-Have Skills: React, TypeScript, JavaScript, Redux, HTML5, CSS3\n"
                "Nice-to-Have: Next.js, Tailwind CSS, Jest, GraphQL\n"
                "Notice Period: 15 to 30 Days\n"
                "Budget: 7 to 12 LPA\n"
                "Client: FinTech Product Firm\n"
                "Positions: 2"
            )
            st.rerun()
    with col_smp3:
        if st.button("📋 Sample: DevOps Engineer", key="btn_smp_devops"):
            st.session_state["raw_jd_text"] = (
                "Job Title: Cloud DevOps Engineer\n"
                "Locations: Bengaluru, Hyderabad, Bhopal\n"
                "Experience: 4 to 8 years\n"
                "Must-Have Skills: AWS, Docker, Kubernetes, Terraform, CI/CD, Linux\n"
                "Nice-to-Have: Python, Prometheus, Grafana, Ansible\n"
                "Notice Period: Immediate\n"
                "Budget: 12 to 20 LPA\n"
                "Positions: 1"
            )
            st.rerun()

    raw_jd = st.text_area(
        "Job Description Text",
        value=st.session_state.get("raw_jd_text", ""),
        placeholder="Paste JD text here... e.g. 'Looking for a Senior Java Developer with 3–6 years experience in Bhopal or Indore, immediate joiner, budget 10 LPA...'",
        height=140,
        key="txt_raw_jd",
    )

    col_btn_ext, _ = st.columns([2, 5])
    with col_btn_ext:
        if st.button("✨ Extract Structured Fields from JD", type="secondary", use_container_width=True):
            if raw_jd.strip():
                with st.spinner("Analyzing JD with local intelligence engine..."):
                    extracted = parse_job_description(raw_jd)
                    st.session_state["extracted_jd"] = extracted
                    st.session_state["raw_jd_text"] = raw_jd
                    method = extracted.get("extraction_method", "rule_based_fallback")
                    st.success(f"Fields extracted successfully via **{method}**! Review and refine below.")
            else:
                st.warning("Please paste or load a Job Description first.")

    ext = st.session_state.get("extracted_jd", {})
    raw_saved = st.session_state.get("raw_jd_text", "")

    st.divider()
    st.markdown("#### 2. Refine & Save Job Specification")

    with st.form("job_intake_form", clear_on_submit=False):
        col_t1, col_t2 = st.columns([2.5, 1])
        with col_t1:
            title = st.text_input(
                "Job Title *",
                value=ext.get("title", "Java Spring Boot Developer"),
                placeholder="e.g. Java Spring Boot Developer",
            )
        with col_t2:
            positions_count = st.number_input(
                "Openings Count",
                min_value=1,
                max_value=100,
                value=int(ext.get("positions_count", 2)),
            )

        alt_titles_default = ", ".join(ext.get("alternate_titles", ["Backend Engineer", "Java Developer"]))
        alt_titles_input = st.text_input(
            "Alternate Job Titles (comma-separated)",
            value=alt_titles_default,
            help="Expands Boolean X-ray search queries across LinkedIn, GitHub, Naukri, etc.",
        )

        col_s1, col_s2 = st.columns(2)
        with col_s1:
            must_have_default = ", ".join(ext.get("must_have_skills", ["Java", "Spring Boot", "Microservices"]))
            must_have_input = st.text_input(
                "Must-Have Skills (comma-separated) *",
                value=must_have_default,
                help="Heaviest weight in candidate matching (35%).",
            )
        with col_s2:
            nice_have_default = ", ".join(ext.get("nice_to_have_skills", ["Docker", "Kubernetes", "AWS"]))
            nice_have_input = st.text_input(
                "Nice-to-Have Skills (comma-separated)",
                value=nice_have_default,
                help="Secondary scoring bonus (15%).",
            )

        col_e1, col_e2, col_loc = st.columns([1, 1, 2])
        with col_e1:
            min_exp = st.number_input("Min Exp (Years)", min_value=0.0, max_value=30.0, value=float(ext.get("min_experience", 3.0)), step=0.5)
        with col_e2:
            max_exp = st.number_input("Max Exp (Years)", min_value=0.0, max_value=30.0, value=float(ext.get("max_experience", 6.0)), step=0.5)
        with col_loc:
            locs_default = ", ".join(ext.get("locations", ["Bhopal", "Indore"]))
            locations_input = st.text_input(
                "Target Locations (comma-separated) *",
                value=locs_default,
                help="Indian cities or regions. City aliases will be expanded automatically.",
            )

        col_p1, col_p2, col_p3 = st.columns(3)
        with col_p1:
            notice_periods = ["Immediate", "15 Days", "30 Days", "60 Days", "90 Days"]
            current_np = ext.get("notice_period", "Immediate")
            idx = notice_periods.index(current_np) if current_np in notice_periods else 0
            notice_period = st.selectbox("Preferred Notice Period", notice_periods, index=idx)
        with col_p2:
            min_ctc = st.number_input("Min CTC / Budget (LPA)", min_value=0.0, max_value=100.0, value=float(ext.get("min_ctc") or 6.0), step=0.5)
        with col_p3:
            max_ctc = st.number_input("Max CTC / Budget (LPA)", min_value=0.0, max_value=100.0, value=float(ext.get("max_ctc") or 14.0), step=0.5)

        col_f1, col_f2 = st.columns(2)
        with col_f1:
            is_remote = st.checkbox("Remote / Hybrid Permitted", value=bool(ext.get("is_remote", False)))
        with col_f2:
            open_to_relocate = st.checkbox("Consider Candidates Open to Relocation", value=bool(ext.get("open_to_relocate", True)))

        col_c1, col_c2, col_c3 = st.columns(3)
        with col_c1:
            client_name = st.text_input("Client Name (Internal)", value=ext.get("client_name", "Confidential Client"))
        with col_c2:
            industry = st.text_input("Industry", value=ext.get("industry", "IT Services / Enterprise Software"))
        with col_c3:
            education = st.text_input("Education Requirement", value=ext.get("education", "B.Tech / B.E. / MCA"))

        submitted = st.form_submit_button("💾 Save Job Requirement", type="primary")
        if submitted:
            if not title.strip():
                st.error("Job Title is required.")
            elif not must_have_input.strip():
                st.error("At least one must-have skill is required.")
            else:
                alt_titles = [x.strip() for x in alt_titles_input.split(",") if x.strip()]
                must_have = [x.strip() for x in must_have_input.split(",") if x.strip()]
                nice_have = [x.strip() for x in nice_have_input.split(",") if x.strip()]
                locations = [x.strip() for x in locations_input.split(",") if x.strip()]

                job_data = {
                    "title": title.strip(),
                    "alternate_titles": alt_titles,
                    "must_have_skills": must_have,
                    "nice_to_have_skills": nice_have,
                    "min_experience": min_exp,
                    "max_experience": max_exp,
                    "locations": locations,
                    "open_to_relocate": open_to_relocate,
                    "is_remote": is_remote,
                    "education": education.strip() if education else None,
                    "industry": industry.strip() if industry else None,
                    "notice_period": notice_period,
                    "min_ctc": min_ctc if min_ctc > 0 else None,
                    "max_ctc": max_ctc if max_ctc > 0 else None,
                    "client_name": client_name.strip() if client_name else None,
                    "positions_count": int(positions_count),
                    "jd_raw_text": raw_jd or raw_saved or None,
                    "status": "active",
                }

                new_job = JobService.create_job(job_data)
                st.session_state["selected_job_id"] = new_job.id
                st.session_state["just_created_job"] = new_job
                st.success(f"Job requirement **'{new_job.title}'** created successfully!")

    if "just_created_job" in st.session_state:
        j_obj = st.session_state["just_created_job"]
        st.markdown(
            f"""
            <div class="active-job-banner" style="margin-top: 16px;">
              <div>
                <strong>Ready to source:</strong> {j_obj.title} ({j_obj.positions_count} openings)
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        if st.button("🔍 Proceed Directly to Sourcing Profiles ➔", type="primary"):
            st.switch_page("pages/2_Sourcing_and_Search.py")

with tab_manage:
    st.markdown("#### 📂 Saved Job Requirements Directory")
    jobs = JobService.list_jobs()
    
    if not jobs:
        st.info("No job requirements found. Create one in the **Intake New Requirement** tab.")
    else:
        # Search & Filter
        col_sch, col_st_flt = st.columns([3, 1])
        with col_sch:
            sch_term = st.text_input("🔎 Filter by title, skill, or location", value="")
        with col_st_flt:
            st_flt = st.selectbox("Status", ["All", "Active", "Closed"])

        filtered_jobs = jobs
        if st_flt != "All":
            filtered_jobs = [j for j in filtered_jobs if j.status == st_flt.lower()]
        if sch_term.strip():
            term = sch_term.lower()
            filtered_jobs = [
                j for j in filtered_jobs
                if term in j.title.lower()
                or (j.must_have_skills and term in j.must_have_skills.lower())
                or (j.locations and term in j.locations.lower())
            ]

        st.caption(f"Showing {len(filtered_jobs)} requirements")

        for job in filtered_jobs:
            must_skills = json.loads(job.must_have_skills) if job.must_have_skills else []
            locs = json.loads(job.locations) if job.locations else []
            must_chips = "".join([f"<span class='badge' style='background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1);'>✓ {s}</span>" for s in must_skills[:6]])
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
                                <h3 style="margin: 0; color: #f8fafc; font-size: 1.2rem;">{job.title}</h3>
                                <span class="badge {'badge-success' if job.status == 'active' else 'badge-warning'}">{job.status.upper()}</span>
                                {remote_badge}
                              </div>
                              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                                <span class="badge badge-primary">⏱️ {job.min_experience}–{job.max_experience} Yrs</span>
                                <span class="badge badge-info">⚡ {job.notice_period}</span>
                                <span class="badge badge-success">📍 {', '.join(locs)}</span>
                                {ctc_badge}
                              </div>
                              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                {must_chips}
                              </div>
                            </div>
                            <div style="text-align: right; min-width: 140px;">
                              <div style="font-size: 0.88rem; color: #94a3b8;">Openings: <strong>{job.positions_count}</strong></div>
                              {client_line}
                              <div style="font-size: 0.78rem; color: #64748b; margin-top: 4px;">Created: {job.created_at.strftime('%Y-%m-%d')}</div>
                            </div>
                          </div>
                        </div>
                        """
                    ),
                    unsafe_allow_html=True,
                )
                col_m1, col_m2, col_m3, col_m4, col_m5 = st.columns([1.5, 1.5, 1.2, 1.2, 1.2])
                with col_m1:
                    if st.button("🔍 Source Profiles", key=f"src_dir_{job.id}", type="primary", use_container_width=True):
                        st.session_state["selected_job_id"] = job.id
                        st.switch_page("pages/2_Sourcing_and_Search.py")
                with col_m2:
                    if st.button("📊 View Pipeline", key=f"pip_dir_{job.id}", use_container_width=True):
                        st.session_state["selected_job_id"] = job.id
                        st.switch_page("pages/4_Candidate_Pipeline.py")
                with col_m3:
                    if st.button("📋 Duplicate", key=f"dup_dir_{job.id}", use_container_width=True):
                        JobService.duplicate_job(job.id)
                        st.success("Duplicated!")
                        st.rerun()
                with col_m4:
                    if job.status == "active":
                        if st.button("🔒 Close", key=f"cls_dir_{job.id}", use_container_width=True):
                            JobService.close_job(job.id)
                            st.rerun()
                    else:
                        if st.button("🔓 Re-open", key=f"reop_dir_{job.id}", use_container_width=True):
                            JobService.update_job(job.id, {"status": "active"})
                            st.rerun()
                with col_m5:
                    if st.button("🗑️ Delete", key=f"del_dir_{job.id}", use_container_width=True):
                        JobService.delete_job(job.id)
                        st.warning("Deleted.")
                        st.rerun()
