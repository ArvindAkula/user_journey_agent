# Quick Start: Secure Credential Management

This guide helps you quickly set up secure credentials for the User Journey Analytics application.

## For Developers (First Time Setup)

### 1. Set Up Development Environment

```bash
# Copy environment templates
cp packages/user-app/.env.development.template packages/user-app/.env.development
cp packages/analytics-dashboard/.env.development.template packages/analytics-dashboard/.env.development

# That's it! Development keys are pre-configured in application-dev.yml
```

### 2. Start the Application

```bash
# Start LocalStack
localstack start

# Start Firebase Emulator
firebase emulators:start --only auth

# Start Backend (in another terminal)
cd backend
export SPRING_PROFILES_ACTIVE=dev
./mvnw spring-boot:run

# Start User App (in another terminal)
cd packages/user-app
npm start

# Start Analytics Dashboard (in another terminal)
cd packages/analytics-dashboard
npm start
```

## For Production Deployment

### 1. Generate Production Keys

**Option A: Using OpenSSL (Recommended)**
```bash
# Generate both keys at once
export ENCRYPTION_KEY=$(openssl rand -base64 32)
export JWT_SECRET=$(openssl rand -base64 32)

# Display keys for storage
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo "JWT_SECRET=$JWT_SECRET"
```

**Option B: Using Key Generator CLI**
```bash
cd backend
mvn exec:java -Dexec.mainClass="com.userjourney.analytics.util.KeyGeneratorCLI"
# Select option 3: Generate Both
```

### 2. Store Keys Securely

**Option A: AWS Secrets Manager (Recommended for Production)**
```bash
# Store encryption key
aws secretsmanager create-secret \
  --name user-journey-analytics/encryption-key \
  --secret-string "$ENCRYPTION_KEY"

# Store JWT secret
aws secretsmanager create-secret \
  --name user-journey-analytics/jwt-secret \
  --secret-string "$JWT_SECRET"
```

**Option B: Environment Variables**
```bash
# Add to your deployment configuration
export ENCRYPTION_KEY="<your-generated-key>"
export JWT_SECRET="<your-generated-secret>"
```

### 3. Configure Frontend Applications

```bash
# Copy production templates
cp packages/user-app/.env.production.template packages/user-app/.env.production
cp packages/analytics-dashboard/.env.production.template packages/analytics-dashboard/.env.production

# Edit .env.production files and replace all <placeholder> values
# Get Firebase values from: https://console.firebase.google.com/project/YOUR_PROJECT/settings/general
```

### 4. Deploy

```bash
# Build backend
cd backend
./mvnw clean package -DskipTests

# Build frontends
cd packages/user-app
npm run build

cd ../analytics-dashboard
npm run build

# Deploy to your infrastructure
```

## Common Commands

### Generate a New Key
```bash
openssl rand -base64 32
```

### Validate Key Length
```bash
# Should output 32 or more
echo -n "$ENCRYPTION_KEY" | base64 -d | wc -c
```

### Test Backend Startup
```bash
cd backend
export SPRING_PROFILES_ACTIVE=prod
export ENCRYPTION_KEY=$(openssl rand -base64 32)
export JWT_SECRET=$(openssl rand -base64 32)
./mvnw spring-boot:run
```

## Troubleshooting

### "Encryption key is not configured"
```bash
export ENCRYPTION_KEY=$(openssl rand -base64 32)
```

### "Encryption key is too short"
```bash
# Generate a proper 256-bit key
export ENCRYPTION_KEY=$(openssl rand -base64 32)
```

### "Using default key in PRODUCTION"
```bash
# Generate a unique production key
export ENCRYPTION_KEY=$(openssl rand -base64 32)
# Never use development keys in production!
```

## Security Checklist

Before deploying to production:

- [ ] Generated unique encryption key (not using dev key)
- [ ] Generated unique JWT secret (not using dev secret)
- [ ] Stored keys in AWS Secrets Manager or secure environment
- [ ] Verified keys are NOT in version control
- [ ] Updated all `<placeholder>` values in .env.production files
- [ ] Tested application startup with production keys
- [ ] Documented key storage location for team
- [ ] Set up key rotation schedule

## Need More Help?

- **Detailed Guide**: See `ENVIRONMENT_VARIABLES.md`
- **Key Management**: See `backend/docs/KEY_MANAGEMENT.md`
- **Full Implementation**: See `TASK_8_IMPLEMENTATION_SUMMARY.md`
