# Developer Guide: Environment Switching and Development Workflow

## Table of Contents

1. [Overview](#overview)
2. [Environment Architecture](#environment-architecture)
3. [Switching Between Environments](#switching-between-environments)
4. [Development Workflow](#development-workflow)
5. [Testing Strategies](#testing-strategies)
6. [Debugging](#debugging)
7. [Best Practices](#best-practices)
8. [Common Scenarios](#common-scenarios)

## Overview

This guide is for developers working on the User Journey Analytics application. It covers:
- Understanding the environment architecture
- Switching between development and production modes
- Development workflow and best practices
- Testing and debugging techniques

## Environment Architecture

### Two-Environment System

The application supports two distinct environments:

**Development (dev)**:
- Local development on your machine
- Uses LocalStack for AWS services
- Uses Firebase Emulator for authentication
- Fast iteration and testing
- No cost for AWS services

**Production (prod)**:
- Deployed to AWS infrastructure
- Uses actual AWS services
- Uses Firebase Authentication
- Real user data
- Production-grade performance

### Environment Detection

**Frontend** (React):
```typescript
// Automatically detected from NODE_ENV
const environment = process.env.NODE_ENV; // 'development' or 'production'

// Using environment manager
import { isDevelopment, isProduction } from '@aws-agent/shared';

if (isDevelopment()) {
  console.log('Running in development mode');
}
```

**Backend** (Spring Boot):
```java
// Detected from SPRING_PROFILES_ACTIVE
@Value("${spring.profiles.active}")
private String activeProfile;

// Profile-specific beans
@Bean
@Profile("dev")
public DynamoDbClient devDynamoDbClient() {
  // LocalStack configuration
}

@Bean
@Profile("prod")
public DynamoDbClient prodDynamoDbClient() {
  // AWS configuration
}
```

### Configuration Files

**Frontend**:
```
packages/user-app/
├── .env.development      # Dev environment variables
├── .env.production       # Prod environment variables
└── .env.example          # Template

packages/analytics-dashboard/
├── .env.development
├── .env.production
└── .env.example
```

**Backend**:
```
backend/src/main/resources/
├── application.yml           # Base configuration
├── application-dev.yml       # Dev profile
├── application-prod.yml      # Prod profile
└── authorized-users.yml      # User configuration
```

## Switching Between Environments

### Frontend Environment Switching

#### Development Mode

```bash
cd packages/user-app

# Start in development mode (default)
npm start

# Or explicitly set NODE_ENV
NODE_ENV=development npm start

# Uses .env.development automatically
```

#### Production Mode (Local Build)

```bash
cd packages/user-app

# Build for production
npm run build

# Serve production build locally
npx serve -s build

# Uses .env.production for build
```

#### Environment-Specific Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "start": "react-scripts start",
    "start:dev": "NODE_ENV=development react-scripts start",
    "start:prod": "NODE_ENV=production react-scripts start",
    "build": "react-scripts build",
    "build:dev": "NODE_ENV=development react-scripts build",
    "build:prod": "NODE_ENV=production react-scripts build"
  }
}
```

### Backend Environment Switching

#### Development Mode

```bash
cd backend

# Method 1: Environment variable
export SPRING_PROFILES_ACTIVE=dev
./mvnw spring-boot:run

# Method 2: Command line argument
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# Method 3: IDE configuration
# In IntelliJ IDEA:
# Run > Edit Configurations > Environment Variables
# Add: SPRING_PROFILES_ACTIVE=dev
```

#### Production Mode (Local Testing)

```bash
cd backend

# Set production profile
export SPRING_PROFILES_ACTIVE=prod

# Ensure production environment variables are set
export AWS_REGION=us-east-1
export FIREBASE_PROJECT_ID=journey-analytics-prod
export JWT_SECRET=your-jwt-secret
# ... other production variables

# Run application
./mvnw spring-boot:run

# Or run JAR
java -jar target/analytics-backend.jar
```

#### Profile-Specific Scripts

Create shell scripts:

**start-dev.sh**:
```bash
#!/bin/bash
export SPRING_PROFILES_ACTIVE=dev
./mvnw spring-boot:run
```

**start-prod.sh**:
```bash
#!/bin/bash
export SPRING_PROFILES_ACTIVE=prod
# Load production environment variables
source .env.production
java -jar target/analytics-backend.jar
```

### Verifying Active Environment

#### Frontend Verification

```typescript
// In browser console
console.log('Environment:', process.env.NODE_ENV);
console.log('API URL:', process.env.REACT_APP_API_BASE_URL);
console.log('Firebase Emulator:', process.env.REACT_APP_FIREBASE_USE_EMULATOR);

// Using environment manager
import { getConfig, logConfiguration } from '@aws-agent/shared';

const config = getConfig();
console.log('Current configuration:', config);

// Log all configuration (debug mode only)
logConfiguration();
```

#### Backend Verification

Check startup logs:
```
================================================================================
Environment Configuration
================================================================================
Active Profile: dev
AWS Region: us-east-1
Mock Enabled: true
Mock Endpoint: http://localhost:4566
Firebase Emulator: true
Emulator Host: localhost:9099
================================================================================
```

Or check programmatically:
```java
@RestController
@RequestMapping("/api/debug")
public class DebugController {
    
    @Value("${spring.profiles.active}")
    private String activeProfile;
    
    @GetMapping("/environment")
    public Map<String, String> getEnvironment() {
        return Map.of(
            "profile", activeProfile,
            "awsMockEnabled", String.valueOf(awsMockEnabled),
            "firebaseEmulatorEnabled", String.valueOf(firebaseEmulatorEnabled)
        );
    }
}
```

## Development Workflow

### Standard Development Flow

1. **Start Local Services**:
```bash
# Terminal 1: LocalStack
localstack start

# Terminal 2: Firebase Emulator
firebase emulators:start --only auth

# Terminal 3: Backend
cd backend
export SPRING_PROFILES_ACTIVE=dev
./mvnw spring-boot:run

# Terminal 4: User App
cd packages/user-app
npm start

# Terminal 5: Analytics Dashboard
cd packages/analytics-dashboard
npm start
```

2. **Make Code Changes**:
   - Edit source files
   - Hot reload automatically applies changes
   - Backend requires restart for some changes

3. **Test Changes**:
   - Test in browser (http://localhost:3000)
   - Check browser console for errors
   - Review backend logs
   - Test API endpoints with curl/Postman

4. **Commit Changes**:
```bash
git add .
git commit -m "Description of changes"
git push
```

### Quick Start Script

Create `dev-start.sh`:
```bash
#!/bin/bash

echo "Starting development environment..."

# Start LocalStack in background
echo "Starting LocalStack..."
localstack start &
LOCALSTACK_PID=$!

# Wait for LocalStack to be ready
sleep 5

# Start Firebase Emulator in background
echo "Starting Firebase Emulator..."
firebase emulators:start --only auth &
FIREBASE_PID=$!

# Wait for Firebase to be ready
sleep 3

# Start backend in background
echo "Starting backend..."
cd backend
export SPRING_PROFILES_ACTIVE=dev
./mvnw spring-boot:run &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 10

# Start frontends
echo "Starting User App..."
cd ../packages/user-app
npm start &
USER_APP_PID=$!

echo "Starting Analytics Dashboard..."
cd ../analytics-dashboard
npm start &
DASHBOARD_PID=$!

echo "Development environment started!"
echo "LocalStack: http://localhost:4566"
echo "Firebase Emulator: http://localhost:4000"
echo "Backend: http://localhost:8080"
echo "User App: http://localhost:3000"
echo "Analytics Dashboard: http://localhost:3001"

# Wait for user to stop
read -p "Press Enter to stop all services..."

# Kill all processes
kill $LOCALSTACK_PID $FIREBASE_PID $BACKEND_PID $USER_APP_PID $DASHBOARD_PID
```

### Environment-Specific Development

#### Testing with LocalStack

```bash
# Create DynamoDB table
aws dynamodb create-table \
  --table-name user-events \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=timestamp,AttributeType=N \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:4566

# Put item
aws dynamodb put-item \
  --table-name user-events \
  --item '{"userId":{"S":"test-user"},"timestamp":{"N":"1234567890"},"event":{"S":"page_view"}}' \
  --endpoint-url http://localhost:4566

# Query items
aws dynamodb query \
  --table-name user-events \
  --key-condition-expression "userId = :userId" \
  --expression-attribute-values '{":userId":{"S":"test-user"}}' \
  --endpoint-url http://localhost:4566
```

#### Testing with Firebase Emulator

```typescript
// In your test file
import { getAuth, connectAuthEmulator } from 'firebase/auth';

const auth = getAuth();
if (process.env.REACT_APP_FIREBASE_USE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099');
}

// Create test user
import { createUserWithEmailAndPassword } from 'firebase/auth';

const testUser = await createUserWithEmailAndPassword(
  auth,
  'test@example.com',
  'password123'
);
```

#### Testing Production Configuration Locally

```bash
# Set production environment variables
export SPRING_PROFILES_ACTIVE=prod
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export FIREBASE_PROJECT_ID=journey-analytics-prod
export FIREBASE_CREDENTIALS_PATH=/path/to/firebase-service-account-prod.json
export JWT_SECRET=your-jwt-secret
export ENCRYPTION_KEY=your-encryption-key

# Start backend with production configuration
cd backend
./mvnw spring-boot:run

# Test against actual AWS services
# BE CAREFUL: This will use real AWS resources and incur costs
```

## Testing Strategies

### Unit Testing

#### Frontend Unit Tests

```typescript
// UserService.test.ts
import { render, screen, waitFor } from '@testing-library/react';
import { AuthService } from './AuthService';

describe('AuthService', () => {
  it('should login successfully', async () => {
    const authService = new AuthService();
    const result = await authService.login('test@example.com', 'password');
    
    expect(result.token).toBeDefined();
    expect(result.user.email).toBe('test@example.com');
  });
  
  it('should handle login failure', async () => {
    const authService = new AuthService();
    
    await expect(
      authService.login('invalid@example.com', 'wrong')
    ).rejects.toThrow('Invalid credentials');
  });
});
```

#### Backend Unit Tests

```java
@SpringBootTest
@ActiveProfiles("test")
class AuthServiceTest {
    
    @Autowired
    private AuthService authService;
    
    @Test
    void shouldAuthenticateUser() {
        // Given
        String email = "test@example.com";
        String password = "password";
        
        // When
        AuthResponse response = authService.authenticate(email, password);
        
        // Then
        assertNotNull(response.getToken());
        assertEquals(email, response.getUser().getEmail());
    }
    
    @Test
    void shouldRejectInvalidCredentials() {
        // Given
        String email = "invalid@example.com";
        String password = "wrong";
        
        // When/Then
        assertThrows(AuthenticationException.class, () -> {
            authService.authenticate(email, password);
        });
    }
}
```

### Integration Testing

#### Frontend Integration Tests

```typescript
// LoginFlow.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

describe('Login Flow', () => {
  it('should complete full login flow', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    
    // Navigate to login
    const loginButton = screen.getByText('Login');
    fireEvent.click(loginButton);
    
    // Enter credentials
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password' } });
    
    // Submit form
    const submitButton = screen.getByText('Submit');
    fireEvent.click(submitButton);
    
    // Wait for redirect
    await waitFor(() => {
      expect(screen.getByText('Welcome')).toBeInTheDocument();
    });
  });
});
```

#### Backend Integration Tests

```java
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class AuthControllerIntegrationTest {
    
    @Autowired
    private TestRestTemplate restTemplate;
    
    @Test
    void shouldLoginSuccessfully() {
        // Given
        LoginRequest request = new LoginRequest("test@example.com", "password");
        
        // When
        ResponseEntity<AuthResponse> response = restTemplate.postForEntity(
            "/api/auth/login",
            request,
            AuthResponse.class
        );
        
        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody().getToken());
    }
    
    @Test
    void shouldRejectUnauthorizedUser() {
        // Given
        LoginRequest request = new LoginRequest("unauthorized@example.com", "password");
        
        // When
        ResponseEntity<AuthResponse> response = restTemplate.postForEntity(
            "/api/auth/login",
            request,
            AuthResponse.class
        );
        
        // Then
        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }
}
```

### End-to-End Testing

```typescript
// e2e/login.spec.ts (Cypress)
describe('Login E2E', () => {
  it('should login and access protected route', () => {
    cy.visit('http://localhost:3000');
    
    // Click login
    cy.contains('Login').click();
    
    // Enter credentials
    cy.get('input[name="email"]').type('test@example.com');
    cy.get('input[name="password"]').type('password');
    
    // Submit
    cy.get('button[type="submit"]').click();
    
    // Verify redirect
    cy.url().should('include', '/dashboard');
    cy.contains('Welcome').should('be.visible');
    
    // Verify token stored
    cy.window().then((win) => {
      const token = win.localStorage.getItem('authToken');
      expect(token).to.exist;
    });
  });
});
```

## Debugging

### Frontend Debugging

#### Browser DevTools

```typescript
// Enable debug logging
localStorage.setItem('debug', 'true');

// Log configuration
import { logConfiguration } from '@aws-agent/shared';
logConfiguration();

// Debug API calls
import axios from 'axios';

axios.interceptors.request.use(request => {
  console.log('Starting Request', request);
  return request;
});

axios.interceptors.response.use(response => {
  console.log('Response:', response);
  return response;
});
```

#### React DevTools

1. Install React DevTools browser extension
2. Open DevTools > Components tab
3. Inspect component props and state
4. Profile component performance

#### Redux DevTools (if using Redux)

1. Install Redux DevTools extension
2. Open DevTools > Redux tab
3. View action history
4. Time-travel debugging

### Backend Debugging

#### IntelliJ IDEA Debugging

1. Set breakpoints in code
2. Run > Debug 'Application'
3. Step through code
4. Inspect variables
5. Evaluate expressions

#### Remote Debugging

```bash
# Start backend with debug port
./mvnw spring-boot:run -Dspring-boot.run.jvmArguments="-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=5005"

# In IntelliJ IDEA:
# Run > Edit Configurations > Add New > Remote JVM Debug
# Host: localhost
# Port: 5005
# Click Debug
```

#### Logging

```java
// Add detailed logging
@Slf4j
@Service
public class AuthService {
    
    public AuthResponse authenticate(String email, String password) {
        log.debug("Authenticating user: {}", email);
        
        try {
            // Authentication logic
            log.info("User authenticated successfully: {}", email);
            return response;
        } catch (Exception e) {
            log.error("Authentication failed for user: {}", email, e);
            throw e;
        }
    }
}
```

#### Log Levels

```yaml
# application-dev.yml
logging:
  level:
    root: INFO
    com.userjourney.analytics: DEBUG
    org.springframework.web: DEBUG
    org.springframework.security: DEBUG
```

### Network Debugging

#### Inspect API Calls

```bash
# Use curl with verbose output
curl -v -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/events

# Use httpie
http -v GET http://localhost:8080/api/events \
  Authorization:"Bearer $TOKEN"

# Use Postman
# Import collection and test endpoints
```

#### Monitor Network Traffic

```bash
# Use Charles Proxy or Wireshark
# Configure browser to use proxy
# Monitor all HTTP/HTTPS traffic
```

## Best Practices

### Environment Configuration

1. **Never commit secrets**:
   - Use `.env.example` as template
   - Add `.env` to `.gitignore`
   - Use environment variables for secrets

2. **Validate configuration on startup**:
```typescript
// Frontend
function validateConfig() {
  const required = [
    'REACT_APP_API_BASE_URL',
    'REACT_APP_FIREBASE_PROJECT_ID'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateConfig();
```

```java
// Backend
@Component
public class ConfigValidator implements ApplicationListener<ApplicationReadyEvent> {
    
    @Value("${jwt.secret:}")
    private String jwtSecret;
    
    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        if (jwtSecret.isEmpty()) {
            throw new IllegalStateException("JWT secret is not configured");
        }
    }
}
```

3. **Use environment-specific defaults**:
```typescript
const config = {
  apiBaseUrl: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080',
  timeout: process.env.REACT_APP_TIMEOUT || 30000,
  retries: process.env.REACT_APP_RETRIES || 3
};
```

### Code Organization

1. **Separate environment logic**:
```typescript
// config/environment.ts
export const getEnvironmentConfig = () => {
  if (isDevelopment()) {
    return {
      apiUrl: 'http://localhost:8080',
      logLevel: 'debug'
    };
  } else {
    return {
      apiUrl: 'https://api.journey-analytics.io',
      logLevel: 'error'
    };
  }
};
```

2. **Use dependency injection**:
```java
@Configuration
public class ServiceConfig {
    
    @Bean
    @Profile("dev")
    public StorageService devStorageService() {
        return new LocalStorageService();
    }
    
    @Bean
    @Profile("prod")
    public StorageService prodStorageService() {
        return new S3StorageService();
    }
}
```

### Testing

1. **Test both environments**:
   - Unit tests with mocked dependencies
   - Integration tests with LocalStack
   - E2E tests against staging environment

2. **Use test-specific configuration**:
```yaml
# application-test.yml
spring:
  profiles: test

# Use in-memory database
spring:
  datasource:
    url: jdbc:h2:mem:testdb
```

3. **Clean up test data**:
```java
@AfterEach
void cleanup() {
    // Clean up test data
    userRepository.deleteAll();
    eventRepository.deleteAll();
}
```

## Common Scenarios

### Scenario 1: Testing New Feature Locally

```bash
# 1. Start development environment
./dev-start.sh

# 2. Create feature branch
git checkout -b feature/new-feature

# 3. Implement feature
# Edit code files

# 4. Test locally
# Open http://localhost:3000
# Test feature manually

# 5. Write tests
# Add unit tests
# Add integration tests

# 6. Run tests
npm test  # Frontend
mvn test  # Backend

# 7. Commit and push
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# 8. Create pull request
```

### Scenario 2: Debugging Production Issue Locally

```bash
# 1. Get production configuration
# Download from AWS Secrets Manager or secure location

# 2. Set production environment variables
export SPRING_PROFILES_ACTIVE=prod
export AWS_REGION=us-east-1
# ... other production variables

# 3. Start backend with production config
cd backend
./mvnw spring-boot:run

# 4. Reproduce issue
# Test against actual AWS services
# Review logs for errors

# 5. Fix issue
# Edit code

# 6. Test fix
# Verify issue is resolved

# 7. Deploy fix
# Follow deployment process
```

### Scenario 3: Switching from Dev to Prod

```bash
# Frontend
cd packages/user-app

# Build for production
npm run build

# Deploy to S3
aws s3 sync build/ s3://user-app-prod --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"

# Backend
cd backend

# Build production JAR
mvn clean package -DskipTests

# Build Docker image
docker build -t user-journey-backend:latest .

# Push to ECR
docker push $ECR_REGISTRY/user-journey-backend:latest

# Update ECS service
aws ecs update-service \
  --cluster user-journey-cluster \
  --service backend-service \
  --force-new-deployment
```

### Scenario 4: Adding New Environment Variable

```bash
# 1. Add to .env.example
echo "REACT_APP_NEW_FEATURE=true" >> packages/user-app/.env.example

# 2. Add to .env.development
echo "REACT_APP_NEW_FEATURE=true" >> packages/user-app/.env.development

# 3. Add to .env.production
echo "REACT_APP_NEW_FEATURE=false" >> packages/user-app/.env.production

# 4. Use in code
const newFeatureEnabled = process.env.REACT_APP_NEW_FEATURE === 'true';

# 5. Document in README
# Add description of new variable

# 6. Update deployment scripts
# Ensure variable is set in production

# 7. Commit changes
git add .
git commit -m "Add new feature flag"
git push
```

## Additional Resources

- [Setup Documentation](./SETUP_DOCUMENTATION.md)
- [Environment Setup Guide](./ENVIRONMENT_SETUP_GUIDE.md)
- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)
- [Admin Guide](./ADMIN_GUIDE.md)

---

**Happy coding! For questions, contact the development team.**
