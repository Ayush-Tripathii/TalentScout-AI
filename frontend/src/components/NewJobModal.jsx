import React, { useState } from 'react';
import { X, Sparkles, Wand2, Briefcase, Building, MapPin, IndianRupee, Layers } from 'lucide-react';
import { api } from '../api';

export default function NewJobModal({ isOpen, onClose, onJobCreated }) {
  const [activeTab, setActiveTab] = useState('ai'); // 'ai' or 'manual'
  const [rawJd, setRawJd] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    title: '',
    client_name: '',
    skills_required: '',
    min_experience_years: 3,
    max_experience_years: 7,
    location: 'Bangalore / Remote',
    budget_max_inr: 2000000,
    target_roles_count: 2,
    job_description: ''
  });

  if (!isOpen) return null;

  const handleParseJD = async () => {
    if (!rawJd.trim()) {
      alert('Please paste a job description first.');
      return;
    }
    setIsParsing(true);
    try {
      const parsed = await api.parseJD(rawJd);
      const skills = parsed.must_have_skills || parsed.skills_required || [];
      const skillsStr = Array.isArray(skills) ? skills.join(', ') : (skills || prev.skills_required);
      const minExp = parsed.min_experience ?? parsed.min_experience_years;
      const maxExp = parsed.max_experience ?? parsed.max_experience_years;
      const loc = Array.isArray(parsed.locations) && parsed.locations.length > 0 ? parsed.locations.join(', ') : parsed.location;
      const budget = parsed.max_ctc ? Math.round(parsed.max_ctc * 100000) : parsed.budget_max_inr;

      setFormData(prev => ({
        ...prev,
        title: parsed.title || prev.title,
        client_name: parsed.client_name || prev.client_name || 'Enterprise Client',
        skills_required: skillsStr || prev.skills_required,
        min_experience_years: minExp ?? prev.min_experience_years,
        max_experience_years: maxExp ?? prev.max_experience_years,
        location: loc || prev.location,
        budget_max_inr: budget ?? prev.budget_max_inr,
        target_roles_count: parsed.positions_count ?? parsed.target_roles_count ?? prev.target_roles_count,
        job_description: rawJd
      }));
      setActiveTab('manual');
    } catch (err) {
      alert('Error parsing job description: ' + err.message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Job Title is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const skillsArray = formData.skills_required
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const budgetVal = Number(formData.budget_max_inr);
      const maxCtcLpa = budgetVal > 1000 ? Number((budgetVal / 100000).toFixed(1)) : budgetVal;

      const created = await api.createJob({
        title: formData.title,
        client_name: formData.client_name || 'Internal',
        must_have_skills: skillsArray,
        skills_required: skillsArray,
        min_experience: Number(formData.min_experience_years),
        min_experience_years: Number(formData.min_experience_years),
        max_experience: Number(formData.max_experience_years),
        max_experience_years: Number(formData.max_experience_years),
        locations: [formData.location],
        location: formData.location,
        max_ctc: maxCtcLpa,
        budget_max_inr: budgetVal,
        positions_count: Number(formData.target_roles_count),
        target_roles_count: Number(formData.target_roles_count),
        jd_raw_text: formData.job_description || rawJd || formData.title,
        job_description: formData.job_description || rawJd || formData.title
      });

      if (onJobCreated) onJobCreated(created);
      onClose();
    } catch (err) {
      alert('Failed to create job requirement: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <Briefcase size={17} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', margin: 0, fontWeight: 700 }}>
                New Staffing Requirement
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Configure role parameters, skill matrix, and sourcing constraints
              </span>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 24px', background: 'rgba(0, 0, 0, 0.2)' }}>
          <button 
            style={{
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'ai' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'ai' ? '#fff' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setActiveTab('ai')}
          >
            <Sparkles size={14} style={{ color: 'var(--accent-secondary)' }} />
            <span>AI Fast Intake (Raw JD)</span>
          </button>

          <button 
            style={{
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'manual' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'manual' ? '#fff' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setActiveTab('manual')}
          >
            <Layers size={14} />
            <span>Role Configuration</span>
          </button>
        </div>

        {/* Tab 1: AI Intake */}
        {activeTab === 'ai' && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              padding: '12px 16px',
              background: 'rgba(99, 102, 241, 0.08)',
              borderRadius: '8px',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              lineHeight: 1.5
            }}>
              Paste an unformatted client email, PDF text, or JD snippet below. The local intake parser will automatically extract the job title, target seniority, required tech stack, and location.
            </div>

            <textarea
              className="input-text"
              rows={9}
              placeholder="e.g. We are looking for a Senior Python Developer with 5+ years experience in FastAPI, Docker, PostgreSQL, AWS for our Bangalore office. Budget is up to 24 LPA. Need to close 2 positions urgently..."
              value={rawJd}
              onChange={(e) => setRawJd(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setActiveTab('manual')}
              >
                Skip to Manual Form
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleParseJD}
                disabled={isParsing || !rawJd.trim()}
              >
                <Wand2 size={15} className={isParsing ? 'animate-spin' : ''} />
                <span>{isParsing ? 'Analyzing JD...' : 'Extract & Auto-Fill Matrix'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Form */}
        {activeTab === 'manual' && (
          <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Job Title *
                </label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g. Senior Backend Engineer (Python)"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Client Name / Account
                </label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g. Flipkart, Swiggy, In-House"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Required Skills (Comma separated) *
              </label>
              <input
                type="text"
                className="input-text"
                placeholder="Python, FastAPI, Docker, PostgreSQL, Redis, AWS"
                value={formData.skills_required}
                onChange={(e) => setFormData({ ...formData, skills_required: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Min Experience (Years)
                </label>
                <input
                  type="number"
                  className="input-text"
                  min="0"
                  max="25"
                  value={formData.min_experience_years}
                  onChange={(e) => setFormData({ ...formData, min_experience_years: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Max Experience (Years)
                </label>
                <input
                  type="number"
                  className="input-text"
                  min="0"
                  max="35"
                  value={formData.max_experience_years}
                  onChange={(e) => setFormData({ ...formData, max_experience_years: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Open Positions
                </label>
                <input
                  type="number"
                  className="input-text"
                  min="1"
                  max="50"
                  value={formData.target_roles_count}
                  onChange={(e) => setFormData({ ...formData, target_roles_count: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Primary Location / Work Mode
                </label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="Bangalore, Hyderabad, Remote"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Max Budget / CTC (₹ INR per annum)
                </label>
                <input
                  type="number"
                  className="input-text"
                  step="50000"
                  value={formData.budget_max_inr}
                  onChange={(e) => setFormData({ ...formData, budget_max_inr: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating Requirement...' : 'Save & Activate Requirement'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
