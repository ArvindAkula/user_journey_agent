# Implementation Plan

- [x] 1. Set up authentication infrastructure
  - Create JWT service in backend for token generation and validation
  - Implement FirebaseAuthService for user verification
  - Create authorized users configuration file (authorized-users.yml)
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 2. Implement backend security layer
- [x] 2.1 Create JWT authentication filter
  - Implement JwtAuthenticationFilter to intercept requests
  - Extract and validate JWT tokens from Authorization header
  - Set authentication context for valid tokens
  - _Requirements: 1.3, 1.4, 7.2_

- [x] 2.2 Configure role-based access control
  - Update SecurityConfig with role-based endpoint protection
  - Define role hierarchy (ADMIN > ANALYST > VIEWER)
  - Configure method-level security annotations
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2.3 Implement authentication endpoints
  - Create AuthController with login, logout, refresh, and getCurrentUser endpoints
  - Implement login logic with Firebase token verification
  - Implement token refresh mechanism
  - Add logout functionality with token invalidation
  - _Requirements: 1.3, 1.4, 1.5, 7.1, 7.5, 8.1, 8.2_

- [x] 3. Create shared authentication components
- [x] 3.1 Build AuthService for frontend
  - Create AuthService in packages/shared/src/services/
  - Implement login, logout, refreshToken, and token management methods
  - Add token storage and retrieval logic
  - Implement authentication state checking
  - _Requirements: 1.1, 1.2, 1.3, 7.1, 7.4, 8.1, 8.2, 8.5_

- [x] 3.2 Create AuthContext provider
  - Implement AuthContext in packages/shared/src/contexts/
  - Create AuthProvider component with user state management
  - Add authentication state persistence
  - Implement automatic token refresh
  - _Requirements: 7.4, 8.4, 9.4_

- [x] 3.3 Build ProtectedRoute component
  - Create ProtectedRoute component in packages/shared/src/components/
  - Implement authentication checking
  - Add role-based access control
  - Handle redirect to login with return URL
  - _Requirements: 9.1, 9.2, 9.3, 9.5_

- [x] 3.4 Create LoginPage component
  - Build LoginPage component in packages/shared/src/components/
  - Implement email/password form
  - Add error handling and loading states
  - Implement redirect after successful login
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 3.5 Create UserMenu component
  - Build UserMenu component to display user info
  - Add logout button
  - Display user email and role
  - _Requirements: 8.3, 8.4, 8.5_

- [x] 4. Integrate authentication in User App
- [x] 4.1 Set up authentication in User App
  - Wrap User App with AuthProvider
  - Configure protected routes
  - Add LoginPage route
  - Integrate UserMenu in app header
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3_

- [x] 4.2 Protect User App routes
  - Wrap all main routes with ProtectedRoute
  - Configure role requirements for specific routes
  - Add unauthorized page
  - _Requirements: 9.1, 9.2, 9.3, 9.5_

- [x] 5. Integrate authentication in Analytics Dashboard
- [x] 5.1 Set up authentication in Analytics Dashboard
  - Wrap Analytics Dashboard with AuthProvider
  - Configure protected routes with role requirements
  - Add LoginPage route
  - Integrate UserMenu in dashboard header
  - _Requirements: 2.4, 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2_

- [x] 5.2 Protect Analytics Dashboard routes
  - Wrap all routes with ProtectedRoute requiring ANALYST or ADMIN role
  - Add admin-only routes requiring ADMIN role
  - Add unauthorized page
  - _Requirements: 2.4, 2.5, 9.1, 9.2, 9.3, 9.5_

- [x] 6. Implement environment configuration system
- [x] 6.1 Create environment detection utilities
  - Create EnvironmentManager in packages/shared/src/config/
  - Implement environment detection based on NODE_ENV
  - Create environment-specific configuration loading
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 10.4_

- [x] 6.2 Set up frontend environment configurations
  - Create .env.development files for User App and Analytics Dashboard
  - Create .env.production files for User App and Analytics Dashboard
  - Configure API endpoints for each environment
  - Configure Firebase settings for each environment
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 10.1, 10.4_

- [x] 6.3 Create backend Spring profiles
  - Create application-dev.yml for development configuration
  - Create application-prod.yml for production configuration
  - Configure AWS service endpoints for each profile
  - Configure Firebase settings for each profile
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 5.5, 5.6, 10.1, 10.2, 10.3_

- [x] 6.4 Implement environment-aware AWS configuration
  - Update AwsConfig to support dev and prod profiles
  - Create dev profile beans connecting to LocalStack
  - Create prod profile beans connecting to actual AWS services
  - Add environment logging on startup
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 10.2, 10.3, 10.5_

- [x] 6.5 Implement environment-aware Firebase configuration
  - Update Firebase initialization to support emulator in dev mode
  - Configure Firebase Auth emulator connection
  - Configure production Firebase Auth connection
  - _Requirements: 3.3, 3.4, 4.3, 4.4_

- [x] 7. Set up development environment tools
- [x] 7.1 Configure LocalStack for development
  - Create LocalStack docker-compose configuration
  - Configure LocalStack services (DynamoDB, Kinesis, S3, SQS)
  - Create initialization scripts for LocalStack
  - Document LocalStack setup and usage
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 10.2_

- [x] 7.2 Configure Firebase emulator for development
  - Set up Firebase emulator configuration
  - Create test users in Firebase emulator
  - Document Firebase emulator setup and usage
  - _Requirements: 3.3, 3.4_

- [x] 7.3 Create development startup scripts
  - Create script to start LocalStack
  - Create script to start Firebase emulator
  - Create script to start backend in dev mode
  - Create script to start frontends in dev mode
  - Create all-in-one development startup script
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3, 5.4_

- [x] 8. Implement secure credential management
- [x] 8.1 Set up environment variable validation
  - Create environment variable validation on backend startup
  - Create environment variable validation on frontend startup
  - Implement fail-fast behavior for missing required variables
  - Add detailed error messages for missing variables
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [x] 8.2 Create environment templates
  - Create .env.development.template with placeholder values
  - Create .env.production.template with placeholder values
  - Update .gitignore to exclude actual .env files
  - Document required environment variables
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 8.3 Implement encryption for sensitive data
  - Update DataEncryptionService to use environment-specific encryption keys
  - Implement secure key storage
  - Add encryption for JWT secrets
  - _Requirements: 6.4_

- [x] 9. Move Firebase integration from /frontend to /user-app
- [x] 9.1 Migrate Firebase SDK to User App
  - Move Firebase initialization from /frontend to /user-app
  - Update Firebase configuration in User App
  - Remove Firebase dependencies from /frontend
  - _Requirements: 11.1, 11.6_

- [x] 9.2 Implement Firebase Analytics service
  - Create FirebaseAnalyticsService in packages/user-app/src/services/
  - Implement event tracking methods (page views, custom events)
  - Implement calculator event tracking
  - Implement video engagement tracking
  - Add user properties and user ID setting
  - _Requirements: 11.1, 11.2, 11.6, 11.8_

- [x] 9.3 Integrate Firebase Analytics in User App
  - Add Firebase Analytics tracking to all pages
  - Track calculator interactions
  - Track video engagement events
  - Track document upload events
  - Track navigation and user flows
  - _Requirements: 11.1, 11.2, 11.8_

- [x] 9.4 Configure Firebase Analytics Debug View
  - Enable debug mode for development environment
  - Document how to use Firebase Analytics Debug View
  - _Requirements: 11.7_

- [x] 10. Set up BigQuery integration
- [x] 10.1 Configure Firebase Analytics BigQuery export
  - Enable BigQuery export in Firebase console
  - Configure daily export schedule
  - Verify BigQuery dataset creation
  - _Requirements: 11.3_

- [x] 10.2 Create BigQuery analytics service
  - Create BigQueryAnalyticsService in backend
  - Implement historical event queries
  - Implement user journey analysis queries
  - Implement event count aggregation queries
  - Add error handling and retry logic
  - _Requirements: 11.4, 11.9_

- [x] 10.3 Update Analytics Dashboard to use BigQuery
  - Integrate BigQueryAnalyticsService in backend controllers
  - Update Analytics Dashboard API calls for historical data
  - Keep real-time queries on DynamoDB
  - Add loading states for BigQuery queries
  - _Requirements: 11.4, 11.9_

- [x] 10.4 Implement dual-write strategy
  - Configure events to write to both DynamoDB and Firebase Analytics
  - Add feature flag to control dual-write behavior
  - Monitor data consistency between systems
  - _Requirements: 11.5_

- [x] 10.5 Optimize event storage strategy
  - Identify critical real-time events for DynamoDB
  - Configure non-critical events to Firebase Analytics only
  - Update event routing logic
  - Document event storage strategy
  - _Requirements: 11.5_

- [x] 11. Testing and validation
- [x] 11.1 Write authentication unit tests
  - Test JWT token generation and validation
  - Test Firebase Auth integration
  - Test role-based access control
  - Test login/logout flows
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 11.2 Write environment configuration unit tests
  - Test environment detection
  - Test configuration loading
  - Test service endpoint resolution
  - Test AWS client initialization
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 10.1, 10.2, 10.3_

- [x] 11.3 Write Firebase Analytics unit tests
  - Test event tracking methods
  - Test user property setting
  - Test environment-specific configuration
  - _Requirements: 11.1, 11.2, 11.6, 11.7, 11.8_

- [x] 11.4 Write integration tests
  - Test end-to-end authentication flow
  - Test environment switching
  - Test role-based access
  - Test Firebase Analytics event flow
  - Test BigQuery data retrieval
  - _Requirements: All requirements_

- [x] 11.5 Perform manual testing
  - Test development mode with LocalStack and Firebase emulator
  - Test production mode with actual services
  - Test all three user roles (admin, analyst, viewer)
  - Test Firebase Analytics Debug View
  - Verify BigQuery data export
  - _Requirements: All requirements_

- [x] 12. Documentation and deployment
- [x] 12.1 Create setup documentation
  - Document development environment setup
  - Document production environment setup
  - Document authorized user configuration
  - Document Firebase Analytics setup
  - Document BigQuery configuration
  - _Requirements: All requirements_

- [x] 12.2 Create user guides
  - Create user guide for logging in
  - Create admin guide for managing users
  - Create developer guide for environment switching
  - Create analytics guide for BigQuery queries
  - _Requirements: All requirements_

- [x] 12.3 Update deployment scripts
  - Update deployment scripts for environment configuration
  - Add environment validation to deployment process
  - Create production deployment checklist
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.5_

- [x] 12.4 Document cost optimization
  - Document cost comparison between DynamoDB and BigQuery
  - Create cost monitoring dashboard
  - Document cost optimization best practices
  - _Requirements: 11.10_

- [x] 12.5 Create migration guide
  - Document Firebase Analytics migration steps
  - Create data validation procedures
  - Document rollback procedures
  - _Requirements: 11.3, 11.4, 11.5_

- [ ] 13. Set up production domain infrastructure
- [ ] 13.1 Register and configure domains
  - Register journey-analytics.io domain
  - Register journey-analytics-admin.io domain
  - Create Route 53 hosted zones for both domains
  - Update domain nameservers to Route 53
  - _Requirements: 12.1, 12.2, 13.1, 13.2_

- [ ] 13.2 Provision SSL/TLS certificates
  - Request ACM certificate for www.journey-analytics.io
  - Request ACM certificate for www.journey-analytics-admin.io
  - Configure DNS validation for certificates
  - Verify certificate issuance
  - _Requirements: 12.3, 12.4, 12.5_

- [ ] 13.3 Create S3 buckets for static hosting
  - Create S3 bucket for User App (user-app-prod)
  - Create S3 bucket for Analytics Dashboard (analytics-dashboard-prod)
  - Configure bucket policies for CloudFront access
  - Enable versioning for rollback capability
  - _Requirements: 12.1, 12.2_

- [ ] 13.4 Set up CloudFront distributions
  - Create CloudFront distribution for User App
  - Create CloudFront distribution for Analytics Dashboard
  - Configure custom domain names (CNAMEs)
  - Attach SSL certificates to distributions
  - Configure cache behaviors and TTLs
  - Set up custom error responses for SPA routing
  - _Requirements: 12.1, 12.2, 12.3, 14.1, 14.2, 14.3, 14.5_

- [ ] 13.5 Configure DNS records
  - Create A record for www.journey-analytics.io pointing to CloudFront
  - Create A record for journey-analytics.io (apex) pointing to CloudFront
  - Create A record for www.journey-analytics-admin.io pointing to CloudFront
  - Create A record for journey-analytics-admin.io (apex) pointing to CloudFront
  - Verify DNS propagation
  - _Requirements: 13.1, 13.2, 13.3_

- [ ] 14. Deploy backend infrastructure
- [ ] 14.1 Create VPC and networking
  - Create VPC with public and private subnets
  - Configure Internet Gateway and NAT Gateways
  - Set up route tables
  - Configure security groups for backend services
  - _Requirements: 15.1, 15.2_

- [ ] 14.2 Set up Application Load Balancer
  - Create Application Load Balancer in public subnets
  - Configure HTTPS listener with SSL certificate
  - Configure HTTP to HTTPS redirect
  - Create target group for backend services
  - Configure health checks (/actuator/health)
  - _Requirements: 12.3, 15.1, 15.2, 15.3_

- [ ] 14.3 Deploy ECS cluster and services
  - Create ECS cluster for backend services
  - Create ECR repository for backend Docker images
  - Create ECS task definition for backend
  - Create ECS service with auto-scaling
  - Configure service discovery
  - _Requirements: 15.1, 15.4_

- [ ] 14.4 Configure auto-scaling policies
  - Set up CPU-based auto-scaling (target 70%)
  - Set up memory-based auto-scaling (target 80%)
  - Set up request count-based auto-scaling
  - Configure min capacity (2) and max capacity (10)
  - _Requirements: 15.4_

- [ ] 14.5 Set up API domain and routing
  - Register api.journey-analytics.io subdomain
  - Create Route 53 A record pointing to ALB
  - Configure ALB listener rules for API routing
  - _Requirements: 17.1, 17.2_

- [ ] 15. Configure production environment variables
- [ ] 15.1 Create backend production configuration
  - Update application-production.yml with production settings
  - Configure AWS service endpoints (remove LocalStack endpoints)
  - Set up production database connections
  - Configure production Firebase settings
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 17.3_

- [ ] 15.2 Create User App production environment file
  - Create .env.production for User App
  - Set REACT_APP_API_BASE_URL to https://api.journey-analytics.io
  - Configure production Firebase credentials
  - Set production feature flags
  - _Requirements: 12.1, 17.1, 17.4_

- [ ] 15.3 Create Analytics Dashboard production environment file
  - Create .env.production for Analytics Dashboard
  - Set REACT_APP_API_BASE_URL to https://api.journey-analytics-admin.io
  - Configure production Firebase credentials
  - Set production feature flags
  - Enable admin-only features
  - _Requirements: 12.2, 17.2, 17.4_

- [ ] 15.4 Configure CORS for production domains
  - Update CORS configuration in application-production.yml
  - Add https://www.journey-analytics.io to allowed origins
  - Add https://www.journey-analytics-admin.io to allowed origins
  - Configure allowed methods and headers
  - Enable credentials support
  - _Requirements: 16.2, 16.3, 16.4_

- [ ] 16. Implement security configurations
- [ ] 16.1 Configure security headers
  - Implement CloudFront response headers policy
  - Add Content-Security-Policy header
  - Add X-Frame-Options header (DENY)
  - Add X-Content-Type-Options header (nosniff)
  - Add Strict-Transport-Security header (HSTS)
  - Add X-XSS-Protection header
  - _Requirements: 12.3, 16.1, 16.5_

- [ ] 16.2 Set up WAF rules
  - Create WAF web ACL for CloudFront distributions
  - Add rate limiting rules
  - Add geo-blocking rules if needed
  - Add SQL injection protection
  - Add XSS protection rules
  - _Requirements: 16.1, 16.4_

- [ ] 16.3 Configure security groups
  - Create security group for ALB (allow 80, 443 from internet)
  - Create security group for ECS tasks (allow 8080 from ALB only)
  - Create security group for RDS if applicable
  - Implement least privilege access
  - _Requirements: 16.1_

- [ ] 16.4 Enable AWS security services
  - Enable CloudTrail for audit logging
  - Enable GuardDuty for threat detection
  - Enable AWS Config for compliance monitoring
  - Configure AWS Secrets Manager for sensitive data
  - _Requirements: 6.1, 6.4, 19.1_

- [ ] 17. Set up monitoring and logging
- [ ] 17.1 Configure CloudWatch Logs
  - Create log groups for backend application
  - Create log groups for ECS tasks
  - Create log groups for ALB access logs
  - Configure log retention (30 days)
  - Set up log insights queries
  - _Requirements: 19.1, 19.4_

- [ ] 17.2 Create CloudWatch dashboards
  - Create dashboard for application metrics
  - Create dashboard for infrastructure metrics
  - Add widgets for error rates, latency, throughput
  - Add widgets for CPU, memory, network usage
  - _Requirements: 19.5_

- [ ] 17.3 Configure CloudWatch alarms
  - Create alarm for high error rate (>5%)
  - Create alarm for high latency (>1s)
  - Create alarm for unhealthy targets
  - Create alarm for high CPU utilization (>80%)
  - Create alarm for high memory utilization (>80%)
  - _Requirements: 19.2, 19.3_

- [ ] 17.4 Set up SNS notifications
  - Create SNS topic for critical alarms
  - Subscribe email addresses to SNS topic
  - Configure alarm actions to publish to SNS
  - Test notification delivery
  - _Requirements: 19.3_

- [ ] 17.5 Enable X-Ray tracing
  - Enable X-Ray on ECS tasks
  - Configure X-Ray daemon
  - Add X-Ray SDK to backend application
  - Create service map visualization
  - _Requirements: 19.5_

- [ ] 18. Implement backup and disaster recovery
- [ ] 18.1 Configure DynamoDB backups
  - Enable point-in-time recovery on all tables
  - Create daily backup plan
  - Configure backup retention (30 days)
  - Set up cross-region replication
  - _Requirements: 20.1, 20.2, 20.3_

- [ ] 18.2 Configure S3 backups
  - Enable versioning on S3 buckets
  - Configure lifecycle policies
  - Set up cross-region replication for critical buckets
  - _Requirements: 20.1, 20.3_

- [ ] 18.3 Create disaster recovery procedures
  - Document backup restoration procedures
  - Document failover procedures
  - Create runbooks for common scenarios
  - Test disaster recovery procedures
  - _Requirements: 20.4, 20.5_

- [ ] 19. Create deployment automation
- [ ] 19.1 Write infrastructure as code
  - Create CDK stack for VPC and networking
  - Create CDK stack for ECS cluster and services
  - Create CDK stack for ALB and target groups
  - Create CDK stack for S3 and CloudFront
  - Create CDK stack for Route 53 and certificates
  - _Requirements: 18.1, 18.2, 18.3_

- [ ] 19.2 Create deployment scripts
  - Create script to build backend Docker image
  - Create script to push image to ECR
  - Create script to update ECS service
  - Create script to build and deploy User App
  - Create script to build and deploy Analytics Dashboard
  - _Requirements: 18.2, 18.4_

- [ ] 19.3 Set up CI/CD pipeline
  - Create GitHub Actions workflow for infrastructure deployment
  - Create GitHub Actions workflow for backend deployment
  - Create GitHub Actions workflow for User App deployment
  - Create GitHub Actions workflow for Analytics Dashboard deployment
  - Configure deployment approvals for production
  - _Requirements: 18.2, 18.4_

- [ ] 19.4 Implement blue-green deployment
  - Configure ECS service for blue-green deployments
  - Set up CodeDeploy for automated rollback
  - Test deployment rollback procedures
  - _Requirements: 18.4_

- [ ] 20. Production deployment and validation
- [ ] 20.1 Deploy infrastructure
  - Deploy VPC and networking stack
  - Deploy ECS cluster and services stack
  - Deploy ALB and target groups stack
  - Deploy S3 and CloudFront stack
  - Deploy Route 53 and certificates stack
  - Verify all resources are created successfully
  - _Requirements: 18.1, 18.2, 18.3_

- [ ] 20.2 Deploy backend application
  - Build backend Docker image
  - Push image to ECR
  - Update ECS task definition
  - Deploy new ECS service revision
  - Verify backend health checks pass
  - _Requirements: 17.1, 17.2_

- [ ] 20.3 Deploy frontend applications
  - Build User App production bundle
  - Deploy User App to S3 bucket
  - Invalidate CloudFront cache for User App
  - Build Analytics Dashboard production bundle
  - Deploy Analytics Dashboard to S3 bucket
  - Invalidate CloudFront cache for Analytics Dashboard
  - _Requirements: 12.1, 12.2_

- [ ] 20.4 Verify DNS and SSL
  - Verify DNS records are resolving correctly
  - Test https://www.journey-analytics.io loads successfully
  - Test https://www.journey-analytics-admin.io loads successfully
  - Verify SSL certificates are valid
  - Test HTTP to HTTPS redirect
  - _Requirements: 12.3, 13.3_

- [ ] 20.5 Test production functionality
  - Test user authentication flow on User App
  - Test user authentication flow on Analytics Dashboard
  - Test API endpoints from both frontends
  - Verify CORS configuration works
  - Test role-based access control
  - Verify Firebase Analytics integration
  - _Requirements: All requirements_

- [ ] 20.6 Performance and security testing
  - Run load tests on production infrastructure
  - Verify auto-scaling triggers correctly
  - Test page load times from multiple locations
  - Run security scan (OWASP ZAP or similar)
  - Verify security headers are present
  - Test WAF rules
  - _Requirements: 14.4, 15.5, 16.1_

- [ ] 20.7 Monitor and optimize
  - Monitor CloudWatch metrics for 24 hours
  - Review application logs for errors
  - Optimize CloudFront cache hit ratio
  - Tune auto-scaling thresholds if needed
  - Document any issues and resolutions
  - _Requirements: 19.1, 19.2, 19.5_

- [ ] 21. Create production documentation
- [ ] 21.1 Document production architecture
  - Create architecture diagrams
  - Document all AWS resources and their purposes
  - Document network topology
  - Document security configurations
  - _Requirements: All requirements_

- [ ] 21.2 Create operational runbooks
  - Create runbook for deployment procedures
  - Create runbook for scaling operations
  - Create runbook for incident response
  - Create runbook for backup and restore
  - Create runbook for disaster recovery
  - _Requirements: 20.4, 20.5_

- [ ] 21.3 Document domain and DNS configuration
  - Document domain registrar details
  - Document Route 53 hosted zone configuration
  - Document DNS records and their purposes
  - Document SSL certificate renewal process
  - _Requirements: 12.4, 12.5, 13.1, 13.2, 13.5_

- [ ] 21.4 Create monitoring and alerting guide
  - Document CloudWatch dashboards and their metrics
  - Document alarm thresholds and their rationale
  - Document escalation procedures
  - Document on-call rotation if applicable
  - _Requirements: 19.2, 19.3, 19.5_

- [ ] 21.5 Document cost optimization strategies
  - Document current infrastructure costs
  - Document cost optimization opportunities
  - Create cost monitoring dashboard
  - Document reserved instance recommendations
  - _Requirements: 14.1, 14.2, 14.3_
