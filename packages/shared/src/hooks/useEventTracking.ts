import { useCallback, useRef, useEffect, useState } from 'react';
import { EventService } from '../services';
import { UserEvent, TimeRange } from '../types';
import { sanitizeEventData, enrichEventContext, validateStruggleSignal, validateEventRate } from '../utils/eventValidator';

export interface UseEventTrackingConfig {
  eventService: EventService;
  userId?: string;
  sessionId?: string;
  enableAutoContext?: boolean;
  enableStruggleDetection?: boolean;
}

export const useEventTracking = (config: UseEventTrackingConfig) => {
  const { eventService, userId, sessionId, enableAutoContext = true, enableStruggleDetection = true } = config;
  const interactionCounts = useRef<Map<string, number>>(new Map());
  const errorCounts = useRef<Map<string, number>>(new Map());
  const lastInteractionTime = useRef<Map<string, number>>(new Map());
  const eventHistory = useRef<UserEvent[]>([]);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const sessionStartTime = useRef<number>(Date.now());
  const strugglingFeatures = useRef<Set<string>>(new Set());

  const trackEvent = useCallback((event: Omit<UserEvent, 'eventId' | 'timestamp'>) => {
    if (!userId || !sessionId) {
      console.warn('useEventTracking: userId and sessionId are required');
      return;
    }

    // Check rate limiting
    if (!validateEventRate(eventHistory.current, 60000, 100)) {
      if (!isRateLimited) {
        console.warn('Event rate limit exceeded, throttling events');
        setIsRateLimited(true);
        setTimeout(() => setIsRateLimited(false), 60000); // Reset after 1 minute
      }
      return;
    }

    // Sanitize event data
    const sanitizedEventData = sanitizeEventData(event.eventData);

    // Enrich user context if enabled
    const enrichedUserContext = enableAutoContext 
      ? enrichEventContext({
          ...event.userContext,
          sessionDuration: Date.now() - sessionStartTime.current,
          strugglingFeatures: Array.from(strugglingFeatures.current),
          eventCount: eventHistory.current.length
        })
      : event.userContext;

    const fullEvent = {
      ...event,
      eventData: sanitizedEventData,
      userContext: enrichedUserContext,
      userId,
      sessionId,
    };

    // Add to event history for rate limiting and analytics
    const eventWithTimestamp = {
      ...fullEvent,
      eventId: `temp-${Date.now()}`,
      timestamp: new Date()
    };
    eventHistory.current.push(eventWithTimestamp);

    // Keep only recent events in memory (last 1000 events)
    if (eventHistory.current.length > 1000) {
      eventHistory.current = eventHistory.current.slice(-1000);
    }

    eventService.trackEvent(fullEvent);
  }, [eventService, userId, sessionId, enableAutoContext, isRateLimited]);

  const trackPageView = useCallback((page: string, context?: any) => {
    const enrichedContext = enableAutoContext ? enrichEventContext(context) : context;
    eventService.trackPageView(userId!, sessionId!, page, enrichedContext);
  }, [eventService, userId, sessionId, enableAutoContext]);

  const trackFeatureInteraction = useCallback((
    feature: string, 
    success: boolean, 
    context?: any
  ) => {
    // Update interaction tracking for struggle detection
    if (enableStruggleDetection) {
      const currentCount = interactionCounts.current.get(feature) || 0;
      const newCount = currentCount + 1;
      interactionCounts.current.set(feature, newCount);
      lastInteractionTime.current.set(feature, Date.now());

      // Auto-detect struggle signals with enhanced logic
      if (!success) {
        const errorCount = errorCounts.current.get(feature) || 0;
        const newErrorCount = errorCount + 1;
        errorCounts.current.set(feature, newErrorCount);

        // Mark feature as struggling
        strugglingFeatures.current.add(feature);

        // Enhanced struggle detection criteria
        const isStruggling = (
          newErrorCount >= 2 || // Multiple errors
          newCount >= 4 || // Many attempts
          (newErrorCount >= 1 && newCount >= 3) // Error with multiple attempts
        );

        if (isStruggling) {
          setTimeout(() => {
            trackStruggleSignal(feature, {
              attemptCount: newCount,
              errorCount: newErrorCount,
              autoDetected: true,
              struggleIntensity: Math.min(newErrorCount + (newCount / 2), 10),
              timeSpent: Date.now() - (lastInteractionTime.current.get(feature) || Date.now()),
              ...context
            });
          }, 0);
        }
      } else {
        // Reset error count on success and remove from struggling features
        errorCounts.current.set(feature, 0);
        strugglingFeatures.current.delete(feature);
      }
    }

    const enrichedContext = enableAutoContext ? enrichEventContext({
      ...context,
      attemptCount: interactionCounts.current.get(feature) || 1,
      errorCount: errorCounts.current.get(feature) || 0,
      isStruggling: strugglingFeatures.current.has(feature)
    }) : context;

    eventService.trackFeatureInteraction(userId!, sessionId!, feature, success, enrichedContext);
  }, [eventService, userId, sessionId, enableAutoContext, enableStruggleDetection]);

  const trackVideoEngagement = useCallback((videoId: string, engagementData: any) => {
    const enrichedData = enableAutoContext ? enrichEventContext(engagementData) : engagementData;
    eventService.trackVideoEngagement(userId!, sessionId!, videoId, enrichedData);
  }, [eventService, userId, sessionId, enableAutoContext]);

  const trackStruggleSignal = useCallback((feature: string, signalData: any) => {
    const enrichedData = enableAutoContext ? enrichEventContext(signalData) : signalData;
    eventService.trackStruggleSignal(userId!, sessionId!, feature, enrichedData);
  }, [eventService, userId, sessionId, enableAutoContext]);

  const trackUserAction = useCallback((action: string, actionData?: any) => {
    trackEvent({
      userId: userId!,
      sessionId: sessionId!,
      eventType: 'user_action',
      eventData: {
        action,
        ...sanitizeEventData(actionData)
      },
      userContext: enableAutoContext ? enrichEventContext({}) : {},
      deviceInfo: {
        platform: 'Web' as const,
        appVersion: '1.0.0',
        deviceModel: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
      }
    });
  }, [trackEvent, enableAutoContext, userId, sessionId]);

  const trackError = useCallback((error: Error | string, context?: any) => {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'object' && error.stack ? error.stack : undefined;

    trackEvent({
      userId: userId!,
      sessionId: sessionId!,
      eventType: 'error_event',
      eventData: {
        errorMessage,
        errorStack,
        ...sanitizeEventData(context)
      },
      userContext: enableAutoContext ? enrichEventContext(context) : context || {},
      deviceInfo: {
        platform: 'Web' as const,
        appVersion: '1.0.0',
        deviceModel: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
      }
    });
  }, [trackEvent, enableAutoContext, userId, sessionId]);

  const getInteractionStats = useCallback((feature?: string) => {
    if (feature) {
      return {
        interactions: interactionCounts.current.get(feature) || 0,
        errors: errorCounts.current.get(feature) || 0,
        lastInteraction: lastInteractionTime.current.get(feature),
        isStruggling: strugglingFeatures.current.has(feature)
      };
    }

    // Return stats for all features
    const stats: Record<string, any> = {};
    interactionCounts.current.forEach((count, key) => {
      stats[key] = {
        interactions: count,
        errors: errorCounts.current.get(key) || 0,
        lastInteraction: lastInteractionTime.current.get(key),
        isStruggling: strugglingFeatures.current.has(key)
      };
    });
    return stats;
  }, []);

  // Enhanced tracking methods
  const trackFormInteraction = useCallback((formId: string, fieldName: string, action: 'focus' | 'blur' | 'change' | 'submit', value?: any) => {
    trackEvent({
      userId: userId!,
      sessionId: sessionId!,
      eventType: 'feature_interaction',
      eventData: {
        feature: `form_${formId}`,
        action: `${action}_${fieldName}`,
        fieldName,
        formId,
        value: typeof value === 'string' ? value.substring(0, 100) : value, // Truncate for privacy
        success: true
      },
      userContext: enableAutoContext ? enrichEventContext({}) : {},
      deviceInfo: {
        platform: 'Web' as const,
        appVersion: '1.0.0',
        deviceModel: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
      }
    });
  }, [trackEvent, enableAutoContext, userId, sessionId]);

  const trackButtonClick = useCallback((buttonId: string, buttonText?: string, context?: any) => {
    trackEvent({
      userId: userId!,
      sessionId: sessionId!,
      eventType: 'user_action',
      eventData: {
        action: 'button_click',
        buttonId,
        buttonText,
        ...context
      },
      userContext: enableAutoContext ? enrichEventContext(context) : context || {},
      deviceInfo: {
        platform: 'Web' as const,
        appVersion: '1.0.0',
        deviceModel: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
      }
    });
  }, [trackEvent, enableAutoContext, userId, sessionId]);

  const trackPerformanceMetric = useCallback((metricName: string, value: number, unit: string = 'ms') => {
    trackEvent({
      userId: userId!,
      sessionId: sessionId!,
      eventType: 'user_action',
      eventData: {
        action: 'performance_metric',
        metricName,
        value,
        unit,
        timestamp: Date.now()
      },
      userContext: enableAutoContext ? enrichEventContext({}) : {},
      deviceInfo: {
        platform: 'Web' as const,
        appVersion: '1.0.0',
        deviceModel: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
      }
    });
  }, [trackEvent, enableAutoContext, userId, sessionId]);

  const trackSessionEvent = useCallback((eventType: 'session_start' | 'session_end' | 'session_timeout' | 'session_extend', data?: any) => {
    const sessionDuration = Date.now() - sessionStartTime.current;
    
    trackEvent({
      userId: userId!,
      sessionId: sessionId!,
      eventType: 'user_action',
      eventData: {
        action: eventType,
        sessionDuration,
        totalEvents: eventHistory.current.length,
        strugglingFeaturesCount: strugglingFeatures.current.size,
        ...data
      },
      userContext: enableAutoContext ? enrichEventContext(data) : data || {},
      deviceInfo: {
        platform: 'Web' as const,
        appVersion: '1.0.0',
        deviceModel: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
      }
    });
  }, [trackEvent, enableAutoContext, userId, sessionId]);

  const getSessionStats = useCallback(() => {
    return {
      sessionDuration: Date.now() - sessionStartTime.current,
      totalEvents: eventHistory.current.length,
      strugglingFeatures: Array.from(strugglingFeatures.current),
      isRateLimited,
      eventServiceStats: eventService.getEventStats()
    };
  }, [isRateLimited, eventService]);

  // Cleanup function to track session end
  useEffect(() => {
    return () => {
      trackSessionEvent('session_end');
    };
  }, [trackSessionEvent]);

  return {
    trackEvent,
    trackPageView,
    trackFeatureInteraction,
    trackVideoEngagement,
    trackStruggleSignal,
    trackUserAction,
    trackError,
    trackFormInteraction,
    trackButtonClick,
    trackPerformanceMetric,
    trackSessionEvent,
    getInteractionStats,
    getSessionStats,
    isRateLimited,
  };
};

export const usePageTracking = (
  config: UseEventTrackingConfig,
  pageName: string, 
  additionalData?: Record<string, any>
) => {
  const { trackPageView } = useEventTracking(config);

  useEffect(() => {
    trackPageView(pageName, additionalData);
  }, [trackPageView, pageName, additionalData]);
};

export const useVideoTracking = (config: UseEventTrackingConfig, videoId: string) => {
  const { trackVideoEngagement } = useEventTracking(config);
  const startTimeRef = useRef<number>(0);
  const pausePointsRef = useRef<number[]>([]);
  const skipSegmentsRef = useRef<TimeRange[]>([]);

  const trackPlay = useCallback((currentTime: number = 0) => {
    startTimeRef.current = currentTime;
    trackVideoEngagement(videoId, {
      watchDuration: 0,
      pausePoints: pausePointsRef.current,
      skipSegments: skipSegmentsRef.current
    });
  }, [trackVideoEngagement, videoId]);

  const trackPause = useCallback((currentTime: number, duration: number) => {
    pausePointsRef.current.push(currentTime);
    const watchDuration = currentTime - startTimeRef.current;
    
    trackVideoEngagement(videoId, {
      duration,
      watchDuration,
      completionRate: duration > 0 ? (currentTime / duration) * 100 : 0,
      pausePoints: pausePointsRef.current,
      skipSegments: skipSegmentsRef.current
    });
  }, [trackVideoEngagement, videoId]);

  const trackSeek = useCallback((fromTime: number, toTime: number) => {
    if (Math.abs(toTime - fromTime) > 5) {
      skipSegmentsRef.current.push({ start: fromTime, end: toTime });
    }
  }, []);

  const trackComplete = useCallback((duration: number) => {
    trackVideoEngagement(videoId, {
      duration,
      watchDuration: duration,
      completionRate: 100,
      pausePoints: pausePointsRef.current,
      skipSegments: skipSegmentsRef.current
    });
  }, [trackVideoEngagement, videoId]);

  return {
    trackPlay,
    trackPause,
    trackSeek,
    trackComplete,
  };
};