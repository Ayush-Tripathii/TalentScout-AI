import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Play, 
  Pause, 
  Settings2, 
  Bell, 
  BellRing, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  RefreshCw, 
  ExternalLink, 
  Sliders, 
  Zap, 
  ShieldCheck,
  Check,
  X,
  Radio,
  Sparkles,
  Search,
  Mail,
  Webhook
} from 'lucide-react';
import { api } from '../api';

export default function AutomatedSourcingView({ 
  currentJob, 
  onSelectCandidate, 
  showToast 
}) {
  const [schedules, setSchedules] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [runningJobId, setRunningJobId] = useState(null);

  // Configuration Modal State
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState({
    is_enabled: false,
    interval_hours: 12,
    min_score_threshold: 75,
    alert_email_enabled: false,
    alert_email_recipients: '',
    alert_webhook_enabled: false,
    alert_webhook_url: '',
    target_platforms: ['linkedin', 'github', 'naukri', 'foundit'],
    include_contact_visible: true,
  });
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState(null);

  useEffect(() => {
    loadData();
    // Refresh alerts every 30 seconds
    const interval = setInterval(loadNotificationsOnly, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [schedRes, notifRes] = await Promise.all([
        api.getSchedules(),
        api.getAlertNotifications(null, false, 50),
      ]);
      setSchedules(schedRes?.data || []);
      setNotifications(notifRes?.data || []);
      setUnreadCount(notifRes?.unread_count || 0);
    } catch (err) {
      console.error('Failed to load scheduler data:', err);
      showToast('Error loading auto-sourcing schedules: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadNotificationsOnly = async () => {
    try {
      const notifRes = await api.getAlertNotifications(null, false, 50);
      setNotifications(notifRes?.data || []);
      setUnreadCount(notifRes?.unread_count || 0);
    } catch (err) {
      console.error('Failed to poll notifications:', err);
    }
  };

  const handleToggleSchedule = async (jobId, currentStatus) => {
    const newStatus = !currentStatus;
    try {
      await api.toggleSchedule(jobId, newStatus);
      showToast(newStatus ? 'Autopilot sourcing activated!' : 'Autopilot sourcing paused.', 'success');
      setSchedules(prev => prev.map(s => s.job_id === jobId ? { ...s, is_enabled: newStatus } : s));
    } catch (err) {
      showToast('Failed to toggle schedule: ' + err.message, 'error');
    }
  };

  const handleTriggerRun = async (jobId, jobTitle) => {
    setRunningJobId(jobId);
    try {
      showToast(`Running live automated search for "${jobTitle}"...`, 'info');
      const res = await api.triggerScheduleRun(jobId);
      const data = res?.data || {};
      showToast(
        `Search cycle complete! Found ${data.candidates_discovered || 0} candidate(s), sent ${data.alerts_sent || 0} high-fit alert(s).`,
        'success'
      );
      loadData();
    } catch (err) {
      showToast('Error during automated sourcing run: ' + err.message, 'error');
    } finally {
      setRunningJobId(null);
    }
  };

  const handleOpenConfigModal = (sched) => {
    setSelectedSchedule(sched);
    setModalForm({
      is_enabled: sched.is_enabled,
      interval_hours: sched.interval_hours || 12,
      min_score_threshold: sched.min_score_threshold || 75,
      alert_email_enabled: sched.alert_email_enabled || false,
      alert_email_recipients: sched.alert_email_recipients || '',
      alert_webhook_enabled: sched.alert_webhook_enabled || false,
      alert_webhook_url: sched.alert_webhook_url || '',
      target_platforms: sched.target_platforms || ['linkedin', 'github', 'naukri', 'foundit'],
      include_contact_visible: sched.include_contact_visible ?? true,
    });
    setWebhookTestResult(null);
    setIsModalOpen(true);
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!selectedSchedule) return;

    try {
      await api.configureSchedule(selectedSchedule.job_id, modalForm);
      showToast('Autopilot configuration saved successfully!', 'success');
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      showToast('Failed to save configuration: ' + err.message, 'error');
    }
  };

  const handleTestWebhook = async () => {
    if (!modalForm.alert_webhook_url) {
      showToast('Please provide a webhook URL to test.', 'error');
      return;
    }
    setTestingWebhook(true);
    setWebhookTestResult(null);
    try {
      const res = await api.testWebhook(modalForm.alert_webhook_url);
      setWebhookTestResult(res?.data || { success: false, message: 'No response' });
      if (res?.data?.success) {
        showToast('Webhook ping sent successfully!', 'success');
      } else {
        showToast('Webhook ping failed: ' + (res?.data?.message || 'Check URL'), 'error');
      }
    } catch (err) {
      setWebhookTestResult({ success: false, message: err.message });
      showToast('Webhook test error: ' + err.message, 'error');
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleMarkRead = async (notifId) => {
    try {
      await api.markNotificationRead(notifId);
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      showToast('All notifications marked as read', 'info');
    } catch (err) {
      showToast('Failed to mark all read: ' + err.message, 'error');
    }
  };

  const activeSchedulesCount = schedules.filter(s => s.is_enabled).length;
  const totalRunsCount = schedules.reduce((acc, s) => acc + (s.total_runs_count || 0), 0);
  const totalFoundCount = schedules.reduce((acc, s) => acc + (s.total_candidates_found || 0), 0);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: '16px',
        padding: '24px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.5)'
          }}>
            <Bot size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                Automated Background Sourcing & Alerts
              </h2>
              <span className="badge badge-accent" style={{ fontSize: '11px', fontWeight: 700 }}>
                PHASE 8 LIVE
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Autonomous 24/7 talent crawler with multi-platform scraping, explainable 0–100 match filtering, and real-time Slack/Email alerts.
            </p>
          </div>
        </div>

        <button 
          className="btn btn-secondary btn-sm"
          onClick={loadData}
          disabled={isLoading}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Sync Now</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>
            <span>ACTIVE AUTOPILOTS</span>
            <Radio size={16} style={{ color: activeSchedulesCount > 0 ? '#10b981' : 'var(--text-muted)' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: activeSchedulesCount > 0 ? '#10b981' : '#fff' }}>
            {activeSchedulesCount} <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500 }}>/ {schedules.length} Jobs</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Running scheduled background scrapes
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>
            <span>AUTONOMOUS RUNS</span>
            <Zap size={16} style={{ color: '#6366f1' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: '#818cf8' }}>
            {totalRunsCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Total background sourcing cycles completed
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>
            <span>CANDIDATES DISCOVERED</span>
            <Search size={16} style={{ color: '#38bdf8' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: '#38bdf8' }}>
            {totalFoundCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Ingested into candidate rosters & ranked
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>
            <span>HIGH-FIT ALERTS SENT</span>
            <BellRing size={16} style={{ color: unreadCount > 0 ? '#f59e0b' : 'var(--text-muted)' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: unreadCount > 0 ? '#fbbf24' : '#fff' }}>
            {notifications.length} <span style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 600 }}>({unreadCount} unread)</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Dispatched via In-App / Slack / Webhook
          </div>
        </div>
      </div>

      {/* Main Workspace Split: Schedules (Left 60%) + Alerts Feed (Right 40%) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        
        {/* Left Column: Scheduled Jobs Table / Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={18} style={{ color: 'var(--accent-primary)' }} />
              Active Job Sourcing Autopilots
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Configure intervals & score thresholds
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {schedules.map((sched) => {
              const isRunning = runningJobId === sched.job_id;
              const isDue = sched.is_enabled && sched.next_run_at && new Date(sched.next_run_at) <= new Date();

              return (
                <div 
                  key={sched.job_id} 
                  className="card"
                  style={{
                    padding: '20px',
                    borderColor: sched.is_enabled ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-subtle)',
                    background: sched.is_enabled ? 'rgba(30, 41, 59, 0.5)' : 'var(--bg-card)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                          {sched.job_title}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                          {sched.client_name}
                        </span>
                      </div>

                      {/* Schedule Summary tags */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                        <span className={`badge ${sched.is_enabled ? 'badge-verified' : 'badge-subtle'}`} style={{ fontSize: '11px' }}>
                          {sched.is_enabled ? `Autopilot: Every ${sched.interval_hours}h` : 'Autopilot: Paused'}
                        </span>

                        <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)', fontSize: '11px' }}>
                          Alert if Match ≥ {sched.min_score_threshold}%
                        </span>

                        {sched.alert_webhook_enabled && (
                          <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontSize: '11px' }}>
                            <Webhook size={11} style={{ marginRight: '4px' }} /> Webhook Active
                          </span>
                        )}

                        {sched.alert_email_enabled && (
                          <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '11px' }}>
                            <Mail size={11} style={{ marginRight: '4px' }} /> Email Alert
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Toggle & Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        className={`btn btn-sm ${sched.is_enabled ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => handleToggleSchedule(sched.job_id, sched.is_enabled)}
                        style={{
                          borderColor: sched.is_enabled ? 'rgba(239, 68, 68, 0.4)' : undefined,
                          color: sched.is_enabled ? '#f87171' : undefined,
                        }}
                        title={sched.is_enabled ? 'Pause Autopilot' : 'Enable Autopilot'}
                      >
                        {sched.is_enabled ? <Pause size={13} /> : <Play size={13} />}
                        <span>{sched.is_enabled ? 'Pause' : 'Activate'}</span>
                      </button>

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleTriggerRun(sched.job_id, sched.job_title)}
                        disabled={isRunning}
                        title="Run background sourcing cycle immediately"
                        style={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34d399' }}
                      >
                        <RefreshCw size={13} className={isRunning ? 'animate-spin' : ''} />
                        <span>{isRunning ? 'Scraping...' : 'Run Now'}</span>
                      </button>

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenConfigModal(sched)}
                        title="Configure schedule frequency, thresholds, and alert channels"
                      >
                        <Settings2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Execution Status Footer */}
                  <div style={{
                    marginTop: '14px',
                    paddingTop: '12px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px',
                    color: 'var(--text-muted)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span>
                        <strong>Target Platforms:</strong> {(sched.target_platforms || []).join(', ') || 'All Platforms'}
                      </span>
                      <span>•</span>
                      <span>
                        <strong>Total Discovered:</strong> {sched.total_candidates_found || 0}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={13} />
                      <span>
                        {sched.last_run_at 
                          ? `Last Run: ${new Date(sched.last_run_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : 'Not run yet'}
                      </span>
                      {sched.is_enabled && sched.next_run_at && (
                        <span style={{ color: isDue ? '#fbbf24' : 'var(--text-muted)' }}>
                          (Next: {new Date(sched.next_run_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </span>
                      )}
                    </div>
                  </div>

                  {sched.last_run_summary && (
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#94a3b8', background: 'rgba(0, 0, 0, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
                      ⚡ {sched.last_run_summary}
                    </div>
                  )}
                </div>
              );
            })}

            {schedules.length === 0 && !isLoading && (
              <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Bot size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <h4>No active requirements found to schedule</h4>
                <p style={{ fontSize: '13px', marginTop: '6px' }}>Create a Job Requirement from the Topbar to enable autonomous background sourcing.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Real-Time High-Fit Alerts Notification Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BellRing size={18} style={{ color: '#f59e0b' }} />
              High-Fit Alert Feed
              {unreadCount > 0 && (
                <span className="badge" style={{ background: '#f59e0b', color: '#000', fontWeight: 800, fontSize: '10px' }}>
                  {unreadCount} NEW
                </span>
              )}
            </h3>

            {unreadCount > 0 && (
              <button 
                className="btn btn-secondary btn-sm"
                onClick={handleMarkAllRead}
                style={{ fontSize: '11px', padding: '4px 8px' }}
              >
                Mark All Read
              </button>
            )}
          </div>

          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxHeight: '750px',
            overflowY: 'auto',
          }}>
            {notifications.map((notif) => (
              <div
                key={notif.id}
                style={{
                  background: notif.is_read ? 'rgba(255, 255, 255, 0.02)' : 'rgba(99, 102, 241, 0.08)',
                  border: `1px solid ${notif.is_read ? 'var(--border-subtle)' : 'rgba(99, 102, 241, 0.3)'}`,
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                      {notif.candidate_name || 'Discovered Candidate'}
                    </span>
                    <span 
                      className="badge" 
                      style={{
                        background: notif.score >= 85 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: notif.score >= 85 ? '#34d399' : '#fbbf24',
                        fontWeight: 800,
                        fontSize: '11px',
                      }}
                    >
                      {notif.score.toFixed(1)} / 100 Match
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!notif.is_read && (
                      <button 
                        onClick={() => handleMarkRead(notif.id)}
                        title="Mark as read"
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {notif.message}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {(notif.channels_sent || []).map((ch) => (
                      <span key={ch} style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)', background: 'rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                        {ch}
                      </span>
                    ))}
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    onClick={() => {
                      handleMarkRead(notif.id);
                      onSelectCandidate({ id: notif.candidate_id, full_name: notif.candidate_name });
                    }}
                  >
                    <span>View Dossier</span>
                    <ExternalLink size={11} />
                  </button>
                </div>
              </div>
            ))}

            {notifications.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Bell size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                <div style={{ fontSize: '13px', fontWeight: 600 }}>No high-fit candidate alerts yet</div>
                <div style={{ fontSize: '11px', marginTop: '4px' }}>
                  When the background sourcer finds profiles scoring above threshold, alerts will populate here in real-time.
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Schedule Configuration Modal */}
      {isModalOpen && selectedSchedule && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sliders size={20} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                  Autopilot Configuration: {selectedSchedule.job_title}
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Autopilot Master Toggle */}
              <div style={{
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                    Enable Autonomous Background Sourcing
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Continuously scans web engines and updates the candidate pipeline automatically.
                  </div>
                </div>

                <input 
                  type="checkbox"
                  checked={modalForm.is_enabled}
                  onChange={(e) => setModalForm(prev => ({ ...prev, is_enabled: e.target.checked }))}
                  style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                />
              </div>

              {/* Crawl Frequency */}
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Sourcing Cycle Frequency:
                </label>
                <select
                  className="select-input"
                  value={modalForm.interval_hours}
                  onChange={(e) => setModalForm(prev => ({ ...prev, interval_hours: parseInt(e.target.value) }))}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                >
                  <option value={4}>Every 4 Hours (High Velocity Hiring)</option>
                  <option value={6}>Every 6 Hours (Standard Contract-Staffing)</option>
                  <option value={12}>Every 12 Hours (Twice Daily)</option>
                  <option value={24}>Every 24 Hours (Daily Digest)</option>
                  <option value={48}>Every 48 Hours (Low Maintenance)</option>
                </select>
              </div>

              {/* High-Fit Score Alert Threshold */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>
                    High-Fit Score Alert Threshold:
                  </label>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--accent-primary)' }}>
                    ≥ {modalForm.min_score_threshold}% Match
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={modalForm.min_score_threshold}
                  onChange={(e) => setModalForm(prev => ({ ...prev, min_score_threshold: parseFloat(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Only candidates scoring at or above this threshold will trigger instant Slack, Email, and In-App alerts.
                </div>
              </div>

              {/* Target Platforms Multi-Check */}
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Target Sourcing Platforms:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {['linkedin', 'github', 'naukri', 'foundit'].map((plat) => {
                    const isChecked = modalForm.target_platforms.includes(plat);
                    return (
                      <label 
                        key={plat}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: isChecked ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${isChecked ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-subtle)'}`,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          textTransform: 'capitalize',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setModalForm(prev => ({ ...prev, target_platforms: [...prev.target_platforms, plat] }));
                            } else {
                              setModalForm(prev => ({ ...prev, target_platforms: prev.target_platforms.filter(p => p !== plat) }));
                            }
                          }}
                          style={{ accentColor: 'var(--accent-primary)' }}
                        />
                        <span>{plat}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Webhook Alert Integration */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Webhook size={15} style={{ color: '#38bdf8' }} />
                    Slack / Discord / Teams Webhook
                  </label>
                  <input
                    type="checkbox"
                    checked={modalForm.alert_webhook_enabled}
                    onChange={(e) => setModalForm(prev => ({ ...prev, alert_webhook_enabled: e.target.checked }))}
                    style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                  />
                </div>

                {modalForm.alert_webhook_enabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="url"
                        className="text-input"
                        placeholder="https://hooks.slack.com/services/... or Discord Webhook"
                        value={modalForm.alert_webhook_url}
                        onChange={(e) => setModalForm(prev => ({ ...prev, alert_webhook_url: e.target.value }))}
                        style={{ flex: 1, fontSize: '12px' }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleTestWebhook}
                        disabled={testingWebhook}
                      >
                        {testingWebhook ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                        <span>Ping</span>
                      </button>
                    </div>

                    {webhookTestResult && (
                      <div style={{
                        fontSize: '11px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: webhookTestResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: webhookTestResult.success ? '#34d399' : '#f87171',
                        border: `1px solid ${webhookTestResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      }}>
                        {webhookTestResult.success ? '✓ Ping successful! Notification format verified.' : `✗ Error: ${webhookTestResult.message}`}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Email Alert Integration */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={15} style={{ color: '#fbbf24' }} />
                    Email Notification Digest
                  </label>
                  <input
                    type="checkbox"
                    checked={modalForm.alert_email_enabled}
                    onChange={(e) => setModalForm(prev => ({ ...prev, alert_email_enabled: e.target.checked }))}
                    style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                  />
                </div>

                {modalForm.alert_email_enabled && (
                  <input
                    type="text"
                    className="text-input"
                    placeholder="recruiter@agency.com, sourcer@agency.com"
                    value={modalForm.alert_email_recipients}
                    onChange={(e) => setModalForm(prev => ({ ...prev, alert_email_recipients: e.target.value }))}
                    style={{ width: '100%', fontSize: '12px' }}
                  />
                )}
              </div>

              {/* Modal Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Save Autopilot Settings
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
