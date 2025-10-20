# Analytics Dashboard Authentication Integration

## Overview

This document describes the authentication integration implemented for the Analytics Dashboard as part of task 5 in the auth-and-environment-config spec.

## Implementation Summary

### Task 5.1: Set up authentication in Analytics Dashboard

**Completed Changes:**

1. **Replaced custom authentication with shared components**
   - Removed dependency on `AnalyticsAuthContext` 
   - Integrated `AuthProvider` from `@aws-agent/shared`
   - Configured `AuthService` with dashboard-specific settings

2. **Added LoginPage integration**
   - Created `LoginPageWrapper` component that uses shared `LoginPage`
   - Configured navigation after successful login
   - Added custom title and subtitle for dashboard context

3. **Integrated UserMenu in header**
   - Updated `DashboardHeader` to use shared `UserMenu` component
   - Removed custom user menu implementation
   - Configured logout navigation to `/login`

4. **Updated route configuration**
   - All routes now wrapped with `ProtectedRoute` from shared package
   - Configured role-based access control using `UserRole` enum
   - Added proper navigation callbacks for authentication failures

### Task 5.2: Protect Analytics Dashboard routes

**Completed Changes:**

1. **Role-based route protection**
   - Main dashboard routes require `UserRole.ANALYST` or higher
   - Users with `VIEWER` role are redirected to unauthorized page
   - All navigation items filtered based on user role

2. **Admin-only routes**
   - `/users` route requires `UserRole.ADMIN`
   - Nested `ProtectedRoute` for admin-specific pages
   - Unauthorized users redirected to `/unauthorized`

3. **Unauthorized page**
   - Created `UnauthorizedPage.tsx` with user-friendly error message
   - Provides navigation options to dashboard or login
   - Styled with gradient background and clear messaging

## File Changes

### Modified Files

1. **packages/analytics-dashboard/src/App.tsx**
   - Replaced `AnalyticsAuthProvider` with `AuthProvider`
   - Added `createAuthService()` function for service configuration
   - Implemented `LoginPageWrapper` for navigation integration
   - Updated all routes with `ProtectedRoute` and role requirements
   - Added `/unauthorized` route

2. **packages/analytics-dashboard/src/components/Layout/DashboardHeader.tsx**
   - Replaced custom user menu with shared `UserMenu` component
   - Updated imports to use `@aws-agent/shared`
   - Simplified navigation item filtering using `hasRole()`
   - Removed custom menu state management

### New Files

1. **packages/analytics-dashboard/src/pages/UnauthorizedPage.tsx**
   - User-friendly unauthorized access page
   - Navigation options for users without proper permissions
   - Clear messaging about required roles

2. **packages/analytics-dashboard/src/pages/UnauthorizedPage.css**
   - Styled unauthorized page with gradient background
   - Animated icon with pulse effect
   - Responsive button styling

## Authentication Flow

### Login Flow

1. User navigates to any protected route
2. `ProtectedRoute` checks authentication status
3. If not authenticated, redirects to `/login` with return URL
4. User enters credentials in `LoginPage`
5. `AuthService` validates credentials with backend
6. On success, JWT token stored in localStorage
7. User redirected to originally requested page

### Authorization Flow

1. User attempts to access a route
2. `ProtectedRoute` checks if user has required role
3. If role insufficient, redirects to `/unauthorized`
4. User can navigate to dashboard or login with different account

### Logout Flow

1. User clicks logout in `UserMenu`
2. `AuthService` calls backend logout endpoint
3. Tokens cleared from localStorage
4. User redirected to `/login`

## Role Hierarchy

The system implements a role hierarchy where higher roles inherit permissions from lower roles:

- **ADMIN** (highest) - Full access to all features including user management
- **ANALYST** - Access to analytics features, dashboards, and reports
- **VIEWER** (lowest) - Read-only access (not allowed in Analytics Dashboard)

## Configuration

### Environment Variables

The authentication system uses the following environment variables:

```bash
REACT_APP_API_BASE_URL=http://localhost:8080  # Backend API URL
REACT_APP_ENVIRONMENT=development             # Environment (development/production)
REACT_APP_VERSION=1.0.0                       # Application version
```

### Token Storage

Tokens are stored in localStorage with environment-specific keys:

- Access Token: `analytics_access_token_${environment}`
- Refresh Token: `analytics_refresh_token_${environment}`

This prevents token conflicts between development and production environments.

## Security Features

1. **JWT Token Validation**
   - Tokens validated on every request
   - Automatic token refresh when expired
   - Secure token storage in localStorage

2. **Role-Based Access Control**
   - Routes protected by required role
   - Navigation items filtered by user permissions
   - Unauthorized access attempts logged and blocked

3. **Session Management**
   - Automatic token refresh every 5 minutes
   - Session expiration handling
   - Secure logout with token invalidation

## Testing Recommendations

### Manual Testing

1. **Login Flow**
   - [ ] Test login with valid ANALYST credentials
   - [ ] Test login with valid ADMIN credentials
   - [ ] Test login with invalid credentials
   - [ ] Verify redirect to originally requested page

2. **Authorization**
   - [ ] Verify ANALYST can access dashboard routes
   - [ ] Verify ANALYST cannot access `/users` route
   - [ ] Verify ADMIN can access all routes
   - [ ] Verify VIEWER is redirected to unauthorized

3. **Logout**
   - [ ] Test logout functionality
   - [ ] Verify tokens cleared from localStorage
   - [ ] Verify redirect to login page

4. **Session Management**
   - [ ] Test automatic token refresh
   - [ ] Test session expiration handling
   - [ ] Test navigation after session expires

### Integration Testing

1. Test authentication flow with backend API
2. Verify role-based access control with different user roles
3. Test token refresh mechanism
4. Verify logout clears all authentication state

## Requirements Mapping

This implementation satisfies the following requirements from the spec:

- **Requirement 2.4**: Role-based access control for Analytics Dashboard
- **Requirement 8.1**: Login page with email/password form
- **Requirement 8.2**: Successful authentication and redirect
- **Requirement 8.3**: Display logged-in user information
- **Requirement 8.4**: Logout button in application header
- **Requirement 8.5**: Clear authentication token on logout
- **Requirement 9.1**: Route guards checking authentication tokens
- **Requirement 9.2**: Redirect unauthenticated users to login
- **Requirement 9.3**: Store and redirect to originally requested URL

## Next Steps

The following tasks remain in the spec:

- Task 6: Implement environment configuration system
- Task 7: Set up development environment tools
- Task 8: Implement secure credential management
- Task 9: Move Firebase integration from /frontend to /user-app
- Task 10: Set up BigQuery integration

## Notes

- The implementation uses shared authentication components from `@aws-agent/shared` package
- All authentication logic is centralized in the `AuthService` class
- The dashboard requires ANALYST or ADMIN role for access
- Demo mode bypass has been removed in favor of proper authentication
