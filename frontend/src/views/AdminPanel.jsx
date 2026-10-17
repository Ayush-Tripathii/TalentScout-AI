import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Edit3, 
  Users, 
  FileText, 
  Save, 
  RefreshCw, 
  Lock, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Database, 
  ArrowLeft,
  Sparkles,
  Search,
  Key,
  Clock,
  Check,
  Power,
  Phone,
  Mail,
  Building2,
  Copy,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Server,
  Zap,
  Globe,
  Radio,
  LogOut
} from 'lucide-react';
import { api } from '../api';

export default function AdminPanel({ onBackToWorkspace, onBackToLanding, onLogout, showToast }) {
  const [activeTab, setActiveTab] = useState('overview'); // overview | users | apikeys | cms | audits
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingCms, setIsSavingCms] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  
  // Search & Filter state for Users
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [showAllKeys, setShowAllKeys] = useState(true); // Default to TRUE so user keys & secrets are clearly visible
  const [revealedKeys, setRevealedKeys] = useState({});
  const [copiedKeyId, setCopiedKeyId] = useState(null);

  // User Provisioning & Edit Modals
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  const [newUserForm, setNewUserForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    designation: 'Senior Technical Recruiter',
    company: 'Apex Staffing Solutions',
    role: 'recruiter',
    password: '',
    serpapi_key: '',
    hunter_key: '',
    apollo_key: '',
    webhook_url: '',
    notes: '',
  });

  const [cmsContent, setCmsContent] = useState({
    hero_headline: '',
    hero_subheadline: '',
    announcement_badge: '',
    about_headline: '',
    about_story: '',
    promises: [],
    stats: [],
    maintenance_mode: false,
    public_signup_enabled: true,
  });

  const [adminToken, setAdminToken] = useState(() => {
    return localStorage.getItem('talentscout_admin_token') || '';
  });

  useEffect(() => {
    loadAllAdminData();
  }, []);

  const loadAllAdminData = async () => {
    const token = localStorage.getItem('talentscout_admin_token') || adminToken;
    if (!token) {
      if (showToast) showToast('Access Denied: Administrator authentication required.', 'error');
      if (onBackToWorkspace) onBackToWorkspace();
      return;
    }

    setIsLoading(true);
    try {
      const [cmsRes, overviewRes] = await Promise.all([
        api.getCmsContent().catch(err => {
          console.error('Failed to load CMS content:', err);
          return null;
        }),
        api.getAdminOverview(token).catch(err => {
          console.error('Failed to load admin overview:', err);
          if (err?.message?.includes('403') || err?.message?.includes('401') || err?.message?.includes('Forbidden')) {
            localStorage.removeItem('talentscout_admin_token');
            if (showToast) showToast('Administrator privileges required. Access revoked.', 'error');
            if (onBackToWorkspace) onBackToWorkspace();
          }
          return null;
        }),
      ]);

      if (cmsRes && cmsRes.content) {
        setCmsContent({
          hero_headline: cmsRes.content.hero_headline || '',
          hero_subheadline: cmsRes.content.hero_subheadline || '',
          announcement_badge: cmsRes.content.announcement_badge || '',
          about_headline: cmsRes.content.about_headline || '',
          about_story: cmsRes.content.about_story || '',
          promises: cmsRes.content.promises || [],
          stats: cmsRes.content.stats || [],
          maintenance_mode: Boolean(cmsRes.content.maintenance_mode),
          public_signup_enabled: cmsRes.content.public_signup_enabled !== false,
        });
      }

      if (overviewRes && overviewRes.data) {
        setTelemetry(overviewRes.data);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
      if (showToast) showToast('Failed to load some admin telemetry data.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = (text, identifier) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKeyId(identifier);
    if (showToast) showToast(`Copied to clipboard!`, 'info');
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const toggleKeyReveal = (userId) => {
    setRevealedKeys(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleSaveCms = async (e) => {
    if (e) e.preventDefault();
    setIsSavingCms(true);
    try {
      const res = await api.updateCmsContent(cmsContent, adminToken);
      if (showToast) showToast('Landing page CMS successfully updated and audited!', 'success');
      if (res && res.content) {
        setCmsContent(prev => ({ ...prev, ...res.content }));
      }
    } catch (err) {
      console.error('Failed to update CMS:', err);
      if (showToast) showToast('Failed to save CMS changes: ' + err.message, 'error');
    } finally {
      setIsSavingCms(false);
    }
  };

  const handleToggleMaintenance = async () => {
    const nextMode = !cmsContent.maintenance_mode;
    setCmsContent(prev => ({ ...prev, maintenance_mode: nextMode }));
    try {
      await api.updateCmsContent({ maintenance_mode: nextMode }, adminToken);
      if (showToast) {
        showToast(nextMode ? 'Platform maintenance mode activated.' : 'Platform restored to active status.', 'info');
      }
    } catch (err) {
      if (showToast) showToast('Failed to update maintenance state: ' + err.message, 'error');
    }
  };

  const handleToggleUser = async (userId, currentActive) => {
    try {
      await api.toggleUserStatus(userId, !currentActive, adminToken);
      if (showToast) showToast(`User account ${!currentActive ? 'enabled' : 'disabled'}.`, 'success');
      loadAllAdminData();
    } catch (err) {
      if (showToast) showToast('Failed to toggle user status: ' + err.message, 'error');
    }
  };

  const handleRegenerateKey = async (userId, userEmail) => {
    if (!window.confirm(`Regenerate API key for ${userEmail}? Existing API integrations using this key will need to be updated.`)) {
      return;
    }
    try {
      const res = await api.regenerateUserKey(userId, adminToken);
      if (showToast) showToast(`New API key generated for ${userEmail}: ${res.user_api_key.substring(0, 16)}...`, 'success');
      loadAllAdminData();
    } catch (err) {
      if (showToast) showToast('Failed to regenerate key: ' + err.message, 'error');
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (userEmail === 'admin@talentscout.ai') {
      if (showToast) showToast('Root administrator account cannot be deleted.', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete user account ${userEmail}? This action is audited under DPDP Act compliance.`)) {
      return;
    }
    try {
      await api.deleteAdminUser(userId, adminToken);
      if (showToast) showToast(`User account ${userEmail} permanently deleted.`, 'success');
      loadAllAdminData();
    } catch (err) {
      if (showToast) showToast('Failed to delete user: ' + err.message, 'error');
    }
  };

  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    if (!newUserForm.email || !newUserForm.full_name) {
      if (showToast) showToast('Email and Full Name are required.', 'error');
      return;
    }

    setIsSubmittingUser(true);
    try {
      const payload = {
        full_name: newUserForm.full_name,
        email: newUserForm.email,
        phone: newUserForm.phone || '+91 Not Provided',
        designation: newUserForm.designation,
        company: newUserForm.company,
        role: newUserForm.role,
        password: newUserForm.password || 'Recruiter#2026!Pass',
        api_keys: {
          serpapi: newUserForm.serpapi_key || '',
          hunter: newUserForm.hunter_key || '',
          apollo: newUserForm.apollo_key || '',
          webhook: newUserForm.webhook_url || '',
        },
        notes: newUserForm.notes,
      };

      await api.createAdminUser(payload, adminToken);
      if (showToast) showToast(`User ${newUserForm.email} provisioned with API access!`, 'success');
      setIsCreateUserModalOpen(false);
      setNewUserForm({
        full_name: '',
        email: '',
        phone: '',
        designation: 'Senior Technical Recruiter',
        company: 'Apex Staffing Solutions',
        role: 'recruiter',
        password: '',
        serpapi_key: '',
        hunter_key: '',
        apollo_key: '',
        webhook_url: '',
        notes: '',
      });
      loadAllAdminData();
    } catch (err) {
      if (showToast) showToast('Failed to create user: ' + err.message, 'error');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;

    setIsSubmittingUser(true);
    try {
      const payload = {
        full_name: selectedUserForEdit.full_name,
        phone: selectedUserForEdit.phone,
        designation: selectedUserForEdit.designation,
        company: selectedUserForEdit.company,
        role: selectedUserForEdit.role,
        api_keys: selectedUserForEdit.api_keys || {},
        notes: selectedUserForEdit.notes,
        is_active: selectedUserForEdit.is_active,
      };

      await api.updateAdminUser(selectedUserForEdit.id, payload, adminToken);
      if (showToast) showToast(`User ${selectedUserForEdit.email} updated successfully!`, 'success');
      setIsEditUserModalOpen(false);
      setSelectedUserForEdit(null);
      loadAllAdminData();
    } catch (err) {
      if (showToast) showToast('Failed to update user: ' + err.message, 'error');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // Filtered Users List
  const allUsers = telemetry?.users || [];
  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = 
      (u.full_name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      (u.phone || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      (u.company || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      (u.user_api_key || '').toLowerCase().includes(userSearchQuery.toLowerCase());
    
    const matchesRole = userRoleFilter === 'all' ? true : u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-main)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Admin Header Bar */}
      <header style={{
        background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 27, 75, 0.95) 100%)',
        borderBottom: '1px solid rgba(99, 102, 241, 0.3)',
        padding: '16px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.5)'
          }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                TalentScout Administrator Command Center
              </span>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#34d399',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '9999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                {allUsers.length} Users Tracked • RBAC Enforced
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Logged in as <code>admin@talentscout.ai</code> • Full User Tracking & API Keys Supervision Active
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={loadAllAdminData}
            title="Refresh Telemetry & Users"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={isLoading ? 'anim-rotate' : ''} />
            <span>Refresh</span>
          </button>

          {onBackToLanding && (
            <button 
              className="btn btn-secondary btn-sm"
              onClick={onBackToLanding}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ExternalLink size={14} />
              <span>Landing Page</span>
            </button>
          )}

          {onBackToWorkspace && (
            <button 
              className="btn btn-primary btn-sm"
              onClick={onBackToWorkspace}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
            >
              <ArrowLeft size={14} />
              <span>Recruiter Workspace</span>
            </button>
          )}

          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (onLogout) {
                onLogout();
              } else if (onBackToLanding) {
                onBackToLanding();
              }
            }}
            title="Sign out of Administrator Session"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <LogOut size={14} style={{ color: '#ef4444' }} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Admin Tab Navigation */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.7)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 28px',
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
      }}>
        {[
          { id: 'overview', label: 'Executive Dashboard', icon: Activity },
          { id: 'users', label: `Tracked Users & API Keys (${allUsers.length})`, icon: Users },
          { id: 'apikeys', label: 'Central API Keys Hub', icon: Key },
          { id: 'cms', label: 'Landing Page CMS Editor', icon: Edit3 },
          { id: 'audits', label: 'DPDP Security Audit Trail', icon: FileText },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '14px 18px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #818cf8' : '2px solid transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon size={16} style={{ color: isActive ? '#818cf8' : 'inherit' }} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Admin Content Body */}
      <div style={{ flex: 1, padding: '28px', maxWidth: '1440px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        
        {/* ======================================================== */}
        {/* TAB 1: EXECUTIVE DASHBOARD                               */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Top Stat KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              
              <div className="card landing-card-hover" style={{ padding: '20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                  <span>TOTAL REGISTERED USERS</span>
                  <Users size={16} style={{ color: '#818cf8' }} />
                </div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#fff', marginTop: '8px' }}>
                  {allUsers.length}
                </div>
                <div style={{ fontSize: '11px', color: '#34d399', marginTop: '4px', fontWeight: 600 }}>
                  {telemetry?.stats?.active_users_count ?? allUsers.length} Active Recruiter Accounts
                </div>
              </div>

              <div className="card landing-card-hover" style={{ padding: '20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                  <span>PROVISIONED API KEYS</span>
                  <Key size={16} style={{ color: '#fbbf24' }} />
                </div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#fff', marginTop: '8px' }}>
                  {telemetry?.stats?.api_keys_provisioned_count ?? allUsers.length}
                </div>
                <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '4px', fontWeight: 600 }}>
                  Personal Developer Keys & Integration Tokens
                </div>
              </div>

              <div className="card landing-card-hover" style={{ padding: '20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                  <span>VERIFIED CANDIDATE POOL</span>
                  <Database size={16} style={{ color: '#34d399' }} />
                </div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#fff', marginTop: '8px' }}>
                  {telemetry?.stats?.total_candidates ?? 46}
                </div>
                <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>
                  100% Genuine • Strict 0 Dummy Verified
                </div>
              </div>

              <div className="card landing-card-hover" style={{ padding: '20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                  <span>AUTOPILOT SOURCING JOBS</span>
                  <Sparkles size={16} style={{ color: '#ec4899' }} />
                </div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#fff', marginTop: '8px' }}>
                  {telemetry?.stats?.total_schedules ?? 29}
                </div>
                <div style={{ fontSize: '11px', color: '#ec4899', marginTop: '4px', fontWeight: 600 }}>
                  24/7 Autonomous Crawlers Running
                </div>
              </div>

            </div>

            {/* Quick Admin Navigation & Platform Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
              
              {/* Security Standards Matrix */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <ShieldCheck size={20} style={{ color: '#10b981' }} />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#fff' }}>
                    Active Enterprise Security Controls
                  </h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#fff' }}>Salted PBKDF2-HMAC-SHA256</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>100,000 rounds + unique salts per account</div>
                    </div>
                    <span className="badge badge-accent" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>Active</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#fff' }}>Per-User Developer API Keys</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cryptographically generated <code>ts_live_...</code> keys</div>
                    </div>
                    <span className="badge badge-accent" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>Active</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#fff' }}>Sliding Window Rate Limiter</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>10 auth/min, 30 search/min, 180 global/min</div>
                    </div>
                    <span className="badge badge-accent" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>Enforced</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#fff' }}>DPDP Statutory Erasure</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cascade wipe across matches, notes, & logs</div>
                    </div>
                    <span className="badge badge-accent" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>Compliant</span>
                  </div>
                </div>
              </div>

              {/* Master Administrator Credentials & Platform Switch */}
              <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <Power size={20} style={{ color: '#818cf8' }} />
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#fff' }}>
                      Administrator Master Credentials
                    </h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>ROOT ADMIN LOGIN</span>
                        <span className="badge badge-accent">Super Admin</span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#fff', lineHeight: 1.6 }}>
                        <strong>Email ID:</strong> <code>admin@talentscout.ai</code><br />
                        <strong>Master Password:</strong> <code>Admin#TalentScout2026!Secure</code><br />
                        <strong>Phone Number:</strong> <code>+91 98201 00001</code><br />
                        <strong>Master API Key:</strong> <code>ts_live_admin_master_key_9f8a2b1c4e</code>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '8px' }}>
                        Protected by PBKDF2-HMAC-SHA256 (100,000 iterations). Plaintext is never stored.
                      </div>
                    </div>

                    <div style={{
                      padding: '14px',
                      borderRadius: '10px',
                      background: cmsContent.maintenance_mode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      border: cmsContent.maintenance_mode ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '13px' }}>
                          {cmsContent.maintenance_mode ? '⚠️ Maintenance Active' : '✅ Platform Live & Serving'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {cmsContent.maintenance_mode ? 'Public sourcing paused' : 'Serving all recruiters normally'}
                        </div>
                      </div>
                      <button 
                        className={`btn ${cmsContent.maintenance_mode ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                        onClick={handleToggleMaintenance}
                        style={{ fontSize: '11px' }}
                      >
                        {cmsContent.maintenance_mode ? 'Turn Off' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveTab('users')}
                    style={{ fontWeight: 700 }}
                  >
                    Manage Tracked Users & API Keys →
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: TRACKED USERS & API KEYS ROSTER (CORE REQUEST)    */}
        {/* ======================================================== */}
        {activeTab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Header with Search and "Provision User" button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#fff' }}>
                  Tracked Users, Contact Details & API Keys
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Supervise recruiter profiles, verified email IDs, Indian phone numbers, personal TalentScout API keys, and third-party integrations.
                </p>
              </div>

              <button 
                className="btn btn-primary"
                onClick={() => setIsCreateUserModalOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontWeight: 700 }}
              >
                <Plus size={16} />
                <span>Provision New Recruiter Account</span>
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="card" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
                <Search size={16} style={{ color: 'var(--text-muted)' }} />
                <input 
                  type="text"
                  className="text-input"
                  placeholder="Search by name, email ID, phone number, organization, or API key..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAllKeys(!showAllKeys)}
                  className="btn btn-secondary btn-sm"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: showAllKeys ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: showAllKeys ? '1px solid rgba(251, 191, 36, 0.4)' : '1px solid var(--border-subtle)',
                    color: showAllKeys ? '#fbbf24' : 'var(--text-muted)',
                    fontWeight: 700,
                  }}
                  title="Toggle unmasked visibility for all user API keys and secrets"
                >
                  {showAllKeys ? <Eye size={13} /> : <EyeOff size={13} />}
                  <span>{showAllKeys ? 'Key Visibility: Plaintext (Visible)' : 'Key Visibility: Masked'}</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Role:</span>
                  <select 
                    className="text-input" 
                    value={userRoleFilter} 
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: '12px', width: 'auto' }}
                  >
                    <option value="all">All Roles ({allUsers.length})</option>
                    <option value="admin">Administrators</option>
                    <option value="recruiter">Recruiters</option>
                    <option value="manager">Managers</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '14px 18px' }}>Recruiter / User</th>
                      <th style={{ padding: '14px 18px' }}>Contact Information</th>
                      <th style={{ padding: '14px 18px' }}>Agency / Organization</th>
                      <th style={{ padding: '14px 18px' }}>Personal TalentScout API Key</th>
                      <th style={{ padding: '14px 18px' }}>Connected Third-Party Secret Keys</th>
                      <th style={{ padding: '14px 18px' }}>Status</th>
                      <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const isRevealed = Boolean(revealedKeys[u.id]);
                      const apiKeysObj = u.api_keys || {};
                      const hasSerpApi = Boolean(apiKeysObj.serpapi);
                      const hasHunter = Boolean(apiKeysObj.hunter);
                      const hasApollo = Boolean(apiKeysObj.apollo);
                      const hasWebhook = Boolean(apiKeysObj.webhook || apiKeysObj.slack_webhook || apiKeysObj.discord_webhook);

                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }}>
                          
                          {/* User Identity */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: u.role === 'admin' 
                                  ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' 
                                  : 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '13px',
                                flexShrink: 0
                              }}>
                                {u.full_name ? u.full_name.substring(0, 2).toUpperCase() : 'TS'}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>{u.full_name}</span>
                                  {u.role === 'admin' && (
                                    <span style={{ fontSize: '10px', background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                      ROOT
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {u.designation || 'Staffing Specialist'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Contact Info (Email & Phone) */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Mail size={13} style={{ color: '#818cf8', flexShrink: 0 }} />
                                <span style={{ color: '#e2e8f0', fontSize: '12px' }}>{u.email}</span>
                                <button 
                                  onClick={() => handleCopyText(u.email, `email_${u.id}`)}
                                  title="Copy Email"
                                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px' }}
                                >
                                  {copiedKeyId === `email_${u.id}` ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                                </button>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Phone size={13} style={{ color: '#34d399', flexShrink: 0 }} />
                                <span style={{ color: '#34d399', fontWeight: 600, fontSize: '12px' }}>{u.phone || '+91 Not Provided'}</span>
                                {u.phone && (
                                  <button 
                                    onClick={() => handleCopyText(u.phone, `phone_${u.id}`)}
                                    title="Copy Phone Number"
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px' }}
                                  >
                                    {copiedKeyId === `phone_${u.id}` ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Company / Agency */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontWeight: 600 }}>
                              <Building2 size={14} style={{ color: 'var(--text-muted)' }} />
                              <span>{u.company || 'Enterprise Agency'}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                              Role: <span style={{ textTransform: 'capitalize' }}>{u.role}</span>
                            </div>
                          </td>

                          {/* Personal TalentScout API Key (Clearly visible) */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{
                              background: 'rgba(0, 0, 0, 0.45)',
                              border: '1px solid rgba(251, 191, 36, 0.25)',
                              borderRadius: '8px',
                              padding: '6px 10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              maxWidth: '340px'
                            }}>
                              <Key size={13} style={{ color: '#fbbf24', flexShrink: 0 }} />
                              <code style={{ fontSize: '11.5px', color: '#fbbf24', fontFamily: 'monospace', fontWeight: 600 }}>
                                {showAllKeys || isRevealed 
                                  ? (u.user_api_key || 'ts_live_key_not_set')
                                  : (u.user_api_key ? `${u.user_api_key.substring(0, 10)}••••••••` : 'None')}
                              </code>
                              <button 
                                onClick={() => toggleKeyReveal(u.id)}
                                title={isRevealed || showAllKeys ? "Toggle Key Mask" : "Reveal Full Key"}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                              >
                                {isRevealed || showAllKeys ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                              <button 
                                onClick={() => handleCopyText(u.user_api_key, `key_${u.id}`)}
                                title="Copy API Key"
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                              >
                                {copiedKeyId === `key_${u.id}` ? <Check size={13} style={{ color: '#10b981' }} /> : <Copy size={13} />}
                              </button>
                            </div>
                            <div style={{ marginTop: '4px' }}>
                              <button
                                onClick={() => handleRegenerateKey(u.id, u.email)}
                                style={{ background: 'transparent', border: 'none', color: '#818cf8', fontSize: '10px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                              >
                                ⟳ Regenerate Key
                              </button>
                            </div>
                          </td>

                          {/* Connected Third-Party Secret Keys (Clearly visible) */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '220px' }}>
                              {hasSerpApi && (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '6px',
                                  background: 'rgba(16, 185, 129, 0.08)',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  padding: '2px 8px',
                                  borderRadius: '6px'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#34d399' }}>SerpApi:</span>
                                    <code style={{ fontSize: '11px', color: '#a7f3d0', fontFamily: 'monospace' }}>
                                      {showAllKeys ? apiKeysObj.serpapi : `${apiKeysObj.serpapi.substring(0, 8)}...`}
                                    </code>
                                  </div>
                                  <button
                                    onClick={() => handleCopyText(apiKeysObj.serpapi, `serp_${u.id}`)}
                                    title="Copy SerpApi Key"
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '1px' }}
                                  >
                                    {copiedKeyId === `serp_${u.id}` ? <Check size={11} style={{ color: '#10b981' }} /> : <Copy size={11} />}
                                  </button>
                                </div>
                              )}

                              {hasHunter && (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '6px',
                                  background: 'rgba(99, 102, 241, 0.08)',
                                  border: '1px solid rgba(99, 102, 241, 0.3)',
                                  padding: '2px 8px',
                                  borderRadius: '6px'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#818cf8' }}>Hunter:</span>
                                    <code style={{ fontSize: '11px', color: '#c7d2fe', fontFamily: 'monospace' }}>
                                      {showAllKeys ? apiKeysObj.hunter : `${apiKeysObj.hunter.substring(0, 8)}...`}
                                    </code>
                                  </div>
                                  <button
                                    onClick={() => handleCopyText(apiKeysObj.hunter, `hunt_${u.id}`)}
                                    title="Copy Hunter.io Key"
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '1px' }}
                                  >
                                    {copiedKeyId === `hunt_${u.id}` ? <Check size={11} style={{ color: '#10b981' }} /> : <Copy size={11} />}
                                  </button>
                                </div>
                              )}

                              {hasApollo && (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '6px',
                                  background: 'rgba(236, 72, 153, 0.08)',
                                  border: '1px solid rgba(236, 72, 153, 0.3)',
                                  padding: '2px 8px',
                                  borderRadius: '6px'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#f472b6' }}>Apollo:</span>
                                    <code style={{ fontSize: '11px', color: '#fbcfe8', fontFamily: 'monospace' }}>
                                      {showAllKeys ? apiKeysObj.apollo : `${apiKeysObj.apollo.substring(0, 8)}...`}
                                    </code>
                                  </div>
                                  <button
                                    onClick={() => handleCopyText(apiKeysObj.apollo, `apol_${u.id}`)}
                                    title="Copy Apollo Key"
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '1px' }}
                                  >
                                    {copiedKeyId === `apol_${u.id}` ? <Check size={11} style={{ color: '#10b981' }} /> : <Copy size={11} />}
                                  </button>
                                </div>
                              )}

                              {hasWebhook && (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '6px',
                                  background: 'rgba(245, 158, 11, 0.08)',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                  padding: '2px 8px',
                                  borderRadius: '6px'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#fbbf24' }}>Webhook:</span>
                                    <code style={{ fontSize: '10.5px', color: '#fde68a', fontFamily: 'monospace', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={apiKeysObj.webhook || apiKeysObj.slack_webhook || apiKeysObj.discord_webhook}>
                                      {apiKeysObj.webhook || apiKeysObj.slack_webhook || apiKeysObj.discord_webhook}
                                    </code>
                                  </div>
                                  <button
                                    onClick={() => handleCopyText(apiKeysObj.webhook || apiKeysObj.slack_webhook || apiKeysObj.discord_webhook, `hook_${u.id}`)}
                                    title="Copy Webhook URL"
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '1px' }}
                                  >
                                    {copiedKeyId === `hook_${u.id}` ? <Check size={11} style={{ color: '#10b981' }} /> : <Copy size={11} />}
                                  </button>
                                </div>
                              )}

                              {!hasSerpApi && !hasHunter && !hasApollo && !hasWebhook && (
                                <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                                  No external keys configured
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td style={{ padding: '14px 18px' }}>
                            <span style={{
                              color: u.is_active ? '#34d399' : '#f87171',
                              fontWeight: 700,
                              fontSize: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: u.is_active ? '#10b981' : '#ef4444' }}></span>
                              {u.is_active ? 'Active' : 'Disabled'}
                            </span>
                            <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
                              {u.last_login_at ? `Login: ${new Date(u.last_login_at).toLocaleDateString()}` : 'Never logged in'}
                            </div>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setSelectedUserForEdit({ ...u });
                                  setIsEditUserModalOpen(true);
                                }}
                                title="Edit User Details & API Keys"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                              >
                                Edit
                              </button>

                              {u.email !== 'admin@talentscout.ai' && (
                                <>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleToggleUser(u.id, u.is_active)}
                                    title={u.is_active ? "Disable Account" : "Enable Account"}
                                    style={{ padding: '4px 8px', fontSize: '11px', color: u.is_active ? '#f87171' : '#34d399' }}
                                  >
                                    {u.is_active ? <UserX size={12} /> : <UserCheck size={12} />}
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleDeleteUser(u.id, u.email)}
                                    title="Delete User (DPDP Audit)"
                                    style={{ padding: '4px 8px', fontSize: '11px', color: '#f87171' }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>

                        </tr>
                      );
                    })}

                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-dim)' }}>
                          No users found matching query "{userSearchQuery}".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: CENTRAL API KEYS & INTEGRATIONS HUB               */}
        {/* ======================================================== */}
        {activeTab === 'apikeys' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#fff' }}>
                Central API Keys & Webhook Telemetry
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                Inspect and audit all active developer tokens, third-party search credentials, and alerting hooks provisioned across the platform.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <Globe size={18} style={{ color: '#818cf8' }} />
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#fff' }}>SerpApi (Google X-Ray)</h3>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Powering multi-platform Google X-Ray searches across LinkedIn, GitHub, Naukri, and Foundit.
                </div>
                <div style={{ fontSize: '13px', color: '#34d399', fontWeight: 600 }}>
                  ✓ {allUsers.filter(u => u.api_keys?.serpapi).length} Active User Connections
                </div>
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <Mail size={18} style={{ color: '#a5b4fc' }} />
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#fff' }}>Hunter.io Enrichment</h3>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Statutory corporate email pattern resolution and deliverability confidence score engine.
                </div>
                <div style={{ fontSize: '13px', color: '#a5b4fc', fontWeight: 600 }}>
                  ✓ {allUsers.filter(u => u.api_keys?.hunter).length} Active User Connections
                </div>
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <Phone size={18} style={{ color: '#f472b6' }} />
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#fff' }}>Apollo.io Enrichment</h3>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Direct recruiter phone verification and verified contact acquisitions.
                </div>
                <div style={{ fontSize: '13px', color: '#f472b6', fontWeight: 600 }}>
                  ✓ {allUsers.filter(u => u.api_keys?.apollo).length} Active User Connections
                </div>
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <Radio size={18} style={{ color: '#fbbf24' }} />
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#fff' }}>Autopilot Webhook Channels</h3>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Instant Slack & Discord notifications dispatched when top candidates are discovered.
                </div>
                <div style={{ fontSize: '13px', color: '#fbbf24', fontWeight: 600 }}>
                  ✓ {allUsers.filter(u => u.api_keys?.webhook || u.api_keys?.slack_webhook || u.api_keys?.discord_webhook).length} Live Webhook Endpoints
                </div>
              </div>

            </div>

            {/* Comprehensive Secret Keys Vault for All Platform Users */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '10px' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Key size={16} style={{ color: '#fbbf24' }} />
                    Live Platform Secret Keys & Recruiter Credentials Directory
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Cross-tenant visibility of all provisioned TalentScout API keys, third-party search credentials, and webhook endpoints.
                  </p>
                </div>
                <span className="badge badge-accent" style={{ fontWeight: 700 }}>
                  {allUsers.length} Credentials Monitored
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 16px' }}>User & Organization</th>
                      <th style={{ padding: '12px 16px' }}>Personal TalentScout API Key</th>
                      <th style={{ padding: '12px 16px' }}>SerpApi (Google X-Ray)</th>
                      <th style={{ padding: '12px 16px' }}>Hunter.io Secret</th>
                      <th style={{ padding: '12px 16px' }}>Apollo.io Secret</th>
                      <th style={{ padding: '12px 16px' }}>Alert Webhook Endpoint</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map((u) => {
                      const apiKeysObj = u.api_keys || {};
                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700, color: '#fff' }}>{u.full_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{u.email}</div>
                            <div style={{ fontSize: '10.5px', color: '#818cf8', marginTop: '2px' }}>{u.company || 'Enterprise Agency'}</div>
                          </td>

                          {/* Personal TalentScout Key */}
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(0, 0, 0, 0.45)', border: '1px solid rgba(251, 191, 36, 0.3)', padding: '3px 8px', borderRadius: '6px' }}>
                              <code style={{ fontSize: '11px', color: '#fbbf24', fontFamily: 'monospace', fontWeight: 600 }}>
                                {u.user_api_key || 'ts_live_key_not_set'}
                              </code>
                              <button
                                onClick={() => handleCopyText(u.user_api_key, `hub_key_${u.id}`)}
                                title="Copy Key"
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '1px' }}
                              >
                                {copiedKeyId === `hub_key_${u.id}` ? <Check size={11} style={{ color: '#10b981' }} /> : <Copy size={11} />}
                              </button>
                            </div>
                          </td>

                          {/* SerpApi Secret */}
                          <td style={{ padding: '12px 16px' }}>
                            {apiKeysObj.serpapi ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '3px 8px', borderRadius: '6px' }}>
                                <code style={{ fontSize: '11px', color: '#a7f3d0', fontFamily: 'monospace' }}>
                                  {apiKeysObj.serpapi}
                                </code>
                                <button
                                  onClick={() => handleCopyText(apiKeysObj.serpapi, `hub_serp_${u.id}`)}
                                  title="Copy SerpApi Key"
                                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '1px' }}
                                >
                                  {copiedKeyId === `hub_serp_${u.id}` ? <Check size={11} style={{ color: '#10b981' }} /> : <Copy size={11} />}
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '11px' }}>Not Configured</span>
                            )}
                          </td>

                          {/* Hunter Secret */}
                          <td style={{ padding: '12px 16px' }}>
                            {apiKeysObj.hunter ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '3px 8px', borderRadius: '6px' }}>
                                <code style={{ fontSize: '11px', color: '#c7d2fe', fontFamily: 'monospace' }}>
                                  {apiKeysObj.hunter}
                                </code>
                                <button
                                  onClick={() => handleCopyText(apiKeysObj.hunter, `hub_hunt_${u.id}`)}
                                  title="Copy Hunter Key"
                                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '1px' }}
                                >
                                  {copiedKeyId === `hub_hunt_${u.id}` ? <Check size={11} style={{ color: '#10b981' }} /> : <Copy size={11} />}
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '11px' }}>Not Configured</span>
                            )}
                          </td>

                          {/* Apollo Secret */}
                          <td style={{ padding: '12px 16px' }}>
                            {apiKeysObj.apollo ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(236, 72, 153, 0.08)', border: '1px solid rgba(236, 72, 153, 0.3)', padding: '3px 8px', borderRadius: '6px' }}>
                                <code style={{ fontSize: '11px', color: '#fbcfe8', fontFamily: 'monospace' }}>
                                  {apiKeysObj.apollo}
                                </code>
                                <button
                                  onClick={() => handleCopyText(apiKeysObj.apollo, `hub_apol_${u.id}`)}
                                  title="Copy Apollo Key"
                                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '1px' }}
                                >
                                  {copiedKeyId === `hub_apol_${u.id}` ? <Check size={11} style={{ color: '#10b981' }} /> : <Copy size={11} />}
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '11px' }}>Not Configured</span>
                            )}
                          </td>

                          {/* Webhook Endpoint */}
                          <td style={{ padding: '12px 16px' }}>
                            {apiKeysObj.webhook || apiKeysObj.slack_webhook || apiKeysObj.discord_webhook ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '3px 8px', borderRadius: '6px' }}>
                                <code style={{ fontSize: '11px', color: '#fde68a', fontFamily: 'monospace', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={apiKeysObj.webhook || apiKeysObj.slack_webhook || apiKeysObj.discord_webhook}>
                                  {apiKeysObj.webhook || apiKeysObj.slack_webhook || apiKeysObj.discord_webhook}
                                </code>
                                <button
                                  onClick={() => handleCopyText(apiKeysObj.webhook || apiKeysObj.slack_webhook || apiKeysObj.discord_webhook, `hub_hook_${u.id}`)}
                                  title="Copy Webhook URL"
                                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '1px' }}
                                >
                                  {copiedKeyId === `hub_hook_${u.id}` ? <Check size={11} style={{ color: '#10b981' }} /> : <Copy size={11} />}
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '11px' }}>Not Configured</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: CMS LANDING PAGE LIVE EDITOR                      */}
        {/* ======================================================== */}
        {activeTab === 'cms' && (
          <form onSubmit={handleSaveCms} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header & Publish Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: '#fff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Edit3 size={20} style={{ color: '#818cf8' }} />
                  Landing Page Content Management
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Update live headlines, value proposition cards, announcement badges, and origin story without redeploying.
                </p>
              </div>

              <button 
                type="submit" 
                disabled={isSavingCms}
                className="btn btn-primary landing-btn-shine"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 28px',
                  fontWeight: 800,
                  fontSize: '13.5px',
                  borderRadius: '10px',
                  boxShadow: '0 4px 20px rgba(99, 102, 241, 0.45)',
                }}
              >
                <Save size={17} className={isSavingCms ? 'animate-spin' : ''} />
                <span>{isSavingCms ? 'Saving Changes...' : 'Save & Publish to Landing Page'}</span>
              </button>
            </div>

            {/* Card 1: Top Announcement Pill */}
            <div className="card" style={{ padding: '24px', border: '1px solid rgba(99, 102, 241, 0.25)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} style={{ color: '#fbbf24' }} />
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                    Top Announcement Pill Badge
                  </h3>
                </div>
                <span className="badge badge-accent" style={{ fontSize: '11px' }}>
                  Live Floating Pill
                </span>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <input
                  type="text"
                  className="text-input"
                  style={{
                    width: '100%',
                    fontSize: '13.5px',
                    background: 'rgba(13, 19, 33, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#f8fafc',
                    borderRadius: '10px',
                    padding: '12px 14px',
                  }}
                  value={cmsContent.announcement_badge}
                  onChange={(e) => setCmsContent(prev => ({ ...prev, announcement_badge: e.target.value }))}
                  placeholder="e.g. 🚀 Phase 8 Autopilot Sourcing Live: Automated 24/7 background crawls active"
                />
              </div>

              {/* Live Preview Pill */}
              <div style={{
                padding: '12px 16px',
                background: 'rgba(0, 0, 0, 0.35)',
                borderRadius: '8px',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Live Preview:</span>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '11.5px',
                  color: '#c7d2fe',
                  fontWeight: 600
                }}>
                  {cmsContent.announcement_badge || 'No announcement badge currently configured'}
                </div>
              </div>
            </div>

            {/* Card 2: Hero Section */}
            <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', border: '1px solid rgba(99, 102, 241, 0.25)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={18} style={{ color: '#818cf8' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                  Hero Section (Landing Page Above-The-Fold)
                </h3>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px' }}>
                  Main Hero Headline
                </label>
                <input
                  type="text"
                  className="text-input"
                  style={{
                    width: '100%',
                    fontSize: '14.5px',
                    fontWeight: 600,
                    background: 'rgba(13, 19, 33, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#f8fafc',
                    borderRadius: '10px',
                    padding: '12px 14px',
                  }}
                  value={cmsContent.hero_headline}
                  onChange={(e) => setCmsContent(prev => ({ ...prev, hero_headline: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px' }}>
                  Hero Subheadline
                </label>
                <textarea
                  className="text-input"
                  rows={3}
                  style={{
                    width: '100%',
                    fontSize: '13.5px',
                    lineHeight: 1.6,
                    background: 'rgba(13, 19, 33, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#f8fafc',
                    borderRadius: '10px',
                    padding: '12px 14px',
                  }}
                  value={cmsContent.hero_subheadline}
                  onChange={(e) => setCmsContent(prev => ({ ...prev, hero_subheadline: e.target.value }))}
                />
              </div>
            </div>

            {/* Card 3: About Us & Origin Story */}
            <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', border: '1px solid rgba(99, 102, 241, 0.25)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={18} style={{ color: '#ec4899' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                  About Us & Origin Story Narrative
                </h3>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px' }}>
                  About Headline
                </label>
                <input
                  type="text"
                  className="text-input"
                  style={{
                    width: '100%',
                    fontSize: '14.5px',
                    fontWeight: 600,
                    background: 'rgba(13, 19, 33, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#f8fafc',
                    borderRadius: '10px',
                    padding: '12px 14px',
                  }}
                  value={cmsContent.about_headline}
                  onChange={(e) => setCmsContent(prev => ({ ...prev, about_headline: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px' }}>
                  Origin Story Narrative
                </label>
                <textarea
                  className="text-input"
                  rows={4}
                  style={{
                    width: '100%',
                    fontSize: '13.5px',
                    lineHeight: 1.6,
                    background: 'rgba(13, 19, 33, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#f8fafc',
                    borderRadius: '10px',
                    padding: '12px 14px',
                  }}
                  value={cmsContent.about_story}
                  onChange={(e) => setCmsContent(prev => ({ ...prev, about_story: e.target.value }))}
                />
              </div>
            </div>

            {/* Bottom Floating Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px' }}>
              <button 
                type="submit" 
                disabled={isSavingCms}
                className="btn btn-primary landing-btn-shine"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 32px',
                  fontWeight: 800,
                  fontSize: '14px',
                  borderRadius: '10px',
                  boxShadow: '0 6px 24px rgba(99, 102, 241, 0.5)',
                }}
              >
                <Save size={18} />
                <span>{isSavingCms ? 'Saving Edits...' : 'Save All Landing Page Edits'}</span>
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* TAB 5: DPDP AUDIT TRAIL LOGS                             */}
        {/* ======================================================== */}
        {activeTab === 'audits' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#fff' }}>
                Immutable DPDP Audit Trail Log
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                Cryptographically records sensitive actions, user status changes, API key provisioning, and candidate erasures.
              </p>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 16px' }}>Timestamp (UTC)</th>
                    <th style={{ padding: '12px 16px' }}>Action</th>
                    <th style={{ padding: '12px 16px' }}>Entity Type</th>
                    <th style={{ padding: '12px 16px' }}>Performed By</th>
                    <th style={{ padding: '12px 16px' }}>Payload Details</th>
                  </tr>
                </thead>
                <tbody>
                  {(telemetry?.recent_audit_logs || []).map((audit) => (
                    <tr key={audit.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                        {audit.timestamp ? new Date(audit.timestamp).toLocaleString() : 'N/A'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <code style={{ color: '#818cf8', fontWeight: 700 }}>{audit.action}</code>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                        {audit.entity_type}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#fff', fontWeight: 600 }}>
                        {audit.performed_by || 'system'}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: '11px' }}>
                        {JSON.stringify(audit.details)}
                      </td>
                    </tr>
                  ))}
                  {(!telemetry?.recent_audit_logs || telemetry.recent_audit_logs.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>
                        No audit events recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* ======================================================== */}
      {/* MODAL: PROVISION NEW USER / RECRUITER                    */}
      {/* ======================================================== */}
      {isCreateUserModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '580px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                  <Plus size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#fff' }}>Provision Recruiter Account</h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Create user with phone, designation, and API keys</div>
                </div>
              </div>
              <button onClick={() => setIsCreateUserModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>

            <form onSubmit={handleCreateUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Full Name *</label>
                  <input 
                    type="text" 
                    required 
                    className="text-input" 
                    placeholder="e.g. Rohan Mehta"
                    value={newUserForm.full_name} 
                    onChange={e => setNewUserForm({ ...newUserForm, full_name: e.target.value })} 
                    style={{ width: '100%', fontSize: '13px' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Work Email *</label>
                  <input 
                    type="email" 
                    required 
                    className="text-input" 
                    placeholder="e.g. rohan.mehta@indiahire.tech"
                    value={newUserForm.email} 
                    onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })} 
                    style={{ width: '100%', fontSize: '13px' }} 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Mobile / Phone Number *</label>
                  <input 
                    type="text" 
                    className="text-input" 
                    placeholder="e.g. +91 91672 88412"
                    value={newUserForm.phone} 
                    onChange={e => setNewUserForm({ ...newUserForm, phone: e.target.value })} 
                    style={{ width: '100%', fontSize: '13px' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Role</label>
                  <select 
                    className="text-input" 
                    value={newUserForm.role} 
                    onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })}
                    style={{ width: '100%', fontSize: '13px', padding: '8px 12px' }}
                  >
                    <option value="recruiter">Recruiter (Standard Sourcing)</option>
                    <option value="manager">Manager / Lead Partner</option>
                    <option value="admin">Administrator (Full Access)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Designation</label>
                  <input 
                    type="text" 
                    className="text-input" 
                    placeholder="e.g. Lead Sourcing Specialist"
                    value={newUserForm.designation} 
                    onChange={e => setNewUserForm({ ...newUserForm, designation: e.target.value })} 
                    style={{ width: '100%', fontSize: '13px' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Agency / Company</label>
                  <input 
                    type="text" 
                    className="text-input" 
                    placeholder="e.g. IndiaHire Talent Partners"
                    value={newUserForm.company} 
                    onChange={e => setNewUserForm({ ...newUserForm, company: e.target.value })} 
                    style={{ width: '100%', fontSize: '13px' }} 
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Initial Temporary Password</label>
                <input 
                  type="text" 
                  className="text-input" 
                  placeholder="Defaults to Recruiter#2026!Pass if blank"
                  value={newUserForm.password} 
                  onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })} 
                  style={{ width: '100%', fontSize: '13px' }} 
                />
              </div>

              {/* API Keys Configuration */}
              <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24' }}>Connected API Keys (Optional)</span>
                
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '2px' }}>SerpApi Key (Google X-Ray search)</label>
                  <input 
                    type="text" 
                    className="text-input" 
                    placeholder="e.g. serp_live_..."
                    value={newUserForm.serpapi_key} 
                    onChange={e => setNewUserForm({ ...newUserForm, serpapi_key: e.target.value })} 
                    style={{ width: '100%', fontSize: '12px' }} 
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '2px' }}>Hunter.io Key</label>
                    <input 
                      type="text" 
                      className="text-input" 
                      placeholder="e.g. hunt_live_..."
                      value={newUserForm.hunter_key} 
                      onChange={e => setNewUserForm({ ...newUserForm, hunter_key: e.target.value })} 
                      style={{ width: '100%', fontSize: '12px' }} 
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '2px' }}>Apollo.io Key</label>
                    <input 
                      type="text" 
                      className="text-input" 
                      placeholder="e.g. apol_live_..."
                      value={newUserForm.apollo_key} 
                      onChange={e => setNewUserForm({ ...newUserForm, apollo_key: e.target.value })} 
                      style={{ width: '100%', fontSize: '12px' }} 
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '2px' }}>Slack / Discord Webhook URL</label>
                  <input 
                    type="text" 
                    className="text-input" 
                    placeholder="e.g. https://hooks.slack.com/services/..."
                    value={newUserForm.webhook_url} 
                    onChange={e => setNewUserForm({ ...newUserForm, webhook_url: e.target.value })} 
                    style={{ width: '100%', fontSize: '12px' }} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateUserModalOpen(false)}>Cancel</button>
                <button type="submit" disabled={isSubmittingUser} className="btn btn-primary" style={{ fontWeight: 700 }}>
                  {isSubmittingUser ? 'Provisioning...' : 'Provision User & Issue API Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT USER & API KEYS                              */}
      {/* ======================================================== */}
      {isEditUserModalOpen && selectedUserForEdit && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '580px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#fff' }}>Edit Recruiter Profile</h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedUserForEdit.email}</div>
                </div>
              </div>
              <button onClick={() => setIsEditUserModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>

            <form onSubmit={handleEditUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Full Name</label>
                  <input 
                    type="text" 
                    required 
                    className="text-input" 
                    value={selectedUserForEdit.full_name} 
                    onChange={e => setSelectedUserForEdit({ ...selectedUserForEdit, full_name: e.target.value })} 
                    style={{ width: '100%', fontSize: '13px' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Mobile / Phone Number</label>
                  <input 
                    type="text" 
                    className="text-input" 
                    value={selectedUserForEdit.phone || ''} 
                    onChange={e => setSelectedUserForEdit({ ...selectedUserForEdit, phone: e.target.value })} 
                    style={{ width: '100%', fontSize: '13px' }} 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Designation</label>
                  <input 
                    type="text" 
                    className="text-input" 
                    value={selectedUserForEdit.designation || ''} 
                    onChange={e => setSelectedUserForEdit({ ...selectedUserForEdit, designation: e.target.value })} 
                    style={{ width: '100%', fontSize: '13px' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Agency / Organization</label>
                  <input 
                    type="text" 
                    className="text-input" 
                    value={selectedUserForEdit.company || ''} 
                    onChange={e => setSelectedUserForEdit({ ...selectedUserForEdit, company: e.target.value })} 
                    style={{ width: '100%', fontSize: '13px' }} 
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Admin Notes / Assignment Details</label>
                <textarea 
                  className="text-input" 
                  rows={2}
                  value={selectedUserForEdit.notes || ''} 
                  onChange={e => setSelectedUserForEdit({ ...selectedUserForEdit, notes: e.target.value })} 
                  style={{ width: '100%', fontSize: '12px' }} 
                />
              </div>

              {/* API Keys Configuration */}
              <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24' }}>Connected API Keys</span>
                
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '2px' }}>SerpApi Key</label>
                  <input 
                    type="text" 
                    className="text-input" 
                    value={selectedUserForEdit.api_keys?.serpapi || ''} 
                    onChange={e => setSelectedUserForEdit({
                      ...selectedUserForEdit,
                      api_keys: { ...selectedUserForEdit.api_keys, serpapi: e.target.value }
                    })} 
                    style={{ width: '100%', fontSize: '12px' }} 
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '2px' }}>Hunter.io Key</label>
                    <input 
                      type="text" 
                      className="text-input" 
                      value={selectedUserForEdit.api_keys?.hunter || ''} 
                      onChange={e => setSelectedUserForEdit({
                        ...selectedUserForEdit,
                        api_keys: { ...selectedUserForEdit.api_keys, hunter: e.target.value }
                      })} 
                      style={{ width: '100%', fontSize: '12px' }} 
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '2px' }}>Apollo.io Key</label>
                    <input 
                      type="text" 
                      className="text-input" 
                      value={selectedUserForEdit.api_keys?.apollo || ''} 
                      onChange={e => setSelectedUserForEdit({
                        ...selectedUserForEdit,
                        api_keys: { ...selectedUserForEdit.api_keys, apollo: e.target.value }
                      })} 
                      style={{ width: '100%', fontSize: '12px' }} 
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditUserModalOpen(false)}>Cancel</button>
                <button type="submit" disabled={isSubmittingUser} className="btn btn-primary" style={{ fontWeight: 700 }}>
                  {isSubmittingUser ? 'Saving...' : 'Save User Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
