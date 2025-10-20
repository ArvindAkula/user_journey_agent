/**
 * Firebase Configuration and Initialization
 * 
 * Provides environment-aware Firebase initialization:
 * - Development: Uses Firebase Emulator
 * - Production: Uses actual Firebase services
 */

import { initializeApp, FirebaseApp, getApps } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { EnvironmentManager } from './environment';

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseAnalytics: Analytics | null = null;

/**
 * Initialize Firebase with environment-specific configuration
 */
export function initializeFirebase(): FirebaseApp {
  if (firebaseApp) {
    return firebaseApp;
  }

  const config = EnvironmentManager.getConfig();
  const { firebaseConfig } = config;

  // Check if Firebase is already initialized
  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
    return firebaseApp;
  }

  // Validate Firebase configuration
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    throw new Error(
      'Firebase configuration is incomplete. Please check your environment variables.'
    );
  }

  // Initialize Firebase
  firebaseApp = initializeApp({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
    measurementId: firebaseConfig.measurementId
  });

  if (config.debugMode) {
    console.log('🔥 Firebase initialized successfully');
    console.log('Project ID:', firebaseConfig.projectId);
    console.log('Using Emulator:', firebaseConfig.useEmulator);
  }

  return firebaseApp;
}

/**
 * Get Firebase Auth instance with emulator support
 */
export function getFirebaseAuth(): Auth {
  if (firebaseAuth) {
    return firebaseAuth;
  }

  const app = initializeFirebase();
  const config = EnvironmentManager.getConfig();
  const { firebaseConfig } = config;

  firebaseAuth = getAuth(app);

  // Connect to emulator in development mode
  if (firebaseConfig.useEmulator && firebaseConfig.emulatorHost && firebaseConfig.emulatorPort) {
    const emulatorUrl = `http://${firebaseConfig.emulatorHost}:${firebaseConfig.emulatorPort}`;
    
    try {
      connectAuthEmulator(firebaseAuth, emulatorUrl, { disableWarnings: true });
      
      if (config.debugMode) {
        console.log('🔧 Firebase Auth connected to emulator:', emulatorUrl);
      }
    } catch (error) {
      // Emulator might already be connected
      if (config.debugMode) {
        console.warn('Firebase Auth emulator connection warning:', error);
      }
    }
  }

  return firebaseAuth;
}

/**
 * Get Firebase Analytics instance (production only)
 */
export function getFirebaseAnalytics(): Analytics | null {
  if (firebaseAnalytics) {
    return firebaseAnalytics;
  }

  const config = EnvironmentManager.getConfig();
  
  // Only initialize analytics in production or if explicitly enabled
  if (config.environment === 'production' && config.features.enableAnalytics) {
    const app = initializeFirebase();
    
    try {
      firebaseAnalytics = getAnalytics(app);
      
      if (config.debugMode) {
        console.log('📊 Firebase Analytics initialized');
      }
    } catch (error) {
      console.error('Failed to initialize Firebase Analytics:', error);
    }
  }

  return firebaseAnalytics;
}

/**
 * Reset Firebase instances (useful for testing)
 */
export function resetFirebase(): void {
  firebaseApp = null;
  firebaseAuth = null;
  firebaseAnalytics = null;
}

// Export convenience functions
export { firebaseApp, firebaseAuth, firebaseAnalytics };
