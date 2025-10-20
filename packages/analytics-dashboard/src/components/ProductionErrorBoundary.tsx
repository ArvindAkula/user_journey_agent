import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorReportingService } from '../services/ErrorReportingService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'app';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ProductionErrorBoundary extends Component<Props, State> {
  private errorReportingService: ErrorReportingService;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
    this.errorReportingService = new ErrorReportingService();
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Enhanced error reporting for production
    const errorContext = {
      componentStack: errorInfo.componentStack || undefined,
      errorBoundary: true,
      level: this.props.level || 'component',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
      buildVersion: process.env.REACT_APP_VERSION || 'unknown',
      environment: process.env.REACT_APP_ENVIRONMENT || 'production',
      dashboardContext: {
        currentRoute: window.location.pathname,
        isAuthenticated: this.isAuthenticated()
      }
    };

    // Report error to monitoring service
    this.errorReportingService.reportError(error, errorContext);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ProductionErrorBoundary caught an error:', error, errorInfo);
    }
  }

  private getUserId(): string | undefined {
    try {
      // Try to get user ID from various sources
      const authData = localStorage.getItem('analytics_auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.userId || parsed.uid;
      }
    } catch {
      // Ignore errors when getting user ID
    }
    return undefined;
  }

  private getSessionId(): string | undefined {
    try {
      return sessionStorage.getItem('analytics_sessionId') || undefined;
    } catch {
      return undefined;
    }
  }

  private isAuthenticated(): boolean {
    try {
      const authData = localStorage.getItem('analytics_auth');
      return !!authData;
    } catch {
      return false;
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  handleReportIssue = () => {
    const { error, errorInfo, errorId } = this.state;
    if (error && errorInfo && errorId) {
      this.errorReportingService.reportUserFeedback({
        errorId,
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack || undefined,
        userAction: 'manual_report',
        timestamp: new Date().toISOString(),
        userDescription: 'Analytics dashboard user manually reported this error'
      });
      
      // Show confirmation to user
      alert('Thank you for reporting this issue. Our team will investigate and fix it soon.');
    }
  };

  handleGoToDashboard = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Different UI based on error level
      const isAppLevel = this.props.level === 'app';
      const isPageLevel = this.props.level === 'page';

      return (
        <div className={`error-boundary ${isAppLevel ? 'error-boundary--app' : ''}`}>
          <div className="error-boundary__container">
            <div className="error-boundary__icon">
              <svg width={isAppLevel ? "80" : "64"} height={isAppLevel ? "80" : "64"} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            
            <h2 className="error-boundary__title">
              {isAppLevel ? 'Dashboard Error' : isPageLevel ? 'Page Error' : 'Component Error'}
            </h2>
            
            <p className="error-boundary__message">
              {isAppLevel 
                ? 'The analytics dashboard encountered an unexpected error. Please try refreshing the page.'
                : isPageLevel
                ? 'This page encountered an error. You can try again or navigate to the main dashboard.'
                : 'This component encountered an error, but the rest of the dashboard should work normally.'
              }
            </p>

            {this.state.errorId && (
              <p className="error-boundary__error-id">
                Error ID: <code>{this.state.errorId}</code>
              </p>
            )}

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-boundary__details">
                <summary>Error Details (Development Only)</summary>
                <pre className="error-boundary__stack">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                  {this.state.errorInfo?.componentStack && (
                    <>
                      {'\n\nComponent Stack:'}
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </details>
            )}

            <div className="error-boundary__actions">
              {!isAppLevel && (
                <button 
                  className="error-boundary__button error-boundary__button--primary"
                  onClick={this.handleRetry}
                >
                  Try Again
                </button>
              )}
              
              {(isPageLevel || isAppLevel) && (
                <button 
                  className="error-boundary__button error-boundary__button--primary"
                  onClick={this.handleGoToDashboard}
                >
                  Go to Dashboard
                </button>
              )}
              
              <button 
                className="error-boundary__button error-boundary__button--secondary"
                onClick={this.handleReportIssue}
              >
                Report Issue
              </button>
              
              <button 
                className="error-boundary__button error-boundary__button--secondary"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </button>
            </div>
          </div>

          <style>{`
            .error-boundary {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 400px;
              padding: 2rem;
              background-color: #f8f9fa;
            }

            .error-boundary--app {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              z-index: 10000;
              min-height: 100vh;
            }

            .error-boundary__container {
              max-width: 600px;
              text-align: center;
              background: white;
              padding: 2.5rem;
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
              border: 1px solid #e9ecef;
            }

            .error-boundary__icon {
              color: #dc3545;
              margin-bottom: 1.5rem;
            }

            .error-boundary__title {
              color: #212529;
              margin-bottom: 1rem;
              font-size: 1.75rem;
              font-weight: 600;
            }

            .error-boundary__message {
              color: #6c757d;
              margin-bottom: 1.5rem;
              line-height: 1.6;
              font-size: 1rem;
            }

            .error-boundary__error-id {
              color: #495057;
              font-size: 0.875rem;
              margin-bottom: 2rem;
              padding: 0.75rem;
              background-color: #f8f9fa;
              border-radius: 6px;
              border: 1px solid #dee2e6;
            }

            .error-boundary__error-id code {
              font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
              font-weight: 600;
              color: #e83e8c;
            }

            .error-boundary__details {
              text-align: left;
              margin-bottom: 2rem;
              padding: 1rem;
              background-color: #f8f9fa;
              border-radius: 6px;
              border: 1px solid #dee2e6;
            }

            .error-boundary__stack {
              font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
              font-size: 0.875rem;
              white-space: pre-wrap;
              word-break: break-word;
              margin: 0.5rem 0 0 0;
              color: #495057;
            }

            .error-boundary__actions {
              display: flex;
              gap: 1rem;
              justify-content: center;
              flex-wrap: wrap;
            }

            .error-boundary__button {
              padding: 0.875rem 1.75rem;
              border: none;
              border-radius: 6px;
              font-size: 0.875rem;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s ease;
              min-width: 120px;
            }

            .error-boundary__button--primary {
              background-color: #007bff;
              color: white;
            }

            .error-boundary__button--primary:hover {
              background-color: #0056b3;
              transform: translateY(-1px);
            }

            .error-boundary__button--secondary {
              background-color: #6c757d;
              color: white;
            }

            .error-boundary__button--secondary:hover {
              background-color: #545b62;
              transform: translateY(-1px);
            }

            @media (max-width: 768px) {
              .error-boundary__container {
                padding: 1.5rem;
                margin: 1rem;
              }
              
              .error-boundary__actions {
                flex-direction: column;
              }
              
              .error-boundary__button {
                width: 100%;
              }
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ProductionErrorBoundary;