# Production Deployment Checklist

## Pre-Deployment Checklist

### Infrastructure Preparation

- [ ] **AWS Account Setup**
  - [ ] AWS account created with appropriate permissions
  - [ ] IAM roles and policies configured
  - [ ] AWS CLI installed and configured
  - [ ] Credentials stored securely (AWS Secrets Manager)

- [ ] **Domain Registration**
  - [ ] journey-analytics.io registered
  - [ ] journey-analytics-admin.io registered
  - [ ] Route 53 hosted zones created
  - [ ] Nameservers updated at registrar
  - [ ] DNS propagation verified

- [ ] **SSL/TLS Certificates**
  - [ ] ACM certificates requested for both domains
  - [ ] DNS validation records created
  - [ ] Certificates validated and issued
  - [ ] Certificates attached to CloudFront distributions

- [ ] **Firebase Project**
  - [ ] Production Firebase project created
  - [ ] Firebase Authentication enabled
  - [ ] Firebase Analytics enabled
  - [ ] BigQuery export configured
  - [ ] Service account credentials downloaded
  - [ ] Authorized users created in Firebase Console

### Configuration Files

- [ ] **Environment Variables**
  - [ ] `.env.production` created for User App
  - [ ] `.env.production` created for Analytics Dashboard
  - [ ] `application-prod.yml` configured for backend
  - [ ] All placeholder values replaced with real credentials
  - [ ] Secrets stored in AWS Secrets Manager
  - [ ] Configuration validated with `scripts/validate-production-config.sh`

- [ ] **Authorized Users**
  - [ ] `authorized-users.yml` updated with production user emails
  - [ ] Users created in Firebase Console
  - [ ] User roles assigned correctly
  - [ ] Test credentials prepared for each role

- [ ] **CORS Configuration**
  - [ ] Production domains added to allowed origins
  - [ ] CORS headers configured in backend
  - [ ] CloudFront configured to forward headers

### Code Preparation

- [ ] **Code Review**
  - [ ] All features tested in development
  - [ ] Code reviewed and approved
  - [ ] No debug code or console.logs in production
  - [ ] All tests passing
  - [ ] Security audit completed

- [ ] **Dependencies**
  - [ ] All dependencies up to date
  - [ ] No known security vulnerabilities
  - [ ] Production dependencies only (no dev dependencies)

- [ ] **Build Verification**
  - [ ] Frontend builds successfully
  - [ ] Backend builds successfully
  - [ ] Docker images build successfully
  - [ ] No build warnings or errors

## Deployment Checklist

### Infrastructure Deployment

- [ ] **Deploy Infrastructure with CDK/Terraform**
  - [ ] VPC and networking deployed
  - [ ] ECS cluster created
  - [ ] Application Load Balancer deployed
  - [ ] S3 buckets created
  - [ ] CloudFront distributions created
  - [ ] Route 53 DNS records created
  - [ ] Security groups configured
  - [ ] IAM roles created

- [ ] **Verify Infrastructure**
  - [ ] All CloudFormation/Terraform stacks deployed successfully
  - [ ] No errors in deployment logs
  - [ ] Resources created as expected
  - [ ] Tags applied correctly

### Backend Deployment

- [ ] **Build Backend**
  - [ ] Maven build successful: `mvn clean package`
  - [ ] JAR file created
  - [ ] No test failures

- [ ] **Docker Image**
  - [ ] Docker image built
  - [ ] Image pushed to ECR
  - [ ] Image tagged correctly

- [ ] **Deploy to ECS**
  - [ ] ECS task definition updated
  - [ ] ECS service deployed
  - [ ] Tasks running successfully
  - [ ] Health checks passing

- [ ] **Verify Backend**
  - [ ] Backend health endpoint responding: `/actuator/health`
  - [ ] No errors in CloudWatch logs
  - [ ] Database connections working
  - [ ] AWS service connections working
  - [ ] Firebase connection working

### Frontend Deployment

- [ ] **Build User App**
  - [ ] Production build successful: `npm run build`
  - [ ] Build artifacts created
  - [ ] No build errors or warnings

- [ ] **Deploy User App**
  - [ ] Files uploaded to S3 bucket
  - [ ] Cache control headers set correctly
  - [ ] CloudFront cache invalidated
  - [ ] HTTPS working

- [ ] **Build Analytics Dashboard**
  - [ ] Production build successful: `npm run build`
  - [ ] Build artifacts created
  - [ ] No build errors or warnings

- [ ] **Deploy Analytics Dashboard**
  - [ ] Files uploaded to S3 bucket
  - [ ] Cache control headers set correctly
  - [ ] CloudFront cache invalidated
  - [ ] HTTPS working

### DNS Configuration

- [ ] **Verify DNS Records**
  - [ ] www.journey-analytics.io resolves correctly
  - [ ] journey-analytics.io resolves correctly
  - [ ] www.journey-analytics-admin.io resolves correctly
  - [ ] journey-analytics-admin.io resolves correctly
  - [ ] api.journey-analytics.io resolves to ALB

- [ ] **Test DNS Resolution**
  - [ ] `dig www.journey-analytics.io` returns correct IP
  - [ ] `dig www.journey-analytics-admin.io` returns correct IP
  - [ ] DNS propagation complete globally

### Security Configuration

- [ ] **WAF Rules**
  - [ ] WAF web ACL created
  - [ ] Rate limiting rules configured
  - [ ] SQL injection protection enabled
  - [ ] XSS protection enabled
  - [ ] WAF associated with CloudFront

- [ ] **Security Services**
  - [ ] CloudTrail enabled
  - [ ] GuardDuty enabled
  - [ ] AWS Config enabled
  - [ ] Security Hub enabled

- [ ] **Security Headers**
  - [ ] Content-Security-Policy configured
  - [ ] X-Frame-Options set to DENY
  - [ ] X-Content-Type-Options set to nosniff
  - [ ] Strict-Transport-Security configured
  - [ ] X-XSS-Protection enabled

### Monitoring Setup

- [ ] **CloudWatch**
  - [ ] Log groups created
  - [ ] Dashboards created
  - [ ] Alarms configured
  - [ ] SNS topics created
  - [ ] Email subscriptions confirmed

- [ ] **Metrics**
  - [ ] Application metrics flowing
  - [ ] Infrastructure metrics flowing
  - [ ] Custom metrics configured

- [ ] **Alerts**
  - [ ] High error rate alarm
  - [ ] High latency alarm
  - [ ] Unhealthy targets alarm
  - [ ] High CPU utilization alarm
  - [ ] High memory utilization alarm

### Backup Configuration

- [ ] **DynamoDB Backups**
  - [ ] Point-in-time recovery enabled
  - [ ] Daily backup plan created
  - [ ] Backup retention configured
  - [ ] Cross-region replication enabled

- [ ] **S3 Backups**
  - [ ] Versioning enabled
  - [ ] Lifecycle policies configured
  - [ ] Cross-region replication configured

## Testing Checklist

### Smoke Tests

- [ ] **Application Access**
  - [ ] https://www.journey-analytics.io loads
  - [ ] https://www.journey-analytics-admin.io loads
  - [ ] HTTP redirects to HTTPS
  - [ ] SSL certificates valid

- [ ] **API Health**
  - [ ] https://api.journey-analytics.io/actuator/health returns 200
  - [ ] API responds to requests
  - [ ] No CORS errors

### Authentication Tests

- [ ] **User App Authentication**
  - [ ] Login page loads
  - [ ] Can log in with admin credentials
  - [ ] Can log in with analyst credentials
  - [ ] Can log in with viewer credentials
  - [ ] JWT token stored correctly
  - [ ] Logout works correctly

- [ ] **Analytics Dashboard Authentication**
  - [ ] Login page loads
  - [ ] Admin can access all features
  - [ ] Analyst can access analytics features
  - [ ] Viewer cannot access analytics dashboard
  - [ ] Unauthorized users redirected to login

### Functional Tests

- [ ] **User App Features**
  - [ ] Calculator works
  - [ ] Video library loads and plays videos
  - [ ] Document upload works
  - [ ] Profile page loads
  - [ ] Navigation works

- [ ] **Analytics Dashboard Features**
  - [ ] Dashboard loads with metrics
  - [ ] Events stream shows real-time data
  - [ ] User journeys display correctly
  - [ ] Reports generate successfully
  - [ ] Export functionality works
  - [ ] Admin panel accessible (admin only)

### Integration Tests

- [ ] **Firebase Analytics**
  - [ ] Events tracked in User App
  - [ ] Events visible in Firebase Console
  - [ ] Debug View shows events (if enabled)
  - [ ] BigQuery export working

- [ ] **AWS Services**
  - [ ] DynamoDB reads/writes working
  - [ ] Kinesis stream receiving events
  - [ ] S3 file uploads working
  - [ ] SQS queues processing messages

### Performance Tests

- [ ] **Load Testing**
  - [ ] Application handles expected load
  - [ ] Auto-scaling triggers correctly
  - [ ] No performance degradation under load
  - [ ] Response times acceptable

- [ ] **Page Load Times**
  - [ ] User App loads in < 3 seconds
  - [ ] Analytics Dashboard loads in < 3 seconds
  - [ ] API responses in < 1 second
  - [ ] CloudFront cache hit ratio > 80%

### Security Tests

- [ ] **Security Scan**
  - [ ] OWASP ZAP scan completed
  - [ ] No critical vulnerabilities found
  - [ ] Security headers present
  - [ ] SSL/TLS configuration secure

- [ ] **Penetration Testing**
  - [ ] Authentication bypass attempts fail
  - [ ] SQL injection attempts blocked
  - [ ] XSS attempts blocked
  - [ ] CSRF protection working

## Post-Deployment Checklist

### Monitoring

- [ ] **First 24 Hours**
  - [ ] Monitor CloudWatch dashboards continuously
  - [ ] Review error logs every hour
  - [ ] Check alarm notifications
  - [ ] Monitor user feedback

- [ ] **First Week**
  - [ ] Daily review of metrics
  - [ ] Daily review of error logs
  - [ ] Monitor costs
  - [ ] Collect user feedback

### Documentation

- [ ] **Update Documentation**
  - [ ] Production URLs documented
  - [ ] Deployment process documented
  - [ ] Runbooks updated
  - [ ] Architecture diagrams updated

- [ ] **Team Training**
  - [ ] Operations team trained
  - [ ] Support team trained
  - [ ] On-call rotation established
  - [ ] Escalation procedures documented

### Communication

- [ ] **Stakeholder Notification**
  - [ ] Management notified of successful deployment
  - [ ] Users notified of new system
  - [ ] Support team notified
  - [ ] Documentation shared

- [ ] **User Communication**
  - [ ] Welcome email sent to users
  - [ ] User guide shared
  - [ ] Training sessions scheduled
  - [ ] Support contact information provided

## Rollback Plan

### Rollback Triggers

Rollback if:
- [ ] Critical errors in production
- [ ] Data loss or corruption
- [ ] Security breach detected
- [ ] Performance degradation > 50%
- [ ] More than 10% of users unable to access

### Rollback Procedure

- [ ] **Frontend Rollback**
  - [ ] Restore previous S3 version
  - [ ] Invalidate CloudFront cache
  - [ ] Verify rollback successful

- [ ] **Backend Rollback**
  - [ ] Deploy previous ECS task definition
  - [ ] Verify health checks passing
  - [ ] Monitor for errors

- [ ] **Database Rollback**
  - [ ] Restore from backup if needed
  - [ ] Verify data integrity
  - [ ] Test application functionality

- [ ] **Notification**
  - [ ] Notify stakeholders of rollback
  - [ ] Document reason for rollback
  - [ ] Plan remediation

## Sign-Off

### Deployment Team

- [ ] **Developer**: _________________ Date: _______
- [ ] **DevOps Engineer**: _________________ Date: _______
- [ ] **QA Engineer**: _________________ Date: _______
- [ ] **Security Engineer**: _________________ Date: _______

### Management Approval

- [ ] **Technical Lead**: _________________ Date: _______
- [ ] **Product Manager**: _________________ Date: _______
- [ ] **CTO/VP Engineering**: _________________ Date: _______

## Notes

Use this section to document any issues, deviations from the plan, or important observations during deployment:

```
[Add deployment notes here]
```

---

**Deployment Date**: _________________

**Deployment Time**: _________________

**Deployed By**: _________________

**Deployment Status**: ☐ Success ☐ Partial ☐ Failed ☐ Rolled Back
