# Quick Start: Dev vs Prod Mode Switching

## TL;DR - Quick Commands

### Start in Development Mode
```bash
# Backend
cd backend
SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run

# User App
cd packages/user-app
NODE_ENV=development npm start

# Analytics Dashboard
cd packages/analytics-dashboard
NODE_ENV=development npm start
```

### Start in Production Mode (Locally)
```bash
# Backend
cd backend
SPRING_PROFILES_ACTIVE=prod mvn spring-boot:run

# User App
cd packages/user-app
NODE_ENV=production npm start

# Analytics Dashboard
cd packages/analytics-dashboard
NODE_ENV=production npm start
```

---

## Detailed Guide

### Backend Switching

#### Option 1: Environment Variable (Recommended)
```bash
# Development
export SPRING_PROFILES_ACTIVE=dev
mvn spring-boot:run

# Production
export SPRING_PROFILES_ACTIVE=prod
mvn spring-boot:run
```

#### Option 2: Command Line Argument
```bash
# Development
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# Production
mvn spring-boot:run -Dspring-boot.run.profiles=prod
```

#### Option 3: IDE Configuration (IntelliJ/Eclipse)
**IntelliJ IDEA:**
1. Run → Edit Configurations
2. Add VM options: `-Dspring.profiles.active=dev` or `prod`
3. Click Apply

**Eclipse:**
1. Run → Run Configurations
2. Arguments tab → VM arguments: `-Dspring.profiles.active=dev`

#### What Changes in Backend?

**Dev Mode:**
- ✅ Connects to LocalStack (http://localhost:4566)
- ✅ Uses Firebase Emulator (localhost:9099)
- ✅ Mock AWS credentials
- ✅ Debug logging enabled
- ✅ CORS allows localhost:3000, localhost:3001
- ✅ Rate limiting disabled

**Prod Mode:**
- ✅ Connects to actual AWS services
- ✅ Uses production Firebase Auth
- ✅ Real AWS credentials required
- ✅ Info/Warn logging only
- ✅ CORS restricted to production domains
- ✅ Rate limiting enabled

---

### Frontend Switching

#### Option 1: Environment Variable
```bash
# Development
export NODE_ENV=development
npm start

# Production
export NODE_ENV=production
npm start
```

#### Option 2: Package.json Scripts (Already Configured)
```bash
# Development
npm run start        # Uses .env.development

# Production
npm run start:prod   # Uses .env.production
```

#### Option 3: Direct Command
```bash
# Development
NODE_ENV=development npm start

# Production  
NODE_ENV=production npm start
```

#### What Changes in Frontend?

**Dev Mode (.env.development):**
- ✅ API: http://localhost:8080/api
- ✅ Firebase Emulator enabled
- ✅ Debug mode enabled
- ✅ Source maps enabled
- ✅ Hot reload enabled

**Prod Mode (.env.production):**
- ✅ API: https://api.journey-analytics.io/api (or localhost:8080 for local prod testing)
- ✅ Production Firebase
- ✅ Debug mode disabled
- ✅ Source maps disabled
- ✅ Optimized build

---

## Complete Local Setup

### Prerequisites Checklist

**For Dev Mode:**
- [ ] Docker installed and running
- [ ] LocalStack running (`docker run -d -p 4566:4566 localstack/localstack`)
- [ ] Firebase Emulator installed (`npm install -g firebase-tools`)
- [ ] Firebase Emulator running (`firebase emulators:start`)

**For Prod Mode:**
- [ ] AWS credentials configured (`aws configure`)
- [ ] Firebase production project created
- [ ] Firebase service account key downloaded
- [ ] Environment variables set (see below)

---

## Step-by-Step: Start in Dev Mode

### 1. Start LocalStack
```bash
# Terminal 1
docker run -d \
  --name localstack \
  -p 4566:4566 \
  -e SERVICES=dynamodb,kinesis,s3,sqs \
  localstack/localstack

# Verify it's running
curl http://localhost:4566/_localstack/health
```

### 2. Start Firebase Emulator
```bash
# Terminal 2
cd backend
firebase emulators:start --only auth

# Should see:
# ✔  All emulators ready! It is now safe to connect.
# ┌────────────────┬────────────────┬─────────────────────────────────┐
# │ Emulator       │ Host:Port      │ View in Emulator UI             │
# ├────────────────┼────────────────┼─────────────────────────────────┤
# │ Authentication │ localhost:9099 │ http://localhost:4000/auth      │
# └────────────────┴────────────────┴─────────────────────────────────┘
```

### 3. Start Backend (Dev Mode)
```bash
# Terminal 3
cd backend
export SPRING_PROFILES_ACTIVE=dev
mvn spring-boot:run

# Look for these logs:
# =============================================================================
# AWS Configuration Initialized
# =============================================================================
# Active Profile: dev
# AWS Region: us-east-1
# Mock Enabled: true
# Mock Endpoint: http://localhost:4566
# Using LocalStack for AWS services
# =============================================================================
```

### 4. Start User App (Dev Mode)
```bash
# Terminal 4
cd packages/user-app
npm start

# Should open browser at http://localhost:3000
# Check console for:
# 🔧 Environment Configuration
# Environment: development
# API Base URL: http://localhost:8080/api
# Firebase Emulator: true
```

### 5. Start Analytics Dashboard (Dev Mode)
```bash
# Terminal 5
cd packages/analytics-dashboard
npm start

# Should open browser at http://localhost:3001
```

### 6. Verify Dev Mode
```bash
# Test backend health
curl http://localhost:8080/api/health

# Should return: {"status":"UP","environment":"dev"}
```

---

## Step-by-Step: Start in Prod Mode (Locally)

### 1. Set Up AWS Credentials
```bash
# Configure AWS CLI
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter region: us-east-1
# Enter output format: json

# Verify
aws sts get-caller-identity
```

### 2. Set Up Firebase Production
```bash
# Download service account key from Firebase Console
# Save as: backend/src/main/resources/firebase-service-account-prod.json

# Set environment variables
export FIREBASE_PROJECT_ID=your-prod-project-id
export FIREBASE_CREDENTIALS_PATH=classpath:firebase-service-account-prod.json
```

### 3. Set Production Environment Variables
```bash
# Create .env.prod.local file
cat > backend/.env.prod.local << EOF
SPRING_PROFILES_ACTIVE=prod
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
AWS_REGION=us-east-1
FIREBASE_PROJECT_ID=your-prod-project-id
EOF

# Load variables
source backend/.env.prod.local
```

### 4. Start Backend (Prod Mode)
```bash
# Terminal 1
cd backend
export SPRING_PROFILES_ACTIVE=prod
mvn spring-boot:run

# Look for these logs:
# =============================================================================
# AWS Configuration Initialized
# =============================================================================
# Active Profile: prod
# AWS Region: us-east-1
# Mock Enabled: false
# Using actual AWS services
# =============================================================================
```

### 5. Update Frontend .env.production.local
```bash
# Create packages/user-app/.env.production.local
cat > packages/user-app/.env.production.local << EOF
NODE_ENV=production
REACT_APP_API_BASE_URL=http://localhost:8080/api
REACT_APP_FIREBASE_API_KEY=your-firebase-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-prod-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
REACT_APP_FIREBASE_USE_EMULATOR=false
EOF
```

### 6. Start User App (Prod Mode)
```bash
# Terminal 2
cd packages/user-app
NODE_ENV=production npm start

# Check console for:
# Environment: production
# API Base URL: http://localhost:8080/api
# Firebase Emulator: false
```

### 7. Start Analytics Dashboard (Prod Mode)
```bash
# Terminal 3
cd packages/analytics-dashboard
NODE_ENV=production npm start
```

### 8. Verify Prod Mode
```bash
# Test backend health
curl http://localhost:8080/api/health

# Should return: {"status":"UP","environment":"prod"}
```

---

## Automated Scripts

### Create Start Scripts

**scripts/start-dev.sh**
```bash
#!/bin/bash

echo "Starting in DEVELOPMENT mode..."

# Check if LocalStack is running
if ! docker ps | grep -q localstack; then
    echo "Starting LocalStack..."
    docker run -d --name localstack -p 4566:4566 localstack/localstack
    sleep 5
fi

# Start Firebase Emulator in background
echo "Starting Firebase Emulator..."
cd backend
firebase emulators:start --only auth &
FIREBASE_PID=$!
cd ..

# Wait for emulator to be ready
sleep 10

# Start Backend
echo "Starting Backend (dev mode)..."
cd backend
SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 30

# Start User App
echo "Starting User App (dev mode)..."
cd packages/user-app
NODE_ENV=development npm start &
USER_APP_PID=$!
cd ../..

# Start Analytics Dashboard
echo "Starting Analytics Dashboard (dev mode)..."
cd packages/analytics-dashboard
NODE_ENV=development npm start &
DASHBOARD_PID=$!
cd ../..

echo "All services started in DEV mode!"
echo "User App: http://localhost:3000"
echo "Analytics Dashboard: http://localhost:3001"
echo "Backend API: http://localhost:8080"
echo "Firebase Emulator UI: http://localhost:4000"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for Ctrl+C
trap "kill $FIREBASE_PID $BACKEND_PID $USER_APP_PID $DASHBOARD_PID; exit" INT
wait
```

**scripts/start-prod.sh**
```bash
#!/bin/bash

echo "Starting in PRODUCTION mode..."

# Check AWS credentials
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "ERROR: AWS credentials not configured!"
    echo "Run: aws configure"
    exit 1
fi

# Load production environment variables
if [ -f backend/.env.prod.local ]; then
    source backend/.env.prod.local
else
    echo "ERROR: backend/.env.prod.local not found!"
    exit 1
fi

# Start Backend
echo "Starting Backend (prod mode)..."
cd backend
SPRING_PROFILES_ACTIVE=prod mvn spring-boot:run &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 30

# Start User App
echo "Starting User App (prod mode)..."
cd packages/user-app
NODE_ENV=production npm start &
USER_APP_PID=$!
cd ../..

# Start Analytics Dashboard
echo "Starting Analytics Dashboard (prod mode)..."
cd packages/analytics-dashboard
NODE_ENV=production npm start &
DASHBOARD_PID=$!
cd ../..

echo "All services started in PROD mode!"
echo "User App: http://localhost:3000"
echo "Analytics Dashboard: http://localhost:3001"
echo "Backend API: http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $USER_APP_PID $DASHBOARD_PID; exit" INT
wait
```

**Make scripts executable:**
```bash
chmod +x scripts/start-dev.sh
chmod +x scripts/start-prod.sh
```

**Usage:**
```bash
# Start in dev mode
./scripts/start-dev.sh

# Start in prod mode
./scripts/start-prod.sh
```

---

## Verification Checklist

### Dev Mode Verification
- [ ] Backend logs show "Active Profile: dev"
- [ ] Backend logs show "Using LocalStack"
- [ ] Frontend console shows "Environment: development"
- [ ] Frontend console shows "Firebase Emulator: true"
- [ ] Can access http://localhost:4000 (Firebase Emulator UI)
- [ ] LocalStack health check passes: `curl http://localhost:4566/_localstack/health`
- [ ] Backend health check shows dev: `curl http://localhost:8080/api/health`

### Prod Mode Verification
- [ ] Backend logs show "Active Profile: prod"
- [ ] Backend logs show "Using actual AWS services"
- [ ] Frontend console shows "Environment: production"
- [ ] Frontend console shows "Firebase Emulator: false"
- [ ] AWS credentials are valid: `aws sts get-caller-identity`
- [ ] Backend health check shows prod: `curl http://localhost:8080/api/health`
- [ ] Can authenticate with production Firebase users

---

## Troubleshooting

### Backend won't start in dev mode
**Problem:** "Connection refused to LocalStack"
**Solution:**
```bash
# Check if LocalStack is running
docker ps | grep localstack

# If not, start it
docker run -d --name localstack -p 4566:4566 localstack/localstack

# Verify health
curl http://localhost:4566/_localstack/health
```

### Backend won't start in prod mode
**Problem:** "AWS credentials not found"
**Solution:**
```bash
# Configure AWS credentials
aws configure

# Or set environment variables
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export AWS_DEFAULT_REGION=us-east-1
```

### Frontend can't connect to backend
**Problem:** "Network Error" or "CORS error"
**Solution:**
```bash
# Check if backend is running
curl http://localhost:8080/api/health

# Check CORS configuration in application-dev.yml or application-prod.yml
# Should allow localhost:3000 and localhost:3001 in dev mode
```

### Firebase Emulator not working
**Problem:** "Firebase Emulator not found"
**Solution:**
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Initialize emulators
firebase init emulators

# Start emulators
firebase emulators:start --only auth
```

---

## Summary

**Yes, you can easily switch between dev and prod modes!**

### Quick Switch Commands

**Dev Mode:**
```bash
# Backend
SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run

# Frontend
NODE_ENV=development npm start
```

**Prod Mode:**
```bash
# Backend
SPRING_PROFILES_ACTIVE=prod mvn spring-boot:run

# Frontend
NODE_ENV=production npm start
```

### What Gets Switched Automatically

| Component | Dev Mode | Prod Mode |
|-----------|----------|-----------|
| AWS Services | LocalStack (localhost:4566) | Real AWS |
| Firebase | Emulator (localhost:9099) | Production |
| Database | LocalStack DynamoDB | AWS DynamoDB |
| Logging | DEBUG | INFO/WARN |
| CORS | localhost:3000, 3001 | Production domains |
| Rate Limiting | Disabled | Enabled |
| Source Maps | Enabled | Disabled |
| Hot Reload | Enabled | Disabled |

### Automated Scripts Available
- ✅ `./scripts/start-dev.sh` - Start everything in dev mode
- ✅ `./scripts/start-prod.sh` - Start everything in prod mode
- ✅ `./scripts/setup-dev-environment.sh` - Set up LocalStack resources
- ✅ `./scripts/test-environment.sh` - Test current environment

**You're all set!** Just flip the flag and everything switches automatically. 🚀

---

**Last Updated:** October 20, 2025
