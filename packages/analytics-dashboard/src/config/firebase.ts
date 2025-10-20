import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import config from './index';

// Firebase configuration for Analytics Dashboard
// Note: This is optional for analytics dashboard as it primarily uses JWT-based authentication
// Firebase may be used for admin authentication or integration with user app
const firebaseConfig = {
  apiKey: config.firebase.apiKey,
  authDomain: config.firebase.authDomain,
  projectId: config.firebase.projectId,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || ''
};

// Only initialize Firebase if configuration is provided
let app = null;
let auth = null;

const hasFirebaseConfig = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

if (hasFirebaseConfig) {
  try {
    app = initializeApp(firebaseConfig, 'analytics-dashboard');
    auth = getAuth(app);
    
    // Connect to Firebase Auth emulator in development
    if (config.environment === 'development') {
      try {
        connectAuthEmulator(auth, 'http://localhost:9099');
        console.log('Analytics Dashboard: Connected to Firebase Auth emulator');
      } catch (emulatorError) {
        console.warn('Analytics Dashboard: Could not connect to Firebase Auth emulator:', emulatorError);
      }
    }
    
    console.log(`Analytics Dashboard: Firebase initialized for ${config.environment} environment`);
  } catch (error) {
    console.warn('Analytics Dashboard: Firebase initialization failed:', error);
  }
} else {
  console.log('Analytics Dashboard: Firebase configuration not provided (using JWT authentication only)');
}

export { auth };
export default app;

// Firebase utilities for analytics dashboard
export const isFirebaseConfigured = (): boolean => {
  return hasFirebaseConfig;
};

export const getFirebaseConfig = () => {
  return firebaseConfig;
};