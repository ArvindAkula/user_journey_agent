import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthService } from '../services/AuthService';
import { User, LoginCredentials, UserRole, AuthState } from '../types';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: ReactNode;
  authService: AuthService;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, authService }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((state) => {
      setAuthState(state);
    });

    return unsubscribe;
  }, [authService]);

  // Automatic token refresh
  useEffect(() => {
    if (!authState.isAuthenticated) return;

    // Check token validity every 5 minutes
    const interval = setInterval(async () => {
      if (!authService.isTokenValid()) {
        await authService.refreshToken();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [authState.isAuthenticated, authService]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    try {
      await authService.login(credentials);
    } catch (error: any) {
      throw error;
    }
  }, [authService]);

  const logout = useCallback(async (): Promise<void> => {
    await authService.logout();
  }, [authService]);

  const hasRole = useCallback((role: UserRole): boolean => {
    return authService.hasRole(role);
  }, [authService]);

  const refreshToken = useCallback(async (): Promise<void> => {
    await authService.refreshToken();
  }, [authService]);

  const value: AuthContextType = {
    user: authState.user,
    loading: authState.isLoading,
    error: authState.error,
    isAuthenticated: authState.isAuthenticated,
    login,
    logout,
    hasRole,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
