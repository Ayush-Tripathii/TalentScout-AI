import React, { useState, useEffect } from 'react';
import { 
  GitMerge, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { api } from '../api';

export default function DedupView() {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    setIsLoading(true);
    try {
      const data = await api.getDedupSuggestions();
      setSuggestions(data || []);
    } catch (err) {
      console.error('Failed to load dedup suggestions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMerge = async (primaryId, secondaryId, linkId = null) => {
    setIsMerging(true);
    try {
      await api.resolveDedup(primaryId, secondaryId, 'confirm', linkId);
      alert('Candidate identities successfully merged!');
      await loadSuggestions();
    } catch (err) {
      alert('Merge failed: ' + err.message);
    } finally {
      setIsMerging(false);
    }
  };

  const handleDismiss = async (linkId) => {
    if (!linkId) return;
    try {
      await api.resolveDedup(null, null, 'reject', linkId);
      await loadSuggestions();
    } catch (err) {
      alert('Failed to dismiss: ' + err.message);
    }
  };

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-accent">Cross-Platform Identity Linker</span>
            <span className="badge badge-verified">
              <ShieldCheck size={11} /> Normalized Hash Matching
            </span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '6px 0 2px' }}>
            Candidate Identity Deduplication
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Detect matching candidates found across multiple platforms (e.g., same person on LinkedIn, GitHub, and Resume)
          </span>
        </div>

        <button 
          className="btn btn-secondary btn-sm"
          onClick={loadSuggestions}
          disabled={isLoading}
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          <span>Scan Duplicates</span>
        </button>
      </div>

      {/* Suggested Merges List */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>
          Duplicate Resolution Queue ({suggestions.length})
        </h3>

        {suggestions.length === 0 ? (
          <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
            <UserCheck size={36} style={{ color: 'var(--success)', margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
              Database is 100% Clean & Deduplicated
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '420px', margin: '0 auto' }}>
              No overlapping profiles or duplicate records detected in your local SQLite talent pool.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {suggestions.map((item, idx) => {
              const primary = item.primary || item.target || {};
              const secondary = item.secondary || item.source || {};
              const reasonsText = Array.isArray(item.reasons) ? item.reasons.join(' • ') : (item.match_reason || 'Cross-Platform Overlap');

              return (
                <div 
                  key={idx}
                  className="glass-card" 
                  style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}
                >
                  {/* Primary Candidate */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase' }}>
                      Primary Record ({primary.platform || primary.completeness || 'Pool'})
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                      {primary.full_name || primary.name || 'Candidate A'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {primary.current_title || primary.headline || 'Software Professional'} • {primary.current_company || primary.location || 'India'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                      Email: {primary.email || '—'} • Phone: {primary.phone || '—'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <span className="badge badge-accent">
                      {Math.round(item.confidence || 90)}% Match
                    </span>
                    <ArrowRight size={18} style={{ color: 'var(--text-dim)' }} />
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)', maxWidth: '160px', textAlign: 'center' }}>
                      {reasonsText}
                    </span>
                  </div>

                  {/* Secondary Candidate */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', color: 'var(--accent-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                      Duplicate ({secondary.platform || secondary.completeness || 'Source'})
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                      {secondary.full_name || secondary.name || 'Candidate B'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {secondary.current_title || secondary.headline || 'Software Professional'} • {secondary.current_company || secondary.location || 'India'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                      Email: {secondary.email || '—'} • Phone: {secondary.phone || '—'}
                    </div>
                  </div>

                  {/* Merge Actions */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {item.link_id && (
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDismiss(item.link_id)}
                        disabled={isMerging}
                      >
                        Dismiss
                      </button>
                    )}
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => handleMerge(primary.id, secondary.id, item.link_id)}
                      disabled={isMerging}
                    >
                      <GitMerge size={14} />
                      <span>Merge Profiles</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
