/**
 * Environment Variable Validation for User App
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface EnvValidationConfig {
  required: string[];
  optional: string[];
  production: string[];
}

const ENV_CONFIG: EnvValidationConfig = {
  required: [
    'REACT_APP_API_BASE_URL',
    'REACT_APP_WEBSOCKET_URL',
    'REACT_APP_ENVIRONMENT',
    'REACT_APP_APP_NAME',
    'REACT_APP_VERSION'
  ],
  optional: [
    'REACT_APP_EVENT_BATCH_SIZE',
    'REACT_APP_EVENT_FLUSH_INTERVAL',
    'REACT_APP_OFFLINE_QUEUE_SIZE',
    'REACT_APP_ANALYTICS_ENABLED',
    'REACT_APP_EVENT_RETRY_ATTEMPTS',
    'REACT_APP_EVENT_RETRY_DELAY',
    'REACT_APP_DEBUG_MODE',
    'REACT_APP_ENABLE_PROFILER',
    'REACT_APP_ENABLE_DEVTOOLS',
    'REACT_APP_ENABLE_VIDEO_LIBRARY',
    'REACT_APP_ENABLE_CALCULATOR',
    'REACT_APP_ENABLE_DOCUMENT_UPLOAD',
    'REACT_APP_ENABLE_PERSONA_SWITCHER',
    'REACT_APP_ENABLE_CORS',
    'REACT_APP_ALLOWED_ORIGINS',
    'REACT_APP_SECURE_COOKIES',
    'REACT_APP_ENABLE_SERVICE_WORKER',
    'REACT_APP_CACHE_STRATEGY',
    'REACT_APP_PRELOAD_CRITICAL_RESOURCES',
    'REACT_APP_ENABLE_ERROR_REPORTING',
    'REACT_APP_ERROR_REPORTING_ENDPOINT',
    'REACT_APP_CDN_BASE_URL',
    'REACT_APP_STATIC_ASSETS_URL'
  ],
  production: [
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_AUTH_DOMAIN',
    'REACT_APP_FIREBASE_PROJECT_ID',
    'REACT_APP_FIREBASE_STORAGE_BUCKET',
    'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
    'REACT_APP_FIREBASE_APP_ID'
  ]
};

/**
 * Validates environment variables for the user app
 */
export const validateEnvironment = (): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.REACT_APP_ENVIRONMENT === 'production';

  // Check required variables
  ENV_CONFIG.required.forEach(varName => {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  });

  // Check production-specific required variables
  if (isProduction) {
    ENV_CONFIG.production.forEach(varName => {
      if (!process.env[varName]) {
        errors.push(`Missing required production environment variable: ${varName}`);
      }
    });
  }

  // Check optional variables and provide warnings
  ENV_CONFIG.optional.forEach(varName => {
    if (!process.env[varName]) {
      warnings.push(`Optional environment variable not set: ${varName} (using default)`);
    }
  });

  // Validate URL formats
  const urlVars = [
    'REACT_APP_API_BASE_URL',
    'REACT_APP_WEBSOCKET_URL',
    'REACT_APP_ERROR_REPORTING_ENDPOINT',
    'REACT_APP_CDN_BASE_URL',
    'REACT_APP_STATIC_ASSETS_URL'
  ];
  
  urlVars.forEach(varName => {
    const value = process.env[varName];
    if (value && !isValidUrl(value)) {
      errors.push(`Invalid URL format for ${varName}: ${value}`);
    }
  });

  // Validate numeric configurations
  const numericVars = [
    'REACT_APP_EVENT_BATCH_SIZE',
    'REACT_APP_EVENT_FLUSH_INTERVAL',
    'REACT_APP_OFFLINE_QUEUE_SIZE',
    'REACT_APP_EVENT_RETRY_ATTEMPTS',
    'REACT_APP_EVENT_RETRY_DELAY'
  ];

  numericVars.forEach(varName => {
    const value = process.env[varName];
    if (value && isNaN(parseInt(value, 10))) {
      errors.push(`Invalid numeric value for ${varName}: ${value}`);
    }
  });

  // Validate cache strategy
  const cacheStrategy = process.env.REACT_APP_CACHE_STRATEGY;
  if (cacheStrategy && !['cache-first', 'network-first', 'cache-only', 'network-only'].includes(cacheStrategy)) {
    warnings.push(`Unknown cache strategy: ${cacheStrategy}`);
  }

  // Production-specific validations
  if (isProduction) {
    // Ensure HTTPS URLs in production
    const httpsVars = ['REACT_APP_API_BASE_URL', 'REACT_APP_ERROR_REPORTING_ENDPOINT', 'REACT_APP_CDN_BASE_URL'];
    httpsVars.forEach(varName => {
      const value = process.env[varName];
      if (value && !value.startsWith('https://')) {
        warnings.push(`${varName} should use HTTPS in production: ${value}`);
      }
    });

    // Ensure WSS for WebSocket URLs in production
    const wsVars = ['REACT_APP_WEBSOCKET_URL'];
    wsVars.forEach(varName => {
      const value = process.env[varName];
      if (value && !value.startsWith('wss://')) {
        warnings.push(`${varName} should use WSS in production: ${value}`);
      }
    });

    // Validate Firebase configuration completeness
    const firebaseVars = ENV_CONFIG.production;
    const missingFirebaseVars = firebaseVars.filter(varName => !process.env[varName]);
    if (missingFirebaseVars.length > 0 && missingFirebaseVars.length < firebaseVars.length) {
      warnings.push(`Incomplete Firebase configuration. Missing: ${missingFirebaseVars.join(', ')}`);
    }

    // Validate production optimizations are enabled
    if (process.env.REACT_APP_DEBUG_MODE === 'true') {
      warnings.push('Debug mode is enabled in production');
    }

    if (process.env.GENERATE_SOURCEMAP !== 'false') {
      warnings.push('Source maps are enabled in production (consider disabling for security)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validates URL format
 */
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Logs validation results
 */
export const logValidationResults = (result: ValidationResult): void => {
  const isDevelopment = process.env.REACT_APP_ENVIRONMENT === 'development';
  
  if (result.errors.length > 0) {
    console.error('Environment validation errors:');
    result.errors.forEach(error => console.error(`  - ${error}`));
  }

  // Only show warnings in production or if there are actual errors
  if (result.warnings.length > 0 && (!isDevelopment || result.errors.length > 0)) {
    console.warn('Environment validation warnings:');
    result.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  if (result.isValid && !isDevelopment) {
    console.log('✅ Environment validation passed');
  } else if (!result.isValid) {
    console.error('❌ Environment validation failed');
  }
};

/**
 * Validates environment on application startup
 */
export const validateOnStartup = (): void => {
  const result = validateEnvironment();
  logValidationResults(result);

  if (!result.isValid && process.env.REACT_APP_ENVIRONMENT === 'production') {
    throw new Error('Environment validation failed in production. Please check your configuration.');
  }
};

/**
 * Gets configuration summary for debugging
 */
export const getConfigSummary = (): Record<string, any> => {
  return {
    environment: process.env.REACT_APP_ENVIRONMENT,
    appName: process.env.REACT_APP_APP_NAME,
    version: process.env.REACT_APP_VERSION,
    apiBaseUrl: process.env.REACT_APP_API_BASE_URL,
    websocketUrl: process.env.REACT_APP_WEBSOCKET_URL,
    firebaseConfigured: !!(process.env.REACT_APP_FIREBASE_API_KEY && process.env.REACT_APP_FIREBASE_PROJECT_ID),
    featuresEnabled: {
      videoLibrary: process.env.REACT_APP_ENABLE_VIDEO_LIBRARY,
      calculator: process.env.REACT_APP_ENABLE_CALCULATOR,
      documentUpload: process.env.REACT_APP_ENABLE_DOCUMENT_UPLOAD,
      personaSwitcher: process.env.REACT_APP_ENABLE_PERSONA_SWITCHER,
      analytics: process.env.REACT_APP_ANALYTICS_ENABLED,
      errorReporting: process.env.REACT_APP_ENABLE_ERROR_REPORTING
    }
  };
};