import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  FileText, 
  Sliders, 
  Trash2, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  RefreshCw, 
  Search, 
  UserX, 
  UserCheck, 
  Database, 
  Sparkles, 
  BarChart3, 
  Layers, 
  Key, 
  Save, 
  ChevronRight,
  ExternalLink,
  Shield,
  X
} from 'lucide-react';
import { api } from '../api';

export default function ComplianceOperationsView({ showToast }) {
  const [activeSubTab, setActiveSubTab] = useState('compliance'); // 'compliance', 'operations', 'audit', 'settings'
  const [retentionData, setRetentionData] = useState(null);
  const [operationsData, setOperationsData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [systemConfig, setSystemConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Search & Filter States
  const [erasureSearchQuery, setErasureSearchQuery] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [isPurging, setIsPurging] = useState(false);
  const [selectedCandidateToErase, setSelectedCandidateToErase] = useState(null);
  const [erasureReason, setErasureReason] = useState('DPDP Act Section 12 Right to Erasure request');
  const [isErasing, setIsErasing] = useState(false);

  // Settings Form State
  const [retentionDays, setRetentionDays] = useState(180);
  const [llmModel, setLlmModel] = useState('qwen2.5:7b');
  const [weights, setWeights] = useState({
    must_have: 40,
    nice_to_have: 15,
    experience: 15,
    location: 10,
    title: 10,
    semantic: 10,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [retRes, opsRes, auditRes, cfgRes] = await Promise.all([
        api.getRetentionStatus().catch(() => null),
        api.getOperationsMetrics().catch(() => null),
        api.getAuditLogs().catch(() => ({ logs: [] })),
        api.getSystemConfig().catch(() => null),
      ]);

      if (retRes) setRetentionData(retRes);
      if (opsRes) setOperationsData(opsRes);
      if (auditRes?.logs) setAuditLogs(auditRes.logs);
      if (cfgRes?.config) {
        setSystemConfig(cfgRes.config);
        if (cfgRes.config.retention_days) setRetentionDays(cfgRes.config.retention_days);
        if (cfgRes.config.default_llm_model) setLlmModel(cfgRes.config.default_llm_model);
        if (cfgRes.config.ranking_weights) setWeights(cfgRes.config.ranking_weights);
      }
    } catch (err) {
      console.error('Failed to load compliance data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurgeExpired = async () => {
    if (!window.confirm('Are you sure you want to permanently purge all candidates whose retention period has expired? This action cannot be undone.')) {
      return;
    }
    setIsPurging(true);
    try {
      const res = await api.purgeExpiredRecords('Recruiter');
      showToast?.(res?.message || 'Expired records purged successfully', 'success');
      loadAllData();
    } catch (err) {
      showToast?.('Purge failed: ' + err.message, 'error');
    } finally {
      setIsPurging(false);
    }
  };

  const handleToggleDNC = async (candidateId, currentDNC) => {
    try {
      const res = await api.setCandidateDNC(candidateId, !currentDNC, 'Recruiter manual toggle from DNC console');
      showToast?.(res?.message || 'DNC status updated', 'success');
      loadAllData();
    } catch (err) {
      showToast?.('Failed to update DNC status: ' + err.message, 'error');
    }
  };

  const handleExecuteErasure = async () => {
    if (!selectedCandidateToErase) return;
    setIsErasing(true);
    try {
      const res = await api.eraseCandidate(selectedCandidateToErase.id, erasureReason);
      showToast?.(res?.message || 'Candidate permanently erased', 'success');
      setSelectedCandidateToErase(null);
      loadAllData();
    } catch (err) {
      showToast?.('Erasure failed: ' + err.message, 'error');
    } finally {
      setIsErasing(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await api.updateSystemConfig({
        retention_days: Number(retentionDays),
        default_llm_model: llmModel,
        ranking_weights: weights,
      });
      showToast?.('System settings and ranking weights updated!', 'success');
      loadAllData();
    } catch (err) {
      showToast?.('Failed to update settings: ' + err.message, 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const filteredAuditLogs = auditLogs.filter(log => {
    if (auditActionFilter && log.action !== auditActionFilter) return false;
    return true;
  });

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner Header */}
      <div className="glass-card" style={{
        padding: '22px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 27, 75, 0.5) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.3)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="badge badge-accent">
              <ShieldCheck size={12} /> DPDP Act Section 12 Governance
            </span>
            <span className="badge badge-verified">
              Phase 7 Complete
            </span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Compliance, Operations & Audit Hub
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0', maxWidth: '650px' }}>
            Enforce statutory data retention limits, handle Right to Erasure requests with immutable audit logging, monitor real-time sourcing health, and tune ranking engine parameters.
          </p>
        </div>

        <button 
          className="btn btn-secondary btn-sm"
          onClick={loadAllData}
          disabled={isLoading}
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh All</span>
        </button>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <button
          className={`btn btn-sm ${activeSubTab === 'compliance' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('compliance')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Shield size={14} />
          <span>DPDP Compliance & Erasure</span>
        </button>
        <button
          className={`btn btn-sm ${activeSubTab === 'operations' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('operations')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <BarChart3 size={14} />
          <span>Operations & Analytics</span>
        </button>
        <button
          className={`btn btn-sm ${activeSubTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('audit')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <FileText size={14} />
          <span>Immutable Audit Trail ({auditLogs.length})</span>
        </button>
        <button
          className={`btn btn-sm ${activeSubTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('settings')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Sliders size={14} />
          <span>System Settings & Weights</span>
        </button>
      </div>

      {/* TAB 1: DPDP COMPLIANCE & ERASURE */}
      {activeSubTab === 'compliance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* KPI Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="glass-card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0.03) 100%)', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Statutory Retention Window</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginTop: '6px' }}>{retentionData?.default_retention_days || 180} Days</div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>Auto-enforced on candidate creation</div>
            </div>

            <div className="glass-card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.03) 100%)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
              <div style={{ fontSize: '11px', color: '#f87171', fontWeight: 700, textTransform: 'uppercase' }}>Expired Records Queue</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#f87171', marginTop: '6px' }}>{retentionData?.expired_count || 0}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>Exceeded legal retention window</div>
            </div>

            <div className="glass-card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.03) 100%)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
              <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase' }}>Do Not Contact (DNC)</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#fbbf24', marginTop: '6px' }}>{retentionData?.dnc_count || 0}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>Contacts masked, outreach blocked</div>
            </div>

            <div className="glass-card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.03) 100%)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              <div style={{ fontSize: '11px', color: '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>Compliant Active Records</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', marginTop: '6px' }}>
                {Math.max(0, (retentionData?.total_candidates || 0) - (retentionData?.expired_count || 0))}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>Fully compliant with local storage</div>
            </div>
          </div>

          {/* Retention Actions Row */}
          <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: 0 }}>
                Automated Retention Purge & Maintenance
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Permanently purge all candidates whose 180-day retention period has expired. All associated resumes and contact points are destroyed.
              </p>
            </div>
            <button 
              className="btn btn-sm"
              onClick={handlePurgeExpired}
              disabled={isPurging || (retentionData?.expired_count || 0) === 0}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                padding: '8px 18px',
                fontSize: '13px'
              }}
            >
              <Trash2 size={14} className={isPurging ? 'animate-spin' : ''} />
              <span>{isPurging ? 'Purging Expired Records...' : `Purge ${retentionData?.expired_count || 0} Expired Candidates`}</span>
            </button>
          </div>

          {/* One-Click Total Erasure (Right to Be Forgotten) Tool */}
          <div className="glass-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserX size={18} style={{ color: 'var(--danger)' }} />
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: 0 }}>
                  One-Click Total Erasure (Right to Be Forgotten)
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                  DPDP Act Section 12: Search for any candidate to execute full cascading deletion with immutable audit logging.
                </span>
              </div>
            </div>

            {/* Candidate Search Box */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input 
                  type="text"
                  className="input-text"
                  placeholder="Type candidate name or profile keyword to find and erase..."
                  value={erasureSearchQuery}
                  onChange={(e) => setErasureSearchQuery(e.target.value)}
                  style={{ paddingLeft: '34px', fontSize: '13px' }}
                />
              </div>
            </div>

            {/* Candidate Search Results for Erasure */}
            {erasureSearchQuery.trim() && (
              <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '8px' }}>
                {retentionData?.expired_candidates
                  ?.concat(retentionData?.dnc_candidates || [])
                  ?.filter(c => c.full_name?.toLowerCase().includes(erasureSearchQuery.toLowerCase()))
                  ?.map(c => (
                    <div 
                      key={c.id}
                      style={{
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                      }}
                    >
                      <div>
                        <strong style={{ color: '#fff', fontSize: '13px' }}>{c.full_name}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '8px' }}>{c.headline || c.location}</span>
                      </div>
                      <button 
                        className="btn btn-sm"
                        onClick={() => setSelectedCandidateToErase(c)}
                        style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '11px', padding: '4px 10px' }}
                      >
                        <Trash2 size={12} />
                        <span>Select for Erasure</span>
                      </button>
                    </div>
                  ))}
              </div>
            )}

            {/* Erasure Confirmation Drawer/Box */}
            {selectedCandidateToErase && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />
                    <strong style={{ color: '#fff', fontSize: '14px' }}>
                      Confirm Irreversible Erasure: {selectedCandidateToErase.full_name}
                    </strong>
                  </div>
                  <button onClick={() => setSelectedCandidateToErase(null)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  This will immediately destroy all candidate data, contact points, uploaded resumes, matching scores, and outreach history from local SQLite storage. An entry will be permanently written to the immutable Audit Log.
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input 
                    type="text"
                    className="input-text"
                    value={erasureReason}
                    onChange={(e) => setErasureReason(e.target.value)}
                    placeholder="Enter legal / compliance reason..."
                    style={{ flex: 1, fontSize: '12px' }}
                  />
                  <button 
                    className="btn btn-sm"
                    onClick={handleExecuteErasure}
                    disabled={isErasing}
                    style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: '8px 18px', fontWeight: 700 }}
                  >
                    <Trash2 size={13} className={isErasing ? 'animate-spin' : ''} />
                    <span>{isErasing ? 'Erasing...' : 'Confirm Permanent Erasure'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Do Not Contact (DNC) Registry Table */}
          <div className="glass-card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: 0 }}>
                  Do Not Contact (DNC) Registry ({retentionData?.dnc_count || 0})
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                  Candidates who opted out. Outreach generator automatically blocks messaging to these candidates.
                </span>
              </div>
            </div>

            {(!retentionData?.dnc_candidates || retentionData.dnc_candidates.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)', fontSize: '13px' }}>
                No candidates currently on the Do Not Contact registry.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {retentionData.dnc_candidates.map(cand => (
                  <div 
                    key={cand.id} 
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <strong style={{ color: '#fff', fontSize: '13px' }}>{cand.full_name}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '10px' }}>
                        {cand.headline || cand.location}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', fontSize: '11px' }}>
                        Restricted
                      </span>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleToggleDNC(cand.id, true)}
                        style={{ fontSize: '11px', padding: '3px 10px' }}
                      >
                        <span>Remove DNC</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: OPERATIONS & ANALYTICS */}
      {activeSubTab === 'operations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Sourcing Intelligence Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div className="glass-card" style={{ padding: '18px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Active Jobs</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>{operationsData?.summary?.total_jobs || 0}</div>
            </div>
            <div className="glass-card" style={{ padding: '18px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Discovered Talent</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--accent-primary)', marginTop: '4px' }}>{operationsData?.summary?.total_candidates || 0}</div>
            </div>
            <div className="glass-card" style={{ padding: '18px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Verified Emails</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>{operationsData?.summary?.verified_emails || 0}</div>
            </div>
            <div className="glass-card" style={{ padding: '18px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Verified Phones</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--info)', marginTop: '4px' }}>{operationsData?.summary?.verified_phones || 0}</div>
            </div>
            <div className="glass-card" style={{ padding: '18px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Forms Submitted</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--accent-secondary)', marginTop: '4px' }}>{operationsData?.summary?.form_submissions || 0}</div>
            </div>
          </div>

          {/* Funnel Stage Breakdown & Platform Distribution */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
            {/* Funnel Stage Distribution */}
            <div className="glass-card" style={{ padding: '22px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '14px' }}>
                Pipeline Stage Funnel
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(operationsData?.pipeline_funnel || {}).map(([stage, count]) => {
                  const total = operationsData?.summary?.total_candidates || 1;
                  const pct = Math.min(100, Math.round((count / total) * 100));
                  return (
                    <div key={stage}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#fff' }}>{stage}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{count} candidates ({pct}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(4, pct)}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '3px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Platform Distribution */}
            <div className="glass-card" style={{ padding: '22px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '14px' }}>
                Platform Provenance Matrix
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(operationsData?.platform_distribution || {}).map(([platform, count]) => (
                  <div key={platform} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ textTransform: 'uppercase', fontWeight: 700, fontSize: '12px', color: '#fff' }}>{platform}</span>
                    <span className="badge badge-accent" style={{ fontSize: '11px' }}>{count} profiles</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: IMMUTABLE AUDIT TRAIL */}
      {activeSubTab === 'audit' && (
        <div className="glass-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: 0 }}>
                Immutable DPDP Audit Trail
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                Chronological ledger of statutory actions, searches, contact reveals, exports, and erasures.
              </span>
            </div>

            {/* Filter by action */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select 
                className="select-input"
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                style={{ fontSize: '12px', padding: '5px 10px' }}
              >
                <option value="">All Actions</option>
                <option value="erasure">Erasures (Right to be Forgotten)</option>
                <option value="dnc_updated">DNC Updates</option>
                <option value="settings_update">Settings Updates</option>
                <option value="search">Searches</option>
                <option value="export">Exports</option>
              </select>
            </div>
          </div>

          {filteredAuditLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)', fontSize: '13px' }}>
              No audit records matching filter criteria.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredAuditLogs.map(log => {
                let badgeColor = 'rgba(99, 102, 241, 0.15)';
                let textColor = 'var(--accent-primary)';
                if (log.action === 'erasure') {
                  badgeColor = 'rgba(239, 68, 68, 0.15)';
                  textColor = '#f87171';
                } else if (log.action === 'dnc_updated') {
                  badgeColor = 'rgba(245, 158, 11, 0.15)';
                  textColor = '#fbbf24';
                } else if (log.action === 'settings_update') {
                  badgeColor = 'rgba(16, 185, 129, 0.15)';
                  textColor = '#34d399';
                }

                return (
                  <div 
                    key={log.id}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: badgeColor,
                        color: textColor,
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}>
                        {log.action}
                      </span>
                      <span style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>
                        {log.entity_type}: <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{log.entity_id}</span>
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        by {log.performed_by}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {log.details && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {JSON.stringify(log.details).slice(0, 60)}...
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Just now'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SYSTEM SETTINGS & ENGINE TUNING */}
      {activeSubTab === 'settings' && (
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: 0 }}>
              Autonomous Engine Tuning & Governance Settings
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
              Configure the 6-dimension candidate fit weights, legal retention duration, and local AI model defaults.
            </span>
          </div>

          {/* Retention & Model Configuration */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                Default DPDP Retention Limit (Days):
              </label>
              <input 
                type="number"
                className="input-text"
                min={30}
                max={365}
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Default: 180 days under Indian DPDP Act best practices.</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                Default Local Ollama LLM Model:
              </label>
              <select 
                className="select-input"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
              >
                <option value="qwen2.5:7b">Qwen 2.5 (7B) — Recommended for precision</option>
                <option value="qwen2.5:3b">Qwen 2.5 (3B) — Lightweight / Ultra-fast</option>
                <option value="deepseek-r1:8b">DeepSeek R1 (8B) — Reasoning</option>
                <option value="mistral:7b">Mistral (7B)</option>
              </select>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Zero external API costs, executes completely on localhost.</span>
            </div>
          </div>

          {/* 6-Dimension Ranking Weights Sliders */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', margin: 0 }}>
                6-Dimension Explainable Fit Weights
              </h4>
              <span className="badge badge-accent" style={{ fontSize: '11px' }}>
                Normalized Automatic Distribution
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Must-Have Skills Fit</span>
                  <strong>{weights.must_have}%</strong>
                </div>
                <input 
                  type="range" 
                  min={10} 
                  max={60} 
                  value={weights.must_have} 
                  onChange={(e) => setWeights(prev => ({ ...prev, must_have: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Nice-to-Have Skills Fit</span>
                  <strong>{weights.nice_to_have}%</strong>
                </div>
                <input 
                  type="range" 
                  min={5} 
                  max={30} 
                  value={weights.nice_to_have} 
                  onChange={(e) => setWeights(prev => ({ ...prev, nice_to_have: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Experience Bounds Fit</span>
                  <strong>{weights.experience}%</strong>
                </div>
                <input 
                  type="range" 
                  min={5} 
                  max={30} 
                  value={weights.experience} 
                  onChange={(e) => setWeights(prev => ({ ...prev, experience: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Location / City Alias Cluster</span>
                  <strong>{weights.location}%</strong>
                </div>
                <input 
                  type="range" 
                  min={5} 
                  max={25} 
                  value={weights.location} 
                  onChange={(e) => setWeights(prev => ({ ...prev, location: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Title Relevance (RapidFuzz)</span>
                  <strong>{weights.title}%</strong>
                </div>
                <input 
                  type="range" 
                  min={5} 
                  max={25} 
                  value={weights.title} 
                  onChange={(e) => setWeights(prev => ({ ...prev, title: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Semantic MiniLM JD Match</span>
                  <strong>{weights.semantic}%</strong>
                </div>
                <input 
                  type="range" 
                  min={5} 
                  max={25} 
                  value={weights.semantic} 
                  onChange={(e) => setWeights(prev => ({ ...prev, semantic: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <button 
              className="btn btn-primary"
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              style={{ padding: '9px 24px' }}
            >
              <Save size={14} className={isSavingSettings ? 'animate-spin' : ''} />
              <span>{isSavingSettings ? 'Saving Settings...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
