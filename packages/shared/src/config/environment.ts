/**
 * Environment Configuration Module
 * 
 * Provides environment detection and configuration management for the application.
 * Supports development and production environments with appropriate service endpoints.
 */

export enum Environment {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production'
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  useEmulator: boolean;
  emulatorHost?: string;
  emulatorPort?: number;
}

export interface FeatureFlags {
  enableAnalytics: boolean;
  enableVideoTracking: boolean;
  enableInterventions: boolean;
  enableExport?: boolean;
  enableRealtime?: boolean;
  enableAdvancedFilters?: boolean;
  enableUserSegmentation?: boolean;
}

export interface EnvironmentConfig {
  environment: Environment;
  apiBaseUrl: string;
  websocketUrl: string;
  firebaseConfig: FirebaseConfig;
  features: FeatureFlags;
  debugMode: boolean;
}

/**
 * EnvironmentManager - Centralized environment detection and configuration
 */
export class EnvironmentManager {
  private static instance: EnvironmentManager;
  private config: EnvironmentConfig | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): EnvironmentManager {
    if (!EnvironmentManager.instance) {
      EnvironmentManager.instance = new EnvironmentManager();
    }
    return EnvironmentManager.instance;
  }

  /**
   * Detect current environment based on NODE_ENV
   */
  public static getEnvironment(): Environment {
    const nodeEnv = process.env.NODE_ENV?.toLowerCase();
    
    if (nodeEnv === 'production') {
      return Environment.PRODUCTION;
    }
    
    return Environment.DEVELOPMENT;
  }

  /**
   * Check if running in development mode
   */
  public static isDevelopment(): boolean {
    return EnvironmentManager.getEnvironment() === Environment.DEVELOPMENT;
  }

  /**
   * Check if running in production mode
   */
  public static isProduction(): boolean {
    return EnvironmentManager.getEnvironment() === Environment.PRODUCTION;
  }

  /**
   * Load environment-specific configuration
   */
  public static getConfig(): EnvironmentConfig {
    const instance = EnvironmentManager.getInstance();
    
    if (instance.config) {
      return instance.config;
    }

    const environment = EnvironmentManager.getEnvironment();
    instance.config = instance.loadConfiguration(environment);
    
    return instance.config;
  }

  /**
   * Load configuration based on environment
   */
  private loadConfiguration(environment: Environment): EnvironmentConfig {
    const isDev = environment === Environment.DEVELOPMENT;

    // Load Firebase configuration
    const firebaseConfig: FirebaseConfig = {
      apiKey: process.env.REACT_APP_FIREBASE_API_KEY || '',
      authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.REACT_APP_FIREBASE_APP_ID || '',
      measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
      useEmulator: isDev && process.env.REACT_APP_FIREBASE_USE_EMULATOR === 'true',
      emulatorHost: process.env.REACT_APP_FIREBASE_EMULATOR_HOST || 'localhost',
      emulatorPort: parseInt(process.env.REACT_APP_FIREBASE_EMULATOR_PORT || '9099', 10)
    };

    // Load feature flags
    const features: FeatureFlags = {
      enableAnalytics: process.env.REACT_APP_ENABLE_ANALYTICS === 'true',
      enableVideoTracking: process.env.REACT_APP_ENABLE_VIDEO_TRACKING === 'true',
      enableInterventions: process.env.REACT_APP_ENABLE_INTERVENTIONS === 'true',
      enableExport: process.env.REACT_APP_ENABLE_EXPORT === 'true',
      enableRealtime: process.env.REACT_APP_ENABLE_REALTIME === 'true',
      enableAdvancedFilters: process.env.REACT_APP_ENABLE_ADVANCED_FILTERS === 'true',
      enableUserSegmentation: process.env.REACT_APP_ENABLE_USER_SEGMENTATION === 'true'
    };

    // Determine API base URL
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 
      (isDev ? 'http://localhost:8080/api' : '');

    // Determine WebSocket URL
    const websocketUrl = process.env.REACT_APP_WEBSOCKET_URL || 
      (isDev ? 'ws://localhost:8080/ws' : '');

    // Debug mode
    const debugMode = isDev && process.env.REACT_APP_DEBUG_MODE === 'true';

    return {
      environment,
      apiBaseUrl,
      websocketUrl,
      firebaseConfig,
      features,
      debugMode
    };
  }

  /**
   * Validate required environment variables
   */
  public static validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const config = EnvironmentManager.getConfig();

    // Validate API URL
    if (!config.apiBaseUrl) {
      errors.push('REACT_APP_API_BASE_URL is required');
    }

    // Validate Firebase configuration (only in production or if not using emulator)
    if (config.environment === Environment.PRODUCTION || !config.firebaseConfig.useEmulator) {
      if (!config.firebaseConfig.apiKey) {
        errors.push('REACT_APP_FIREBASE_API_KEY is required');
      }
      if (!config.firebaseConfig.projectId) {
        errors.push('REACT_APP_FIREBASE_PROJECT_ID is required');
      }
      if (!config.firebaseConfig.appId) {
        errors.push('REACT_APP_FIREBASE_APP_ID is required');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Log current configuration (for debugging)
   */
  public static logConfiguration(): void {
    const config = EnvironmentManager.getConfig();
    
    if (config.debugMode) {
      console.group('🔧 Environment Configuration');
      console.log('Environment:', config.environment);
      console.log('API Base URL:', config.apiBaseUrl);
      console.log('WebSocket URL:', config.websocketUrl);
      console.log('Firebase Emulator:', config.firebaseConfig.useEmulator);
      console.log('Feature Flags:', config.features);
      console.groupEnd();
    }
  }

  /**
   * Reset configuration (useful for testing)
   */
  public static resetConfiguration(): void {
    const instance = EnvironmentManager.getInstance();
    instance.config = null;
  }
}

// Export convenience functions
export const getEnvironment = EnvironmentManager.getEnvironment;
export const isDevelopment = EnvironmentManager.isDevelopment;
export const isProduction = EnvironmentManager.isProduction;
export const getConfig = EnvironmentManager.getConfig;
export const validateConfiguration = EnvironmentManager.validateConfiguration;
export const logConfiguration = EnvironmentManager.logConfiguration;
