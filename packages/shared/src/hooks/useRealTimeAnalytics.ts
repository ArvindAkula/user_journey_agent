import { useState, useEffect, useCallback, useRef } from 'react';
import { RealTimeAnalyticsService, RealTimeMetrics, EventCorrelation, RealTimeUpdate } from '../services/RealTimeAnalyticsService';
import { UserEvent } from '../types';

export interface UseRealTimeAnalyticsConfig {
  websocketUrl: string;
  autoConnect?: boolean;
  enableEventCorrelation?: boolean;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
}

export interface RealTimeAnalyticsState {
  isConnected: boolean;
  isConnecting: boolean;
  metrics: RealTimeMetrics | null;
  correlations: EventCorrelation[];
  recentEvents: UserEvent[];
  connectionStatus: {
    reconnectAttempts: number;
    bufferedEvents: number;
    activeCorrelations: number;
  };
  error: Error | null;
}

export const useRealTimeAnalytics = (config: UseRealTimeAnalyticsConfig) => {
  const [state, setState] = useState<RealTimeAnalyticsState>({
    isConnected: false,
    isConnecting: false,
    metrics: null,
    correlations: [],
    recentEvents: [],
    connectionStatus: {
      reconnectAttempts: 0,
      bufferedEvents: 0,
      activeCorrelations: 0,
    },
    error: null,
  });

  const serviceRef = useRef<RealTimeAnalyticsService | null>(null);
  const subscriptionsRef = useRef<(() => void)[]>([]);

  // Initialize service
  useEffect(() => {
    if (!serviceRef.current) {
      serviceRef.current = new RealTimeAnalyticsService({
        websocketUrl: config.websocketUrl,
        enableEventCorrelation: config.enableEventCorrelation ?? true,
      });

      // Start periodic cleanup
      serviceRef.current.startPeriodicCleanup();
    }

    return () => {
      // Cleanup subscriptions
      subscriptionsRef.current.forEach(unsubscribe => unsubscribe());
      subscriptionsRef.current = [];

      // Disconnect service
      if (serviceRef.current) {
        serviceRef.current.disconnect();
        serviceRef.current = null;
      }
    };
  }, [config.websocketUrl, config.enableEventCorrelation]);

  // Set up subscriptions
  useEffect(() => {
    if (!serviceRef.current) return;

    const service = serviceRef.current;

    // Subscribe to different event types
    const subscriptions = [
      // Metrics updates
      service.subscribe('metrics_updated', (update: RealTimeUpdate) => {
        setState(prev => ({
          ...prev,
          metrics: update.metrics || service.getCurrentMetrics(),
        }));
      }),

      // Event processing updates
      service.subscribe('event_processed', (update: RealTimeUpdate) => {
        setState(prev => {
          const newRecentEvents = update.event 
            ? [update.event, ...prev.recentEvents.slice(0, 49)] // Keep last 50 events
            : prev.recentEvents;

          return {
            ...prev,
            metrics: update.metrics || service.getCurrentMetrics(),
            recentEvents: newRecentEvents,
            correlations: service.getAllCorrelations(),
          };
        });
      }),

      // Struggle detection updates
      service.subscribe('struggle_detected', (update: RealTimeUpdate) => {
        setState(prev => ({
          ...prev,
          correlations: service.getAllCorrelations(),
        }));
      }),

      // User activity updates
      service.subscribe('user_activity', (update: RealTimeUpdate) => {
        setState(prev => ({
          ...prev,
          correlations: service.getAllCorrelations(),
        }));
      }),

      // Batch processing updates
      service.subscribe('batch_processed', (update: RealTimeUpdate) => {
        setState(prev => ({
          ...prev,
          metrics: service.getCurrentMetrics(),
          correlations: service.getAllCorrelations(),
        }));
      }),

      // All events (for debugging/monitoring)
      service.subscribe('all', ({ eventType, data }) => {
        console.log(`📊 Real-time analytics event: ${eventType}`, data);
      }),
    ];

    subscriptionsRef.current = subscriptions;

    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  // Connection management
  const connect = useCallback(async () => {
    if (!serviceRef.current || state.isConnecting) return;

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      await serviceRef.current.connect();
      
      const status = serviceRef.current.getConnectionStatus();
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        connectionStatus: status,
        error: null,
      }));

      config.onConnectionChange?.(true);
    } catch (error) {
      const err = error as Error;
      setState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        error: err,
      }));

      config.onError?.(err);
      config.onConnectionChange?.(false);
    }
  }, [state.isConnecting, config]);

  const disconnect = useCallback(() => {
    if (!serviceRef.current) return;

    serviceRef.current.disconnect();
    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
    }));

    config.onConnectionChange?.(false);
  }, [config]);

  // Send event to backend
  const sendEvent = useCallback(async (event: UserEvent) => {
    if (!serviceRef.current) return;

    try {
      await serviceRef.current.sendEvent(event);
      
      // Update connection status
      const status = serviceRef.current.getConnectionStatus();
      setState(prev => ({
        ...prev,
        connectionStatus: status,
      }));
    } catch (error) {
      console.error('Error sending event:', error);
      config.onError?.(error as Error);
    }
  }, [config]);

  // Get user correlation data
  const getUserCorrelation = useCallback((userId: string): EventCorrelation | null => {
    return serviceRef.current?.getUserCorrelation(userId) || null;
  }, []);

  // Auto-connect if enabled
  useEffect(() => {
    if (config.autoConnect !== false && !state.isConnected && !state.isConnecting) {
      connect();
    }
  }, [config.autoConnect, state.isConnected, state.isConnecting, connect]);

  // Update connection status periodically
  useEffect(() => {
    if (!serviceRef.current || !state.isConnected) return;

    const interval = setInterval(() => {
      const status = serviceRef.current!.getConnectionStatus();
      setState(prev => ({
        ...prev,
        connectionStatus: status,
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [state.isConnected]);

  return {
    // State
    ...state,
    
    // Actions
    connect,
    disconnect,
    sendEvent,
    getUserCorrelation,
    
    // Utilities
    service: serviceRef.current,
  };
};

// Hook for subscribing to specific real-time events
export const useRealTimeSubscription = (
  service: RealTimeAnalyticsService | null,
  eventType: string,
  callback: (data: any) => void,
  dependencies: any[] = []
) => {
  useEffect(() => {
    if (!service) return;

    const unsubscribe = service.subscribe(eventType, callback);
    return unsubscribe;
  }, [service, eventType, ...dependencies]);
};

// Hook for real-time metrics only
export const useRealTimeMetrics = (websocketUrl: string) => {
  const [metrics, setMetrics] = useState<RealTimeMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const { connect, disconnect, service } = useRealTimeAnalytics({
    websocketUrl,
    autoConnect: true,
    onConnectionChange: setIsConnected,
  });

  useRealTimeSubscription(
    service,
    'metrics_updated',
    (update: RealTimeUpdate) => {
      setMetrics(update.metrics || service?.getCurrentMetrics() || null);
    }
  );

  useRealTimeSubscription(
    service,
    'event_processed',
    (update: RealTimeUpdate) => {
      setMetrics(update.metrics || service?.getCurrentMetrics() || null);
    }
  );

  return {
    metrics,
    isConnected,
    connect,
    disconnect,
  };
};