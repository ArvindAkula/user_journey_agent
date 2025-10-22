# Environment Variables Documentation

This document describes all required and optional environment variables for the User Journey Analytics application.

## Table of Contents

- [Frontend Applications](#frontend-applications)
  - [User App](#user-app)
  - [Analytics Dashboard](#analytics-dashboard)
- [Backend Application](#backend-application)
- [Security Best Practices](#security-best-practices)
- [Setup Instructions](#setup-instructions)

---

## Frontend Applications

### User App

#### Development Environment (`.env.development`)

**Required Variables:**

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `NODE_ENV` | Environment mode | `development` |
| `REACT_APP_API_BASE_URL` | Backend API base URL | `http://localhost:8080/api` |
| `REACT_APP_WEBSOCKET_URL` | WebSocket connection URL | `ws://localhost:8080/ws` |
| `REACT_APP_FIREBASE_USE_EMULATOR` | Enable Firebase emulator | `true` |
| `REACT_APP_FIREBASE_EMULATOR_HOST` | Firebase emulator host | `localhost` |
| `REACT_APP_FIREBASE_EMULATOR_PORT` | Firebase emulator port | `9099` |

**Optional Variables:**

| Variable | Description | Default Value |
|----------|-------------|---------------|
| `REACT_APP_DEBUG_MODE` | Enable debug logging | `true` |
| `REACT_APP_ENABLE_ANALYTICS` | Enable analytics tracking | `true` |
| `REACT_APP_ENABLE_VIDEO_TRACKING` | Enable video engagement tracking | `true` |
| `REACT_APP_ENABLE_INTERVENTIONS` | Enable intervention system | `true` |
| `PORT` | Development server port | `3000` |

#### Production Environment (`.env.production`)

**Required Variables:**

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `NODE_ENV` | Environment mode | `production` |
| `REACT_APP_API_BASE_URL` | Production API base URL | `https://api.journey-analytics.io/api` |
| `REACT_APP_WEBSOCKET_URL` | Production WebSocket URL | `wss://api.journey-analytics.io/ws` |
| `REACT_APP_FIREBASE_API_KEY` | Firebase API key | `AIzaSy...` |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | `your-project.firebaseapp.com` |
| `REACT_APP_FIREBASE_PROJECT_ID` | Firebase project ID | `your-project-id` |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | `your-project.appspot.com` |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | `123456789` |
| `REACT_APP_FIREBASE_APP_ID` | Firebase app ID | `1:123456789:web:abc123` |
| `REACT_APP_FIREBASE_MEASUREMENT_ID` | Firebase measurement ID | `G-XXXXXXXXXX` |

**Optional Variables:**

| Variable | Description | Default Value |
|----------|-------------|---------------|
| `REACT_APP_DEBUG_MODE` | Enable debug logging | `false` |
| `GENERATE_SOURCEMAP` | Generate source maps | `false` |

---

### Analytics Dashboard

#### Development Environment (`.env.development`)

**Required Variables:**

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `NODE_ENV` | Environment mode | `development` |
| `REACT_APP_API_BASE_URL` | Backend API base URL | `http://localhost:8080/api` |
| `REACT_APP_ANALYTICS_API_BASE_URL` | Analytics API base URL | `http://localhost:8080/api/analytics` |
| `REACT_APP_WEBSOCKET_URL` | WebSocket connection URL | `ws://localhost:8080/ws/analytics` |
| `REACT_APP_REALTIME_ENDPOINT` | Real-time data endpoint | `ws://localhost:8080/ws/realtime` |
| `REACT_APP_AUTH_ENDPOINT` | Authentication endpoint | `http://localhost:8080/api/auth` |

**Optional Variables:**

| Variable | Description | Default Value |
|----------|-------------|---------------|
| `REACT_APP_ANALYTICS_REFRESH_INTERVAL` | Data refresh interval (ms) | `30000` |
| `REACT_APP_EXPORT_MAX_RECORDS` | Max records per export | `10000` |
| `REACT_APP_PAGINATION_SIZE` | Records per page | `50` |
| `PORT` | Development server port | `3001` |

#### Production Environment (`.env.production`)

**Required Variables:**

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `NODE_ENV` | Environment mode | `production` |
| `REACT_APP_API_BASE_URL` | Production API base URL | `https://api.journey-analytics.io/api` |
| `REACT_APP_ANALYTICS_API_BASE_URL` | Production analytics API URL | `https://api.journey-analytics.io/api/analytics` |
| `REACT_APP_WEBSOCKET_URL` | Production WebSocket URL | `wss://api.journey-analytics.io/ws/analytics` |
| `REACT_APP_REALTIME_ENDPOINT` | Production real-time endpoint | `wss://api.journey-analytics.io/ws/realtime` |
| `REACT_APP_AUTH_ENDPOINT` | Production auth endpoint | `https://api.journey-analytics.io/api/auth` |
| `REACT_APP_FIREBASE_API_KEY` | Firebase API key | `AIzaSy...` |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | `your-project.firebaseapp.com` |
| `REACT_APP_FIREBASE_PROJECT_ID` | Firebase project ID | `your-project-id` |

---

## Backend Application

### Development Profile (`application-dev.yml` + Environment Variables)

**Required Environment Variables:**

None - all values have defaults in `application-dev.yml`

**Optional Environment Variables:**

| Variable | Description | Default Value |
|----------|-------------|---------------|
| `SPRING_PROFILES_ACTIVE` | Active Spring profile | `dev` |
| `SERVER_PORT` | Server port | `8080` |

### Production Profile (`application-prod.yml` + Environment Variables)

**Required Environment Variables:**

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `SPRING_PROFILES_ACTIVE` | Active Spring profile | `prod` |
| `JWT_SECRET` | JWT signing secret (base64) | `<base64-encoded-secret>` |
| `ENCRYPTION_KEY` | Data encryption key (base64) | `<base64-encoded-key>` |
| `FIREBASE_PROJECT_ID` | Firebase project ID | `your-project-id` |
| `FIREBASE_CREDENTIALS_PATH` | Path to Firebase service account JSON | `/path/to/firebase-service-account-prod.json` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `KINESIS_STREAM_NAME` | Kinesis stream name | `user-events-stream-prod` |
| `S3_BUCKET_NAME` | S3 bucket name | `user-journey-analytics-data-prod` |
| `AWS_SQS_DLQ_URL` | SQS dead letter queue URL | `https://sqs.us-east-1.amazonaws.com/...` |
| `AWS_SQS_RETRY_QUEUE_URL` | SQS retry queue URL | `https://sqs.us-east-1.amazonaws.com/...` |
| `BEDROCK_AGENT_ID` | Bedrock agent ID | `user-journey-orchestrator-prod` |
| `BEDROCK_AGENT_ALIAS_ID` | Bedrock agent alias ID | `PRODALIASID` |
| `SAGEMAKER_EXIT_RISK_ENDPOINT` | SageMaker endpoint name | `exit-risk-predictor-prod` |
| `REDIS_HOST` | Redis host | `your-redis-host.cache.amazonaws.com` |
| `REDIS_PASSWORD` | Redis password | `<redis-password>` |

**Optional Environment Variables:**

| Variable | Description | Default Value |
|----------|-------------|---------------|
| `SERVER_PORT` | Server port | `8080` |
| `JWT_EXPIRATION` | JWT expiration (seconds) | `86400` |
| `RATE_LIMIT_RPM` | Rate limit requests per minute | `100` |
| `SAGEMAKER_MODEL_THRESHOLD` | Model prediction threshold | `0.5` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_SSL_ENABLED` | Enable Redis SSL | `true` |
| `LOG_FILE_PATH` | Log file path | `/var/log/user-journey-analytics/backend.log` |

---

## Security Best Practices

### 1. Never Commit Sensitive Values

**DO NOT commit these files:**
- `.env`
- `.env.local`
- `.env.production`
- `.env.*.local`
- `firebase-service-account-*.json`

**Safe to commit:**
- `.env.development.template`
- `.env.production.template`
- `.env.example`

### 2. Generate Strong Secrets

**JWT Secret:**
```bash
# Generate a 256-bit random secret
openssl rand -base64 32
```

**Encryption Key:**
```bash
# Generate a 256-bit AES key
openssl rand -base64 32
```

### 3. Use Environment-Specific Keys

- **Development:** Use different keys than production
- **Production:** Store secrets in AWS Secrets Manager or similar
- **Never reuse:** Don't use the same keys across environments

### 4. Rotate Secrets Regularly

- Rotate JWT secrets every 90 days
- Rotate encryption keys annually
- Update Firebase credentials when team members leave

### 5. Validate on Startup

The application validates required environment variables on startup and fails fast if any are missing. This prevents runtime errors due to misconfiguration.

---

## Setup Instructions

### Development Setup

1. **Copy template files:**
   ```bash
   # User App
   cp packages/user-app/.env.development.template packages/user-app/.env.development
   
   # Analytics Dashboard
   cp packages/analytics-dashboard/.env.development.template packages/analytics-dashboard/.env.development
   ```

2. **Start LocalStack:**
   ```bash
   localstack start
   ```

3. **Start Firebase Emulator:**
   ```bash
   firebase emulators:start --only auth
   ```

4. **Start Backend:**
   ```bash
   cd backend
   export SPRING_PROFILES_ACTIVE=dev
   ./mvnw spring-boot:run
   ```

5. **Start Frontends:**
   ```bash
   # User App
   cd packages/user-app
   npm start
   
   # Analytics Dashboard (in another terminal)
   cd packages/analytics-dashboard
   npm start
   ```

### Production Setup

1. **Copy template files:**
   ```bash
   # User App
   cp packages/user-app/.env.production.template packages/user-app/.env.production
   
   # Analytics Dashboard
   cp packages/analytics-dashboard/.env.production.template packages/analytics-dashboard/.env.production
   ```

2. **Generate secrets:**
   ```bash
   # JWT Secret
   export JWT_SECRET=$(openssl rand -base64 32)
   
   # Encryption Key
   export ENCRYPTION_KEY=$(openssl rand -base64 32)
   ```

3. **Configure Firebase:**
   - Go to Firebase Console
   - Navigate to Project Settings
   - Copy configuration values to `.env.production` files
   - Download service account JSON for backend

4. **Configure AWS:**
   - Set up AWS credentials
   - Create required resources (DynamoDB, Kinesis, S3, SQS)
   - Note resource ARNs and names

5. **Update environment files:**
   - Fill in all `<placeholder>` values in `.env.production` files
   - Set all required backend environment variables

6. **Build and deploy:**
   ```bash
   # Build backend
   cd backend
   ./mvnw clean package -DskipTests
   
   # Build User App
   cd packages/user-app
   npm run build
   
   # Build Analytics Dashboard
   cd packages/analytics-dashboard
   npm run build
   ```

7. **Verify configuration:**
   ```bash
   # Check backend starts successfully
   export SPRING_PROFILES_ACTIVE=prod
   java -jar backend/target/analytics-backend.jar
   
   # Verify all required environment variables are set
   # Application will fail fast if any are missing
   ```

---

## Troubleshooting

### Missing Environment Variables

**Error:** `Failed to start application: Missing required environment variable: JWT_SECRET`

**Solution:** Set the missing environment variable:
```bash
export JWT_SECRET=$(openssl rand -base64 32)
```

### Invalid Firebase Credentials

**Error:** `Failed to initialize Firebase: Invalid credentials`

**Solution:** 
1. Verify Firebase service account JSON path is correct
2. Check file permissions
3. Ensure JSON file is valid

### AWS Connection Failures

**Error:** `Unable to connect to AWS services`

**Solution:**
1. Verify AWS credentials are configured
2. Check AWS region is correct
3. Ensure IAM permissions are sufficient
4. Verify network connectivity

### CORS Errors in Production

**Error:** `CORS policy: No 'Access-Control-Allow-Origin' header`

**Solution:**
1. Verify frontend domain is in `cors.allowed-origins` in `application-prod.yml`
2. Ensure HTTPS is used (not HTTP)
3. Check CloudFront/ALB configuration

---

## Additional Resources

- [Firebase Console](https://console.firebase.google.com/)
- [AWS Console](https://console.aws.amazon.com/)
- [Spring Boot Externalized Configuration](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.external-config)
- [Create React App Environment Variables](https://create-react-app.dev/docs/adding-custom-environment-variables/)
