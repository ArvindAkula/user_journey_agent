# Firebase Analytics Migration Guide

## Overview

This guide provides step-by-step instructions for migrating from a DynamoDB-only event storage approach to an optimized architecture using Firebase Analytics with BigQuery export. This migration reduces costs by 60-70% while maintaining full analytics capabilities.

## Migration Strategy

### Phased Approach

The migration follows a safe, phased approach:

1. **Phase 1: Dual-Write** (Week 1-2)
   - Write events to both DynamoDB and Firebase Analytics
   - Validate data consistency
   - No risk to existing functionality

2. **Phase 2: Gradual Transition** (Week 3-4)
   - Move historical queries to BigQuery
   - Keep real-time queries on DynamoDB
   - Monitor performance and costs

3. **Phase 3: Optimization** (Week 5+)
   - Route non-critical events to Firebase only
   - Keep critical events in DynamoDB
   - Achieve full cost savings

4. **Phase 4: Cleanup** (Week 6+)
   - Archive old DynamoDB data
   - Remove unused tables
   - Document new architecture

## Prerequisites

Before starting the migration:

- [ ] Firebase Analytics enabled in Firebase Console
- [ ] BigQuery export configured
- [ ] Service account credentials downloaded
- [ ] Backend updated with BigQuery integration
- [ ] All tests passing
- [ ] Backup of current DynamoDB data

## Phase 1: Enable Dual-Write

### Step 1.1: Update Backend Configuration

**File**: `backend/src/main/resources/application-prod.yml`

```yaml
# Enable dual-write mode
dual-write:
  enabled: true
  log-discrepancies: true

# Firebase Analytics configuration
firebase:
  analytics:
    enabled: true
    
# BigQuery configuration
bigquery:
  enabled: true
  project-id: ${FIREBASE_PROJECT_ID}
  dataset-id: analytics_${ANALYTICS_PROPERTY_ID}
  credentials-path: ${FIREBASE_CREDENTIALS_PATH}
```

### Step 1.2: Deploy Backend Changes

```bash
cd backend

# Build with dual-write enabled
mvn clean package

# Deploy to production
# (Follow your deployment process)
```

### Step 1.3: Verify Dual-Write

```bash
# Check backend logs for dual-write confirmation
aws logs tail /ecs/backend-service --follow | grep "dual-write"

# Expected output:
# [INFO] Dual-write mode enabled
# [INFO] Event written to DynamoDB: page_view
# [INFO] Event written to Firebase Analytics: page_view
```

### Step 1.4: Monitor for 48 Hours

Monitor both systems to ensure data is being written correctly:

**DynamoDB**:
```bash
aws dynamodb scan \
  --table-name user-events \
  --select COUNT \
  --endpoint-url https://dynamodb.us-east-1.amazonaws.com
```

**Firebase Analytics**:
1. Go to Firebase Console > Analytics > Events
2. Verify events are appearing
3. Check event counts match DynamoDB

### Step 1.5: Validate Data Consistency

Run validation queries to ensure data matches:

```java
// Backend validation service
@Service
public class MigrationValidationService {
    
    public ValidationResult validateDataConsistency(LocalDate date) {
        // Get counts from DynamoDB
        long dynamoCount = dynamoDbService.getEventCount(date);
        
        // Get counts from BigQuery (after 24-48 hours)
        long bigQueryCount = bigQueryService.getEventCount(date);
        
        // Compare
        double discrepancy = Math.abs(dynamoCount - bigQueryCount) / (double) dynamoCount;
        
        return new ValidationResult(
            dynamoCount,
            bigQueryCount,
            discrepancy < 0.05  // Allow 5% discrepancy
        );
    }
}
```

**Expected Results**:
- Event counts should match within 5%
- Event types should be identical
- User IDs should match
- Timestamps should be consistent

## Phase 2: Transition Historical Queries

### Step 2.1: Update Analytics Dashboard

Update the Analytics Dashboard to use BigQuery for historical data:

**File**: `packages/analytics-dashboard/src/services/AnalyticsService.ts`

```typescript
class AnalyticsService {
  async getHistoricalEvents(userId: string, startDate: string, endDate: string) {
    // Use BigQuery for historical data (> 7 days old)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    if (new Date(endDate) < sevenDaysAgo) {
      // Use BigQuery
      return bigQueryService.getUserHistoricalEvents(userId, startDate, endDate);
    } else {
      // Use DynamoDB for recent data
      return dynamoDbService.getUserEvents(userId, startDate, endDate);
    }
  }
}
```

### Step 2.2: Deploy Dashboard Changes

```bash
cd packages/analytics-dashboard

# Build with BigQuery integration
npm run build

# Deploy to S3
aws s3 sync build/ s3://analytics-dashboard-prod --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $DASHBOARD_DIST_ID \
  --paths "/*"
```

### Step 2.3: Test Historical Queries

Test various historical queries:

```typescript
// Test 1: User journey analysis (30 days)
const journey = await analyticsService.getUserJourney(
  'user123',
  '2025-01-01',
  '2025-01-31'
);

// Test 2: Event aggregations (90 days)
const aggregations = await analyticsService.getEventAggregations(
  '2024-11-01',
  '2025-01-31'
);

// Test 3: Calculator statistics (7 days)
const stats = await analyticsService.getCalculatorStatistics(
  '2025-01-24',
  '2025-01-31'
);
```

### Step 2.4: Monitor Query Performance

Compare query performance:

```bash
# DynamoDB query time
time aws dynamodb query \
  --table-name user-events \
  --key-condition-expression "userId = :userId" \
  --expression-attribute-values '{":userId":{"S":"user123"}}'

# BigQuery query time
time bq query --use_legacy_sql=false '
SELECT * FROM `project.analytics_123456789.events_*`
WHERE user_pseudo_id = "user123"
AND _TABLE_SUFFIX BETWEEN "20250101" AND "20250131"
'
```

**Expected Results**:
- BigQuery queries should be comparable or faster
- No errors in application logs
- Users report no issues

## Phase 3: Enable Event Routing Optimization

### Step 3.1: Configure Event Routing

**File**: `backend/src/main/resources/application-prod.yml`

```yaml
# Enable event storage optimization
event-storage:
  optimization-enabled: true
  
# Define critical event types (stored in DynamoDB + Firebase)
critical-events:
  - struggle_signal
  - error
  - exit_intent
  - intervention_triggered
  - intervention_completed
  - session_start
  - session_end
  - profile_updated
  
# Non-critical events (stored in Firebase only)
# - page_view
# - navigation
# - calculator_interaction
# - video_engagement
# - document_upload
```

### Step 3.2: Deploy Optimized Configuration

```bash
cd backend

# Build with optimization enabled
mvn clean package

# Deploy to production
# (Follow your deployment process)
```

### Step 3.3: Monitor Event Routing

```bash
# Check logs for routing decisions
aws logs tail /ecs/backend-service --follow | grep "event-routing"

# Expected output:
# [INFO] Event 'page_view' routed to Firebase only
# [INFO] Event 'struggle_signal' routed to DynamoDB + Firebase
```

### Step 3.4: Verify Cost Reduction

Monitor costs after optimization:

```bash
# Check DynamoDB costs
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-31 \
  --granularity DAILY \
  --metrics BlendedCost \
  --filter file://dynamodb-filter.json

# Check BigQuery costs
# Go to BigQuery Console > View billing
```

**Expected Results**:
- DynamoDB write requests reduced by 70-80%
- DynamoDB storage reduced by 60-70%
- BigQuery costs minimal (< $5/month for typical usage)
- Total cost reduction: 60-70%

## Phase 4: Cleanup and Optimization

### Step 4.1: Archive Old DynamoDB Data

```bash
# Export old data to S3
aws dynamodb export-table-to-point-in-time \
  --table-arn arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/user-events \
  --s3-bucket user-events-archive \
  --s3-prefix archive-2024/ \
  --export-format DYNAMODB_JSON

# Wait for export to complete
aws dynamodb describe-export \
  --export-arn <EXPORT_ARN>
```

### Step 4.2: Delete Old Data from DynamoDB

```bash
# Delete items older than 30 days
# Use TTL or batch delete script

# Enable TTL on table
aws dynamodb update-time-to-live \
  --table-name user-events \
  --time-to-live-specification \
    "Enabled=true, AttributeName=ttl"
```

### Step 4.3: Disable Dual-Write

Once confident in the migration:

**File**: `backend/src/main/resources/application-prod.yml`

```yaml
# Disable dual-write mode
dual-write:
  enabled: false
```

### Step 4.4: Update Documentation

Update all documentation to reflect new architecture:

- [ ] Architecture diagrams
- [ ] API documentation
- [ ] Runbooks
- [ ] Cost estimates
- [ ] Monitoring dashboards

## Data Validation Procedures

### Validation Checklist

Run these validations after each phase:

- [ ] **Event Count Validation**
  ```sql
  -- BigQuery
  SELECT COUNT(*) FROM `project.analytics_123456789.events_*`
  WHERE _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', CURRENT_DATE() - 1);
  ```
  
  ```bash
  # DynamoDB
  aws dynamodb scan --table-name user-events --select COUNT
  ```

- [ ] **Event Type Distribution**
  ```sql
  -- BigQuery
  SELECT event_name, COUNT(*) as count
  FROM `project.analytics_123456789.events_*`
  WHERE _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', CURRENT_DATE() - 1)
  GROUP BY event_name
  ORDER BY count DESC;
  ```

- [ ] **User Journey Completeness**
  - Verify all events for sample users exist
  - Check event ordering is correct
  - Validate timestamps are accurate

- [ ] **Critical Events in DynamoDB**
  - Verify struggle signals are in DynamoDB
  - Check intervention events are stored
  - Validate real-time access works

### Automated Validation Script

```bash
#!/bin/bash
# validate-migration.sh

echo "Running migration validation..."

# Get yesterday's date
YESTERDAY=$(date -d '1 day ago' +%Y%m%d)

# Count events in BigQuery
BQ_COUNT=$(bq query --use_legacy_sql=false --format=csv \
  "SELECT COUNT(*) FROM \`project.analytics_123456789.events_*\` 
   WHERE _TABLE_SUFFIX = '$YESTERDAY'" | tail -n 1)

# Count events in DynamoDB (if dual-write enabled)
DYNAMO_COUNT=$(aws dynamodb scan \
  --table-name user-events \
  --filter-expression "begins_with(#date, :date)" \
  --expression-attribute-names '{"#date":"date"}' \
  --expression-attribute-values "{\":date\":{\"S\":\"$YESTERDAY\"}}" \
  --select COUNT \
  --query 'Count' \
  --output text)

echo "BigQuery events: $BQ_COUNT"
echo "DynamoDB events: $DYNAMO_COUNT"

# Calculate discrepancy
DISCREPANCY=$(echo "scale=2; ($BQ_COUNT - $DYNAMO_COUNT) / $DYNAMO_COUNT * 100" | bc)

echo "Discrepancy: $DISCREPANCY%"

if (( $(echo "$DISCREPANCY < 5" | bc -l) )); then
  echo "✅ Validation passed"
  exit 0
else
  echo "❌ Validation failed: discrepancy too high"
  exit 1
fi
```

## Rollback Procedures

### Rollback Triggers

Rollback if:
- Data loss detected (> 5% discrepancy)
- Critical errors in production
- Performance degradation
- User-reported issues

### Rollback Steps

#### From Phase 3 (Optimization) to Phase 2

```yaml
# Disable optimization
event-storage:
  optimization-enabled: false
```

Redeploy backend.

#### From Phase 2 (BigQuery Queries) to Phase 1

```typescript
// Revert to DynamoDB for all queries
class AnalyticsService {
  async getHistoricalEvents(userId: string, startDate: string, endDate: string) {
    // Use DynamoDB for all queries
    return dynamoDbService.getUserEvents(userId, startDate, endDate);
  }
}
```

Redeploy dashboard.

#### From Phase 1 (Dual-Write) to Original

```yaml
# Disable dual-write
dual-write:
  enabled: false

# Disable Firebase Analytics
firebase:
  analytics:
    enabled: false

# Disable BigQuery
bigquery:
  enabled: false
```

Redeploy backend.

### Data Recovery

If data loss occurs:

1. **Stop all writes**:
   ```bash
   # Scale down backend to 0
   aws ecs update-service \
     --cluster user-journey-cluster \
     --service backend-service \
     --desired-count 0
   ```

2. **Restore from backup**:
   ```bash
   # Restore DynamoDB from backup
   aws dynamodb restore-table-from-backup \
     --target-table-name user-events \
     --backup-arn <BACKUP_ARN>
   ```

3. **Verify data integrity**:
   - Run validation queries
   - Check event counts
   - Verify user journeys

4. **Resume operations**:
   ```bash
   # Scale backend back up
   aws ecs update-service \
     --cluster user-journey-cluster \
     --service backend-service \
     --desired-count 2
   ```

## Monitoring During Migration

### Key Metrics to Monitor

1. **Event Counts**:
   - DynamoDB write requests
   - Firebase Analytics events
   - BigQuery table sizes

2. **Error Rates**:
   - Backend error logs
   - Failed writes
   - Query failures

3. **Performance**:
   - Query response times
   - API latency
   - User-reported issues

4. **Costs**:
   - DynamoDB costs
   - BigQuery costs
   - Data transfer costs

### CloudWatch Alarms

Create alarms for:

```bash
# High error rate
aws cloudwatch put-metric-alarm \
  --alarm-name migration-high-error-rate \
  --metric-name Errors \
  --namespace UserJourneyAnalytics \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold

# Data discrepancy
aws cloudwatch put-metric-alarm \
  --alarm-name migration-data-discrepancy \
  --metric-name DataDiscrepancy \
  --namespace UserJourneyAnalytics \
  --statistic Average \
  --period 3600 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold
```

## Post-Migration Checklist

After completing the migration:

- [ ] All validation tests passing
- [ ] Cost reduction achieved (60-70%)
- [ ] No user-reported issues
- [ ] Performance metrics stable
- [ ] Documentation updated
- [ ] Team trained on new architecture
- [ ] Monitoring dashboards updated
- [ ] Runbooks updated
- [ ] Old data archived
- [ ] Cleanup completed

## Troubleshooting

### Issue: Events Not Appearing in Firebase

**Symptoms**: Events sent but not visible in Firebase Console

**Solutions**:
1. Check Firebase Analytics is enabled
2. Verify API key is correct
3. Check network connectivity
4. Review backend logs for errors
5. Wait 24-48 hours for BigQuery export

### Issue: BigQuery Queries Failing

**Symptoms**: Queries return errors or no data

**Solutions**:
1. Verify BigQuery export is enabled
2. Check dataset exists
3. Verify table naming (events_YYYYMMDD)
4. Check service account permissions
5. Review query syntax

### Issue: High Data Discrepancy

**Symptoms**: Event counts don't match between systems

**Solutions**:
1. Check for network issues
2. Review error logs
3. Verify dual-write is enabled
4. Check for rate limiting
5. Investigate specific event types

### Issue: Increased Costs

**Symptoms**: Costs higher than expected

**Solutions**:
1. Verify optimization is enabled
2. Check BigQuery query patterns
3. Review DynamoDB capacity
4. Optimize expensive queries
5. Check for data duplication

## Support and Resources

- [BigQuery Setup Guide](./BIGQUERY_SETUP_GUIDE.md)
- [Event Storage Strategy](./EVENT_STORAGE_STRATEGY.md)
- [Cost Optimization Guide](./COST_OPTIMIZATION_GUIDE.md)
- [BigQuery Quick Reference](./BIGQUERY_QUICK_REFERENCE.md)

For issues during migration:
- Contact: platform-team@company.com
- Slack: #user-journey-ops
- On-call: See [Admin Guide](./ADMIN_GUIDE.md)

---

**Migration Timeline**: 6-8 weeks

**Expected Downtime**: None (zero-downtime migration)

**Cost Savings**: 60-70% reduction in analytics infrastructure costs
