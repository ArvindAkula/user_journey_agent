import React, { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { LoadingSpinner } from './LoadingSpinner';

export interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
  redirectTo?: string;
  fallback?: ReactNode;
  onUnauthorized?: () => void;
  onUnauthenticated?: (returnUrl: string) => void;
}

/**
 * ProtectedRoute component that checks authentication and role-based access.
 * 
 * This component should be used with react-router-dom's Navigate component
 * or similar routing solution in the consuming application.
 * 
 * @example
 * ```tsx
 * import { Navigate, useLocation } from 'react-router-dom';
 * 
 * <ProtectedRoute
 *   requiredRole={UserRole.ADMIN}
 *   onUnauthenticated={(returnUrl) => <Navigate to="/login" state={{ from: returnUrl }} />}
 *   onUnauthorized={() => <Navigate to="/unauthorized" />}
 * >
 *   <AdminPage />
 * </ProtectedRoute>
 * ```
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  fallback,
  onUnauthorized,
  onUnauthenticated,
}) => {
  const { isAuthenticated, loading, hasRole } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return <>{fallback || <LoadingSpinner />}</>;
  }

  // Check if user is authenticated
  if (!isAuthenticated) {
    if (onUnauthenticated) {
      // Get current location for return URL
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
      onUnauthenticated(currentPath);
      return null;
    }
    return <div>Please log in to access this page.</div>;
  }

  // Check if user has required role
  if (requiredRole && !hasRole(requiredRole)) {
    if (onUnauthorized) {
      onUnauthorized();
      return null;
    }
    return <div>You do not have permission to access this page.</div>;
  }

  // User is authenticated and authorized
  return <>{children}</>;
};
