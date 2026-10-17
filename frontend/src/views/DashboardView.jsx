import React from 'react';
import { 
  Briefcase, 
  Users, 
  CheckCircle, 
  TrendingUp, 
  Plus, 
  MapPin, 
  Layers, 
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Search
} from 'lucide-react';

export default function DashboardView({ 
  stats, 
  jobs, 
  selectedJobId, 
  onSelectJob, 
  onOpenNewJobModal,
  onNavigate 
}) {
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const currentJob = safeJobs.find(j => j.id === selectedJobId) || safeJobs[0] || null;

  const kpis = [
    {
      title: 'Active Requirements',
      value: stats?.active_jobs_count ?? safeJobs.length,
      subtext: 'Open contract mandates',
      icon: Briefcase,
      color: 'var(--accent-primary)',
      borderColor: 'rgba(99, 102, 241, 0.5)',
      gradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%)',
      actionHint: 'View mandates ↓',
      onClick: () => {
        const el = document.getElementById('staffing-mandates-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.classList.add('section-highlight-pulse');
          setTimeout(() => el.classList.remove('section-highlight-pulse'), 1500);
        }
      }
    },
    {
      title: 'Candidates in Pool',
      value: stats?.total_candidates_count ?? stats?.total_candidates ?? 0,
      subtext: 'Across search & resumes',
      icon: Users,
      color: 'var(--accent-secondary)',
      borderColor: 'rgba(236, 72, 153, 0.5)',
      gradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(236, 72, 153, 0.05) 100%)',
      actionHint: 'View pipeline →',
      onClick: () => onNavigate && onNavigate('pipeline')
    },
    {
      title: 'Verified Contacts',
      value: stats?.verified_contacts_count ?? stats?.verified_contacts ?? 0,
      subtext: '100% Genuine, Zero Dummy',
      icon: CheckCircle,
      color: 'var(--success)',
      borderColor: 'rgba(16, 185, 129, 0.5)',
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
      actionHint: 'Acquisition queue →',
      onClick: () => onNavigate && onNavigate('contacts')
    },
    {
      title: 'Average Match Score',
      value: (stats?.avg_match_score !== undefined && stats?.avg_match_score !== null && stats.avg_match_score > 0)
        ? `${Math.round(stats.avg_match_score)}%`
        : (stats?.total_candidates_count > 0 ? 'Pending' : '—'),
      subtext: 'Weighted 6-dimension fit',
      icon: TrendingUp,
      color: 'var(--info)',
      borderColor: 'rgba(14, 165, 233, 0.5)',
      gradient: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(14, 165, 233, 0.05) 100%)',
      actionHint: 'View rankings →',
      onClick: () => onNavigate && onNavigate('pipeline')
    },
  ];


  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Hero Welcome Banner */}
      <div className="glass-card" style={{
        padding: '24px 28px',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 27, 75, 0.4) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ zIndex: 1, maxWidth: '650px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="badge badge-accent">TalentScout Engine v2.0</span>
            <span className="badge badge-verified">
              <ShieldCheck size={12} /> DPDP Local SQLite WAL
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.02em' }}>
            Autonomous Sourcing Intelligence
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6 }}>
            Execute multi-platform metadata queries across LinkedIn, GitHub, and Naukri with zero paid APIs. All emails and phones are verified strictly against real public snippets and resumes—zero simulated or dummy contacts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', zIndex: 1 }}>
          <button 
            className="btn btn-secondary"
            onClick={() => onNavigate('sourcing')}
          >
            <Search size={15} />
            <span>Launch Sourcing</span>
          </button>
          <button 
            className="btn btn-primary"
            onClick={onOpenNewJobModal}
          >
            <Plus size={15} />
            <span>Post Requirement</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div 
              key={idx} 
              className="glass-card kpi-card-interactive" 
              role="button"
              tabIndex={0}
              onClick={kpi.onClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  kpi.onClick();
                }
              }}
              title={`Click to ${kpi.actionHint}`}
              style={{
                padding: '20px',
                background: kpi.gradient,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                border: '1px solid var(--border-subtle)',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = kpi.borderColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {kpi.title}
                </span>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: kpi.color
                }}>
                  <Icon size={16} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                  {kpi.value}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                  {kpi.subtext}
                </div>
              </div>

              {/* Action affordance footer */}
              <div style={{
                marginTop: 'auto',
                paddingTop: '8px',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: kpi.color,
                fontWeight: 600
              }}>
                <span>{kpi.actionHint}</span>
                <ArrowUpRight size={13} className="kpi-arrow-indicator" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Job Requirements List */}
      <div id="staffing-mandates-section" style={{ scrollMarginTop: '84px', transition: 'all 0.3s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700 }}>
              Staffing Mandates & Requirements
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
              Select a requirement to activate search filters and candidate ranking pipelines
            </span>
          </div>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={onOpenNewJobModal}
          >
            <Plus size={14} />
            <span>Add Role</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {safeJobs.map((job) => {
            const isSelected = job.id === currentJob?.id;

            const skills = Array.isArray(job.skills_required) 
              ? job.skills_required 
              : (job.skills_required ? job.skills_required.split(',').map(s => s.trim()) : []);

            return (
              <div
                key={job.id}
                className="glass-card glass-card-interactive"
                style={{
                  padding: '20px',
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  cursor: 'pointer'
                }}
                onClick={() => onSelectJob(job.id)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                      {job.title}
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Client: <span style={{ color: '#fff', fontWeight: 600 }}>{job.client_name || 'In-House'}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="badge badge-accent">
                      Active
                    </span>
                  )}
                </div>

                {/* Details Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)' }}>
                    {job.min_experience_years || 0} - {job.max_experience_years || 8} yrs exp
                  </span>
                  {job.location && (
                    <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)' }}>
                      <MapPin size={10} /> {job.location}
                    </span>
                  )}
                  {job.budget_max_inr && (
                    <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' }}>
                      ₹{(job.budget_max_inr / 100000).toFixed(1)} LPA
                    </span>
                  )}
                </div>

                {/* Skills tags */}
                {skills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {skills.slice(0, 5).map((s, idx) => (
                      <span key={idx} className="badge badge-accent" style={{ fontSize: '10px' }}>
                        {s}
                      </span>
                    ))}
                    {skills.length > 5 && (
                      <span style={{ fontSize: '10px', color: 'var(--text-dim)', alignSelf: 'center' }}>
                        +{skills.length - 5}
                      </span>
                    )}
                  </div>
                )}

                {/* Card Action */}
                <div style={{
                  marginTop: 'auto',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px'
                }}>
                  <span style={{ color: 'var(--text-dim)' }}>
                    {job.target_roles_count || 1} Positions open
                  </span>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectJob(job.id);
                      onNavigate('sourcing');
                    }}
                  >
                    <span>Source Talent</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
