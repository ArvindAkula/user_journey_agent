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
  dashboardContext?: {
    currentRoute?: string;
    isAuthenticated?: boolean;
  };
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
  chartRenderTime?: number;
  dataFetchTime?: number;
  timestamp: string;
}

export class ErrorReportingService {
  private apiEndpoint: string;
  private apiKey: string;
  private isProduction: boolean;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor() {
    this.apiEndpoint = process.env.REACT_APP_ERROR_REPORTING_ENDPOINT || 'http://localhost:8080/api';
    this.apiKey = process.env.REACT_APP_ERROR_REPORTING_API_KEY || '';
    this.isProduction = process.env.REACT_APP_ENVIRONMENT === 'production';

    // Only initialize error tracking if error reporting is enabled
    if (process.env.REACT_APP_ENABLE_ERROR_REPORTING === 'true') {
      this.initializeErrorTracking();
    } else {
      console.log('Error reporting disabled - skipping initialization');
    }
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
        type: 'unhandled_error',
        dashboardContext: {
          currentRoute: window.location.pathname,
          isAuthenticated: this.isAuthenticated()
        }
      });
    });

    // Global handler for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError(new Error(event.reason), {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        type: 'unhandled_promise_rejection',
        dashboardContext: {
          currentRoute: window.location.pathname,
          isAuthenticated: this.isAuthenticated()
        }
      });
    });

    // Performance monitoring for dashboard-specific metrics
    if ('performance' in window) {
      this.initializePerformanceMonitoring();
    }

    // Monitor dashboard-specific events
    this.initializeDashboardMonitoring();
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

    // Monitor memory usage (critical for dashboard with charts)
    if ('memory' in performance) {
      setInterval(() => {
        const memInfo = (performance as any).memory;
        if (memInfo && memInfo.usedJSHeapSize > 100 * 1024 * 1024) { // Report if > 100MB (higher threshold for dashboard)
          this.reportPerformanceMetrics({
            memoryUsage: memInfo.usedJSHeapSize,
            timestamp: new Date().toISOString()
          });
        }
      }, 60000); // Check every minute
    }
  }

  private initializeDashboardMonitoring() {
    // Monitor chart rendering performance
    const originalConsoleTime = console.time;
    const originalConsoleTimeEnd = console.timeEnd;

    let chartRenderStart: number | null = null;

    console.time = function (label: string) {
      if (label.includes('chart') || label.includes('render')) {
        chartRenderStart = performance.now();
      }
      return originalConsoleTime.call(console, label);
    };

    console.timeEnd = function (label: string) {
      if ((label.includes('chart') || label.includes('render')) && chartRenderStart) {
        const renderTime = performance.now() - chartRenderStart;
        if (renderTime > 1000) { // Report slow chart renders (> 1s)
          errorReportingService.reportPerformanceMetrics({
            chartRenderTime: renderTime,
            timestamp: new Date().toISOString()
          });
        }
        chartRenderStart = null;
      }
      return originalConsoleTimeEnd.call(console, label);
    };

    // Monitor data fetch performance
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const start = performance.now();
      try {
        const response = await originalFetch.apply(this, args);
        const fetchTime = performance.now() - start;

        // Report slow API calls (> 5s)
        if (fetchTime > 5000) {
          errorReportingService.reportPerformanceMetrics({
            dataFetchTime: fetchTime,
            timestamp: new Date().toISOString()
          });
        }

        return response;
      } catch (error) {
        const fetchTime = performance.now() - start;
        errorReportingService.reportError(error as Error, {
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          type: 'fetch_error',
          fetchTime,
          dashboardContext: {
            currentRoute: window.location.pathname,
            isAuthenticated: errorReportingService.isAuthenticated()
          }
        });
        throw error;
      }
    };
  }

  async reportError(error: Error, context: ErrorContext): Promise<void> {
    // Skip error reporting if disabled
    if (process.env.REACT_APP_ENABLE_ERROR_REPORTING !== 'true') {
      console.log('Error reporting disabled - skipping error report');
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
          environment: context.environment || process.env.REACT_APP_ENVIRONMENT,
          application: 'analytics-dashboard'
        },
        timestamp: context.timestamp || new Date().toISOString(),
        severity: this.determineSeverity(error, context)
      };

      // Send to backend API
      await this.sendToAPI('/errors', errorData);

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
    try {
      const feedbackData = {
        ...feedback,
        userId: this.getUserId(),
        sessionId: this.getSessionId(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        application: 'analytics-dashboard'
      };

      await this.sendToAPI('/errors/feedback', feedbackData);
    } catch (error) {
      console.error('Failed to report user feedback:', error);
    }
  }

  async reportPerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
    // Skip performance monitoring if disabled
    if (process.env.REACT_APP_ENABLE_PERFORMANCE_MONITORING !== 'true') {
      console.log('Performance monitoring disabled - skipping metrics report');
      return;
    }
    
    try {
      const performanceData = {
        ...metrics,
        userId: this.getUserId(),
        sessionId: this.getSessionId(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        application: 'analytics-dashboard'
      };

      await this.sendToAPI('/monitoring/metrics/summary', performanceData);
    } catch (error) {
      console.error('Failed to report performance metrics:', error);
    }
  }

  private async sendToAPI(endpoint: string, data: any, retryCount: number = 0): Promise<void> {
    // Skip API calls in demo mode
    if (localStorage.getItem('analytics_demo_mode') === 'true') {
      console.log('Demo mode: skipping error reporting API call to', endpoint);
      return;
    }

    try {
      const fullUrl = `${this.apiEndpoint}${endpoint}`;
      console.log('ErrorReportingService making request to:', fullUrl);
      console.log('apiEndpoint:', this.apiEndpoint);
      console.log('endpoint:', endpoint);

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify(data)
      });

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
          buildVersion: errorData.context.buildVersion,
          application: 'analytics-dashboard'
        }
      });
    }
  }

  private storeErrorLocally(error: Error, context: ErrorContext): void {
    try {
      const storedErrors = JSON.parse(localStorage.getItem('analytics_pending_errors') || '[]');
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

      localStorage.setItem('analytics_pending_errors', JSON.stringify(storedErrors));
    } catch (storageError) {
      console.error('Failed to store error locally:', storageError);
    }
  }

  async retryPendingErrors(): Promise<void> {
    try {
      const storedErrors = JSON.parse(localStorage.getItem('analytics_pending_errors') || '[]');
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
      localStorage.removeItem('analytics_pending_errors');
    } catch (error) {
      console.error('Failed to retry pending errors:', error);
    }
  }

  private determineSeverity(error: Error, context: ErrorContext): 'low' | 'medium' | 'high' | 'critical' {
    // App-level errors are critical
    if (context.level === 'app') return 'critical';

    // Page-level errors are high
    if (context.level === 'page') return 'high';

    // Authentication errors are high
    if (error.message.includes('auth') || error.message.includes('token')) return 'high';

    // Data fetch errors are high for dashboard
    if (error.message.includes('fetch') || error.message.includes('network')) return 'high';

    // Chart rendering errors are medium
    if (context.type === 'chart_error') return 'medium';

    // Component errors are medium by default
    return 'medium';
  }

  isAuthenticated(): boolean {
    try {
      const authData = localStorage.getItem('analytics_auth');
      return !!authData;
    } catch {
      return false;
    }
  }

  private getUserId(): string | undefined {
    try {
      const authData = localStorage.getItem('analytics_auth');
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
      return sessionStorage.getItem('analytics_sessionId') || undefined;
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