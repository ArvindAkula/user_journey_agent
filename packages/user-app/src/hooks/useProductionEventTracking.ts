import { useState, useEffect, useCallback, useRef } from 'react';
import { UserEvent } from '@aws-agent/shared';
import { useAuth } from '../contexts/AuthContext';
import config from '../config';

export interface EventTrackingConfig {
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  enableOfflineQueue?: boolean;
}

export interface EventTrackingState {
  isOnline: boolean;
  queueSize: number;
  lastSent: Date | null;
  totalSent: number;
  errors: number;
}

export const useProductionEventTracking = (trackingConfig?: EventTrackingConfig) => {
  const { authState, firebaseUser, isFirebaseConfigured } = useAuth();
  const [state, setState] = useState<EventTrackingState>({
    isOnline: navigator.onLine,
    queueSize: 0,
    lastSent: null,
    totalSent: 0,
    errors: 0,
  });

  const eventQueueRef = useRef<UserEvent[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const failedAttemptsRef = useRef<number>(0);
  const lastErrorRef = useRef<number | null>(null);

  const trackingConfigRef = useRef<EventTrackingConfig>({
    batchSize: config.eventTracking.batchSize,
    flushInterval: config.eventTracking.flushInterval,
    maxRetries: config.eventTracking.retryAttempts,
    retryDelay: config.eventTracking.retryDelay,
    enableOfflineQueue: true,
    ...trackingConfig,
  });

  // Update online status
  useEffect(() => {
    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Send events to backend
  const sendEvents = useCallback(async (events: UserEvent[]): Promise<boolean | 'discard'> => {
    if (events.length === 0) return true;

    // Log events being sent
    const pricingEvents = events.filter(e => e.eventType === 'pricing_page_view');
    if (pricingEvents.length > 0) {
      console.log('🌐 [FRONTEND] Sending batch to backend:', {
        totalEvents: events.length,
        pricingPageViewEvents: pricingEvents.length,
        url: `${config.apiBaseUrl}/events/track/batch`,
        eventTypes: events.map(e => e.eventType)
      });
      pricingEvents.forEach(event => {
        console.log('🌐 [FRONTEND] pricing_page_view event details:', {
          eventType: event.eventType,
          userId: event.userId,
          eventData: event.eventData
        });
      });
    }

    try {
      // Get authentication token
      let authToken = '';
      if (config.environment === 'production' && isFirebaseConfigured && firebaseUser) {
        authToken = await firebaseUser.getIdToken();
      } else if (authState.isAuthenticated) {
        // In development or non-Firebase auth, use backend token
        authToken = localStorage.getItem('user_app_auth_token') || '';
      }

      // Backend expects events wrapped in an object with events array
      const payload = {
        events: events.map(event => ({
          eventId: event.eventId, // Include eventId
          eventType: event.eventType,
          userId: authState.user?.id || event.userId,
          sessionId: event.sessionId || generateSessionId(),
          timestamp: new Date(event.timestamp).getTime(), // Convert to milliseconds
          eventData: event.eventData,
          userContext: event.userContext,
          deviceInfo: event.deviceInfo
        })),
        batchId: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        timestamp: new Date().toISOString()
      };

      if (pricingEvents.length > 0) {
        console.log('🌐 [FRONTEND] Request payload:', JSON.stringify(payload, null, 2));
      }

      const response = await fetch(`${config.apiBaseUrl}/events/track/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
          'X-Client-Type': 'user-app',
          'X-Environment': config.environment,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Only log once per error type to avoid spam
        if (lastErrorRef.current !== response.status) {
          console.error('❌ [FRONTEND] Backend rejected events:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          lastErrorRef.current = response.status;
        }
        
        // Don't retry on 4xx errors (client errors) - these won't succeed on retry
        const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.shouldRetry = response.status >= 500; // Only retry server errors
        throw error;
      }

      if (pricingEvents.length > 0) {
        console.log('✅ [FRONTEND] Backend accepted events successfully');
      }

      setState(prev => ({
        ...prev,
        lastSent: new Date(),
        totalSent: prev.totalSent + events.length,
      }));

      // Reset failure counter on success
      failedAttemptsRef.current = 0;
      lastErrorRef.current = null;

      return true;
    } catch (error: any) {
      // Only log network errors once to avoid spam
      if (failedAttemptsRef.current === 0) {
        console.error('❌ [FRONTEND] Failed to send events:', error);
      }
      
      setState(prev => ({ ...prev, errors: prev.errors + 1 }));
      failedAttemptsRef.current++;
      
      // Return whether we should retry
      return error.shouldRetry === false ? 'discard' : false;
    }
  }, [authState, firebaseUser, isFirebaseConfigured]);

  // Flush event queue
  const flushQueue = useCallback(async (force = false) => {
    const { batchSize = 10, maxRetries = 3 } = trackingConfigRef.current;
    
    if (eventQueueRef.current.length === 0) return;
    if (!force && eventQueueRef.current.length < batchSize && state.isOnline) return;

    // Stop retrying if we've failed too many times
    if (failedAttemptsRef.current >= maxRetries) {
      console.warn('⚠️ [FRONTEND] Max retry attempts reached. Clearing queue to prevent spam.');
      eventQueueRef.current = [];
      setState(prev => ({ ...prev, queueSize: 0 }));
      failedAttemptsRef.current = 0;
      return;
    }

    const eventsToSend = eventQueueRef.current.splice(0, batchSize);
    
    setState(prev => ({ ...prev, queueSize: eventQueueRef.current.length }));

    const result = await sendEvents(eventsToSend);
    
    // If result is 'discard', don't retry (client error like 400)
    if (result === 'discard') {
      console.warn('⚠️ [FRONTEND] Discarding events due to client error (won\'t retry)');
      failedAttemptsRef.current = 0; // Reset counter
      return;
    }
    
    // If failed and should retry, re-queue events
    if (!result && trackingConfigRef.current.enableOfflineQueue) {
      eventQueueRef.current.unshift(...eventsToSend);
      setState(prev => ({ ...prev, queueSize: eventQueueRef.current.length }));
    }
  }, [sendEvents, state.isOnline]);

  // Schedule periodic flush
  const scheduleFlush = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
    }

    const { flushInterval = 5000 } = trackingConfigRef.current;
    
    flushTimeoutRef.current = setTimeout(() => {
      flushQueue();
      scheduleFlush();
    }, flushInterval);
  }, [flushQueue]);

  // Track event
  const trackEvent = useCallback((eventType: 'page_view' | 'feature_interaction' | 'video_engagement' | 'struggle_signal' | 'user_action' | 'error_event' | 'pricing_page_view' | 'checkout_abandon' | 'form_error' | 'video_complete', eventData: any, metadata?: any) => {
    if (!config.eventTracking.enabled) return;
    
    // 🐛 DEBUG MODE: Filter events if debugEventFilter is set
    const debugFilter = config.eventTracking.debugEventFilter;
    if (debugFilter && debugFilter.length > 0 && !debugFilter.includes(eventType)) {
      console.log(`🔇 [DEBUG] Skipping event type: ${eventType} (not in filter: ${debugFilter.join(', ')})`);
      return;
    }

    const event: UserEvent = {
      eventId: generateEventId(),
      userId: authState.user?.id || 'anonymous',
      sessionId: generateSessionId(),
      eventType,
      eventData,
      userContext: {
        deviceType: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent) ? 'mobile' : 'desktop',
        browserInfo: navigator.userAgent,
        location: window.location.href,
        persona: authState.user?.persona?.toString() || 'unknown',
        userSegment: 'default',
        sessionStage: 'active',
        previousActions: [],
      },
      deviceInfo: {
        platform: 'Web' as const,
        appVersion: '1.0.0',
        deviceModel: navigator.platform || 'unknown',
      },
      timestamp: new Date(),
    };

    eventQueueRef.current.push(event);
    setState(prev => ({ ...prev, queueSize: eventQueueRef.current.length }));

    // Flush immediately if batch size reached or offline
    const { batchSize = 10 } = trackingConfigRef.current;
    if (eventQueueRef.current.length >= batchSize || !state.isOnline) {
      flushQueue();
    }
  }, [authState.user, flushQueue, state.isOnline]);

  // Convenience methods for common events
  const trackPageView = useCallback((page: string, metadata?: any) => {
    trackEvent('page_view', { page }, metadata);
  }, [trackEvent]);

  const trackFeatureInteraction = useCallback((feature: string, action: string, success = true, metadata?: any) => {
    trackEvent('feature_interaction', { feature, action, success }, metadata);
  }, [trackEvent]);

  const trackStruggleSignal = useCallback((signal: string, context?: any, metadata?: any) => {
    trackEvent('struggle_signal', { signal, context }, metadata);
  }, [trackEvent]);

  const trackVideoEngagement = useCallback((videoId: string, action: string, progress?: number, metadata?: any) => {
    trackEvent('video_engagement', { videoId, action, progress }, metadata);
  }, [trackEvent]);

  const trackError = useCallback((error: string, context?: any, metadata?: any) => {
    trackEvent('error_event', { error, context }, metadata);
  }, [trackEvent]);

  // Initialize periodic flushing
  useEffect(() => {
    scheduleFlush();
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
    };
  }, [scheduleFlush]);

  // Flush on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushQueue(true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [flushQueue]);

  // Flush when coming back online
  useEffect(() => {
    if (state.isOnline && eventQueueRef.current.length > 0) {
      flushQueue();
    }
  }, [state.isOnline, flushQueue]);

  return {
    // State
    ...state,
    
    // Actions
    trackEvent,
    trackPageView,
    trackFeatureInteraction,
    trackStruggleSignal,
    trackVideoEngagement,
    trackError,
    flushQueue: () => flushQueue(true),
    
    // Utilities
    clearQueue: () => {
      eventQueueRef.current = [];
      setState(prev => ({ ...prev, queueSize: 0 }));
    },
  };
};

// Utility functions
const generateEventId = (): string => {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const generateSessionId = (): string => {
  // Get or create session ID
  let sessionId = sessionStorage.getItem('user_session_id');
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('user_session_id', sessionId);
  }
  return sessionId;
};