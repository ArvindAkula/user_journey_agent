import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import config from '../config';

/**
 * Hook to handle session management for user app
 */
export const useSessionManagement = () => {
  const { authState, refreshToken, logout, firebaseUser, isFirebaseConfigured } = useAuth();
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const updateLastActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const scheduleTokenRefresh = useCallback(() => {
    // Clear existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    if (!authState.isAuthenticated) {
      return;
    }

    // In production with Firebase, tokens are managed by Firebase
    // In development or without Firebase, manage tokens manually
    if (config.environment === 'production' && isFirebaseConfigured && firebaseUser) {
      // Firebase handles token refresh automatically
      // We just need to sync with our backend periodically
      refreshTimeoutRef.current = setTimeout(async () => {
        try {
          await refreshToken();
          scheduleTokenRefresh();
        } catch (error) {
          console.error('Token sync failed:', error);
        }
      }, 30 * 60 * 1000); // Refresh every 30 minutes
    } else {
      // Manual token refresh for development or non-Firebase auth
      refreshTimeoutRef.current = setTimeout(async () => {
        try {
          await refreshToken();
          scheduleTokenRefresh();
        } catch (error) {
          console.error('Token refresh failed:', error);
          // Don't auto-logout in development
          if (config.environment === 'production') {
            await logout();
          }
        }
      }, 15 * 60 * 1000); // Refresh every 15 minutes
    }
  }, [authState.isAuthenticated, refreshToken, logout, firebaseUser, isFirebaseConfigured]);

  const scheduleInactivityCheck = useCallback(() => {
    // Clear existing timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    if (!authState.isAuthenticated || config.environment === 'development') {
      return;
    }

    // Check for inactivity every 5 minutes
    activityTimeoutRef.current = setTimeout(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      const maxInactivity = 60 * 60 * 1000; // 1 hour

      if (timeSinceLastActivity > maxInactivity) {
        console.log('User inactive for too long, logging out');
        logout();
      } else {
        // Schedule next check
        scheduleInactivityCheck();
      }
    }, 5 * 60 * 1000);
  }, [authState.isAuthenticated, logout]);

  const clearTimeouts = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
      activityTimeoutRef.current = null;
    }
  }, []);

  // Set up session management when user is authenticated
  useEffect(() => {
    if (authState.isAuthenticated) {
      scheduleTokenRefresh();
      scheduleInactivityCheck();
    } else {
      clearTimeouts();
    }

    return clearTimeouts;
  }, [authState.isAuthenticated, scheduleTokenRefresh, scheduleInactivityCheck, clearTimeouts]);

  // Track user activity
  useEffect(() => {
    if (!authState.isAuthenticated || config.environment === 'development') {
      return;
    }

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      updateLastActivity();
    };

    // Add event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Clean up event listeners
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [authState.isAuthenticated, updateLastActivity]);

  // Clean up on unmount
  useEffect(() => {
    return clearTimeouts;
  }, [clearTimeouts]);

  return {
    updateLastActivity,
    clearTimeouts
  };
};