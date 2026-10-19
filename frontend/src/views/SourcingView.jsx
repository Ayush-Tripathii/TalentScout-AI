import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Play, 
  Sparkles, 
  Filter, 
  ExternalLink, 
  CheckCircle, 
  Layers, 
  TrendingUp,
  RefreshCw,
  Terminal,
  ShieldAlert,
  Key,
  Check,
  CheckSquare
} from 'lucide-react';
import { api } from '../api';
import CandidateCard from '../components/CandidateCard';

export default function SourcingView({ 
  currentJob, 
  onSelectCandidate, 
  onStageChange,
  onNavigate,
  onOpenKeysModal,
  showToast
}) {
  const [queries, setQueries] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState([0]);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [customQueriesMap, setCustomQueriesMap] = useState({});
  const [maxResults, setMaxResults] = useState(10);
  const [isSearching, setIsSearching] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');
  const [filterOnlyVerified, setFilterOnlyVerified] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [engineStatus, setEngineStatus] = useState(null);

  // Auto-generate fallback query templates if backend is loading or queries empty
  const defaultTemplates = currentJob ? [
    {
      platform: 'linkedin',
      query: `site:linkedin.com/in "${currentJob.title || 'Developer'}" ("${currentJob.location || 'India'}")`,
      description: 'LinkedIn X-Ray candidate search'
    },
    {
      platform: 'naukri',
      query: `site:naukri.com "${currentJob.title || 'Developer'}" ("${currentJob.location || 'India'}")`,
      description: 'Naukri public profile search'
    },
    {
      platform: 'foundit',
      query: `site:foundit.in "${currentJob.title || 'Developer'}" ("${currentJob.location || 'India'}")`,
      description: 'Foundit India public resumes'
    },
    {
      platform: 'shine',
      query: `site:shine.com "${currentJob.title || 'Developer'}" ("${currentJob.location || 'India'}")`,
      description: 'Shine India candidate search'
    },
    {
      platform: 'apna',
      query: `site:apna.co "${currentJob.title || 'Developer'}" ("${currentJob.location || 'India'}")`,
      description: 'Apna job seeker profiles'
    },
    {
      platform: 'github',
      query: `site:github.com "${currentJob.title || 'Developer'}" "India"`,
      description: 'GitHub developer directory'
    },
    {
      platform: 'public_resume',
      query: `filetype:pdf resume "${currentJob.title || 'Developer'}" ("${currentJob.location || 'India'}") -template -sample`,
      description: 'Public resume indexing'
    }
  ] : [];

  const safeQueries = (Array.isArray(queries) && queries.length > 0) ? queries : defaultTemplates;
  const activeQuery = safeQueries[activePreviewIndex] || safeQueries[selectedIndices[0]] || safeQueries[0] || null;
  const selectedQueriesList = safeQueries.filter((_, idx) => selectedIndices.includes(idx));

  useEffect(() => {
    if (currentJob?.id) {
      loadQueriesAndCandidates();
    }
  }, [currentJob?.id]);

  const loadQueriesAndCandidates = async () => {
    if (!currentJob?.id) return;
    try {
      const [qData, cData, kData] = await Promise.all([
        api.getQueries(currentJob.id).catch(() => []),
        api.getCandidates(currentJob.id).catch(() => []),
        api.getSettingsKeys().catch(() => null)
      ]);
      const safeQ = Array.isArray(qData) && qData.length > 0 ? qData : defaultTemplates;
      const safeC = Array.isArray(cData) ? cData : (cData?.data || []);
      const keys = kData?.data || kData;
      if (keys) setEngineStatus(keys);
      setQueries(safeQ);
      setSelectedIndices([0]);
      setActivePreviewIndex(0);
      setCustomQueriesMap({});
      setCandidates(safeC);
    } catch (err) {
      console.error('Failed to load sourcing data:', err);
    }
  };

  const handleTogglePlatform = (idx) => {
    setSelectedIndices(prev => {
      if (prev.includes(idx)) {
        if (prev.length <= 1) {
          // Keep at least one platform selected
          return prev;
        }
        const updated = prev.filter(i => i !== idx);
        if (activePreviewIndex === idx) {
          setActivePreviewIndex(updated[0] ?? 0);
        }
        return updated;
      } else {
        setActivePreviewIndex(idx);
        return [...prev, idx].sort((a, b) => a - b);
      }
    });
  };

  const handleSelectAllPlatforms = () => {
    const all = safeQueries.map((_, i) => i);
    setSelectedIndices(all);
    if (!all.includes(activePreviewIndex)) {
      setActivePreviewIndex(0);
    }
  };

  const handleSelectOnlyPlatform = (idx = 0) => {
    setSelectedIndices([idx]);
    setActivePreviewIndex(idx);
  };

  const notify = (msg, type = 'info') => {
    if (showToast) {
      showToast(msg, type);
    } else {
      console.log(`[Toast ${type}]: ${msg}`);
    }
  };

  const handleExecuteSearch = async () => {
    if (selectedQueriesList.length === 0) {
      notify('Please select at least one search platform template above.', 'error');
      return;
    }

    setIsSearching(true);
    let totalIngested = 0;
    const totalPlatforms = selectedQueriesList.length;

    try {
      for (let i = 0; i < selectedQueriesList.length; i++) {
        const q = selectedQueriesList[i];
        const originalIndex = safeQueries.indexOf(q);
        const queryToRun = customQueriesMap[originalIndex] !== undefined
          ? customQueriesMap[originalIndex]
          : q.query;

        if (!queryToRun || !queryToRun.trim()) {
          continue;
        }

        const platformName = q.platform ? q.platform.toUpperCase() : 'SEARCH';
        setSearchStatus(`[${i + 1}/${totalPlatforms}] Querying ${platformName} live across public engines...`);

        try {
          const res = await api.executeSearch(
            currentJob.id,
            q.platform,
            queryToRun,
            maxResults
          );
          const foundCount = Array.isArray(res) ? res.length : (res?.count ?? res?.candidates_found ?? 0);
          totalIngested += foundCount;
          setSearchStatus(`[${i + 1}/${totalPlatforms}] ${platformName}: Ingested ${foundCount} candidates. Total so far: ${totalIngested}`);
        } catch (err) {
          console.error(`Search on ${platformName} failed:`, err);
          setSearchStatus(`[${i + 1}/${totalPlatforms}] ${platformName} returned a notice (${err.message}). Continuing...`);
        }
      }

      setSearchStatus(`Multi-platform execution complete! Ingested ${totalIngested} candidates across ${totalPlatforms} platforms.`);
      notify(`Multi-platform search finished: ingested ${totalIngested} candidates across ${totalPlatforms} platforms!`, 'success');
      
      // Reload candidates
      const freshCandidates = await api.getCandidates(currentJob.id);
      const safeFresh = Array.isArray(freshCandidates) ? freshCandidates : (freshCandidates?.data || []);
      setCandidates(safeFresh);
    } catch (err) {
      notify('Search execution failed: ' + err.message, 'error');
      setSearchStatus('Search failed. Check your local network or query syntax.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleEvaluateAll = async () => {
    if (!currentJob?.id) return;
    setIsEvaluating(true);
    try {
      const res = await api.evaluateAllRanking(currentJob.id);
      const count = res?.ranked_count ?? res?.count ?? (Array.isArray(res) ? res.length : (res?.data?.length || 0));
      notify(`Ranked ${count} candidates with 6-dimension fit engine!`, 'success');
      const freshCandidates = await api.getCandidates(currentJob.id);
      const safeFresh = Array.isArray(freshCandidates) ? freshCandidates : (freshCandidates?.data || []);
      setCandidates(safeFresh);
    } catch (err) {
      notify('Ranking evaluation failed: ' + err.message, 'error');
    } finally {
      setIsEvaluating(false);
    }
  };

  const getCandidateScore = (c) => {
    if (!c) return 0;
    const rank = c.ranking;
    const val = c.score ?? c.total_score ?? c.overall_score ?? c.match_score ??
                rank?.total_score ?? rank?.overall_score ?? rank?.score ?? 0;
    const num = typeof val === 'number' ? val : parseFloat(val);
    return isNaN(num) ? 0 : Math.round(num);
  };

  // Filtering candidates
  const safeCandidates = Array.isArray(candidates) ? candidates : [];
  const filteredCandidates = safeCandidates.filter(c => {
    if (!c) return false;
    const score = getCandidateScore(c);
    if (score < Number(minScore)) return false;

    const email = c.email || (c.emails && c.emails.length > 0 ? c.emails[0] : null);
    const phone = c.phone || (c.phones && c.phones.length > 0 ? c.phones[0] : null);
    if (filterOnlyVerified && !email && !phone) return false;
    return true;
  });

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Sourcing Header & Strategy Info */}
      <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-accent">Live Search Console</span>
            {engineStatus?.has_serpapi && engineStatus?.has_github ? (
              <span className="badge badge-verified">⚡ Enterprise Hybrid Active</span>
            ) : engineStatus?.has_serpapi ? (
              <span className="badge badge-verified">🌐 Google X-Ray Active</span>
            ) : engineStatus?.has_github ? (
              <span className="badge badge-verified">🐙 Authenticated GitHub Active</span>
            ) : (
              <span className="badge badge-verified">✨ 100% Free Default Active</span>
            )}
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '6px 0 2px' }}>
            Talent Discovery Engine: {currentJob?.title || 'No Job Selected'}
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Client: {currentJob?.client_name || 'In-House'} • Target: {currentJob?.target_roles_count || 1} roles • {currentJob?.location || 'Anywhere'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={onOpenKeysModal}
            title="Configure Real-Time Engines & API Keys"
            style={{ borderColor: 'rgba(99, 102, 241, 0.4)', color: '#818cf8' }}
          >
            <Key size={13} />
            <span>Engines & Keys</span>
          </button>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={loadQueriesAndCandidates}
          >
            <RefreshCw size={13} />
            <span>Reload</span>
          </button>
          <button 
            className="btn btn-primary btn-sm"
            onClick={handleEvaluateAll}
            disabled={isEvaluating || candidates.length === 0}
          >
            <TrendingUp size={14} className={isEvaluating ? 'animate-spin' : ''} />
            <span>{isEvaluating ? 'Evaluating...' : 'Run 0-100 AI Ranking'}</span>
          </button>
        </div>
      </div>

      {/* Query Configuration Console */}
      <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={17} style={{ color: 'var(--accent-primary)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>
              Autonomous Query Templates
            </h3>
            <span className="badge badge-accent" style={{ fontSize: '11px', padding: '2px 8px' }}>
              {selectedIndices.length} of {safeQueries.length} Selected
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={handleSelectAllPlatforms}
              style={{ fontSize: '11px', padding: '4px 10px', height: '28px' }}
              title="Select all search platforms at once"
            >
              <CheckSquare size={13} style={{ color: 'var(--accent-primary)' }} />
              <span>Select All</span>
            </button>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => handleSelectOnlyPlatform(0)}
              style={{ fontSize: '11px', padding: '4px 10px', height: '28px' }}
              title="Reset selection to LinkedIn only"
            >
              <span>Reset</span>
            </button>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: '4px' }}>
              Multi-platform matrix enabled
            </div>
          </div>
        </div>

        {/* Query Selector Multi-Select Chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {safeQueries.map((q, idx) => {
            const isSelected = selectedIndices.includes(idx);
            const isPreviewActive = idx === activePreviewIndex;
            return (
              <button
                key={idx}
                type="button"
                className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleTogglePlatform(idx)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: isSelected 
                    ? (isPreviewActive ? '1px solid #ffffff' : '1px solid rgba(99, 102, 241, 0.6)') 
                    : '1px solid var(--border-subtle)',
                  boxShadow: isSelected ? '0 2px 10px rgba(99, 102, 241, 0.35)' : 'none',
                  transition: 'all 0.15s ease',
                  padding: '6px 12px'
                }}
                title={`Click to ${isSelected ? 'deselect' : 'select'} ${q.platform?.toUpperCase()}`}
              >
                {isSelected ? (
                  <Check size={13} style={{ strokeWidth: 3 }} />
                ) : (
                  <span style={{ 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '3px', 
                    border: '1px solid var(--text-dim)',
                    display: 'inline-block' 
                  }} />
                )}
                <span style={{ fontWeight: 700 }}>{q.platform ? q.platform.toUpperCase() : 'SEARCH'}</span>
                <span style={{ fontSize: '10px', opacity: isSelected ? 0.9 : 0.7 }}>
                  ({q.description || 'Boolean X-Ray'})
                </span>
              </button>
            );
          })}
        </div>

        {/* Query String Display & Live Edit Box */}
        {activeQuery && (
          <div style={{
            background: 'rgba(0, 0, 0, 0.45)',
            padding: '14px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            {/* If multiple platforms are selected, show sub-tab switcher to preview/edit each */}
            {selectedIndices.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Customize Boolean Syntax for:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {safeQueries.map((q, idx) => {
                    if (!selectedIndices.includes(idx)) return null;
                    const isActive = idx === activePreviewIndex;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActivePreviewIndex(idx)}
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: isActive ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                          border: isActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
                          color: isActive ? '#fff' : 'var(--text-muted)',
                          cursor: 'pointer',
                          fontWeight: isActive ? 700 : 500
                        }}
                      >
                        {q.platform ? q.platform.toUpperCase() : 'SEARCH'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Executed Boolean Syntax ({activeQuery.platform ? activeQuery.platform.toUpperCase() : 'CUSTOM'})
              </span>
              <span className="badge badge-accent" style={{ fontSize: '10px' }}>
                Engine: DuckDuckGo + SearXNG
              </span>
            </div>

            <textarea
              className="input-text"
              rows={3}
              style={{
                fontSize: '12px',
                color: '#a5b4fc',
                fontFamily: 'var(--font-mono)',
                background: 'rgba(0, 0, 0, 0.5)',
                resize: 'vertical'
              }}
              value={
                customQueriesMap[activePreviewIndex] !== undefined 
                  ? customQueriesMap[activePreviewIndex] 
                  : (activeQuery.query || '')
              }
              onChange={(e) => {
                const val = e.target.value;
                setCustomQueriesMap(prev => ({
                  ...prev,
                  [activePreviewIndex]: val
                }));
              }}
              placeholder="Boolean search query string..."
            />
          </div>
        )}

        {/* Execution Controls Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                Max Results / Platform:
              </span>
              <select 
                className="select-input" 
                style={{ width: '85px', padding: '5px 8px' }}
                value={maxResults}
                onChange={(e) => setMaxResults(e.target.value)}
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
              </select>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}>
              <input 
                type="checkbox" 
                checked={filterOnlyVerified} 
                onChange={(e) => setFilterOnlyVerified(e.target.checked)} 
                style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
              <span>Filter: Only profiles with verified genuine phone/email</span>
            </label>
          </div>

          <button 
            className="btn btn-primary"
            onClick={handleExecuteSearch}
            disabled={isSearching || selectedIndices.length === 0}
            style={{ padding: '9px 20px' }}
          >
            <Play size={15} className={isSearching ? 'animate-spin' : ''} />
            <span>
              {isSearching 
                ? `Executing Search (${selectedIndices.length} Platforms)...` 
                : (selectedIndices.length > 1 
                    ? `Execute Multi-Platform Search (${selectedIndices.length} Platforms)` 
                    : `Execute Live Search (${activeQuery?.platform ? activeQuery.platform.toUpperCase() : 'PLATFORM'})`
                  )
              }
            </span>
          </button>
        </div>

        {searchStatus && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            fontSize: '12px',
            color: '#a5b4fc'
          }}>
            {searchStatus}
          </div>
        )}
      </div>

      {/* Sourced Candidate Pool Grid */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
              Discovered Talent Pool ({filteredCandidates.length})
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
              Click any candidate card to open their complete 6-dimension intelligence dossier
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {/* Precision Match Score Threshold Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                Fit Threshold:
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  type="button"
                  className={`btn btn-sm ${Number(minScore) === 50 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '11px', padding: '3px 9px' }}
                  onClick={() => setMinScore(50)}
                >
                  Qualified (50%+)
                </button>
                <button 
                  type="button"
                  className={`btn btn-sm ${Number(minScore) === 75 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '11px', padding: '3px 9px' }}
                  onClick={() => setMinScore(75)}
                >
                  Strong (75%+)
                </button>
                <button 
                  type="button"
                  className={`btn btn-sm ${Number(minScore) === 0 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '11px', padding: '3px 9px' }}
                  onClick={() => setMinScore(0)}
                >
                  All (0%+)
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                <input
                  type="range"
                  min="0"
                  max="90"
                  step="5"
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                  style={{ accentColor: 'var(--accent-primary)', width: '75px', cursor: 'pointer' }}
                  title="Adjust minimum match score percentage"
                />
                <span className="badge badge-accent" style={{ minWidth: '36px', justifyContent: 'center', fontSize: '11px' }}>
                  ≥{minScore}%
                </span>
              </div>
            </div>

            <span className="badge badge-verified">
              <CheckCircle size={11} />
              Zero Simulated Contacts
            </span>
          </div>
        </div>

        {filteredCandidates.length === 0 ? (
          <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
            <Search size={36} style={{ color: 'var(--text-dim)', margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
              No candidates found in pool
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '400px', margin: '0 auto 16px' }}>
              Run the live search query above or adjust your verified contact filter to populate candidate cards.
            </p>
            <button 
              className="btn btn-primary btn-sm"
              onClick={handleExecuteSearch}
              disabled={isSearching || selectedIndices.length === 0}
            >
              <Play size={13} />
              <span>Run Search Now</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {filteredCandidates.map((candidate) => {
              const score = getCandidateScore(candidate);
              return (
                <CandidateCard
                  key={candidate.id}
                  candidate={{ ...candidate, score }}
                  onClick={() => onSelectCandidate({ ...candidate, score })}
                  onStageChange={onStageChange}
                />
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
