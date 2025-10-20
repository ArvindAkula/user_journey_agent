import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '@aws-agent/shared';
import LoadingSpinner from './LoadingSpinner';

export interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
  redirectTo?: string;
}

/**
 * ProtectedRoute component for User App that checks authentication and role-based access.
 * 
 * This component wraps routes that require authentication. If the user is not authenticated,
 * they will be redirected to the login page. If they don't have the required role, they will
 * be redirected to the unauthorized page.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  redirectTo = '/login',
}) => {
  const { authState } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (authState.isLoading) {
    return <LoadingSpinner />;
  }

  // Check if user is authenticated
  if (!authState.isAuthenticated) {
    // Redirect to login page, saving the current location
    return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />;
  }

  // Check if user has required role
  if (requiredRole && authState.user) {
    const userRole = authState.user.role as UserRole;
    
    // Role hierarchy: ADMIN > ANALYST > VIEWER
    const roleHierarchy: Record<UserRole, number> = {
      [UserRole.ADMIN]: 3,
      [UserRole.ANALYST]: 2,
      [UserRole.VIEWER]: 1,
    };

    const hasRequiredRole = roleHierarchy[userRole] >= roleHierarchy[requiredRole];
    
    if (!hasRequiredRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // User is authenticated and authorized
  return <>{children}</>;
};

export default ProtectedRoute;
