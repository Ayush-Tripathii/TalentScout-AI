import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '14px 20px',
      background: isError ? 'rgba(30, 10, 15, 0.95)' : isSuccess ? 'rgba(6, 30, 20, 0.95)' : 'rgba(15, 23, 42, 0.95)',
      border: `1px solid ${isError ? 'rgba(239, 68, 68, 0.4)' : isSuccess ? 'rgba(16, 185, 129, 0.4)' : 'rgba(99, 102, 241, 0.4)'}`,
      borderRadius: '12px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.2)',
      backdropFilter: 'blur(16px)',
      color: '#fff',
      fontSize: '13px',
      fontWeight: 500,
      maxWidth: '420px',
      animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      {isSuccess && <CheckCircle2 size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />}
      {isError && <AlertCircle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
      {!isSuccess && !isError && <Info size={18} style={{ color: 'var(--info)', flexShrink: 0 }} />}

      <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>

      <button 
        onClick={onClose} 
        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
