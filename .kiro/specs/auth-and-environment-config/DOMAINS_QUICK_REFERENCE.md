# Production Domains - Quick Reference

## Domain Overview

| Application | Domain | Purpose |
|------------|--------|---------|
| User App | https://www.journey-analytics.io | Public-facing application for end users |
| Analytics Dashboard | https://www.journey-analytics-admin.io | Internal analytics dashboard for authorized users |
| Backend API | https://api.journey-analytics.io | REST API for both frontend applications |

## Domain Configuration

### User App Domain: www.journey-analytics.io

**DNS Records**:
```
www.journey-analytics.io    A    ALIAS to CloudFront Distribution
journey-analytics.io        A    ALIAS to CloudFront Distribution (apex redirect)
```

**CloudFront Distribution**:
- Origin: S3 bucket `user-app-prod`
- SSL Certificate: ACM certificate in us-east-1
- Cache Behavior: 24 hour default TTL
- Custom Error Response: 404 → 200 /index.html (SPA routing)

**S3 Bucket**:
- Name: `user-app-prod`
- Purpose: Static hosting for React build
- Versioning: Enabled (for rollback)

**Environment Variables** (`.env.production`):
```bash
REACT_APP_API_BASE_URL=https://api.journey-analytics.io
REACT_APP_WS_URL=wss://api.journey-analytics.io/ws
```

### Analytics Dashboard Domain: www.journey-analytics-admin.io

**DNS Records**:
```
www.journey-analytics-admin.io    A    ALIAS to CloudFront Distribution
journey-analytics-admin.io        A    ALIAS to CloudFront Distribution (apex redirect)
```

**CloudFront Distribution**:
- Origin: S3 bucket `analytics-dashboard-prod`
- SSL Certificate: ACM certificate in us-east-1
- Cache Behavior: 24 hour default TTL
- Custom Error Response: 404 → 200 /index.html (SPA routing)

**S3 Bucket**:
- Name: `analytics-dashboard-prod`
- Purpose: Static hosting for React build
- Versioning: Enabled (for rollback)

**Environment Variables** (`.env.production`):
```bash
REACT_APP_API_BASE_URL=https://api.journey-analytics.io
REACT_APP_WS_URL=wss://api.journey-analytics.io/ws
REACT_APP_REQUIRE_ADMIN=true
```

### Backend API Domain: api.journey-analytics.io

**DNS Records**:
```
api.journey-analytics.io    A    ALIAS to Application Load Balancer
```

**Application Load Balancer**:
- Name: `user-journey-backend-alb`
- Listeners:
  - Port 443 (HTTPS) → Target Group
  - Port 80 (HTTP) → Redirect to HTTPS
- SSL Certificate: ACM certificate
- Health Check: `/actuator/health`

**Target Group**:
- Protocol: HTTP
- Port: 8080
- Targets: ECS/Fargate tasks
- Health Check Interval: 30 seconds

**ECS Service**:
- Cluster: `user-journey-cluster`
- Service: `backend-service`
- Task Definition: Spring Boot container
- Auto-scaling: 2-10 tasks

## CORS Configuration

The backend must allow requests from both frontend domains:

```yaml
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

## SSL/TLS Certificates

All certificates managed by AWS Certificate Manager (ACM):

| Domain | Certificate ARN | Region | Validation |
|--------|----------------|--------|------------|
| www.journey-analytics.io | arn:aws:acm:us-east-1:... | us-east-1 | DNS |
| www.journey-analytics-admin.io | arn:aws:acm:us-east-1:... | us-east-1 | DNS |
| api.journey-analytics.io | arn:aws:acm:us-east-1:... | us-east-1 | DNS |

**Note**: CloudFront certificates MUST be in us-east-1 region!

## Security Headers

All domains serve the following security headers:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com; ...
```

## Quick Commands

### Check DNS Resolution
```bash
dig www.journey-analytics.io
dig www.journey-analytics-admin.io
dig api.journey-analytics.io
```

### Test HTTPS Access
```bash
curl -I https://www.journey-analytics.io
curl -I https://www.journey-analytics-admin.io
curl https://api.journey-analytics.io/actuator/health
```

### Deploy User App
```bash
cd packages/user-app
npm run build
aws s3 sync build/ s3://user-app-prod --delete
aws cloudfront create-invalidation --distribution-id $USER_APP_DIST_ID --paths "/*"
```

### Deploy Analytics Dashboard
```bash
cd packages/analytics-dashboard
npm run build
aws s3 sync build/ s3://analytics-dashboard-prod --delete
aws cloudfront create-invalidation --distribution-id $DASHBOARD_DIST_ID --paths "/*"
```

### Deploy Backend
```bash
cd backend
mvn clean package -DskipTests
docker build -t user-journey-backend:latest .
docker tag user-journey-backend:latest $ECR_REGISTRY/user-journey-backend:latest
docker push $ECR_REGISTRY/user-journey-backend:latest
aws ecs update-service --cluster user-journey-cluster --service backend-service --force-new-deployment
```

### Check Backend Health
```bash
curl https://api.journey-analytics.io/actuator/health
```

### View Backend Logs
```bash
aws logs tail /ecs/backend-service --follow
```

### Check CloudFront Cache Hit Ratio
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name CacheHitRate \
  --dimensions Name=DistributionId,Value=$DIST_ID \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

## Monitoring URLs

- **CloudWatch Dashboard**: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=UserJourneyAnalytics
- **ECS Cluster**: https://console.aws.amazon.com/ecs/home?region=us-east-1#/clusters/user-journey-cluster
- **CloudFront Distributions**: https://console.aws.amazon.com/cloudfront/home
- **Route 53 Hosted Zones**: https://console.aws.amazon.com/route53/home#hosted-zones:
- **ALB**: https://console.aws.amazon.com/ec2/v2/home?region=us-east-1#LoadBalancers:

## Troubleshooting

### User App not loading
1. Check CloudFront distribution status
2. Verify S3 bucket has files
3. Check DNS resolution
4. Verify SSL certificate

### Analytics Dashboard not loading
1. Check CloudFront distribution status
2. Verify S3 bucket has files
3. Check DNS resolution
4. Verify SSL certificate

### API not responding
1. Check ALB target health
2. Check ECS task status
3. View backend logs
4. Verify security groups

### CORS errors
1. Verify CORS configuration in backend
2. Check allowed origins include production domains
3. Verify preflight OPTIONS requests succeed
4. Check CloudFront forwarding headers

## Important Notes

1. **DNS Propagation**: Can take 24-48 hours after initial setup
2. **Certificate Validation**: Usually takes 5-30 minutes
3. **CloudFront Deployment**: Takes 15-20 minutes to deploy changes
4. **Cache Invalidation**: Takes 5-10 minutes to complete
5. **ECS Deployment**: Takes 2-5 minutes for new tasks to start

## Contact Information

- **AWS Support**: https://console.aws.amazon.com/support
- **Domain Registrar**: [Your registrar support]
- **Team Slack**: #user-journey-ops
- **On-Call**: [On-call rotation details]

## Related Documentation

- Full Deployment Guide: `PRODUCTION_DEPLOYMENT_GUIDE.md`
- Architecture Details: `design.md` (Production Hosting Architecture section)
- Requirements: `requirements.md` (Requirements 12-20)
- Implementation Tasks: `tasks.md` (Tasks 13-21)
- Summary: `PRODUCTION_HOSTING_SUMMARY.md`
