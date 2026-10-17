import React, { useState, useEffect } from 'react';
import { 
  PhoneCall, 
  Mail, 
  Phone, 
  ExternalLink, 
  ClipboardCheck, 
  Sparkles, 
  Search, 
  Filter, 
  RefreshCw, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Zap, 
  UserCheck, 
  Copy, 
  Check, 
  ArrowRight,
  Sliders,
  Award,
  Clock,
  Users,
  MapPin,
  X
} from 'lucide-react';
import { api } from '../api';
import QuickCaptureModal from '../components/QuickCaptureModal';

// Helper to extract 2 clean initials for candidate avatar
const getInitials = (fullName) => {
  if (!fullName) return 'CP';
  const cleaned = fullName.replace(/[^a-zA-Z\s]/g, ' ').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (fullName.charAt(0) || 'C').toUpperCase();
};

export default function ContactQueueView({ 
  currentJob, 
  onSelectCandidate, 
  onOpenKeysModal,
  showToast 
}) {
  const [queueData, setQueueData] = useState([]);
  const [stats, setStats] = useState({
    total_in_queue: 0,
    missing_both: 0,
    missing_email_only: 0,
    missing_phone_only: 0,
  });
  const [enrichmentStatus, setEnrichmentStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'MISSING_BOTH', 'MISSING_EMAIL', 'MISSING_PHONE', 'SHORTLISTED'
  const [searchQuery, setSearchQuery] = useState('');
  const [revealingCandidateId, setRevealingCandidateId] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  // Quick Capture Modal State
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [captureTargetCandidate, setCaptureTargetCandidate] = useState(null);

  useEffect(() => {
    if (currentJob?.id) {
      loadQueue();
      loadEnrichmentStatus();
    }
  }, [currentJob?.id]);

  const loadQueue = async () => {
    if (!currentJob?.id) return;
    setIsLoading(true);
    try {
      const res = await api.getContactQueue(currentJob.id);
      const items = Array.isArray(res) ? res : (res?.data || []);
      setQueueData(items);

      if (res?.stats) {
        setStats(res.stats);
      } else {
        const missingBoth = items.filter(c => !c.has_email && !c.has_phone).length;
        const missingEmail = items.filter(c => !c.has_email && c.has_phone).length;
        const missingPhone = items.filter(c => c.has_email && !c.has_phone).length;
        setStats({
          total_in_queue: items.length,
          missing_both: missingBoth,
          missing_email_only: missingEmail,
          missing_phone_only: missingPhone,
        });
      }
    } catch (err) {
      console.error('Failed to load contact queue:', err);
      showToast?.('Failed to load contact queue: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadEnrichmentStatus = async () => {
    try {
      const res = await api.getEnrichmentStatus();
      const statusData = res?.data || res;
      if (statusData) {
        setEnrichmentStatus(statusData);
      }
    } catch (err) {
      console.error('Failed to load enrichment status:', err);
    }
  };

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenCapture = (candidate = null) => {
    setCaptureTargetCandidate(candidate);
    setIsQuickCaptureOpen(true);
  };

  const handleCaptureSuccess = (res) => {
    loadQueue();
    loadEnrichmentStatus();
  };

  const handleRevealContact = async (candidate) => {
    const provider = enrichmentStatus?.hunter_configured ? 'hunter' : (enrichmentStatus?.apollo_configured ? 'apollo' : null);
    
    if (!provider) {
      showToast?.('No enrichment API configured. You can use Quick Paste for free, or configure Hunter/Apollo keys.', 'info');
      if (onOpenKeysModal) onOpenKeysModal();
      return;
    }

    setRevealingCandidateId(candidate.id);
    try {
      const res = await api.revealContact(candidate.id, provider);
      if (res?.status === 'success') {
        showToast?.(`Contact revealed for ${candidate.full_name}!`, 'success');
        await loadQueue();
        await loadEnrichmentStatus();
      } else if (res?.status === 'info') {
        showToast?.(res.message, 'info');
      } else {
        showToast?.(res?.message || 'Enrichment failed.', 'error');
      }
    } catch (err) {
      showToast?.('Reveal contact error: ' + err.message, 'error');
    } finally {
      setRevealingCandidateId(null);
    }
  };

  // Filter queue records
  const filteredQueue = queueData.filter((cand) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = cand.full_name?.toLowerCase().includes(q);
      const matchHeadline = cand.headline?.toLowerCase().includes(q);
      const matchLocation = cand.location?.toLowerCase().includes(q);
      if (!matchName && !matchHeadline && !matchLocation) return false;
    }

    // Filter type
    if (filterType === 'MISSING_BOTH') {
      return cand.missing_email && cand.missing_phone;
    }
    if (filterType === 'MISSING_EMAIL') {
      return cand.missing_email;
    }
    if (filterType === 'MISSING_PHONE') {
      return cand.missing_phone;
    }
    if (filterType === 'SHORTLISTED') {
      return (cand.stage || '').toLowerCase() === 'shortlisted';
    }

    return true;
  });

  return (
    <div className="view-container animate-fade-in" style={{ padding: '24px 28px' }}>
      {/* View Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '22px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="badge badge-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={11} /> Phase 5
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600 }}>
              Contact Acquisition & Queue
            </span>
          </div>
          <h1 style={{ fontSize: '24px', margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Contact Acquisition Console
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px', maxWidth: '680px' }}>
            Prioritized outreach queue for candidates lacking verified emails or Indian phone numbers. 
            Compliant with DPDP Act data minimization.
          </p>
        </div>

        {/* Header Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Remaining Credits Indicator */}
          {enrichmentStatus && (
            <div 
              className="glass-card" 
              style={{
                padding: '6px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                border: '1px solid rgba(99, 102, 241, 0.3)'
              }}
              onClick={onOpenKeysModal}
              title="Click to manage Hunter / Apollo API keys"
            >
              <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
              <div style={{ fontSize: '11px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Enrichment: </span>
                <strong style={{ color: enrichmentStatus.credits_remaining > 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {enrichmentStatus.credits_remaining} / {enrichmentStatus.monthly_cap}
                </strong>
                <span style={{ color: 'var(--text-dim)', marginLeft: '4px' }}>credits</span>
              </div>
            </div>
          )}

          <button 
            className="btn btn-secondary btn-sm"
            onClick={loadQueue}
            disabled={isLoading}
            title="Reload queue"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button 
            className="btn btn-primary btn-sm"
            onClick={() => handleOpenCapture(null)}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
            }}
          >
            <ClipboardCheck size={14} />
            <span>Paste to Capture</span>
          </button>
        </div>
      </div>

      {/* Stats Counter Bar - Upgraded to Consistent Premium Glass KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
        marginBottom: '20px'
      }}>
        {/* Card 1: Total in Queue */}
        <div className="glass-card" style={{
          padding: '18px 20px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0.03) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Candidates in Queue
            </span>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)'
            }}>
              <Users size={15} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {stats.total_in_queue}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
              Pipeline candidates lacking contact points
            </div>
          </div>
        </div>

        {/* Card 2: Missing Both */}
        <div className="glass-card" style={{
          padding: '18px 20px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.03) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Missing Both Email & Phone
            </span>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b'
            }}>
              <AlertTriangle size={15} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#fbbf24', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {stats.missing_both}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
              Highest outreach priority
            </div>
          </div>
        </div>

        {/* Card 3: Missing Email Only */}
        <div className="glass-card" style={{
          padding: '18px 20px',
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(14, 165, 233, 0.03) 100%)',
          border: '1px solid rgba(14, 165, 233, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Missing Email Only
            </span>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: 'rgba(14, 165, 233, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0ea5e9'
            }}>
              <Mail size={15} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {stats.missing_email_only}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
              Has verified phone number
            </div>
          </div>
        </div>

        {/* Card 4: Missing Phone Only */}
        <div className="glass-card" style={{
          padding: '18px 20px',
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(168, 85, 247, 0.03) 100%)',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#c084fc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Missing Phone Only
            </span>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: 'rgba(168, 85, 247, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a855f7'
            }}>
              <Phone size={15} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#c084fc', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {stats.missing_phone_only}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
              Has verified email address
            </div>
          </div>
        </div>
      </div>

      {/* Recruiter Workflow Banner */}
      <div className="glass-card" style={{
        padding: '16px 20px',
        marginBottom: '20px',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--success)',
            flexShrink: 0
          }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>DPDP Act Compliant Paste-to-Capture Workflow</span>
              <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontSize: '10px' }}>
                &lt; 10s Speed
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: '#fff', fontWeight: 600 }}>1.</span> Click "Open Profile"
              <span style={{ color: 'var(--text-dim)' }}>&rarr;</span>
              <span style={{ color: '#fff', fontWeight: 600 }}>2.</span> Copy text snippet from profile
              <span style={{ color: 'var(--text-dim)' }}>&rarr;</span>
              <span style={{ color: '#fff', fontWeight: 600 }}>3.</span> Click "Quick Paste" for instant validation & pipeline sync
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-verified" style={{ fontSize: '11px', padding: '4px 10px' }}>
            <ShieldCheck size={12} /> Zero Dummy Data Guarantee
          </span>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="glass-card" style={{ padding: '12px 18px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          {/* Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', marginRight: '4px', letterSpacing: '0.05em' }}>
              Filter:
            </span>
            <button 
              className={`btn btn-sm ${filterType === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px' }}
              onClick={() => setFilterType('ALL')}
            >
              <span>All in Queue</span>
              <span style={{ opacity: 0.85, fontWeight: 700, marginLeft: '4px' }}>({queueData.length})</span>
            </button>
            <button 
              className={`btn btn-sm ${filterType === 'MISSING_BOTH' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px' }}
              onClick={() => setFilterType('MISSING_BOTH')}
            >
              <span>Missing Both</span>
              <span style={{ opacity: 0.85, fontWeight: 700, marginLeft: '4px' }}>({stats.missing_both})</span>
            </button>
            <button 
              className={`btn btn-sm ${filterType === 'MISSING_EMAIL' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px' }}
              onClick={() => setFilterType('MISSING_EMAIL')}
            >
              <span>Missing Email</span>
              <span style={{ opacity: 0.85, fontWeight: 700, marginLeft: '4px' }}>({stats.missing_both + stats.missing_email_only})</span>
            </button>
            <button 
              className={`btn btn-sm ${filterType === 'MISSING_PHONE' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px' }}
              onClick={() => setFilterType('MISSING_PHONE')}
            >
              <span>Missing Phone</span>
              <span style={{ opacity: 0.85, fontWeight: 700, marginLeft: '4px' }}>({stats.missing_both + stats.missing_phone_only})</span>
            </button>
            <button 
              className={`btn btn-sm ${filterType === 'SHORTLISTED' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px' }}
              onClick={() => setFilterType('SHORTLISTED')}
            >
              Shortlisted Only
            </button>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input 
              type="text"
              className="input-text"
              placeholder="Search candidate or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', paddingRight: searchQuery ? '28px' : '10px', fontSize: '12px', width: '100%', height: '34px' }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Candidate Queue List */}
      {isLoading ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--accent-primary)', margin: '0 auto 12px' }} />
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Analyzing Candidate Contact Points...</div>
        </div>
      ) : filteredQueue.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
          <CheckCircle2 size={36} style={{ color: 'var(--success)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>
            {queueData.length === 0 ? 'No Candidates Lacking Contacts!' : 'No Matching Candidates in Current Filter'}
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', maxWidth: '440px', margin: '0 auto 16px' }}>
            {queueData.length === 0 
              ? 'All candidates in this job requirement pipeline currently have verified emails and phone numbers.' 
              : 'Try selecting a different filter tab or clearing your search keywords.'}
          </p>
          {queueData.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setFilterType('ALL'); setSearchQuery(''); }}>
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredQueue.map((cand) => {
            const isRevealing = revealingCandidateId === cand.id;
            const scoreClass = cand.score >= 75 ? 'score-high' : cand.score >= 50 ? 'score-mid' : 'score-low';
            const initials = getInitials(cand.full_name);
            const isUrgent = cand.missing_email && cand.missing_phone;

            return (
              <div 
                key={cand.id} 
                className="glass-card glass-card-interactive"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '20px',
                  border: isUrgent ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid var(--border-subtle)',
                  background: isUrgent 
                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.04) 0%, rgba(17, 24, 39, 0.8) 100%)' 
                    : 'var(--bg-card)',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative'
                }}
              >
                {/* Left: Avatar & Candidate Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 320px', minWidth: '260px' }}>
                  {/* Avatar with Dual Initials & Gradient */}
                  <div 
                    onClick={() => onSelectCandidate && onSelectCandidate(cand)}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 800,
                      color: '#ffffff',
                      cursor: 'pointer',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                    }}
                    title="Click to view candidate intelligence dossier"
                  >
                    {initials}
                  </div>

                  {/* Name, Headline, Stage, Location */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h4 
                        onClick={() => onSelectCandidate && onSelectCandidate(cand)}
                        style={{ 
                          margin: 0, 
                          fontSize: '15px', 
                          fontWeight: 700, 
                          color: '#fff',
                          cursor: 'pointer',
                          letterSpacing: '-0.01em'
                        }}
                      >
                        {cand.full_name}
                      </h4>
                      <span className="badge badge-accent" style={{ textTransform: 'uppercase', fontSize: '10px', padding: '2px 7px', fontWeight: 700 }}>
                        {cand.stage}
                      </span>
                      <span className={`score-badge ${scoreClass}`} style={{ fontSize: '11px', height: '22px', minWidth: 'auto', padding: '0 8px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}>
                        {Math.round(cand.score || 0)}% Fit
                      </span>
                      {isUrgent && (
                        <span style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#fbbf24',
                          fontWeight: 600,
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          <AlertTriangle size={9} /> High Priority
                        </span>
                      )}
                    </div>

                    <div style={{ 
                      fontSize: '12px', 
                      color: 'var(--text-dim)', 
                      marginTop: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{ color: 'var(--text-muted)' }}>{cand.headline}</span>
                      {cand.location && (
                        <>
                          <span style={{ opacity: 0.5 }}>•</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--text-dim)' }}>
                            <MapPin size={11} /> {cand.location}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle: Contact Health Channel (Vertically Stacked Pills) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px', flexShrink: 0 }}>
                  {/* Email Pill */}
                  <div>
                    {cand.has_email ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="badge badge-verified" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px' }}>
                          <Mail size={11} /> {cand.emails[0]}
                        </span>
                        <button 
                          className="btn-icon" 
                          onClick={() => handleCopy(cand.emails[0], `email_${cand.id}`)}
                          title="Copy email"
                        >
                          {copiedKey === `email_${cand.id}` ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                        </button>
                      </div>
                    ) : (
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '5px', 
                        fontSize: '11px', 
                        padding: '3px 8px', 
                        borderRadius: '6px', 
                        background: 'rgba(239, 68, 68, 0.08)', 
                        color: '#f87171', 
                        border: '1px solid rgba(239, 68, 68, 0.22)',
                        fontWeight: 500
                      }}>
                        <Mail size={11} /> Missing Email
                      </span>
                    )}
                  </div>

                  {/* Phone Pill */}
                  <div>
                    {cand.has_phone ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="badge badge-verified" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px' }}>
                          <Phone size={11} /> {cand.phones[0]}
                        </span>
                        <button 
                          className="btn-icon" 
                          onClick={() => handleCopy(cand.phones[0], `phone_${cand.id}`)}
                          title="Copy phone"
                        >
                          {copiedKey === `phone_${cand.id}` ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                        </button>
                      </div>
                    ) : (
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '5px', 
                        fontSize: '11px', 
                        padding: '3px 8px', 
                        borderRadius: '6px', 
                        background: 'rgba(245, 158, 11, 0.08)', 
                        color: '#fbbf24', 
                        border: '1px solid rgba(245, 158, 11, 0.22)',
                        fontWeight: 500
                      }}>
                        <Phone size={11} /> Missing Phone
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {/* Open Public Profile */}
                  {cand.profile_url && (
                    <a 
                      href={cand.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '6px 12px' }}
                      title="Open Candidate's Public Profile (LinkedIn/GitHub/Naukri)"
                    >
                      <span>Open Profile</span>
                      <ExternalLink size={12} />
                    </a>
                  )}

                  {/* Quick Paste Button */}
                  <button 
                    className="btn btn-sm"
                    onClick={() => handleOpenCapture(cand)}
                    style={{
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.2) 100%)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      padding: '6px 12px'
                    }}
                    title="Paste contact snippet from recruiter clipboard"
                  >
                    <ClipboardCheck size={13} />
                    <span>Quick Paste</span>
                  </button>

                  {/* Reveal Contact Button */}
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleRevealContact(cand)}
                    disabled={isRevealing}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '6px 12px' }}
                    title="Attempt third-party enrichment (Hunter.io / Apollo.io)"
                  >
                    <Sparkles size={13} className={isRevealing ? 'animate-spin' : ''} style={{ color: 'var(--accent-primary)' }} />
                    <span>{isRevealing ? 'Enriching...' : 'Reveal'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Global Quick Capture Modal */}
      <QuickCaptureModal 
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
        candidate={captureTargetCandidate}
        currentJob={currentJob}
        onCaptureSuccess={handleCaptureSuccess}
        showToast={showToast}
      />
    </div>
  );
}
