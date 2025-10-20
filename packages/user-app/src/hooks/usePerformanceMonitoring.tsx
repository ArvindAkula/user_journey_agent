import React, { useEffect, useCallback } from 'react';
import { errorReportingService } from '../services/ErrorReportingService';

interface PerformanceMetrics {
  componentName: string;
  renderTime?: number;
  mountTime?: number;
  updateTime?: number;
  memoryUsage?: number;
}

export const usePerformanceMonitoring = (componentName: string) => {
  const startTime = performance.now();

  // Track component mount time
  useEffect(() => {
    const mountTime = performance.now() - startTime;
    
    if (mountTime > 100) { // Report slow mounts (> 100ms)
      errorReportingService.reportPerformanceMetrics({
        loadTime: mountTime,
        timestamp: new Date().toISOString()
      });
    }
  }, [startTime]);

  // Track render performance
  const trackRender = useCallback((renderStartTime: number) => {
    const renderTime = performance.now() - renderStartTime;
    
    if (renderTime > 50) { // Report slow renders (> 50ms)
      errorReportingService.reportPerformanceMetrics({
        renderTime,
        timestamp: new Date().toISOString()
      });
    }
  }, []);

  // Track memory usage
  const trackMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      if (memInfo) {
        errorReportingService.reportPerformanceMetrics({
          memoryUsage: memInfo.usedJSHeapSize,
          timestamp: new Date().toISOString()
        });
      }
    }
  }, []);

  // Track user interactions
  const trackInteraction = useCallback((interactionType: string, duration?: number) => {
    if (duration && duration > 1000) { // Report slow interactions (> 1s)
      errorReportingService.reportPerformanceMetrics({
        loadTime: duration,
        timestamp: new Date().toISOString()
      });
    }
  }, []);

  return {
    trackRender,
    trackMemoryUsage,
    trackInteraction
  };
};

// Higher-order component for automatic performance tracking
export const withPerformanceMonitoring = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
): React.FC<P> => {
  const PerformanceWrappedComponent: React.FC<P> = (props: P) => {
    const renderStart = performance.now();
    
    useEffect(() => {
      const renderTime = performance.now() - renderStart;
      
      if (renderTime > 100) { // Report slow component renders
        errorReportingService.reportPerformanceMetrics({
          renderTime,
          timestamp: new Date().toISOString()
        });
      }
    });

    return <WrappedComponent {...props} />;
  };

  return PerformanceWrappedComponent;
};