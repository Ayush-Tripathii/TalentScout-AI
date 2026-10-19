import React, { useState, useEffect } from 'react';
import { 
  Users, 
  TrendingUp, 
  FileSpreadsheet, 
  Download, 
  Filter, 
  CheckCircle, 
  Search, 
  RefreshCw,
  Sliders
} from 'lucide-react';
import { api } from '../api';
import CandidateCard from '../components/CandidateCard';

export default function PipelineView({ 
  currentJob, 
  onSelectCandidate, 
  onStageChange 
}) {
  const [pipelineData, setPipelineData] = useState(null);
  const [activeStage, setActiveStage] = useState('ALL');
  const [minScore, setMinScore] = useState(50);
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentJob?.id) {
      loadPipeline();
    }
  }, [currentJob?.id]);

  const loadPipeline = async () => {
    if (!currentJob?.id) return;
    setIsLoading(true);
    try {
      const data = await api.getPipeline(currentJob.id);
      setPipelineData(data);
    } catch (err) {
      console.error('Failed to load pipeline:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluateAll = async () => {
    if (!currentJob?.id) return;
    setIsEvaluating(true);
    try {
      const res = await api.evaluateAllRanking(currentJob.id);
      const count = res?.ranked_count ?? res?.count ?? (Array.isArray(res) ? res.length : (res?.data?.length || 0));
      alert(`Successfully re-evaluated 6-dimension fit for ${count} candidates!`);
      await loadPipeline();
    } catch (err) {
      alert('Ranking evaluation failed: ' + err.message);
    } finally {
      setIsEvaluating(false);
    }
  };

  const stages = [
    { id: 'ALL', label: 'All Candidates' },
    { id: 'New', label: 'New Sourced' },
    { id: 'Screening', label: 'Screening' },
    { id: 'Interview', label: 'Interview' },
    { id: 'Shortlisted', label: 'Shortlisted' },
    { id: 'Offered', label: 'Offered' },
    { id: 'Rejected', label: 'Rejected' },
  ];

  const getCandidateScore = (item) => {
    if (!item) return 0;
    const cand = item.candidate || item;
    const rank = item.ranking || cand.ranking;
    const val = cand.score ?? cand.total_score ?? cand.overall_score ?? cand.match_score ??
                rank?.total_score ?? rank?.overall_score ?? rank?.score ??
                item.score ?? item.total_score ?? item.overall_score ?? item.match_score ?? 0;
    const num = typeof val === 'number' ? val : parseFloat(val);
    return isNaN(num) ? 0 : Math.round(num);
  };

  const allCandidates = Array.isArray(pipelineData) 
    ? pipelineData 
    : (pipelineData?.candidates || pipelineData?.data || []);

  // Filter candidates
  const filteredCandidates = allCandidates.filter((item) => {
    if (!item) return false;
    const candidate = item.candidate || item;
    const score = getCandidateScore(item);
    const email = candidate.email || (candidate.emails && candidate.emails.length > 0 ? candidate.emails[0] : null);
    const phone = candidate.phone || (candidate.phones && candidate.phones.length > 0 ? candidate.phones[0] : null);
    const stage = candidate.status || candidate.stage || item.stage || 'New';

    // Stage filter
    if (activeStage !== 'ALL') {
      if (stage.toLowerCase() !== activeStage.toLowerCase()) return false;
    }

    // Min Score: STRICTLY enforce >= minScore threshold
    if (score < Number(minScore)) return false;

    // Verified contact
    if (onlyVerified && !email && !phone) return false;

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (candidate.full_name || item.full_name || '').toLowerCase();
      const title = (candidate.current_title || candidate.headline || item.headline || '').toLowerCase();
      const skills = Array.isArray(candidate.skills || item.skills)
        ? (candidate.skills || item.skills).join(' ').toLowerCase()
        : (candidate.skills || item.skills || '').toLowerCase();
      if (!name.includes(q) && !title.includes(q) && !skills.includes(q)) {
        return false;
      }
    }

    return true;
  });

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Banner */}
      <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-accent">Staffing Pipeline & AI Rankings</span>
            <span className="badge badge-verified">
              <CheckCircle size={11} /> 100% Genuine Contacts Only
            </span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '6px 0 2px' }}>
            Candidate Pipeline: {currentJob?.title || 'No Job Selected'}
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Showing {filteredCandidates.length} of {allCandidates.length} candidates in pipeline
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={loadPipeline}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Reload</span>
          </button>

          <button 
            className="btn btn-primary btn-sm"
            onClick={handleEvaluateAll}
            disabled={isEvaluating || allCandidates.length === 0}
          >
            <TrendingUp size={14} className={isEvaluating ? 'animate-spin' : ''} />
            <span>{isEvaluating ? 'Calculating Fit...' : 'Run 0-100 AI Scoring'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Stage Toolbar */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* Stage Selector Tabs */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {stages.map((st) => {
            const isActive = activeStage === st.id;
            const count = st.id === 'ALL' 
              ? allCandidates.filter(c => getCandidateScore(c) >= Number(minScore)).length 
              : allCandidates.filter(c => {
                  const stage = (c?.candidate?.status || c?.candidate?.stage || c?.status || c?.stage || 'New').toLowerCase();
                  return stage === st.id.toLowerCase() && getCandidateScore(c) >= Number(minScore);
                }).length;


            return (
              <button
                key={st.id}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveStage(st.id)}
                style={{ padding: '6px 12px' }}
              >
                <span>{st.label}</span>
                <span style={{ 
                  fontSize: '10px', 
                  padding: '1px 6px', 
                  borderRadius: '10px', 
                  background: isActive ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)' 
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Sliders */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '280px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-dim)' }} />
              <input
                type="text"
                className="input-text"
                placeholder="Search candidate name, skills, title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '34px', paddingRight: '12px', fontSize: '12px' }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={onlyVerified}
                onChange={(e) => setOnlyVerified(e.target.checked)}
                style={{ accentColor: 'var(--accent-primary)' }}
              />
              <span>Only Verified Contact</span>
            </label>
          </div>

          {/* Precision Match Score Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
              Fit Threshold:
            </span>

            <div style={{ display: 'flex', gap: '4px' }}>
              <button 
                className={`btn btn-sm ${minScore === 50 ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '11px', padding: '3px 10px' }}
                onClick={() => setMinScore(50)}
              >
                Qualified (50%+)
              </button>
              <button 
                className={`btn btn-sm ${minScore === 75 ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '11px', padding: '3px 10px' }}
                onClick={() => setMinScore(75)}
              >
                Strong (75%+)
              </button>
              <button 
                className={`btn btn-sm ${minScore === 0 ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '11px', padding: '3px 10px' }}
                onClick={() => setMinScore(0)}
              >
                All (0%+)
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
              <input
                type="range"
                min="0"
                max="90"
                step="5"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                style={{ accentColor: 'var(--accent-primary)', width: '80px', cursor: 'pointer' }}
                title="Adjust minimum match percentage"
              />
              <span className="badge badge-accent" style={{ minWidth: '38px', justifyContent: 'center', fontSize: '11px' }}>
                {minScore}%
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Candidate Grid */}
      {filteredCandidates.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <Users size={36} style={{ color: 'var(--text-dim)', margin: '0 auto 12px' }} />
          <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
            No candidates match current stage or filters
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '400px', margin: '0 auto 16px' }}>
            Try lowering the minimum match score or switching stages to see more candidates.
          </p>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setActiveStage('ALL');
              setMinScore(0);
              setOnlyVerified(false);
              setSearchQuery('');
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredCandidates.map((item) => {
            const candidate = item.candidate || item;
            const ranking = item.ranking;
            return (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                ranking={ranking}
                onClick={() => onSelectCandidate(candidate, ranking)}
                onStageChange={async (candidateId, newStage) => {
                  if (onStageChange) await onStageChange(candidateId, newStage);
                  await loadPipeline();
                }}
              />
            );
          })}
        </div>
      )}

    </div>
  );
}
