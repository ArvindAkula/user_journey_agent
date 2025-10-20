# Environment Configuration Setup Guide

## Overview

This guide explains how to set up and use the environment configuration system for the User Journey Analytics application. The system supports two environments:

- **Development (dev)**: Uses LocalStack for AWS services and Firebase Emulator for authentication
- **Production (prod)**: Uses actual AWS services and Firebase Authentication

## Quick Start

### Development Environment

1. **Install Dependencies**:
   ```bash
   # Install LocalStack
   pip install localstack
   
   # Install Firebase CLI
   npm install -g firebase-tools
   ```

2. **Start Local Services**:
   ```bash
   # Terminal 1: Start LocalStack
   localstack start
   
   # Terminal 2: Start Firebase Emulator
   firebase emulators:start --only auth
   ```

3. **Configure Backend**:
   ```bash
   cd backend
   export SPRING_PROFILES_ACTIVE=dev
   ./mvnw spring-boot:run
   ```

4. **Start Frontend Applications**:
   ```bash
   # Terminal 3: User App
   cd packages/user-app
   npm start  # Automatically uses .env.development
   
   # Terminal 4: Analytics Dashboard
   cd packages/analytics-dashboard
   npm start  # Automatically uses .env.development
   ```

### Production Environment

1. **Set Environment Variables**:
   ```bash
   export SPRING_PROFILES_ACTIVE=prod
   export AWS_REGION=us-east-1
   export FIREBASE_PROJECT_ID=your-project-id
   export FIREBASE_CREDENTIALS_PATH=/path/to/firebase-service-account-prod.json
   export JWT_SECRET=your-jwt-secret
   export ENCRYPTION_KEY=your-encryption-key
   # ... other production variables
   ```

2. **Build and Deploy**:
   ```bash
   # Build backend
   cd backend
   ./mvnw clean package
   java -jar target/analytics-backend.jar
   
   # Build frontends
   cd packages/user-app
   npm run build  # Uses .env.production
   
   cd packages/analytics-dashboard
   npm run build  # Uses .env.production
   ```

## Configuration Files

### Frontend Configuration

#### User App
- `.env.development` - Development environment variables
- `.env.production` - Production environment variables
- `.env.example` - Template with all available variables

#### Analytics Dashboard
- `.env.development` - Development environment variables
- `.env.production` - Production environment variables
- `.env.example` - Template with all available variables

### Backend Configuration

- `application.yml` - Base configuration (shared)
- `application-dev.yml` - Development profile
- `application-prod.yml` - Production profile

## Environment Variables

### Frontend Variables

#### Required for All Environments
```bash
NODE_ENV=development|production
REACT_APP_API_BASE_URL=<backend-api-url>
REACT_APP_WEBSOCKET_URL=<websocket-url>
```

#### Firebase Configuration
```bash
REACT_APP_FIREBASE_API_KEY=<api-key>
REACT_APP_FIREBASE_AUTH_DOMAIN=<auth-domain>
REACT_APP_FIREBASE_PROJECT_ID=<project-id>
REACT_APP_FIREBASE_STORAGE_BUCKET=<storage-bucket>
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
REACT_APP_FIREBASE_APP_ID=<app-id>
REACT_APP_FIREBASE_MEASUREMENT_ID=<measurement-id>
```

#### Firebase Emulator (Development Only)
```bash
REACT_APP_FIREBASE_USE_EMULATOR=true
REACT_APP_FIREBASE_EMULATOR_HOST=localhost
REACT_APP_FIREBASE_EMULATOR_PORT=9099
```

#### Feature Flags
```bash
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_VIDEO_TRACKING=true
REACT_APP_ENABLE_INTERVENTIONS=true
REACT_APP_ENABLE_EXPORT=true
REACT_APP_ENABLE_REALTIME=true
```

### Backend Variables

#### Required for Production
```bash
SPRING_PROFILES_ACTIVE=prod
AWS_REGION=us-east-1
FIREBASE_PROJECT_ID=<project-id>
FIREBASE_CREDENTIALS_PATH=<path-to-credentials>
JWT_SECRET=<base64-encoded-secret>
ENCRYPTION_KEY=<base64-encoded-key>
REDIS_HOST=<redis-host>
REDIS_PASSWORD=<redis-password>
```

#### AWS Service Configuration
```bash
KINESIS_STREAM_NAME=<stream-name>
S3_BUCKET_NAME=<bucket-name>
AWS_SQS_DLQ_URL=<dlq-url>
AWS_SQS_RETRY_QUEUE_URL=<retry-queue-url>
BEDROCK_AGENT_ID=<agent-id>
BEDROCK_AGENT_ALIAS_ID=<alias-id>
SAGEMAKER_EXIT_RISK_ENDPOINT=<endpoint-name>
```

## Using the Configuration in Code

### Frontend (TypeScript)

```typescript
import { 
  getConfig, 
  isDevelopment, 
  isProduction,
  getFirebaseAuth,
  initializeFirebase 
} from '@aws-agent/shared';

// Get current configuration
const config = getConfig();
console.log('API URL:', config.apiBaseUrl);
console.log('Environment:', config.environment);

// Check environment
if (isDevelopment()) {
  console.log('Running in development mode');
}

// Initialize Firebase
const app = initializeFirebase();
const auth = getFirebaseAuth(); // Automatically connects to emulator in dev
```

### Backend (Java)

```java
@Service
public class MyService {
    @Value("${spring.profiles.active}")
    private String activeProfile;
    
    @Autowired
    private DynamoDbClient dynamoDbClient; // Automatically uses correct endpoint
    
    @Autowired
    private FirebaseAuth firebaseAuth; // Automatically configured for environment
    
    public void doSomething() {
        if ("dev".equals(activeProfile)) {
            // Development-specific logic
        } else {
            // Production logic
        }
    }
}
```

## Switching Environments

### Frontend

The environment is automatically detected from `NODE_ENV`:

```bash
# Development
npm start  # Uses .env.development

# Production
npm run build  # Uses .env.production
```

### Backend

Set the `SPRING_PROFILES_ACTIVE` environment variable:

```bash
# Development
export SPRING_PROFILES_ACTIVE=dev
./mvnw spring-boot:run

# Production
export SPRING_PROFILES_ACTIVE=prod
java -jar target/analytics-backend.jar
```

## Verification

### Check Frontend Configuration

```typescript
import { getConfig, logConfiguration } from '@aws-agent/shared';

// Log configuration (only in debug mode)
logConfiguration();

// Validate configuration
const { valid, errors } = validateConfiguration();
if (!valid) {
  console.error('Configuration errors:', errors);
}
```

### Check Backend Configuration

Look for the startup banner in logs:

```
================================================================================
AWS Configuration Initialized
================================================================================
Active Profile: dev
AWS Region: us-east-1
Mock Enabled: true
Mock Endpoint: http://localhost:4566
Using LocalStack for AWS services
================================================================================

================================================================================
Firebase Configuration Initialized
================================================================================
Active Profile: dev
Project ID: user-journey-analytics-dev
Emulator Enabled: true
Emulator Host: localhost
Emulator Port: 9099
Using Firebase Auth Emulator
================================================================================
```

## Troubleshooting

### Frontend Issues

**Problem**: Configuration not loading
```bash
# Check if .env file exists
ls -la packages/user-app/.env*

# Verify NODE_ENV is set
echo $NODE_ENV

# Check browser console for validation errors
```

**Problem**: Firebase emulator not connecting
```bash
# Verify emulator is running
firebase emulators:start --only auth

# Check emulator URL in configuration
# Should be: http://localhost:9099
```

### Backend Issues

**Problem**: Wrong profile active
```bash
# Check active profile
echo $SPRING_PROFILES_ACTIVE

# Look for profile in startup logs
grep "Active Profile" backend/logs/backend-dev.log
```

**Problem**: AWS services not connecting
```bash
# Development: Check LocalStack
curl http://localhost:4566/_localstack/health

# Production: Check AWS credentials
aws sts get-caller-identity
```

**Problem**: Firebase authentication failing
```bash
# Check credentials file exists
ls -la backend/src/main/resources/firebase-service-account-*.json

# Verify Firebase project ID
grep "project-id" backend/src/main/resources/application-*.yml
```

## Security Best Practices

1. **Never commit credentials**:
   - `.env` files are in `.gitignore`
   - Use `.env.example` as templates
   - Firebase credentials are excluded from git

2. **Use environment variables in production**:
   - Don't hardcode secrets
   - Use AWS Secrets Manager or similar
   - Rotate credentials regularly

3. **Separate dev and prod credentials**:
   - Use different Firebase projects
   - Use different AWS accounts/regions
   - Use different encryption keys

4. **Validate configuration on startup**:
   - Frontend validates required variables
   - Backend fails fast on missing config
   - Check logs for configuration errors

## Additional Resources

- [LocalStack Documentation](https://docs.localstack.cloud/)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Spring Profiles](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.profiles)
- [Create React App Environment Variables](https://create-react-app.dev/docs/adding-custom-environment-variables/)
