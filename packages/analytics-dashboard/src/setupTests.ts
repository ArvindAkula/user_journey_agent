// Jest setup file for analytics dashboard tests
import '@testing-library/jest-dom';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  root: Element | null = null;
  rootMargin: string = '';
  thresholds: ReadonlyArray<number> = [];
  
  constructor() {}
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
};

// Mock Chart.js
jest.mock('chart.js/auto', () => ({
  Chart: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
    update: jest.fn(),
    resize: jest.fn(),
    data: { datasets: [] },
    options: {}
  })),
  registerables: []
}));

// Mock Firebase
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: null,
  })),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

jest.mock('firebase/analytics', () => ({
  getAnalytics: jest.fn(),
  logEvent: jest.fn(),
}));

// Mock React Router
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({
    pathname: '/dashboard',
    search: '',
    hash: '',
    state: null,
  }),
}));

// Mock WebSocket for real-time features
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
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  send(data: string) {}
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

global.WebSocket = MockWebSocket as any;

// Mock environment variables
process.env.REACT_APP_ENVIRONMENT = 'test';
process.env.REACT_APP_API_BASE_URL = 'http://localhost:8080';
process.env.REACT_APP_ANALYTICS_API_URL = 'http://localhost:8080/analytics';
process.env.REACT_APP_FIREBASE_API_KEY = 'test-api-key';
process.env.REACT_APP_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
process.env.REACT_APP_FIREBASE_PROJECT_ID = 'test-project';

// Mock timers for tests that need them
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// Global test utilities for analytics
global.createMockAnalyticsData = (overrides = {}) => ({
  totalUsers: 1000,
  activeUsers: 750,
  conversionRate: 0.15,
  avgSessionDuration: 300,
  bounceRate: 0.35,
  pageViews: 15000,
  ...overrides
});

global.createMockJourneyData = () => [
  { step: 'Landing', users: 1000, dropoffRate: 0.1, conversionRate: 0.9 },
  { step: 'Signup', users: 900, dropoffRate: 0.15, conversionRate: 0.85 },
  { step: 'Onboarding', users: 765, dropoffRate: 0.12, conversionRate: 0.88 },
  { step: 'Active', users: 673, dropoffRate: 0.08, conversionRate: 0.92 }
];

global.createMockStruggleSignal = (overrides = {}) => ({
  id: 'struggle-123',
  userId: 'user-456',
  feature: 'calculator',
  signalType: 'multiple_attempts',
  severity: 'medium',
  timestamp: new Date(),
  resolved: false,
  ...overrides
});

global.createMockRealTimeData = (overrides = {}) => ({
  activeUsers: 145,
  currentSessions: 89,
  eventsPerMinute: 234,
  topPages: [
    { path: '/calculator', users: 45, percentage: 31.0 },
    { path: '/videos', users: 38, percentage: 26.2 }
  ],
  recentEvents: [
    {
      id: '1',
      type: 'page_view',
      userId: 'user123',
      timestamp: new Date(),
      data: { page: '/calculator' }
    }
  ],
  ...overrides
});

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOMTestUtils.act') ||
       args[0].includes('Warning: An invalid form control'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('componentWillReceiveProps') ||
       args[0].includes('componentWillUpdate') ||
       args[0].includes('Chart.js'))
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Mock Canvas for Chart.js
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(() => ({ data: new Array(4) })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => []),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  fillText: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  measureText: jest.fn(() => ({ width: 0 })),
  transform: jest.fn(),
  rect: jest.fn(),
  clip: jest.fn(),
})) as any;