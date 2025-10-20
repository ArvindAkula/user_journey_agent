/**
 * Environment Variable Validation Utility
 * 
 * Validates required environment variables on application startup.
 * Implements fail-fast behavior to prevent application from starting with missing configuration.
 */

interface ValidationResult {
  isValid: boolean;
  missingVariables: string[];
  warnings: string[];
}

interface EnvironmentConfig {
  required: string[];
  optional: string[];
  defaults?: Record<string, string>;
}

const COMMON_CONFIG: EnvironmentConfig = {
  required: [
    'REACT_APP_API_BASE_URL',
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_AUTH_DOMAIN',
    'REACT_APP_FIREBASE_PROJECT_ID',
  ],
  optional: [
    'REACT_APP_FIREBASE_STORAGE_BUCKET',
    'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
    'REACT_APP_FIREBASE_APP_ID',
    'REACT_APP_FIREBASE_MEASUREMENT_ID',
    'REACT_APP_WS_URL',
  ],
};

const DEVELOPMENT_CONFIG: EnvironmentConfig = {
  required: [],
  optional: [
    'REACT_APP_FIREBASE_USE_EMULATOR',
    'REACT_APP_FIREBASE_EMULATOR_HOST',
    'REACT_APP_FIREBASE_EMULATOR_PORT',
  ],
};

const PRODUCTION_CONFIG: EnvironmentConfig = {
  required: [
    'REACT_APP_FIREBASE_STORAGE_BUCKET',
    'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
    'REACT_APP_FIREBASE_APP_ID',
  ],
  optional: [
    'REACT_APP_FIREBASE_MEASUREMENT_ID',
  ],
};

/**
 * Validates environment variables based on the current environment
 */
export function validateEnvironmentVariables(): ValidationResult {
  const environment = process.env.NODE_ENV || 'development';
  const missingVariables: string[] = [];
  const warnings: string[] = [];

  console.log(`[EnvValidation] Validating environment variables for: ${environment}`);

  // Validate common required variables
  COMMON_CONFIG.required.forEach((varName) => {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missingVariables.push(varName);
    }
  });

  // Validate environment-specific variables
  if (environment === 'production') {
    PRODUCTION_CONFIG.required.forEach((varName) => {
      const value = process.env[varName];
      if (!value || value.trim() === '') {
        missingVariables.push(varName);
      }
    });

    // Check for default/placeholder values in production
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
    if (apiBaseUrl && (apiBaseUrl.includes('localhost') || apiBaseUrl.includes('127.0.0.1'))) {
      warnings.push('REACT_APP_API_BASE_URL points to localhost in production mode');
    }

    const firebaseApiKey = process.env.REACT_APP_FIREBASE_API_KEY;
    if (firebaseApiKey && (firebaseApiKey === 'your-api-key' || firebaseApiKey.length < 20)) {
      missingVariables.push('REACT_APP_FIREBASE_API_KEY appears to be a placeholder value');
    }
  } else if (environment === 'development') {
    // Check development-specific configuration
    const useEmulator = process.env.REACT_APP_FIREBASE_USE_EMULATOR;
    if (useEmulator === 'true') {
      const emulatorHost = process.env.REACT_APP_FIREBASE_EMULATOR_HOST;
      const emulatorPort = process.env.REACT_APP_FIREBASE_EMULATOR_PORT;
      
      if (!emulatorHost) {
        warnings.push('REACT_APP_FIREBASE_EMULATOR_HOST not set, using default');
      }
      if (!emulatorPort) {
        warnings.push('REACT_APP_FIREBASE_EMULATOR_PORT not set, using default');
      }
    }
  }

  // Check optional variables and provide warnings
  const allOptional = [...COMMON_CONFIG.optional, ...(environment === 'production' ? PRODUCTION_CONFIG.optional : DEVELOPMENT_CONFIG.optional)];
  allOptional.forEach((varName) => {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      warnings.push(`Optional variable ${varName} is not set`);
    }
  });

  return {
    isValid: missingVariables.length === 0,
    missingVariables,
    warnings,
  };
}

/**
 * Validates environment variables and throws an error if validation fails
 * This should be called during application startup
 */
export function validateOnStartup(): void {
  const result = validateEnvironmentVariables();

  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('[EnvValidation] Configuration warnings:');
    result.warnings.forEach((warning) => {
      console.warn(`  - ${warning}`);
    });
  }

  // Fail fast if required variables are missing
  if (!result.isValid) {
    console.error('='.repeat(80));
    console.error('[EnvValidation] CRITICAL: Missing required environment variables!');
    console.error('='.repeat(80));
    console.error('The following required environment variables are not set:');
    result.missingVariables.forEach((varName) => {
      console.error(`  - ${varName}`);
    });
    console.error('');
    console.error('Please set these variables before starting the application.');
    console.error('See .env.example or .env.template files for examples and documentation.');
    console.error('='.repeat(80));

    throw new Error(
      `Application startup failed: Missing required environment variables. ` +
      `Missing: ${result.missingVariables.join(', ')}`
    );
  }

  console.log('[EnvValidation] Environment variable validation completed successfully');
}

/**
 * Gets a required environment variable or throws an error
 */
export function getRequiredEnv(varName: string): string {
  const value = process.env[varName];
  if (!value || value.trim() === '') {
    throw new Error(`Required environment variable ${varName} is not set`);
  }
  return value;
}

/**
 * Gets an optional environment variable with a default value
 */
export function getOptionalEnv(varName: string, defaultValue: string): string {
  const value = process.env[varName];
  return value && value.trim() !== '' ? value : defaultValue;
}

/**
 * Gets a boolean environment variable
 */
export function getBooleanEnv(varName: string, defaultValue: boolean = false): boolean {
  const value = process.env[varName];
  if (!value || value.trim() === '') {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Gets a number environment variable
 */
export function getNumberEnv(varName: string, defaultValue: number): number {
  const value = process.env[varName];
  if (!value || value.trim() === '') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Prints current environment configuration (for debugging)
 */
export function printEnvironmentConfig(): void {
  console.log('='.repeat(80));
  console.log('[EnvValidation] Current Environment Configuration');
  console.log('='.repeat(80));
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`REACT_APP_ENVIRONMENT: ${process.env.REACT_APP_ENVIRONMENT || 'not set'}`);
  console.log(`API Base URL: ${process.env.REACT_APP_API_BASE_URL || 'not set'}`);
  console.log(`Firebase Project: ${process.env.REACT_APP_FIREBASE_PROJECT_ID || 'not set'}`);
  console.log(`Firebase Emulator: ${process.env.REACT_APP_FIREBASE_USE_EMULATOR || 'false'}`);
  console.log('='.repeat(80));
}

// Export for use in package.json scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateEnvironmentVariables,
    validateOnStartup,
    getRequiredEnv,
    getOptionalEnv,
    getBooleanEnv,
    getNumberEnv,
    printEnvironmentConfig,
  };
}
