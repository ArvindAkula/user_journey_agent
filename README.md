# Environment Setup Guide

## Quick Start

1. **Copy the template:**
   ```bash
   cp .env.production.template .env.production
   ```

2. **Fill in your credentials** (see sections below)

3. **Run the application:**
   ```bash
   # Backend
   cd backend
   ./mvnw spring-boot:run

   # Frontend
   cd packages/user-app
   npm install
   npm start
   ```

---

## Required Configuration

### 1. AWS Credentials

Replace these with your AWS account details:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...  # Your AWS Access Key
AWS_SECRET_ACCESS_KEY=...  # Your AWS Secret Key
```

**How to get:**
- Go to AWS Console → IAM → Users → Security Credentials
- Create Access Key
- Save both Access Key ID and Secret Access Key

### 2. AWS Account ID

Replace `YOUR_ACCOUNT_ID` in all SQS URLs with your AWS account ID:

```bash
# Find your account ID:
aws sts get-caller-identity --query Account --output text

# Then replace in:
AWS_SQS_EVENT_PROCESSING_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/...
AWS_SQS_EVENT_PROCESSING_DLQ_URL=https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/...
# ... and all other SQS URLs
```

### 3. Firebase Configuration

Replace with your Firebase project details:

```bash
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_API_KEY=AIza...
FIREBASE_AUTH_DOMAIN=your-firebase-project.firebaseapp.com
FIREBASE_STORAGE_BUCKET=your-firebase-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

**How to get:**
- Go to Firebase Console → Project Settings
- Scroll to "Your apps" section
- Copy the config values

### 4. Security Keys

Generate secure keys for JWT and encryption:

```bash
# Generate JWT Secret (256-bit)
openssl rand -base64 32

# Generate Encryption Key (32 characters)
openssl rand -hex 16
```

Then update:
```bash
JWT_SECRET=your-generated-jwt-secret
ENCRYPTION_KEY=your-generated-encryption-key
```

---

## Optional Configuration

### API Endpoints

If deploying to production, update these:

```bash
API_BASE_URL=https://api.yourdomain.com
ANALYTICS_API_BASE_URL=https://api.yourdomain.com/analytics
WEBSOCKET_URL=wss://api.yourdomain.com/ws
```

For local development, keep as:
```bash
API_BASE_URL=http://localhost:8080
```

### Domain Configuration

For production deployment:

```bash
USER_APP_DOMAIN=app.yourdomain.com
ANALYTICS_DASHBOARD_DOMAIN=analytics.yourdomain.com
```

### CORS Origins

Update to match your domains:

```bash
CORS_ALLOWED_ORIGINS=https://app.yourdomain.com,https://analytics.yourdomain.com
```

For local development:
```bash
CORS_ALLOWED_ORIGINS=http://localhost,http://localhost:3000,http://localhost:3001
```

---

## AWS Services Setup

### 1. DynamoDB Tables

The application expects these tables (created by CDK/Terraform):

- `user-journey-analytics-user-events`
- `user-journey-analytics-user-sessions`
- `user-journey-analytics-analytics-summary`
- `user-journey-analytics-audit-logs`
- `user-journey-analytics-struggle-signals`
- `user-journey-analytics-video-engagement`
- `user-journey-analytics-user-profiles`

**Deploy with CDK:**
```bash
cd infrastructure
npm install
cdk deploy
```

### 2. Kinesis Stream

Stream name: `user-journey-analytics-user-events`

**Create manually:**
```bash
aws kinesis create-stream \
  --stream-name user-journey-analytics-user-events \
  --shard-count 2 \
  --region us-east-1
```

### 3. S3 Bucket

Bucket name: `user-journey-analytics`

**Create manually:**
```bash
aws s3 mb s3://user-journey-analytics --region us-east-1
```

### 4. SQS Queues

Create these queues (or use CDK):

- `user-journey-analytics-event-processing`
- `user-journey-analytics-event-processing-dlq`
- `user-journey-analytics-struggle-signals`
- `user-journey-analytics-video-analysis`
- `user-journey-analytics-intervention-execution`

### 5. Bedrock Access

Enable Amazon Bedrock in your AWS account:

1. Go to AWS Console → Bedrock
2. Request model access for "Amazon Nova Micro"
3. Wait for approval (usually instant)

---

## Verification

### Check Configuration

```bash
# Test AWS credentials
aws sts get-caller-identity

# Test DynamoDB access
aws dynamodb list-tables --region us-east-1

# Test Kinesis access
aws kinesis list-streams --region us-east-1

# Test Bedrock access
aws bedrock list-foundation-models --region us-east-1
```

### Test Application

1. **Start Backend:**
   ```bash
   cd backend
   ./mvnw spring-boot:run
   ```

2. **Check Health:**
   ```bash
   curl http://localhost:8080/api/health
   ```

3. **Start Frontend:**
   ```bash
   cd packages/user-app
   npm start
   ```

4. **Open Browser:**
   ```
   http://localhost:3000
   ```

---

## Troubleshooting

### AWS Credentials Not Working

```bash
# Check credentials
aws configure list

# Reconfigure
aws configure
```

### DynamoDB Tables Not Found

```bash
# List tables
aws dynamodb list-tables --region us-east-1

# Deploy infrastructure
cd infrastructure
cdk deploy
```

### Firebase Not Working

- Check Firebase Console → Project Settings
- Verify API key is correct
- Check domain is authorized in Firebase Console

### CORS Errors

Update `CORS_ALLOWED_ORIGINS` to include your frontend URL:
```bash
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

---

## Production Checklist

Before deploying to production:

- [ ] Replace all placeholder values
- [ ] Generate secure JWT_SECRET and ENCRYPTION_KEY
- [ ] Update API_BASE_URL to production domain
- [ ] Update CORS_ALLOWED_ORIGINS to production domains
- [ ] Set DEBUG_MODE=false
- [ ] Set LOG_LEVEL=INFO or WARN
- [ ] Deploy AWS infrastructure (CDK/Terraform)
- [ ] Test all endpoints
- [ ] Enable SSL/TLS certificates
- [ ] Set up monitoring and alerts

---

## Need Help?

- Check `DEPLOYMENT_GUIDE.md` for detailed deployment instructions
- Review `SECURITY_CLEANUP.md` for security best practices
- See `AI_SERVICES_EXPLAINED.md` for AI services setup

---

**Ready to go!** 🚀
