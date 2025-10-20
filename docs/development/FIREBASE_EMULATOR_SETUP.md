# Firebase Emulator Setup Guide

## Overview

The Firebase Authentication Emulator allows you to develop and test authentication features locally without connecting to production Firebase services. This guide covers setup, configuration, and usage of the Firebase emulator for the User Journey Analytics Agent application.

## Prerequisites

- Node.js 14+ installed
- Firebase CLI installed
- Basic understanding of Firebase Authentication

## Installation

### Install Firebase CLI

**Using npm (recommended):**
```bash
npm install -g firebase-tools
```

**Using curl:**
```bash
curl -sL https://firebase.tools | bash
```

**Verify installation:**
```bash
firebase --version
```

## Quick Start

### 1. Start Firebase Emulator

```bash
./dev-scripts/start-firebase-emulator.sh
```

This script will:
- Start the Firebase Authentication emulator on port 9099
- Start the Firebase Emulator UI on port 4000
- Create three test users with different roles
- Display connection information

### 2. Verify Installation

Open your browser and navigate to:
- **Emulator UI**: http://localhost:4000
- **Auth Emulator**: http://localhost:9099

### 3. Stop Firebase Emulator

```bash
./dev-scripts/stop-firebase-emulator.sh
```

## Configuration

### Firebase Configuration Files

**firebase.json** - Main configuration file:
```json
{
  "emulators": {
    "auth": {
      "port": 9099,
      "host": "0.0.0.0"
    },
    "ui": {
      "enabled": true,
      "port": 4000,
      "host": "0.0.0.0"
    },
    "singleProjectMode": true
  }
}
```

**.firebaserc** - Project configuration:
```json
{
  "projects": {
    "default": "user-journey-analytics-dev"
  }
}
```

## Test Users

The emulator is pre-configured with three test users:

| Email | Password | Role | Description |
|-------|----------|------|-------------|
| admin@example.com | admin123 | ADMIN | Full system access |
| analyst@example.com | analyst123 | ANALYST | Analytics and reporting |
| viewer@example.com | viewer123 | VIEWER | Read-only access |

### User Roles

Roles are defined in `backend/src/main/resources/authorized-users.yml`:

**ADMIN:**
- User management
- System configuration
- Full analytics access
- Full reports access
- Data export
- Intervention management

**ANALYST:**
- Analytics read/write
- Reports read/write
- Data export

**VIEWER:**
- Analytics read-only
- Reports read-only

## Backend Configuration

### Spring Boot Configuration

**application-dev.yml:**
```yaml
spring:
  profiles: dev

firebase:
  emulator:
    enabled: true
    host: localhost
    port: 9099
  credentials:
    path: ./firebase-service-account-dev.json
```

### Java Configuration

```java
@Configuration
@Profile("dev")
public class FirebaseConfig {
    @Value("${firebase.emulator.enabled:false}")
    private boolean emulatorEnabled;
    
    @Value("${firebase.emulator.host:localhost}")
    private String emulatorHost;
    
    @Value("${firebase.emulator.port:9099}")
    private int emulatorPort;
    
    @Bean
    public FirebaseApp firebaseApp() throws IOException {
        if (emulatorEnabled) {
            // Configure for emulator
            System.setProperty("FIREBASE_AUTH_EMULATOR_HOST", 
                emulatorHost + ":" + emulatorPort);
        }
        
        FirebaseOptions options = FirebaseOptions.builder()
            .setCredentials(GoogleCredentials.getApplicationDefault())
            .build();
            
        return FirebaseApp.initializeApp(options);
    }
}
```

## Frontend Configuration

### React Environment Variables

**User App (.env.development):**
```bash
# Firebase Emulator Configuration
REACT_APP_FIREBASE_USE_EMULATOR=true
REACT_APP_FIREBASE_EMULATOR_HOST=localhost
REACT_APP_FIREBASE_EMULATOR_PORT=9099

# Firebase Project Configuration
REACT_APP_FIREBASE_API_KEY=fake-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=localhost
REACT_APP_FIREBASE_PROJECT_ID=user-journey-analytics-dev
```

**Analytics Dashboard (.env.development):**
```bash
# Same configuration as User App
REACT_APP_FIREBASE_USE_EMULATOR=true
REACT_APP_FIREBASE_EMULATOR_HOST=localhost
REACT_APP_FIREBASE_EMULATOR_PORT=9099
```

### Firebase SDK Configuration

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Connect to emulator in development
if (process.env.REACT_APP_FIREBASE_USE_EMULATOR === 'true') {
  const host = process.env.REACT_APP_FIREBASE_EMULATOR_HOST || 'localhost';
  const port = parseInt(process.env.REACT_APP_FIREBASE_EMULATOR_PORT || '9099');
  connectAuthEmulator(auth, `http://${host}:${port}`, { disableWarnings: true });
}

export { auth };
```

## Using the Emulator

### Creating Users Programmatically

**Using Firebase Admin SDK (Backend):**
```java
@Service
public class UserManagementService {
    public UserRecord createUser(String email, String password, String displayName) 
            throws FirebaseAuthException {
        UserRecord.CreateRequest request = new UserRecord.CreateRequest()
            .setEmail(email)
            .setPassword(password)
            .setDisplayName(displayName)
            .setEmailVerified(true);
            
        return FirebaseAuth.getInstance().createUser(request);
    }
}
```

**Using Firebase Client SDK (Frontend):**
```typescript
import { createUserWithEmailAndPassword } from 'firebase/auth';

async function createUser(email: string, password: string) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('User created:', userCredential.user);
  } catch (error) {
    console.error('Error creating user:', error);
  }
}
```

### Authenticating Users

**Frontend Login:**
```typescript
import { signInWithEmailAndPassword } from 'firebase/auth';

async function login(email: string, password: string) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    
    // Send idToken to backend for verification
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}
```

**Backend Token Verification:**
```java
@Service
public class FirebaseAuthService {
    public FirebaseToken verifyIdToken(String idToken) throws FirebaseAuthException {
        return FirebaseAuth.getInstance().verifyIdToken(idToken);
    }
    
    public String getUserRole(String email) {
        // Look up user role from authorized-users.yml
        return authorizedUsersConfig.getRoleForEmail(email);
    }
}
```

## Firebase Emulator UI

Access the Emulator UI at http://localhost:4000

### Features:

1. **Authentication Tab**
   - View all users
   - Create new users
   - Delete users
   - View user details and tokens

2. **User Management**
   - Add users manually
   - Set custom claims
   - Verify email addresses
   - Disable/enable users

3. **Token Inspector**
   - View ID tokens
   - Inspect token claims
   - Copy tokens for testing

## Testing Authentication Flow

### Manual Testing Steps

1. **Start the emulator:**
   ```bash
   ./dev-scripts/start-firebase-emulator.sh
   ```

2. **Start the backend:**
   ```bash
   cd backend
   SPRING_PROFILES_ACTIVE=dev ./mvnw spring-boot:run
   ```

3. **Start the frontend:**
   ```bash
   cd packages/user-app
   npm start
   ```

4. **Test login:**
   - Navigate to http://localhost:3000/login
   - Enter: admin@example.com / admin123
   - Verify successful login and redirect

5. **Test role-based access:**
   - Login as different users
   - Verify access to role-specific features
   - Test unauthorized access attempts

### Automated Testing

**Integration Test Example:**
```typescript
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase-config';

describe('Authentication Flow', () => {
  beforeAll(async () => {
    // Ensure emulator is running
    // Create test users if needed
  });
  
  test('should login with valid credentials', async () => {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      'admin@example.com',
      'admin123'
    );
    
    expect(userCredential.user).toBeDefined();
    expect(userCredential.user.email).toBe('admin@example.com');
  });
  
  test('should fail with invalid credentials', async () => {
    await expect(
      signInWithEmailAndPassword(auth, 'admin@example.com', 'wrongpassword')
    ).rejects.toThrow();
  });
});
```

## Troubleshooting

### Emulator won't start

1. **Check if Firebase CLI is installed:**
   ```bash
   firebase --version
   ```

2. **Check if port 9099 is in use:**
   ```bash
   lsof -i :9099
   ```

3. **View emulator logs:**
   ```bash
   tail -f firebase-emulator.log
   ```

### Connection refused errors

1. **Verify emulator is running:**
   ```bash
   curl http://localhost:9099
   ```

2. **Check environment variables:**
   ```bash
   echo $FIREBASE_AUTH_EMULATOR_HOST
   ```

3. **Ensure correct configuration in code:**
   ```typescript
   // Should see this in console
   console.log('Using Firebase emulator at localhost:9099');
   ```

### Users not persisting

The Firebase emulator does not persist data by default. Users are cleared when the emulator restarts.

**Solution:** Run the user creation script after each restart:
```bash
./dev-scripts/create-firebase-test-users.sh
```

### Token verification fails

1. **Check that backend is configured for emulator:**
   ```yaml
   firebase:
     emulator:
       enabled: true
   ```

2. **Verify FIREBASE_AUTH_EMULATOR_HOST is set:**
   ```bash
   export FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
   ```

3. **Check token in Emulator UI:**
   - Open http://localhost:4000
   - Go to Authentication tab
   - Click on user to view token

## Best Practices

1. **Always use emulator in development**: Never connect to production Firebase during development

2. **Create realistic test data**: Use test users that represent actual user scenarios

3. **Test all roles**: Verify authentication and authorization for each user role

4. **Use Emulator UI**: Leverage the UI for debugging and user management

5. **Reset data regularly**: Clear emulator data between major feature changes

6. **Document test credentials**: Keep test user credentials documented for team members

7. **Automate user creation**: Use scripts to create test users consistently

## Advanced Usage

### Custom Claims

Set custom claims for users:

```java
Map<String, Object> claims = new HashMap<>();
claims.put("role", "ADMIN");
claims.put("permissions", Arrays.asList("read", "write", "delete"));

FirebaseAuth.getInstance().setCustomUserClaims(uid, claims);
```

Access claims in frontend:
```typescript
const idTokenResult = await user.getIdTokenResult();
const role = idTokenResult.claims.role;
const permissions = idTokenResult.claims.permissions;
```

### Export/Import Users

**Export users:**
```bash
firebase auth:export users.json --project user-journey-analytics-dev
```

**Import users:**
```bash
firebase auth:import users.json --project user-journey-analytics-dev
```

### Multi-tenancy

Configure multiple tenants for testing:
```json
{
  "emulators": {
    "auth": {
      "port": 9099,
      "host": "0.0.0.0"
    }
  }
}
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Test with Firebase Emulator

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Firebase CLI
        run: npm install -g firebase-tools
      
      - name: Start Firebase Emulator
        run: |
          firebase emulators:start --only auth &
          sleep 10
      
      - name: Run Tests
        run: npm test
        env:
          FIREBASE_AUTH_EMULATOR_HOST: localhost:9099
```

## Resources

- [Firebase Emulator Suite Documentation](https://firebase.google.com/docs/emulator-suite)
- [Firebase Authentication Documentation](https://firebase.google.com/docs/auth)
- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Firebase emulator logs: `tail -f firebase-emulator.log`
3. Consult the Firebase documentation
4. Check the project's development documentation
