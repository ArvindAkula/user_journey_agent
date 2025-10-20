import { useState, useEffect, useCallback } from 'react';
import { AnalyticsAuthService } from '../services/AnalyticsAuthService';
import {
  AnalyticsUser,
  AnalyticsAuthState,
  AnalyticsLoginCredentials,
  AnalyticsPermission,
  AnalyticsUserManagement,
  CreateAnalyticsUserRequest,
  UpdateAnalyticsUserRequest
} from '../types/AnalyticsAuth';

export interface UseAnalyticsAuthConfig {
  authService: AnalyticsAuthService;
}

export interface UseAnalyticsAuthReturn {
  // Auth state
  authState: AnalyticsAuthState;
  user: AnalyticsUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  permissions: AnalyticsPermission[];

  // Auth actions
  login: (credentials: AnalyticsLoginCredentials) => Promise<AnalyticsUser>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;

  // Permission checking
  hasPermission: (permission: AnalyticsPermission) => boolean;
  hasAnyPermission: (permissions: AnalyticsPermission[]) => boolean;
  hasAllPermissions: (permissions: AnalyticsPermission[]) => boolean;

  // User management (admin only)
  getUsers: () => Promise<AnalyticsUserManagement[]>;
  createUser: (userData: CreateAnalyticsUserRequest) => Promise<AnalyticsUserManagement>;
  updateUser: (userId: string, updates: UpdateAnalyticsUserRequest) => Promise<AnalyticsUserManagement>;
  deactivateUser: (userId: string) => Promise<void>;
  resetUserPassword: (userId: string) => Promise<{ temporaryPassword: string }>;

  // Utility functions
  clearError: () => void;
}

export const useAnalyticsAuth = (config: UseAnalyticsAuthConfig): UseAnalyticsAuthReturn => {
  const { authService } = config;
  const [authState, setAuthState] = useState<AnalyticsAuthState>(authService.getAuthState());

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = authService.onAuthStateChange((state) => {
      setAuthState(state);
    });

    return unsubscribe;
  }, [authService]);

  const login = useCallback(async (credentials: AnalyticsLoginCredentials): Promise<AnalyticsUser> => {
    try {
      const user = await authService.login(credentials);
      return user;
    } catch (error: any) {
      throw error;
    }
  }, [authService]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, we should clear local state
    }
  }, [authService]);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      return await authService.refreshAccessToken();
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  }, [authService]);

  const hasPermission = useCallback((permission: AnalyticsPermission): boolean => {
    return authService.hasPermission(permission);
  }, [authService]);

  const hasAnyPermission = useCallback((permissions: AnalyticsPermission[]): boolean => {
    return permissions.some(permission => authService.hasPermission(permission));
  }, [authService]);

  const hasAllPermissions = useCallback((permissions: AnalyticsPermission[]): boolean => {
    return permissions.every(permission => authService.hasPermission(permission));
  }, [authService]);

  // User management functions (admin only)
  const getUsers = useCallback(async (): Promise<AnalyticsUserManagement[]> => {
    try {
      return await authService.getAnalyticsUsers();
    } catch (error: any) {
      throw error;
    }
  }, [authService]);

  const createUser = useCallback(async (userData: CreateAnalyticsUserRequest): Promise<AnalyticsUserManagement> => {
    try {
      return await authService.createAnalyticsUser(userData);
    } catch (error: any) {
      throw error;
    }
  }, [authService]);

  const updateUser = useCallback(async (userId: string, updates: UpdateAnalyticsUserRequest): Promise<AnalyticsUserManagement> => {
    try {
      return await authService.updateAnalyticsUser(userId, updates);
    } catch (error: any) {
      throw error;
    }
  }, [authService]);

  const deactivateUser = useCallback(async (userId: string): Promise<void> => {
    try {
      await authService.deactivateAnalyticsUser(userId);
    } catch (error: any) {
      throw error;
    }
  }, [authService]);

  const resetUserPassword = useCallback(async (userId: string): Promise<{ temporaryPassword: string }> => {
    try {
      return await authService.resetUserPassword(userId);
    } catch (error: any) {
      throw error;
    }
  }, [authService]);

  const clearError = useCallback(() => {
    // This would typically update the auth state to clear the error
    // For now, we'll just log it since the service manages its own state
    console.log('Clearing auth error');
  }, []);

  return {
    // Auth state
    authState,
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    error: authState.error,
    permissions: authState.permissions,

    // Auth actions
    login,
    logout,
    refreshToken,

    // Permission checking
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,

    // User management
    getUsers,
    createUser,
    updateUser,
    deactivateUser,
    resetUserPassword,

    // Utility functions
    clearError,
  };
};