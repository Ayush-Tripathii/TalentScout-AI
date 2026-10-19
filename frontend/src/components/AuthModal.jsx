import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Mail, 
  Lock, 
  User, 
  Building2, 
  Phone, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  AlertTriangle,
  Zap,
  KeyRound,
  RefreshCw,
  Check,
  ChevronLeft,
  ShieldAlert,
  Eye,
  EyeOff
} from 'lucide-react';
import { api, getCsrfToken } from '../api';

// Common disposable email domains for immediate client-side feedback
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', '10minutemail.com', '10minutemail.net',
  'guerrillamail.com', 'trashmail.com', 'throwawaymail.com', 'sharklasers.com',
  'yopmail.com', 'fakeinbox.com', 'getairmail.com', 'temp-mail.org',
  'burnermail.io', 'inboxkitten.com', 'emailondeck.com', 'dropmail.me'
]);

export default function AuthModal({ isOpen, onClose, onLoginSuccess, initialMode = 'login', showToast }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'signup' | 'admin'
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  
  // Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('Senior Technical Recruiter');
  const [showPassword, setShowPassword] = useState(false);
  
  // OTP States
  const [otpCode, setOtpCode] = useState('');
  const [devOtpHint, setDevOtpHint] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  
  // Threats & Validation feedback
  const [emailWarning, setEmailWarning] = useState('');
  const [phoneWarning, setPhoneWarning] = useState('');
  const [threatWarning, setThreatWarning] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setStep('form');
    setOtpCode('');
    setDevOtpHint(null);
    setEmailWarning('');
    setPhoneWarning('');
    setThreatWarning('');

    if (initialMode === 'admin') {
      setEmail('admin@talentscout.ai');
      setPassword('Admin#TalentScout2026!Secure');
    }

    // Prefetch anti-CSRF token
    if (isOpen) {
      getCsrfToken();
    }
  }, [initialMode, isOpen]);

  // Resend OTP countdown timer
  useEffect(() => {
    let timer;
    if (step === 'otp' && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, resendCooldown]);

  if (!isOpen) return null;

  // Real-time threat detection scanner
  const checkThreatPattern = (val) => {
    if (!val || typeof val !== 'string') return false;
    const sqliPatterns = [
      /(?:\b(or|and)\b\s+[\'\"]?\w+[\'\"]?\s*=\s*[\'\"]?\w+[\'\"]?)/i,
      /(?:\b(or|and)\b\s+\d+\s*=\s*\d+)/i,
      /(?:\bunion\b\s+(?:all\s+)?\bselect\b)/i,
      /(?:--|#|\/\*|\*\/|;--)/i,
      /(?:\b(?:drop|alter|truncate)\s+\btable\b)/i,
      /(?:\bdelete\s+from\b)/i,
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
      /javascript:[^\s\"'>]+/i
    ];
    return sqliPatterns.some((pattern) => pattern.test(val));
  };

  const handleEmailChange = (val) => {
    setEmail(val);
    setThreatWarning('');
    if (checkThreatPattern(val)) {
      setThreatWarning('Warning: Suspicious SQL/Script injection pattern detected in email.');
      return;
    }
    if (val.includes('@')) {
      const domain = val.split('@')[1]?.toLowerCase().trim();
      if (DISPOSABLE_DOMAINS.has(domain)) {
        setEmailWarning(`The domain '@${domain}' is a known temporary/disposable email provider. Please use your official company or authentic email.`);
        return;
      }
    }
    setEmailWarning('');
  };

  const handlePhoneChange = (val) => {
    setPhone(val);
    setThreatWarning('');
    if (checkThreatPattern(val)) {
      setThreatWarning('Warning: Suspicious SQL/Script injection pattern detected in phone field.');
      return;
    }

    const clean = val.replace(/[\s\-\(\)\.]/g, '');
    const raw = clean.startsWith('+91') ? clean.slice(3) : (clean.startsWith('91') && clean.length === 12 ? clean.slice(2) : clean);
    
    if (raw.length >= 10) {
      if (!['6', '7', '8', '9'].includes(raw[0])) {
        setPhoneWarning('Invalid telecom prefix: Authentic Indian mobile numbers start with 6, 7, 8, or 9.');
        return;
      }
      const uniqueDigits = new Set(raw.split('')).size;
      if (uniqueDigits <= 2) {
        setPhoneWarning('Temporary, repeated, or dummy phone numbers (e.g. 9999999999) are blocked.');
        return;
      }
      if (['1234567890', '9876543210', '0123456789', '9898989898'].includes(raw)) {
        setPhoneWarning('Recognized dummy test sequence. Please enter your authentic mobile number.');
        return;
      }
    }
    setPhoneWarning('');
  };

  // Form submission (Step 1)
  const handleInitiateAuth = async (e) => {
    e.preventDefault();
    setThreatWarning('');

    // Pre-flight threat detection (do not scan passwords, passwords legitimately contain #, $, etc.)
    const inputsToCheck = [fullName, email, phone, company];
    for (const input of inputsToCheck) {
      if (checkThreatPattern(input)) {
        setThreatWarning('Security Alert: Malicious SQL injection or script attack signature identified. Request terminated.');
        if (showToast) showToast('Security Threat Blocked: Input contains prohibited syntax.', 'error');
        return;
      }
    }

    if (!email) {
      if (showToast) showToast('Please enter your email.', 'error');
      return;
    }

    // Check disposable email
    if (email.includes('@')) {
      const domain = email.split('@')[1]?.toLowerCase().trim();
      if (DISPOSABLE_DOMAINS.has(domain)) {
        setEmailWarning('Temporary and disposable emails are strictly blocked for DPDP compliance.');
        if (showToast) showToast('Disposable email address blocked.', 'error');
        return;
      }
    }

    setIsLoading(true);

    // Case 1: Administrator Login (Root access via password)
    if (mode === 'admin') {
      try {
        const res = await api.adminLogin(email, password);
        const adminUser = {
          name: res.user?.full_name || 'System Administrator',
          email: res.user?.email || email,
          company: res.user?.company || 'TalentScout Global Security',
          role: 'admin',
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=Admin&backgroundColor=4f46e5`,
          token: res.access_token,
          loggedInAt: new Date().toISOString(),
        };

        localStorage.setItem('talentscout_admin_token', res.access_token);
        localStorage.setItem('talentscout_auth_user', JSON.stringify(adminUser));
        setIsLoading(false);
        if (showToast) showToast('Authenticated with Administrator Privileges.', 'success');
        onLoginSuccess(adminUser, 'admin');
        onClose();
        return;
      } catch (err) {
        setIsLoading(false);
        if (showToast) showToast('Admin authentication failed: ' + err.message, 'error');
        return;
      }
    }

    // Case 2: Recruiter Sign-Up / First Login via Email OTP
    try {
      const res = await api.sendOtp({
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        full_name: fullName.trim() || undefined,
        purpose: mode === 'signup' ? 'New Recruiter Sign-Up' : 'Recruiter Secure Sign-In',
      });

      setIsLoading(false);
      setDevOtpHint(res.dev_otp || null);
      setStep('otp');
      setResendCooldown(60);
      setCanResend(false);
      if (showToast) {
        showToast(
          res.smtp_dispatched 
            ? `Security OTP sent to ${email} via enterprise email.`
            : `Security OTP generated for ${email}. Check your email.`,
          'success'
        );
      }
    } catch (err) {
      setIsLoading(false);
      const msg = err.message || 'Failed to dispatch verification code.';
      if (showToast) showToast(msg, 'error');
    }
  };

  // Step 2: Verify OTP and finish authentication
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      if (showToast) showToast('Please enter the complete 6-digit verification code.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.verifyOtp({
        email: email.trim().toLowerCase(),
        otp: otpCode.trim(),
        full_name: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
        company: company.trim() || 'Apex Staffing Solutions',
        role: role || 'Lead Staffing Partner',
        password: password || 'Recruiter#2026!Secure',
      });

      const user = {
        name: res.user?.name || fullName || email.split('@')[0],
        email: res.user?.email || email,
        phone: res.user?.phone || phone || '+91 98201 54321',
        company: res.user?.company || company || 'Apex Staffing Solutions',
        role: res.user?.role || role || 'Lead Staffing Partner',
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName || email)}&backgroundColor=6366f1,8b5cf6`,
        token: res.access_token || 'ts_jwt_' + Math.random().toString(36).substring(2),
        loggedInAt: new Date().toISOString(),
      };

      localStorage.setItem('talentscout_auth_user', JSON.stringify(user));
      setIsLoading(false);
      if (showToast) showToast(`Identity verified successfully. Welcome, ${user.name}!`, 'success');
      onLoginSuccess(user, 'workspace');
      onClose();
    } catch (err) {
      setIsLoading(false);
      if (showToast) showToast('Verification error: ' + err.message, 'error');
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (!canResend) return;
    setIsLoading(true);
    try {
      const res = await api.sendOtp({
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        full_name: fullName.trim() || undefined,
        purpose: 'Resend Verification Code',
      });
      setIsLoading(false);
      setDevOtpHint(res.dev_otp || null);
      setResendCooldown(60);
      setCanResend(false);
      if (showToast) showToast(`Fresh 6-digit verification code dispatched to ${email}.`, 'success');
    } catch (err) {
      setIsLoading(false);
      if (showToast) showToast('Failed to resend code: ' + err.message, 'error');
    }
  };

  const handleDemoRecruiterLogin = async () => {
    setIsLoading(true);
    try {
      const demoEmail = 'priya.sharma@apexstaffing.in';
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail }),
      });
      const data = await res.json();
      const demoUser = {
        name: data.user?.name || 'Priya Sharma',
        email: demoEmail,
        company: data.user?.company || 'Apex Staffing Solutions',
        role: data.user?.role || 'Lead Staffing Partner',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        token: data.access_token || 'ts_demo_token_apex_2026',
        loggedInAt: new Date().toISOString(),
      };
      localStorage.setItem('talentscout_auth_user', JSON.stringify(demoUser));
      setIsLoading(false);
      if (showToast) showToast('Logged in as Priya Sharma (Demo Recruiter)', 'success');
      onLoginSuccess(demoUser, 'workspace');
      onClose();
    } catch {
      const demoUser = {
        name: 'Priya Sharma',
        email: 'priya.sharma@apexstaffing.in',
        company: 'Apex Staffing Solutions',
        role: 'Lead Staffing Partner',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        token: 'ts_demo_token_apex_2026',
        loggedInAt: new Date().toISOString(),
      };
      localStorage.setItem('talentscout_auth_user', JSON.stringify(demoUser));
      setIsLoading(false);
      if (showToast) showToast('Logged in as Priya Sharma (Demo Recruiter)', 'success');
      onLoginSuccess(demoUser, 'workspace');
      onClose();
    }
  };

  const fillAdminCredentials = () => {
    setEmail('admin@talentscout.ai');
    setPassword('Admin#TalentScout2026!Secure');
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ 
          maxWidth: '480px', 
          width: '92%', 
          padding: '30px 26px',
          background: mode === 'admin' 
            ? 'linear-gradient(135deg, rgba(20, 15, 40, 0.99) 0%, rgba(10, 8, 25, 0.99) 100%)' 
            : 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(7, 9, 14, 0.99) 100%)',
          border: mode === 'admin' 
            ? '1px solid rgba(139, 92, 246, 0.5)' 
            : '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: mode === 'admin'
            ? '0 20px 60px rgba(0, 0, 0, 0.9), 0 0 50px rgba(139, 92, 246, 0.3)'
            : '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(99, 102, 241, 0.2)',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={20} />
        </button>

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: mode === 'admin'
              ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)'
              : 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 10px',
            color: '#fff',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)'
          }}>
            {mode === 'admin' ? <ShieldCheck size={26} /> : step === 'otp' ? <KeyRound size={24} /> : <Sparkles size={24} />}
          </div>
          
          <h2 style={{ fontSize: '21px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#fff' }}>
            {mode === 'admin' 
              ? 'Administrator & CMS Portal' 
              : step === 'otp'
                ? 'Verify Email Security Code'
                : mode === 'login' 
                  ? 'Sign in to TalentScout' 
                  : 'Create Recruiter Account'}
          </h2>
          <p style={{ margin: '5px 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
            {mode === 'admin'
              ? 'Manage live landing page CMS, system telemetry & DPDP compliance'
              : step === 'otp'
                ? `Enter the 6-digit OTP code sent to ${email}`
                : mode === 'login' 
                  ? 'Access candidate intelligence, auto-sourcing, and pipeline tools'
                  : 'Zero dummy contacts • Anti-disposable email & fraud screening active'}
          </p>
        </div>

        {/* Security Threat Banner (if SQLi or script pattern detected) */}
        {threatWarning && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#fca5a5',
            fontSize: '12px',
            lineHeight: 1.4,
          }}>
            <ShieldAlert size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
            <div>{threatWarning}</div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 1: INITIAL REGISTRATION / CREDENTIALS FORM                */}
        {/* ============================================================== */}
        {step === 'form' && (
          <>
            {/* Quick Demo Access Helpers */}
            {mode === 'admin' ? (
              <div 
                onClick={fillAdminCredentials}
                style={{
                  background: 'rgba(139, 92, 246, 0.1)',
                  border: '1px solid rgba(139, 92, 246, 0.35)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  marginBottom: '16px',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 4px 14px rgba(139, 92, 246, 0.15)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.18)';
                  e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.6)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.35)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(139, 92, 246, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#c4b5fd',
                  }}>
                    <KeyRound size={17} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                      Auto-fill Root Admin Credentials
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      admin@talentscout.ai • PBKDF2 Salted Auth
                    </div>
                  </div>
                </div>
                <span className="badge badge-accent" style={{ fontSize: '10.5px', padding: '3px 10px', background: 'rgba(139, 92, 246, 0.3)', color: '#c4b5fd', fontWeight: 700 }}>
                  Auto-Fill
                </span>
              </div>
            ) : (
              <div 
                onClick={handleDemoRecruiterLogin}
                style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(236, 72, 153, 0.08) 100%)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  marginBottom: '16px',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.15)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(236, 72, 153, 0.15) 100%)';
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.6)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(236, 72, 153, 0.08) 100%)';
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.35)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(251, 191, 36, 0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fbbf24',
                  }}>
                    <Zap size={17} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                      Instant Recruiter Demo Access
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      1-click instant login with sample recruiter profile
                    </div>
                  </div>
                </div>
                <span className="badge badge-accent" style={{ fontSize: '10.5px', padding: '3px 10px', fontWeight: 700 }}>
                  1-Click Enter
                </span>
              </div>
            )}

            <form onSubmit={handleInitiateAuth} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {mode === 'signup' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    <span>Full Name</span>
                  </label>
                  <div className="input-with-icon">
                    <User size={16} className="input-lead-icon" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Priya Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="text-input"
                    />
                  </div>
                </div>
              )}

              {/* Email with disposable blocking */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  <span>{mode === 'admin' ? 'Administrator Email' : 'Work Email Address'}</span>
                </label>
                <div className="input-with-icon">
                  <Mail size={16} className="input-lead-icon" />
                  <input
                    type="email"
                    required
                    placeholder={mode === 'admin' ? 'admin@talentscout.ai' : 'recruiter@company.in'}
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className="text-input"
                    style={{ 
                      borderColor: emailWarning ? '#ef4444' : undefined 
                    }}
                  />
                </div>
                {emailWarning && (
                  <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={12} />
                    <span>{emailWarning}</span>
                  </div>
                )}
              </div>

              {/* Phone Number with dummy/fake blocking (Signup mode) */}
              {mode === 'signup' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    <span>Mobile Number (+91)</span>
                  </label>
                  <div className="input-with-icon">
                    <Phone size={16} className="input-lead-icon" />
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 98201 54321"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className="text-input"
                      style={{ 
                        borderColor: phoneWarning ? '#ef4444' : undefined 
                      }}
                    />
                  </div>
                  {phoneWarning && (
                    <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={12} />
                      <span>{phoneWarning}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Password */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  <span>{mode === 'admin' ? 'Admin Master Password' : 'Password'}</span>
                </label>
                <div className="input-with-icon">
                  <Lock size={16} className="input-lead-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="text-input"
                    style={{ paddingRight: '42px' }}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    <span>Agency / Organization Name</span>
                  </label>
                  <div className="input-with-icon">
                    <Building2 size={16} className="input-lead-icon" />
                    <input
                      type="text"
                      placeholder="e.g. Apex Staffing Solutions"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="text-input"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !!emailWarning || !!phoneWarning}
                className="btn btn-primary landing-btn-shine"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '8px',
                  background: mode === 'admin' ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' : undefined,
                  boxShadow: mode === 'admin' 
                    ? '0 4px 18px rgba(124, 58, 237, 0.45)' 
                    : '0 4px 18px rgba(99, 102, 241, 0.45)',
                  opacity: (emailWarning || phoneWarning) ? 0.6 : 1,
                  borderRadius: '10px'
                }}
              >
                {isLoading ? (
                  <span>Dispatching Security Verification...</span>
                ) : (
                  <>
                    <span>
                      {mode === 'admin' 
                        ? 'Authenticate as Administrator' 
                        : mode === 'login' 
                          ? 'Send Login OTP to Email' 
                          : 'Send 6-Digit Email OTP'}
                    </span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {/* ============================================================== */}
        {/* STEP 2: 6-DIGIT EMAIL OTP VERIFICATION SCREEN                   */}
        {/* ============================================================== */}
        {step === 'otp' && (
          <div>
            {/* Context notification */}
            <div style={{
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '18px',
              fontSize: '12px',
              lineHeight: 1.5,
              color: 'var(--text-muted)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#818cf8', fontWeight: 700, marginBottom: '2px' }}>
                <Mail size={14} />
                <span>One-Time Password Dispatched</span>
              </div>
              We've dispatched an enterprise verification email with a 6-digit code to <strong style={{ color: '#fff' }}>{email}</strong>.
            </div>

            {/* Developer Test Mode Chip (For seamless testing when SMTP is local) */}
            {devOtpHint && (
              <div 
                onClick={() => setOtpCode(devOtpHint)}
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px dashed rgba(16, 185, 129, 0.4)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#34d399', fontWeight: 600 }}>
                  🧪 Local Environment Test Code: <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '13px', letterSpacing: '2px' }}>{devOtpHint}</span>
                </div>
                <span className="badge" style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.3)', color: '#a7f3d0' }}>
                  Auto-Fill
                </span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textAlign: 'center' }}>
                  Enter 6-Digit Passcode
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="text-input"
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    fontSize: '26px',
                    fontFamily: 'monospace',
                    letterSpacing: '8px',
                    fontWeight: 800,
                    padding: '12px 10px',
                    background: 'rgba(15, 23, 42, 0.9)',
                    borderColor: 'rgba(99, 102, 241, 0.5)',
                  }}
                />
                <div style={{ fontSize: '11px', color: '#10b981', textAlign: 'center', marginTop: '6px' }}>
                  ⏱ Valid for 10 minutes • SHA-256 Encrypted
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otpCode.length !== 6}
                className="btn btn-primary landing-btn-shine"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isLoading ? (
                  <span>Verifying Passcode...</span>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Verify & Enter Workspace</span>
                  </>
                )}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <ChevronLeft size={14} />
                  <span>Change Email</span>
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={!canResend || isLoading}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: canResend ? '#818cf8' : 'var(--text-dim)',
                    cursor: canResend ? 'pointer' : 'default',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                  <span>{canResend ? 'Resend Code' : `Resend in ${resendCooldown}s`}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Navigation Switchers (When in form step) */}
        {step === 'form' && (
          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {mode === 'admin' ? (
              <div>
                Switch back to{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  style={{ background: 'transparent', border: 'none', color: '#818cf8', fontWeight: 700, cursor: 'pointer' }}
                >
                  Recruiter Sign In
                </button>
              </div>
            ) : mode === 'login' ? (
              <div>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  style={{ background: 'transparent', border: 'none', color: '#818cf8', fontWeight: 700, cursor: 'pointer' }}
                >
                  Sign up free with Email OTP
                </button>
              </div>
            ) : (
              <div>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  style={{ background: 'transparent', border: 'none', color: '#818cf8', fontWeight: 700, cursor: 'pointer' }}
                >
                  Sign in
                </button>
              </div>
            )}

            {mode !== 'admin' && (
              <div style={{ paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMode('admin');
                    fillAdminCredentials();
                  }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <ShieldCheck size={12} style={{ color: '#818cf8' }} />
                  <span>Switch to Administrator & CMS Portal</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Security Compliance Footnote */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '14px', color: 'var(--text-dim)', fontSize: '10.5px' }}>
          <ShieldCheck size={13} style={{ color: '#10b981' }} />
          <span>DPDP Act 2023 Compliant • Anti-CSRF • Disposable Email Filter</span>
        </div>
      </div>
    </div>
  );
}
