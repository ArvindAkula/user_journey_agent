import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorReportingService } from '../services/ErrorReportingService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private errorReportingService: ErrorReportingService;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
    this.errorReportingService = new ErrorReportingService();
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Report error to monitoring service
    this.errorReportingService.reportError(error, {
      componentStack: errorInfo.componentStack || undefined,
      errorBoundary: true,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReportIssue = () => {
    const { error, errorInfo } = this.state;
    if (error && errorInfo) {
      this.errorReportingService.reportUserFeedback({
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack || undefined,
        userAction: 'manual_report',
        timestamp: new Date().toISOString()
      });
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="error-boundary">
          <div className="error-boundary__container">
            <div className="error-boundary__icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            
            <h2 className="error-boundary__title">Something went wrong</h2>
            
            <p className="error-boundary__message">
              We're sorry, but something unexpected happened. The error has been reported 
              and we're working to fix it.
            </p>

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
              <button 
                className="error-boundary__button error-boundary__button--primary"
                onClick={this.handleRetry}
              >
                Try Again
              </button>
              
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
                Reload Page
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

            .error-boundary__container {
              max-width: 500px;
              text-align: center;
              background: white;
              padding: 2rem;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }

            .error-boundary__icon {
              color: #dc3545;
              margin-bottom: 1rem;
            }

            .error-boundary__title {
              color: #212529;
              margin-bottom: 1rem;
              font-size: 1.5rem;
              font-weight: 600;
            }

            .error-boundary__message {
              color: #6c757d;
              margin-bottom: 2rem;
              line-height: 1.5;
            }

            .error-boundary__details {
              text-align: left;
              margin-bottom: 2rem;
              padding: 1rem;
              background-color: #f8f9fa;
              border-radius: 4px;
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
              gap: 0.75rem;
              justify-content: center;
              flex-wrap: wrap;
            }

            .error-boundary__button {
              padding: 0.75rem 1.5rem;
              border: none;
              border-radius: 4px;
              font-size: 0.875rem;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s ease;
            }

            .error-boundary__button--primary {
              background-color: #007bff;
              color: white;
            }

            .error-boundary__button--primary:hover {
              background-color: #0056b3;
            }

            .error-boundary__button--secondary {
              background-color: #6c757d;
              color: white;
            }

            .error-boundary__button--secondary:hover {
              background-color: #545b62;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;