import React, { useState, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Send, 
  Sparkles, 
  Mail, 
  MessageSquare, 
  ExternalLink,
  ShieldCheck,
  Clock,
  RefreshCw,
  User,
  Building,
  Link2
} from 'lucide-react';
import { api } from '../api';

const LinkedInIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
    <rect width="4" height="12" x="2" y="9"/>
    <circle cx="4" cy="4" r="2"/>
  </svg>
);

export default function OutreachModal({ 
  isOpen, 
  onClose, 
  candidate, 
  job, 
  showToast 
}) {
  const [activeChannel, setActiveChannel] = useState('linkedin_note');
  const [loading, setLoading] = useState(false);
  const [outreachData, setOutreachData] = useState(null);
  const [history, setHistory] = useState([]);
  const [copiedChannel, setCopiedChannel] = useState(null);
  
  // Customization fields
  const [recruiterName, setRecruiterName] = useState('Talent Acquisition Team');
  const [companyName, setCompanyName] = useState('Our Engineering Team');

  useEffect(() => {
    if (isOpen && candidate?.id && job?.id) {
      loadOutreach();
      loadHistory();
    }
  }, [isOpen, candidate?.id, job?.id]);

  const loadOutreach = async () => {
    if (!candidate?.id || !job?.id) return;
    setLoading(true);
    try {
      const res = await api.generateOutreach(
        candidate.id,
        job.id,
        recruiterName,
        companyName
      );
      if (res.status === 'success') {
        setOutreachData(res.data);
      }
    } catch (err) {
      showToast?.('Failed to generate outreach drafts: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!candidate?.id) return;
    try {
      const res = await api.getOutreachHistory(candidate.id);
      if (res.status === 'success') {
        setHistory(res.data || []);
      }
    } catch (err) {
      console.error('History load error:', err);
    }
  };

  const handleCopy = async (channelKey, textToCopy) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedChannel(channelKey);
      showToast?.('Copied to clipboard!', 'success');

      // Record copy event in backend
      await api.recordOutreach({
        candidate_id: candidate.id,
        job_id: job.id,
        channel: channelKey,
        content_draft: textToCopy,
        form_prefilled_url: outreachData?.prefilled_form_url,
        status: 'copied'
      });

      loadHistory();

      setTimeout(() => {
        setCopiedChannel(null);
      }, 2000);
    } catch (err) {
      showToast?.('Failed to copy to clipboard', 'error');
    }
  };

  if (!isOpen || !candidate) return null;

  const channels = outreachData?.channels || {};
  const currentDraft = channels[activeChannel];

  const channelMeta = {
    linkedin_note: { label: 'LinkedIn Note (≤300c)', icon: LinkedInIcon, color: '#60a5fa' },
    inmail: { label: 'InMail Pitch', icon: Send, color: '#818cf8' },
    email: { label: 'Formal Email', icon: Mail, color: '#34d399' },
    whatsapp: { label: 'WhatsApp', icon: MessageSquare, color: '#22c55e' }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="glass-card modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '740px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.25)',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.9)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8'
            }}>
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#fff' }}>
                Outreach Helper & Personalized Pitch
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Targeting <strong>{candidate.full_name}</strong> for <em>{job?.title || 'Open Role'}</em>
              </span>
            </div>
          </div>

          <button 
            className="btn-icon" 
            onClick={onClose}
            style={{ borderRadius: '50%', padding: '6px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Quick Customization Toolbar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr auto',
            gap: '10px',
            alignItems: 'flex-end',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                <User size={11} /> Recruiter Signature
              </label>
              <input 
                type="text"
                className="input-text"
                style={{ padding: '6px 10px', fontSize: '12px' }}
                value={recruiterName}
                onChange={(e) => setRecruiterName(e.target.value)}
                placeholder="e.g. John Doe, Lead Tech Recruiter"
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                <Building size={11} /> Organization / Client
              </label>
              <input 
                type="text"
                className="input-text"
                style={{ padding: '6px 10px', fontSize: '12px' }}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Fintech Labs"
              />
            </div>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={loadOutreach}
              disabled={loading}
              title="Regenerate all channel messages with updated signature"
              style={{ height: '32px' }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Regenerate</span>
            </button>
          </div>

          {/* Channel Selector Tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
            {Object.keys(channelMeta).map((key) => {
              const meta = channelMeta[key];
              const Icon = meta.icon;
              const isActive = activeChannel === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveChannel(key)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: isActive ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                    border: isActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
                    color: isActive ? '#fff' : 'var(--text-muted)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} style={{ color: meta.color }} />
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>

          {/* Message Draft Viewer */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', display: 'block', color: 'var(--accent-primary)' }} />
              <span>Crafting personalized outreach drafts...</span>
            </div>
          ) : currentDraft ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Optional Subject Line (for InMail / Email) */}
              {currentDraft.subject && (
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}>
                  <div style={{ fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-dim)', marginRight: '6px' }}>Subject:</span>
                    <strong style={{ color: '#fff' }}>{currentDraft.subject}</strong>
                  </div>
                  <button 
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => handleCopy(`${activeChannel}_subject`, currentDraft.subject)}
                  >
                    {copiedChannel === `${activeChannel}_subject` ? <Check size={11} style={{ color: 'var(--success)' }} /> : <Copy size={11} />}
                    <span>Copy Subject</span>
                  </button>
                </div>
              )}

              {/* Message Content Box */}
              <div style={{ position: 'relative' }}>
                <textarea
                  readOnly
                  rows={8}
                  className="input-text"
                  style={{
                    width: '100%',
                    fontFamily: activeChannel === 'whatsapp' ? 'var(--font-sans)' : 'var(--font-sans)',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    padding: '14px',
                    background: 'rgba(11, 16, 28, 0.95)',
                    color: '#e2e8f0',
                    resize: 'none',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(255, 255, 255, 0.12)'
                  }}
                  value={currentDraft.content}
                />
              </div>

              {/* Channel Specific Indicators & Copy Action */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {activeChannel === 'linkedin_note' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`badge ${currentDraft.character_count <= 300 ? 'badge-verified' : 'badge-blank'}`} style={{ fontSize: '11px' }}>
                        {currentDraft.character_count} / 300 chars
                      </span>
                      {currentDraft.character_count <= 300 && (
                        <span style={{ fontSize: '11px', color: 'var(--success)' }}>
                          ✓ Ready for LinkedIn Connection
                        </span>
                      )}
                    </div>
                  )}

                  {activeChannel === 'email' && (
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldCheck size={13} style={{ color: 'var(--success)' }} /> DPDP Act compliant consent link included
                    </span>
                  )}
                </div>

                <button 
                  className="btn btn-primary"
                  onClick={() => handleCopy(activeChannel, currentDraft.content)}
                  style={{ minWidth: '130px' }}
                >
                  {copiedChannel === activeChannel ? (
                    <>
                      <Check size={14} style={{ color: '#fff' }} />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Message</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-dim)' }}>
              No draft generated yet. Click Regenerate to build messages.
            </div>
          )}

          {/* Prefilled Consent Form Link Box */}
          {outreachData?.prefilled_form_url && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <Link2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600, display: 'block' }}>
                    Personalized Consent & Fast-Track Application Link:
                  </span>
                  <span style={{ fontSize: '12px', color: '#cbd5e1', fontFamily: 'monospace' }}>
                    {outreachData.prefilled_form_url}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleCopy('form_url', outreachData.prefilled_form_url)}
                  title="Copy application link"
                >
                  {copiedChannel === 'form_url' ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                  <span>Copy Link</span>
                </button>
                <a 
                  href={outreachData.prefilled_form_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  title="Preview applicant form"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}

          {/* Outreach History Timeline */}
          {history.length > 0 && (
            <div style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '14px',
              marginTop: '4px'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', display: 'block', marginBottom: '8px' }}>
                Candidate Outreach Timeline ({history.length} Event{history.length > 1 ? 's' : ''})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {history.slice(0, 3).map((item) => (
                  <div 
                    key={item.id} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      padding: '4px 8px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={11} />
                      <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#e2e8f0' }}>{item.channel.replace('_', ' ')}</span>
                      <span>— {item.content_snippet}</span>
                    </div>
                    <span className="badge badge-verified" style={{ fontSize: '10px' }}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.9)'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            All copied drafts are logged into immutable recruitment audit logs.
          </span>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
