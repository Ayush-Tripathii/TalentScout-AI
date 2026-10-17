"""Job Posting & Careers Page Service.

Generates ready-to-paste job posts tailored for:
1. LinkedIn Feed (Hook, emojis, structured bullet points, tech hashtags)
2. Naukri / Foundit Job Ad (Enterprise JD structure with mandatory qualifications)
3. WhatsApp / Telegram Tech Community Broadcast
4. Standalone Public Careers Page (HTML) with Schema.org JobPosting JSON-LD for Google for Jobs
"""

from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional
from sqlmodel import Session
from app.db import engine
from app.models.job import Job


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class JobPostingService:
    """Multi-platform job ad and static careers page generator."""

    def generate_postings_for_job(
        self,
        job_id: str,
        company_name: str = "Enterprise Technology Partner",
        application_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate platform-optimized social and job board ad formats."""
        with Session(engine, expire_on_commit=False) as session:
            job = session.get(Job, job_id)
            if not job:
                raise ValueError("Job not found.")

            must_skills = json.loads(job.must_have_skills) if job.must_have_skills else []
            nice_skills = json.loads(job.nice_to_have_skills) if job.nice_to_have_skills else []
            alt_titles = json.loads(job.alternate_titles) if job.alternate_titles else []

            title = job.title or "Software Developer"
            locations_list = json.loads(job.locations) if job.locations else []
            location = ", ".join(locations_list) if locations_list else "Bengaluru / Pune, India"
            min_exp = f"{job.min_experience:.0f}" if job.min_experience else "3"
            max_exp = f"{job.max_experience:.0f}" if job.max_experience else "6"
            work_mode = "Remote" if job.is_remote else "Hybrid / Full-Time"
            budget_str = f"₹{job.max_ctc:.1f} LPA" if job.max_ctc else "Competitive / Open for right talent"
            salary_int = int(job.max_ctc * 100000) if job.max_ctc else 1200000
            app_link = application_url or f"http://localhost:5173/careers/{job.id}"

            # -----------------------------------------------------------------
            # 1. LinkedIn Feed Post
            # -----------------------------------------------------------------
            hashtags = [
                "#Hiring",
                "#TechJobs",
                "#IndiaTech",
                f"#{title.replace(' ', '')}",
                *[f"#{s.replace(' ', '').replace('.', '')}" for s in must_skills[:3]]
            ]
            linkedin_post = (
                f"🚀 We are #Hiring: {title}! 🚀\n\n"
                f"Are you an experienced developer looking for your next challenge building high-impact systems? "
                f"We are expanding our core engineering team in {location}.\n\n"
                f"📍 Role: {title}\n"
                f"🏢 Work Mode: {work_mode}\n"
                f"🎯 Experience: {min_exp}–{max_exp} Years\n"
                f"💰 Budget / CTC: Up to {budget_str}\n\n"
                f"Key Skills We Value:\n"
                f"• Core Stack: {', '.join(must_skills) if must_skills else 'Strong backend fundamentals'}\n"
                f"• Nice to have: {', '.join(nice_skills) if nice_skills else 'Cloud deployment, CI/CD, Microservices'}\n\n"
                f"What we offer:\n"
                f"✅ High-growth engineering culture\n"
                f"✅ Competitive compensation & performance bonuses\n"
                f"✅ Flexible work environment\n\n"
                f"👉 Apply directly or express interest via our secure 1-minute form:\n"
                f"{app_link}\n\n"
                f"Feel free to DM me or tag someone who might be a great fit!\n\n"
                f"{' '.join(hashtags)}"
            )

            # -----------------------------------------------------------------
            # 2. Naukri / Foundit Job Ad Description
            # -----------------------------------------------------------------
            naukri_ad = (
                f"Job Title: {title}\n"
                f"Company: {company_name}\n"
                f"Experience: {min_exp} to {max_exp} years\n"
                f"Location: {location}\n"
                f"Salary: {budget_str}\n"
                f"Employment Type: Full Time, Permanent\n\n"
                f"Job Description:\n"
                f"We are actively seeking a talented and proactive {title} to design, develop, and maintain "
                f"robust software solutions. The ideal candidate will have extensive hands-on experience with "
                f"{', '.join(must_skills[:4]) if must_skills else 'modern architecture and scalable code'}.\n\n"
                f"Key Responsibilities:\n"
                f"• Architect and implement resilient, testable, and maintainable services.\n"
                f"• Collaborate with cross-functional product, QA, and DevOps teams to deliver features on schedule.\n"
                f"• Troubleshoot performance bottlenecks, optimize database queries, and ensure 99.9% uptime.\n"
                f"• Participate in code reviews, technical grooming, and architecture design reviews.\n\n"
                f"Mandatory Qualifications:\n"
                f"• {min_exp}+ years of relevant production experience in {must_skills[0] if must_skills else 'core technology'}.\n"
                f"• Strong proficiency in: {', '.join(must_skills)}.\n"
                f"• Solid understanding of relational/NoSQL databases, RESTful APIs, and cloud basics.\n\n"
                f"Good to Have:\n"
                f"• Familiarity with: {', '.join(nice_skills) if nice_skills else 'Docker, Kubernetes, AWS/GCP'}.\n"
                f"• Bachelor's/Master's degree in Computer Science, IT, or equivalent practical experience.\n\n"
                f"How to Apply:\n"
                f"Submit your profile or resume directly through our fast-track hiring link:\n"
                f"{app_link}"
            )

            # -----------------------------------------------------------------
            # 3. WhatsApp / Telegram Group Broadcast
            # -----------------------------------------------------------------
            broadcast_msg = (
                f"🔥 *URGENT HIRING ALERT* 🔥\n\n"
                f"📌 *Role:* {title}\n"
                f"📍 *Location:* {location} ({work_mode})\n"
                f"💼 *Experience:* {min_exp}–{max_exp} Years\n"
                f"💵 *Package:* Up to {budget_str}\n"
                f"🛠️ *Stack:* {', '.join(must_skills[:4]) if must_skills else 'Full Stack'}\n\n"
                f"⚡ *Immediate joiners / 15–30 days notice preferred!*\n\n"
                f"Interested candidates can review details and apply in 1-click here:\n"
                f"👉 {app_link}\n\n"
                f"Please share with relevant tech networks & friends! 🙏"
            )

            # -----------------------------------------------------------------
            # 4. Schema.org JSON-LD Structured Data
            # -----------------------------------------------------------------
            date_posted = job.created_at.strftime("%Y-%m-%d") if job.created_at else datetime.now().strftime("%Y-%m-%d")
            json_ld = {
                "@context": "https://schema.org/",
                "@type": "JobPosting",
                "title": title,
                "description": f"Hiring {title} with expertise in {', '.join(must_skills)}. Location: {location}.",
                "identifier": {
                    "@type": "PropertyValue",
                    "name": company_name,
                    "value": job.id
                },
                "datePosted": date_posted,
                "validThrough": (datetime.now().replace(year=datetime.now().year + 1)).strftime("%Y-%m-%d"),
                "employmentType": "FULL_TIME",
                "hiringOrganization": {
                    "@type": "Organization",
                    "name": company_name,
                    "sameAs": "https://talentscout.ai"
                },
                "jobLocation": {
                    "@type": "Place",
                    "address": {
                        "@type": "PostalAddress",
                        "addressLocality": location.split(",")[0].strip(),
                        "addressCountry": "IN"
                    }
                },
                "baseSalary": {
                    "@type": "MonetaryAmount",
                    "currency": "INR",
                    "value": {
                        "@type": "QuantitativeValue",
                        "value": salary_int,
                        "unitText": "YEAR"
                    }
                }
            }

            return {
                "job_id": job.id,
                "job_title": title,
                "company_name": company_name,
                "application_url": app_link,
                "postings": {
                    "linkedin_post": {
                        "platform": "LinkedIn Feed",
                        "content": linkedin_post,
                        "description": "Engaging social post with hooks, emojis, requirements, and hashtags."
                    },
                    "naukri_ad": {
                        "platform": "Naukri / Foundit Job Ad",
                        "content": naukri_ad,
                        "description": "Comprehensive job board listing with responsibilities and requirements."
                    },
                    "whatsapp_broadcast": {
                        "platform": "WhatsApp / Telegram Broadcast",
                        "content": broadcast_msg,
                        "description": "Crisp instant messaging copy for recruiter networks and groups."
                    }
                },
                "schema_json_ld": json_ld
            }

    def generate_careers_page_html(
        self,
        job_id: str,
        company_name: str = "Enterprise Technology Partner",
        application_url: Optional[str] = None
    ) -> str:
        """Generate a complete standalone, beautifully styled HTML careers page with Google for Jobs metadata."""
        posting_data = self.generate_postings_for_job(job_id, company_name, application_url)
        json_ld_str = json.dumps(posting_data["schema_json_ld"], indent=2)

        with Session(engine, expire_on_commit=False) as session:
            job = session.get(Job, job_id)
            title = job.title if job and job.title else "Software Developer"
            must_skills = json.loads(job.must_have_skills) if job and job.must_have_skills else []
            nice_skills = json.loads(job.nice_to_have_skills) if job and job.nice_to_have_skills else []
            locations_list = json.loads(job.locations) if job and job.locations else []
            location = ", ".join(locations_list) if locations_list else "India"
            work_mode = "Remote" if job and job.is_remote else "Hybrid / Full-Time"
            min_exp = f"{job.min_experience:.0f}" if job and job.min_experience else "3"
            max_exp = f"{job.max_experience:.0f}" if job and job.max_experience else "6"
            budget_str = f"₹{job.max_ctc:.1f} LPA" if job and job.max_ctc else "Competitive CTC"
            app_url = posting_data["application_url"]

        skill_tags_html = "".join([f'<span class="skill-tag">{s}</span>' for s in must_skills])
        nice_tags_html = "".join([f'<span class="skill-tag skill-nice">{s}</span>' for s in nice_skills])

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} — {company_name} Careers</title>
  <meta name="description" content="We are hiring a {title} ({min_exp}-{max_exp} yrs) in {location}. Apply now.">
  
  <!-- Schema.org Google for Jobs Structured Data -->
  <script type="application/ld+json">
{json_ld_str}
  </script>

  <style>
    :root {{
      --bg: #0b0f19;
      --card: #111827;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --border: rgba(255, 255, 255, 0.12);
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text-main);
      padding: 40px 20px;
      line-height: 1.6;
    }}
    .container {{
      max-width: 780px;
      margin: 0 auto;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 36px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }}
    .badge {{
      display: inline-block;
      padding: 4px 10px;
      border-radius: 20px;
      background: rgba(99, 102, 241, 0.18);
      color: #818cf8;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 14px;
    }}
    h1 {{ font-size: 28px; font-weight: 800; margin-bottom: 8px; color: #fff; }}
    .meta-row {{
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      color: var(--text-muted);
      font-size: 14px;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }}
    .meta-item {{ display: flex; align-items: center; gap: 6px; }}
    h2 {{ font-size: 18px; margin: 24px 0 12px; color: #e2e8f0; }}
    p, li {{ color: #cbd5e1; font-size: 15px; margin-bottom: 10px; }}
    ul {{ padding-left: 20px; margin-bottom: 20px; }}
    .skill-tag {{
      display: inline-block;
      padding: 4px 10px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 13px;
      margin: 4px;
    }}
    .skill-nice {{ color: #a5b4fc; background: rgba(99, 102, 241, 0.1); }}
    .apply-box {{
      margin-top: 36px;
      padding: 24px;
      background: rgba(99, 102, 241, 0.08);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 12px;
      text-align: center;
    }}
    .apply-btn {{
      display: inline-block;
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      color: #fff;
      font-weight: 700;
      padding: 12px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 16px;
      transition: opacity 0.2s;
      margin-top: 12px;
    }}
    .apply-btn:hover {{ opacity: 0.9; }}
    .footer-note {{
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 14px;
    }}
  </style>
</head>
<body>
  <div class="container">
    <span class="badge">Immediate Requirement</span>
    <h1>{title}</h1>
    
    <div class="meta-row">
      <div class="meta-item">🏢 {company_name}</div>
      <div class="meta-item">📍 {location} ({work_mode})</div>
      <div class="meta-item">⏳ {min_exp}–{max_exp} Years Exp</div>
      <div class="meta-item">💰 {budget_str}</div>
    </div>

    <h2>About the Position</h2>
    <p>
      We are looking for an experienced {title} to contribute to cutting-edge software architecture,
      scalable API services, and resilient system engineering.
    </p>

    <h2>Must-Have Competencies</h2>
    <div style="margin-bottom: 16px;">
      {skill_tags_html}
    </div>

    <h2>Nice-to-Have Skills</h2>
    <div style="margin-bottom: 16px;">
      {nice_tags_html}
    </div>

    <h2>Responsibilities</h2>
    <ul>
      <li>Design, implement, and maintain high-performance, fault-tolerant backend and full-stack services.</li>
      <li>Write clean, modular code with comprehensive unit and integration test coverage.</li>
      <li>Work closely with product managers and fellow engineers to continuously ship improvements.</li>
      <li>Troubleshoot production incidents, analyze logs, and optimize database queries.</li>
    </ul>

    <div class="apply-box">
      <h3 style="color: #fff; margin-bottom: 6px;">Interested in Joining Us?</h3>
      <p style="font-size: 14px; color: var(--text-muted);">
        Submit your updated profile or resume. Our talent acquisition team reviews every submission within 24–48 hours.
      </p>
      <a href="{app_url}" class="apply-btn">Submit Fast-Track Application &rarr;</a>
      <div class="footer-note">Compliant with the Digital Personal Data Protection (DPDP) Act. Your data is strictly confidential.</div>
    </div>
  </div>
</body>
</html>
"""
        return html
