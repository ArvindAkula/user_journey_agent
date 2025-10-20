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
  apiBaseUrl: validateEnvVar('REACT_APP_API_BASE_URL', process.env.REACT_APP_API_BASE_URL) || 'http://localhost:8080',
  analyticsApiBaseUrl: validateEnvVar('REACT_APP_ANALYTICS_API_BASE_URL', process.env.REACT_APP_ANALYTICS_API_BASE_URL) || 'http://localhost:8080',
  websocketUrl: validateEnvVar('REACT_APP_WEBSOCKET_URL', process.env.REACT_APP_WEBSOCKET_URL) || 'ws://localhost:8080/ws/analytics',
  realtimeEndpoint: validateEnvVar('REACT_APP_REALTIME_ENDPOINT', process.env.REACT_APP_REALTIME_ENDPOINT) || 'ws://localhost:8080/ws/realtime',
  
  // Application Configuration
  environment: process.env.REACT_APP_ENVIRONMENT || 'development',
  appName: process.env.REACT_APP_APP_NAME || 'Analytics Dashboard',
  version: process.env.REACT_APP_VERSION || '1.0.0',
  appType: process.env.REACT_APP_APP_TYPE || 'analytics',
  
  // Production Optimizations
  production: {
    generateSourceMap: parseBoolean(process.env.GENERATE_SOURCEMAP, true),
    enableProfiler: parseBoolean(process.env.REACT_APP_ENABLE_PROFILER, false),
    enableDevtools: parseBoolean(process.env.REACT_APP_ENABLE_DEVTOOLS, true),
  },
  
  // Analytics Specific Configuration
  analytics: {
    refreshInterval: parseNumber(process.env.REACT_APP_ANALYTICS_REFRESH_INTERVAL, 30000),
    exportMaxRecords: parseNumber(process.env.REACT_APP_EXPORT_MAX_RECORDS, 10000),
    chartAnimationDuration: parseNumber(process.env.REACT_APP_CHART_ANIMATION_DURATION, 300),
    dataRetentionDays: parseNumber(process.env.REACT_APP_DATA_RETENTION_DAYS, 90),
    maxConcurrentExports: parseNumber(process.env.REACT_APP_MAX_CONCURRENT_EXPORTS, 3),
    realtimeBufferSize: parseNumber(process.env.REACT_APP_REALTIME_BUFFER_SIZE, 1000),
    dataCacheTtl: parseNumber(process.env.REACT_APP_DATA_CACHE_TTL, 300000),
  },
  
  // Authentication Configuration
  auth: {
    provider: process.env.REACT_APP_AUTH_PROVIDER || 'jwt',
    endpoint: validateEnvVar('REACT_APP_AUTH_ENDPOINT', process.env.REACT_APP_AUTH_ENDPOINT) || 'http://localhost:8080/api/auth/analytics',
    tokenRefreshInterval: parseNumber(process.env.REACT_APP_TOKEN_REFRESH_INTERVAL, 3600000),
    sessionTimeout: parseNumber(process.env.REACT_APP_SESSION_TIMEOUT, 7200000),
    autoLogoutWarning: parseNumber(process.env.REACT_APP_AUTO_LOGOUT_WARNING, 300000),
  },
  
  // Firebase Configuration (Optional for Analytics Dashboard)
  firebase: {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY || '',
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || '',
  },
  
  // Security Configuration
  security: {
    enableCors: parseBoolean(process.env.REACT_APP_ENABLE_CORS, false),
    allowedOrigins: process.env.REACT_APP_ALLOWED_ORIGINS?.split(',') || [],
    secureCookies: parseBoolean(process.env.REACT_APP_SECURE_COOKIES, false),
    enableCsp: parseBoolean(process.env.REACT_APP_ENABLE_CSP, false),
  },
  
  // Performance Configuration
  performance: {
    paginationSize: parseNumber(process.env.REACT_APP_PAGINATION_SIZE, 50),
    chartMaxDataPoints: parseNumber(process.env.REACT_APP_CHART_MAX_DATA_POINTS, 1000),
    debounceDelay: parseNumber(process.env.REACT_APP_DEBOUNCE_DELAY, 300),
    enableServiceWorker: parseBoolean(process.env.REACT_APP_ENABLE_SERVICE_WORKER, false),
    cacheStrategy: process.env.REACT_APP_CACHE_STRATEGY || 'network-first',
    preloadCriticalResources: parseBoolean(process.env.REACT_APP_PRELOAD_CRITICAL_RESOURCES, false),
    enableCompression: parseBoolean(process.env.REACT_APP_ENABLE_COMPRESSION, false),
    virtualScrolling: parseBoolean(process.env.REACT_APP_VIRTUAL_SCROLLING, false),
    lazyLoading: parseBoolean(process.env.REACT_APP_LAZY_LOADING, false),
  },
  
  // Feature Flags
  features: {
    amazonQ: parseBoolean(process.env.REACT_APP_ENABLE_AMAZON_Q, true),
    export: parseBoolean(process.env.REACT_APP_ENABLE_EXPORT, true),
    realtime: parseBoolean(process.env.REACT_APP_ENABLE_REALTIME, true),
    advancedFilters: parseBoolean(process.env.REACT_APP_ENABLE_ADVANCED_FILTERS, true),
    userSegmentation: parseBoolean(process.env.REACT_APP_ENABLE_USER_SEGMENTATION, true),
    predictiveAnalytics: parseBoolean(process.env.REACT_APP_ENABLE_PREDICTIVE_ANALYTICS, false),
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
  },
  
  // Monitoring Configuration
  monitoring: {
    enablePerformanceMonitoring: parseBoolean(process.env.REACT_APP_ENABLE_PERFORMANCE_MONITORING, false),
    performanceEndpoint: process.env.REACT_APP_PERFORMANCE_ENDPOINT || '',
  }
};

// Validate required configuration in production
if (config.environment === 'production') {
  const requiredVars = [
    'REACT_APP_API_BASE_URL',
    'REACT_APP_ANALYTICS_API_BASE_URL',
    'REACT_APP_WEBSOCKET_URL',
    'REACT_APP_AUTH_ENDPOINT'
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
    { name: 'REACT_APP_ANALYTICS_API_BASE_URL', value: config.analyticsApiBaseUrl, protocol: 'https' },
    { name: 'REACT_APP_AUTH_ENDPOINT', value: config.auth.endpoint, protocol: 'https' },
    { name: 'REACT_APP_WEBSOCKET_URL', value: config.websocketUrl, protocol: 'wss' },
    { name: 'REACT_APP_REALTIME_ENDPOINT', value: config.realtimeEndpoint, protocol: 'wss' }
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