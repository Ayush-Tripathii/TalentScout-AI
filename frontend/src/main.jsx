import React, { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('TalentScout Uncaught Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#07090e',
          color: '#f8fafc',
          padding: '24px',
          fontFamily: 'sans-serif'
        }}>
          <div style={{
            maxWidth: '600px',
            background: '#0f172a',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '16px',
            padding: '28px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
          }}>
            <h2 style={{ color: '#ef4444', margin: '0 0 10px', fontSize: '18px' }}>
              Application Error Detected
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.5, margin: '0 0 16px' }}>
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <pre style={{
              background: 'rgba(0, 0, 0, 0.5)',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#f87171',
              maxHeight: '160px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              marginBottom: '16px'
            }}>
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Reload TalentScout
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
