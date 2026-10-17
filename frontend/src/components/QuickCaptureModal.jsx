import React, { useState, useEffect } from 'react';
import { 
  X, 
  ClipboardCheck, 
  Mail, 
  Phone, 
  Globe, 
  User, 
  ShieldCheck, 
  Sparkles, 
  Check, 
  AlertCircle,
  Briefcase
} from 'lucide-react';
import { api } from '../api';

export default function QuickCaptureModal({ 
  isOpen, 
  onClose, 
  candidate = null, 
  currentJob = null, 
  onCaptureSuccess,
  showToast 
}) {
  const [rawText, setRawText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [extractedPreview, setExtractedPreview] = useState(null);
  const [attachToSelected, setAttachToSelected] = useState(Boolean(candidate));

  useEffect(() => {
    if (candidate) {
      setAttachToSelected(true);
    } else {
      setAttachToSelected(false);
    }
    setRawText('');
    setExtractedPreview(null);
  }, [isOpen, candidate]);

  // Real-time client-side preview parsing
  useEffect(() => {
    if (!rawText.trim()) {
      setExtractedPreview(null);
      return;
    }

    // Client-side regex preview for instant responsiveness
    const text = rawText;
    const emails = Array.from(new Set(
      (text.match(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g) || [])
        .map(e => e.trim().replace(/[.,;:()]/g, ''))
        .filter(e => !e.match(/\.(png|jpg|jpeg|svg|gif|js|css)$/i))
    ));

    const phoneMatches = text.match(/(?:\+91[\-\s]?)?[6-9]\d{4}[\-\s]?\d{5}|0[6-9]\d{9}|\b[6-9]\d{9}\b/g) || [];
    const phones = Array.from(new Set(phoneMatches.map(p => p.replace(/[\s\-]/g, ''))));

    const urls = Array.from(new Set(
      (text.match(/https?:\/\/[^\s<>"']+/g) || [])
        .map(u => u.trim().replace(/[.,;:()]/g, ''))
    ));

    // Name inference
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let inferredName = null;
    let inferredHeadline = null;
    const noise = ['contact', 'info', 'experience', 'education', 'linkedin', 'profile', 'email', 'phone'];
    
    for (const l of lines.slice(0, 4)) {
      const lower = l.toLowerCase();
      if (!noise.some(n => lower.includes(n)) && !l.includes('@') && !l.match(/\d/)) {
        const words = l.split(/\s+/);
        if (words.length >= 2 && words.length <= 4) {
          inferredName = l;
          break;
        }
      }
    }

    if (inferredName && lines.length >= 2) {
      for (const l of lines.slice(1, 5)) {
        if (l !== inferredName && l.length > 6 && !noise.some(n => l.toLowerCase().includes(n))) {
          inferredHeadline = l;
          break;
        }
      }
    }

    setExtractedPreview({
      name: inferredName,
      headline: inferredHeadline,
      emails,
      phones,
      urls
    });
  }, [rawText]);

  const handleCapture = async () => {
    if (!rawText.trim()) {
      showToast('Please paste some text first.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        raw_text: rawText,
        candidate_id: (attachToSelected && candidate?.id) ? candidate.id : null,
        job_id: currentJob?.id || null,
        source_platform: 'quick_paste_capture',
        performed_by: 'Recruiter'
      };

      const res = await api.pasteCaptureContact(payload);
      if (res?.status === 'success') {
        showToast(res.message || 'Contact captured successfully!', 'success');
        if (onCaptureSuccess) {
          onCaptureSuccess(res);
        }
        onClose();
      } else {
        showToast(res?.message || 'Failed to capture contact.', 'error');
      }
    } catch (err) {
      showToast('Paste capture error: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const hasExtractedData = extractedPreview && (
    extractedPreview.emails.length > 0 || 
    extractedPreview.phones.length > 0 || 
    extractedPreview.urls.length > 0 || 
    extractedPreview.name
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="glass-card modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(16, 185, 129, 0.2)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.85)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(59, 130, 246, 0.3) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399'
            }}>
              <ClipboardCheck size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                Paste-to-Capture Contact Intelligence
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Paste text from LinkedIn Contact Info, email signatures, or web profiles (<code style={{ color: '#34d399' }}>Ctrl+V</code>)
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Target Candidate Context Card */}
          {candidate ? (
            <div style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <User size={16} style={{ color: '#818cf8' }} />
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Target Candidate:
                  </span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                    {candidate.full_name || 'Selected Candidate'}
                  </div>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                <input 
                  type="checkbox"
                  checked={attachToSelected}
                  onChange={(e) => setAttachToSelected(e.target.checked)}
                />
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                  Attach to this candidate
                </span>
              </label>
            </div>
          ) : currentJob ? (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Briefcase size={14} style={{ color: 'var(--accent-primary)' }} />
              <span>
                New candidate will be automatically linked to active job: <strong style={{ color: '#fff' }}>{currentJob.title}</strong>
              </span>
            </div>
          ) : null}

          {/* Paste Input Area */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                Raw Profile / Contact Text:
              </label>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                Takes &lt; 10 seconds to auto-extract
              </span>
            </div>
            <textarea
              className="input-text"
              rows={6}
              placeholder="Paste raw text here... Example:&#10;Aarav Sharma&#10;Senior Full Stack Engineer at TechCorp&#10;aarav.sharma@example.com&#10;+91 98765 43210&#10;linkedin.com/in/aarav-sharma"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              style={{ fontSize: '12px', fontFamily: 'monospace', lineHeight: 1.5 }}
              autoFocus
            />
          </div>

          {/* Live Parsing Preview */}
          {hasExtractedData && (
            <div className="glass-card" style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <Sparkles size={14} style={{ color: '#34d399' }} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Live Extracted Preview
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                {extractedPreview.name && !attachToSelected && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--text-dim)', width: '80px' }}>Name:</span>
                    <strong style={{ color: '#fff' }}>{extractedPreview.name}</strong>
                    {extractedPreview.headline && <span style={{ color: 'var(--text-muted)' }}>({extractedPreview.headline})</span>}
                  </div>
                )}

                {extractedPreview.emails.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--text-dim)', width: '80px' }}>Emails:</span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {extractedPreview.emails.map((e, idx) => (
                        <span key={idx} className="badge badge-verified" style={{ fontSize: '11px' }}>
                          <Mail size={11} /> {e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {extractedPreview.phones.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--text-dim)', width: '80px' }}>Phones:</span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {extractedPreview.phones.map((p, idx) => (
                        <span key={idx} className="badge badge-verified" style={{ fontSize: '11px' }}>
                          <Phone size={11} /> {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {extractedPreview.urls.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--text-dim)', width: '80px' }}>URLs:</span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {extractedPreview.urls.map((u, idx) => (
                        <span key={idx} className="badge badge-accent" style={{ fontSize: '10px' }}>
                          <Globe size={10} /> {u.slice(0, 32)}...
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DPDP Compliance Notice */}
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '11px',
            color: 'var(--text-dim)'
          }}>
            <ShieldCheck size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
            <span>
              <strong>DPDP Act Data Minimization:</strong> Non-recruitment personal details (DOB, marital status, Aadhaar, residential addresses) are automatically scrubbed and never stored.
            </span>
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.85)'
        }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          
          <button 
            className="btn btn-primary btn-sm"
            onClick={handleCapture}
            disabled={isSaving || !rawText.trim()}
          >
            <Check size={14} />
            <span>{isSaving ? 'Capturing & Saving...' : 'Capture & Save Contacts'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
