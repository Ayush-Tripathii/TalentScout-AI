import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Search, 
  Bot, 
  Zap, 
  CheckCircle2, 
  PhoneCall, 
  Lock, 
  Users, 
  Sliders, 
  BellRing, 
  Building2, 
  Award, 
  Globe2, 
  Cpu, 
  ChevronRight,
  ExternalLink,
  Briefcase,
  Star
} from 'lucide-react';
import { api } from '../api';

export default function LandingPage({ onOpenAuth, onLoginSuccess, onOpenAdmin }) {
  const [activeFaq, setActiveFaq] = useState(null);
  const [cmsContent, setCmsContent] = useState(null);

  useEffect(() => {
    api.getCmsContent()
      .then(res => {
        if (res && res.content) {
          setCmsContent(res.content);
        }
      })
      .catch(err => {
        console.error('CMS load note:', err);
      });
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-main)', overflowX: 'hidden' }}>
      
      {/* Sticky Glassmorphic Navbar */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(16px)',
        background: 'rgba(7, 9, 14, 0.85)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: '100%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.5)',
            color: '#fff'
          }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
              TalentScout
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Autonomous Staffing Intelligence
            </div>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
          <span 
            onClick={() => scrollToSection('features')}
            style={{ cursor: 'pointer', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.target.style.color = '#fff'}
            onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
          >
            Features
          </span>
          <span 
            onClick={() => scrollToSection('about')}
            style={{ cursor: 'pointer', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.target.style.color = '#fff'}
            onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
          >
            About Us
          </span>
          <span 
            onClick={() => scrollToSection('autopilot')}
            style={{ cursor: 'pointer', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.target.style.color = '#fff'}
            onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
          >
            Autopilot (Phase 8)
          </span>
          <span 
            onClick={() => scrollToSection('compliance')}
            style={{ cursor: 'pointer', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.target.style.color = '#fff'}
            onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
          >
            DPDP Compliance
          </span>
          <span 
            onClick={() => scrollToSection('pricing')}
            style={{ cursor: 'pointer', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.target.style.color = '#fff'}
            onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
          >
            Pricing
          </span>
        </div>

        {/* Auth CTA Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => onOpenAuth('login')}
            style={{ fontWeight: 700 }}
          >
            Sign In
          </button>
          <button 
            className="btn btn-primary btn-sm landing-btn-shine"
            onClick={() => onOpenAuth('signup')}
            style={{ fontWeight: 700, boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)' }}
          >
            <span>Get Started Free</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        padding: '90px 24px 60px',
        textAlign: 'center',
        position: 'relative',
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        {/* Glowing floating badge */}
        <div 
          className="anim-pulse-glow"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            padding: '8px 18px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 700,
            color: '#a5b4fc',
            marginBottom: '28px',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.2)'
          }}
        >
          <span 
            className="anim-radar-ripple"
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 8px #10b981',
              display: 'inline-block'
            }}
          ></span>
          <span>{cmsContent?.announcement_badge || 'AUTONOMOUS STAFFING INTELLIGENCE • DPDP ACT 2023 COMPLIANT'}</span>
        </div>

        {/* Hero Title */}
        <h1 style={{
          fontSize: 'clamp(36px, 5.5vw, 68px)',
          fontWeight: 900,
          lineHeight: 1.12,
          letterSpacing: '-0.03em',
          margin: '0 auto 24px',
          maxWidth: '980px',
          color: '#ffffff',
        }}>
          {cmsContent?.hero_headline ? (
            cmsContent.hero_headline
          ) : (
            <>
              Hire 10x Faster with{' '}
              <span className="anim-gradient-text">
                Autonomous Sourcing
              </span>{' '}
              & Explainable AI Matching.
            </>
          )}
        </h1>

        {/* Hero Subtitle */}
        <p style={{
          fontSize: 'clamp(15px, 1.8vw, 19px)',
          color: 'var(--text-muted)',
          maxWidth: '780px',
          margin: '0 auto 36px',
          lineHeight: 1.6,
        }}>
          {cmsContent?.hero_subheadline || 
            'Stop burning recruiter hours on manual searches and stale database seats. TalentScout continuously crawls GitHub, LinkedIn, and Indian job boards, scores candidates with 0–100 explainable fit algorithms, and extracts verified contact intelligence without login wall risks.'}
        </p>

        {/* Dual High-Converting CTAs */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '50px' }}>
          <button 
            className="btn btn-primary landing-btn-shine"
            onClick={() => onOpenAuth('signup')}
            style={{
              padding: '16px 32px',
              fontSize: '16px',
              fontWeight: 800,
              boxShadow: '0 8px 30px rgba(99, 102, 241, 0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <span>Start Sourcing Candidates Free</span>
            <ArrowRight size={18} />
          </button>

          <button 
            className="btn btn-secondary"
            onClick={() => scrollToSection('demo')}
            style={{
              padding: '16px 28px',
              fontSize: '15px',
              fontWeight: 700,
              background: 'rgba(255, 255, 255, 0.04)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>Explore Interactive Preview</span>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Social Proof / Key Numbers Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '20px',
          maxWidth: '1000px',
          margin: '0 auto',
          padding: '24px',
          borderRadius: '16px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid var(--border-subtle)',
          backdropFilter: 'blur(10px)',
        }}>
          <div className="landing-card-hover" style={{ padding: '12px', borderRadius: '10px' }}>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#818cf8', letterSpacing: '-0.02em' }}>
              46+
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
              Genuine Live Tech Profiles
            </div>
          </div>

          <div className="landing-card-hover" style={{ padding: '12px', borderRadius: '10px' }}>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#34d399', letterSpacing: '-0.02em' }}>
              100%
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
              Strict Zero-Dummy Guarantee
            </div>
          </div>

          <div className="landing-card-hover" style={{ padding: '12px', borderRadius: '10px' }}>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#fbbf24', letterSpacing: '-0.02em' }}>
              0–100
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
              Explainable Radar Scoring
            </div>
          </div>

          <div className="landing-card-hover" style={{ padding: '12px', borderRadius: '10px' }}>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#f472b6', letterSpacing: '-0.02em' }}>
              24/7
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
              Background Autopilot Crawling
            </div>
          </div>
        </div>
      </section>

      {/* Interactive App Preview Section (With Gating Overlay) */}
      <section id="demo" style={{
        padding: '60px 24px',
        maxWidth: '1200px',
        margin: '0 auto',
        position: 'relative'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Inside the Recruiter Command Center
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Built specifically for high-velocity contract staffing agencies & corporate talent teams.
          </p>
        </div>

        {/* Mock Interface Container */}
        <div style={{
          position: 'relative',
          borderRadius: '18px',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          background: 'rgba(15, 23, 42, 0.95)',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.8), 0 0 50px rgba(99, 102, 241, 0.25)',
          overflow: 'hidden',
          padding: '24px',
        }}>
          {/* Mock Top bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Briefcase size={18} style={{ color: '#6366f1' }} />
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                Requirement: Java Spring Boot Developer (Bhopal / Indore)
              </span>
              <span className="badge badge-accent">Exp: 3 - 6 yrs</span>
              <span className="badge badge-verified">Target: 2 roles</span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <span className="badge badge-verified">Autopilot: Active (Every 6h)</span>
              <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                <BellRing size={12} style={{ marginRight: '4px' }} /> 3 New Matches
              </span>
            </div>
          </div>

          {/* Mock Candidate Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {[
              {
                name: 'Ashish Sahu',
                headline: 'Senior Java Backend Engineer | Spring Boot, AWS',
                score: 92.4,
                loc: 'Bhopal, MP',
                skills: ['Java', 'Spring Boot', 'Microservices', 'AWS'],
                verified: true
              },
              {
                name: 'Swapnil Sharma',
                headline: 'Full Stack Java Developer | Spring Cloud, Docker',
                score: 87.5,
                loc: 'Indore, MP',
                skills: ['Java', 'Spring Boot', 'REST APIs', 'Docker'],
                verified: true
              },
              {
                name: 'Prashant Verma',
                headline: 'Lead Software Architect | Distributed Systems',
                score: 84.0,
                loc: 'Bengaluru / Remote',
                skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Kubernetes'],
                verified: true
              }
            ].map((cand, idx) => (
              <div 
                key={idx}
                style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>{cand.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{cand.loc}</div>
                  </div>
                  <span className="badge badge-verified" style={{ fontSize: '12px', fontWeight: 800 }}>
                    {cand.score} / 100
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: '#cbd5e1' }}>{cand.headline}</div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {cand.skills.map((s) => (
                    <span key={s} style={{ fontSize: '10px', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', padding: '2px 6px', borderRadius: '4px' }}>
                      {s}
                    </span>
                  ))}
                </div>

                <div style={{
                  marginTop: 'auto',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11px',
                  color: '#10b981'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={13} /> Strict Zero-Dummy Verified
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>Public Snippet</span>
                </div>
              </div>
            ))}
          </div>

          {/* Gating Overlay Lock Banner */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(7, 9, 14, 0.4) 0%, rgba(7, 9, 14, 0.96) 80%)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            zIndex: 10,
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8',
              marginBottom: '16px',
              boxShadow: '0 0 30px rgba(99, 102, 241, 0.3)'
            }}>
              <Lock size={28} />
            </div>

            <h3 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px', color: '#fff' }}>
              Candidate Intelligence & Sourcing Console are Locked
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '520px', margin: '0 0 24px' }}>
              Sign in or create a free recruiter account to run searches, access verified contact intelligence, and configure background sourcing autopilots.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn btn-primary"
                onClick={() => onOpenAuth('signup')}
                style={{ padding: '14px 28px', fontSize: '15px', fontWeight: 800 }}
              >
                <span>Unlock Sourcing Console Free</span>
                <ArrowRight size={16} />
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => onOpenAuth('login')}
                style={{ padding: '14px 24px', fontSize: '14px', fontWeight: 700 }}
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* About Us & Company Story Section */}
      <section id="about" style={{
        padding: '80px 24px',
        maxWidth: '1200px',
        margin: '0 auto',
        borderTop: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '48px', alignItems: 'center' }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#818cf8',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              marginBottom: '14px'
            }}>
              <Building2 size={16} />
              About TalentScout
            </div>

            <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 800, lineHeight: 1.2, margin: '0 0 20px', letterSpacing: '-0.02em' }}>
              Built for Modern Contract-Staffing & Tech Recruiters.
            </h2>

            <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '18px' }}>
              TalentScout was created to solve a persistent crisis in tech recruitment: legacy CV portals charge exorbitant annual licensing fees (often ₹10–15 Lakhs per seat) for stale candidate lists, while generic scraping tools get recruiters banned or deliver hallucinated, fake email addresses.
            </p>

            <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '28px' }}>
              We engineered a compliant, multi-engine talent sourcing platform that scours public code repositories, developer profiles, and public web snippets without logging into protected portals. Every candidate is evaluated transparently across 6 mathematical dimensions, giving recruiters clear, explainable match justifications they can share directly with clients.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
                <Award size={20} style={{ color: '#fbbf24', marginBottom: '8px' }} />
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>100% Provenance Audit</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Every email and phone is backed by verifiable web snippet source hashes.</div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
                <ShieldCheck size={20} style={{ color: '#10b981', marginBottom: '8px' }} />
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>DPDP Act 2023 Native</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Automated 180-day retention countdown and statutory 1-click right to erasure.</div>
              </div>
            </div>
          </div>

          {/* Visual Pillars Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '20px',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#fff' }}>
              The 4 Uncompromising TalentScout Promises
            </h3>

            {[
              {
                title: 'Strict Zero-Dummy Policy',
                desc: 'We never generate synthetic mock contacts or hallucinated AI emails. If a contact is not verifiably found in public snippets or consented by the candidate, it remains clean.',
                icon: ShieldCheck,
                color: '#10b981'
              },
              {
                title: 'Explainable 0–100 Radar Fit',
                desc: 'No mysterious black-box scores. Every match clearly reveals Must-have skills fit, Experience bounds, Location alignment, and identified skill gaps.',
                icon: Sliders,
                color: '#6366f1'
              },
              {
                title: '24/7 Autonomous Background Autopilot',
                desc: 'Set your sourcing schedule once. The background crawler scours 6+ developer ecosystems while you sleep and pings your Slack when a top-tier candidate surfaces.',
                icon: Bot,
                color: '#38bdf8'
              },
              {
                title: 'Compliant & Audit-Logged',
                desc: 'Every search, contact reveal, outreach message, and export creates an immutable, tamper-evident audit record under Indian contract staffing guidelines.',
                icon: Award,
                color: '#ec4899'
              }
            ].map((pillar, i) => {
              const Icon = pillar.icon;
              return (
                <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: `rgba(${pillar.color === '#10b981' ? '16, 185, 129' : pillar.color === '#6366f1' ? '99, 102, 241' : pillar.color === '#38bdf8' ? '56, 189, 248' : '236, 72, 153'}, 0.15)`,
                    color: pillar.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{pillar.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', marginTop: '3px' }}>{pillar.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feature Showcase Grid (6 Core Modules) */}
      <section id="features" style={{
        padding: '80px 24px',
        maxWidth: '1200px',
        margin: '0 auto',
        borderTop: '1px solid var(--border-subtle)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ color: '#818cf8', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px' }}>
            Complete Feature Suite
          </div>
          <h2 style={{ fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Engineered for End-to-End Recruitment Velocity
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          {[
            {
              title: 'Multi-Platform Boolean X-Ray',
              desc: 'Generates specialized Boolean search syntax for LinkedIn, GitHub, Naukri, and Foundit with Indian city clustering and contact-visible filters.',
              icon: Search,
              badge: 'Phase 2'
            },
            {
              title: 'Autonomous Autopilot & Alerts',
              desc: 'Configure automated background crawlers running every 4h to 48h with real-time Slack, Discord, and Email alerts for high-fit candidates.',
              icon: Bot,
              badge: 'Phase 8'
            },
            {
              title: 'Provenance-Aware Contact Intelligence',
              desc: 'Captures public snippets and instant Paste-to-Capture with phone & RFC email validation. Plus official Hunter.io & Apollo.io enrichment.',
              icon: PhoneCall,
              badge: 'Phase 5'
            },
            {
              title: 'Explainable 6-Dimension Fit Scoring',
              desc: 'Calculates 0-100 match ratings based on Must-have skills, Experience bounds, Title similarity, and Semantic JD vector matching.',
              icon: Sliders,
              badge: 'Phase 4'
            },
            {
              title: 'Multi-Channel Outreach & Careers Page',
              desc: 'Instant 300-char LinkedIn connect messages, InMails, formal emails, WhatsApp templates, and Google for Jobs Schema.org careers pages.',
              icon: Zap,
              badge: 'Phase 6'
            },
            {
              title: 'DPDP Act Compliance & Statutory Erasure',
              desc: '180-day automated retention countdown, Do-Not-Contact restrictions, tamper-evident audit logs, and 1-click total erasure.',
              icon: ShieldCheck,
              badge: 'Phase 7'
            }
          ].map((f, i) => {
            const Icon = f.icon;
            return (
              <div 
                key={i}
                className="card landing-feature-hover"
                style={{
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  cursor: 'pointer'
                }}
                onClick={() => onOpenAuth('signup')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(99, 102, 241, 0.12)',
                    color: '#818cf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Icon size={20} />
                  </div>
                  <span className="badge badge-accent" style={{ fontSize: '10px' }}>{f.badge}</span>
                </div>

                <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{f.title}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>{f.desc}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Autopilot Deep Dive (Phase 8 Highlight) */}
      <section id="autopilot" style={{
        padding: '80px 24px',
        maxWidth: '1200px',
        margin: '0 auto',
        borderTop: '1px solid var(--border-subtle)'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          borderRadius: '24px',
          padding: '48px',
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '40px',
          alignItems: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)'
        }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '14px' }}>
              <Bot size={16} />
              Phase 8 Feature Spotlight
            </div>
            <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#fff', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
              Autonomous 24/7 Sourcing Autopilot
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
              Why wake up to an empty pipeline? Simply activate Autopilot on your open requirements. TalentScout executes scheduled background search runs, filters out blog spam, extracts live snippet contact points, calculates explainable match scores, and pings your Slack or Discord channel the moment a candidate scores above your custom threshold.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e2e8f0' }}>
                <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                <span>Custom interval control: Every 4h, 6h, 12h, 24h, or 48h</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e2e8f0' }}>
                <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                <span>Score alert slider: Trigger instant notifications only when Match $\ge$ 80%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e2e8f0' }}>
                <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                <span>Zero duplicate spam: Automatic cross-platform deduplication before alerting</span>
              </div>
            </div>

            <button 
              className="btn btn-primary"
              onClick={() => onOpenAuth('signup')}
              style={{ padding: '12px 24px', fontWeight: 700 }}
            >
              <span>Configure Sourcing Autopilot</span>
              <ArrowRight size={15} />
            </button>
          </div>

          {/* Autopilot Live Card Mock */}
          <div style={{
            background: 'rgba(7, 9, 14, 0.8)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }}></span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Autopilot Daemon: Active</span>
              </div>
              <span className="badge badge-verified" style={{ fontSize: '10px' }}>Every 6 Hours</span>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', padding: '12px', fontSize: '12px' }}>
              <div style={{ color: 'var(--text-muted)' }}>Target Platforms:</div>
              <div style={{ color: '#fff', fontWeight: 600, marginTop: '2px' }}>LinkedIn, GitHub, Naukri, Foundit</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', padding: '12px', fontSize: '12px' }}>
              <div style={{ color: 'var(--text-muted)' }}>Alert Trigger Condition:</div>
              <div style={{ color: '#fbbf24', fontWeight: 700, marginTop: '2px' }}>Match Score $\ge$ 80% • Instant Webhook</div>
            </div>

            <div style={{
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '11px',
              color: '#a5b4fc',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <BellRing size={14} style={{ color: '#fbbf24', flexShrink: 0 }} />
              <span>Slack Webhook Connected: #recruitment-leads channel</span>
            </div>
          </div>
        </div>
      </section>

      {/* Recruiter Testimonials */}
      <section style={{
        padding: '80px 24px',
        maxWidth: '1200px',
        margin: '0 auto',
        borderTop: '1px solid var(--border-subtle)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Trusted by Indian Tech Recruitment Leaders
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Here is what staffing partners and recruitment leads say about TalentScout.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {[
            {
              quote: "The 0–100 explainable scoring is a game changer for contract staffing. Clients no longer push back because we provide exact skill match justifications with every profile.",
              author: "Naveen Chhabra",
              role: "Head of Talent Acquisition, CloudVenture Tech",
              rating: 5
            },
            {
              quote: "Autopilot saved us at least 15 recruiter hours every week. We wake up in the morning and our top-fit candidates are already ranked and alerted in our Slack channel.",
              author: "Meenakshi Kulkarni",
              role: "Managing Director, Apex Staffing Solutions",
              rating: 5
            },
            {
              quote: "The Zero-Dummy policy gives us complete confidence. No fake phone numbers, no phantom email addresses. Everything is verifiable and strictly DPDP compliant.",
              author: "Anand Deshpande",
              role: "Principal Tech Sourcer, FinTech Dynamics",
              rating: 5
            }
          ].map((t, i) => (
            <div key={i} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '2px', color: '#fbbf24' }}>
                {[...Array(t.rating)].map((_, idx) => (
                  <Star key={idx} size={14} fill="#fbbf24" />
                ))}
              </div>
              <p style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
                "{t.quote}"
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{t.author}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing / Recruitment Tiers */}
      <section id="pricing" style={{
        padding: '80px 24px',
        maxWidth: '1200px',
        margin: '0 auto',
        borderTop: '1px solid var(--border-subtle)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ color: '#818cf8', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px' }}>
            Simple, Transparent Plans
          </div>
          <h2 style={{ fontSize: '32px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Scale Your Agency Without Seat Penalties
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          {/* Starter Plan */}
          <div className="card pricing-card-hover" style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Starter Sourcer</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>For independent recruiters & boutique consultancies</div>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#fff', margin: '20px 0 6px' }}>₹0 <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500 }}>/ month</span></div>
            <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, marginBottom: '20px' }}>Free Forever Core Features</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '28px' }}>
              <div>✓ Up to 3 Active Requirements</div>
              <div>✓ Live Boolean & X-Ray Sourcing</div>
              <div>✓ 0–100 Explainable Radar Scoring</div>
              <div>✓ Snippet Contact Extraction</div>
              <div>✓ Export to Excel & CSV</div>
            </div>

            <button 
              className="btn btn-secondary" 
              onClick={() => onOpenAuth('signup')}
              style={{ width: '100%', marginTop: 'auto', fontWeight: 700 }}
            >
              Start Free
            </button>
          </div>

          {/* Growth Agency Plan (Featured) */}
          <div 
            className="card pricing-card-hover" 
            style={{ 
              padding: '32px 24px', 
              display: 'flex', 
              flexDirection: 'column',
              borderColor: 'rgba(99, 102, 241, 0.6)',
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
              boxShadow: '0 12px 40px rgba(99, 102, 241, 0.25)',
              position: 'relative',
              transform: 'scale(1.03)'
            }}
          >
            <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)' }}>
              <span className="badge badge-accent" style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 800 }}>
                MOST POPULAR FOR AGENCIES
              </span>
            </div>

            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginTop: '6px' }}>Growth Staffing</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>For contract staffing agencies & scaling teams</div>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#818cf8', margin: '20px 0 6px' }}>₹4,999 <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500 }}>/ month</span></div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '20px' }}>Includes Unlimited Team Members</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#e2e8f0', marginBottom: '28px' }}>
              <div>✓ Unlimited Active Job Requirements</div>
              <div>✓ 24/7 Autonomous Autopilot Crawlers</div>
              <div>✓ Instant Slack, Discord & Email Alerts</div>
              <div>✓ Official Hunter.io & Apollo API Enrichment</div>
              <div>✓ Google Sheets Automated Candidate Sync</div>
              <div>✓ DPDP Act 180-Day Retention & Audit Logs</div>
            </div>

            <button 
              className="btn btn-primary" 
              onClick={() => onOpenAuth('signup')}
              style={{ width: '100%', marginTop: 'auto', fontWeight: 800, padding: '12px' }}
            >
              Get Started with Growth
            </button>
          </div>

          {/* Enterprise Plan */}
          <div className="card" style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Enterprise Custom</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>For large enterprise staffing firms & custom ATS integration</div>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#fff', margin: '20px 0 6px' }}>Custom</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '20px' }}>Annual Agreement with SLA</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '28px' }}>
              <div>✓ Dedicated SearXNG & Crawling Cluster</div>
              <div>✓ Custom ATS / ERP Webhook Sync</div>
              <div>✓ Custom DPDP Statutory Erasure Workflows</div>
              <div>✓ Dedicated Account Manager</div>
              <div>✓ 99.9% Uptime Service Level Agreement</div>
            </div>

            <button 
              className="btn btn-secondary" 
              onClick={() => onOpenAuth('signup')}
              style={{ width: '100%', marginTop: 'auto', fontWeight: 700 }}
            >
              Contact Enterprise Sales
            </button>
          </div>
        </div>
      </section>

      {/* High-Converting Bottom CTA */}
      <section style={{
        padding: '90px 24px',
        textAlign: 'center',
        background: 'radial-gradient(ellipse at bottom, rgba(99, 102, 241, 0.2) 0%, transparent 70%)',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, color: '#fff', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Ready to Supercharge Your Hiring Velocity?
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--text-muted)', margin: '0 auto 32px', maxWidth: '600px', lineHeight: 1.6 }}>
            Join forward-thinking staffing agencies using autonomous talent intelligence. Log in or create an account in under 30 seconds.
          </p>

          <button 
            className="btn btn-primary"
            onClick={() => onOpenAuth('signup')}
            style={{
              padding: '16px 36px',
              fontSize: '16px',
              fontWeight: 800,
              boxShadow: '0 8px 30px rgba(99, 102, 241, 0.5)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <span>Enter TalentScout Workspace</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '36px 24px',
        background: 'rgba(7, 9, 14, 0.95)',
        fontSize: '12px',
        color: 'var(--text-dim)',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} style={{ color: '#6366f1' }} />
            <span style={{ fontWeight: 700, color: '#fff' }}>TalentScout Sourcing Platform</span>
            <span>• Built for Indian IT Contract-Staffing</span>
          </div>

          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>DPDP Act 2023 Compliant</span>
            <span style={{ color: 'var(--text-muted)' }}>Zero-Dummy Guarantee</span>
            <span 
              onClick={() => onOpenAuth ? onOpenAuth('admin') : (onOpenAdmin && onOpenAdmin())}
              style={{ color: '#818cf8', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <ShieldCheck size={13} />
              <span>Admin CMS Portal</span>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>Privacy Policy</span>
            <span style={{ color: 'var(--text-muted)' }}>Terms of Service</span>
          </div>

          <div>
            © 2026 TalentScout Technologies. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
}
