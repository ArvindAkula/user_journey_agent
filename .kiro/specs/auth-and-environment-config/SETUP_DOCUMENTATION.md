# Complete Setup Documentation

## Table of Contents

1. [Overview](#overview)
2. [Development Environment Setup](#development-environment-setup)
3. [Production Environment Setup](#production-environment-setup)
4. [Authorized User Configuration](#authorized-user-configuration)
5. [Firebase Analytics Setup](#firebase-analytics-setup)
6. [BigQuery Configuration](#bigquery-configuration)
7. [Verification and Testing](#verification-and-testing)

## Overview

This document provides comprehensive setup instructions for the User Journey Analytics application, covering both development and production environments. The system supports:

- **Authentication**: Firebase Authentication with JWT tokens
- **Authorization**: Role-based access control (Admin, Analyst, Viewer)
- **Environment Modes**: Development (local mocks) and Production (actual services)
- **Analytics**: Firebase Analytics with BigQuery export for cost optimization

## Development Environment Setup

### Prerequisites

- Node.js 18+ and npm
- Java 17+ and Maven
- Python 3.8+ (for LocalStack)
- Docker (optional, for containerized LocalStack)
- Firebase CLI
- Git

### Step 1: Install Required Tools

```bash
# Install Node.js (if not installed)
# Download from https://nodejs.org/ or use nvm:
nvm install 18
nvm use 18

# Install Java 17
# macOS:
brew install openjdk@17

# Install Maven
brew install maven

# Install Python and pip
brew install python3

# Install LocalStack
pip3 install localstack

# Install Firebase CLI
npm install -g firebase-tools

# Verify installations
node --version  # Should be 18+
java --version  # Should be 17+
mvn --version
localstack --version
firebase --version
```

### Step 2: Clone and Install Dependencies

```bash
# Clone repository
git clone <repository-url>
cd user-journey-analytics

# Install root dependencies
npm install

# Install frontend dependencies
cd packages/user-app
npm install

cd ../analytics-dashboard
npm install

cd ../shared
npm install

# Install backend dependencies
cd ../../backend
mvn clean install
```

### Step 3: Configure Development Environment

#### Create Frontend Environment Files

**User App** (`packages/user-app/.env.development`):
```bash
NODE_ENV=development
REACT_APP_API_BASE_URL=http://localhost:8080
REACT_APP_WS_URL=ws://localhost:8080/ws

# Firebase Emulator Configuration
REACT_APP_FIREBASE_USE_EMULATOR=true
REACT_APP_FIREBASE_EMULATOR_HOST=localhost
REACT_APP_FIREBASE_EMULATOR_PORT=9099

# Firebase Project Configuration (use demo project)
REACT_APP_FIREBASE_API_KEY=demo-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=localhost
REACT_APP_FIREBASE_PROJECT_ID=demo-project
REACT_APP_FIREBASE_STORAGE_BUCKET=demo-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abcdef
REACT_APP_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_DEBUG=true
REACT_APP_ENABLE_VIDEO_TRACKING=true
REACT_APP_ENABLE_INTERVENTIONS=true
```

**Analytics Dashboard** (`packages/analytics-dashboard/.env.development`):
```bash
NODE_ENV=development
REACT_APP_API_BASE_URL=http://localhost:8080
REACT_APP_WS_URL=ws://localhost:8080/ws

# Firebase Emulator Configuration
REACT_APP_FIREBASE_USE_EMULATOR=true
REACT_APP_FIREBASE_EMULATOR_HOST=localhost
REACT_APP_FIREBASE_EMULATOR_PORT=9099

# Firebase Project Configuration
REACT_APP_FIREBASE_API_KEY=demo-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=localhost
REACT_APP_FIREBASE_PROJECT_ID=demo-project

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_DEBUG=true
REACT_APP_REQUIRE_ADMIN=false  # Set to false for easier dev testing
```

#### Create Backend Configuration

**Development Profile** (`backend/src/main/resources/application-dev.yml`):
```yaml
spring:
  profiles: dev

server:
  port: 8080

# AWS Mock Configuration (LocalStack)
aws:
  mock:
    enabled: true
    endpoint: http://localhost:4566
  region: us-east-1
  credentials:
    access-key: test
    secret-key: test

# Firebase Emulator Configuration
firebase:
  emulator:
    enabled: true
    host: localhost
    port: 9099
  credentials:
    path: classpath:firebase-service-account-dev.json

# Service Endpoints (LocalStack)
dynamodb:
  endpoint: http://localhost:4566
  
kinesis:
  endpoint: http://localhost:4566
  stream-name: user-events-dev
  
s3:
  endpoint: http://localhost:4566
  bucket-name: user-journey-dev
  
sqs:
  endpoint: http://localhost:4566
  queue-url: http://localhost:4566/000000000000/user-events-queue

# Security Configuration
jwt:
  secret: dev-secret-key-change-in-production
  expiration: 86400000  # 24 hours

encryption:
  key: dev-encryption-key-change-in-production

# CORS Configuration
cors:
  allowed-origins:
    - http://localhost:3000
    - http://localhost:3001
  allowed-methods: GET,POST,PUT,DELETE,OPTIONS
  allowed-headers: "*"
  allow-credentials: true
  max-age: 3600

# Logging
logging:
  level:
    com.userjourney.analytics: DEBUG
    org.springframework: INFO
```

### Step 4: Create Authorized Users Configuration

Create `backend/src/main/resources/authorized-users.yml`:

```yaml
authorized:
  users:
    - email: admin@example.com
      role: ADMIN
      displayName: System Administrator
      
    - email: analyst@example.com
      role: ANALYST
      displayName: Data Analyst
      
    - email: viewer@example.com
      role: VIEWER
      displayName: Report Viewer
```

### Step 5: Start Development Services

#### Terminal 1: Start LocalStack

```bash
# Start LocalStack
localstack start

# Or with Docker:
docker run -d \
  --name localstack \
  -p 4566:4566 \
  -p 4571:4571 \
  -e SERVICES=dynamodb,kinesis,s3,sqs \
  -e DEBUG=1 \
  localstack/localstack

# Verify LocalStack is running
curl http://localhost:4566/_localstack/health
```

#### Terminal 2: Start Firebase Emulator

```bash
# Initialize Firebase (first time only)
firebase init emulators

# Start Firebase Auth Emulator
firebase emulators:start --only auth

# The emulator will start on http://localhost:9099
# Emulator UI available at http://localhost:4000
```

#### Terminal 3: Start Backend

```bash
cd backend

# Set development profile
export SPRING_PROFILES_ACTIVE=dev

# Start backend
./mvnw spring-boot:run

# Backend will start on http://localhost:8080
# Health check: http://localhost:8080/actuator/health
```

#### Terminal 4: Start User App

```bash
cd packages/user-app

# Start development server
npm start

# User App will start on http://localhost:3000
```

#### Terminal 5: Start Analytics Dashboard

```bash
cd packages/analytics-dashboard

# Start development server
npm start

# Analytics Dashboard will start on http://localhost:3001
```

### Step 6: Create Test Users in Firebase Emulator

```bash
# Use Firebase Emulator UI at http://localhost:4000
# Or use Firebase CLI:

firebase auth:import test-users.json --project demo-project

# test-users.json:
# [
#   {
#     "localId": "admin-user-id",
#     "email": "admin@example.com",
#     "passwordHash": "...",
#     "salt": "...",
#     "displayName": "System Administrator"
#   },
#   {
#     "localId": "analyst-user-id",
#     "email": "analyst@example.com",
#     "passwordHash": "...",
#     "salt": "...",
#     "displayName": "Data Analyst"
#   },
#   {
#     "localId": "viewer-user-id",
#     "email": "viewer@example.com",
#     "passwordHash": "...",
#     "salt": "...",
#     "displayName": "Report Viewer"
#   }
# ]
```

Or create users manually through the Emulator UI:
1. Open http://localhost:4000
2. Go to Authentication tab
3. Click "Add user"
4. Enter email and password for each test user

### Step 7: Initialize LocalStack Resources

```bash
# Run initialization script
./dev-scripts/init-localstack.sh

# Or manually create resources:

# Create DynamoDB tables
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

# Create Kinesis stream
aws kinesis create-stream \
  --stream-name user-events-dev \
  --shard-count 1 \
  --endpoint-url http://localhost:4566

# Create S3 bucket
aws s3 mb s3://user-journey-dev \
  --endpoint-url http://localhost:4566

# Create SQS queue
aws sqs create-queue \
  --queue-name user-events-queue \
  --endpoint-url http://localhost:4566
```

### Step 8: Verify Development Setup

```bash
# Check backend health
curl http://localhost:8080/actuator/health

# Check LocalStack
curl http://localhost:4566/_localstack/health

# Check Firebase Emulator
curl http://localhost:9099

# Open applications in browser
open http://localhost:3000  # User App
open http://localhost:3001  # Analytics Dashboard
open http://localhost:4000  # Firebase Emulator UI
```

## Production Environment Setup

### Prerequisites

- AWS Account with appropriate permissions
- Firebase project (production)
- Domain names registered
- SSL certificates provisioned
- CI/CD pipeline configured

### Step 1: Set Up Firebase Production Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing
3. Enable Firebase Authentication
4. Enable Firebase Analytics
5. Download service account credentials:
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save as `firebase-service-account-prod.json`

### Step 2: Configure Production Environment Variables

**User App** (`packages/user-app/.env.production`):
```bash
NODE_ENV=production
REACT_APP_API_BASE_URL=https://api.journey-analytics.io
REACT_APP_WS_URL=wss://api.journey-analytics.io/ws

# Firebase Production Configuration
REACT_APP_FIREBASE_USE_EMULATOR=false
REACT_APP_FIREBASE_API_KEY=${FIREBASE_API_KEY}
REACT_APP_FIREBASE_AUTH_DOMAIN=journey-analytics.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=journey-analytics-prod
REACT_APP_FIREBASE_STORAGE_BUCKET=journey-analytics-prod.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=${FIREBASE_MESSAGING_SENDER_ID}
REACT_APP_FIREBASE_APP_ID=${FIREBASE_APP_ID}
REACT_APP_FIREBASE_MEASUREMENT_ID=${FIREBASE_MEASUREMENT_ID}

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_DEBUG=false
REACT_APP_ENABLE_VIDEO_TRACKING=true
REACT_APP_ENABLE_INTERVENTIONS=true
```

**Analytics Dashboard** (`packages/analytics-dashboard/.env.production`):
```bash
NODE_ENV=production
REACT_APP_API_BASE_URL=https://api.journey-analytics.io
REACT_APP_WS_URL=wss://api.journey-analytics.io/ws

# Firebase Production Configuration
REACT_APP_FIREBASE_USE_EMULATOR=false
REACT_APP_FIREBASE_API_KEY=${FIREBASE_API_KEY}
REACT_APP_FIREBASE_AUTH_DOMAIN=journey-analytics.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=journey-analytics-prod

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_DEBUG=false
REACT_APP_REQUIRE_ADMIN=true
```

**Backend** (`backend/src/main/resources/application-prod.yml`):
```yaml
spring:
  profiles: prod

server:
  port: 8080

# AWS Production Configuration
aws:
  mock:
    enabled: false
  region: ${AWS_REGION:us-east-1}

# Firebase Production Configuration
firebase:
  emulator:
    enabled: false
  credentials:
    path: ${FIREBASE_CREDENTIALS_PATH:/app/config/firebase-service-account-prod.json}

# Service Configuration (uses default AWS endpoints)
kinesis:
  stream-name: ${KINESIS_STREAM_NAME:user-events-prod}
  
s3:
  bucket-name: ${S3_BUCKET_NAME:user-journey-prod}
  
sqs:
  queue-url: ${SQS_QUEUE_URL}

# Security Configuration
jwt:
  secret: ${JWT_SECRET}
  expiration: 86400000  # 24 hours

encryption:
  key: ${ENCRYPTION_KEY}

# CORS Configuration
cors:
  allowed-origins:
    - https://www.journey-analytics.io
    - https://journey-analytics.io
    - https://www.journey-analytics-admin.io
    - https://journey-analytics-admin.io
  allowed-methods: GET,POST,PUT,DELETE,OPTIONS
  allowed-headers: Authorization,Content-Type,X-Requested-With,Accept,Origin
  allow-credentials: true
  max-age: 3600

# Logging
logging:
  level:
    com.userjourney.analytics: INFO
    org.springframework: WARN
```

### Step 3: Store Secrets in AWS Secrets Manager

```bash
# Store JWT secret
aws secretsmanager create-secret \
  --name prod/jwt-secret \
  --secret-string "$(openssl rand -base64 32)" \
  --region us-east-1

# Store encryption key
aws secretsmanager create-secret \
  --name prod/encryption-key \
  --secret-string "$(openssl rand -base64 32)" \
  --region us-east-1

# Store Firebase credentials
aws secretsmanager create-secret \
  --name prod/firebase-credentials \
  --secret-string file://firebase-service-account-prod.json \
  --region us-east-1
```

### Step 4: Deploy Infrastructure

See [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md) for detailed deployment instructions.

```bash
# Deploy with CDK
cd infrastructure
npm install
cdk deploy --all --require-approval never

# Or use Terraform
cd terraform
terraform init
terraform plan
terraform apply
```

### Step 5: Configure Authorized Users in Production

Update `backend/src/main/resources/authorized-users.yml` with production user emails:

```yaml
authorized:
  users:
    - email: admin@yourcompany.com
      role: ADMIN
      displayName: Production Administrator
      
    - email: analyst@yourcompany.com
      role: ANALYST
      displayName: Production Analyst
      
    - email: viewer@yourcompany.com
      role: VIEWER
      displayName: Production Viewer
```

Then create these users in Firebase Console:
1. Go to Firebase Console > Authentication
2. Click "Add user"
3. Enter email and set password
4. Send credentials securely to users

## Authorized User Configuration

### User Roles

The system supports three roles with hierarchical permissions:

1. **ADMIN** (Highest privileges)
   - Full access to all features
   - User management
   - System configuration
   - Analytics dashboard access
   - User app access

2. **ANALYST** (Medium privileges)
   - Analytics dashboard access
   - View all reports and metrics
   - Export data
   - User app access

3. **VIEWER** (Lowest privileges)
   - Read-only access
   - View basic reports
   - User app access

### Adding New Users

#### Development Environment

1. Add user to `authorized-users.yml`:
```yaml
authorized:
  users:
    - email: newuser@example.com
      role: ANALYST
      displayName: New User Name
```

2. Create user in Firebase Emulator:
   - Open http://localhost:4000
   - Go to Authentication
   - Click "Add user"
   - Enter email and password

3. Restart backend to reload configuration

#### Production Environment

1. Add user to `authorized-users.yml` in production configuration

2. Create user in Firebase Console:
   - Go to Firebase Console > Authentication
   - Click "Add user"
   - Enter email and set password

3. Deploy updated configuration:
```bash
# Rebuild and redeploy backend
cd backend
mvn clean package
# Deploy to ECS/Fargate
```

4. Send credentials to user securely

### Removing Users

1. Remove from `authorized-users.yml`
2. Delete from Firebase Authentication
3. Redeploy backend configuration

### Changing User Roles

1. Update role in `authorized-users.yml`
2. Redeploy backend
3. User must log out and log back in for changes to take effect

## Firebase Analytics Setup

See [BIGQUERY_SETUP_GUIDE.md](./BIGQUERY_SETUP_GUIDE.md) for detailed Firebase Analytics configuration.

### Quick Setup

1. **Enable Firebase Analytics**:
   - Go to Firebase Console
   - Select your project
   - Navigate to Analytics
   - Click "Enable Analytics"

2. **Configure Data Collection**:
   - Set data retention to 14 months (maximum)
   - Enable Google Signals (for cross-device tracking)
   - Configure user properties

3. **Integrate SDK in User App**:
   - Already integrated in `packages/user-app/src/services/FirebaseAnalyticsService.ts`
   - Events are automatically tracked

4. **Enable Debug View** (Development):
```bash
# In browser console:
window.gtag('config', 'GA_MEASUREMENT_ID', {
  'debug_mode': true
});

# Or set in .env.development:
REACT_APP_FIREBASE_DEBUG_MODE=true
```

5. **Verify Events**:
   - Go to Firebase Console > Analytics > DebugView
   - Perform actions in User App
   - See events appear in real-time

## BigQuery Configuration

See [BIGQUERY_SETUP_GUIDE.md](./BIGQUERY_SETUP_GUIDE.md) for complete BigQuery setup instructions.

### Quick Setup

1. **Enable BigQuery Export**:
   - Firebase Console > Project Settings > Integrations
   - Click "Link" next to BigQuery
   - Select "Daily" export
   - Choose dataset location

2. **Grant Permissions**:
```bash
# Grant service account access to BigQuery
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/bigquery.dataViewer"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/bigquery.jobUser"
```

3. **Verify Export**:
   - Wait 24-48 hours for first export
   - Check BigQuery Console for `analytics_XXXXX` dataset
   - Run test query to verify data

4. **Configure Backend**:
   - Update `application-prod.yml` with BigQuery configuration
   - Deploy backend with BigQuery service enabled

## Verification and Testing

### Development Environment Verification

```bash
# 1. Check all services are running
curl http://localhost:4566/_localstack/health  # LocalStack
curl http://localhost:9099  # Firebase Emulator
curl http://localhost:8080/actuator/health  # Backend
curl http://localhost:3000  # User App
curl http://localhost:3001  # Analytics Dashboard

# 2. Test authentication flow
# - Open http://localhost:3000
# - Click login
# - Enter: admin@example.com / password
# - Verify successful login

# 3. Test API endpoints
TOKEN="<jwt-token-from-browser>"
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/events

# 4. Test Firebase Analytics
# - Perform actions in User App
# - Check Firebase Emulator UI for events
# - Verify events in browser console (debug mode)

# 5. Test LocalStack integration
aws dynamodb list-tables --endpoint-url http://localhost:4566
aws kinesis list-streams --endpoint-url http://localhost:4566
aws s3 ls --endpoint-url http://localhost:4566
```

### Production Environment Verification

```bash
# 1. Test HTTPS and SSL
curl -I https://www.journey-analytics.io
curl -I https://www.journey-analytics-admin.io

# 2. Test API health
curl https://api.journey-analytics.io/actuator/health

# 3. Test authentication
# - Open https://www.journey-analytics.io
# - Login with production credentials
# - Verify JWT token in browser storage

# 4. Test role-based access
# - Login as different users
# - Verify appropriate access levels

# 5. Test Firebase Analytics
# - Perform actions in production
# - Check Firebase Console > Analytics > Events
# - Verify events in DebugView (if enabled)

# 6. Test BigQuery integration
# - Run test query in BigQuery Console
# - Verify data is being exported
# - Check Analytics Dashboard for BigQuery data
```

## Troubleshooting

### Common Development Issues

**Issue**: LocalStack not starting
```bash
# Solution: Check if port 4566 is in use
lsof -i :4566
# Kill process if needed
kill -9 <PID>
# Restart LocalStack
localstack start
```

**Issue**: Firebase Emulator not connecting
```bash
# Solution: Verify emulator is running
firebase emulators:start --only auth
# Check .env file has correct emulator settings
# REACT_APP_FIREBASE_USE_EMULATOR=true
# REACT_APP_FIREBASE_EMULATOR_HOST=localhost
# REACT_APP_FIREBASE_EMULATOR_PORT=9099
```

**Issue**: Backend not connecting to LocalStack
```bash
# Solution: Verify SPRING_PROFILES_ACTIVE=dev
echo $SPRING_PROFILES_ACTIVE
# Check application-dev.yml has correct endpoints
# Check LocalStack health
curl http://localhost:4566/_localstack/health
```

### Common Production Issues

See [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md) troubleshooting section.

## Additional Resources

- [Environment Setup Guide](./ENVIRONMENT_SETUP_GUIDE.md)
- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)
- [BigQuery Setup Guide](./BIGQUERY_SETUP_GUIDE.md)
- [Quick Start Credentials](./QUICK_START_CREDENTIALS.md)
- [Environment Variables Reference](./ENVIRONMENT_VARIABLES.md)

## Support

For issues or questions:
- Check existing documentation
- Review troubleshooting sections
- Contact development team
- Create GitHub issue
