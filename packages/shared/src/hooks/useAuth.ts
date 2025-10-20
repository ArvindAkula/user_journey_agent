import { useState, useEffect, useCallback } from 'react';
import { AuthService } from '../services';
import { AuthState, LoginCredentials, User, UserRole } from '../types';

export interface UseAuthConfig {
  authService: AuthService;
}

export const useAuth = (config: UseAuthConfig) => {
  const { authService } = config;
  const [authState, setAuthState] = useState<AuthState>(authService.getAuthState());

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange(setAuthState);
    return unsubscribe;
  }, [authService]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<User> => {
    return authService.login(credentials);
  }, [authService]);

  const logout = useCallback(async (): Promise<void> => {
    return authService.logout();
  }, [authService]);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    return authService.refreshToken();
  }, [authService]);

  const getCurrentUser = useCallback(async (): Promise<User | null> => {
    return authService.getCurrentUser();
  }, [authService]);

  const hasRole = useCallback((role: UserRole): boolean => {
    return authService.hasRole(role);
  }, [authService]);

  return {
    ...authState,
    login,
    logout,
    refreshToken,
    getCurrentUser,
    hasRole,
  };
};