import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  FolderSync, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Mail,
  Phone,
  Briefcase
} from 'lucide-react';
import { api } from '../api';

export default function ResumeParserView({ currentJob, onSelectCandidate }) {
  const [resumes, setResumes] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  useEffect(() => {
    loadResumes();
  }, []);

  const loadResumes = async () => {
    try {
      const data = await api.getResumes();
      setResumes(data || []);
    } catch (err) {
      console.error('Failed to load resumes:', err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(`Parsing ${file.name}...`);
    try {
      const result = await api.uploadResume(file);
      setUploadStatus(`Successfully parsed ${result.full_name || file.name}!`);
      await loadResumes();
    } catch (err) {
      alert('Upload failed: ' + err.message);
      setUploadStatus('Upload failed.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleScanWatchFolder = async () => {
    setIsScanning(true);
    try {
      const res = await api.scanWatchFolder();
      alert(`Scanned watch folder: ingested ${res.ingested_count || 0} new resumes.`);
      await loadResumes();
    } catch (err) {
      alert('Watch folder scan failed: ' + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Banner */}
      <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-accent">Multi-Format Parser</span>
            <span className="badge badge-verified">PDF • DOCX • TXT</span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '6px 0 2px' }}>
            Inbound Resume Processing
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Parse incoming candidate resumes, extract tech stacks, verified contacts, and calculate instant job match
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={handleScanWatchFolder}
            disabled={isScanning}
          >
            <FolderSync size={14} className={isScanning ? 'animate-spin' : ''} />
            <span>{isScanning ? 'Scanning...' : 'Scan Watch Folder'}</span>
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="glass-card" style={{
        padding: '36px',
        border: '2px dashed var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.4)',
        cursor: 'pointer',
        position: 'relative'
      }}>
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleFileUpload}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0,
            cursor: 'pointer'
          }}
          disabled={isUploading}
        />
        
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '16px',
          background: 'var(--accent-gradient-subtle)',
          border: '1px solid var(--border-glow)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '12px',
          color: 'var(--accent-primary)'
        }}>
          <Upload size={24} className={isUploading ? 'animate-spin' : ''} />
        </div>

        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
          {isUploading ? 'Processing Document...' : 'Upload Inbound Resume'}
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', maxWidth: '400px' }}>
          Drag and drop a PDF, Word DOCX, or Text file here, or click to browse. The parser extracts verified email, phone, experience, and key skills automatically.
        </p>

        {uploadStatus && (
          <div style={{
            marginTop: '14px',
            fontSize: '12px',
            color: 'var(--success)',
            background: 'var(--success-bg)',
            padding: '4px 12px',
            borderRadius: '12px'
          }}>
            {uploadStatus}
          </div>
        )}
      </div>

      {/* Watch Folder Intel Card */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FolderSync size={20} style={{ color: 'var(--info)' }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
              Local Auto-Watch Folder: <code style={{ color: 'var(--accent-primary)', fontSize: '12px' }}>data/resumes/watch/</code>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              Drop resumes into this directory anytime; click "Scan Watch Folder" to ingest and score them in bulk.
            </div>
          </div>
        </div>
        <button 
          className="btn btn-secondary btn-sm"
          onClick={handleScanWatchFolder}
          disabled={isScanning}
        >
          <span>Sync Now</span>
        </button>
      </div>

      {/* Ingested Resumes List */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
            Ingested Resumes ({resumes.length})
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={loadResumes}>
            <RefreshCw size={12} />
            <span>Reload</span>
          </button>
        </div>

        {resumes.length === 0 ? (
          <div className="glass-card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileText size={32} style={{ color: 'var(--text-dim)', margin: '0 auto 10px' }} />
            <div>No inbound resumes uploaded yet. Upload one above or drop files in the watch folder.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {resumes.map((resume) => {
              const skills = Array.isArray(resume.skills) 
                ? resume.skills 
                : (resume.skills ? resume.skills.split(',').map(s => s.trim()) : []);

              return (
                <div 
                  key={resume.id}
                  className="glass-card glass-card-interactive"
                  style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#fff' }}>
                        {resume.full_name || 'Candidate Profile'}
                      </h4>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {resume.file_name || 'Uploaded Document'}
                      </span>
                    </div>
                    <span className="badge badge-platform-resume">
                      Resume
                    </span>
                  </div>

                  {/* Genuine Contact Info */}
                  <div style={{
                    padding: '8px 10px',
                    background: 'rgba(0, 0, 0, 0.25)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    fontSize: '11px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={12} style={{ color: resume.email ? 'var(--success)' : 'var(--text-dim)' }} />
                      {resume.email ? (
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>{resume.email}</span>
                      ) : (
                        <span className="badge badge-blank">— Not disclosed</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={12} style={{ color: resume.phone ? 'var(--success)' : 'var(--text-dim)' }} />
                      {resume.phone ? (
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>{resume.phone}</span>
                      ) : (
                        <span className="badge badge-blank">— Not disclosed</span>
                      )}
                    </div>
                  </div>

                  {/* Skills */}
                  {skills.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {skills.slice(0, 4).map((skill, idx) => (
                        <span key={idx} className="badge badge-accent" style={{ fontSize: '10px' }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => onSelectCandidate && onSelectCandidate(resume)}
                    >
                      <span>View Profile</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
