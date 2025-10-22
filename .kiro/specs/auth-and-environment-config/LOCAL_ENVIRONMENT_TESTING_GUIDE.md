# Local Environment Testing Guide: Dev vs Prod

This guide provides step-by-step instructions for testing both development and production configurations locally before deploying to production infrastructure.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Development Environment Setup](#development-environment-setup)
3. [Production-Like Environment Setup](#production-like-environment-setup)
4. [Testing Development Mode](#testing-development-mode)
5. [Testing Production Mode Locally](#testing-production-mode-locally)
6. [Verification Checklist](#verification-checklist)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools
- [ ] Java 17+ installed
- [ ] Node.js 18+ and npm installed
- [ ] Docker and Docker Compose installed
- [ ] Maven installed
- [ ] Firebase CLI installed (`npm install -g firebase-tools`)
- [ ] AWS CLI installed (optional, for production testing)

### Required Accounts
- [ ] Firebase project created (for production testing)
- [ ] AWS account (for production testing)
- [ ] Test user accounts created in Firebase

---

## Development Environment Setup

### 1. Start LocalStack (Mock AWS Services)

```bash
# Start LocalStack using Docker
docker run -d \
  --name localstack \
  -p 4566:4566 \
  -p 4571:4571 \
  -e SERVICES=dynamodb,kinesis,s3,sqs,cloudwatch,ec2,lambda \
  -e DEBUG=1 \
  -e DATA_DIR=/tmp/localstack/data \
  localstack/localstack

# Verify LocalStack is running
curl http://localhost:4566/_localstack/health
```

**Expected Output:**
```json
{
  "services": {
    "dynamodb": "running",
    "kinesis": "running",
    "s3": "running",
    "sqs": "running"
  }
}
```

### 2. Initialize LocalStack Resources

```bash
# Create DynamoDB tables
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
  --table-name UserProfiles \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

aws --endpoint-url=http://localhost:4566 dynamodb create-table \
  --table-name UserEvents \
  --attribute-definitions AttributeName=eventId,AttributeType=S \
  --key-schema AttributeName=eventId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# Create Kinesis stream
aws --endpoint-url=http://localhost:4566 kinesis create-stream \
  --stream-name user-events-stream-dev \
  --shard-count 1

# Create S3 bucket
aws --endpoint-url=http://localhost:4566 s3 mb s3://user-journey-analytics-data-dev

# Create SQS queues
aws --endpoint-url=http://localhost:4566 sqs create-queue \
  --queue-name user-journey-dlq-dev

aws --endpoint-url=http://localhost:4566 sqs create-queue \
  --queue-name user-journey-retry-dev

# Verify resources
aws --endpoint-url=http://localhost:4566 dynamodb list-tables
aws --endpoint-url=http://localhost:4566 kinesis list-streams
aws --endpoint-url=http://localhost:4566 s3 ls
aws --endpoint-url=http://localhost:4566 sqs list-queues
```

### 3. Start Firebase Emulator

```bash
# Initialize Firebase in your project (if not already done)
cd backend
firebase init emulators

# Start Firebase Emulator Suite
firebase emulators:start --only auth

# Or start all emulators
firebase emulators:start
```

**Expected Output:**
```
✔  emulators: All emulators ready! It is now safe to connect.

┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
│ i  View Emulator UI at http://localhost:4000                │
└─────────────────────────────────────────────────────────────┘

┌────────────────┬────────────────┬─────────────────────────────────┐
│ Emulator       │ Host:Port      │ View in Emulator UI             │
├────────────────┼────────────────┼─────────────────────────────────┤
│ Authentication │ localhost:9099 │ http://localhost:4000/auth      │
└────────────────┴────────────────┴─────────────────────────────────┘
```

### 4. Create Test Users in Firebase Emulator

```bash
# Open Firebase Emulator UI
open http://localhost:4000

# Or use Firebase CLI to create users
firebase auth:import test-users.json --project demo-project
```

**test-users.json:**
```json
{
  "users": [
    {
      "localId": "viewer-user-123",
      "email": "viewer@test.com",
      "passwordHash": "password123",
      "displayName": "Test Viewer",
      "customAttributes": "{\"role\":\"VIEWER\"}"
    },
    {
      "localId": "analyst-user-123",
      "email": "analyst@test.com",
      "passwordHash": "password123",
      "displayName": "Test Analyst",
      "customAttributes": "{\"role\":\"ANALYST\"}"
    },
    {
      "localId": "admin-user-123",
      "email": "admin@test.com",
      "passwordHash": "password123",
      "displayName": "Test Admin",
      "customAttributes": "{\"role\":\"ADMIN\"}"
    }
  ]
}
```

### 5. Configure Development Environment Variables

**Backend (.env or application-dev.yml is already configured)**

Verify `backend/src/main/resources/application-dev.yml`:
```yaml
spring:
  profiles: dev

aws:
  region: us-east-1
  mock:
    enabled: true
    endpoint: http://localhost:4566

firebase:
  emulator:
    enabled: true
    host: localhost
    port: 9099
```

**Frontend (packages/user-app/.env.development)**

Verify the file exists with:
```env
NODE_ENV=development
REACT_APP_API_BASE_URL=http://localhost:8080/api
REACT_APP_FIREBASE_USE_EMULATOR=true
REACT_APP_FIREBASE_EMULATOR_HOST=localhost
REACT_APP_FIREBASE_EMULATOR_PORT=9099
```

---

## Production-Like Environment Setup

### 1. Set Up Firebase Production Project

```bash
# Login to Firebase
firebase login

# Create a new Firebase project (or use existing)
firebase projects:create user-journey-analytics-prod

# Select the project
firebase use user-journey-analytics-prod

# Enable Authentication
firebase auth:enable

# Enable Analytics
firebase analytics:enable
```

### 2. Download Firebase Service Account Key

```bash
# Go to Firebase Console
open https://console.firebase.google.com

# Navigate to: Project Settings > Service Accounts
# Click "Generate New Private Key"
# Save as: backend/src/main/resources/firebase-service-account-prod.json

# IMPORTANT: Add to .gitignore
echo "firebase-service-account-prod.json" >> backend/.gitignore
```

### 3. Configure AWS Credentials (for Production Testing)

```bash
# Configure AWS CLI with your credentials
aws configure

# Or set environment variables
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=us-east-1
```

### 4. Create AWS Resources (Optional - for full production testing)

```bash
# Create DynamoDB tables
aws dynamodb create-table \
  --table-name UserProfiles-prod \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# Create Kinesis stream
aws kinesis create-stream \
  --stream-name user-events-stream-prod \
  --shard-count 1

# Create S3 bucket
aws s3 mb s3://user-journey-analytics-data-prod

# Create SQS queues
aws sqs create-queue --queue-name user-journey-dlq-prod
aws sqs create-queue --queue-name user-journey-retry-prod
```

### 5. Configure Production Environment Variables

**Backend**

Create `backend/src/main/resources/application-prod-local.yml`:
```yaml
spring:
  profiles: prod

aws:
  region: us-east-1
  mock:
    enabled: false

firebase:
  project-id: user-journey-analytics-prod
  credentials-path: classpath:firebase-service-account-prod.json
  emulator:
    enabled: false

# Use environment variables for sensitive data
app:
  jwt:
    secret: ${JWT_SECRET}
  encryption:
    key: ${ENCRYPTION_KEY}
```

**Frontend**

Create `packages/user-app/.env.production.local`:
```env
NODE_ENV=production
REACT_APP_API_BASE_URL=http://localhost:8080/api
REACT_APP_FIREBASE_API_KEY=your-firebase-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=user-journey-analytics-prod
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
REACT_APP_FIREBASE_MEASUREMENT_ID=your-measurement-id
REACT_APP_FIREBASE_USE_EMULATOR=false
```

### 6. Set Environment Variables

```bash
# Create .env file for backend
cat > backend/.env.prod.local << EOF
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
FIREBASE_PROJECT_ID=user-journey-analytics-prod
AWS_REGION=us-east-1
EOF

# Load environment variables
source backend/.env.prod.local
```

---

## Testing Development Mode

### 1. Start Backend in Dev Mode

```bash
cd backend

# Start with dev profile
SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run

# Or using Java
SPRING_PROFILES_ACTIVE=dev java -jar target/analytics-backend-0.0.1-SNAPSHOT.jar
```

**Verify in logs:**
```
=============================================================================
AWS Configuration Initialized
=============================================================================
Active Profile: dev
AWS Region: us-east-1
Mock Enabled: true
Mock Endpoint: http://localhost:4566
Using LocalStack for AWS services
=============================================================================
```

### 2. Start Frontend in Dev Mode

```bash
# Terminal 1: User App
cd packages/user-app
npm start

# Terminal 2: Analytics Dashboard
cd packages/analytics-dashboard
npm start
```

**Verify in browser console:**
```
🔧 Environment Configuration
Environment: development
API Base URL: http://localhost:8080/api
Firebase Emulator: true
```

### 3. Test Development Mode Features

#### Test 1: LocalStack Connection
```bash
# Check backend logs for LocalStack connections
# Should see: "Creating DynamoDB client for development (LocalStack)"

# Verify data in LocalStack
aws --endpoint-url=http://localhost:4566 dynamodb scan --table-name UserProfiles
```

#### Test 2: Firebase Emulator Authentication
```bash
# Open User App: http://localhost:3000
# Login with: viewer@test.com / password123
# Check Firebase Emulator UI: http://localhost:4000/auth
# Should see the authentication event
```

#### Test 3: Firebase Analytics Debug View
```bash
# Open Firebase Console
# Navigate to Analytics > DebugView
# Perform actions in User App
# Should see events in real-time (if using production Firebase)
# Or check console logs for event tracking
```

#### Test 4: API Endpoints
```bash
# Test health endpoint
curl http://localhost:8080/api/health

# Test protected endpoint (should fail without token)
curl http://localhost:8080/api/events

# Get token and test again
TOKEN=$(curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"viewer@test.com","password":"password123"}' \
  | jq -r '.token')

curl http://localhost:8080/api/events \
  -H "Authorization: Bearer $TOKEN"
```

---

## Testing Production Mode Locally

### 1. Stop Development Services

```bash
# Stop LocalStack
docker stop localstack

# Stop Firebase Emulator
# Press Ctrl+C in the terminal running firebase emulators:start

# Stop backend and frontend
# Press Ctrl+C in respective terminals
```

### 2. Start Backend in Prod Mode

```bash
cd backend

# Load production environment variables
source .env.prod.local

# Start with prod profile
SPRING_PROFILES_ACTIVE=prod mvn spring-boot:run

# Or using Java
SPRING_PROFILES_ACTIVE=prod \
  JWT_SECRET=$JWT_SECRET \
  ENCRYPTION_KEY=$ENCRYPTION_KEY \
  java -jar target/analytics-backend-0.0.1-SNAPSHOT.jar
```

**Verify in logs:**
```
=============================================================================
AWS Configuration Initialized
=============================================================================
Active Profile: prod
AWS Region: us-east-1
Mock Enabled: false
Using actual AWS services
=============================================================================
```

### 3. Start Frontend in Prod Mode

```bash
# Terminal 1: User App
cd packages/user-app
npm run build
npm install -g serve
serve -s build -l 3000

# Terminal 2: Analytics Dashboard
cd packages/analytics-dashboard
npm run build
serve -s build -l 3001
```

### 4. Test Production Mode Features

#### Test 1: AWS Service Connection
```bash
# Check backend logs for AWS connections
# Should see: "Creating DynamoDB client for production (AWS)"

# Verify data in AWS (if resources created)
aws dynamodb scan --table-name UserProfiles-prod
```

#### Test 2: Firebase Production Authentication
```bash
# Create test users in Firebase Console
# Open: https://console.firebase.google.com
# Navigate to: Authentication > Users
# Add test users

# Open User App: http://localhost:3000
# Login with production Firebase user
# Should authenticate against production Firebase
```

#### Test 3: Firebase Analytics Production
```bash
# Open Firebase Console
# Navigate to Analytics > Events
# Perform actions in User App
# Wait a few minutes
# Should see events in Firebase Analytics
```

#### Test 4: BigQuery Data Export (if enabled)
```bash
# Wait 24 hours after enabling BigQuery export
# Open BigQuery Console
# Navigate to your Firebase project dataset
# Query events table:

SELECT *
FROM `your-project.analytics_XXXXXX.events_*`
WHERE _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', CURRENT_DATE())
LIMIT 10
```

---

## Verification Checklist

### Development Mode Verification

- [ ] Backend starts with `Active Profile: dev`
- [ ] Backend connects to LocalStack at http://localhost:4566
- [ ] Backend connects to Firebase Emulator at localhost:9099
- [ ] Frontend shows "Environment: development" in console
- [ ] Can create/read data in LocalStack DynamoDB
- [ ] Can authenticate with Firebase Emulator users
- [ ] Firebase Analytics events logged to console
- [ ] No connections to production AWS or Firebase

### Production Mode Verification

- [ ] Backend starts with `Active Profile: prod`
- [ ] Backend connects to actual AWS services
- [ ] Backend connects to production Firebase
- [ ] Frontend shows "Environment: production" in console
- [ ] Can create/read data in AWS DynamoDB
- [ ] Can authenticate with production Firebase users
- [ ] Firebase Analytics events tracked in Firebase Console
- [ ] No connections to LocalStack or Firebase Emulator

### Cross-Environment Tests

- [ ] Can switch from dev to prod without code changes
- [ ] Environment variables properly override defaults
- [ ] JWT tokens work in both environments
- [ ] Role-based access control works in both environments
- [ ] CORS configuration works for both environments
- [ ] Error handling works in both environments

---

## Troubleshooting

### Issue: LocalStack not starting

**Solution:**
```bash
# Check if port 4566 is already in use
lsof -i :4566

# Kill the process if needed
kill -9 <PID>

# Restart LocalStack
docker restart localstack
```

### Issue: Firebase Emulator not starting

**Solution:**
```bash
# Check if ports are already in use
lsof -i :9099
lsof -i :4000

# Kill processes if needed
kill -9 <PID>

# Clear Firebase cache
rm -rf ~/.cache/firebase/emulators

# Restart emulator
firebase emulators:start
```

### Issue: Backend can't connect to LocalStack

**Solution:**
```bash
# Verify LocalStack is running
curl http://localhost:4566/_localstack/health

# Check backend logs for connection errors
# Verify application-dev.yml has correct endpoint

# Restart backend with debug logging
SPRING_PROFILES_ACTIVE=dev \
  LOGGING_LEVEL_SOFTWARE_AMAZON_AWSSDK=DEBUG \
  mvn spring-boot:run
```

### Issue: Frontend can't connect to backend

**Solution:**
```bash
# Verify backend is running
curl http://localhost:8080/api/health

# Check CORS configuration
# Verify .env file has correct API_BASE_URL

# Check browser console for CORS errors
# If CORS error, verify backend CORS configuration in application.yml
```

### Issue: Authentication fails in production mode

**Solution:**
```bash
# Verify Firebase credentials are correct
# Check firebase-service-account-prod.json exists

# Verify Firebase project ID matches
# Check application-prod.yml has correct project-id

# Test Firebase connection
curl -X POST http://localhost:8080/api/auth/verify-firebase
```

### Issue: AWS credentials not working

**Solution:**
```bash
# Verify AWS credentials
aws sts get-caller-identity

# Check environment variables
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY

# Verify IAM permissions
aws iam get-user
```

---

## Quick Start Commands

### Start Development Environment
```bash
# Terminal 1: LocalStack
docker start localstack

# Terminal 2: Firebase Emulator
firebase emulators:start

# Terminal 3: Backend
cd backend && SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run

# Terminal 4: User App
cd packages/user-app && npm start

# Terminal 5: Analytics Dashboard
cd packages/analytics-dashboard && npm start
```

### Start Production-Like Environment
```bash
# Terminal 1: Backend
cd backend
source .env.prod.local
SPRING_PROFILES_ACTIVE=prod mvn spring-boot:run

# Terminal 2: User App
cd packages/user-app
npm run build
serve -s build -l 3000

# Terminal 3: Analytics Dashboard
cd packages/analytics-dashboard
npm run build
serve -s build -l 3001
```

### Switch Between Environments
```bash
# Stop all services (Ctrl+C in each terminal)

# For Dev: Follow "Start Development Environment"
# For Prod: Follow "Start Production-Like Environment"
```

---

## Next Steps

After successfully testing both environments locally:

1. **Review Test Results**
   - Document any issues found
   - Verify all features work in both modes
   - Check performance metrics

2. **Prepare for Production Deployment**
   - Review production infrastructure requirements
   - Plan deployment strategy
   - Set up monitoring and alerting

3. **Production Infrastructure Setup**
   - Provision AWS resources
   - Configure Firebase production project
   - Set up CI/CD pipeline
   - Configure domain and SSL certificates

4. **Security Hardening**
   - Rotate all secrets and keys
   - Enable AWS CloudTrail
   - Configure Firebase security rules
   - Set up WAF and DDoS protection

5. **Monitoring Setup**
   - Configure CloudWatch alarms
   - Set up Firebase Analytics
   - Enable application logging
   - Configure error tracking

---

## Resources

- [LocalStack Documentation](https://docs.localstack.cloud/)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Spring Boot Profiles](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.profiles)
- [AWS CLI Configuration](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

---

**Last Updated:** October 20, 2025
