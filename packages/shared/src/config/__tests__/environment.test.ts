/**
 * Unit tests for Environment Configuration
 * Tests environment detection, configuration loading, and validation
 */

import {
  Environment,
  EnvironmentManager,
  getEnvironment,
  isDevelopment,
  isProduction,
  getConfig,
  validateConfiguration
} from '../environment';

describe('EnvironmentManager', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    EnvironmentManager.resetConfiguration();
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Environment Detection', () => {
    test('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      const env = getEnvironment();
      expect(env).toBe(Environment.DEVELOPMENT);
    });

    test('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      const env = getEnvironment();
      expect(env).toBe(Environment.PRODUCTION);
    });

    test('should default to development for unknown environment', () => {
      process.env.NODE_ENV = 'test';
      const env = getEnvironment();
      expect(env).toBe(Environment.DEVELOPMENT);
    });

    test('should default to development when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;
      const env = getEnvironment();
      expect(env).toBe(Environment.DEVELOPMENT);
    });
  });

  describe('Environment Helpers', () => {
    test('isDevelopment should return true in development', () => {
      process.env.NODE_ENV = 'development';
      expect(isDevelopment()).toBe(true);
      expect(isProduction()).toBe(false);
    });

    test('isProduction should return true in production', () => {
      process.env.NODE_ENV = 'production';
      expect(isProduction()).toBe(true);
      expect(isDevelopment()).toBe(false);
    });
  });

  describe('Configuration Loading', () => {
    test('should load development configuration', () => {
      process.env.NODE_ENV = 'development';
      process.env.REACT_APP_API_BASE_URL = 'http://localhost:8080/api';
      process.env.REACT_APP_FIREBASE_USE_EMULATOR = 'true';
      process.env.REACT_APP_FIREBASE_EMULATOR_HOST = 'localhost';
      process.env.REACT_APP_FIREBASE_EMULATOR_PORT = '9099';

      const config = getConfig();

      expect(config.environment).toBe(Environment.DEVELOPMENT);
      expect(config.apiBaseUrl).toBe('http://localhost:8080/api');
      expect(config.firebaseConfig.useEmulator).toBe(true);
      expect(config.firebaseConfig.emulatorHost).toBe('localhost');
      expect(config.firebaseConfig.emulatorPort).toBe(9099);
    });

    test('should load production configuration', () => {
      process.env.NODE_ENV = 'production';
      process.env.REACT_APP_API_BASE_URL = 'https://api.journey-analytics.io/api';
      process.env.REACT_APP_FIREBASE_USE_EMULATOR = 'false';
      process.env.REACT_APP_FIREBASE_API_KEY = 'prod-api-key';
      process.env.REACT_APP_FIREBASE_PROJECT_ID = 'prod-project';
      process.env.REACT_APP_FIREBASE_APP_ID = 'prod-app-id';

      const config = getConfig();

      expect(config.environment).toBe(Environment.PRODUCTION);
      expect(config.apiBaseUrl).toBe('https://api.journey-analytics.io/api');
      expect(config.firebaseConfig.useEmulator).toBe(false);
      expect(config.firebaseConfig.apiKey).toBe('prod-api-key');
    });

    test('should use default values when environment variables are missing', () => {
      process.env.NODE_ENV = 'development';
      
      const config = getConfig();

      expect(config.apiBaseUrl).toBe('http://localhost:8080/api');
      expect(config.websocketUrl).toBe('ws://localhost:8080/ws');
    });

    test('should cache configuration after first load', () => {
      process.env.NODE_ENV = 'development';
      process.env.REACT_APP_API_BASE_URL = 'http://localhost:8080/api';

      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toBe(config2);
    });
  });

  describe('Service Endpoint Resolution', () => {
    test('should resolve development API endpoint', () => {
      process.env.NODE_ENV = 'development';
      process.env.REACT_APP_API_BASE_URL = 'http://localhost:8080/api';

      const config = getConfig();

      expect(config.apiBaseUrl).toBe('http://localhost:8080/api');
    });

    test('should resolve production API endpoint', () => {
      process.env.NODE_ENV = 'production';
      process.env.REACT_APP_API_BASE_URL = 'https://api.journey-analytics.io/api';

      const config = getConfig();

      expect(config.apiBaseUrl).toBe('https://api.journey-analytics.io/api');
    });

    test('should resolve WebSocket URL', () => {
      process.env.NODE_ENV = 'development';
      process.env.REACT_APP_WEBSOCKET_URL = 'ws://localhost:8080/ws';

      const config = getConfig();

      expect(config.websocketUrl).toBe('ws://localhost:8080/ws');
    });
  });

  describe('Firebase Configuration', () => {
    test('should configure Firebase emulator in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.REACT_APP_FIREBASE_USE_EMULATOR = 'true';
      process.env.REACT_APP_FIREBASE_EMULATOR_HOST = 'localhost';
      process.env.REACT_APP_FIREBASE_EMULATOR_PORT = '9099';

      const config = getConfig();

      expect(config.firebaseConfig.useEmulator).toBe(true);
      expect(config.firebaseConfig.emulatorHost).toBe('localhost');
      expect(config.firebaseConfig.emulatorPort).toBe(9099);
    });

    test('should not use Firebase emulator in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.REACT_APP_FIREBASE_USE_EMULATOR = 'false';

      const config = getConfig();

      expect(config.firebaseConfig.useEmulator).toBe(false);
    });

    test('should load Firebase credentials', () => {
      process.env.REACT_APP_FIREBASE_API_KEY = 'test-api-key';
      process.env.REACT_APP_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
      process.env.REACT_APP_FIREBASE_PROJECT_ID = 'test-project';
      process.env.REACT_APP_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
      process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID = '123456';
      process.env.REACT_APP_FIREBASE_APP_ID = '1:123456:web:abc';

      const config = getConfig();

      expect(config.firebaseConfig.apiKey).toBe('test-api-key');
      expect(config.firebaseConfig.authDomain).toBe('test.firebaseapp.com');
      expect(config.firebaseConfig.projectId).toBe('test-project');
      expect(config.firebaseConfig.storageBucket).toBe('test.appspot.com');
      expect(config.firebaseConfig.messagingSenderId).toBe('123456');
      expect(config.firebaseConfig.appId).toBe('1:123456:web:abc');
    });
  });

  describe('Feature Flags', () => {
    test('should load feature flags from environment', () => {
      process.env.REACT_APP_ENABLE_ANALYTICS = 'true';
      process.env.REACT_APP_ENABLE_VIDEO_TRACKING = 'true';
      process.env.REACT_APP_ENABLE_INTERVENTIONS = 'false';

      const config = getConfig();

      expect(config.features.enableAnalytics).toBe(true);
      expect(config.features.enableVideoTracking).toBe(true);
      expect(config.features.enableInterventions).toBe(false);
    });

    test('should default feature flags to false when not set', () => {
      const config = getConfig();

      expect(config.features.enableAnalytics).toBe(false);
      expect(config.features.enableVideoTracking).toBe(false);
      expect(config.features.enableInterventions).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate complete configuration', () => {
      process.env.NODE_ENV = 'production';
      process.env.REACT_APP_API_BASE_URL = 'https://api.journey-analytics.io/api';
      process.env.REACT_APP_FIREBASE_API_KEY = 'test-api-key';
      process.env.REACT_APP_FIREBASE_PROJECT_ID = 'test-project';
      process.env.REACT_APP_FIREBASE_APP_ID = '1:123456:web:abc';

      const validation = validateConfiguration();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect missing API URL', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.REACT_APP_API_BASE_URL;

      const validation = validateConfiguration();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('REACT_APP_API_BASE_URL is required');
    });

    test('should detect missing Firebase configuration in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.REACT_APP_API_BASE_URL = 'https://api.journey-analytics.io/api';
      delete process.env.REACT_APP_FIREBASE_API_KEY;
      delete process.env.REACT_APP_FIREBASE_PROJECT_ID;
      delete process.env.REACT_APP_FIREBASE_APP_ID;

      const validation = validateConfiguration();

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors).toContain('REACT_APP_FIREBASE_API_KEY is required');
      expect(validation.errors).toContain('REACT_APP_FIREBASE_PROJECT_ID is required');
      expect(validation.errors).toContain('REACT_APP_FIREBASE_APP_ID is required');
    });

    test('should not require Firebase configuration when using emulator', () => {
      process.env.NODE_ENV = 'development';
      process.env.REACT_APP_API_BASE_URL = 'http://localhost:8080/api';
      process.env.REACT_APP_FIREBASE_USE_EMULATOR = 'true';
      delete process.env.REACT_APP_FIREBASE_API_KEY;

      const validation = validateConfiguration();

      expect(validation.valid).toBe(true);
    });
  });

  describe('Debug Mode', () => {
    test('should enable debug mode in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.REACT_APP_DEBUG_MODE = 'true';

      const config = getConfig();

      expect(config.debugMode).toBe(true);
    });

    test('should disable debug mode in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.REACT_APP_DEBUG_MODE = 'false';

      const config = getConfig();

      expect(config.debugMode).toBe(false);
    });
  });

  describe('Configuration Reset', () => {
    test('should reset configuration', () => {
      process.env.NODE_ENV = 'development';
      process.env.REACT_APP_API_BASE_URL = 'http://localhost:8080/api';

      const config1 = getConfig();
      EnvironmentManager.resetConfiguration();
      
      process.env.REACT_APP_API_BASE_URL = 'http://localhost:9000/api';
      const config2 = getConfig();

      expect(config1.apiBaseUrl).toBe('http://localhost:8080/api');
      expect(config2.apiBaseUrl).toBe('http://localhost:9000/api');
    });
  });
});
