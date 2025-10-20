import { ErrorReportingService } from '../services/ErrorReportingService';

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  interactionTime: number;
  memoryUsage?: number;
}

interface MonitoringConfig {
  enablePerformanceMonitoring: boolean;
  enableErrorReporting: boolean;
  performanceThresholds: {
    loadTime: number;
    renderTime: number;
    interactionTime: number;
  };
  sampleRate: number;
}

class MonitoringService {
  private errorReportingService: ErrorReportingService;
  private config: MonitoringConfig;
  private performanceObserver?: PerformanceObserver;
  private startTime: number = Date.now();

  constructor(config: Partial<MonitoringConfig> = {}) {
    // Check if monitoring is disabled via environment variables
    const isMonitoringDisabled = 
      process.env.REACT_APP_ENVIRONMENT === 'development' || 
      process.env.REACT_APP_ENABLE_ERROR_REPORTING === 'false';
    
    this.config = {
      enablePerformanceMonitoring: !isMonitoringDisabled,
      enableErrorReporting: !isMonitoringDisabled,
      performanceThresholds: {
        loadTime: 3000, // 3 seconds
        renderTime: 100, // 100ms
        interactionTime: 50 // 50ms
      },
      sampleRate: 1.0, // 100% sampling
      ...config
    };

    this.errorReportingService = new ErrorReportingService();
    
    if (this.config.enablePerformanceMonitoring) {
      this.initializePerformanceMonitoring();
    }
  }

  private initializePerformanceMonitoring(): void {
    // Monitor Core Web Vitals
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.handlePerformanceEntry(entry);
        }
      });

      // Observe different types of performance entries
      try {
        this.performanceObserver.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] });
      } catch (error) {
        console.warn('Some performance metrics not supported:', error);
      }
    }

    // Monitor page load performance
    window.addEventListener('load', () => {
      setTimeout(() => this.reportPageLoadMetrics(), 0);
    });

    // Monitor memory usage (if available)
    if ('memory' in performance) {
      setInterval(() => {
        this.reportMemoryUsage();
      }, 30000); // Every 30 seconds
    }
  }

  private handlePerformanceEntry(entry: PerformanceEntry): void {
    const shouldSample = Math.random() < this.config.sampleRate;
    if (!shouldSample) return;

    switch (entry.entryType) {
      case 'navigation':
        this.handleNavigationEntry(entry as PerformanceNavigationTiming);
        break;
      case 'paint':
        this.handlePaintEntry(entry as PerformancePaintTiming);
        break;
      case 'largest-contentful-paint':
        this.handleLCPEntry(entry);
        break;
      case 'first-input':
        this.handleFIDEntry(entry);
        break;
      case 'layout-shift':
        this.handleCLSEntry(entry);
        break;
    }
  }

  private handleNavigationEntry(entry: PerformanceNavigationTiming): void {
    const loadTime = entry.loadEventEnd - entry.fetchStart;
    const domContentLoadedTime = entry.domContentLoadedEventEnd - entry.fetchStart;
    const firstByteTime = entry.responseStart - entry.fetchStart;

    // Report if load time exceeds threshold
    if (loadTime > this.config.performanceThresholds.loadTime) {
      this.errorReportingService.reportPerformanceIssue(
        'page_load_time',
        loadTime,
        this.config.performanceThresholds.loadTime
      );
    }

    // Send performance metrics
    this.sendPerformanceMetric('navigation', {
      loadTime,
      domContentLoadedTime,
      firstByteTime,
      dnsLookupTime: entry.domainLookupEnd - entry.domainLookupStart,
      tcpConnectTime: entry.connectEnd - entry.connectStart,
      serverResponseTime: entry.responseEnd - entry.responseStart
    });
  }

  private handlePaintEntry(entry: PerformancePaintTiming): void {
    const paintTime = entry.startTime;
    
    if (entry.name === 'first-contentful-paint' && paintTime > this.config.performanceThresholds.renderTime) {
      this.errorReportingService.reportPerformanceIssue(
        'first_contentful_paint',
        paintTime,
        this.config.performanceThresholds.renderTime
      );
    }

    this.sendPerformanceMetric('paint', {
      name: entry.name,
      startTime: entry.startTime
    });
  }

  private handleLCPEntry(entry: any): void {
    const lcpTime = entry.startTime;
    
    if (lcpTime > 2500) { // LCP threshold: 2.5 seconds
      this.errorReportingService.reportPerformanceIssue(
        'largest_contentful_paint',
        lcpTime,
        2500
      );
    }

    this.sendPerformanceMetric('lcp', {
      startTime: lcpTime,
      element: entry.element?.tagName
    });
  }

  private handleFIDEntry(entry: any): void {
    const fidTime = entry.processingStart - entry.startTime;
    
    if (fidTime > this.config.performanceThresholds.interactionTime) {
      this.errorReportingService.reportPerformanceIssue(
        'first_input_delay',
        fidTime,
        this.config.performanceThresholds.interactionTime
      );
    }

    this.sendPerformanceMetric('fid', {
      delay: fidTime,
      startTime: entry.startTime
    });
  }

  private handleCLSEntry(entry: any): void {
    if (entry.value > 0.1) { // CLS threshold: 0.1
      this.errorReportingService.reportPerformanceIssue(
        'cumulative_layout_shift',
        entry.value,
        0.1
      );
    }

    this.sendPerformanceMetric('cls', {
      value: entry.value,
      startTime: entry.startTime
    });
  }

  private reportPageLoadMetrics(): void {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (!navigation) return;

    const metrics: PerformanceMetrics = {
      loadTime: navigation.loadEventEnd - navigation.fetchStart,
      renderTime: navigation.domContentLoadedEventEnd - navigation.fetchStart,
      interactionTime: Date.now() - this.startTime
    };

    // Add memory usage if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      metrics.memoryUsage = memory.usedJSHeapSize;
    }

    this.sendPerformanceMetric('page_load', metrics);
  }

  private reportMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const memoryUsage = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };

      // Report if memory usage is high
      if (memoryUsage.percentage > 80) {
        this.errorReportingService.reportPerformanceIssue(
          'high_memory_usage',
          memoryUsage.percentage,
          80
        );
      }

      this.sendPerformanceMetric('memory', memoryUsage);
    }
  }

  private async sendPerformanceMetric(type: string, data: any): Promise<void> {
    // Skip if monitoring is disabled
    if (!this.config.enablePerformanceMonitoring) {
      return;
    }
    
    try {
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';
      
      await fetch(`${apiBaseUrl}/api/monitoring/performance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          data,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        })
      });
    } catch (error) {
      // Silently fail for performance metrics
      console.debug('Failed to send performance metric:', error);
    }
  }

  public trackUserInteraction(action: string, element?: string, duration?: number): void {
    if (!this.config.enablePerformanceMonitoring) {
      return;
    }
    
    if (duration && duration > this.config.performanceThresholds.interactionTime) {
      this.errorReportingService.reportPerformanceIssue(
        'slow_interaction',
        duration,
        this.config.performanceThresholds.interactionTime
      );
    }

    this.sendPerformanceMetric('user_interaction', {
      action,
      element,
      duration,
      timestamp: Date.now()
    });
  }

  public trackApiCall(endpoint: string, method: string, duration: number, status: number): void {
    if (!this.config.enablePerformanceMonitoring) {
      return;
    }
    
    const isError = status >= 400;
    const isSlow = duration > 5000; // 5 seconds

    if (isError) {
      this.errorReportingService.reportApiError(endpoint, status, `${method} ${endpoint} failed`);
    }

    if (isSlow) {
      this.errorReportingService.reportPerformanceIssue(
        'slow_api_call',
        duration,
        5000
      );
    }

    this.sendPerformanceMetric('api_call', {
      endpoint,
      method,
      duration,
      status,
      isError,
      isSlow
    });
  }

  public trackComponentRender(componentName: string, renderTime: number): void {
    if (!this.config.enablePerformanceMonitoring) {
      return;
    }
    
    if (renderTime > this.config.performanceThresholds.renderTime) {
      this.errorReportingService.reportPerformanceIssue(
        'slow_component_render',
        renderTime,
        this.config.performanceThresholds.renderTime
      );
    }

    this.sendPerformanceMetric('component_render', {
      componentName,
      renderTime
    });
  }

  public setUserId(userId: string): void {
    // Store user ID for error context
    sessionStorage.setItem('monitoring_user_id', userId);
  }

  public setSessionId(sessionId: string): void {
    // Store session ID for error context
    sessionStorage.setItem('monitoring_session_id', sessionId);
  }

  public cleanup(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    this.errorReportingService.cleanup();
  }
}

// Create singleton instance
export const monitoring = new MonitoringService();

// React hook for component performance monitoring
export function usePerformanceMonitoring(componentName: string) {
  const startTime = Date.now();

  return {
    trackRender: () => {
      const renderTime = Date.now() - startTime;
      monitoring.trackComponentRender(componentName, renderTime);
    },
    trackInteraction: (action: string, element?: string) => {
      const interactionStart = Date.now();
      return () => {
        const duration = Date.now() - interactionStart;
        monitoring.trackUserInteraction(action, element, duration);
      };
    }
  };
}

// API call monitoring wrapper
export function withApiMonitoring<T extends (...args: any[]) => Promise<any>>(
  apiCall: T,
  endpoint: string,
  method: string = 'GET'
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now();
    let status = 0;
    
    try {
      const result = await apiCall(...args);
      status = 200; // Assume success if no error
      return result;
    } catch (error: any) {
      status = error.status || 500;
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      monitoring.trackApiCall(endpoint, method, duration, status);
    }
  }) as T;
}

export default monitoring;