# Production Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the User Journey Analytics application to production with custom domains:
- **User App**: https://www.journey-analytics.io
- **Analytics Dashboard**: https://www.journey-analytics-admin.io

## Prerequisites

### Required Accounts and Access
- [ ] AWS Account with administrative access
- [ ] Domain registrar account (for domain registration)
- [ ] Firebase project (production)
- [ ] GitHub account (for CI/CD)
- [ ] Docker installed locally
- [ ] AWS CLI configured
- [ ] Node.js 18+ installed
- [ ] Java 17+ installed
- [ ] Maven installed

### Required Tools
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Install AWS CDK
npm install -g aws-cdk

# Install Firebase CLI
npm install -g firebase-tools

# Verify installations
aws --version
cdk --version
firebase --version
```

## Phase 1: Domain Registration and DNS Setup

### Step 1.1: Register Domains

**Option A: Register with Route 53**
```bash
# Register journey-analytics.io
aws route53domains register-domain \
  --domain-name journey-analytics.io \
  --duration-in-years 1 \
  --admin-contact file://contact.json \
  --registrant-contact file://contact.json \
  --tech-contact file://contact.json

# Register journey-analytics-admin.io
aws route53domains register-domain \
  --domain-name journey-analytics-admin.io \
  --duration-in-years 1 \
  --admin-contact file://contact.json \
  --registrant-contact file://contact.json \
  --tech-contact file://contact.json
```

**Option B: Register with External Registrar**
1. Register domains with your preferred registrar (GoDaddy, Namecheap, etc.)
2. Note the domain registrar's nameservers (you'll update these later)

### Step 1.2: Create Route 53 Hosted Zones

```bash
# Create hosted zone for User App domain
aws route53 create-hosted-zone \
  --name journey-analytics.io \
  --caller-reference $(date +%s) \
  --hosted-zone-config Comment="User Journey Analytics User App"

# Create hosted zone for Analytics Dashboard domain
aws route53 create-hosted-zone \
  --name journey-analytics-admin.io \
  --caller-reference $(date +%s) \
  --hosted-zone-config Comment="User Journey Analytics Dashboard"

# Get nameservers for each hosted zone
aws route53 get-hosted-zone --id <HOSTED_ZONE_ID>
```

### Step 1.3: Update Domain Nameservers

If you registered domains outside Route 53:
1. Log into your domain registrar
2. Update nameservers to Route 53 nameservers (from previous step)
3. Wait for DNS propagation (can take 24-48 hours)

Verify DNS propagation:
```bash
dig NS journey-analytics.io
dig NS journey-analytics-admin.io
```

## Phase 2: SSL/TLS Certificate Provisioning

### Step 2.1: Request ACM Certificates

**Important**: Certificates for CloudFront must be in us-east-1 region!

```bash
# Request certificate for User App
aws acm request-certificate \
  --domain-name www.journey-analytics.io \
  --subject-alternative-names journey-analytics.io \
  --validation-method DNS \
  --region us-east-1

# Request certificate for Analytics Dashboard
aws acm request-certificate \
  --domain-name www.journey-analytics-admin.io \
  --subject-alternative-names journey-analytics-admin.io \
  --validation-method DNS \
  --region us-east-1
```

### Step 2.2: Validate Certificates via DNS

```bash
# Get validation records
aws acm describe-certificate \
  --certificate-arn <CERTIFICATE_ARN> \
  --region us-east-1

# Create validation CNAME records in Route 53
aws route53 change-resource-record-sets \
  --hosted-zone-id <HOSTED_ZONE_ID> \
  --change-batch file://validation-record.json
```

Example `validation-record.json`:
```json
{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "_abc123.journey-analytics.io",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "_xyz789.acm-validations.aws."}]
    }
  }]
}
```

Wait for certificate validation (usually 5-30 minutes):
```bash
aws acm wait certificate-validated \
  --certificate-arn <CERTIFICATE_ARN> \
  --region us-east-1
```

## Phase 3: Infrastructure Deployment

### Step 3.1: Configure AWS Credentials

```bash
# Configure AWS CLI
aws configure

# Set environment variables
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
```

### Step 3.2: Deploy Infrastructure with CDK

```bash
cd infrastructure

# Install dependencies
npm install

# Bootstrap CDK (first time only)
cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION

# Review changes
cdk diff

# Deploy all stacks
cdk deploy --all --require-approval never
```

This will create:
- VPC with public and private subnets
- ECS cluster and services
- Application Load Balancer
- S3 buckets for static hosting
- CloudFront distributions
- Route 53 DNS records
- Security groups and IAM roles

### Step 3.3: Verify Infrastructure Deployment

```bash
# Check ECS cluster
aws ecs describe-clusters --clusters user-journey-cluster

# Check ALB
aws elbv2 describe-load-balancers \
  --names user-journey-backend-alb

# Check S3 buckets
aws s3 ls | grep journey-analytics

# Check CloudFront distributions
aws cloudfront list-distributions
```

## Phase 4: Backend Deployment

### Step 4.1: Build Backend Application

```bash
cd backend

# Build with Maven
mvn clean package -DskipTests

# Verify JAR file
ls -lh target/analytics-backend-*.jar
```

### Step 4.2: Build and Push Docker Image

```bash
# Get ECR login
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build Docker image
docker build -t user-journey-backend:latest .

# Tag image
docker tag user-journey-backend:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/user-journey-backend:latest

# Push to ECR
docker push \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/user-journey-backend:latest
```

### Step 4.3: Deploy to ECS

```bash
# Update ECS service to use new image
aws ecs update-service \
  --cluster user-journey-cluster \
  --service backend-service \
  --force-new-deployment

# Monitor deployment
aws ecs wait services-stable \
  --cluster user-journey-cluster \
  --services backend-service

# Check service status
aws ecs describe-services \
  --cluster user-journey-cluster \
  --services backend-service
```

### Step 4.4: Verify Backend Health

```bash
# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --names user-journey-backend-alb \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

# Test health endpoint
curl https://$ALB_DNS/actuator/health

# Expected response:
# {"status":"UP"}
```

## Phase 5: Frontend Deployment

### Step 5.1: Configure Environment Variables

Create `.env.production` files:

**User App** (`packages/user-app/.env.production`):
```bash
REACT_APP_ENV=production
REACT_APP_API_BASE_URL=https://api.journey-analytics.io
REACT_APP_WS_URL=wss://api.journey-analytics.io/ws

# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=journey-analytics.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=journey-analytics-prod
REACT_APP_FIREBASE_STORAGE_BUCKET=journey-analytics-prod.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
REACT_APP_FIREBASE_MEASUREMENT_ID=your-measurement-id

REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_DEBUG=false
```

**Analytics Dashboard** (`packages/analytics-dashboard/.env.production`):
```bash
REACT_APP_ENV=production
REACT_APP_API_BASE_URL=https://api.journey-analytics.io
REACT_APP_WS_URL=wss://api.journey-analytics.io/ws

# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=journey-analytics.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=journey-analytics-prod

REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_DEBUG=false
REACT_APP_REQUIRE_ADMIN=true
```

### Step 5.2: Build User App

```bash
cd packages/user-app

# Install dependencies
npm install

# Build production bundle
npm run build

# Verify build
ls -lh build/
```

### Step 5.3: Deploy User App to S3

```bash
# Sync build to S3
aws s3 sync build/ s3://user-app-prod --delete

# Set cache control headers
aws s3 cp s3://user-app-prod s3://user-app-prod \
  --recursive \
  --metadata-directive REPLACE \
  --cache-control "public, max-age=31536000" \
  --exclude "*.html" \
  --exclude "service-worker.js"

# Set no-cache for HTML files
aws s3 cp s3://user-app-prod s3://user-app-prod \
  --recursive \
  --metadata-directive REPLACE \
  --cache-control "no-cache, no-store, must-revalidate" \
  --exclude "*" \
  --include "*.html" \
  --include "service-worker.js"

# Get CloudFront distribution ID
USER_APP_DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Aliases.Items[?contains(@, 'journey-analytics.io')]].Id" \
  --output text)

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $USER_APP_DIST_ID \
  --paths "/*"
```

### Step 5.4: Build and Deploy Analytics Dashboard

```bash
cd packages/analytics-dashboard

# Install dependencies
npm install

# Build production bundle
npm run build

# Deploy to S3
aws s3 sync build/ s3://analytics-dashboard-prod --delete

# Set cache control headers (same as User App)
aws s3 cp s3://analytics-dashboard-prod s3://analytics-dashboard-prod \
  --recursive \
  --metadata-directive REPLACE \
  --cache-control "public, max-age=31536000" \
  --exclude "*.html" \
  --exclude "service-worker.js"

aws s3 cp s3://analytics-dashboard-prod s3://analytics-dashboard-prod \
  --recursive \
  --metadata-directive REPLACE \
  --cache-control "no-cache, no-store, must-revalidate" \
  --exclude "*" \
  --include "*.html" \
  --include "service-worker.js"

# Get CloudFront distribution ID
DASHBOARD_DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Aliases.Items[?contains(@, 'journey-analytics-admin.io')]].Id" \
  --output text)

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $DASHBOARD_DIST_ID \
  --paths "/*"
```

## Phase 6: DNS Configuration

### Step 6.1: Create DNS Records for Applications

The CDK deployment should have created these automatically, but verify:

```bash
# Verify User App DNS record
aws route53 list-resource-record-sets \
  --hosted-zone-id <USER_APP_HOSTED_ZONE_ID> \
  --query "ResourceRecordSets[?Name=='www.journey-analytics.io.']"

# Verify Analytics Dashboard DNS record
aws route53 list-resource-record-sets \
  --hosted-zone-id <DASHBOARD_HOSTED_ZONE_ID> \
  --query "ResourceRecordSets[?Name=='www.journey-analytics-admin.io.']"
```

### Step 6.2: Create API Subdomain

```bash
# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --names user-journey-backend-alb \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

# Get ALB hosted zone ID
ALB_ZONE_ID=$(aws elbv2 describe-load-balancers \
  --names user-journey-backend-alb \
  --query 'LoadBalancers[0].CanonicalHostedZoneId' \
  --output text)

# Create api.journey-analytics.io pointing to ALB
aws route53 change-resource-record-sets \
  --hosted-zone-id <USER_APP_HOSTED_ZONE_ID> \
  --change-batch file://api-record.json
```

Example `api-record.json`:
```json
{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "api.journey-analytics.io",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "ALB_ZONE_ID",
        "DNSName": "ALB_DNS_NAME",
        "EvaluateTargetHealth": true
      }
    }
  }]
}
```

### Step 6.3: Verify DNS Resolution

```bash
# Test DNS resolution
dig www.journey-analytics.io
dig www.journey-analytics-admin.io
dig api.journey-analytics.io

# Test with curl
curl -I https://www.journey-analytics.io
curl -I https://www.journey-analytics-admin.io
curl https://api.journey-analytics.io/actuator/health
```

## Phase 7: Security Configuration

### Step 7.1: Configure WAF

```bash
# Create WAF web ACL
aws wafv2 create-web-acl \
  --name user-journey-waf \
  --scope CLOUDFRONT \
  --default-action Allow={} \
  --rules file://waf-rules.json \
  --region us-east-1

# Associate with CloudFront distributions
aws wafv2 associate-web-acl \
  --web-acl-arn <WAF_ACL_ARN> \
  --resource-arn <CLOUDFRONT_DISTRIBUTION_ARN>
```

### Step 7.2: Enable AWS Security Services

```bash
# Enable CloudTrail
aws cloudtrail create-trail \
  --name user-journey-audit \
  --s3-bucket-name user-journey-cloudtrail

aws cloudtrail start-logging \
  --name user-journey-audit

# Enable GuardDuty
aws guardduty create-detector \
  --enable

# Enable AWS Config
aws configservice put-configuration-recorder \
  --configuration-recorder file://config-recorder.json

aws configservice put-delivery-channel \
  --delivery-channel file://delivery-channel.json

aws configservice start-configuration-recorder \
  --configuration-recorder-name default
```

### Step 7.3: Configure Secrets Manager

```bash
# Store JWT secret
aws secretsmanager create-secret \
  --name prod/jwt-secret \
  --secret-string "$(openssl rand -base64 32)"

# Store Firebase credentials
aws secretsmanager create-secret \
  --name prod/firebase-credentials \
  --secret-string file://firebase-service-account-prod.json

# Store database credentials (if applicable)
aws secretsmanager create-secret \
  --name prod/database-credentials \
  --secret-string '{"username":"admin","password":"secure-password"}'
```

## Phase 8: Monitoring Setup

### Step 8.1: Create CloudWatch Dashboards

```bash
# Create application dashboard
aws cloudwatch put-dashboard \
  --dashboard-name UserJourneyAnalytics \
  --dashboard-body file://dashboard.json
```

### Step 8.2: Configure Alarms

```bash
# High error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name high-error-rate \
  --alarm-description "Alert when error rate exceeds 5%" \
  --metric-name 5XXError \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions <SNS_TOPIC_ARN>

# High latency alarm
aws cloudwatch put-metric-alarm \
  --alarm-name high-latency \
  --alarm-description "Alert when latency exceeds 1 second" \
  --metric-name TargetResponseTime \
  --namespace AWS/ApplicationELB \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 1.0 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions <SNS_TOPIC_ARN>

# Unhealthy targets alarm
aws cloudwatch put-metric-alarm \
  --alarm-name unhealthy-targets \
  --alarm-description "Alert when targets become unhealthy" \
  --metric-name UnHealthyHostCount \
  --namespace AWS/ApplicationELB \
  --statistic Average \
  --period 60 \
  --evaluation-periods 2 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --alarm-actions <SNS_TOPIC_ARN>
```

### Step 8.3: Set Up SNS Notifications

```bash
# Create SNS topic
aws sns create-topic --name user-journey-alerts

# Subscribe email
aws sns subscribe \
  --topic-arn <SNS_TOPIC_ARN> \
  --protocol email \
  --notification-endpoint admin@example.com

# Confirm subscription (check email)
```

## Phase 9: Testing and Validation

### Step 9.1: Smoke Tests

```bash
# Test User App
curl -I https://www.journey-analytics.io
# Expected: 200 OK

# Test Analytics Dashboard
curl -I https://www.journey-analytics-admin.io
# Expected: 200 OK

# Test API
curl https://api.journey-analytics.io/actuator/health
# Expected: {"status":"UP"}

# Test HTTPS redirect
curl -I http://www.journey-analytics.io
# Expected: 301 redirect to https://
```

### Step 9.2: Authentication Flow Test

1. Open https://www.journey-analytics.io
2. Click login
3. Enter credentials for authorized user
4. Verify successful login
5. Verify JWT token in browser storage
6. Test protected routes
7. Test logout

Repeat for Analytics Dashboard at https://www.journey-analytics-admin.io

### Step 9.3: API Integration Test

```bash
# Get JWT token (from browser or login API)
TOKEN="your-jwt-token"

# Test authenticated endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://api.journey-analytics.io/api/events

# Test role-based access
curl -H "Authorization: Bearer $TOKEN" \
  https://api.journey-analytics.io/api/admin/users
```

### Step 9.4: Performance Test

```bash
# Install Apache Bench
brew install httpd  # macOS

# Run load test
ab -n 1000 -c 10 https://www.journey-analytics.io/

# Check results
# - Requests per second
# - Time per request
# - Failed requests (should be 0)
```

### Step 9.5: Security Scan

```bash
# Install OWASP ZAP
brew install --cask owasp-zap  # macOS

# Run automated scan
zap-cli quick-scan https://www.journey-analytics.io

# Check for vulnerabilities
# - SQL injection
# - XSS
# - CSRF
# - Security headers
```

## Phase 10: Go-Live Checklist

### Pre-Launch Checklist

- [ ] All infrastructure deployed successfully
- [ ] SSL certificates valid and auto-renewing
- [ ] DNS records resolving correctly
- [ ] Backend health checks passing
- [ ] Frontend applications loading
- [ ] Authentication working
- [ ] API endpoints responding
- [ ] CORS configured correctly
- [ ] Security headers present
- [ ] WAF rules active
- [ ] CloudWatch alarms configured
- [ ] SNS notifications working
- [ ] Backups configured
- [ ] Monitoring dashboards created
- [ ] Documentation complete
- [ ] Team trained on operations

### Launch Day Tasks

1. **Final Verification** (1 hour before)
   ```bash
   # Run all smoke tests
   ./scripts/smoke-tests.sh
   
   # Verify monitoring
   # Check CloudWatch dashboards
   # Verify alarms are active
   ```

2. **Enable Production Traffic**
   - No action needed if DNS already points to production
   - Monitor metrics closely

3. **Monitor for Issues** (first 24 hours)
   - Watch CloudWatch dashboards
   - Monitor error logs
   - Check alarm notifications
   - Verify user feedback

4. **Post-Launch Review** (after 24 hours)
   - Review metrics and logs
   - Document any issues encountered
   - Optimize based on real traffic patterns
   - Update runbooks if needed

## Rollback Procedures

### Rollback Frontend

```bash
# List previous versions
aws s3api list-object-versions \
  --bucket user-app-prod \
  --prefix index.html

# Restore previous version
aws s3api copy-object \
  --bucket user-app-prod \
  --copy-source user-app-prod/index.html?versionId=<VERSION_ID> \
  --key index.html

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id $USER_APP_DIST_ID \
  --paths "/*"
```

### Rollback Backend

```bash
# List previous task definitions
aws ecs list-task-definitions \
  --family-prefix backend-task

# Update service to previous task definition
aws ecs update-service \
  --cluster user-journey-cluster \
  --service backend-service \
  --task-definition backend-task:PREVIOUS_REVISION

# Monitor rollback
aws ecs wait services-stable \
  --cluster user-journey-cluster \
  --services backend-service
```

### Rollback Infrastructure

```bash
# Revert CDK stack
cdk deploy --all --require-approval never

# Or destroy and redeploy
cdk destroy --all
cdk deploy --all --require-approval never
```

## Troubleshooting

### Issue: DNS not resolving

**Symptoms**: Domain doesn't resolve or shows old IP

**Solutions**:
```bash
# Check DNS propagation
dig www.journey-analytics.io

# Verify Route 53 records
aws route53 list-resource-record-sets \
  --hosted-zone-id <HOSTED_ZONE_ID>

# Clear local DNS cache
sudo dscacheutil -flushcache  # macOS
```

### Issue: SSL certificate errors

**Symptoms**: Browser shows "Not Secure" or certificate warnings

**Solutions**:
```bash
# Verify certificate status
aws acm describe-certificate \
  --certificate-arn <CERTIFICATE_ARN> \
  --region us-east-1

# Check CloudFront distribution certificate
aws cloudfront get-distribution \
  --id <DISTRIBUTION_ID>

# Ensure certificate is in us-east-1 region
```

### Issue: 502 Bad Gateway

**Symptoms**: ALB returns 502 error

**Solutions**:
```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn <TARGET_GROUP_ARN>

# Check ECS task status
aws ecs describe-tasks \
  --cluster user-journey-cluster \
  --tasks <TASK_ARN>

# Check application logs
aws logs tail /ecs/backend-service --follow
```

### Issue: CORS errors

**Symptoms**: Browser console shows CORS errors

**Solutions**:
1. Verify CORS configuration in `application-production.yml`
2. Check allowed origins include production domains
3. Verify preflight OPTIONS requests succeed
4. Check CloudFront is forwarding headers correctly

### Issue: High latency

**Symptoms**: Slow page loads or API responses

**Solutions**:
```bash
# Check CloudFront cache hit ratio
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name CacheHitRate \
  --dimensions Name=DistributionId,Value=<DIST_ID> \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# Check ALB response time
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --dimensions Name=LoadBalancer,Value=<ALB_NAME> \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# Optimize:
# - Increase CloudFront TTLs
# - Add more ECS tasks
# - Optimize database queries
# - Enable caching in backend
```

## Cost Optimization

### Monitor Costs

```bash
# Get current month costs
aws ce get-cost-and-usage \
  --time-period Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=SERVICE

# Set up budget alerts
aws budgets create-budget \
  --account-id $AWS_ACCOUNT_ID \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
```

### Optimization Strategies

1. **CloudFront**: Use price class to limit edge locations
2. **ECS**: Use Fargate Spot for non-critical tasks
3. **S3**: Enable intelligent tiering
4. **DynamoDB**: Use on-demand pricing or reserved capacity
5. **ALB**: Consider using NLB for lower costs
6. **CloudWatch**: Reduce log retention period
7. **Backups**: Use lifecycle policies to move to Glacier

## Support and Maintenance

### Regular Maintenance Tasks

**Daily**:
- Review CloudWatch dashboards
- Check alarm notifications
- Monitor error logs

**Weekly**:
- Review cost reports
- Check security scan results
- Update dependencies if needed

**Monthly**:
- Review and optimize costs
- Update SSL certificates if needed
- Review and update documentation
- Test disaster recovery procedures

**Quarterly**:
- Security audit
- Performance review
- Capacity planning
- Update runbooks

### Getting Help

- AWS Support: https://console.aws.amazon.com/support
- Firebase Support: https://firebase.google.com/support
- Internal documentation: `/docs`
- Team Slack channel: #user-journey-ops

## Conclusion

You have successfully deployed the User Journey Analytics application to production! The application is now accessible at:
- User App: https://www.journey-analytics.io
- Analytics Dashboard: https://www.journey-analytics-admin.io

Monitor the application closely for the first 24-48 hours and be prepared to respond to any issues. Refer to the troubleshooting section and runbooks for common scenarios.
