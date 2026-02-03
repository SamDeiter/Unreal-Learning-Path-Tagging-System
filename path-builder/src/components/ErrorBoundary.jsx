import { Component } from 'react';

/**
 * Error Boundary Component
 * Catches JavaScript errors in child components and displays fallback UI
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Log error for debugging
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-content">
            <h2>⚠️ Something went wrong</h2>
            <p>This section encountered an error and couldn't load properly.</p>
            
            {this.props.showDetails && this.state.error && (
              <details className="error-details">
                <summary>Error Details</summary>
                <pre>{this.state.error.toString()}</pre>
                {this.state.errorInfo && (
                  <pre>{this.state.errorInfo.componentStack}</pre>
                )}
              </details>
            )}
            
            <div className="error-actions">
              <button onClick={this.handleRetry} className="btn btn-primary">
                Try Again
              </button>
              <button onClick={this.handleReload} className="btn btn-secondary">
                Reload Page
              </button>
            </div>
          </div>
          
          <style>{`
            .error-boundary {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 200px;
              padding: 2rem;
              background: #161b22;
              border: 1px solid #f85149;
              border-radius: 8px;
              margin: 1rem;
            }
            .error-content {
              text-align: center;
              max-width: 500px;
            }
            .error-content h2 {
              color: #f85149;
              margin-bottom: 0.5rem;
            }
            .error-content p {
              color: #8b949e;
              margin-bottom: 1rem;
            }
            .error-details {
              text-align: left;
              margin: 1rem 0;
              padding: 1rem;
              background: #0d1117;
              border-radius: 6px;
            }
            .error-details summary {
              cursor: pointer;
              color: #8b949e;
            }
            .error-details pre {
              font-size: 0.75rem;
              overflow-x: auto;
              color: #f85149;
            }
            .error-actions {
              display: flex;
              gap: 0.5rem;
              justify-content: center;
            }
            .error-actions button {
              padding: 0.5rem 1rem;
              border-radius: 6px;
              cursor: pointer;
              font-size: 0.9rem;
            }
            .error-actions .btn-primary {
              background: #238636;
              border: none;
              color: #fff;
            }
            .error-actions .btn-secondary {
              background: transparent;
              border: 1px solid #30363d;
              color: #c9d1d9;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
