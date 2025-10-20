export interface AnalyticsUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: AnalyticsRole;
  permissions: AnalyticsPermission[];
  department?: string;
  createdAt: Date;
  lastLoginAt: Date;
  isActive: boolean;
}

export type AnalyticsRole = 
  | 'analytics_viewer'
  | 'analytics_analyst' 
  | 'analytics_manager'
  | 'analytics_admin'
  | 'system_admin';

export type AnalyticsPermission = 
  | 'view_analytics'
  | 'view_user_data'
  | 'view_sensitive_data'
  | 'export_data'
  | 'manage_filters'
  | 'manage_dashboards'
  | 'manage_users'
  | 'manage_permissions'
  | 'access_real_time'
  | 'access_historical'
  | 'use_ai_insights'
  | 'configure_alerts'
  | 'manage_system';

export interface AnalyticsAuthState {
  user: AnalyticsUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  permissions: AnalyticsPermission[];
}

export interface AnalyticsLoginCredentials {
  email: string;
  password: string;
  mfaCode?: string; // Multi-factor authentication code
}

export interface AnalyticsTokenPayload {
  userId: string;
  email: string;
  role: AnalyticsRole;
  permissions: AnalyticsPermission[];
  department?: string;
  iat: number; // Issued at
  exp: number; // Expires at
  aud: string; // Audience (analytics-dashboard)
  iss: string; // Issuer
}

export interface AnalyticsAuthResponse {
  user: AnalyticsUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AnalyticsUserManagement {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AnalyticsRole;
  department?: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date;
  createdBy: string;
  modifiedBy?: string;
  modifiedAt?: Date;
}

export interface CreateAnalyticsUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: AnalyticsRole;
  department?: string;
  permissions?: AnalyticsPermission[];
  temporaryPassword?: boolean;
}

export interface UpdateAnalyticsUserRequest {
  firstName?: string;
  lastName?: string;
  role?: AnalyticsRole;
  department?: string;
  permissions?: AnalyticsPermission[];
  isActive?: boolean;
}

// Role-based permission mappings
export const ROLE_PERMISSIONS: Record<AnalyticsRole, AnalyticsPermission[]> = {
  analytics_viewer: [
    'view_analytics',
    'view_user_data'
  ],
  analytics_analyst: [
    'view_analytics',
    'view_user_data',
    'export_data',
    'manage_filters',
    'access_real_time',
    'access_historical',
    'use_ai_insights'
  ],
  analytics_manager: [
    'view_analytics',
    'view_user_data',
    'view_sensitive_data',
    'export_data',
    'manage_filters',
    'manage_dashboards',
    'access_real_time',
    'access_historical',
    'use_ai_insights',
    'configure_alerts'
  ],
  analytics_admin: [
    'view_analytics',
    'view_user_data',
    'view_sensitive_data',
    'export_data',
    'manage_filters',
    'manage_dashboards',
    'manage_users',
    'manage_permissions',
    'access_real_time',
    'access_historical',
    'use_ai_insights',
    'configure_alerts'
  ],
  system_admin: [
    'view_analytics',
    'view_user_data',
    'view_sensitive_data',
    'export_data',
    'manage_filters',
    'manage_dashboards',
    'manage_users',
    'manage_permissions',
    'access_real_time',
    'access_historical',
    'use_ai_insights',
    'configure_alerts',
    'manage_system'
  ]
};

// Helper function to get permissions for a role
export const getPermissionsForRole = (role: AnalyticsRole): AnalyticsPermission[] => {
  return ROLE_PERMISSIONS[role] || [];
};

// Helper function to check if user has specific permission
export const hasPermission = (user: AnalyticsUser | null, permission: AnalyticsPermission): boolean => {
  if (!user || !user.isActive) return false;
  return user.permissions.includes(permission);
};

// Helper function to check if user has any of the specified permissions
export const hasAnyPermission = (user: AnalyticsUser | null, permissions: AnalyticsPermission[]): boolean => {
  if (!user || !user.isActive) return false;
  return permissions.some(permission => user.permissions.includes(permission));
};

// Helper function to check if user has all specified permissions
export const hasAllPermissions = (user: AnalyticsUser | null, permissions: AnalyticsPermission[]): boolean => {
  if (!user || !user.isActive) return false;
  return permissions.every(permission => user.permissions.includes(permission));
};