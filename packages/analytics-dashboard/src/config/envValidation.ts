/**
 * Environment Variable Validation for Analytics Dashboard
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
    'REACT_APP_ANALYTICS_API_BASE_URL',
    'REACT_APP_WEBSOCKET_URL',
    'REACT_APP_ENVIRONMENT',
    'REACT_APP_APP_NAME',
    'REACT_APP_VERSION',
    'REACT_APP_AUTH_ENDPOINT'
  ],
  optional: [
    'REACT_APP_REALTIME_ENDPOINT',
    'REACT_APP_ANALYTICS_REFRESH_INTERVAL',
    'REACT_APP_EXPORT_MAX_RECORDS',
    'REACT_APP_CHART_ANIMATION_DURATION',
    'REACT_APP_DATA_RETENTION_DAYS',
    'REACT_APP_MAX_CONCURRENT_EXPORTS',
    'REACT_APP_REALTIME_BUFFER_SIZE',
    'REACT_APP_AUTH_PROVIDER',
    'REACT_APP_TOKEN_REFRESH_INTERVAL',
    'REACT_APP_SESSION_TIMEOUT',
    'REACT_APP_ENABLE_AMAZON_Q',
    'REACT_APP_ENABLE_EXPORT',
    'REACT_APP_ENABLE_REALTIME',
    'REACT_APP_ENABLE_ADVANCED_FILTERS',
    'REACT_APP_ENABLE_USER_SEGMENTATION',
    'REACT_APP_PAGINATION_SIZE',
    'REACT_APP_CHART_MAX_DATA_POINTS',
    'REACT_APP_DEBOUNCE_DELAY'
  ],
  production: [
    // Firebase variables are optional for analytics dashboard
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_AUTH_DOMAIN',
    'REACT_APP_FIREBASE_PROJECT_ID'
  ]
};

/**
 * Validates environment variables for the analytics dashboard
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

  // Check optional variables and provide warnings
  ENV_CONFIG.optional.forEach(varName => {
    if (!process.env[varName]) {
      warnings.push(`Optional environment variable not set: ${varName} (using default)`);
    }
  });

  // Validate URL formats
  const urlVars = [
    'REACT_APP_API_BASE_URL',
    'REACT_APP_ANALYTICS_API_BASE_URL',
    'REACT_APP_WEBSOCKET_URL',
    'REACT_APP_REALTIME_ENDPOINT',
    'REACT_APP_AUTH_ENDPOINT'
  ];
  
  urlVars.forEach(varName => {
    const value = process.env[varName];
    if (value && !isValidUrl(value)) {
      errors.push(`Invalid URL format for ${varName}: ${value}`);
    }
  });

  // Validate numeric configurations
  const numericVars = [
    'REACT_APP_ANALYTICS_REFRESH_INTERVAL',
    'REACT_APP_EXPORT_MAX_RECORDS',
    'REACT_APP_CHART_ANIMATION_DURATION',
    'REACT_APP_DATA_RETENTION_DAYS',
    'REACT_APP_MAX_CONCURRENT_EXPORTS',
    'REACT_APP_REALTIME_BUFFER_SIZE',
    'REACT_APP_TOKEN_REFRESH_INTERVAL',
    'REACT_APP_SESSION_TIMEOUT',
    'REACT_APP_PAGINATION_SIZE',
    'REACT_APP_CHART_MAX_DATA_POINTS',
    'REACT_APP_DEBOUNCE_DELAY'
  ];

  numericVars.forEach(varName => {
    const value = process.env[varName];
    if (value && isNaN(parseInt(value, 10))) {
      errors.push(`Invalid numeric value for ${varName}: ${value}`);
    }
  });

  // Validate authentication provider
  const authProvider = process.env.REACT_APP_AUTH_PROVIDER;
  if (authProvider && !['jwt', 'oauth', 'firebase'].includes(authProvider)) {
    warnings.push(`Unknown authentication provider: ${authProvider}`);
  }

  // Production-specific validations
  if (isProduction) {
    // Ensure HTTPS URLs in production
    const httpsVars = ['REACT_APP_API_BASE_URL', 'REACT_APP_ANALYTICS_API_BASE_URL', 'REACT_APP_AUTH_ENDPOINT'];
    httpsVars.forEach(varName => {
      const value = process.env[varName];
      if (value && !value.startsWith('https://')) {
        warnings.push(`${varName} should use HTTPS in production: ${value}`);
      }
    });

    // Ensure WSS for WebSocket URLs in production
    const wsVars = ['REACT_APP_WEBSOCKET_URL', 'REACT_APP_REALTIME_ENDPOINT'];
    wsVars.forEach(varName => {
      const value = process.env[varName];
      if (value && !value.startsWith('wss://')) {
        warnings.push(`${varName} should use WSS in production: ${value}`);
      }
    });
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
  if (result.errors.length > 0) {
    console.error('Environment validation errors:');
    result.errors.forEach(error => console.error(`  - ${error}`));
  }

  if (result.warnings.length > 0) {
    console.warn('Environment validation warnings:');
    result.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  if (result.isValid) {
    console.log('✅ Environment validation passed');
  } else {
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
    analyticsApiBaseUrl: process.env.REACT_APP_ANALYTICS_API_BASE_URL,
    authProvider: process.env.REACT_APP_AUTH_PROVIDER,
    featuresEnabled: {
      amazonQ: process.env.REACT_APP_ENABLE_AMAZON_Q,
      export: process.env.REACT_APP_ENABLE_EXPORT,
      realtime: process.env.REACT_APP_ENABLE_REALTIME,
      advancedFilters: process.env.REACT_APP_ENABLE_ADVANCED_FILTERS,
      userSegmentation: process.env.REACT_APP_ENABLE_USER_SEGMENTATION
    }
  };
};