import { useState, useEffect, useCallback, useRef } from 'react';
import { AnalyticsService } from '@aws-agent/shared';
import { useRealTimeAnalytics, RealTimeMetrics } from '@aws-agent/shared';
import appConfig from '../config';

export interface ProductionMetrics {
  totalUsers: number;
  activeUsers: number;
  conversionRate: number;
  averageSessionDuration: number;
  dropOffRate: number;
  struggleSignals: number;
  eventsPerMinute: number;
  errorRate: number;
  lastUpdated: string;
}

export interface AnalyticsFilter {
  dateRange: {
    start: Date;
    end: Date;
  };
  userSegments: string[];
  platforms: string[];
  features: string[];
}

export interface UseProductionAnalyticsConfig {
  enableRealTime?: boolean;
  refreshInterval?: number;
  onError?: (error: Error) => void;
}

export interface ProductionAnalyticsState {
  metrics: ProductionMetrics | null;
  realtimeMetrics: RealTimeMetrics | null;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  lastRefresh: Date | null;
}

export const useProductionAnalytics = (
  filters: AnalyticsFilter,
  config: UseProductionAnalyticsConfig = {}
) => {
  const {
    enableRealTime = true,
    refreshInterval = 30000,
    onError
  } = config;

  const [state, setState] = useState<ProductionAnalyticsState>({
    metrics: null,
    realtimeMetrics: null,
    isLoading: true,
    isConnected: false,
    error: null,
    lastRefresh: null,
  });

  const analyticsServiceRef = useRef<AnalyticsService | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize analytics service
  useEffect(() => {
    if (!analyticsServiceRef.current) {
      console.log('🔧 [useProductionAnalytics] Initializing AnalyticsService with baseURL:', appConfig.analyticsApiBaseUrl);
      console.log('🔧 [useProductionAnalytics] Full config:', {
        apiBaseUrl: appConfig.apiBaseUrl,
        analyticsApiBaseUrl: appConfig.analyticsApiBaseUrl,
        environment: appConfig.environment
      });
      
      analyticsServiceRef.current = new AnalyticsService({
        baseURL: appConfig.analyticsApiBaseUrl,
        timeout: 30000,
        headers: {
          'X-Client-Type': 'analytics-dashboard',
          'X-Environment': appConfig.environment
        }
      });
    }
  }, []);

  // Real-time analytics hook - TEMPORARILY DISABLED to test API data
  const realTimeAnalytics = useRealTimeAnalytics({
    websocketUrl: appConfig.realtimeEndpoint,
    autoConnect: false, // DISABLED - was overwriting API data with mock data
    enableEventCorrelation: true,
    onConnectionChange: (connected) => {
      setState(prev => ({ ...prev, isConnected: connected }));
    },
    onError: (error) => {
      console.error('Real-time analytics error:', error);
      onError?.(error);
    }
  });
  
  console.log('⚠️  [useProductionAnalytics] Real-time polling DISABLED for debugging');

  // Stabilize filters to prevent infinite loops
  const filtersRef = useRef(filters);
  const filtersKey = JSON.stringify(filters);
  
  useEffect(() => {
    filtersRef.current = filters;
  }, [filtersKey]); // Only update when filters actually change

  // Load historical metrics from API
  const loadMetrics = useCallback(async () => {
    if (!analyticsServiceRef.current) return;

    console.log('🔄 [useProductionAnalytics] Loading metrics from backend...');

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const service = analyticsServiceRef.current;
      
      console.log('📡 [useProductionAnalytics] Fetching data from API...');
      
      // Load different types of metrics
      const [
        userJourneyMetrics,
        _engagementMetrics,
        dashboardMetrics
      ] = await Promise.all([
        service.getUserJourneyMetrics(filtersRef.current),
        service.getVideoEngagementMetrics(filtersRef.current),
        service.getDashboardMetrics()
      ]);

      console.log('✅ [useProductionAnalytics] Received data:', {
        userJourneyMetrics,
        dashboardMetrics
      });

      // Combine metrics into production format
      const combinedMetrics: ProductionMetrics = {
        totalUsers: userJourneyMetrics.totalUsers || 0,
        activeUsers: userJourneyMetrics.activeUsers || 0,
        conversionRate: userJourneyMetrics.conversionRate || 0,
        averageSessionDuration: userJourneyMetrics.averageSessionDuration || 0,
        dropOffRate: userJourneyMetrics.dropOffRate || 0,
        struggleSignals: userJourneyMetrics.struggleSignals || 0,
        eventsPerMinute: dashboardMetrics.realTimeMetrics?.eventsPerMinute || 0,
        errorRate: dashboardMetrics.realTimeMetrics?.errorRate || 0,
        lastUpdated: new Date().toISOString(),
      };

      console.log('📊 [useProductionAnalytics] Combined metrics:', combinedMetrics);

      setState(prev => ({
        ...prev,
        metrics: combinedMetrics,
        isLoading: false,
        lastRefresh: new Date(),
      }));

      console.log('✅ [useProductionAnalytics] State updated successfully');

    } catch (error) {
      console.error('❌ [useProductionAnalytics] Error loading metrics:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load analytics data';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
    // Use filtersKey instead of filters object to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, onError]);

  // Schedule periodic refresh
  const scheduleRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      loadMetrics();
      scheduleRefresh();
    }, refreshInterval);
  }, [loadMetrics, refreshInterval]);

  // Load metrics when filters change
  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // Set up periodic refresh
  useEffect(() => {
    scheduleRefresh();
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [scheduleRefresh]);

  // Update real-time metrics
  useEffect(() => {
    setState(prev => ({
      ...prev,
      realtimeMetrics: realTimeAnalytics.metrics,
      isConnected: realTimeAnalytics.isConnected,
    }));
  }, [realTimeAnalytics.metrics, realTimeAnalytics.isConnected]);

  // Merge historical and real-time metrics
  const getMergedMetrics = useCallback((): ProductionMetrics | null => {
    if (!state.metrics) return null;

    // If we have real-time metrics, merge them with historical data
    if (state.realtimeMetrics && enableRealTime) {
      return {
        ...state.metrics,
        activeUsers: state.realtimeMetrics.activeUsers,
        eventsPerMinute: state.realtimeMetrics.eventsPerMinute,
        errorRate: state.realtimeMetrics.errorRate,
        struggleSignals: state.realtimeMetrics.strugglesDetected,
        lastUpdated: state.realtimeMetrics.lastUpdated,
      };
    }

    return state.metrics;
  }, [state.metrics, state.realtimeMetrics, enableRealTime]);

  // Manual refresh function
  const refresh = useCallback(() => {
    loadMetrics();
  }, [loadMetrics]);

  // Connect/disconnect real-time
  const connectRealTime = useCallback(() => {
    realTimeAnalytics.connect();
  }, [realTimeAnalytics]);

  const disconnectRealTime = useCallback(() => {
    realTimeAnalytics.disconnect();
  }, [realTimeAnalytics]);

  return {
    // State
    metrics: getMergedMetrics(),
    realtimeMetrics: state.realtimeMetrics,
    isLoading: state.isLoading,
    isConnected: state.isConnected,
    error: state.error,
    lastRefresh: state.lastRefresh,
    
    // Real-time state
    recentEvents: realTimeAnalytics.recentEvents,
    correlations: realTimeAnalytics.correlations,
    connectionStatus: realTimeAnalytics.connectionStatus,
    
    // Actions
    refresh,
    connectRealTime,
    disconnectRealTime,
    
    // Utilities
    sendEvent: realTimeAnalytics.sendEvent,
    getUserCorrelation: realTimeAnalytics.getUserCorrelation,
  };
};

// Hook for real-time metrics display
export const useRealTimeMetricsDisplay = (refreshInterval: number = 5000) => {
  const [displayMetrics, setDisplayMetrics] = useState<RealTimeMetrics | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const updateMetrics = useCallback((newMetrics: RealTimeMetrics | null) => {
    if (!newMetrics) return;

    setIsAnimating(true);
    setTimeout(() => {
      setDisplayMetrics(newMetrics);
      setIsAnimating(false);
    }, 150);
  }, []);

  return {
    displayMetrics,
    isAnimating,
    updateMetrics,
  };
};

// Hook for production environment detection
export const useProductionEnvironment = () => {
  const isProduction = appConfig.environment === 'production';
  const isDevelopment = appConfig.environment === 'development';
  
  return {
    isProduction,
    isDevelopment,
    environment: appConfig.environment,
    apiBaseUrl: appConfig.apiBaseUrl,
    analyticsApiBaseUrl: appConfig.analyticsApiBaseUrl,
    realtimeEndpoint: appConfig.realtimeEndpoint,
  };
};