import { EventService } from '../EventService';

// Mock axios
const mockPost = jest.fn();
jest.mock('axios', () => ({
  create: () => ({
    post: mockPost
  }),
  isAxiosError: jest.fn()
}));

// Mock navigator
Object.defineProperty(global, 'navigator', {
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
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
});

describe('Enhanced EventService Functionality', () => {
  let eventService: EventService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({ data: { success: true } });
    
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

  it('should track events with enhanced batching', async () => {
    const events = [
      {
        userId: 'test-user',
        sessionId: 'test-session',
        eventType: 'user_action' as const,
        eventData: { action: 'button_click', buttonId: 'submit' },
        userContext: { 
          deviceType: 'desktop', 
          browserInfo: 'test', 
          userSegment: 'test', 
          sessionStage: 'active', 
          previousActions: [] 
        },
        deviceInfo: { platform: 'Web' as const, appVersion: '1.0.0', deviceModel: 'test' }
      },
      {
        userId: 'test-user',
        sessionId: 'test-session',
        eventType: 'feature_interaction' as const,
        eventData: { feature: 'calculator', success: true },
        userContext: { 
          deviceType: 'desktop', 
          browserInfo: 'test', 
          userSegment: 'test', 
          sessionStage: 'active', 
          previousActions: [] 
        },
        deviceInfo: { platform: 'Web' as const, appVersion: '1.0.0', deviceModel: 'test' }
      },
      {
        userId: 'test-user',
        sessionId: 'test-session',
        eventType: 'video_engagement' as const,
        eventData: { videoId: 'video-123', duration: 120, completionRate: 50 },
        userContext: { 
          deviceType: 'desktop', 
          browserInfo: 'test', 
          userSegment: 'test', 
          sessionStage: 'active', 
          previousActions: [] 
        },
        deviceInfo: { platform: 'Web' as const, appVersion: '1.0.0', deviceModel: 'test' }
      }
    ];

    // Track events
    for (const event of events) {
      await eventService.trackEvent(event);
    }

    // Should batch and send all events
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/events/batch', expect.objectContaining({
      events: expect.arrayContaining([
        expect.objectContaining({ eventData: { action: 'button_click', buttonId: 'submit' } }),
        expect.objectContaining({ eventData: { feature: 'calculator', success: true } }),
        expect.objectContaining({ eventData: { videoId: 'video-123', duration: 120, completionRate: 50 } })
      ])
    }));
  });

  it('should provide enhanced event statistics', async () => {
    const event = {
      userId: 'test-user',
      sessionId: 'test-session',
      eventType: 'user_action' as const,
      eventData: { action: 'test_action' },
      userContext: { 
        deviceType: 'desktop', 
        browserInfo: 'test', 
        userSegment: 'test', 
        sessionStage: 'active', 
        previousActions: [] 
      },
      deviceInfo: { platform: 'Web' as const, appVersion: '1.0.0', deviceModel: 'test' }
    };

    await eventService.trackEvent(event);
    await eventService.flush();

    const stats = eventService.getEventStats();
    
    expect(stats).toEqual(expect.objectContaining({
      totalEvents: 1,
      successfulEvents: 1,
      failedEvents: 0,
      offlineEvents: 0,
      queueSize: 0,
      offlineQueueSize: 0,
      isOnline: true,
      lastFlushTime: expect.any(Number)
    }));
  });

  it('should handle enhanced user action tracking', async () => {
    await eventService.trackUserAction('test-user', 'test-session', 'form_submit', {
      formId: 'contact-form',
      fields: ['name', 'email'],
      validationErrors: []
    });

    await eventService.flush();

    expect(mockPost).toHaveBeenCalledWith('/events/batch', expect.objectContaining({
      events: expect.arrayContaining([
        expect.objectContaining({
          eventType: 'user_action',
          eventData: expect.objectContaining({
            action: 'form_submit',
            formId: 'contact-form',
            fields: ['name', 'email'],
            validationErrors: []
          })
        })
      ])
    }));
  });

  it('should handle enhanced error tracking', async () => {
    const testError = new Error('Test error message');
    testError.stack = 'Error: Test error message\n    at test.js:1:1';

    await eventService.trackError('test-user', 'test-session', testError, {
      component: 'TestComponent',
      props: { id: 'test-123' }
    });

    await eventService.flush();

    expect(mockPost).toHaveBeenCalledWith('/events/batch', expect.objectContaining({
      events: expect.arrayContaining([
        expect.objectContaining({
          eventType: 'error_event',
          eventData: expect.objectContaining({
            errorMessage: 'Test error message',
            errorStack: 'Error: Test error message\n    at test.js:1:1',
            component: 'TestComponent',
            props: { id: 'test-123' }
          })
        })
      ])
    }));
  });

  it('should clear statistics when requested', () => {
    // Get initial stats
    const initialStats = eventService.getEventStats();
    expect(initialStats.totalEvents).toBe(0);

    // Clear stats
    eventService.clearEventStats();

    // Verify stats are cleared
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
      eventData: { action: 'queued_action_1' },
      userContext: { 
        deviceType: 'desktop', 
        browserInfo: 'test', 
        userSegment: 'test', 
        sessionStage: 'active', 
        previousActions: [] 
      },
      deviceInfo: { platform: 'Web' as const, appVersion: '1.0.0', deviceModel: 'test' }
    });

    await eventService.trackEvent({
      userId: 'test-user',
      sessionId: 'test-session',
      eventType: 'user_action' as const,
      eventData: { action: 'queued_action_2' },
      userContext: { 
        deviceType: 'desktop', 
        browserInfo: 'test', 
        userSegment: 'test', 
        sessionStage: 'active', 
        previousActions: [] 
      },
      deviceInfo: { platform: 'Web' as const, appVersion: '1.0.0', deviceModel: 'test' }
    });

    // Should not have flushed yet (batch size is 3)
    expect(mockPost).not.toHaveBeenCalled();

    // Force flush
    await eventService.forceFlush();

    // Should now have sent the queued events
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/events/batch', expect.objectContaining({
      events: expect.arrayContaining([
        expect.objectContaining({ eventData: { action: 'queued_action_1' } }),
        expect.objectContaining({ eventData: { action: 'queued_action_2' } })
      ])
    }));
  });
});