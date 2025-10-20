/**
 * Configuration Module Exports
 */

export {
  Environment,
  EnvironmentManager,
  getEnvironment,
  isDevelopment,
  isProduction,
  getConfig,
  validateConfiguration,
  logConfiguration
} from './environment';

export type {
  EnvironmentConfig,
  FirebaseConfig,
  FeatureFlags
} from './environment';

export {
  initializeFirebase,
  getFirebaseAuth,
  getFirebaseAnalytics,
  resetFirebase,
  firebaseApp,
  firebaseAuth,
  firebaseAnalytics
} from './firebase';
