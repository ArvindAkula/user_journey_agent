import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth as useUserAppAuth } from './AuthContext';
import { User, UserRole, LoginCredentials, AuthState } from '@aws-agent/shared';

/**
 * Adapter context that bridges the User App's AuthContext with the shared AuthContext interface.
 * This allows shared components (like UserMenu, ProtectedRoute) to work with the User App's auth system.
 */

export interface SharedAuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  refreshToken: () => Promise<void>;
}

const SharedAuthContext = createContext<SharedAuthContextType | undefined>(undefined);

interface AuthContextAdapterProps {
  children: ReactNode;
}

export const AuthContextAdapter: React.FC<AuthContextAdapterProps> = ({ children }) => {
  const userAppAuth = useUserAppAuth();

  // Convert User App's auth state to shared format
  const convertUser = (): User | null => {
    if (!userAppAuth.authState.user) return null;

    const user = userAppAuth.authState.user;
    return {
      uid: user.id || user.uid || userAppAuth.firebaseUser?.uid || '',
      email: user.email || userAppAuth.firebaseUser?.email || '',
      displayName: user.name || user.displayName || 
                   (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : '') ||
                   userAppAuth.firebaseUser?.displayName || '',
      role: (user.role as UserRole) || UserRole.VIEWER,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    };
  };

  const login = async (credentials: LoginCredentials): Promise<void> => {
    await userAppAuth.login(credentials);
  };

  const logout = async (): Promise<void> => {
    await userAppAuth.logout();
  };

  const hasRole = (role: UserRole): boolean => {
    const user = convertUser();
    if (!user || !user.role) return false;

    // Role hierarchy: ADMIN > ANALYST > VIEWER
    const roleHierarchy: Record<UserRole, number> = {
      [UserRole.ADMIN]: 3,
      [UserRole.ANALYST]: 2,
      [UserRole.VIEWER]: 1,
    };

    return roleHierarchy[user.role] >= roleHierarchy[role];
  };

  const refreshToken = async (): Promise<void> => {
    await userAppAuth.refreshToken();
  };

  const value: SharedAuthContextType = {
    user: convertUser(),
    loading: userAppAuth.authState.isLoading,
    error: userAppAuth.authState.error,
    isAuthenticated: userAppAuth.authState.isAuthenticated,
    login,
    logout,
    hasRole,
    refreshToken,
  };

  return (
    <SharedAuthContext.Provider value={value}>
      {children}
    </SharedAuthContext.Provider>
  );
};

export const useSharedAuth = (): SharedAuthContextType => {
  const context = useContext(SharedAuthContext);
  if (context === undefined) {
    throw new Error('useSharedAuth must be used within an AuthContextAdapter');
  }
  return context;
};
