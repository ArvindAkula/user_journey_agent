import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import {
  AnalyticsAuthService,
  useAnalyticsAuth as useAnalyticsAuthHook,
  UseAnalyticsAuthReturn
} from '@aws-agent/shared';

// Create analytics auth service instance
const createAnalyticsAuthService = () => {
  const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';
  const environment = process.env.REACT_APP_ENVIRONMENT || 'development';

  return new AnalyticsAuthService({
    baseURL,
    timeout: environment === 'production' ? 30000 : 15000,
    headers: {
      'X-Client-Type': 'analytics-dashboard',
      'X-Client-Version': process.env.REACT_APP_VERSION || '1.0.0',
      'X-Environment': environment
    },
    accessTokenKey: `analytics_access_token_${environment}`,
    refreshTokenKey: `analytics_refresh_token_${environment}`
  });
};

const AnalyticsAuthContext = createContext<UseAnalyticsAuthReturn | undefined>(undefined);

interface AnalyticsAuthProviderProps {
  children: ReactNode;
}

export const AnalyticsAuthProvider: React.FC<AnalyticsAuthProviderProps> = ({ children }) => {
  // Create auth service instance (memoized to prevent recreation)
  const authService = useMemo(() => createAnalyticsAuthService(), []);

  // Use the shared analytics auth hook
  const analyticsAuth = useAnalyticsAuthHook({ authService });

  return (
    <AnalyticsAuthContext.Provider value={analyticsAuth}>
      {children}
    </AnalyticsAuthContext.Provider>
  );
};

export const useAnalyticsAuth = (): UseAnalyticsAuthReturn => {
  const context = useContext(AnalyticsAuthContext);
  if (context === undefined) {
    throw new Error('useAnalyticsAuth must be used within an AnalyticsAuthProvider');
  }
  return context;
};