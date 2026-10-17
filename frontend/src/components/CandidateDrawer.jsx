import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Phone, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle, 
  Building2, 
  MapPin, 
  Calendar, 
  Save, 
  Copy, 
  Check, 
  FileText,
  Sparkles,
  TrendingUp,
  Award,
  ClipboardCheck,
  Send
} from 'lucide-react';
import { api } from '../api';

export default function CandidateDrawer({ 
  candidate, 
  ranking, 
  onClose, 
  onUpdateStage, 
  onUpdateNotes,
  onOpenQuickCapture,
  onOpenOutreachModal 
}) {
  const [copiedField, setCopiedField] = useState(null);
  const [notes, setNotes] = useState(candidate?.recruiter_notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [enrichMessage, setEnrichMessage] = useState(null);

  useEffect(() => {
    setNotes(candidate?.recruiter_notes || '');
    setEnrichMessage(null);
  }, [candidate]);

  if (!candidate) return null;

  const handleCopy = (text, field) => {
    if (!text || text === '—') return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      await api.updateCandidateNotes(candidate.id, notes);
      setSaveSuccess(true);
      if (onUpdateNotes) onUpdateNotes(candidate.id, notes);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      alert('Failed to save notes: ' + err.message);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleReveal = async () => {
    setIsRevealing(true);
    setEnrichMessage(null);
    try {
      const res = await api.revealContact(candidate.id, 'hunter');
      if (res?.status === 'success') {
        setEnrichMessage({ type: 'success', text: `Found email: ${res.email || 'Disclosed'}!` });
        if (res.email) {
          candidate.email = res.email;
          if (!candidate.emails) candidate.emails = [];
          if (!candidate.emails.includes(res.email)) candidate.emails.unshift(res.email);
        }
      } else if (res?.status === 'info') {
        setEnrichMessage({ type: 'info', text: res.message });
      } else {
        setEnrichMessage({ type: 'error', text: res?.message || 'Enrichment failed' });
      }
    } catch (err) {
      setEnrichMessage({ type: 'error', text: err.message });
    } finally {
      setIsRevealing(false);
    }
  };

  const score = ranking?.overall_score ?? candidate.overall_score ?? candidate.score ?? 0;
  const scoreClass = score >= 75 ? 'score-high' : score >= 50 ? 'score-mid' : 'score-low';

  const email = candidate.email || (candidate.emails && candidate.emails.length > 0 ? candidate.emails[0] : null);
  const phone = candidate.phone || (candidate.phones && candidate.phones.length > 0 ? candidate.phones[0] : null);
  const title = candidate.current_title || candidate.headline || 'Software Professional';
  const location = candidate.location || candidate.current_location || 'India';
  const profileUrl = candidate.profile_url || candidate.url || candidate.sources?.[0]?.url;
  const platform = (candidate.platform || candidate.sources?.[0]?.platform || 'web').toLowerCase();
  const bData = candidate.breakdown || ranking?.breakdown || {};

  // Dimension details mapped to RankingEngine breakdown keys
  const breakdown = [
    { 
      label: 'Must-Have Skills Match', 
      value: Math.round(ranking?.must_have ?? bData?.must_have ?? bData?.technical ?? ranking?.technical_score ?? 0), 
      weight: '35%' 
    },
    { 
      label: 'Nice-to-Have Skills', 
      value: Math.round(ranking?.nice_to_have ?? bData?.nice_to_have ?? 0), 
      weight: '15%' 
    },
    { 
      label: 'Experience Fit', 
      value: Math.round(ranking?.experience ?? bData?.experience ?? ranking?.experience_score ?? 0), 
      weight: '15%' 
    },
    { 
      label: 'Location Fit', 
      value: Math.round(ranking?.location ?? bData?.location ?? ranking?.location_score ?? 0), 
      weight: '15%' 
    },
    { 
      label: 'Role Title Match', 
      value: Math.round(ranking?.title ?? bData?.title ?? ranking?.seniority_score ?? 0), 
      weight: '10%' 
    },
    { 
      label: 'Semantic JD Alignment', 
      value: Math.round(ranking?.semantic ?? bData?.semantic ?? 0), 
      weight: '10%' 
    },
  ];

  const whyBullets = Array.isArray(candidate.why_bullets) 
    ? candidate.why_bullets 
    : (Array.isArray(ranking?.why_bullets) ? ranking.why_bullets : []);
  const missingSkills = Array.isArray(candidate.missing_skills) 
    ? candidate.missing_skills 
    : (Array.isArray(ranking?.missing_skills) ? ranking.missing_skills : []);
  const explanation = ranking?.explanation || candidate?.explanation;


  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel animate-fade-in">
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.85)'
        }}>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', fontWeight: 700 }}>
              Candidate Intelligence Dossier
            </span>
            <h2 style={{ fontSize: '20px', margin: '4px 0 0', fontWeight: 800 }}>
              {candidate.full_name || 'Unnamed Candidate'}
            </h2>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Top Profile Summary Card */}
          <div className="glass-card" style={{ padding: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                {title}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px', color: 'var(--text-muted)' }}>
                {candidate.current_company && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Building2 size={14} style={{ color: 'var(--text-dim)' }} />
                    {candidate.current_company}
                  </span>
                )}
                {location && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <MapPin size={14} style={{ color: 'var(--text-dim)' }} />
                    {location}
                  </span>
                )}
              </div>
            </div>

            {/* Overall Score Gauge */}
            <div style={{ textAlign: 'right' }}>
              <div className={`score-badge ${scoreClass}`} style={{ fontSize: '18px', padding: '6px 14px', height: '36px' }}>
                {score} / 100
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px', fontWeight: 600 }}>
                {score >= 75 ? 'Strong Match' : score >= 50 ? 'Moderate Fit' : 'Low Match'}
              </div>
            </div>
          </div>

          {/* Genuine Verified Source Platform & Live Profile Link */}
          <div className="glass-card" style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
                <span className={`badge ${platform.includes('linkedin') ? 'badge-platform-linkedin' : platform.includes('github') ? 'badge-platform-github' : 'badge-accent'}`} style={{ fontSize: '11px', padding: '4px 8px', textTransform: 'uppercase' }}>
                  {platform}
                </span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                    Original Public Profile Link
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', maxWidth: '340px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profileUrl || 'Direct profile URL retrieved from public engine'}
                  </div>
                </div>
              </div>

              {profileUrl ? (
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', textDecoration: 'none', fontWeight: 600 }}
                >
                  <span>Open Live Profile</span>
                  <ExternalLink size={14} />
                </a>
              ) : (
                <span className="badge badge-blank">No public URL disclosed</span>
              )}
            </div>
          </div>

          {/* Genuine Verified Contact Intelligence */}
          <div className="glass-card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                  Verified Contact Intelligence
                </span>
              </div>
              <span className="badge badge-verified">
                Strict Zero-Dummy Policy
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Email Block */}
              <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={12} />
                  <span>Email Address</span>
                </div>
                {email ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success)' }}>
                      {email}
                    </span>
                    <button 
                      className="btn-icon" 
                      onClick={() => handleCopy(email, 'email')}
                      title="Copy email"
                    >
                      {copiedField === 'email' ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                    </button>
                  </div>
                ) : (
                  <span className="badge badge-blank">
                    — Not disclosed
                  </span>
                )}
              </div>

              {/* Phone Block */}
              <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={12} />
                  <span>Phone Number</span>
                </div>
                {phone ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success)' }}>
                      {phone}
                    </span>
                    <button 
                      className="btn-icon" 
                      onClick={() => handleCopy(phone, 'phone')}
                      title="Copy phone"
                    >
                      {copiedField === 'phone' ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                    </button>
                  </div>
                ) : (
                  <span className="badge badge-blank">
                    — Not disclosed
                  </span>
                )}
              </div>
            </div>

            {/* Acquisition & Enrichment Actions */}
            <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => onOpenQuickCapture && onOpenQuickCapture(candidate)}
                style={{
                  flex: 1,
                  background: 'rgba(16, 185, 129, 0.12)',
                  borderColor: 'rgba(16, 185, 129, 0.35)',
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
                title="Paste contact snippet from recruiter clipboard for instant extraction"
              >
                <ClipboardCheck size={14} />
                <span>Quick Paste Contact</span>
              </button>

              <button 
                className="btn btn-secondary btn-sm"
                onClick={handleReveal}
                disabled={isRevealing}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
                title="Search Hunter.io / Apollo.io"
              >
                <Sparkles size={14} className={isRevealing ? 'animate-spin' : ''} style={{ color: 'var(--accent-primary)' }} />
                <span>{isRevealing ? 'Enriching...' : 'Reveal Contact'}</span>
              </button>

              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => onOpenOutreachModal && onOpenOutreachModal(candidate)}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  background: 'rgba(99, 102, 241, 0.12)',
                  borderColor: 'rgba(99, 102, 241, 0.35)',
                  color: '#818cf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
                title="Generate personalized LinkedIn, InMail, Email, and WhatsApp messages"
              >
                <Send size={13} />
                <span>Generate Outreach Pitch</span>
              </button>
            </div>

            {enrichMessage && (
              <div style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                background: enrichMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${enrichMessage.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
                color: enrichMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {enrichMessage.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                <span>{enrichMessage.text}</span>
              </div>
            )}
            {candidate.profile_url && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                <a 
                  href={candidate.profile_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <ExternalLink size={14} />
                  <span>View Public Source Profile ({candidate.platform || 'Web'})</span>
                </a>
              </div>
            )}
          </div>

          {/* 6-Dimension Score Breakdown */}
          <div className="glass-card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <TrendingUp size={16} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                6-Dimension Match Breakdown
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {breakdown.map((b) => (
                <div key={b.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{b.label} <small style={{ color: 'var(--text-dim)' }}>({b.weight})</small></span>
                    <span style={{ fontWeight: 700, color: b.value >= 70 ? 'var(--success)' : b.value >= 50 ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {b.value}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${Math.min(100, Math.max(0, b.value))}%`, 
                        height: '100%', 
                        background: b.value >= 70 ? 'var(--success)' : b.value >= 50 ? 'var(--warning)' : 'var(--accent-primary)',
                        borderRadius: '3px',
                        transition: 'width 0.4s ease'
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* AI Reasoning & Why Bullets */}
            {(explanation || whyBullets.length > 0) && (
              <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#818cf8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={13} />
                  <span>AI Match Rationale</span>
                </div>
                {explanation && (
                  <div style={{ fontSize: '12px', color: 'var(--text-main)', lineHeight: 1.5, marginBottom: whyBullets.length > 0 ? '8px' : '0' }}>
                    {explanation}
                  </div>
                )}
                {whyBullets.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {whyBullets.map((bullet, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <CheckCircle size={13} style={{ color: 'var(--success)', marginTop: '2px', flexShrink: 0 }} />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Missing Skills Warning */}
            {missingSkills.length > 0 && (
              <div style={{ marginTop: '14px', padding: '12px', background: 'rgba(239, 68, 68, 0.06)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px', textTransform: 'uppercase' }}>
                  <AlertCircle size={13} />
                  <span>Missing / Unverified Skills ({missingSkills.length})</span>
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {missingSkills.map((s, idx) => (
                    <span key={idx} className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '11px' }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pipeline Stage Management */}
          <div className="glass-card" style={{ padding: '18px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', display: 'block', marginBottom: '8px' }}>
              Pipeline Stage
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['New', 'Screening', 'Interview', 'Shortlisted', 'Offered', 'Rejected'].map((stage) => {
                const isActive = (candidate.status || 'New').toLowerCase() === stage.toLowerCase();
                return (
                  <button
                    key={stage}
                    className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => onUpdateStage && onUpdateStage(candidate.id, stage)}
                  >
                    {stage}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recruiter Notes */}
          <div className="glass-card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>
                Recruiter Notes & Intel
              </span>
              {saveSuccess && (
                <span style={{ fontSize: '11px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={12} /> Saved
                </span>
              )}
            </div>
            <textarea
              className="input-text"
              rows={3}
              placeholder="Add screening observations, notice period, rate negotiations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
              >
                <Save size={13} />
                <span>{isSavingNotes ? 'Saving...' : 'Save Notes'}</span>
              </button>
            </div>
          </div>

          {/* Raw Resume / Snippet Content */}
          <div className="glass-card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <FileText size={15} style={{ color: 'var(--text-dim)' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                Raw Resume Text / Profile Snippet
              </span>
            </div>
            <pre style={{
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              maxHeight: '180px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              border: '1px solid var(--border-subtle)'
            }}>
              {candidate.snippet || candidate.parsed_text || 'No raw text or resume content available.'}
            </pre>
          </div>

        </div>
      </div>
    </>
  );
}
