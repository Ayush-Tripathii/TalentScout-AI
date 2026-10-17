import React, { useState, useEffect, useRef } from 'react';
import { 
  Briefcase, 
  Plus, 
  RefreshCw, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  Key, 
  ClipboardCheck,
  Bell,
  BellRing,
  ExternalLink,
  Check,
  Radio,
  LogOut,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import { api } from '../api';

export default function Topbar({ 
  jobs, 
  selectedJobId, 
  onSelectJob, 
  onOpenNewJobModal, 
  onOpenKeysModal, 
  onOpenQuickCapture, 
  onRefresh, 
  isRefreshing,
  onNavigate,
  onSelectCandidate,
  currentUser,
  onLogout,
  onOpenAdmin,
}) {
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const currentJob = safeJobs.find(j => j.id === selectedJobId) || safeJobs[0] || null;

  // Notification Bell State
  const [unreadAlerts, setUnreadAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 25000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await api.getAlertNotifications(null, true, 5);
      setUnreadAlerts(res?.data || []);
      setUnreadCount(res?.unread_count || 0);
    } catch (err) {
      // quiet poll
    }
  };

  const handleMarkRead = async (id, e) => {
    e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      setUnreadAlerts(prev => prev.filter(a => a.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportExcel = () => {
    if (!currentJob) return;
    window.open(api.getExportExcelUrl(currentJob.id), '_blank');
  };

  const handleExportCsv = () => {
    if (!currentJob) return;
    window.open(api.getExportCsvUrl(currentJob.id), '_blank');
  };

  return (
    <header className="topbar">
      {/* Current Requirement Context Dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Briefcase size={18} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active Requirement:
          </span>
        </div>

        <select 
          className="select-input"
          value={selectedJobId || ''} 
          onChange={(e) => onSelectJob(e.target.value)}
          style={{ width: '280px', padding: '6px 12px', fontSize: '13px', fontWeight: 600 }}
        >
          {safeJobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title} — {job.client_name || 'In-House'}
            </option>
          ))}
          {safeJobs.length === 0 && <option value="">No Requirements Found</option>}
        </select>


        {currentJob && (() => {
          const minExp = currentJob.min_experience ?? currentJob.min_experience_years ?? 0;
          const maxExp = currentJob.max_experience ?? currentJob.max_experience_years ?? 8;
          const roles = currentJob.positions_count ?? currentJob.target_roles_count;
          const ctcLpa = currentJob.max_ctc ? currentJob.max_ctc : (currentJob.budget_max_inr ? (currentJob.budget_max_inr / 100000).toFixed(1) : null);

          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <span className="badge badge-accent">
                Exp: {minExp} - {maxExp} yrs
              </span>
              {roles && (
                <span className="badge badge-verified">
                  Target: {roles} {roles > 1 ? 'roles' : 'role'}
                </span>
              )}
              {ctcLpa && (
                <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  Budget: ₹{ctcLpa} LPA
                </span>
              )}
            </div>
          );
        })()}
      </div>

      {/* Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        
        {/* Notification Bell with Live Unread Counter */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            title="Candidate Match Alerts & Autonomous Notifications"
            style={{ 
              position: 'relative', 
              padding: '6px 10px',
              borderColor: unreadCount > 0 ? 'rgba(245, 158, 11, 0.4)' : undefined,
              background: unreadCount > 0 ? 'rgba(245, 158, 11, 0.08)' : undefined
            }}
          >
            {unreadCount > 0 ? (
              <BellRing size={15} style={{ color: '#fbbf24' }} />
            ) : (
              <Bell size={15} />
            )}
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                background: '#ef4444',
                color: '#fff',
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: 800,
                padding: '1px 5px',
                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.5)'
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Popover */}
          {isNotifOpen && (
            <div style={{
              position: 'absolute',
              top: '120%',
              right: 0,
              width: '360px',
              background: '#0f172a',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '12px',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
              zIndex: 1000,
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.02)'
              }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                  Candidate Match Alerts
                </span>
                {unreadCount > 0 && (
                  <span className="badge" style={{ background: '#f59e0b', color: '#000', fontSize: '10px', fontWeight: 800 }}>
                    {unreadCount} Unread
                  </span>
                )}
              </div>

              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {unreadAlerts.length > 0 ? (
                  unreadAlerts.map((alert) => (
                    <div 
                      key={alert.id}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        cursor: 'pointer',
                        background: 'rgba(99, 102, 241, 0.05)'
                      }}
                      onClick={() => {
                        setIsNotifOpen(false);
                        if (onSelectCandidate) {
                          onSelectCandidate({ id: alert.candidate_id, full_name: alert.candidate_name });
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                          {alert.candidate_name}
                        </span>
                        <span className="badge badge-accent" style={{ fontSize: '10px', padding: '1px 6px' }}>
                          {alert.score.toFixed(1)}% Match
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {alert.message}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                          {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onClick={(e) => handleMarkRead(alert.id, e)}
                          title="Mark read"
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px' }}
                        >
                          <Check size={12} /> Mark Read
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    No unread candidate alerts
                  </div>
                )}
              </div>

              <div style={{
                padding: '8px 16px',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.02)'
              }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', fontSize: '11px' }}
                  onClick={() => {
                    setIsNotifOpen(false);
                    if (onNavigate) onNavigate('automated');
                  }}
                >
                  Manage Sourcing Autopilots & Alerts →
                </button>
              </div>
            </div>
          )}
        </div>

        <button 
          className="btn btn-secondary btn-sm"
          onClick={onOpenQuickCapture}
          title="Quick Paste candidate snippet (Ctrl+V) for instant extraction"
          style={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34d399', background: 'rgba(16, 185, 129, 0.08)' }}
        >
          <ClipboardCheck size={14} />
          <span>Quick Paste</span>
        </button>

        <button 
          className="btn btn-secondary btn-sm"
          onClick={onOpenKeysModal}
          title="Configure Real-Time Engines & API Keys"
          style={{ borderColor: 'rgba(99, 102, 241, 0.4)', color: '#818cf8' }}
        >
          <Key size={14} />
          <span>Sourcing Keys</span>
        </button>

        <button 
          className="btn btn-secondary btn-sm"
          onClick={onRefresh}
          title="Refresh Data"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>

        {/* Export Buttons */}
        {currentJob && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={handleExportExcel}
              title="Download clean Excel format"
            >
              <FileSpreadsheet size={14} style={{ color: 'var(--success)' }} />
              <span>Export Excel</span>
            </button>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={handleExportCsv}
              title="Download CSV"
            >
              <Download size={14} />
              <span>CSV</span>
            </button>
          </div>
        )}

        <button 
          className="btn btn-primary btn-sm"
          onClick={onOpenNewJobModal}
        >
          <Plus size={15} />
          <span>New Requirement</span>
        </button>

        {/* Logged-In User Profile & Logout */}
        {currentUser && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginLeft: '6px',
            paddingLeft: '10px',
            borderLeft: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            {/* Private Workspace Indicator for Regular Recruiters */}
            {currentUser.role !== 'admin' && (
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#34d399',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                }}
                title="Your private recruiter workspace. Data and candidates are isolated to your account."
              >
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                <span>Private Workspace</span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img 
                src={currentUser.avatar} 
                alt={currentUser.name} 
                style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--accent-primary)', objectFit: 'cover' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', lineHeight: '1.2' }}>
                  {currentUser.name}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.2' }}>
                  {currentUser.company || (currentUser.role === 'admin' ? 'Security Admin' : 'Recruiter')}
                </span>
              </div>
            </div>

            {currentUser.role === 'admin' && onOpenAdmin && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={onOpenAdmin}
                title="Switch to Administrator & CMS Portal"
                style={{
                  padding: '4px 8px',
                  borderColor: 'rgba(99, 102, 241, 0.4)',
                  color: '#a5b4fc',
                  background: 'rgba(99, 102, 241, 0.15)',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ShieldCheck size={12} style={{ color: '#818cf8' }} />
                <span>Admin CMS</span>
              </button>
            )}

            <button
              className="btn btn-secondary btn-sm"
              onClick={onLogout}
              title="Sign Out of TalentScout Workspace"
              style={{
                padding: '5px 8px',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                background: 'rgba(239, 68, 68, 0.08)'
              }}
            >
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
