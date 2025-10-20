import React, { ReactNode } from 'react';
import { useAnalyticsAuth } from '../../contexts/AnalyticsAuthContext';
import { AnalyticsPermission } from '@aws-agent/shared';
import './AnalyticsAuth.css';

interface PermissionGuardProps {
  children: ReactNode;
  permission?: AnalyticsPermission;
  permissions?: AnalyticsPermission[];
  requireAll?: boolean; // If true, user must have ALL permissions. If false, user needs ANY permission
  fallback?: ReactNode;
  showFallback?: boolean;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  permissions = [],
  requireAll = false,
  fallback,
  showFallback = true
}) => {
  const { user, isAuthenticated, hasPermission, hasAnyPermission, hasAllPermissions } = useAnalyticsAuth();

  // If not authenticated, don't render anything
  if (!isAuthenticated || !user) {
    return null;
  }

  // Build permissions array
  const permissionsToCheck = permission ? [permission] : permissions;

  if (permissionsToCheck.length === 0) {
    // No permissions specified, just check if user is authenticated
    return <>{children}</>;
  }

  // Check permissions based on requireAll flag
  const hasRequiredPermissions = requireAll 
    ? hasAllPermissions(permissionsToCheck)
    : hasAnyPermission(permissionsToCheck);

  if (hasRequiredPermissions) {
    return <>{children}</>;
  }

  // User doesn't have required permissions
  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showFallback) {
    return null;
  }

  // Default permission denied UI
  return (
    <div className="permission-denied">
      <div className="permission-denied-icon">🔒</div>
      <h2>Access Denied</h2>
      <p>
        You don't have the required permissions to access this feature. 
        Contact your administrator if you believe this is an error.
      </p>
      <div>
        <strong>Required permissions:</strong>
        <ul style={{ textAlign: 'left', marginTop: '8px' }}>
          {permissionsToCheck.map(perm => (
            <li key={perm}>{perm.replace(/_/g, ' ').toUpperCase()}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// Higher-order component version for easier use with routes
export const withPermissionGuard = (
  Component: React.ComponentType<any>,
  permission?: AnalyticsPermission,
  permissions?: AnalyticsPermission[],
  requireAll = false
) => {
  return (props: any) => (
    <PermissionGuard 
      permission={permission} 
      permissions={permissions} 
      requireAll={requireAll}
    >
      <Component {...props} />
    </PermissionGuard>
  );
};