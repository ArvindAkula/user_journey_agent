import React from 'react';

interface UserFriendlyErrorProps {
  error?: Error | string;
  title?: string;
  message?: string;
  showRetry?: boolean;
  showReload?: boolean;
  showReport?: boolean;
  onRetry?: () => void;
  onReport?: () => void;
  className?: string;
}

const ERROR_MESSAGES: Record<string, { title: string; message: string; suggestions: string[] }> = {
  // Network errors
  'NetworkError': {
    title: 'Connection Problem',
    message: 'We\'re having trouble connecting to our servers.',
    suggestions: [
      'Check your internet connection',
      'Try refreshing the page',
      'Wait a moment and try again'
    ]
  },
  'TimeoutError': {
    title: 'Request Timed Out',
    message: 'The request is taking longer than expected.',
    suggestions: [
      'Check your internet connection',
      'Try again in a few moments',
      'Contact support if the problem persists'
    ]
  },
  
  // Authentication errors
  'AuthenticationError': {
    title: 'Authentication Required',
    message: 'You need to log in to access this feature.',
    suggestions: [
      'Please log in to your account',
      'Check if your session has expired',
      'Clear your browser cache and try again'
    ]
  },
  'AuthorizationError': {
    title: 'Access Denied',
    message: 'You don\'t have permission to access this feature.',
    suggestions: [
      'Contact your administrator for access',
      'Make sure you\'re logged in with the correct account',
      'Check if your permissions have changed'
    ]
  },
  
  // Data errors
  'ValidationError': {
    title: 'Invalid Data',
    message: 'The information provided doesn\'t meet our requirements.',
    suggestions: [
      'Check all required fields are filled',
      'Verify the format of your input',
      'Review any error messages shown'
    ]
  },
  'NotFoundError': {
    title: 'Content Not Found',
    message: 'The requested content could not be found.',
    suggestions: [
      'Check the URL for typos',
      'Go back and try a different link',
      'The content may have been moved or deleted'
    ]
  },
  
  // Server errors
  'ServerError': {
    title: 'Server Problem',
    message: 'Our servers are experiencing issues.',
    suggestions: [
      'Try again in a few minutes',
      'Check our status page for updates',
      'Contact support if the problem continues'
    ]
  },
  'MaintenanceError': {
    title: 'Maintenance Mode',
    message: 'We\'re currently performing maintenance.',
    suggestions: [
      'Please try again later',
      'Follow our social media for updates',
      'Maintenance should complete soon'
    ]
  },
  
  // Default fallback
  'default': {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred.',
    suggestions: [
      'Try refreshing the page',
      'Clear your browser cache',
      'Contact support if the problem persists'
    ]
  }
};

export const UserFriendlyError: React.FC<UserFriendlyErrorProps> = ({
  error,
  title,
  message,
  showRetry = true,
  showReload = true,
  showReport = true,
  onRetry,
  onReport,
  className = ''
}) => {
  const getErrorInfo = () => {
    if (title && message) {
      return { title, message, suggestions: [] };
    }

    const errorMessage = error instanceof Error ? error.message : String(error || '');
    const errorName = error instanceof Error ? error.name : 'default';
    
    // Try to match error by name first, then by message content
    let errorInfo = ERROR_MESSAGES[errorName];
    
    if (!errorInfo) {
      // Check message content for known patterns
      const lowerMessage = errorMessage.toLowerCase();
      
      if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
        errorInfo = ERROR_MESSAGES['NetworkError'];
      } else if (lowerMessage.includes('timeout')) {
        errorInfo = ERROR_MESSAGES['TimeoutError'];
      } else if (lowerMessage.includes('unauthorized') || lowerMessage.includes('401')) {
        errorInfo = ERROR_MESSAGES['AuthenticationError'];
      } else if (lowerMessage.includes('forbidden') || lowerMessage.includes('403')) {
        errorInfo = ERROR_MESSAGES['AuthorizationError'];
      } else if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
        errorInfo = ERROR_MESSAGES['NotFoundError'];
      } else if (lowerMessage.includes('server') || lowerMessage.includes('500')) {
        errorInfo = ERROR_MESSAGES['ServerError'];
      } else {
        errorInfo = ERROR_MESSAGES['default'];
      }
    }

    return errorInfo;
  };

  const errorInfo = getErrorInfo();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  const handleReport = () => {
    if (onReport) {
      onReport();
    } else {
      // Default reporting behavior
      const errorDetails = error instanceof Error ? 
        `${error.name}: ${error.message}\n\nStack: ${error.stack}` : 
        String(error);
      
      const subject = encodeURIComponent(`Error Report: ${errorInfo.title}`);
      const body = encodeURIComponent(
        `I encountered an error while using the application.\n\n` +
        `Error Details:\n${errorDetails}\n\n` +
        `Page: ${window.location.href}\n` +
        `Time: ${new Date().toISOString()}\n\n` +
        `Please describe what you were doing when this error occurred:`
      );
      
      window.open(`mailto:support@example.com?subject=${subject}&body=${body}`);
    }
  };

  return (
    <div className={`user-friendly-error ${className}`}>
      <div className="user-friendly-error__container">
        <div className="user-friendly-error__icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        
        <h3 className="user-friendly-error__title">{errorInfo.title}</h3>
        
        <p className="user-friendly-error__message">{errorInfo.message}</p>
        
        {errorInfo.suggestions.length > 0 && (
          <div className="user-friendly-error__suggestions">
            <h4>What you can try:</h4>
            <ul>
              {errorInfo.suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="user-friendly-error__actions">
          {showRetry && (
            <button 
              className="user-friendly-error__button user-friendly-error__button--primary"
              onClick={handleRetry}
            >
              Try Again
            </button>
          )}
          
          {showReload && (
            <button 
              className="user-friendly-error__button user-friendly-error__button--secondary"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          )}
          
          {showReport && (
            <button 
              className="user-friendly-error__button user-friendly-error__button--secondary"
              onClick={handleReport}
            >
              Report Issue
            </button>
          )}
        </div>
      </div>

      <style>{`
        .user-friendly-error {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          min-height: 300px;
        }

        .user-friendly-error__container {
          max-width: 500px;
          text-align: center;
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          border: 1px solid #e9ecef;
        }

        .user-friendly-error__icon {
          color: #ffc107;
          margin-bottom: 1rem;
        }

        .user-friendly-error__title {
          color: #212529;
          margin-bottom: 0.75rem;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .user-friendly-error__message {
          color: #6c757d;
          margin-bottom: 1.5rem;
          line-height: 1.5;
        }

        .user-friendly-error__suggestions {
          text-align: left;
          margin-bottom: 2rem;
          padding: 1rem;
          background-color: #f8f9fa;
          border-radius: 4px;
          border-left: 4px solid #17a2b8;
        }

        .user-friendly-error__suggestions h4 {
          margin: 0 0 0.75rem 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: #495057;
        }

        .user-friendly-error__suggestions ul {
          margin: 0;
          padding-left: 1.25rem;
        }

        .user-friendly-error__suggestions li {
          margin-bottom: 0.5rem;
          color: #6c757d;
          font-size: 0.875rem;
          line-height: 1.4;
        }

        .user-friendly-error__suggestions li:last-child {
          margin-bottom: 0;
        }

        .user-friendly-error__actions {
          display: flex;
          gap: 0.75rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .user-friendly-error__button {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 4px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          display: inline-block;
        }

        .user-friendly-error__button--primary {
          background-color: #007bff;
          color: white;
        }

        .user-friendly-error__button--primary:hover {
          background-color: #0056b3;
        }

        .user-friendly-error__button--secondary {
          background-color: #6c757d;
          color: white;
        }

        .user-friendly-error__button--secondary:hover {
          background-color: #545b62;
        }

        .user-friendly-error__button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default UserFriendlyError;