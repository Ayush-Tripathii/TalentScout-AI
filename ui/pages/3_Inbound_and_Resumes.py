"""Inbound Sourcing & Resume Management Page."""

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
import shutil
import streamlit as st
from app.services.local_resume_service import LocalResumeService
from app.services.imap_ingest import GmailIMAPService
from ui.components.header import render_workflow_header

st.set_page_config(page_title="Inbound Resumes | TalentScout", page_icon="📥", layout="wide")

# Custom CSS
css_file = ROOT_DIR / "ui" / "styles" / "custom.css"
if css_file.exists():
    with open(css_file, "r", encoding="utf-8") as f:
        st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

# Top Workflow Navigator
render_workflow_header(current_page=3)

resume_service = LocalResumeService()
imap_service = GmailIMAPService()

st.title("📥 Inbound & Resume Ingestion Hub")
st.caption("Ingest resumes in bulk via drag-and-drop, automated watch folder import, and secure Gmail IMAP synchronization.")

tab_upload, tab_watch, tab_gmail, tab_library = st.tabs([
    "📤 Bulk Resume Upload",
    "📂 Watch Folder Monitor",
    "✉️ Gmail IMAP Ingestion",
    "📚 Parsed Resumes Library",
])

with tab_upload:
    st.markdown("#### 📤 Bulk Resume Upload (PDF / DOCX)")
    st.caption("Upload one or multiple candidate resumes at once. Files are hashed using SHA-256 to prevent duplicate entries and parsed automatically.")

    uploaded_files = st.file_uploader(
        "Drop resume files here",
        type=["pdf", "docx", "doc"],
        accept_multiple_files=True,
    )

    if uploaded_files:
        if st.button(f"⚡ Ingest & Parse {len(uploaded_files)} Resumes", type="primary", use_container_width=True):
            progress = st.progress(0)
            status_text = st.empty()
            results = []

            for idx, file in enumerate(uploaded_files):
                status_text.text(f"Parsing {file.name} ({idx+1}/{len(uploaded_files)})...")
                temp_path = resume_service.upload_dir / file.name
                with open(temp_path, "wb") as f:
                    f.write(file.getbuffer())

                res = resume_service.ingest_resume_file(temp_path, source_type="upload")
                if res:
                    results.append(res)
                progress.progress((idx + 1) / len(uploaded_files))

            status_text.text(f"Processed {len(uploaded_files)} files!")
            st.success(f"Successfully processed {len(results)} resumes!")

            for r in results:
                st.markdown(
                    f"""
                    <div class="ts-card">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <strong style="font-size: 1.1rem; color: #f8fafc;">{r.get('name', 'Candidate')}</strong>
                            <span class="badge badge-success">Ingested</span>
                            <span class="badge badge-primary">⏱️ {r.get('experience_years', 0)} Yrs Exp</span>
                          </div>
                          <div style="font-size: 0.9rem; color: #94a3b8; margin: 6px 0;">
                            Skills: {', '.join(r.get('skills', [])[:6])}
                          </div>
                        </div>
                        <div>
                          <span style="font-size: 0.85rem; color: #38bdf8;">Verified Contacts: {', '.join(r.get('contacts', [])) or '—'}</span>
                        </div>
                      </div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

with tab_watch:
    st.markdown("#### 📂 Automated Watch Folder Monitor")
    st.markdown(
        f"""
        <div class="active-job-banner">
          <div>
            <strong>Active Watch Directory:</strong><br/>
            <code>{resume_service.watch_dir}</code>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.caption("Drop resumes into this folder on your computer at any time. Click below or run background service to auto-import.")

    if st.button("🔄 Scan Watch Folder Now", type="primary"):
        detected = resume_service.process_watch_folder()
        if detected:
            st.success(f"Detected and parsed {len(detected)} new candidate resumes from watch folder!")
            for d in detected:
                st.write(f"✓ **{d.get('name')}** (Status: {d.get('status')})")
        else:
            st.info("Watch folder is currently clean (no new unparsed files).")

with tab_gmail:
    st.markdown("#### ✉️ Gmail IMAP Ingestion")
    is_cfg = imap_service.is_configured()

    if is_cfg:
        st.success(f"Connected to Gmail account: `{imap_service.username}`")
    else:
        st.info("Gmail credentials not configured. To connect, add `GMAIL_EMAIL` and `GMAIL_APP_PASSWORD` in your `.env` file.")

    if st.button("📥 Poll Gmail Inbox for New Resume Attachments", disabled=not is_cfg, type="primary"):
        with st.spinner("Checking Gmail inbox via secure IMAP SSL..."):
            ingested = imap_service.fetch_inbound_resumes()
            if ingested:
                st.success(f"Downloaded and parsed {len(ingested)} new resume attachments!")
            else:
                st.info("No new unread emails with resume attachments found.")

with tab_library:
    st.markdown("#### 📚 Parsed Resumes Library")
    resumes_list = resume_service.list_ingested_resumes()

    if not resumes_list:
        st.info("No resumes parsed yet. Upload files or scan the watch folder above.")
    else:
        st.markdown(f"**Total Resumes Ingested:** `{len(resumes_list)}`")
        for item in resumes_list:
            with st.container():
                skills_html = "".join([f"<span class='badge badge-success'>✓ {s}</span> " for s in item['skills'][:6]])
                st.markdown(
                    f"""
                    <div class="ts-card">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <strong style="font-size: 1.1rem; color: #f8fafc;">{item['candidate_name']}</strong>
                            <span class="badge badge-info">{item['file_format'].upper()}</span>
                            <span class="badge badge-primary">Source: {item['ingested_source']}</span>
                          </div>
                          <div style="font-size: 0.85rem; color: #94a3b8; margin: 4px 0;">
                            File: <code>{item['file_name']}</code> | Exp: {item['experience_years']} Yrs | Date: {item['created_at']}
                          </div>
                          <div style="margin-top: 6px;">
                            {skills_html}
                          </div>
                        </div>
                      </div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )
