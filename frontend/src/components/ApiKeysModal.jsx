import React, { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles, 
  Cpu, 
  Code2, 
  Search,
  Check,
  RefreshCw,
  Trash2,
  Mail
} from 'lucide-react';
import { api } from '../api';

export default function ApiKeysModal({ isOpen, onClose, showToast }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Stored state from backend
  const [status, setStatus] = useState({
    free_engine_active: true,
    has_serpapi: false,
    serpapi_masked: null,
    has_github: false,
    github_masked: null,
    has_hunter: false,
    hunter_masked: null,
    has_apollo: false,
    apollo_masked: null,
    enrichment_credits_remaining: 50,
    active_mode: 'free_tier'
  });

  // Input states
  const [serpapiKey, setSerpapiKey] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [hunterKey, setHunterKey] = useState('');
  const [apolloKey, setApolloKey] = useState('');

  // Key testing states
  const [testingSerpapi, setTestingSerpapi] = useState(false);
  const [serpapiResult, setSerpapiResult] = useState(null);

  const [testingGithub, setTestingGithub] = useState(false);
  const [githubResult, setGithubResult] = useState(null);

  const [testingHunter, setTestingHunter] = useState(false);
  const [hunterResult, setHunterResult] = useState(null);

  const [testingApollo, setTestingApollo] = useState(false);
  const [apolloResult, setApolloResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadKeysStatus();
    }
  }, [isOpen]);

  const loadKeysStatus = async () => {
    setLoading(true);
    try {
      const res = await api.getSettingsKeys();
      const keyData = res?.data || res;
      if (keyData) {
        setStatus(keyData);
      }
    } catch (err) {
      console.error('Failed to load keys status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestSerpapi = async () => {
    const keyToTest = serpapiKey.trim();
    if (!keyToTest) {
      setSerpapiResult({ valid: false, message: 'Please enter a SerpApi key first.' });
      return;
    }
    setTestingSerpapi(true);
    setSerpapiResult(null);
    try {
      const res = await api.testSettingsKey('serpapi', keyToTest);
      setSerpapiResult({ valid: res.valid, message: res.message });
      if (res.valid) {
        showToast('SerpApi Key verified successfully!', 'success');
      } else {
        showToast('SerpApi Key test failed: ' + res.message, 'error');
      }
    } catch (err) {
      setSerpapiResult({ valid: false, message: err.message });
      showToast('SerpApi test error: ' + err.message, 'error');
    } finally {
      setTestingSerpapi(false);
    }
  };

  const handleTestGithub = async () => {
    const tokenToTest = githubToken.trim();
    if (!tokenToTest) {
      setGithubResult({ valid: false, message: 'Please enter a GitHub token first.' });
      return;
    }
    setTestingGithub(true);
    setGithubResult(null);
    try {
      const res = await api.testSettingsKey('github', tokenToTest);
      setGithubResult({ valid: res.valid, message: res.message });
      if (res.valid) {
        showToast('GitHub Token verified successfully!', 'success');
      } else {
        showToast('GitHub Token test failed: ' + res.message, 'error');
      }
    } catch (err) {
      setGithubResult({ valid: false, message: err.message });
      showToast('GitHub test error: ' + err.message, 'error');
    } finally {
      setTestingGithub(false);
    }
  };

  const handleTestHunter = async () => {
    const keyToTest = hunterKey.trim();
    if (!keyToTest) {
      setHunterResult({ valid: false, message: 'Please enter a Hunter.io API key first.' });
      return;
    }
    setTestingHunter(true);
    setHunterResult(null);
    try {
      const res = await api.testSettingsKey('hunter', keyToTest);
      setHunterResult({ valid: res.valid, message: res.message });
      if (res.valid) {
        showToast('Hunter.io API Key verified successfully!', 'success');
      } else {
        showToast('Hunter.io test failed: ' + res.message, 'error');
      }
    } catch (err) {
      setHunterResult({ valid: false, message: err.message });
      showToast('Hunter.io test error: ' + err.message, 'error');
    } finally {
      setTestingHunter(false);
    }
  };

  const handleTestApollo = async () => {
    const keyToTest = apolloKey.trim();
    if (!keyToTest) {
      setApolloResult({ valid: false, message: 'Please enter an Apollo.io API key first.' });
      return;
    }
    setTestingApollo(true);
    setApolloResult(null);
    try {
      const res = await api.testSettingsKey('apollo', keyToTest);
      setApolloResult({ valid: res.valid, message: res.message });
      if (res.valid) {
        showToast('Apollo.io API Key verified successfully!', 'success');
      } else {
        showToast('Apollo.io test failed: ' + res.message, 'error');
      }
    } catch (err) {
      setApolloResult({ valid: false, message: err.message });
      showToast('Apollo.io test error: ' + err.message, 'error');
    } finally {
      setTestingApollo(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const payload = {};
      if (serpapiKey.trim() !== '') {
        payload.serpapi_key = serpapiKey.trim();
      }
      if (githubToken.trim() !== '') {
        payload.github_token = githubToken.trim();
      }
      if (hunterKey.trim() !== '') {
        payload.hunter_api_key = hunterKey.trim();
      }
      if (apolloKey.trim() !== '') {
        payload.apollo_api_key = apolloKey.trim();
      }

      const res = await api.saveSettingsKeys(payload);
      const keyData = res?.data || res;
      if (keyData) {
        setStatus(keyData);
      }
      setSerpapiKey('');
      setGithubToken('');
      setHunterKey('');
      setApolloKey('');
      setSerpapiResult(null);
      setGithubResult(null);
      setHunterResult(null);
      setApolloResult(null);
      showToast('API credentials saved successfully!', 'success');
      onClose();
    } catch (err) {
      showToast('Failed to save credentials: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClearKey = async (provider) => {
    setSaving(true);
    try {
      const payload = {};
      if (provider === 'serpapi') payload.serpapi_key = '';
      if (provider === 'github') payload.github_token = '';
      if (provider === 'hunter') payload.hunter_api_key = '';
      if (provider === 'apollo') payload.apollo_api_key = '';

      const res = await api.saveSettingsKeys(payload);
      const keyData = res?.data || res;
      if (keyData) {
        setStatus(keyData);
      }
      showToast(`${provider.toUpperCase()} Key removed.`, 'info');
    } catch (err) {
      showToast('Failed to clear key: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="glass-card modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.2)',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.85)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8'
            }}>
              <Key size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                Real-Time Sourcing Engine & API Keys
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Configure live Google X-Ray and GitHub tokens, or run 100% free with zero keys
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Active Operating Status Banner */}
          <div style={{
            padding: '14px 18px',
            borderRadius: '12px',
            background: status.has_serpapi && status.has_github 
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%)' 
              : status.has_serpapi || status.has_github
              ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%)'
              : 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={18} style={{ color: '#818cf8' }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                  Current Active Search Mode:
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {status.has_serpapi && status.has_github ? (
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                      ⚡ Enterprise Hybrid Mode: Google X-Ray & Authenticated GitHub Active
                    </span>
                  ) : status.has_serpapi ? (
                    <span style={{ color: '#60a5fa', fontWeight: 600 }}>
                      🌐 Google X-Ray Active (SerpApi) + Free GitHub Engine
                    </span>
                  ) : status.has_github ? (
                    <span style={{ color: '#a78bfa', fontWeight: 600 }}>
                      🐙 Authenticated GitHub (5,000 req/hr) + Free DuckDuckGo Engine
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                      ✨ 100% Free Default Mode (DuckDuckGo + Public GitHub API)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <span className={`badge ${status.has_serpapi ? 'badge-verified' : 'badge-platform-resume'}`}>
                SerpApi: {status.has_serpapi ? 'Connected' : 'Free Mode'}
              </span>
              <span className={`badge ${status.has_github ? 'badge-verified' : 'badge-platform-resume'}`}>
                GitHub: {status.has_github ? 'Connected' : 'Free Mode'}
              </span>
            </div>
          </div>

          {/* Engine 1: Free Tier Info Card */}
          <div style={{
            padding: '14px 16px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <ShieldCheck size={18} style={{ color: 'var(--success)', marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                Option 1: Built-in Free Search Engine (Always Active)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
                If you don't enter any keys, the system automatically uses <strong>DuckDuckGo</strong> for public web profiles and the <strong>Public GitHub API</strong>. Zero keys or subscriptions required.
              </div>
            </div>
          </div>

          {/* Engine 2: SerpApi (Google X-Ray) */}
          <div className="glass-card" style={{ padding: '16px', background: 'rgba(30, 41, 59, 0.45)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={16} style={{ color: '#60a5fa' }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                  Option 2: Google X-Ray Sourcing Key (SerpApi)
                </span>
              </div>
              {status.has_serpapi && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="badge badge-verified">
                    Connected: {status.serpapi_masked}
                  </span>
                  <button 
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 8px', fontSize: '10px', color: 'var(--danger)' }}
                    onClick={() => handleClearKey('serpapi')}
                    disabled={saving}
                    title="Remove key and revert to free mode"
                  >
                    <Trash2 size={11} /> Clear
                  </button>
                </div>
              )}
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '12px' }}>
              Routes Boolean queries (<code style={{ color: '#818cf8' }}>site:linkedin.com/in</code>, <code style={{ color: '#818cf8' }}>site:naukri.com</code>) directly through live Google results with zero CAPTCHAs. 
              Get your key from <a href="https://serpapi.com" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>serpapi.com</a> (Free tier: 100 searches/mo).
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="password"
                className="input-text"
                placeholder={status.has_serpapi ? 'Enter new key to update...' : 'Paste your SerpApi Key here...'}
                value={serpapiKey}
                onChange={(e) => setSerpapiKey(e.target.value)}
                style={{ flex: 1, fontSize: '12px' }}
              />
              <button 
                className="btn btn-secondary btn-sm"
                onClick={handleTestSerpapi}
                disabled={testingSerpapi || !serpapiKey.trim()}
              >
                <RefreshCw size={12} className={testingSerpapi ? 'animate-spin' : ''} />
                <span>{testingSerpapi ? 'Testing...' : 'Test Key'}</span>
              </button>
            </div>

            {serpapiResult && (
              <div style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                background: serpapiResult.valid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${serpapiResult.valid ? 'var(--success)' : 'var(--danger)'}`,
                color: serpapiResult.valid ? 'var(--success)' : 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {serpapiResult.valid ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                <span>{serpapiResult.message}</span>
              </div>
            )}
          </div>

          {/* Engine 3: GitHub Personal Access Token */}
          <div className="glass-card" style={{ padding: '16px', background: 'rgba(30, 41, 59, 0.45)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Code2 size={16} style={{ color: '#a78bfa' }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                  Option 3: GitHub Personal Access Token (Free High-Rate Tier)
                </span>
              </div>
              {status.has_github && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="badge badge-verified">
                    Connected: {status.github_masked}
                  </span>
                  <button 
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 8px', fontSize: '10px', color: 'var(--danger)' }}
                    onClick={() => handleClearKey('github')}
                    disabled={saving}
                    title="Remove token and revert to free limit"
                  >
                    <Trash2 size={11} /> Clear
                  </button>
                </div>
              )}
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '12px' }}>
              Increases rate limits from 60 to <strong>5,000 live requests/hour</strong> and fetches detailed developer profiles and public emails. 
              Free to generate at <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', textDecoration: 'underline' }}>github.com/settings/tokens</a> (Select <code>read:user</code> scope).
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="password"
                className="input-text"
                placeholder={status.has_github ? 'Enter new token to update...' : 'Paste your GitHub Token (ghp_...)'}
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                style={{ flex: 1, fontSize: '12px' }}
              />
              <button 
                className="btn btn-secondary btn-sm"
                onClick={handleTestGithub}
                disabled={testingGithub || !githubToken.trim()}
              >
                <RefreshCw size={12} className={testingGithub ? 'animate-spin' : ''} />
                <span>{testingGithub ? 'Testing...' : 'Test Token'}</span>
              </button>
            </div>

            {githubResult && (
              <div style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                background: githubResult.valid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${githubResult.valid ? 'var(--success)' : 'var(--danger)'}`,
                color: githubResult.valid ? 'var(--success)' : 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {githubResult.valid ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                <span>{githubResult.message}</span>
              </div>
            )}
          </div>

          {/* Engine 4: Contact Enrichment Services (Hunter.io & Apollo.io) */}
          <div className="glass-card" style={{ padding: '16px', background: 'rgba(30, 41, 59, 0.45)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={16} style={{ color: '#10b981' }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                  Option 4: Contact Enrichment (Hunter.io & Apollo.io)
                </span>
              </div>
              <span className="badge badge-verified">
                Monthly Cap: {status.enrichment_credits_remaining ?? 50} credits left
              </span>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '14px' }}>
              Enables single-candidate <strong>"Reveal Contact"</strong> directly in candidate drawers and the Contact Queue. Free tiers from Hunter/Apollo provide 25-50 free lookups/mo.
            </div>

            {/* Hunter.io */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1' }}>Hunter.io API Key</span>
                {status.has_hunter && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge badge-verified" style={{ fontSize: '10px' }}>
                      Connected: {status.hunter_masked}
                    </span>
                    <button 
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 8px', fontSize: '10px', color: 'var(--danger)' }}
                      onClick={() => handleClearKey('hunter')}
                      disabled={saving}
                    >
                      <Trash2 size={10} /> Clear
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="password"
                  className="input-text"
                  placeholder={status.has_hunter ? 'Enter new key to update...' : 'Paste Hunter.io Key'}
                  value={hunterKey}
                  onChange={(e) => setHunterKey(e.target.value)}
                  style={{ flex: 1, fontSize: '12px' }}
                />
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={handleTestHunter}
                  disabled={testingHunter || !hunterKey.trim()}
                >
                  <RefreshCw size={12} className={testingHunter ? 'animate-spin' : ''} />
                  <span>{testingHunter ? 'Testing...' : 'Test'}</span>
                </button>
              </div>
              {hunterResult && (
                <div style={{
                  marginTop: '6px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  background: hunterResult.valid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${hunterResult.valid ? 'var(--success)' : 'var(--danger)'}`,
                  color: hunterResult.valid ? 'var(--success)' : 'var(--danger)'
                }}>
                  {hunterResult.message}
                </div>
              )}
            </div>

            {/* Apollo.io */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1' }}>Apollo.io API Key</span>
                {status.has_apollo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge badge-verified" style={{ fontSize: '10px' }}>
                      Connected: {status.apollo_masked}
                    </span>
                    <button 
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 8px', fontSize: '10px', color: 'var(--danger)' }}
                      onClick={() => handleClearKey('apollo')}
                      disabled={saving}
                    >
                      <Trash2 size={10} /> Clear
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="password"
                  className="input-text"
                  placeholder={status.has_apollo ? 'Enter new key to update...' : 'Paste Apollo.io Key'}
                  value={apolloKey}
                  onChange={(e) => setApolloKey(e.target.value)}
                  style={{ flex: 1, fontSize: '12px' }}
                />
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={handleTestApollo}
                  disabled={testingApollo || !apolloKey.trim()}
                >
                  <RefreshCw size={12} className={testingApollo ? 'animate-spin' : ''} />
                  <span>{testingApollo ? 'Testing...' : 'Test'}</span>
                </button>
              </div>
              {apolloResult && (
                <div style={{
                  marginTop: '6px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  background: apolloResult.valid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${apolloResult.valid ? 'var(--success)' : 'var(--danger)'}`,
                  color: apolloResult.valid ? 'var(--success)' : 'var(--danger)'
                }}>
                  {apolloResult.message}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.85)'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            Keys are saved locally in your private SQLite database. Zero cloud telemetry.
          </span>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button 
              className="btn btn-primary btn-sm"
              onClick={handleSaveAll}
              disabled={saving || (!serpapiKey.trim() && !githubToken.trim() && !hunterKey.trim() && !apolloKey.trim())}
            >
              <Check size={14} />
              <span>{saving ? 'Saving...' : 'Save & Activate Keys'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
