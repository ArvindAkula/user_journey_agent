import { useEffect, useCallback } from 'react';
import { getCLS, getFID, getFCP, getLCP, getTTFB, Metric } from 'web-vitals';

interface PerformanceConfig {
  enableReporting: boolean;
  apiEndpoint?: string;
  sampleRate: number;
}

interface CustomMetric {
  name: string;
  value: number;
  id: string;
  delta: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  entries: any[];
  navigationType: string;
}

interface PerformanceMetrics {
  cls: number | null;
  fid: number | null;
  fcp: number | null;
  lcp: number | null;
  ttfb: number | null;
}

export const usePerformanceMonitoring = (config: PerformanceConfig) => {
  const { enableReporting, apiEndpoint, sampleRate = 1.0 } = config;

  const reportMetric = useCallback((metric: Metric) => {
    // Only report if enabled and within sample rate
    if (!enableReporting || Math.random() > sampleRate) {
      return;
    }

    const metricData = {
      name: metric.name,
      value: metric.value,
      id: metric.id,
      delta: metric.delta,
      rating: metric.rating,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      connectionType: (navigator as any).connection?.effectiveType || 'unknown',
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Performance Metric:', metricData);
    }

    // Send to analytics endpoint in production
    if (apiEndpoint && process.env.REACT_APP_ENVIRONMENT === 'production') {
      fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'performance_metric',
          data: metricData,
        }),
      }).catch(error => {
        console.warn('Failed to report performance metric:', error);
      });
    }

    // Store in localStorage for debugging
    try {
      const existingMetrics = JSON.parse(localStorage.getItem('performance_metrics') || '[]');
      existingMetrics.push(metricData);
      
      // Keep only last 50 metrics
      if (existingMetrics.length > 50) {
        existingMetrics.splice(0, existingMetrics.length - 50);
      }
      
      localStorage.setItem('performance_metrics', JSON.stringify(existingMetrics));
    } catch (error) {
      console.warn('Failed to store performance metric:', error);
    }
  }, [enableReporting, apiEndpoint, sampleRate]);

  const reportCustomMetric = useCallback((metric: CustomMetric) => {
    // Only report if enabled and within sample rate
    if (!enableReporting || Math.random() > sampleRate) {
      return;
    }

    const metricData = {
      name: metric.name,
      value: metric.value,
      id: metric.id,
      delta: metric.delta,
      rating: metric.rating,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      connectionType: (navigator as any).connection?.effectiveType || 'unknown',
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Custom Performance Metric:', metricData);
    }

    // Send to analytics endpoint in production
    if (apiEndpoint && process.env.REACT_APP_ENVIRONMENT === 'production') {
      fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'custom_performance_metric',
          data: metricData,
        }),
      }).catch(error => {
        console.warn('Failed to report custom performance metric:', error);
      });
    }

    // Store in localStorage for debugging
    try {
      const existingMetrics = JSON.parse(localStorage.getItem('custom_performance_metrics') || '[]');
      existingMetrics.push(metricData);
      
      // Keep only last 50 metrics
      if (existingMetrics.length > 50) {
        existingMetrics.splice(0, existingMetrics.length - 50);
      }
      
      localStorage.setItem('custom_performance_metrics', JSON.stringify(existingMetrics));
    } catch (error) {
      console.warn('Failed to store custom performance metric:', error);
    }
  }, [enableReporting, apiEndpoint, sampleRate]);

  useEffect(() => {
    if (!enableReporting) return;

    // Measure Core Web Vitals
    getCLS(reportMetric);
    getFID(reportMetric);
    getFCP(reportMetric);
    getLCP(reportMetric);
    getTTFB(reportMetric);

    // Report navigation timing
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navigationEntries.length > 0) {
        const nav = navigationEntries[0];
        const navigationMetrics = {
          domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
          loadComplete: nav.loadEventEnd - nav.loadEventStart,
          domInteractive: nav.domInteractive - nav.fetchStart,
          firstByte: nav.responseStart - nav.requestStart,
        };

        if (process.env.NODE_ENV === 'development') {
          console.log('Navigation Metrics:', navigationMetrics);
        }
      }
    }

    // Monitor resource loading
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          const resource = entry as PerformanceResourceTiming;
          
          // Report slow resources (>1s)
          if (resource.duration > 1000) {
            const slowResourceData: CustomMetric = {
              name: 'slow_resource',
              value: resource.duration,
              id: resource.name,
              delta: resource.duration,
              rating: 'poor' as const,
              entries: [resource],
              navigationType: 'navigate'
            };

            reportCustomMetric(slowResourceData);
          }
        }
      }
    });

    observer.observe({ entryTypes: ['resource'] });

    return () => {
      observer.disconnect();
    };
  }, [reportMetric, reportCustomMetric, enableReporting]);

  const getStoredMetrics = useCallback((): PerformanceMetrics => {
    try {
      const metrics = JSON.parse(localStorage.getItem('performance_metrics') || '[]');
      const latest = metrics.reduce((acc: PerformanceMetrics, metric: any) => {
        switch (metric.name) {
          case 'CLS':
            acc.cls = metric.value;
            break;
          case 'FID':
            acc.fid = metric.value;
            break;
          case 'FCP':
            acc.fcp = metric.value;
            break;
          case 'LCP':
            acc.lcp = metric.value;
            break;
          case 'TTFB':
            acc.ttfb = metric.value;
            break;
        }
        return acc;
      }, { cls: null, fid: null, fcp: null, lcp: null, ttfb: null });

      return latest;
    } catch {
      return { cls: null, fid: null, fcp: null, lcp: null, ttfb: null };
    }
  }, []);

  const clearStoredMetrics = useCallback(() => {
    try {
      localStorage.removeItem('performance_metrics');
    } catch (error) {
      console.warn('Failed to clear performance metrics:', error);
    }
  }, []);

  return {
    getStoredMetrics,
    clearStoredMetrics,
  };
};

export default usePerformanceMonitoring;