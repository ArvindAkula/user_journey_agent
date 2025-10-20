import React, { useEffect, useCallback, useState } from 'react';
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
  timestamp: number;
  [key: string]: any; // Allow additional properties
}

interface PerformanceMetrics {
  cls: number | null;
  fid: number | null;
  fcp: number | null;
  lcp: number | null;
  ttfb: number | null;
}

interface DashboardPerformanceMetrics extends PerformanceMetrics {
  chartRenderTime: number | null;
  dataFetchTime: number | null;
  wsConnectionTime: number | null;
}

export const usePerformanceMonitoring = (config: PerformanceConfig) => {
  const { enableReporting, apiEndpoint, sampleRate = 1.0 } = config;
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardPerformanceMetrics>({
    cls: null,
    fid: null,
    fcp: null,
    lcp: null,
    ttfb: null,
    chartRenderTime: null,
    dataFetchTime: null,
    wsConnectionTime: null,
  });

  const reportMetric = useCallback((metric: Metric | CustomMetric) => {
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
      appType: 'analytics-dashboard',
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Dashboard Performance Metric:', metricData);
    }

    // Skip API calls in demo mode
    if (localStorage.getItem('analytics_demo_mode') === 'true') {
      console.log('Demo mode: skipping performance metric reporting');
      return;
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

    // Update local state for dashboard display
    setDashboardMetrics(prev => ({
      ...prev,
      [metric.name.toLowerCase()]: metric.value,
    }));

    // Store in localStorage for debugging
    try {
      const existingMetrics = JSON.parse(localStorage.getItem('dashboard_performance_metrics') || '[]');
      existingMetrics.push(metricData);
      
      // Keep only last 100 metrics for dashboard
      if (existingMetrics.length > 100) {
        existingMetrics.splice(0, existingMetrics.length - 100);
      }
      
      localStorage.setItem('dashboard_performance_metrics', JSON.stringify(existingMetrics));
    } catch (error) {
      console.warn('Failed to store performance metric:', error);
    }
  }, [enableReporting, apiEndpoint, sampleRate]);

  // Dashboard-specific performance tracking
  const trackChartRender = useCallback((chartType: string, renderTime: number) => {
    const chartMetric: CustomMetric = {
      name: 'chart_render_time',
      value: renderTime,
      id: `chart-${chartType}-${Date.now()}`,
      delta: renderTime,
      rating: renderTime < 100 ? 'good' : renderTime < 300 ? 'needs-improvement' : 'poor',
      timestamp: Date.now(),
      chartType,
    };

    reportMetric(chartMetric);
    setDashboardMetrics(prev => ({ ...prev, chartRenderTime: renderTime }));
  }, [reportMetric]);

  const trackDataFetch = useCallback((endpoint: string, fetchTime: number) => {
    const fetchMetric: CustomMetric = {
      name: 'data_fetch_time',
      value: fetchTime,
      id: `fetch-${endpoint}-${Date.now()}`,
      delta: fetchTime,
      rating: fetchTime < 500 ? 'good' : fetchTime < 1000 ? 'needs-improvement' : 'poor',
      timestamp: Date.now(),
      endpoint,
    };

    reportMetric(fetchMetric);
    setDashboardMetrics(prev => ({ ...prev, dataFetchTime: fetchTime }));
  }, [reportMetric]);

  const trackWebSocketConnection = useCallback((connectionTime: number) => {
    const wsMetric: CustomMetric = {
      name: 'websocket_connection_time',
      value: connectionTime,
      id: `ws-connection-${Date.now()}`,
      delta: connectionTime,
      rating: connectionTime < 1000 ? 'good' : connectionTime < 3000 ? 'needs-improvement' : 'poor',
      timestamp: Date.now(),
    };

    reportMetric(wsMetric);
    setDashboardMetrics(prev => ({ ...prev, wsConnectionTime: connectionTime }));
  }, [reportMetric]);

  useEffect(() => {
    if (!enableReporting) return;

    // Measure Core Web Vitals
    getCLS(reportMetric);
    getFID(reportMetric);
    getFCP(reportMetric);
    getLCP(reportMetric);
    getTTFB(reportMetric);

    // Monitor large DOM updates (common in dashboards)
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure') {
          const measure = entry as PerformanceMeasure;
          
          // Report slow DOM updates (>50ms)
          if (measure.duration > 50) {
            const domUpdateMetric: CustomMetric = {
              name: 'slow_dom_update',
              value: measure.duration,
              id: measure.name,
              delta: measure.duration,
              rating: 'poor' as const,
              timestamp: Date.now(),
              url: window.location.href,
              measureName: measure.name,
            };

            reportMetric(domUpdateMetric);
          }
        }
      }
    });

    observer.observe({ entryTypes: ['measure'] });

    // Monitor memory usage (important for data-heavy dashboards)
    const checkMemoryUsage = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const memoryUsage = {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
          percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
        };

        // Report high memory usage (>80%)
        if (memoryUsage.percentage > 80) {
          const memoryMetric: CustomMetric = {
            name: 'high_memory_usage',
            value: memoryUsage.percentage,
            id: `memory-${Date.now()}`,
            delta: memoryUsage.percentage,
            rating: 'poor' as const,
            timestamp: Date.now(),
            url: window.location.href,
            memoryDetails: memoryUsage,
          };

          reportMetric(memoryMetric);
        }
      }
    };

    // Check memory usage every 30 seconds
    const memoryInterval = setInterval(checkMemoryUsage, 30000);

    return () => {
      observer.disconnect();
      clearInterval(memoryInterval);
    };
  }, [reportMetric, enableReporting]);

  const getStoredMetrics = useCallback((): DashboardPerformanceMetrics => {
    try {
      const metrics = JSON.parse(localStorage.getItem('dashboard_performance_metrics') || '[]');
      const latest = metrics.reduce((acc: DashboardPerformanceMetrics, metric: any) => {
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
          case 'chart_render_time':
            acc.chartRenderTime = metric.value;
            break;
          case 'data_fetch_time':
            acc.dataFetchTime = metric.value;
            break;
          case 'websocket_connection_time':
            acc.wsConnectionTime = metric.value;
            break;
        }
        return acc;
      }, { 
        cls: null, 
        fid: null, 
        fcp: null, 
        lcp: null, 
        ttfb: null,
        chartRenderTime: null,
        dataFetchTime: null,
        wsConnectionTime: null,
      });

      return latest;
    } catch {
      return { 
        cls: null, 
        fid: null, 
        fcp: null, 
        lcp: null, 
        ttfb: null,
        chartRenderTime: null,
        dataFetchTime: null,
        wsConnectionTime: null,
      };
    }
  }, []);

  const clearStoredMetrics = useCallback(() => {
    try {
      localStorage.removeItem('dashboard_performance_metrics');
      setDashboardMetrics({
        cls: null,
        fid: null,
        fcp: null,
        lcp: null,
        ttfb: null,
        chartRenderTime: null,
        dataFetchTime: null,
        wsConnectionTime: null,
      });
    } catch (error) {
      console.warn('Failed to clear performance metrics:', error);
    }
  }, []);

  // Performance monitoring component for dashboard
  const PerformanceMonitor: React.FC = () => {
    if (process.env.REACT_APP_ENVIRONMENT !== 'development') {
      return null;
    }

    return (
      <div style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '12px',
        zIndex: 9999,
        maxWidth: '300px',
      }}>
        <div><strong>Performance Metrics</strong></div>
        {dashboardMetrics.lcp && <div>LCP: {dashboardMetrics.lcp.toFixed(0)}ms</div>}
        {dashboardMetrics.fid && <div>FID: {dashboardMetrics.fid.toFixed(0)}ms</div>}
        {dashboardMetrics.cls && <div>CLS: {dashboardMetrics.cls.toFixed(3)}</div>}
        {dashboardMetrics.chartRenderTime && <div>Chart Render: {dashboardMetrics.chartRenderTime.toFixed(0)}ms</div>}
        {dashboardMetrics.dataFetchTime && <div>Data Fetch: {dashboardMetrics.dataFetchTime.toFixed(0)}ms</div>}
        {dashboardMetrics.wsConnectionTime && <div>WS Connect: {dashboardMetrics.wsConnectionTime.toFixed(0)}ms</div>}
      </div>
    );
  };

  return {
    getStoredMetrics,
    clearStoredMetrics,
    trackChartRender,
    trackDataFetch,
    trackWebSocketConnection,
    dashboardMetrics,
    PerformanceMonitor,
  };
};

export default usePerformanceMonitoring;