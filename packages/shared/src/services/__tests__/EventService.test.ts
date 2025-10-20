import { EventService } from '../EventService';
import { UserEvent } from '../../types';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    onLine: true,
    userAgent: 'test-agent',
    language: 'en-US',
    cookieEnabled: true
  },
  writable: true
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('Enhanced EventService', () => {
  let eventService: EventService;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAxiosInstance = {
      post: jest.fn().mockResolvedValue({ data: { success: true } }),
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    eventService = new EventService({
      baseURL: 'http://test-api.com',
      batchSize: 3,
      flushInterval: 1000,
      maxRetries: 2,
      enableOfflineQueue: true,
      maxOfflineEvents: 100
    });
  });

  afterEach(() => {
    eventService.destroy();
  });

  describe('Enhanced Event Tracking', () => {
    it('should track events with deduplication', async () => {
      const eventData = {
        userId: 'test-user',
        sessionId: 'test-session',
        eventType: 'feature_interaction' as const,
        eventData: { feature: 'test-feature', success: true },
        userContext: { deviceType: 'desktop', browserInfo: 'test', userSegment: 'test', sessionStage: 'active', previousActions: [] },
        deviceInfo: { platform: 'Web' as const, appVersion: '1.0.0', deviceModel: 'test' }
      };

      // Track the same event twice quickly
      await eventService.trackEvent(eventData);
      await eventService.trackEvent(eventData);

      // Should only send one event due to deduplication
      await eventService.flush();
      
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should batch events and flush when batch size is reached', async () => {
      const events = Array.from({ length: 3 }, (_, i) => ({
        userId: 'test-user',
        sessionId: 'test-session',
        eventType: 'user_action' as const,
        eventData: { action: `action-${i}` },
        userContext: { deviceType: 'desktop', browserInfo: 'test', userSegment: 'test', sessionStage: 'active', previousActions: [] },
        deviceInfo: { platform: 'Web' as const, appVersion: '1.0.0', deviceModel: 'test' }
      }));

      // Track events one by one
      for (const event of events) {
        await eventService.trackEvent(event);
      }

      // Should automatically flush when batch size (3) is reached
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/events/batch', expect.objectContaining({
        events: expect.arrayContaining([
          expect.objectContaining({ eventData: { action: 'action-0' } }),
          expect.objectContaining({ eventData: { action: 'action-1' } }),
          expect.objectContaining({ eventData: { action: 'action-2' } })
        ])
      }));
    });

    it('should immediately flush critical events', async () => {
      const criticalEvent = {
        userId: 'test-user',
        sessionId: 'test-session',
        eventType: 'error_event' as const,
        eventData: { errorMessage: 'Critical error occurred' },
        userContext: { deviceType: 'desktop', browserInfo: 'test', userSegment: 'test', sessionStage: 'active', previousActions: [] },
        deviceInfo: { platform: 'Web' as const, appVersion: '1.0.0', deviceModel: 'test' }
      };

      await eventService.trackEvent(criticalEvent);

      // Should flush immediately for critical events
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should handle offline queue when network is unavailable', async () => {
      // Simulate offline
      Object.defineProperty(window.navigator, 'onLine', {
        value: false,
        writable: true
      });

      const offlineEvent = {
        userId: 'test-user',
        sessionId: 'test-session',
        eventType: 'user_action' as const,
        eventData: { action: 'offline-action' },
        userContext: { deviceType: 'desktop', browserInfo: 'test', userSegment: 'test', sessionStage: 'active', previousActions: [] },
        deviceInfo: { platform: 'Web' as const, appVersion: '1.0.0', deviceModel: 'test' }
      };

      await eventService.trackEvent(offlineEvent);

      // Should not send request when offline
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();

      // Check that event stats reflect offline events
      const stats = eventService.getEventStats();
      expect(stats.offlineEvents).toBe(1);
    });

    it('should retry failed requests with exponential backoff', async () => {
      mockAxiosInstance.post
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { success: true } });

      const event = {
        userId: 'test-user',
        sessionId: 'test-session',
        eventType: 'user_action' as const,
        eventData: { action: 'retry-test' },
        userContext: { deviceType: 'desktop', browserInfo: 'test', userSegment: 'test', sessionStage: 'active', previousActions: [] },
        deviceInfo: { platform: 'Web' as const, appVersion: '1.0.0', deviceModel: 'test' }
      };

      await eventService.trackEvent(event);
      await eventService.flush();

      // Should retry the failed request
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
    });

    it('should provide accurate event statistics', async () => {
      const successEvent = {
        userId: 'test-user',
        sessionId: 'test-session',
        eventType: 'user_action' as const,
        eventData: { action: 'success-action' },
        userContext: { deviceType: 'desktop', browserInfo: 'test', userSegment: 'test', sessionStage: 'active', previousActions: [] },
        deviceInfo: { platform: 'Web' as const, appVersion: '1.0.0', deviceModel: 'test' }
      };

      await eventService.trackEvent(successEvent);
      await eventService.flush();

      const stats = eventService.getEventStats();
      expect(stats.totalEvents).toBe(1);
      expect(stats.successfulEvents).toBe(1);
      expect(stats.failedEvents).toBe(0);
    });

    it('should validate events before tracking', async () => {
      const invalidEvent = {
        userId: '', // Invalid - empty userId
        sessionId: 'test-session',
        eventType: 'user_action' as const,
        eventData: { action: 'invalid-action' },
        userContext: { deviceType: 'desktop', browserInfo: 'test', userSegment: 'test', sessionStage: 'active', previousActions: [] },
        deviceInfo: { platform: 'Web' as const, appVersion: '1.0.0', deviceModel: 'test' }
      };

      await eventService.trackEvent(invalidEvent);

      // Should not send invalid events
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();

      const stats = eventService.getEventStats();
      expect(stats.failedEvents).toBe(1);
    });
  });

  describe('Enhanced Tracking Methods', () => {
    it('should track user actions with enhanced context', async () => {
      await eventService.trackUserAction('test-user', 'test-session', 'button_click', {
        buttonId: 'submit-btn',
        formData: { field1: 'value1' }
      });

      await eventService.flush();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/events/batch', expect.objectContaining({
        events: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'user_action',
            eventData: expect.objectContaining({
              action: 'button_click',
              buttonId: 'submit-btn',
              formData: { field1: 'value1' }
            })
          })
        ])
      }));
    });

    it('should track errors with stack traces', async () => {
      const testError = new Error('Test error');
      testError.stack = 'Error: Test error\n    at test.js:1:1';

      await eventService.trackError('test-user', 'test-session', testError, {
        component: 'TestComponent'
      });

      await eventService.flush();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/events/batch', expect.objectContaining({
        events: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'error_event',
            eventData: expect.objectContaining({
              errorMessage: 'Test error',
              errorStack: 'Error: Test error\n    at test.js:1:1',
              component: 'TestComponent'
            })
          })
        ])
      }));
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle high-frequency events without blocking', async () => {
      const startTime = Date.now();
      
      // Track 100 events rapidly
      const promises = Array.from({ length: 100 }, (_, i) =>
        eventService.trackEvent({
          userId: 'test-user',
          sessionId: 'test-session',
          eventType: 'user_action' as const,
          eventData: { action: `rapid-action-${i}` },
          userContext: { deviceType: 'desktop', browserInfo: 'test', userSegment: 'test', sessionStage: 'active', previousActions: [] },
          deviceInfo: { platform: 'Web' as const, appVersion: '1.0.0', deviceModel: 'test' }
        })
      );

      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);

      // Should batch events efficiently
      expect(mockAxiosInstance.post).toHaveBeenCalled();
    });

    it('should clear event statistics', () => {
      const stats = eventService.getEventStats();
      expect(stats.totalEvents).toBeGreaterThanOrEqual(0);

      eventService.clearEventStats();

      const clearedStats = eventService.getEventStats();
      expect(clearedStats.totalEvents).toBe(0);
      expect(clearedStats.successfulEvents).toBe(0);
      expect(clearedStats.failedEvents).toBe(0);
      expect(clearedStats.offlineEvents).toBe(0);
    });

    it('should force flush all queued events', async () => {
      // Add events without reaching batch size
      await eventService.trackEvent({
        userId: 'test-user',
        sessionId: 'test-session',
        eventType: 'user_action' as const,
        eventData: { action: 'queued-action-1' },
        userContext: { deviceType: 'desktop', browserInfo: 'test', userSegment: 'test', sessionStage: 'active', previousActions: [] },
        deviceInfo: { platform: 'Web' as const, appVersion: '1.0.0', deviceModel: 'test' }
      });

      await eventService.trackEvent({
        userId: 'test-user',
        sessionId: 'test-session',
        eventType: 'user_action' as const,
        eventData: { action: 'queued-action-2' },
        userContext: { deviceType: 'desktop', browserInfo: 'test', userSegment: 'test', sessionStage: 'active', previousActions: [] },
        deviceInfo: { platform: 'Web' as const, appVersion: '1.0.0', deviceModel: 'test' }
      });

      // Should not have flushed yet (batch size is 3)
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();

      // Force flush
      await eventService.forceFlush();

      // Should now have sent the queued events
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });
  });
});