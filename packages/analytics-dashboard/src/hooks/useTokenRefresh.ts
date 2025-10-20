import { useEffect, useCallback, useRef } from 'react';
import { useAnalyticsAuth } from '../contexts/AnalyticsAuthContext';
import config from '../config';

/**
 * Hook to handle automatic token refresh for analytics dashboard
 */
export const useTokenRefresh = () => {
  const { authState, refreshToken, logout } = useAnalyticsAuth();
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scheduleTokenRefresh = useCallback(() => {
    // Clear existing timeouts
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    if (!authState.isAuthenticated) {
      return;
    }

    // Schedule token refresh before expiration
    const refreshInterval = config.auth.tokenRefreshInterval;
    const warningTime = config.auth.autoLogoutWarning;

    // Schedule warning before auto-logout
    if (warningTime > 0) {
      const warningDelay = refreshInterval - warningTime;
      if (warningDelay > 0) {
        warningTimeoutRef.current = setTimeout(() => {
          showSessionWarning();
        }, warningDelay);
      }
    }

    // Schedule token refresh
    refreshTimeoutRef.current = setTimeout(async () => {
      try {
        await refreshToken();
        // Schedule next refresh
        scheduleTokenRefresh();
      } catch (error) {
        console.error('Token refresh failed:', error);
        // If refresh fails, logout user
        await logout();
      }
    }, refreshInterval);
  }, [authState.isAuthenticated, refreshToken, logout]);

  const showSessionWarning = useCallback(() => {
    // Show session expiration warning
    const shouldContinue = window.confirm(
      'Your session will expire soon. Click OK to continue your session or Cancel to logout.'
    );

    if (shouldContinue) {
      // User wants to continue, refresh token immediately
      refreshToken().catch((error) => {
        console.error('Manual token refresh failed:', error);
        logout();
      });
    } else {
      // User chose to logout
      logout();
    }
  }, [refreshToken, logout]);

  const clearTimeouts = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
  }, []);

  // Set up token refresh when user is authenticated
  useEffect(() => {
    if (authState.isAuthenticated) {
      scheduleTokenRefresh();
    } else {
      clearTimeouts();
    }

    return clearTimeouts;
  }, [authState.isAuthenticated, scheduleTokenRefresh, clearTimeouts]);

  // Clean up on unmount
  useEffect(() => {
    return clearTimeouts;
  }, [clearTimeouts]);

  return {
    scheduleTokenRefresh,
    clearTimeouts
  };
};