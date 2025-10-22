# Dev/Prod Mode Switching - Quick Reference

## 🚀 Quick Start

### Option 1: Automated Scripts (Easiest)

```bash
# Start everything in dev mode
./scripts/start-dev.sh

# Start everything in prod mode
./scripts/start-prod.sh
```

### Option 2: Manual Start

**Development Mode:**
```bash
# Terminal 1: Backend
cd backend
SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run

# Terminal 2: User App
cd packages/user-app
NODE_ENV=development npm start

# Terminal 3: Analytics Dashboard
cd packages/analytics-dashboard
NODE_ENV=development npm start
```

**Production Mode:**
```bash
# Terminal 1: Backend
cd backend
SPRING_PROFILES_ACTIVE=prod mvn spring-boot:run

# Terminal 2: User App
cd packages/user-app
NODE_ENV=production npm start

# Terminal 3: Analytics Dashboard
cd packages/analytics-dashboard
NODE_ENV=production npm start
```

---

## 📋 What Changes Between Modes?

| Component | Dev Mode | Prod Mode |
|-----------|----------|-----------|
| **Backend Profile** | `dev` | `prod` |
| **AWS Services** | LocalStack (localhost:4566) | Real AWS |
| **Firebase** | Emulator (localhost:9099) | Production |
| **DynamoDB** | LocalStack | AWS DynamoDB |
| **Kinesis** | LocalStack | AWS Kinesis |
| **S3** | LocalStack | AWS S3 |
| **Logging Level** | DEBUG | INFO/WARN |
| **CORS** | localhost:3000, 3001 | Production domains |
| **Rate Limiting** | Disabled | Enabled |
| **Source Maps** | Enabled | Disabled |
| **Hot Reload** | Enabled | Disabled |

---

## ✅ Prerequisites

### For Dev Mode:
- [x] Docker installed and running
- [x] LocalStack: `docker run -d -p 4566:4566 localstack/localstack`
- [x] Firebase CLI: `npm install -g firebase-tools`
- [x] Firebase Emulator: `firebase emulators:start`

### For Prod Mode:
- [x] AWS credentials configured: `aws configure`
- [x] Firebase production project created
- [x] Firebase service account key downloaded
- [x] Environment variables set (see below)

---

## 🔧 Configuration Files

### Backend Configuration

**Dev Mode:** `backend/src/main/resources/application-dev.yml`
- Uses LocalStack endpoints
- Firebase Emulator enabled
- Debug logging

**Prod Mode:** `backend/src/main/resources/application-prod.yml`
- Uses real AWS services
- Production Firebase
- Production logging

### Frontend Configuration

**Dev Mode:** `packages/user-app/.env.development`
```env
NODE_ENV=development
REACT_APP_API_BASE_URL=http://localhost:8080/api
REACT_APP_FIREBASE_USE_EMULATOR=true
```

**Prod Mode:** `packages/user-app/.env.production`
```env
NODE_ENV=production
REACT_APP_API_BASE_URL=https://api.journey-analytics.io/api
REACT_APP_FIREBASE_USE_EMULATOR=false
```

---

## 🛠️ Available Scripts

| Script | Description |
|--------|-------------|
| `./scripts/start-dev.sh` | Start all services in dev mode |
| `./scripts/start-prod.sh` | Start all services in prod mode |
| `./scripts/setup-dev-environment.sh` | Set up LocalStack resources |
| `./scripts/test-environment.sh dev` | Test dev environment |
| `./scripts/test-environment.sh prod` | Test prod environment |
| `./scripts/switch-mode.sh dev` | Set env vars for dev mode |
| `./scripts/switch-mode.sh prod` | Set env vars for prod mode |

---

## 🔍 Verification

### Check Current Mode

**Backend:**
```bash
curl http://localhost:8080/api/health
# Dev: {"status":"UP","environment":"dev"}
# Prod: {"status":"UP","environment":"prod"}
```

**Frontend:**
Open browser console and look for:
```
🔧 Environment Configuration
Environment: development  (or production)
```

### Check Logs

**Backend:**
```bash
# Dev mode should show:
Active Profile: dev
Using LocalStack for AWS services

# Prod mode should show:
Active Profile: prod
Using actual AWS services
```

---

## 🐛 Troubleshooting

### Backend won't start in dev mode
```bash
# Check LocalStack
docker ps | grep localstack
curl http://localhost:4566/_localstack/health

# Restart if needed
docker restart localstack
```

### Backend won't start in prod mode
```bash
# Check AWS credentials
aws sts get-caller-identity

# Reconfigure if needed
aws configure
```

### Frontend can't connect to backend
```bash
# Check if backend is running
curl http://localhost:8080/api/health

# Check CORS settings in application-dev.yml or application-prod.yml
```

---

## 📚 Documentation

- **Detailed Guide:** `.kiro/specs/auth-and-environment-config/QUICK_START_DEV_PROD_SWITCHING.md`
- **Local Testing:** `.kiro/specs/auth-and-environment-config/LOCAL_ENVIRONMENT_TESTING_GUIDE.md`
- **Deployment:** `.kiro/specs/auth-and-environment-config/DEPLOYMENT_STRATEGY_GUIDE.md`

---

## 💡 Tips

1. **Always start in dev mode first** to avoid AWS costs
2. **Use automated scripts** for easier management
3. **Check logs** if something doesn't work
4. **Verify environment** before testing
5. **Stop services** when done to save resources

---

## 🎯 Summary

**Yes, you can flip between dev and prod modes with a single flag!**

**Simplest way:**
```bash
# Dev mode
./scripts/start-dev.sh

# Prod mode
./scripts/start-prod.sh
```

**Everything switches automatically:**
- ✅ AWS services (LocalStack ↔ Real AWS)
- ✅ Firebase (Emulator ↔ Production)
- ✅ Logging levels
- ✅ CORS settings
- ✅ Rate limiting
- ✅ Debug features

**No code changes needed!** 🚀

---

**Last Updated:** October 20, 2025
