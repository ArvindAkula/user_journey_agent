# User App Authentication Integration

## Overview

This document describes the authentication integration implemented for the User App as part of task 4 from the auth-and-environment-config specification.

## Implementation Summary

### Task 4.1: Set up authentication in User App ✅

#### 1. AuthProvider Integration
- The User App already has an `AuthProvider` wrapping the entire application in `App.tsx`
- The AuthProvider is located at `src/contexts/AuthContext.tsx` and provides:
  - User authentication state management
  - Login/logout functionality
  - Firebase integration for production
  - Mock authentication for development mode
  - Token refresh capabilities

#### 2. LoginPage Route
- **Created**: `src/pages/LoginPage.tsx`
- **Created**: `src/pages/LoginPage.css`
- Uses the shared `LoginPage` component from `@aws-agent/shared`
- Handles successful login by redirecting to the originally requested page
- Integrated with react-router-dom for navigation
- Route added to App.tsx: `/login`

#### 3. UnauthorizedPage Route
- **Created**: `src/pages/UnauthorizedPage.tsx`
- **Created**: `src/pages/UnauthorizedPage.css`
- Displays when users try to access pages they don't have permission for
- Provides navigation options to go home or go back
- Route added to App.tsx: `/unauthorized`

#### 4. UserMenu Integration
- The existing `UserHeader` component already provides user menu functionality
- Displays user greeting with name/email
- Provides profile link
- Includes logout button with loading state
- Located at `src/components/UserHeader.tsx`

### Task 4.2: Protect User App routes ✅

#### 1. ProtectedRoute Component
- **Created**: `src/components/ProtectedRoute.tsx`
- Wraps routes that require authentication
- Features:
  - Checks authentication state before rendering children
  - Shows loading spinner while checking auth
  - Redirects to `/login` if not authenticated
  - Saves the originally requested URL for post-login redirect
  - Supports role-based access control (optional)
  - Redirects to `/unauthorized` if user lacks required role

#### 2. Protected Routes Implementation
All main application routes are now wrapped with `ProtectedRoute`:
- `/` - Home page
- `/demo` - Demo page
- `/videos` - Video library
- `/calculator` - Calculator page
- `/documents` - Document upload page
- `/profile` - User profile page

#### 3. Public Routes
The following routes remain public (no authentication required):
- `/login` - Login page
- `/unauthorized` - Unauthorized access page

#### 4. Blocked Routes
Analytics and admin routes are blocked and redirect to home:
- `/analytics/*` → `/`
- `/dashboard/*` → `/`
- `/admin/*` → `/`

## Authentication Flow

### Login Flow
1. User navigates to a protected route (e.g., `/calculator`)
2. `ProtectedRoute` checks authentication state
3. If not authenticated, user is redirected to `/login` with return URL saved
4. User enters credentials on `LoginPage`
5. On successful login, user is redirected to originally requested page
6. `UserHeader` displays user information and logout option

### Logout Flow
1. User clicks logout button in `UserHeader`
2. `AuthContext` clears authentication state and tokens
3. User is redirected to home page
4. Any attempt to access protected routes redirects to `/login`

### Unauthorized Access Flow
1. User tries to access a route requiring specific role
2. `ProtectedRoute` checks user's role against required role
3. If insufficient permissions, user is redirected to `/unauthorized`
4. User can navigate home or go back

## Role-Based Access Control

The `ProtectedRoute` component supports role-based access control with the following hierarchy:
- **ADMIN** (highest level)
- **ANALYST** (middle level)
- **VIEWER** (lowest level)

Currently, the User App does not use role-based restrictions (all authenticated users have the same access). However, the infrastructure is in place for future use.

## Integration with Shared Components

The User App uses the following shared components from `@aws-agent/shared`:
- `LoginPage` - Reusable login form component
- `UserRole` - User role enum
- `User`, `LoginCredentials`, `AuthState` - Type definitions
- `LoadingSpinner` - Loading indicator
- `ErrorBoundary` - Error handling

## Development vs Production

### Development Mode
- Firebase authentication can be bypassed
- Mock user authentication is available
- Auth state starts with `isLoading: false` to avoid hanging

### Production Mode
- Full Firebase authentication required
- Backend JWT token validation
- Secure token storage and refresh

## Files Created/Modified

### Created Files
1. `packages/user-app/src/pages/LoginPage.tsx`
2. `packages/user-app/src/pages/LoginPage.css`
3. `packages/user-app/src/pages/UnauthorizedPage.tsx`
4. `packages/user-app/src/pages/UnauthorizedPage.css`
5. `packages/user-app/src/components/ProtectedRoute.tsx`
6. `packages/user-app/src/contexts/AuthContextAdapter.tsx` (created but not used)

### Modified Files
1. `packages/user-app/src/App.tsx`
   - Added lazy-loaded LoginPage and UnauthorizedPage
   - Added `/login` and `/unauthorized` routes
   - Wrapped all protected routes with `ProtectedRoute` component

## Testing Recommendations

### Manual Testing
1. **Login Flow**
   - Navigate to a protected route while logged out
   - Verify redirect to `/login`
   - Login with valid credentials
   - Verify redirect to originally requested page

2. **Logout Flow**
   - Login to the application
   - Click logout button
   - Verify redirect and cleared auth state
   - Try accessing protected route
   - Verify redirect to `/login`

3. **Protected Routes**
   - Test each protected route requires authentication
   - Verify loading states during auth check
   - Test navigation between protected routes

4. **Error Handling**
   - Test with invalid credentials
   - Test with expired tokens
   - Test network failures during login

### Automated Testing
Consider adding tests for:
- `ProtectedRoute` component behavior
- Login/logout flows
- Route protection
- Role-based access control
- Error states and loading states

## Next Steps

To complete the full authentication system:
1. Implement backend authentication endpoints (Task 2)
2. Create shared authentication components (Task 3)
3. Integrate authentication in Analytics Dashboard (Task 5)
4. Set up environment configuration (Task 6)
5. Configure Firebase and LocalStack (Task 7)

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:
- **8.1**: Login page with email and password input fields ✅
- **8.2**: Successful login redirects to main application ✅
- **8.3**: User email displayed in application header ✅
- **8.4**: Logout button accessible from header ✅
- **8.5**: Logout clears token and redirects to login ✅
- **9.1**: Route guards check for valid authentication tokens ✅
- **9.2**: Unauthenticated users redirected to login page ✅
- **9.3**: Originally requested URL stored and used after login ✅
