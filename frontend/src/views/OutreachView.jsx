import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Briefcase, 
  MessageSquare, 
  Globe, 
  Copy, 
  Check, 
  ExternalLink, 
  RefreshCw, 
  Users, 
  FileSpreadsheet, 
  ShieldCheck, 
  UserCheck, 
  Send, 
  Building, 
  Sparkles, 
  Link, 
  Code2 
} from 'lucide-react';
import { api } from '../api';

const LinkedInIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
    <rect width="4" height="12" x="2" y="9"/>
    <circle cx="4" cy="4" r="2"/>
  </svg>
);

export default function OutreachView({ 
  currentJob, 
  onSelectCandidate, 
  onOpenOutreachModal,
  showToast 
}) {
  const [activeSubTab, setActiveSubTab] = useState('postings');
  
  // Job Postings State
  const [postingsData, setPostingsData] = useState(null);
  const [loadingPostings, setLoadingPostings] = useState(false);
  const [companyName, setCompanyName] = useState('Enterprise Technology Partner');
  const [copiedKey, setCopiedKey] = useState(null);

  // Candidate Outreach Pool State
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // Form Responses State
  const [formResponses, setFormResponses] = useState([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [syncingSheets, setSyncingSheets] = useState(false);

  useEffect(() => {
    if (currentJob?.id) {
      if (activeSubTab === 'postings') loadJobPostings();
      if (activeSubTab === 'candidates') loadPipelineCandidates();
      if (activeSubTab === 'forms') loadFormResponses();
    }
  }, [currentJob?.id, activeSubTab]);

  const loadJobPostings = async () => {
    if (!currentJob?.id) return;
    setLoadingPostings(true);
    try {
      const res = await api.getJobPostings(currentJob.id, companyName);
      if (res.status === 'success') {
        setPostingsData(res.data);
      }
    } catch (err) {
      showToast?.('Failed to load job postings: ' + err.message, 'error');
    } finally {
      setLoadingPostings(false);
    }
  };

  const loadPipelineCandidates = async () => {
    if (!currentJob?.id) return;
    setLoadingCandidates(true);
    try {
      const res = await api.getPipeline(currentJob.id);
      const list = Array.isArray(res) ? res : (res?.data || []);
      setCandidates(list);
    } catch (err) {
      showToast?.('Failed to load candidates: ' + err.message, 'error');
    } finally {
      setLoadingCandidates(false);
    }
  };

  const loadFormResponses = async () => {
    setLoadingResponses(true);
    try {
      const res = await api.getFormResponses(currentJob?.id);
      const list = Array.isArray(res) ? res : (res?.data || []);
      setFormResponses(list);
    } catch (err) {
      showToast?.('Failed to load form responses: ' + err.message, 'error');
    } finally {
      setLoadingResponses(false);
    }
  };

  const handleCopy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      showToast?.('Copied to clipboard!', 'success');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      showToast?.('Failed to copy', 'error');
    }
  };

  const handleSyncSheets = async () => {
    if (!sheetsUrl.trim()) {
      showToast?.('Please enter a Google Sheet URL or ID.', 'error');
      return;
    }
    setSyncingSheets(true);
    try {
      const res = await api.syncGoogleSheets(sheetsUrl.trim(), currentJob?.id);
      if (res.status === 'success') {
        showToast?.(res.message || 'Sheet synced successfully!', 'success');
        loadFormResponses();
      } else {
        showToast?.(res.message || 'Sync failed', 'error');
      }
    } catch (err) {
      showToast?.('Google Sheets sync error: ' + err.message, 'error');
    } finally {
      setSyncingSheets(false);
    }
  };

  const careersUrl = currentJob?.id ? api.getCareersPageUrl(currentJob.id, companyName) : '';

  return (
    <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
      
      {/* Top Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#fff' }}>
              Outreach & Recruitment Marketing Hub
            </h2>
            <span className="badge badge-accent" style={{ fontSize: '11px' }}>
              Phase 6
            </span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Target role: <strong>{currentJob?.title || 'No Job Selected'}</strong> ({currentJob?.location || 'India'})
          </span>
        </div>

        {/* Sub-tab Navigation Buttons */}
        <div style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid var(--border-subtle)'
        }}>
          <button
            onClick={() => setActiveSubTab('postings')}
            style={{
              padding: '6px 14px',
              borderRadius: '7px',
              background: activeSubTab === 'postings' ? 'var(--accent-primary)' : 'transparent',
              color: activeSubTab === 'postings' ? '#fff' : 'var(--text-muted)',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Megaphone size={13} />
            <span>Job Postings</span>
          </button>

          <button
            onClick={() => setActiveSubTab('candidates')}
            style={{
              padding: '6px 14px',
              borderRadius: '7px',
              background: activeSubTab === 'candidates' ? 'var(--accent-primary)' : 'transparent',
              color: activeSubTab === 'candidates' ? '#fff' : 'var(--text-muted)',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Users size={13} />
            <span>Candidate Pitching ({candidates.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('forms')}
            style={{
              padding: '6px 14px',
              borderRadius: '7px',
              background: activeSubTab === 'forms' ? 'var(--accent-primary)' : 'transparent',
              color: activeSubTab === 'forms' ? '#fff' : 'var(--text-muted)',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ShieldCheck size={13} />
            <span>Consent Forms ({formResponses.length})</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SUB-TAB 1: JOB POSTINGS & MARKETING ADS */}
      {/* ============================================================== */}
      {activeSubTab === 'postings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Controls Bar */}
          <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Building size={16} style={{ color: 'var(--accent-primary)' }} />
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block' }}>Hiring Entity / Client:</span>
                <input 
                  type="text"
                  className="input-text"
                  style={{ padding: '4px 8px', fontSize: '12px', width: '220px' }}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={loadJobPostings}
                disabled={loadingPostings}
              >
                <RefreshCw size={13} className={loadingPostings ? 'animate-spin' : ''} />
                <span>Refresh Posts</span>
              </button>

              <a 
                href={careersUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
                style={{ textDecoration: 'none' }}
              >
                <Globe size={13} />
                <span>View Google for Jobs Careers Page</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {loadingPostings ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', display: 'block', color: 'var(--accent-primary)' }} />
              <span>Generating multi-platform job posts...</span>
            </div>
          ) : postingsData ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
              
              {/* LinkedIn Feed Post Card */}
              <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(10, 102, 194, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                      <LinkedInIcon size={16} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#fff' }}>LinkedIn Social Post</h4>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Hook, emojis, bulleted perks & hashtags</span>
                    </div>
                  </div>

                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCopy('linkedin_post', postingsData.postings.linkedin_post.content)}
                  >
                    {copiedKey === 'linkedin_post' ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                    <span>Copy</span>
                  </button>
                </div>

                <textarea
                  readOnly
                  rows={14}
                  className="input-text"
                  style={{
                    fontSize: '12px',
                    lineHeight: '1.55',
                    background: 'rgba(11, 16, 28, 0.9)',
                    resize: 'none',
                    flex: 1
                  }}
                  value={postingsData.postings.linkedin_post.content}
                />
              </div>

              {/* Naukri / Foundit Job Ad Card */}
              <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                      <Briefcase size={16} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#fff' }}>Naukri & Foundit Job Ad</h4>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Formal JD structure, responsibilities & qualifications</span>
                    </div>
                  </div>

                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCopy('naukri_ad', postingsData.postings.naukri_ad.content)}
                  >
                    {copiedKey === 'naukri_ad' ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                    <span>Copy</span>
                  </button>
                </div>

                <textarea
                  readOnly
                  rows={14}
                  className="input-text"
                  style={{
                    fontSize: '12px',
                    lineHeight: '1.55',
                    background: 'rgba(11, 16, 28, 0.9)',
                    resize: 'none',
                    flex: 1
                  }}
                  value={postingsData.postings.naukri_ad.content}
                />
              </div>

              {/* WhatsApp / Telegram Broadcast Card */}
              <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
                      <MessageSquare size={16} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#fff' }}>WhatsApp & Telegram Blast</h4>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Crisp chat broadcast with instant apply link</span>
                    </div>
                  </div>

                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCopy('whatsapp_broadcast', postingsData.postings.whatsapp_broadcast.content)}
                  >
                    {copiedKey === 'whatsapp_broadcast' ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                    <span>Copy</span>
                  </button>
                </div>

                <textarea
                  readOnly
                  rows={14}
                  className="input-text"
                  style={{
                    fontSize: '12px',
                    lineHeight: '1.55',
                    background: 'rgba(11, 16, 28, 0.9)',
                    resize: 'none',
                    flex: 1
                  }}
                  value={postingsData.postings.whatsapp_broadcast.content}
                />
              </div>

              {/* Google for Jobs Schema.org JSON-LD Card */}
              <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(236, 72, 153, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ec4899' }}>
                      <Code2 size={16} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#fff' }}>Google for Jobs JSON-LD</h4>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Schema.org JobPosting indexing format</span>
                    </div>
                  </div>

                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCopy('schema_json', JSON.stringify(postingsData.schema_json_ld, null, 2))}
                  >
                    {copiedKey === 'schema_json' ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                    <span>Copy JSON</span>
                  </button>
                </div>

                <textarea
                  readOnly
                  rows={14}
                  className="input-text"
                  style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    lineHeight: '1.45',
                    background: 'rgba(11, 16, 28, 0.9)',
                    resize: 'none',
                    flex: 1
                  }}
                  value={JSON.stringify(postingsData.schema_json_ld, null, 2)}
                />
              </div>

            </div>
          ) : null}

        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 2: CANDIDATE OUTREACH HUB */}
      {/* ============================================================== */}
      {activeSubTab === 'candidates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Candidates currently in your pipeline roster. Click <strong>Generate Pitch</strong> to craft personalized multi-channel drafts for any profile.
            </span>
            <button className="btn btn-secondary btn-sm" onClick={loadPipelineCandidates}>
              <RefreshCw size={12} />
              <span>Refresh Roster</span>
            </button>
          </div>

          {loadingCandidates ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', display: 'block', color: 'var(--accent-primary)' }} />
              <span>Loading candidate roster...</span>
            </div>
          ) : candidates.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
              No candidates found in pipeline for this job. Use Sourcing Console to ingest candidates first.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {candidates.map((cand) => (
                <div 
                  key={cand.id}
                  className="glass-card"
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      color: '#fff',
                      fontSize: '13px'
                    }}>
                      {cand.name ? cand.name.slice(0, 2).toUpperCase() : 'CA'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: '#fff', fontSize: '14px' }}>
                          {cand.name}
                        </span>
                        <span className="badge badge-accent" style={{ fontSize: '10px' }}>
                          {cand.platform || 'web'}
                        </span>
                        {cand.score > 0 && (
                          <span className="badge badge-verified" style={{ fontSize: '10px' }}>
                            {cand.score.toFixed(1)}% Match
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {cand.headline || 'Software Developer'} • {cand.location || 'India'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {cand.email ? (
                      <span className="badge badge-verified" style={{ fontSize: '10px' }}>
                        Email Verified
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', fontSize: '10px' }}>
                        Missing Email
                      </span>
                    )}

                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => onOpenOutreachModal && onOpenOutreachModal(cand)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Sparkles size={13} />
                      <span>Generate Pitch</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 3: CONSENT FORMS & GOOGLE SHEETS SYNC */}
      {/* ============================================================== */}
      {activeSubTab === 'forms' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Sheets Sync Box */}
          <div className="glass-card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.9) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <FileSpreadsheet size={18} style={{ color: 'var(--success)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#fff' }}>
                Google Sheets / Forms Inbound Sync
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Sync responses from any published Google Sheet linked to your candidate interest form. Responses are auto-matched by Reference ID or Email, and candidates are upgraded to <strong>Consented</strong> in accordance with the DPDP Act.
            </p>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input 
                type="text"
                className="input-text"
                placeholder="Paste Google Sheet URL (e.g. https://docs.google.com/spreadsheets/d/.../edit)"
                value={sheetsUrl}
                onChange={(e) => setSheetsUrl(e.target.value)}
                style={{ flex: 1 }}
              />
              <button 
                className="btn btn-success"
                onClick={handleSyncSheets}
                disabled={syncingSheets || !sheetsUrl.trim()}
              >
                <RefreshCw size={13} className={syncingSheets ? 'animate-spin' : ''} />
                <span>{syncingSheets ? 'Syncing...' : 'Sync Sheet Now'}</span>
              </button>
            </div>
          </div>

          {/* Submissions Table */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#fff' }}>
                  Received Candidate Submissions ({formResponses.length})
                </h4>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  All candidates who submitted the consent-based interest form
                </span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={loadFormResponses}>
                <RefreshCw size={12} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingResponses ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block', color: 'var(--accent-primary)' }} />
                <span>Loading submissions...</span>
              </div>
            ) : formResponses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-dim)' }}>
                No form responses received yet. Send candidate outreach messages with your personalized form link to gather consent.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-dim)' }}>
                      <th style={{ padding: '8px 10px' }}>Candidate Name</th>
                      <th style={{ padding: '8px 10px' }}>Contact Info</th>
                      <th style={{ padding: '8px 10px' }}>Compensation</th>
                      <th style={{ padding: '8px 10px' }}>Notice Period</th>
                      <th style={{ padding: '8px 10px' }}>Consent Status</th>
                      <th style={{ padding: '8px 10px' }}>Submitted At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formResponses.map((resp) => (
                      <tr key={resp.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '10px', color: '#fff', fontWeight: 600 }}>
                          {resp.full_name}
                        </td>
                        <td style={{ padding: '10px', color: 'var(--text-muted)' }}>
                          <div>{resp.email || '—'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{resp.phone || ''}</div>
                        </td>
                        <td style={{ padding: '10px', color: '#cbd5e1' }}>
                          <div>Curr: {resp.current_ctc || '—'}</div>
                          <div style={{ color: 'var(--success)' }}>Exp: {resp.expected_ctc || '—'}</div>
                        </td>
                        <td style={{ padding: '10px', color: '#cbd5e1' }}>
                          {resp.notice_period || 'Immediate'}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span className="badge badge-verified" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <ShieldCheck size={11} /> Consented
                          </span>
                        </td>
                        <td style={{ padding: '10px', color: 'var(--text-dim)', fontSize: '11px' }}>
                          {resp.submitted_at ? new Date(resp.submitted_at).toLocaleDateString() : 'Recent'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}
