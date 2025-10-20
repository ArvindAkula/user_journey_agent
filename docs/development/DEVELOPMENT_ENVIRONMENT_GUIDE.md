# Development Environment Guide

## Overview

This guide provides comprehensive instructions for setting up and using the local development environment for the User Journey Analytics Agent application. The development environment includes all necessary services running locally with mock AWS services and Firebase emulator.

## Quick Start

### One-Command Setup

Start the entire development environment with a single command:

```bash
./dev-scripts/start-dev-environment.sh
```

This will start:
- LocalStack (AWS services mock)
- Firebase Authentication Emulator
- Backend API (Spring Boot)
- User App (React)
- Analytics Dashboard (React)

### Stop Everything

```bash
./dev-scripts/stop-dev-environment.sh
```

## Prerequisites

### Required Software

1. **Docker Desktop**
   - macOS: Download from [docker.com](https://www.docker.com/products/docker-desktop)
   - Linux: `sudo apt-get install docker.io docker-compose`
   - Verify: `docker --version`

2. **Java 17+**
   - macOS: `brew install openjdk@17`
   - Linux: `sudo apt-get install openjdk-17-jdk`
   - Verify: `java -version`

3. **Maven**
   - macOS: `brew install maven`
   - Linux: `sudo apt-get install maven`
   - Verify: `mvn -version`

4. **Node.js 18+**
   - macOS: `brew install node`
   - Linux: `sudo apt-get install nodejs npm`
   - Verify: `node --version`

5. **Firebase CLI**
   - Install: `npm install -g firebase-tools`
   - Verify: `firebase --version`

### Optional Software

6. **AWS CLI** (for manual testing)
   - macOS: `brew install awscli`
   - Linux: `sudo apt-get install awscli`
   - Verify: `aws --version`

## Architecture

### Development Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                            │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │   User App       │         │ Analytics        │         │
│  │   Port: 3000     │         │ Dashboard        │         │
│  │                  │         │ Port: 3001       │         │
│  └────────┬─────────┘         └────────┬─────────┘         │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
            │         HTTP/REST            │
            └──────────────┬───────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                    Backend Layer                             │
│                           │                                  │
│  ┌────────────────────────▼────────────────────────────┐   │
│  │   Spring Boot Backend (Port: 8080)                  │   │
│  │   - REST API                                        │   │
│  │   - Authentication & Authorization                  │   │
│  │   - Business Logic                                  │   │
│  └────────┬────────────────────────────────┬───────────┘   │
└───────────┼────────────────────────────────┼───────────────┘
            │                                │
            │                                │
┌───────────▼────────────────┐  ┌───────────▼───────────────┐
│   LocalStack (Port: 4566)  │  │ Firebase Emulator         │
│   - DynamoDB               │  │ (Port: 9099)              │
│   - Kinesis                │  │ - Authentication          │
│   - S3                     │  │ - Test Users              │
│   - SQS                    │  │                           │
│   - SNS                    │  │ UI: Port 4000             │
└────────────────────────────┘  └───────────────────────────┘
```

## Individual Service Management

### LocalStack (AWS Services)

**Start:**
```bash
./dev-scripts/start-localstack.sh
```

**Stop:**
```bash
./dev-scripts/stop-localstack.sh
```

**Services Available:**
- DynamoDB: Tables for events, profiles, signals
- Kinesis: Streams for real-time data
- S3: Buckets for file storage
- SQS: Queues for async processing
- SNS: Topics for notifications

**Access:**
- Gateway: http://localhost:4566
- DynamoDB Admin UI: http://localhost:8001

### Firebase Emulator (Authentication)

**Start:**
```bash
./dev-scripts/start-firebase-emulator.sh
```

**Stop:**
```bash
./dev-scripts/stop-firebase-emulator.sh
```

**Test Users:**
- Admin: admin@example.com / admin123
- Analyst: analyst@example.com / analyst123
- Viewer: viewer@example.com / viewer123

**Access:**
- Auth Emulator: http://localhost:9099
- Emulator UI: http://localhost:4000

### Backend (Spring Boot)

**Start:**
```bash
./dev-scripts/start-backend-dev.sh
```

**Stop:**
```bash
./dev-scripts/stop-backend-dev.sh
```

**Access:**
- API: http://localhost:8080
- Health Check: http://localhost:8080/actuator/health
- API Docs: http://localhost:8080/swagger-ui.html

**Logs:**
```bash
tail -f backend-dev.log
```

### Frontend Applications

**Start Both:**
```bash
./dev-scripts/start-frontends-dev.sh
```

**Stop Both:**
```bash
./dev-scripts/stop-frontends-dev.sh
```

**Access:**
- User App: http://localhost:3000
- Analytics Dashboard: http://localhost:3001

**Logs:**
```bash
# User App
tail -f user-app-dev.log

# Analytics Dashboard
tail -f analytics-dashboard-dev.log
```

## Environment Configuration

### Backend Configuration

The backend uses Spring profiles to switch between environments.

**Development Profile** (`application-dev.yml`):
```yaml
spring:
  profiles: dev

aws:
  mock:
    enabled: true
    endpoint: http://localhost:4566
  region: us-east-1

firebase:
  emulator:
    enabled: true
    host: localhost
    port: 9099
```

**Environment Variables:**
```bash
export SPRING_PROFILES_ACTIVE=dev
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
export FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
```

### Frontend Configuration

**User App** (`.env.development`):
```bash
NODE_ENV=development
REACT_APP_API_BASE_URL=http://localhost:8080
REACT_APP_FIREBASE_USE_EMULATOR=true
REACT_APP_FIREBASE_EMULATOR_HOST=localhost
REACT_APP_FIREBASE_EMULATOR_PORT=9099
```

**Analytics Dashboard** (`.env.development`):
```bash
NODE_ENV=development
REACT_APP_API_BASE_URL=http://localhost:8080
REACT_APP_FIREBASE_USE_EMULATOR=true
REACT_APP_FIREBASE_EMULATOR_HOST=localhost
REACT_APP_FIREBASE_EMULATOR_PORT=9099
```

## Development Workflow

### Typical Development Session

1. **Start the environment:**
   ```bash
   ./dev-scripts/start-dev-environment.sh
   ```

2. **Make code changes:**
   - Backend: Edit Java files in `backend/src/`
   - Frontend: Edit TypeScript/React files in `packages/*/src/`

3. **Test changes:**
   - Backend: Changes require restart
   - Frontend: Hot reload automatically applies changes

4. **View logs:**
   ```bash
   # All logs
   tail -f backend-dev.log user-app-dev.log analytics-dashboard-dev.log
   
   # Specific service
   tail -f backend-dev.log
   ```

5. **Stop when done:**
   ```bash
   ./dev-scripts/stop-dev-environment.sh
   ```

### Testing Authentication

1. **Open User App:**
   ```
   http://localhost:3000
   ```

2. **Login with test user:**
   - Email: admin@example.com
   - Password: admin123

3. **Verify authentication:**
   - Check that you're redirected to the main app
   - Verify user menu shows email and role
   - Test protected routes

4. **Test different roles:**
   - Logout and login as analyst or viewer
   - Verify role-based access control

### Testing AWS Services

**DynamoDB:**
```bash
# Set credentials
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# List tables
aws dynamodb list-tables --endpoint-url http://localhost:4566

# Scan a table
aws dynamodb scan --table-name user-events --endpoint-url http://localhost:4566

# Put an item
aws dynamodb put-item \
  --table-name user-events \
  --item '{"userId": {"S": "test123"}, "timestamp": {"N": "1634567890"}}' \
  --endpoint-url http://localhost:4566
```

**S3:**
```bash
# List buckets
aws s3 ls --endpoint-url http://localhost:4566

# Upload file
aws s3 cp myfile.txt s3://user-journey-uploads/ --endpoint-url http://localhost:4566

# List files
aws s3 ls s3://user-journey-uploads/ --endpoint-url http://localhost:4566
```

**Kinesis:**
```bash
# List streams
aws kinesis list-streams --endpoint-url http://localhost:4566

# Put record
aws kinesis put-record \
  --stream-name user-events-stream \
  --partition-key user123 \
  --data '{"userId":"user123","event":"click"}' \
  --endpoint-url http://localhost:4566
```

## Troubleshooting

### Port Already in Use

**Problem:** Service fails to start because port is in use

**Solution:**
```bash
# Find process using port
lsof -i :8080  # Replace with your port

# Kill process
kill $(lsof -t -i:8080)
```

### Docker Not Running

**Problem:** LocalStack fails to start

**Solution:**
1. Start Docker Desktop
2. Verify: `docker info`
3. Retry: `./dev-scripts/start-localstack.sh`

### Backend Won't Start

**Problem:** Backend fails to start or crashes

**Solution:**
1. Check logs: `tail -f backend-dev.log`
2. Verify LocalStack is running: `curl http://localhost:4566/_localstack/health`
3. Verify Firebase emulator is running: `curl http://localhost:9099`
4. Check Java version: `java -version` (should be 17+)
5. Clean and rebuild: `cd backend && mvn clean install`

### Frontend Won't Start

**Problem:** Frontend fails to start

**Solution:**
1. Check logs: `tail -f user-app-dev.log`
2. Verify Node version: `node --version` (should be 18+)
3. Clear node_modules: `rm -rf packages/user-app/node_modules && npm install`
4. Check for port conflicts: `lsof -i :3000`

### Authentication Fails

**Problem:** Cannot login with test credentials

**Solution:**
1. Verify Firebase emulator is running: `curl http://localhost:9099`
2. Check Firebase Emulator UI: http://localhost:4000
3. Recreate test users: `./dev-scripts/create-firebase-test-users.sh`
4. Check backend logs for authentication errors
5. Verify environment variables are set correctly

### AWS Service Errors

**Problem:** Backend cannot connect to AWS services

**Solution:**
1. Verify LocalStack is running: `curl http://localhost:4566/_localstack/health`
2. Check that resources were created: `./dev-scripts/init-localstack.sh`
3. Verify backend is using dev profile: Check logs for "Active profiles: dev"
4. Test AWS CLI connection: `aws dynamodb list-tables --endpoint-url http://localhost:4566`

## Best Practices

### 1. Always Start Services in Order

The startup script handles this automatically, but if starting manually:
1. LocalStack
2. Firebase Emulator
3. Backend
4. Frontends

### 2. Monitor Logs

Keep log files open in separate terminals:
```bash
# Terminal 1
tail -f backend-dev.log

# Terminal 2
tail -f user-app-dev.log

# Terminal 3
docker-compose -f docker-compose.dev.yml logs -f localstack
```

### 3. Clean Restart

If experiencing issues, do a clean restart:
```bash
./dev-scripts/stop-dev-environment.sh
rm -rf localstack-data
./dev-scripts/start-dev-environment.sh
```

### 4. Use Development Tools

- **DynamoDB Admin UI**: http://localhost:8001 for table inspection
- **Firebase Emulator UI**: http://localhost:4000 for user management
- **Browser DevTools**: For frontend debugging
- **Postman/Insomnia**: For API testing

### 5. Keep Dependencies Updated

```bash
# Backend
cd backend && mvn clean install

# Frontend
cd packages/user-app && npm install
cd packages/analytics-dashboard && npm install
cd packages/shared && npm install
```

## Advanced Topics

### Custom LocalStack Initialization

Edit `dev-scripts/init-localstack.sh` to add custom resources:

```bash
# Add custom DynamoDB table
aws dynamodb create-table \
  --endpoint-url http://localhost:4566 \
  --table-name my-custom-table \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

### Seed Test Data

Create a script to populate test data:

```bash
#!/bin/bash
# dev-scripts/seed-test-data.sh

export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# Add test events
aws dynamodb put-item \
  --endpoint-url http://localhost:4566 \
  --table-name user-events \
  --item '{"userId": {"S": "test-user-1"}, "timestamp": {"N": "1634567890"}, "eventType": {"S": "page_view"}}'
```

### Debug Backend in IDE

**IntelliJ IDEA:**
1. Open `backend` as Maven project
2. Create Run Configuration:
   - Main class: `com.userjourney.analytics.Application`
   - VM options: `-Dspring.profiles.active=dev`
   - Environment variables: `AWS_ACCESS_KEY_ID=test;AWS_SECRET_ACCESS_KEY=test`
3. Run in Debug mode

**VS Code:**
1. Install Java Extension Pack
2. Create `.vscode/launch.json`:
```json
{
  "type": "java",
  "name": "Debug Backend",
  "request": "launch",
  "mainClass": "com.userjourney.analytics.Application",
  "env": {
    "SPRING_PROFILES_ACTIVE": "dev",
    "AWS_ACCESS_KEY_ID": "test",
    "AWS_SECRET_ACCESS_KEY": "test"
  }
}
```

## Resources

- [LocalStack Documentation](https://docs.localstack.cloud/)
- [Firebase Emulator Documentation](https://firebase.google.com/docs/emulator-suite)
- [Spring Boot Documentation](https://spring.io/projects/spring-boot)
- [React Documentation](https://react.dev/)
- [AWS CLI Documentation](https://docs.aws.amazon.com/cli/)

## Support

For issues or questions:
1. Check this guide's troubleshooting section
2. Review service logs
3. Consult individual service documentation:
   - [LocalStack Setup](./LOCALSTACK_SETUP.md)
   - [Firebase Emulator Setup](./FIREBASE_EMULATOR_SETUP.md)
4. Check the project's main documentation
