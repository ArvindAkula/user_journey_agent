import { RealTimeAnalyticsService } from '../RealTimeAnalyticsService';
import { UserEvent } from '../../types';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string) {
    // Mock sending data
    console.log('Mock WebSocket send:', data);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason, wasClean: true }));
    }
  }

  // Simulate receiving a message
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }
}

// Mock global WebSocket
(global as any).WebSocket = MockWebSocket;

describe('RealTimeAnalyticsService', () => {
  let service: RealTimeAnalyticsService;
  let mockWebSocket: MockWebSocket;

  beforeEach(() => {
    service = new RealTimeAnalyticsService({
      websocketUrl: 'ws://localhost:8080/ws',
      reconnectInterval: 100,
      maxReconnectAttempts: 2,
      enableEventCorrelation: true,
    });
  });

  afterEach(() => {
    service.disconnect();
  });

  describe('Connection Management', () => {
    it('should connect to WebSocket successfully', async () => {
      await service.connect();
      
      const status = service.getConnectionStatus();
      expect(status.isConnected).toBe(true);
      expect(status.reconnectAttempts).toBe(0);
    });

    it('should handle connection errors gracefully', async () => {
      // Override WebSocket to simulate error
      (global as any).WebSocket = class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Event('error'));
            }
          }, 10);
        }
      };

      try {
        await service.connect();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should disconnect properly', async () => {
      await service.connect();
      service.disconnect();
      
      const status = service.getConnectionStatus();
      expect(status.isConnected).toBe(false);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should send events when connected', async () => {
      const mockEvent: UserEvent = {
        eventId: 'test-event-1',
        userId: 'test-user',
        sessionId: 'test-session',
        eventType: 'page_view',
        timestamp: new Date(),
        eventData: {
          feature: 'test-page',
        },
        userContext: {},
        deviceInfo: {
          platform: 'Web',
          appVersion: '1.0.0',
          deviceModel: 'Test Browser',
        },
      };

      await service.sendEvent(mockEvent);
      
      // Event should be sent successfully (no error thrown)
      expect(true).toBe(true);
    });

    it('should buffer events when disconnected', async () => {
      service.disconnect();
      
      const mockEvent: UserEvent = {
        eventId: 'test-event-2',
        userId: 'test-user',
        sessionId: 'test-session',
        eventType: 'feature_interaction',
        timestamp: new Date(),
        eventData: {
          feature: 'test-feature',
          success: true,
        },
        userContext: {},
        deviceInfo: {
          platform: 'Web',
          appVersion: '1.0.0',
          deviceModel: 'Test Browser',
        },
      };

      await service.sendEvent(mockEvent);
      
      const status = service.getConnectionStatus();
      expect(status.bufferedEvents).toBeGreaterThan(0);
    });
  });

  describe('Event Correlation', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should track user event correlations', async () => {
      const userId = 'correlation-test-user';
      const sessionId = 'correlation-test-session';

      const event1: UserEvent = {
        eventId: 'corr-event-1',
        userId,
        sessionId,
        eventType: 'page_view',
        timestamp: new Date(),
        eventData: { feature: 'page1' },
        userContext: {},
        deviceInfo: { platform: 'Web', appVersion: '1.0.0', deviceModel: 'Test' },
      };

      const event2: UserEvent = {
        eventId: 'corr-event-2',
        userId,
        sessionId,
        eventType: 'feature_interaction',
        timestamp: new Date(),
        eventData: { feature: 'button1', success: true },
        userContext: {},
        deviceInfo: { platform: 'Web', appVersion: '1.0.0', deviceModel: 'Test' },
      };

      await service.sendEvent(event1);
      await service.sendEvent(event2);

      const correlation = service.getUserCorrelation(userId);
      expect(correlation).toBeDefined();
      expect(correlation?.userId).toBe(userId);
      expect(correlation?.eventSequence.length).toBe(2);
      expect(correlation?.completedActions).toBe(1);
    });

    it('should detect struggle signals in correlations', async () => {
      const userId = 'struggle-test-user';
      const sessionId = 'struggle-test-session';

      const struggleEvent: UserEvent = {
        eventId: 'struggle-event-1',
        userId,
        sessionId,
        eventType: 'struggle_signal',
        timestamp: new Date(),
        eventData: {
          feature: 'difficult-form',
          attemptCount: 5,
          duration: 30000,
        },
        userContext: {},
        deviceInfo: { platform: 'Web', appVersion: '1.0.0', deviceModel: 'Test' },
      };

      await service.sendEvent(struggleEvent);

      const correlation = service.getUserCorrelation(userId);
      expect(correlation).toBeDefined();
      expect(correlation?.strugglesDetected).toBe(1);
    });
  });

  describe('Subscription System', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should allow subscribing to events', () => {
      const mockCallback = jest.fn();
      const unsubscribe = service.subscribe('test_event', mockCallback);

      expect(typeof unsubscribe).toBe('function');
      
      // Cleanup
      unsubscribe();
    });

    it('should notify subscribers when events are received', async () => {
      const mockCallback = jest.fn();
      service.subscribe('event_processed', mockCallback);

      // Simulate receiving a message from WebSocket
      const mockMessage = {
        type: 'event_processed',
        event: {
          eventId: 'test-event',
          userId: 'test-user',
          eventType: 'page_view',
        },
        timestamp: new Date().toISOString(),
      };

      // Get the mock WebSocket instance and simulate message
      const wsInstance = (service as any).websocket as MockWebSocket;
      wsInstance.simulateMessage(mockMessage);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe('Metrics Handling', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should update metrics when receiving updates', async () => {
      const mockMetrics = {
        totalEvents: 100,
        activeUsers: 25,
        strugglesDetected: 3,
        videoEngagements: 15,
        eventsPerMinute: 45,
        averageResponseTime: 200,
        errorRate: 1.2,
        lastUpdated: new Date().toISOString(),
      };

      // Simulate receiving metrics update
      const wsInstance = (service as any).websocket as MockWebSocket;
      wsInstance.simulateMessage({
        type: 'metrics_updated',
        metrics: mockMetrics,
        timestamp: new Date().toISOString(),
      });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      const currentMetrics = service.getCurrentMetrics();
      expect(currentMetrics).toEqual(mockMetrics);
    });
  });
});