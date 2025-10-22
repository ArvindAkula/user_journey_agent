# Administrator Guide: Managing Users and System Configuration

## Table of Contents

1. [Overview](#overview)
2. [User Management](#user-management)
3. [Role-Based Access Control](#role-based-access-control)
4. [Firebase Console Operations](#firebase-console-operations)
5. [System Configuration](#system-configuration)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)

## Overview

As an administrator, you are responsible for:
- Managing user accounts and access
- Configuring system settings
- Monitoring system health
- Ensuring security compliance
- Supporting end users

This guide covers all administrative tasks for the User Journey Analytics application.

## User Management

### Adding New Users

#### Step 1: Add User to Authorized Users List

1. **Access the Configuration File**:
   ```bash
   # Development
   vim backend/src/main/resources/authorized-users.yml
   
   # Production (via deployment)
   # Edit in your repository and redeploy
   ```

2. **Add User Entry**:
   ```yaml
   authorized:
     users:
       # Existing users...
       
       - email: newuser@company.com
         role: ANALYST  # or ADMIN, VIEWER
         displayName: New User Name
   ```

3. **Save the File**

#### Step 2: Create User in Firebase

**Development (Firebase Emulator)**:

1. Open Firebase Emulator UI: http://localhost:4000
2. Navigate to **Authentication** tab
3. Click **Add user**
4. Enter:
   - Email: newuser@company.com
   - Password: (generate secure password)
   - User ID: (auto-generated)
5. Click **Save**

**Production (Firebase Console)**:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Authentication** > **Users**
4. Click **Add user**
5. Enter:
   - Email: newuser@company.com
   - Password: (generate secure password)
6. Click **Add user**

#### Step 3: Deploy Configuration (Production Only)

```bash
# Commit changes
git add backend/src/main/resources/authorized-users.yml
git commit -m "Add new user: newuser@company.com"
git push

# Deploy backend
cd backend
mvn clean package
# Deploy to ECS/Fargate (see deployment guide)

# Or trigger CI/CD pipeline
# GitHub Actions will automatically deploy
```

#### Step 4: Send Credentials to User

**Email Template**:

```
Subject: Your User Journey Analytics Account

Hello [User Name],

Your account has been created for the User Journey Analytics application.

Login Credentials:
- Email: newuser@company.com
- Temporary Password: [secure-password]
- Role: ANALYST

Access URLs:
- User App: https://www.journey-analytics.io
- Analytics Dashboard: https://www.journey-analytics-admin.io

Please log in and change your password immediately.

For help, refer to the User Guide or contact support.

Best regards,
System Administrator
```

**Security Notes**:
- Send password through secure channel (not email)
- Use password manager to generate strong passwords
- Require password change on first login
- Never reuse passwords

### Modifying User Roles

#### Step 1: Update Authorized Users Configuration

```yaml
authorized:
  users:
    - email: user@company.com
      role: ADMIN  # Changed from ANALYST to ADMIN
      displayName: User Name
```

#### Step 2: Deploy Configuration

```bash
# Development: Restart backend
# Production: Redeploy backend
```

#### Step 3: Notify User

The user must log out and log back in for role changes to take effect.

### Removing Users

#### Step 1: Remove from Authorized Users List

```yaml
authorized:
  users:
    # Remove or comment out user entry
    # - email: olduser@company.com
    #   role: VIEWER
    #   displayName: Old User
```

#### Step 2: Disable in Firebase

**Option A: Disable User** (Recommended - preserves data)

1. Go to Firebase Console > Authentication > Users
2. Find the user
3. Click the three dots menu
4. Select **Disable user**

**Option B: Delete User** (Permanent - removes all data)

1. Go to Firebase Console > Authentication > Users
2. Find the user
3. Click the three dots menu
4. Select **Delete user**
5. Confirm deletion

#### Step 3: Deploy Configuration

```bash
# Redeploy backend with updated configuration
```

### Resetting User Passwords

#### Development (Firebase Emulator)

1. Open Firebase Emulator UI: http://localhost:4000
2. Navigate to **Authentication**
3. Find the user
4. Click **Edit**
5. Enter new password
6. Click **Save**

#### Production (Firebase Console)

**Option A: Send Password Reset Email**

1. Go to Firebase Console > Authentication > Users
2. Find the user
3. Click the three dots menu
4. Select **Send password reset email**
5. User will receive email with reset link

**Option B: Set Password Directly**

1. Go to Firebase Console > Authentication > Users
2. Find the user
3. Click the three dots menu
4. Select **Reset password**
5. Enter new password
6. Click **Save**
7. Send new password to user securely

### Viewing User Activity

#### In Analytics Dashboard

1. Log in to Analytics Dashboard as ADMIN
2. Navigate to **Admin** > **User Management**
3. View user list with:
   - Email
   - Role
   - Last login date
   - Total sessions
   - Activity level

#### In Firebase Console

1. Go to Firebase Console > Authentication > Users
2. View user list with:
   - Email
   - User ID
   - Creation date
   - Last sign-in date
   - Provider (Email/Password)

#### In CloudWatch Logs (Production)

```bash
# Search for user activity
aws logs filter-log-events \
  --log-group-name /ecs/backend-service \
  --filter-pattern "user@company.com" \
  --start-time $(date -d '7 days ago' +%s)000 \
  --end-time $(date +%s)000
```

## Role-Based Access Control

### Role Hierarchy

```
ADMIN (Highest)
  ├── Full system access
  ├── User management
  ├── System configuration
  ├── All analytics features
  └── All user app features

ANALYST (Medium)
  ├── Analytics dashboard access
  ├── View all reports
  ├── Export data
  ├── All user app features
  └── No admin functions

VIEWER (Lowest)
  ├── Read-only access
  ├── Basic reports
  ├── User app features
  └── No analytics dashboard
```

### Endpoint Access Control

The backend enforces role-based access:

```java
// Public endpoints (no authentication required)
/api/auth/login
/api/auth/refresh
/actuator/health

// Authenticated endpoints (any role)
/api/events
/api/profile

// Analyst endpoints (ANALYST or ADMIN)
/api/analytics/**
/api/reports/**
/api/journeys/**

// Admin endpoints (ADMIN only)
/api/admin/**
/api/users/**
/api/config/**
```

### Testing Role-Based Access

```bash
# Get JWT token for each role
ADMIN_TOKEN="..."
ANALYST_TOKEN="..."
VIEWER_TOKEN="..."

# Test admin endpoint (should succeed for ADMIN)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.journey-analytics.io/api/admin/users

# Test admin endpoint (should fail for ANALYST)
curl -H "Authorization: Bearer $ANALYST_TOKEN" \
  https://api.journey-analytics.io/api/admin/users
# Expected: 403 Forbidden

# Test analytics endpoint (should succeed for ANALYST)
curl -H "Authorization: Bearer $ANALYST_TOKEN" \
  https://api.journey-analytics.io/api/analytics/dashboard

# Test analytics endpoint (should fail for VIEWER)
curl -H "Authorization: Bearer $VIEWER_TOKEN" \
  https://api.journey-analytics.io/api/analytics/dashboard
# Expected: 403 Forbidden
```

## Firebase Console Operations

### Accessing Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Sign in with your Google account
3. Select your project:
   - Development: `user-journey-analytics-dev`
   - Production: `journey-analytics-prod`

### Common Operations

#### View Authentication Statistics

1. Navigate to **Authentication** > **Users**
2. View metrics:
   - Total users
   - New users (last 30 days)
   - Active users
   - Sign-in methods

#### View Analytics Events

1. Navigate to **Analytics** > **Events**
2. View real-time events
3. Filter by:
   - Event name
   - Date range
   - User properties

#### Enable/Disable Features

1. Navigate to **Remote Config**
2. Add or modify parameters:
   ```json
   {
     "enable_calculator": true,
     "enable_video_library": true,
     "enable_interventions": true,
     "maintenance_mode": false
   }
   ```
3. Publish changes

#### Export User Data

1. Navigate to **Authentication** > **Users**
2. Click **Export users**
3. Choose format (CSV or JSON)
4. Download file

#### View Crash Reports (if enabled)

1. Navigate to **Crashlytics**
2. View crash statistics
3. Analyze crash logs
4. Track crash-free users

## System Configuration

### Environment Variables

#### Development Environment

Located in:
- Frontend: `packages/*/. env.development`
- Backend: `backend/src/main/resources/application-dev.yml`

#### Production Environment

Stored in:
- AWS Secrets Manager (recommended)
- Environment variables in ECS task definition
- Configuration files (non-sensitive only)

#### Managing Secrets

```bash
# Create secret
aws secretsmanager create-secret \
  --name prod/app-config \
  --secret-string '{"key":"value"}' \
  --region us-east-1

# Update secret
aws secretsmanager update-secret \
  --secret-id prod/app-config \
  --secret-string '{"key":"new-value"}' \
  --region us-east-1

# Retrieve secret
aws secretsmanager get-secret-value \
  --secret-id prod/app-config \
  --region us-east-1

# Delete secret
aws secretsmanager delete-secret \
  --secret-id prod/app-config \
  --force-delete-without-recovery \
  --region us-east-1
```

### Feature Flags

Control feature availability:

```yaml
# application-prod.yml
features:
  calculator:
    enabled: true
  video-library:
    enabled: true
  document-upload:
    enabled: true
  interventions:
    enabled: true
  analytics:
    enabled: true
  export:
    enabled: true
    max-records: 10000
```

Update and redeploy to change feature availability.

### CORS Configuration

Control which domains can access the API:

```yaml
# application-prod.yml
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
```

### Rate Limiting

Configure rate limits to prevent abuse:

```yaml
# application-prod.yml
rate-limit:
  enabled: true
  requests-per-minute: 60
  requests-per-hour: 1000
  requests-per-day: 10000
```

## Monitoring and Maintenance

### CloudWatch Dashboards

Access dashboards:

1. Go to [CloudWatch Console](https://console.aws.amazon.com/cloudwatch/)
2. Navigate to **Dashboards**
3. Select **UserJourneyAnalytics**

**Key Metrics to Monitor**:
- Request count
- Error rate
- Response time
- CPU utilization
- Memory utilization
- Active connections

### CloudWatch Alarms

Configure alarms for critical issues:

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
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:alerts
```

### Log Analysis

#### View Application Logs

```bash
# Tail logs in real-time
aws logs tail /ecs/backend-service --follow

# Search logs
aws logs filter-log-events \
  --log-group-name /ecs/backend-service \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s)000

# Export logs
aws logs create-export-task \
  --log-group-name /ecs/backend-service \
  --from $(date -d '1 day ago' +%s)000 \
  --to $(date +%s)000 \
  --destination s3://logs-bucket \
  --destination-prefix backend-logs/
```

#### Common Log Patterns

```bash
# Authentication failures
aws logs filter-log-events \
  --log-group-name /ecs/backend-service \
  --filter-pattern "Authentication failed"

# Slow queries
aws logs filter-log-events \
  --log-group-name /ecs/backend-service \
  --filter-pattern "[time > 1000]"

# User activity
aws logs filter-log-events \
  --log-group-name /ecs/backend-service \
  --filter-pattern "user@company.com"
```

### Database Maintenance

#### DynamoDB

```bash
# View table metrics
aws dynamodb describe-table \
  --table-name user-events

# Update table capacity (if using provisioned)
aws dynamodb update-table \
  --table-name user-events \
  --provisioned-throughput ReadCapacityUnits=10,WriteCapacityUnits=10

# Create backup
aws dynamodb create-backup \
  --table-name user-events \
  --backup-name user-events-backup-$(date +%Y%m%d)

# Restore from backup
aws dynamodb restore-table-from-backup \
  --target-table-name user-events-restored \
  --backup-arn arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/user-events/backup/BACKUP_ID
```

### System Health Checks

```bash
# Check backend health
curl https://api.journey-analytics.io/actuator/health

# Check frontend availability
curl -I https://www.journey-analytics.io
curl -I https://www.journey-analytics-admin.io

# Check CloudFront distribution
aws cloudfront get-distribution \
  --id DISTRIBUTION_ID

# Check ECS service
aws ecs describe-services \
  --cluster user-journey-cluster \
  --services backend-service

# Check ALB target health
aws elbv2 describe-target-health \
  --target-group-arn TARGET_GROUP_ARN
```

## Security Best Practices

### Password Policies

Enforce strong passwords:

1. Minimum 12 characters
2. Mix of uppercase, lowercase, numbers, symbols
3. No common words or patterns
4. No personal information
5. Change every 90 days (recommended)

### Access Control

1. **Principle of Least Privilege**:
   - Grant minimum necessary permissions
   - Use VIEWER role by default
   - Promote to ANALYST/ADMIN only when needed

2. **Regular Access Reviews**:
   - Review user list monthly
   - Remove inactive users
   - Verify role assignments

3. **Audit Logging**:
   - Enable CloudTrail for all AWS actions
   - Monitor authentication attempts
   - Track configuration changes

### Security Monitoring

```bash
# Enable GuardDuty
aws guardduty create-detector --enable

# Enable Security Hub
aws securityhub enable-security-hub

# Enable AWS Config
aws configservice put-configuration-recorder \
  --configuration-recorder name=default,roleARN=ROLE_ARN

# Review security findings
aws securityhub get-findings \
  --filters '{"SeverityLabel":[{"Value":"CRITICAL","Comparison":"EQUALS"}]}'
```

### Incident Response

**If you suspect a security incident**:

1. **Immediate Actions**:
   - Disable affected user accounts
   - Rotate compromised credentials
   - Review access logs
   - Document timeline

2. **Investigation**:
   - Check CloudTrail logs
   - Review authentication logs
   - Analyze network traffic
   - Identify scope of breach

3. **Remediation**:
   - Patch vulnerabilities
   - Update security groups
   - Reset all passwords
   - Update firewall rules

4. **Post-Incident**:
   - Document lessons learned
   - Update security procedures
   - Train team on new procedures
   - Implement additional controls

## Troubleshooting

### User Cannot Log In

**Symptoms**: User reports login failure

**Diagnosis**:
```bash
# Check if user exists in Firebase
# Go to Firebase Console > Authentication > Users
# Search for user email

# Check if user is in authorized-users.yml
grep "user@company.com" backend/src/main/resources/authorized-users.yml

# Check authentication logs
aws logs filter-log-events \
  --log-group-name /ecs/backend-service \
  --filter-pattern "user@company.com"
```

**Solutions**:
1. Verify user exists in Firebase
2. Verify user is in authorized-users.yml
3. Check user is not disabled
4. Reset user password
5. Check backend logs for errors

### High Error Rate

**Symptoms**: CloudWatch alarm for high error rate

**Diagnosis**:
```bash
# Check error logs
aws logs filter-log-events \
  --log-group-name /ecs/backend-service \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s)000

# Check ALB metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_Target_5XX_Count \
  --dimensions Name=LoadBalancer,Value=app/user-journey-backend-alb/... \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

**Solutions**:
1. Check for recent deployments
2. Review error logs for patterns
3. Check database connectivity
4. Verify AWS service availability
5. Scale up resources if needed
6. Rollback recent changes if necessary

### Slow Performance

**Symptoms**: Users report slow page loads

**Diagnosis**:
```bash
# Check response times
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --dimensions Name=LoadBalancer,Value=app/user-journey-backend-alb/... \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# Check CPU/memory utilization
aws ecs describe-services \
  --cluster user-journey-cluster \
  --services backend-service

# Check CloudFront cache hit ratio
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name CacheHitRate \
  --dimensions Name=DistributionId,Value=DISTRIBUTION_ID \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

**Solutions**:
1. Scale up ECS tasks
2. Optimize database queries
3. Increase CloudFront cache TTLs
4. Enable compression
5. Optimize frontend bundle size
6. Add database indexes

### Data Not Syncing

**Symptoms**: Analytics data not appearing

**Diagnosis**:
```bash
# Check Kinesis stream
aws kinesis describe-stream \
  --stream-name user-events-prod

# Check DynamoDB table
aws dynamodb describe-table \
  --table-name user-events

# Check BigQuery export
# Go to BigQuery Console
# Verify tables exist and have recent data

# Check Firebase Analytics
# Go to Firebase Console > Analytics > Events
# Verify events are being received
```

**Solutions**:
1. Verify Kinesis stream is active
2. Check DynamoDB write capacity
3. Verify BigQuery export is enabled
4. Check Firebase Analytics configuration
5. Review application logs for errors
6. Verify network connectivity

## Maintenance Schedule

### Daily Tasks

- [ ] Review CloudWatch dashboards
- [ ] Check alarm notifications
- [ ] Monitor error logs
- [ ] Verify backup completion

### Weekly Tasks

- [ ] Review user activity
- [ ] Check system performance
- [ ] Review security logs
- [ ] Update documentation

### Monthly Tasks

- [ ] Review and optimize costs
- [ ] Update dependencies
- [ ] Review user access
- [ ] Test disaster recovery
- [ ] Security audit

### Quarterly Tasks

- [ ] Comprehensive security review
- [ ] Performance optimization
- [ ] Capacity planning
- [ ] Update runbooks
- [ ] Team training

## Emergency Contacts

**On-Call Rotation**:
- Primary: [Name] - [Phone] - [Email]
- Secondary: [Name] - [Phone] - [Email]
- Escalation: [Name] - [Phone] - [Email]

**Vendor Support**:
- AWS Support: https://console.aws.amazon.com/support
- Firebase Support: https://firebase.google.com/support
- [Other vendors]

**Internal Contacts**:
- Development Team: dev-team@company.com
- Security Team: security@company.com
- Management: management@company.com

## Additional Resources

- [Setup Documentation](./SETUP_DOCUMENTATION.md)
- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)
- [Developer Guide](./DEVELOPER_GUIDE.md)
- [BigQuery Guide](./BIGQUERY_SETUP_GUIDE.md)
- [Cost Optimization Guide](./COST_OPTIMIZATION_GUIDE.md)

---

**For urgent issues, contact the on-call administrator immediately.**
