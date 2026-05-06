import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h1 style={{ color: '#dc2626' }}>Something went wrong</h1>
          <p style={{ color: '#475569', marginBottom: '1rem' }}>
            An unexpected error occurred in the audit platform.
          </p>
          <details style={{ marginBottom: '1.5rem', textAlign: 'left', maxWidth: '600px', margin: '0 auto 1.5rem' }}>
            <summary style={{ cursor: 'pointer', color: '#64748b' }}>Error details</summary>
            <pre style={{ fontSize: '0.8rem', background: '#f1f5f9', padding: '1rem', borderRadius: '4px', overflow: 'auto', marginTop: '0.5rem' }}>
              {this.state.error?.message}
            </pre>
          </details>
          <button
            onClick={this.handleReset}
            style={{ padding: '0.5rem 1.5rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
