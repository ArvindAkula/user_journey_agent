import { useState, useEffect, useCallback } from 'react';
import { AuthService } from '../services';
import { AuthState, LoginCredentials, RegisterData, User } from '../types';

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

  const register = useCallback(async (data: RegisterData): Promise<User> => {
    return authService.register(data);
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

  return {
    ...authState,
    login,
    register,
    logout,
    refreshToken,
    getCurrentUser,
  };
};