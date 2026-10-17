import React from 'react';
import { 
  Building2, 
  MapPin, 
  Mail, 
  Phone, 
  ChevronRight, 
  CheckCircle,
  ExternalLink
} from 'lucide-react';

export default function CandidateCard({ candidate, ranking, onClick, onStageChange }) {
  if (!candidate) return null;

  const score = ranking?.overall_score ?? candidate.overall_score ?? candidate.score ?? 0;
  const scoreClass = score >= 75 ? 'score-high' : score >= 50 ? 'score-mid' : 'score-low';

  // Platform styling
  const platform = (candidate.platform || (candidate.sources?.[0]?.platform) || 'web').toLowerCase();
  let platformBadge = 'badge-accent';
  if (platform.includes('linkedin')) platformBadge = 'badge-platform-linkedin';
  else if (platform.includes('github')) platformBadge = 'badge-platform-github';
  else if (platform.includes('resume')) platformBadge = 'badge-platform-resume';

  // Extract initials
  const name = candidate.full_name || 'Candidate';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('');

  const skills = Array.isArray(candidate.skills) 
    ? candidate.skills 
    : (candidate.skills ? candidate.skills.split(',').map(s => s.trim()) : []);

  // Profile URL
  const profileUrl = candidate.profile_url || candidate.url || candidate.sources?.[0]?.url;

  // Safe contact extraction
  const email = candidate.email || (candidate.emails && candidate.emails.length > 0 ? candidate.emails[0] : null);
  const phone = candidate.phone || (candidate.phones && candidate.phones.length > 0 ? candidate.phones[0] : null);
  const title = candidate.current_title || candidate.headline || 'Software Professional';
  const location = candidate.location || candidate.current_location || 'India';
  const status = candidate.status || candidate.stage || 'New';

  return (
    <div 
      className="glass-card glass-card-interactive"
      style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer' }}
      onClick={onClick}
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Avatar */}
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '15px',
            color: '#fff',
            flexShrink: 0
          }}>
            {initials || 'TS'}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#fff' }}>
                {name}
              </h3>
              <span className={`badge ${platformBadge}`}>
                {candidate.platform || (candidate.sources?.[0]?.platform) || 'Web'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {title}
            </div>
          </div>
        </div>

        {/* Match Score */}
        <div className={`score-badge ${scoreClass}`}>
          {score}%
        </div>
      </div>

      {/* Company & Location Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
        {candidate.current_company && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Building2 size={13} style={{ color: 'var(--text-dim)' }} />
            {candidate.current_company}
          </span>
        )}
        {location && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <MapPin size={13} style={{ color: 'var(--text-dim)' }} />
            {location}
          </span>
        )}
      </div>

      {/* Verified Contact Info Pills (STRICT ZERO DUMMY) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 10px',
        background: 'rgba(0, 0, 0, 0.25)',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        fontSize: '11px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, minWidth: 0 }}>
          <Mail size={12} style={{ color: email ? 'var(--success)' : 'var(--text-dim)', flexShrink: 0 }} />
          {email ? (
            <span style={{ color: 'var(--success)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email}
            </span>
          ) : (
            <span className="badge badge-blank">
              — Not disclosed
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Phone size={12} style={{ color: phone ? 'var(--success)' : 'var(--text-dim)', flexShrink: 0 }} />
          {phone ? (
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>
              {phone}
            </span>
          ) : (
            <span className="badge badge-blank">
              — Not disclosed
            </span>
          )}
        </div>
      </div>

      {/* Skills Badges */}
      {skills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {skills.slice(0, 4).map((skill, idx) => (
            <span key={idx} className="badge badge-accent" style={{ fontSize: '10px' }}>
              {skill}
            </span>
          ))}
          {skills.length > 4 && (
            <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-dim)', fontSize: '10px' }}>
              +{skills.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Card Footer: Stage Selector & View trigger */}
      <div 
        style={{ 
          marginTop: 'auto', 
          paddingTop: '10px', 
          borderTop: '1px solid var(--border-subtle)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          gap: '8px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <select
          className="select-input"
          value={status}
          onChange={(e) => onStageChange && onStageChange(candidate.id, e.target.value)}
          style={{ width: '110px', padding: '4px 6px', fontSize: '11px', fontWeight: 600 }}
        >
          <option value="New">New</option>
          <option value="Screening">Screening</option>
          <option value="Interview">Interview</option>
          <option value="Shortlisted">Shortlisted</option>
          <option value="Offered">Offered</option>
          <option value="Rejected">Rejected</option>
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {profileUrl && (
            <a 
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ 
                padding: '4px 8px', 
                fontSize: '11px', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px',
                color: '#60a5fa',
                borderColor: 'rgba(96, 165, 250, 0.35)',
                textDecoration: 'none'
              }}
              title={`Open live profile on ${candidate.platform || 'platform'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={12} />
              <span>Profile</span>
            </a>
          )}

          <button 
            className="btn btn-secondary btn-sm"
            onClick={onClick}
            style={{ padding: '4px 8px', fontSize: '11px' }}
          >
            <span>Dossier</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
