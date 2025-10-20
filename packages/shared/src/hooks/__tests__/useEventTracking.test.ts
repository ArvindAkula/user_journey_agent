import { renderHook, act } from '@testing-library/react';
import { useEventTracking } from '../useEventTracking';
import { EventService } from '../../services';

// Mock EventService
jest.mock('../../services/EventService');
const MockedEventService = EventService as jest.MockedClass<typeof EventService>;

// Mock navigator and performance
Object.defineProperty(window, 'navigator', {
  value: {
    onLine: true,
    userAgent: 'test-agent',
    language: 'en-US',
    cookieEnabled: true
  },
  writable: true
});

Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now())
  },
  writable: true
});

describe('Enhanced useEventTracking', () => {
  let mockEventService: jest.Mocked<EventService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockEventService = {
      trackEvent: jest.fn(),
      trackPageView: jest.fn(),
      trackFeatureInteraction: jest.fn(),
      trackVideoEngagement: jest.fn(),
      trackStruggleSignal: jest.fn(),
      trackUserAction: jest.fn(),
      trackError: jest.fn(),
      getEventStats: jest.fn().mockReturnValue({
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        offlineEvents: 0,
        queueSize: 0,
        offlineQueueSize: 0,
        isOnline: true,
        lastFlushTime: Date.now()
      }),
      flush: jest.fn(),
      forceFlush: jest.fn(),
      clearEventStats: jest.fn(),
      destroy: jest.fn()
    } as any;

    MockedEventService.mockImplementation(() => mockEventService);
  });

  describe('Enhanced Event Tracking', () => {
    it('should track events with rate limiting', async () => {
      const { result } = renderHook(() =>
        useEventTracking({
          eventService: mockEventService,
          userId: 'test-user',
          sessionId: 'test-session',
          enableAutoContext: true,
          enableStruggleDetection: true
        })
      );

      // Track many events rapidly (should be rate limited)
      for (let i = 0; i < 150; i++) {
        act(() => {
          result.current.trackUserAction(`rapid-action-${i}`, { index: i });
        });
      }

      // Should be rate limited after 100 events
      expect(result.current.isRateLimited).toBe(true);
    });

    it('should detect struggle signals with enhanced logic', async () => {
      const { result } = renderHook(() =>
        useEventTracking({
          eventService: mockEventService,
          userId: 'test-user',
          sessionId: 'test-session',
          enableAutoContext: true,
          enableStruggleDetection: true
        })
      );

      // Simulate multiple failed interactions
      act(() => {
        result.current.trackFeatureInteraction('test-feature', false, { attempt: 1 });
      });

      act(() => {
        result.current.trackFeatureInteraction('test-feature', false, { attempt: 2 });
      });

      act(() => {
        result.current.trackFeatureInteraction('test-feature', false, { attempt: 3 });
      });

      // Should have triggered struggle signal
      expect(mockEventService.trackStruggleSignal).toHaveBeenCalled();

      // Check interaction stats
      const stats = result.current.getInteractionStats('test-feature');
      expect(stats.interactions).toBe(3);
      expect(stats.errors).toBe(3);
      expect(stats.isStruggling).toBe(true);
    });

    it('should track form interactions comprehensively', () => {
      const { result } = renderHook(() =>
        useEventTracking({
          eventService: mockEventService,
          userId: 'test-user',
          sessionId: 'test-session',
          enableAutoContext: true,
          enableStruggleDetection: true
        })
      );

      act(() => {
        result.current.trackFormInteraction('login-form', 'email', 'focus');
      });

      act(() => {
        result.current.trackFormInteraction('login-form', 'email', 'change', 'user@example.com');
      });

      act(() => {
        result.current.trackFormInteraction('login-form', 'email', 'blur');
      });

      expect(mockEventService.trackEvent).toHaveBeenCalledTimes(3);
      expect(mockEventService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'feature_interaction',
          eventData: expect.objectContaining({
            feature: 'form_login-form',
            action: 'focus_email',
            fieldName: 'email',
            formId: 'login-form'
          })
        })
      );
    });

    it('should track button clicks with enhanced context', () => {
      const { result } = renderHook(() =>
        useEventTracking({
          eventService: mockEventService,
          userId: 'test-user',
          sessionId: 'test-session',
          enableAutoContext: true,
          enableStruggleDetection: true
        })
      );

      act(() => {
        result.current.trackButtonClick('submit-btn', 'Submit Form', {
          formValid: true,
          attemptCount: 1
        });
      });

      expect(mockEventService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user_action',
          eventData: expect.objectContaining({
            action: 'button_click',
            buttonId: 'submit-btn',
            buttonText: 'Submit Form',
            formValid: true,
            attemptCount: 1
          })
        })
      );
    });

    it('should track performance metrics', () => {
      const { result } = renderHook(() =>
        useEventTracking({
          eventService: mockEventService,
          userId: 'test-user',
          sessionId: 'test-session',
          enableAutoContext: true,
          enableStruggleDetection: true
        })
      );

      act(() => {
        result.current.trackPerformanceMetric('page_load_time', 1250, 'ms');
      });

      expect(mockEventService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user_action',
          eventData: expect.objectContaining({
            action: 'performance_metric',
            metricName: 'page_load_time',
            value: 1250,
            unit: 'ms'
          })
        })
      );
    });

    it('should track session events with comprehensive data', () => {
      const { result } = renderHook(() =>
        useEventTracking({
          eventService: mockEventService,
          userId: 'test-user',
          sessionId: 'test-session',
          enableAutoContext: true,
          enableStruggleDetection: true
        })
      );

      act(() => {
        result.current.trackSessionEvent('session_start', {
          entryPoint: 'homepage',
          referrer: 'google.com'
        });
      });

      expect(mockEventService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user_action',
          eventData: expect.objectContaining({
            action: 'session_start',
            sessionDuration: expect.any(Number),
            totalEvents: expect.any(Number),
            strugglingFeaturesCount: 0,
            entryPoint: 'homepage',
            referrer: 'google.com'
          })
        })
      );
    });

    it('should provide comprehensive session statistics', () => {
      const { result } = renderHook(() =>
        useEventTracking({
          eventService: mockEventService,
          userId: 'test-user',
          sessionId: 'test-session',
          enableAutoContext: true,
          enableStruggleDetection: true
        })
      );

      // Track some events to build up session data
      act(() => {
        result.current.trackUserAction('test-action', { data: 'test' });
      });

      act(() => {
        result.current.trackFeatureInteraction('test-feature', false);
      });

      const sessionStats = result.current.getSessionStats();

      expect(sessionStats).toEqual(
        expect.objectContaining({
          sessionDuration: expect.any(Number),
          totalEvents: expect.any(Number),
          strugglingFeatures: expect.any(Array),
          isRateLimited: expect.any(Boolean),
          eventServiceStats: expect.any(Object)
        })
      );
    });

    it('should reset struggle detection on successful interaction', () => {
      const { result } = renderHook(() =>
        useEventTracking({
          eventService: mockEventService,
          userId: 'test-user',
          sessionId: 'test-session',
          enableAutoContext: true,
          enableStruggleDetection: true
        })
      );

      // Simulate failed interactions
      act(() => {
        result.current.trackFeatureInteraction('test-feature', false);
      });

      act(() => {
        result.current.trackFeatureInteraction('test-feature', false);
      });

      // Check that feature is struggling
      let stats = result.current.getInteractionStats('test-feature');
      expect(stats.isStruggling).toBe(true);

      // Simulate successful interaction
      act(() => {
        result.current.trackFeatureInteraction('test-feature', true);
      });

      // Should reset struggle state
      stats = result.current.getInteractionStats('test-feature');
      expect(stats.isStruggling).toBe(false);
      expect(stats.errors).toBe(0);
    });

    it('should enrich context automatically when enabled', () => {
      const { result } = renderHook(() =>
        useEventTracking({
          eventService: mockEventService,
          userId: 'test-user',
          sessionId: 'test-session',
          enableAutoContext: true,
          enableStruggleDetection: true
        })
      );

      act(() => {
        result.current.trackUserAction('test-action');
      });

      expect(mockEventService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userContext: expect.objectContaining({
            sessionDuration: expect.any(Number),
            strugglingFeatures: expect.any(Array),
            eventCount: expect.any(Number),
            timestamp: expect.any(String),
            timezone: expect.any(String),
            language: expect.any(String)
          })
        })
      );
    });

    it('should handle missing userId or sessionId gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { result } = renderHook(() =>
        useEventTracking({
          eventService: mockEventService,
          userId: undefined,
          sessionId: undefined,
          enableAutoContext: true,
          enableStruggleDetection: true
        })
      );

      act(() => {
        result.current.trackUserAction('test-action');
      });

      expect(consoleSpy).toHaveBeenCalledWith('useEventTracking: userId and sessionId are required');
      expect(mockEventService.trackEvent).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Video Tracking Enhancement', () => {
    it('should track video engagement with comprehensive metrics', () => {
      const { result } = renderHook(() =>
        useEventTracking({
          eventService: mockEventService,
          userId: 'test-user',
          sessionId: 'test-session',
          enableAutoContext: true,
          enableStruggleDetection: true
        })
      );

      act(() => {
        result.current.trackVideoEngagement('video-123', {
          action: 'play',
          currentTime: 30,
          duration: 300,
          completionRate: 10,
          quality: 'HD',
          playbackSpeed: 1.0
        });
      });

      expect(mockEventService.trackVideoEngagement).toHaveBeenCalledWith(
        'test-user',
        'test-session',
        'video-123',
        expect.objectContaining({
          action: 'play',
          currentTime: 30,
          duration: 300,
          completionRate: 10,
          quality: 'HD',
          playbackSpeed: 1.0
        })
      );
    });
  });
});