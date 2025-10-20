interface ErrorContext {
  componentStack?: string;
  errorBoundary?: boolean;
  timestamp: string;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId?: string;
  [key: string]: any;
}

interface UserFeedback {
  error: string;
  stack?: string;
  componentStack?: string;
  userAction: string;
  timestamp: string;
  description?: string;
}

interface ErrorMetrics {
  errorCount: number;
  errorRate: number;
  topErrors: Array<{
    message: string;
    count: number;
    lastOccurred: string;
  }>;
}

export class ErrorReportingService {
  private apiBaseUrl: string;
  private errorQueue: Array<{ error: Error; context: ErrorContext }> = [];
  private isOnline: boolean = navigator.onLine;
  private maxQueueSize: number = 50;

  constructor() {
    this.apiBaseUrl = '';  // Use empty string for relative URLs
    
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // Set up global error handlers
    this.setupGlobalErrorHandlers();
  }

  private setupGlobalErrorHandlers() {
    // Handle unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportError(new Error(event.message), {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError(new Error(`Unhandled Promise Rejection: ${event.reason}`), {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        promiseRejection: true,
        reason: event.reason
      });
    });
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.flushErrorQueue();
  };

  private handleOffline = () => {
    this.isOnline = false;
  };

  public reportError(error: Error, context: ErrorContext): void {
    const errorData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      context: {
        ...context,
        timestamp: context.timestamp || new Date().toISOString(),
        userAgent: context.userAgent || navigator.userAgent,
        url: context.url || window.location.href
      }
    };

    if (this.isOnline) {
      this.sendErrorReport(errorData);
    } else {
      this.queueError(error, context);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error reported:', errorData);
    }
  }

  private async sendErrorReport(errorData: any): Promise<void> {
    try {
      const response = await fetch(`/api/errors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData)
      });

      if (!response.ok) {
        throw new Error(`Failed to report error: ${response.status}`);
      }
    } catch (reportingError) {
      console.error('Failed to send error report:', reportingError);
      // Store in local storage as fallback
      this.storeErrorLocally(errorData);
    }
  }

  private queueError(error: Error, context: ErrorContext): void {
    if (this.errorQueue.length >= this.maxQueueSize) {
      // Remove oldest error to make room
      this.errorQueue.shift();
    }

    this.errorQueue.push({ error, context });
  }

  private async flushErrorQueue(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    for (const { error, context } of errors) {
      await this.sendErrorReport({
        message: error.message,
        stack: error.stack,
        name: error.name,
        context
      });
    }
  }

  private storeErrorLocally(errorData: any): void {
    try {
      const storedErrors = JSON.parse(localStorage.getItem('errorReports') || '[]');
      storedErrors.push(errorData);
      
      // Keep only last 10 errors
      if (storedErrors.length > 10) {
        storedErrors.splice(0, storedErrors.length - 10);
      }
      
      localStorage.setItem('errorReports', JSON.stringify(storedErrors));
    } catch (storageError) {
      console.error('Failed to store error locally:', storageError);
    }
  }

  public async reportUserFeedback(feedback: UserFeedback): Promise<void> {
    try {
      const response = await fetch(`/api/errors/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedback)
      });

      if (!response.ok) {
        throw new Error(`Failed to submit feedback: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to submit user feedback:', error);
    }
  }

  public async getErrorMetrics(timeRange: string = '24h'): Promise<ErrorMetrics> {
    try {
      const response = await fetch(`/api/errors/metrics?timeRange=${timeRange}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch error metrics: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch error metrics:', error);
      return {
        errorCount: 0,
        errorRate: 0,
        topErrors: []
      };
    }
  }

  public reportPerformanceIssue(metric: string, value: number, threshold: number): void {
    if (value > threshold) {
      this.reportError(new Error(`Performance issue: ${metric}`), {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        performanceIssue: true,
        metric,
        value,
        threshold
      });
    }
  }

  public reportApiError(endpoint: string, status: number, message: string): void {
    this.reportError(new Error(`API Error: ${message}`), {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      apiError: true,
      endpoint,
      status,
      message
    });
  }

  public reportUserAction(action: string, context: Record<string, any> = {}): void {
    // This is for tracking user actions that might lead to errors
    try {
      fetch(`/api/analytics/user-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          context,
          timestamp: new Date().toISOString(),
          url: window.location.href
        })
      });
    } catch (error) {
      // Silently fail for user action tracking
      console.debug('Failed to track user action:', error);
    }
  }

  public cleanup(): void {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }
}

export default ErrorReportingService;