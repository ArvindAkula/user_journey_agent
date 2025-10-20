// Extend Window interface for Sentry
declare global {
  interface Window {
    Sentry?: any;
  }
}

interface ErrorContext {
  componentStack?: string;
  errorBoundary?: boolean;
  level?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId?: string;
  buildVersion?: string;
  environment?: string;
  [key: string]: any;
}

interface UserFeedback {
  errorId?: string;
  error: string;
  stack?: string;
  componentStack?: string;
  userAction: string;
  timestamp: string;
  userDescription?: string;
}

interface PerformanceMetrics {
  loadTime?: number;
  renderTime?: number;
  memoryUsage?: number;
  networkLatency?: number;
  timestamp: string;
}

export class ErrorReportingService {
  private apiEndpoint: string;
  private apiKey: string;
  private isProduction: boolean;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  private isEnabled: boolean;

  constructor() {
    this.apiEndpoint = '';  // Use empty string for relative URLs
    this.apiKey = process.env.REACT_APP_ERROR_REPORTING_API_KEY || '';
    this.isProduction = process.env.REACT_APP_ENVIRONMENT === 'production';
    
    // Check if error reporting is enabled
    this.isEnabled = !(
      process.env.REACT_APP_ENVIRONMENT === 'development' || 
      process.env.REACT_APP_ENABLE_ERROR_REPORTING === 'false' ||
      localStorage.getItem('disable_error_reporting') === 'true'
    );

    if (!this.isEnabled) {
      console.log('ErrorReportingService disabled');
      return;
    }

    // Initialize error tracking
    this.initializeErrorTracking();
  }

  private initializeErrorTracking() {
    // Global error handler for unhandled errors
    window.addEventListener('error', (event) => {
      this.reportError(event.error || new Error(event.message), {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        type: 'unhandled_error'
      });
    });

    // Global handler for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError(new Error(event.reason), {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        type: 'unhandled_promise_rejection'
      });
    });

    // Performance monitoring disabled for demo mode
  }

  private initializePerformanceMonitoring() {
    // Monitor page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (perfData) {
          this.reportPerformanceMetrics({
            loadTime: perfData.loadEventEnd - perfData.loadEventStart,
            renderTime: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
            networkLatency: perfData.responseEnd - perfData.requestStart,
            timestamp: new Date().toISOString()
          });
        }
      }, 0);
    });

    // Monitor memory usage (if available)
    if ('memory' in performance) {
      setInterval(() => {
        const memInfo = (performance as any).memory;
        if (memInfo && memInfo.usedJSHeapSize > 50 * 1024 * 1024) { // Report if > 50MB
          this.reportPerformanceMetrics({
            memoryUsage: memInfo.usedJSHeapSize,
            timestamp: new Date().toISOString()
          });
        }
      }, 30000); // Check every 30 seconds
    }
  }

  async reportError(error: Error, context: ErrorContext): Promise<void> {
    // Skip if disabled
    if (!this.isEnabled) {
      return;
    }
    
    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        context: {
          ...context,
          userId: context.userId || this.getUserId(),
          sessionId: context.sessionId || this.getSessionId(),
          buildVersion: context.buildVersion || process.env.REACT_APP_VERSION,
          environment: context.environment || process.env.REACT_APP_ENVIRONMENT
        },
        timestamp: context.timestamp || new Date().toISOString(),
        severity: this.determineSeverity(error, context)
      };

      // Send to backend API
      await this.sendToAPI('/api/errors', errorData);

      // Send to external monitoring service if configured
      if (this.isProduction && process.env.REACT_APP_SENTRY_DSN) {
        this.sendToSentry(errorData);
      }

      // Log locally for development
      if (!this.isProduction) {
        console.error('Error reported:', errorData);
      }

    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
      // Store locally for retry
      this.storeErrorLocally(error, context);
    }
  }

  async reportUserFeedback(feedback: UserFeedback): Promise<void> {
    // Skip if disabled
    if (!this.isEnabled) {
      return;
    }
    
    try {
      const feedbackData = {
        ...feedback,
        userId: this.getUserId(),
        sessionId: this.getSessionId(),
        url: window.location.href,
        userAgent: navigator.userAgent
      };

      await this.sendToAPI('/api/errors/feedback', feedbackData);
    } catch (error) {
      console.error('Failed to report user feedback:', error);
    }
  }

  async reportPerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
    // Skip if disabled
    if (!this.isEnabled) {
      return;
    }
    
    try {
      const performanceData = {
        ...metrics,
        userId: this.getUserId(),
        sessionId: this.getSessionId(),
        url: window.location.href,
        userAgent: navigator.userAgent
      };

      await this.sendToAPI('/api/performance', performanceData);
    } catch (error) {
      console.error('Failed to report performance metrics:', error);
    }
  }

  private async sendToAPI(endpoint: string, data: any, retryCount: number = 0): Promise<void> {
    const fullUrl = `${this.apiEndpoint}${endpoint}`;
    console.log(`[ErrorReportingService] Making request to: ${fullUrl}`);
    console.log(`[ErrorReportingService] apiEndpoint: "${this.apiEndpoint}", endpoint: "${endpoint}"`);
    console.log(`[ErrorReportingService] Request data:`, data);
    
    try {
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify(data)
      });

      console.log(`[ErrorReportingService] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      if (retryCount < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));
        return this.sendToAPI(endpoint, data, retryCount + 1);
      }
      throw error;
    }
  }

  private sendToSentry(errorData: any): void {
    // Integration with Sentry or other external monitoring service
    if (window.Sentry) {
      window.Sentry.captureException(new Error(errorData.message), {
        extra: errorData.context,
        tags: {
          environment: errorData.context.environment,
          buildVersion: errorData.context.buildVersion
        }
      });
    }
  }

  private storeErrorLocally(error: Error, context: ErrorContext): void {
    try {
      const storedErrors = JSON.parse(localStorage.getItem('pending_errors') || '[]');
      storedErrors.push({
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        context,
        timestamp: new Date().toISOString()
      });

      // Keep only last 10 errors
      if (storedErrors.length > 10) {
        storedErrors.splice(0, storedErrors.length - 10);
      }

      localStorage.setItem('pending_errors', JSON.stringify(storedErrors));
    } catch (storageError) {
      console.error('Failed to store error locally:', storageError);
    }
  }

  async retryPendingErrors(): Promise<void> {
    // Skip if disabled
    if (!this.isEnabled) {
      return;
    }
    
    try {
      const storedErrors = JSON.parse(localStorage.getItem('pending_errors') || '[]');
      if (storedErrors.length === 0) return;

      for (const storedError of storedErrors) {
        try {
          await this.reportError(
            new Error(storedError.error.message),
            storedError.context
          );
        } catch (error) {
          console.error('Failed to retry error reporting:', error);
        }
      }

      // Clear stored errors after successful retry
      localStorage.removeItem('pending_errors');
    } catch (error) {
      console.error('Failed to retry pending errors:', error);
    }
  }

  private determineSeverity(error: Error, context: ErrorContext): 'low' | 'medium' | 'high' | 'critical' {
    // App-level errors are critical
    if (context.level === 'app') return 'critical';

    // Page-level errors are high
    if (context.level === 'page') return 'high';

    // Network errors are medium
    if (error.message.includes('fetch') || error.message.includes('network')) return 'medium';

    // Component errors are medium by default
    return 'medium';
  }

  private getUserId(): string | undefined {
    try {
      const authData = localStorage.getItem('auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.userId || parsed.uid;
      }
    } catch {
      // Ignore errors
    }
    return undefined;
  }

  private getSessionId(): string | undefined {
    try {
      return sessionStorage.getItem('sessionId') || undefined;
    } catch {
      return undefined;
    }
  }
}

// Global error reporting service instance
export const errorReportingService = new ErrorReportingService();

// Auto-retry pending errors on app start
setTimeout(() => {
  errorReportingService.retryPendingErrors();
}, 5000);