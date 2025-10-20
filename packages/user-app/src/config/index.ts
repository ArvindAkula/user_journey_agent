// Environment validation helper
const validateEnvVar = (name: string, value: string | undefined, required: boolean = false): string => {
  if (required && !value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value || '';
};

// Parse boolean environment variables
const parseBoolean = (value: string | undefined, defaultValue: boolean = false): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

// Parse number environment variables
const parseNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const config = {
  // Server Configuration
  apiBaseUrl: validateEnvVar('REACT_APP_API_BASE_URL', process.env.REACT_APP_API_BASE_URL) || 'http://localhost:8080/api',
  websocketUrl: validateEnvVar('REACT_APP_WEBSOCKET_URL', process.env.REACT_APP_WEBSOCKET_URL) || 'ws://localhost:8080/ws',
  
  // Application Configuration
  environment: process.env.REACT_APP_ENVIRONMENT || 'development',
  appName: process.env.REACT_APP_APP_NAME || 'User Application',
  version: process.env.REACT_APP_VERSION || '1.0.0',
  appType: process.env.REACT_APP_APP_TYPE || 'user',
  
  // Production Optimizations
  production: {
    generateSourceMap: parseBoolean(process.env.GENERATE_SOURCEMAP, true),
    enableProfiler: parseBoolean(process.env.REACT_APP_ENABLE_PROFILER, false),
    enableDevtools: parseBoolean(process.env.REACT_APP_ENABLE_DEVTOOLS, true),
  },
  
  // User App Specific Configuration
  eventTracking: {
    batchSize: parseNumber(process.env.REACT_APP_EVENT_BATCH_SIZE, 10),
    flushInterval: parseNumber(process.env.REACT_APP_EVENT_FLUSH_INTERVAL, 5000),
    offlineQueueSize: parseNumber(process.env.REACT_APP_OFFLINE_QUEUE_SIZE, 100),
    enabled: parseBoolean(process.env.REACT_APP_ANALYTICS_ENABLED, true),
    retryAttempts: parseNumber(process.env.REACT_APP_EVENT_RETRY_ATTEMPTS, 3),
    retryDelay: parseNumber(process.env.REACT_APP_EVENT_RETRY_DELAY, 1000),
    
    // 🐛 DEBUG MODE: Limit events to specific types for easier debugging
    // Set to empty array [] to track all events, or specify event types to track
    debugEventFilter: process.env.REACT_APP_DEBUG_EVENT_FILTER 
      ? process.env.REACT_APP_DEBUG_EVENT_FILTER.split(',')
      : ['pricing_page_view'], // Only track pricing_page_view events by default for debugging
  },
  
  // Debug Configuration
  debugMode: parseBoolean(process.env.REACT_APP_DEBUG_MODE, false),
  
  // Firebase Configuration
  firebase: {
    apiKey: validateEnvVar('REACT_APP_FIREBASE_API_KEY', process.env.REACT_APP_FIREBASE_API_KEY),
    authDomain: validateEnvVar('REACT_APP_FIREBASE_AUTH_DOMAIN', process.env.REACT_APP_FIREBASE_AUTH_DOMAIN),
    projectId: validateEnvVar('REACT_APP_FIREBASE_PROJECT_ID', process.env.REACT_APP_FIREBASE_PROJECT_ID),
    storageBucket: validateEnvVar('REACT_APP_FIREBASE_STORAGE_BUCKET', process.env.REACT_APP_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: validateEnvVar('REACT_APP_FIREBASE_MESSAGING_SENDER_ID', process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID),
    appId: validateEnvVar('REACT_APP_FIREBASE_APP_ID', process.env.REACT_APP_FIREBASE_APP_ID)
  },
  
  // Security Configuration
  security: {
    enableCors: parseBoolean(process.env.REACT_APP_ENABLE_CORS, false),
    allowedOrigins: process.env.REACT_APP_ALLOWED_ORIGINS?.split(',') || [],
    secureCookies: parseBoolean(process.env.REACT_APP_SECURE_COOKIES, false),
  },
  
  // Performance Configuration
  performance: {
    enableServiceWorker: parseBoolean(process.env.REACT_APP_ENABLE_SERVICE_WORKER, false),
    cacheStrategy: process.env.REACT_APP_CACHE_STRATEGY || 'cache-first',
    preloadCriticalResources: parseBoolean(process.env.REACT_APP_PRELOAD_CRITICAL_RESOURCES, false),
  },
  
  // Feature Flags
  features: {
    videoLibrary: parseBoolean(process.env.REACT_APP_ENABLE_VIDEO_LIBRARY, true),
    calculator: parseBoolean(process.env.REACT_APP_ENABLE_CALCULATOR, true),
    documentUpload: parseBoolean(process.env.REACT_APP_ENABLE_DOCUMENT_UPLOAD, true),
    personaSwitcher: parseBoolean(process.env.REACT_APP_ENABLE_PERSONA_SWITCHER, true),
  },
  
  // Error Reporting
  errorReporting: {
    enabled: parseBoolean(process.env.REACT_APP_ENABLE_ERROR_REPORTING, false),
    endpoint: process.env.REACT_APP_ERROR_REPORTING_ENDPOINT || '',
  },
  
  // CDN Configuration
  cdn: {
    baseUrl: process.env.REACT_APP_CDN_BASE_URL || '',
    staticAssetsUrl: process.env.REACT_APP_STATIC_ASSETS_URL || '',
  }
};

// Validate required configuration in production
if (config.environment === 'production') {
  const requiredVars = [
    'REACT_APP_API_BASE_URL',
    'REACT_APP_WEBSOCKET_URL',
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_AUTH_DOMAIN',
    'REACT_APP_FIREBASE_PROJECT_ID'
  ];
  
  const errors: string[] = [];
  
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  });
  
  // Validate URL formats in production
  const urlVars = [
    { name: 'REACT_APP_API_BASE_URL', value: config.apiBaseUrl, protocol: 'https' },
    { name: 'REACT_APP_WEBSOCKET_URL', value: config.websocketUrl, protocol: 'wss' }
  ];
  
  urlVars.forEach(({ name, value, protocol }) => {
    if (value && !value.startsWith(`${protocol}://`)) {
      errors.push(`${name} should use ${protocol.toUpperCase()} in production: ${value}`);
    }
  });
  
  if (errors.length > 0) {
    console.error('Production configuration errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid production configuration. Please check your environment variables.');
    }
  }
}

export default config;