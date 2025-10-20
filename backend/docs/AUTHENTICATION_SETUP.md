# Authentication Infrastructure Setup

This document describes the authentication infrastructure implemented for the User Journey Analytics system.

## Overview

The authentication system provides:
- JWT-based token generation and validation
- Firebase Authentication integration for user verification
- Role-based access control (RBAC) with three user roles
- Authorized user management via configuration file

## Components

### 1. JWT Service (`JwtService.java`)

Located at: `backend/src/main/java/com/userjourney/analytics/service/JwtService.java`

**Purpose**: Handles JWT token generation, validation, and claims extraction.

**Key Methods**:
- `generateToken(String email, String role)` - Generate token with email and role
- `generateToken(String userId, List<String> roles, Map<String, Object> additionalClaims)` - Generate token with custom claims
- `validateToken(String token)` - Validate token signature and expiration
- `getEmailFromToken(String token)` - Extract email from token
- `getRoleFromToken(String token)` - Extract role from token
- `refreshToken(String token)` - Generate new token from existing valid token
- `isTokenExpired(String token)` - Check if token has expired

**Configuration**:
```yaml
app:
  jwt:
    secret: ${JWT_SECRET}  # Must be at least 256 bits
    expiration: 86400      # 24 hours in seconds
```

### 2. Firebase Auth Service (`FirebaseAuthService.java`)

Located at: `backend/src/main/java/com/userjourney/analytics/service/FirebaseAuthService.java`

**Purpose**: Integrates with Firebase Authentication to verify user identity and check authorization.

**Key Methods**:
- `verifyIdToken(String idToken)` - Verify Firebase ID token
- `getUserByEmail(String email)` - Get Firebase user record by email
- `getUserRole(String email)` - Get user role from authorized users config
- `isAuthorizedUser(String email)` - Check if user is authorized to access system
- `getUserDisplayName(String email)` - Get display name for authorized user

**Features**:
- Verifies Firebase ID tokens
- Checks users against authorized users list
- Retrieves user roles from configuration
- Logs all authentication events for audit

### 3. Authorized Users Configuration (`AuthorizedUsersConfig.java`)

Located at: `backend/src/main/java/com/userjourney/analytics/config/AuthorizedUsersConfig.java`

**Purpose**: Loads and manages the list of authorized users from `authorized-users.yml`.

**Key Methods**:
- `isAuthorizedUser(String email)` - Check if email is in authorized list
- `getUserRole(String email)` - Get role for authorized user
- `getAuthorizedUser(String email)` - Get full user details

### 4. Authorized Users File (`authorized-users.yml`)

Located at: `backend/src/main/resources/authorized-users.yml`

**Purpose**: Defines the three authorized users and their roles.

**Structure**:
```yaml
authorized:
  users:
    - email: admin@example.com
      role: ADMIN
      displayName: System Administrator
      description: Full access to all system features
      
    - email: analyst@example.com
      role: ANALYST
      displayName: Data Analyst
      description: Access to analytics dashboard and reports
      
    - email: viewer@example.com
      role: VIEWER
      displayName: Report Viewer
      description: Read-only access to analytics
```

## User Roles

### ADMIN
- Full system access
- User management capabilities
- System configuration
- Analytics and reporting
- Data export

### ANALYST
- Analytics dashboard access
- Report generation
- Data export
- No user or system management

### VIEWER
- Read-only access
- View analytics and reports
- No data export
- No management capabilities

## Role Hierarchy

```
ADMIN > ANALYST > VIEWER
```

Higher roles inherit permissions from lower roles.

## Authentication Flow

### 1. User Login with Firebase
```
User → Firebase Auth → Firebase ID Token → Backend
```

1. User authenticates with Firebase (email/password, Google, etc.)
2. Firebase returns ID token
3. User sends ID token to backend `/api/auth/firebase-verify`
4. Backend verifies token with Firebase
5. Backend checks if user email is in authorized users list
6. Backend generates JWT token with user's role
7. Backend returns JWT token to user

### 2. API Request with JWT
```
User → API Request + JWT → Backend → Validate JWT → Process Request
```

1. User includes JWT in Authorization header: `Bearer <token>`
2. `JwtAuthenticationFilter` intercepts request
3. Filter validates JWT signature and expiration
4. Filter extracts user email and role from token
5. Filter sets authentication context
6. Request proceeds to controller with authenticated user

### 3. Token Refresh
```
User → Refresh Request + JWT → Backend → New JWT
```

1. User sends current JWT to `/api/auth/refresh`
2. Backend validates current token
3. Backend generates new token with same claims
4. Backend returns new token with extended expiration

## Configuration

### Application Configuration

Add to `application.yml`:
```yaml
spring:
  config:
    import:
      - classpath:authorized-users.yml

app:
  jwt:
    secret: ${JWT_SECRET}
    expiration: 86400  # 24 hours

firebase:
  project-id: ${FIREBASE_PROJECT_ID}
  credentials-path: ${FIREBASE_CREDENTIALS_PATH}
```

### Environment Variables

Required environment variables:
- `JWT_SECRET` - Secret key for JWT signing (minimum 256 bits)
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_CREDENTIALS_PATH` - Path to Firebase service account JSON

### Development vs Production

**Development** (`application-dev.yml`):
```yaml
firebase:
  emulator:
    enabled: true
    host: localhost
    port: 9099
```

**Production** (`application-production.yml`):
```yaml
firebase:
  emulator:
    enabled: false
  credentials:
    path: ${FIREBASE_CREDENTIALS_PATH}
```

## Security Considerations

### JWT Secret
- Must be at least 256 bits (32 characters)
- Should be randomly generated
- Must be kept secret and never committed to version control
- Should be different for each environment

### Token Expiration
- Development: 24 hours (86400 seconds)
- Production: 1 hour (3600 seconds) recommended
- Implement token refresh for better UX

### Authorized Users
- Only three users are authorized by default
- To add users, update `authorized-users.yml`
- Changes require application restart
- Consider moving to database for dynamic user management

### Firebase Credentials
- Service account JSON must be kept secure
- Never commit to version control
- Use environment variables or secrets management
- Restrict file permissions (600)

## API Endpoints

### POST /api/auth/firebase-verify
Verify Firebase ID token and get JWT.

**Request**:
```json
{
  "idToken": "firebase-id-token-here"
}
```

**Response**:
```json
{
  "token": "jwt-token-here",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "User Name",
    "role": "ADMIN",
    "type": "user"
  },
  "expiresIn": 3600,
  "timestamp": "2025-10-19T20:00:00"
}
```

### POST /api/auth/refresh
Refresh JWT token.

**Request**:
```json
{
  "token": "current-jwt-token"
}
```

**Response**:
```json
{
  "token": "new-jwt-token",
  "expiresIn": 3600,
  "timestamp": "2025-10-19T20:00:00"
}
```

### POST /api/auth/logout
Logout user (client-side token removal).

**Response**:
```json
{
  "message": "Logged out successfully",
  "timestamp": "2025-10-19T20:00:00"
}
```

## Testing

### Manual Testing

1. **Start Firebase Emulator** (Development):
```bash
firebase emulators:start --only auth
```

2. **Create Test User in Firebase**:
```bash
# Use Firebase Console or CLI
firebase auth:import users.json
```

3. **Test Authentication Flow**:
```bash
# Get Firebase ID token (use Firebase SDK in frontend)
# Then verify with backend
curl -X POST http://localhost:8080/api/auth/firebase-verify \
  -H "Content-Type: application/json" \
  -d '{"idToken": "firebase-token-here"}'
```

4. **Test JWT Validation**:
```bash
curl -X GET http://localhost:8080/api/protected-endpoint \
  -H "Authorization: Bearer jwt-token-here"
```

### Unit Testing

See test files in `backend/src/test/java/com/userjourney/analytics/service/`:
- `JwtServiceTest.java` (to be created)
- `FirebaseAuthServiceTest.java` (to be created)

## Troubleshooting

### "Invalid JWT token"
- Check JWT_SECRET is set correctly
- Verify token hasn't expired
- Ensure token format is correct (Bearer <token>)

### "User not authorized"
- Verify user email is in `authorized-users.yml`
- Check email matches exactly (case-insensitive)
- Restart application after updating authorized users

### "Firebase token verification failed"
- Check Firebase credentials are configured
- Verify Firebase project ID is correct
- Ensure Firebase service account has proper permissions
- Check network connectivity to Firebase

### "Token expired"
- Use token refresh endpoint
- Check token expiration configuration
- Verify system clock is synchronized

## Next Steps

After completing this task, the following tasks should be implemented:
1. Create JWT authentication filter (Task 2.1)
2. Configure role-based access control (Task 2.2)
3. Implement authentication endpoints (Task 2.3)
4. Create shared authentication components for frontend (Task 3)

## References

- [JWT.io](https://jwt.io/) - JWT token debugger
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Spring Security](https://spring.io/projects/spring-security)
