import { UserEvent } from '../../types/UserEvent';
import { UserProfile } from '../../types/UserProfile';
import { AnalyticsFilter } from '../../types/AnalyticsFilter';
import { StruggleSignal } from '../../types/StruggleSignal';
import { VideoEngagement } from '../../types/VideoEngagement';

/**
 * Test utilities for creating mock data and common test helpers
 */

// Mock data factories
export const createMockUserEvent = (overrides: Partial<UserEvent> = {}): UserEvent => ({
  eventId: 'event123',
  userId: 'user123',
  sessionId: 'session123',
  eventType: 'page_view',
  timestamp: new Date('2023-01-15T10:00:00Z'),
  eventData: {
    feature: 'calculator',
    attemptCount: 1,
    duration: 30,
    success: true
  },
  userContext: {
    deviceType: 'desktop',
    browserInfo: 'Chrome 91.0',
    location: 'US',
    persona: 'beginner',
    userSegment: 'new_user',
    sessionStage: 'exploration',
    previousActions: ['page_view']
  },
  ...overrides
});

export const createMockUserProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  userId: 'user123',
  createdAt: new Date('2023-01-01'),
  lastActiveAt: new Date('2023-01-15'),
  userSegment: 'new_user',
  preferences: {
    contentCategories: ['tutorial', 'advanced'],
    videoTopics: ['getting_started', 'features'],
    preferredInteractionStyle: 'guided'
  },
  behaviorMetrics: {
    totalSessions: 10,
    avgSessionDuration: 300,
    featureAdoptionRate: 0.7,
    supportInteractionCount: 2
  },
  riskFactors: {
    exitRiskScore: 25.5,
    lastRiskAssessment: new Date('2023-01-15'),
    riskContributors: ['low_engagement']
  },
  interventionHistory: [],
  ...overrides
});

export const createMockAnalyticsFilter = (overrides: Partial<AnalyticsFilter> = {}): AnalyticsFilter => ({
  dateRange: {
    start: new Date('2023-01-01'),
    end: new Date('2023-01-31')
  },
  userSegments: ['new_users'],
  platforms: ['web'],
  features: ['calculator'],
  ...overrides
});

export const createMockStruggleSignal = (overrides: Partial<StruggleSignal> = {}): StruggleSignal => ({
  id: 'struggle123',
  userId: 'user123',
  sessionId: 'session123',
  feature: 'calculator',
  signalType: 'repeated_attempts',
  severity: 'medium',
  timestamp: new Date('2023-01-15T10:00:00Z'),
  context: {
    attemptCount: 3,
    timeSpent: 120,
    errorsEncountered: ['Invalid input', 'Calculation failed'],
    userActions: ['click', 'type', 'submit']
  },
  resolved: false,
  ...overrides
});

export const createMockVideoEngagement = (overrides: Partial<VideoEngagement> = {}): VideoEngagement => ({
  id: 'engagement123',
  userId: 'user123',
  videoId: 'video123',
  sessionId: 'session123',
  startTime: new Date('2023-01-15T10:00:00Z'),
  endTime: new Date('2023-01-15T10:05:00Z'),
  watchDuration: 300,
  totalDuration: 600,
  completionPercentage: 0.5,
  interactions: [
    { type: 'play', timestamp: new Date('2023-01-15T10:00:00Z') },
    { type: 'pause', timestamp: new Date('2023-01-15T10:02:30Z') },
    { type: 'resume', timestamp: new Date('2023-01-15T10:03:00Z') }
  ],
  quality: '720p',
  ...overrides
});

// Mock API responses
export const createMockApiResponse = <T>(data: T, status = 200) => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config: {}
});

export const createMockApiError = (status: number, message: string) => ({
  response: {
    status,
    data: { message },
    statusText: status === 404 ? 'Not Found' : status === 500 ? 'Internal Server Error' : 'Error'
  },
  message,
  name: 'AxiosError'
});

// Test helpers
export const waitFor = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

export const flushPromises = (): Promise<void> => 
  new Promise(resolve => setImmediate(resolve));

// Mock localStorage
export const createMockLocalStorage = () => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] || null)
  };
};

// Mock WebSocket
export class MockWebSocket {
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
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  // Test helper methods
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Date utilities for tests
export const createDateRange = (daysAgo: number, daysFromNow = 0) => ({
  start: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
  end: new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000)
});

// Assertion helpers
export const expectToBeWithinRange = (actual: number, expected: number, tolerance = 0.01) => {
  expect(actual).toBeGreaterThanOrEqual(expected - tolerance);
  expect(actual).toBeLessThanOrEqual(expected + tolerance);
};

export const expectDateToBeRecent = (date: Date, withinSeconds = 5) => {
  const now = new Date();
  const diffInSeconds = Math.abs(now.getTime() - date.getTime()) / 1000;
  expect(diffInSeconds).toBeLessThan(withinSeconds);
};

// Mock implementations for common services
export const createMockAnalyticsService = () => ({
  getMetricsOverview: jest.fn(),
  getUserJourneyData: jest.fn(),
  getStruggleSignals: jest.fn(),
  getVideoEngagementData: jest.fn(),
  exportAnalyticsData: jest.fn(),
  getRealTimeMetrics: jest.fn()
});

export const createMockAuthService = () => ({
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  getCurrentUser: jest.fn(),
  onAuthStateChanged: jest.fn(),
  resetPassword: jest.fn(),
  updateUserProfile: jest.fn(),
  isAuthenticated: jest.fn()
});

export const createMockEventService = () => ({
  trackEvent: jest.fn(),
  trackBatch: jest.fn(),
  getEventHistory: jest.fn(),
  validateEvent: jest.fn(),
  queueEvent: jest.fn(),
  flushQueue: jest.fn()
});

export const createMockUserService = () => ({
  getUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
  createUserProfile: jest.fn(),
  deleteUserProfile: jest.fn(),
  getUserProgress: jest.fn(),
  updateUserProgress: jest.fn(),
  getUserPreferences: jest.fn(),
  updateUserPreferences: jest.fn()
});

// React Testing Library custom render with providers
export const createTestWrapper = (initialProps = {}) => {
  // This would be implemented in individual app test files with JSX
  // For now, returning a simple mock function
  return jest.fn();
};

// Performance testing helpers
export const measurePerformance = async (fn: () => Promise<void> | void): Promise<number> => {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return end - start;
};

export const expectPerformanceWithin = async (
  fn: () => Promise<void> | void,
  maxMs: number
) => {
  const duration = await measurePerformance(fn);
  expect(duration).toBeLessThan(maxMs);
};