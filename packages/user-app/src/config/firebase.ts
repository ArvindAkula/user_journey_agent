import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getAnalytics, Analytics, logEvent as firebaseLogEvent, isSupported } from 'firebase/analytics';
import config from './index';

// Initialize Firebase only if configuration is provided
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let analytics: Analytics | null = null;

// Check if Firebase configuration is available
const hasFirebaseConfig = !!(config.firebase.apiKey && config.firebase.projectId);

if (hasFirebaseConfig) {
  try {
    app = initializeApp(config.firebase);
    auth = getAuth(app);
    
    // Initialize Firebase Analytics (only in browser)
    if (typeof window !== 'undefined') {
      isSupported().then((supported) => {
        if (supported) {
          analytics = getAnalytics(app!);
          console.log('🔥 Firebase Analytics initialized successfully');
        } else {
          console.warn('Firebase Analytics is not supported in this environment');
        }
      }).catch((error) => {
        console.warn('Firebase Analytics support check failed:', error);
      });
    }
    
    // Firebase Auth emulator disabled - using production Firebase
    // if (config.environment === 'development') {
    //   try {
    //     connectAuthEmulator(auth, 'http://localhost:9099');
    //     console.log('Connected to Firebase Auth emulator');
    //   } catch (emulatorError) {
    //     console.warn('Could not connect to Firebase Auth emulator:', emulatorError);
    //   }
    // }
    
    console.log(`Firebase initialized successfully for ${config.environment} environment`);
  } catch (error) {
    console.warn('Firebase initialization failed:', error);
    console.log('Running in development mode without Firebase authentication');
  }
} else {
  if (config.environment === 'production') {
    console.error('Firebase configuration is required in production environment');
    throw new Error('Firebase configuration missing in production');
  } else {
    console.log('Firebase configuration not found. Running in development mode without authentication.');
  }
}

// Export Firebase instances and utilities
export { auth, analytics };
export default app;

// Firebase error handling utilities for production
export const getFirebaseErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/user-not-found':
      return 'No account found with this email address.';
    case 'auth/wrong-password':
      return 'Incorrect password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/operation-not-allowed':
      return 'This operation is not allowed.';
    case 'auth/invalid-credential':
      return 'Invalid credentials provided.';
    default:
      return 'An error occurred during authentication.';
  }
};

// Production-specific Firebase utilities
export const isFirebaseConfigured = (): boolean => {
  return hasFirebaseConfig;
};

export const getFirebaseConfig = () => {
  return config.firebase;
};

// Firebase Analytics helper function
export const logAnalyticsEvent = (eventName: string, eventParams?: Record<string, any>) => {
  if (analytics) {
    try {
      firebaseLogEvent(analytics, eventName, eventParams);
      console.log('🔥 Firebase Analytics event:', eventName, eventParams);
    } catch (error) {
      console.warn('Failed to log Firebase Analytics event:', error);
    }
  } else {
    console.debug('Firebase Analytics not initialized, skipping event:', eventName);
  }
};

// Convenience methods for common Firebase Analytics events
export const logPageView = (pageName: string, pageTitle?: string) => {
  logAnalyticsEvent('page_view', {
    page_title: pageTitle || pageName,
    page_location: window.location.href,
    page_path: window.location.pathname,
  });
};

export const logFeatureInteraction = (featureName: string, actionType: string, success: boolean = true) => {
  // Use Firebase recommended event 'select_content'
  logAnalyticsEvent('select_content', {
    content_type: 'feature',
    item_id: featureName,
    action: actionType,
    success: success,
  });
};

export const logVideoEngagement = (videoId: string, action: string, progress?: number) => {
  // Use Firebase recommended event 'video_start', 'video_progress', or 'video_complete'
  let eventName = 'select_content'; // fallback
  
  if (action === 'start' || action === 'play') {
    eventName = 'video_start';
  } else if (action === 'complete' || action === 'video_completed') {
    eventName = 'video_complete';
  } else if (action === 'progress') {
    eventName = 'video_progress';
  }
  
  logAnalyticsEvent(eventName, {
    content_type: 'video',
    item_id: videoId,
    video_title: videoId,
    video_current_time: progress || 0,
    video_percent: progress || 0,
  });
};

export const logCalculation = (calculationType: string, success: boolean = true) => {
  // Use custom event with proper naming (lowercase with underscores)
  logAnalyticsEvent('calculation_complete', {
    content_type: 'calculator',
    calculation_type: calculationType,
    success: success,
  });
};

export const logDocumentUpload = (documentType: string, success: boolean = true) => {
  // Use custom event with proper naming
  logAnalyticsEvent('document_upload', {
    content_type: 'document',
    file_type: documentType,
    success: success,
  });
};

export const logStruggleSignal = (signalType: string, context?: any) => {
  // Log struggle signals as custom events
  logAnalyticsEvent('struggle_detected', {
    content_type: 'struggle',
    signal_type: signalType,
    context: JSON.stringify(context || {}),
  });
};

export const logUserAction = (actionType: string, target?: string, metadata?: any) => {
  // Log general user actions
  logAnalyticsEvent('user_action', {
    content_type: 'action',
    action_type: actionType,
    target: target || 'unknown',
    metadata: JSON.stringify(metadata || {}),
  });
};