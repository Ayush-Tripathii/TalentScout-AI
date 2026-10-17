import React from 'react';
import { 
  LayoutDashboard, 
  Search, 
  Users, 
  FileText, 
  GitMerge, 
  ShieldCheck, 
  Database, 
  Sparkles,
  Bot,
  PhoneCall,
  Megaphone
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, stats, currentUser }) {
  const isUserAdmin = currentUser?.role === 'admin';

  const navItems = [
    { id: 'dashboard', label: 'Requirements & Stats', icon: LayoutDashboard },
    { id: 'sourcing', label: 'Sourcing Console', icon: Search, badge: 'Live DDG' },
    { id: 'automated', label: 'Auto-Sourcing & Alerts', icon: Bot, badge: 'Phase 8' },
    { id: 'pipeline', label: 'Candidate Pipeline', icon: Users, badge: stats?.total_candidates_count ?? stats?.total_candidates ?? 0 },
    { id: 'contacts', label: 'Contact Acquisition', icon: PhoneCall },
    { id: 'outreach', label: 'Outreach & Marketing', icon: Megaphone, badge: 'Phase 6' },
    { id: 'resumes', label: 'Resume Parser', icon: FileText },
    { id: 'dedup', label: 'Identity Deduplication', icon: GitMerge },
    ...(isUserAdmin ? [{ id: 'compliance', label: 'Compliance & Audit', icon: ShieldCheck, badge: 'Admin' }] : []),
  ];

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
            color: '#fff'
          }}>
            <Sparkles size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '17px', margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>
              TalentScout
            </h1>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
              Autonomous Staffing AI
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', padding: '0 8px 8px', fontWeight: 700 }}>
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`nav-tab ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} style={{ color: isActive ? 'var(--accent-primary)' : 'inherit' }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge !== undefined && (
                <span style={{
                  fontSize: '11px',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  background: isActive ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  fontWeight: 600
                }}>
                  {item.badge}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* System Integrity & Compliance Footer */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(0, 0, 0, 0.2)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <Database size={13} style={{ color: 'var(--info)' }} />
            <span>SQLite WAL (Local Storage)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--success)' }}>
            <ShieldCheck size={13} />
            <span style={{ fontWeight: 600 }}>Zero Dummy Data Guarantee</span>
          </div>
          <div style={{
            fontSize: '10px',
            color: 'var(--text-dim)',
            lineHeight: 1.4,
            padding: '8px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.04)'
          }}>
            Only genuine contacts from verified snippets or uploaded resumes are displayed.
          </div>
        </div>
      </div>
    </aside>
  );
}
