"""Gmail IMAP Email Ingestion Service.

Connects to a dedicated recruitment inbox via IMAP SSL (using App Password),
downloads PDF/DOCX attachments from incoming emails, and triggers automated parsing.
"""

import email
from email.header import decode_header
import imaplib
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from config.settings import get_settings
from app.services.local_resume_service import LocalResumeService

logger = logging.getLogger("talentscout.imap")
settings = get_settings()
BASE_DIR = Path(__file__).resolve().parent.parent.parent


class GmailIMAPService:
    """Service for polling inbound email resumes via IMAP SSL."""

    def __init__(self):
        self.server = settings.GMAIL_IMAP_SERVER
        self.username = settings.GMAIL_EMAIL
        self.password = settings.GMAIL_APP_PASSWORD
        self.save_dir = BASE_DIR / "uploads" / "resumes" / "gmail"
        self.save_dir.mkdir(parents=True, exist_ok=True)
        self.resume_service = LocalResumeService()

    def is_configured(self) -> bool:
        """Verify whether Gmail credentials are provided in .env."""
        return bool(self.username and self.password)

    def fetch_inbound_resumes(self) -> List[Dict[str, Any]]:
        """Connect to IMAP inbox, find unread emails with attachments, and ingest them."""
        if not self.is_configured():
            logger.info("Gmail IMAP not configured in .env (username or app password missing).")
            return []

        ingested_records = []
        try:
            mail = imaplib.IMAP4_SSL(self.server)
            mail.login(self.username, self.password)
            mail.select("INBOX")

            # Search for unread emails
            status, messages = mail.search(None, "UNSEEN")
            if status != "OK":
                mail.logout()
                return []

            msg_ids = messages[0].split()
            logger.info(f"Found {len(msg_ids)} unread emails in Gmail inbox.")

            for msg_id in msg_ids:
                res, data = mail.fetch(msg_id, "(RFC822)")
                if res != "OK":
                    continue

                raw_email = data[0][1]
                msg = email.message_from_bytes(raw_email)

                # Sender subject
                subject, encoding = decode_header(msg.get("Subject", ""))[0]
                if isinstance(subject, bytes):
                    subject = subject.decode(encoding or "utf-8", errors="ignore")

                # Walk email parts for attachments
                for part in msg.walk():
                    if part.get_content_maintype() == "multipart":
                        continue
                    if part.get("Content-Disposition") is None:
                        continue

                    filename = part.get_filename()
                    if filename:
                        h_name, h_enc = decode_header(filename)[0]
                        if isinstance(h_name, bytes):
                            filename = h_name.decode(h_enc or "utf-8", errors="ignore")

                        ext = Path(filename).suffix.lower()
                        if ext in [".pdf", ".docx", ".doc"]:
                            save_path = self.save_dir / filename
                            with open(save_path, "wb") as f:
                                f.write(part.get_payload(decode=True))

                            logger.info(f"Saved email attachment {filename} from {msg.get('From')}")
                            # Ingest into DB
                            res_ingest = self.resume_service.ingest_resume_file(save_path, source_type="gmail")
                            if res_ingest:
                                res_ingest["email_subject"] = subject
                                res_ingest["email_from"] = msg.get("From")
                                ingested_records.append(res_ingest)

                # Mark as seen
                mail.store(msg_id, "+FLAGS", "\\Seen")

            mail.close()
            mail.logout()
        except Exception as e:
            logger.error(f"Error fetching inbound email resumes: {e}")

        return ingested_records

