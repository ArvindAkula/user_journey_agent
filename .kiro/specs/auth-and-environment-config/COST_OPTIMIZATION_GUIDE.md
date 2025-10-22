# Cost Optimization Guide

## Overview

This guide provides strategies and best practices for optimizing costs in the User Journey Analytics application. By following these recommendations, you can significantly reduce infrastructure costs while maintaining performance and reliability.

## Cost Comparison: DynamoDB vs BigQuery

### Original Architecture (DynamoDB Only)

**Monthly Costs for 1M Events**:
- DynamoDB Storage: 2 GB × $0.25/GB = $0.50
- DynamoDB Write Requests: 1M × $1.25/1M = $1.25
- DynamoDB Read Requests: 500K × $0.25/1M = $0.13
- Data Transfer: ~$5.00
- **Total: ~$150-200/month** (with provisioned capacity and indexes)

### Optimized Architecture (DynamoDB + BigQuery)

**Monthly Costs for 1M Events**:
- Firebase Analytics: **Free**
- BigQuery Storage: 2 GB × $0.02/GB = $0.04 (long-term)
- BigQuery Queries: 10 GB processed × $5/TB = $0.05
- DynamoDB (critical events only): ~$30-50
- **Total: ~$40-70/month**

**Cost Savings: 60-70% reduction**

## Event Storage Strategy

### Critical Events (DynamoDB + Firebase)

Store in DynamoDB for real-time access:
- `struggle_signal`
- `error`
- `exit_intent`
- `intervention_triggered`
- `intervention_completed`
- `session_start`
- `session_end`
- `profile_updated`

**Why**: These events require immediate access for real-time interventions and analytics.

### Non-Critical Events (Firebase Only)

Store only in Firebase Analytics:
- `page_view`
- `navigation`
- `calculator_interaction`
- `video_engagement`
- `document_upload`
- `search`

**Why**: These events are used for historical analysis and don't require real-time access.

## BigQuery Cost Optimization

### 1. Use Table Partitioning

**Always use `_TABLE_SUFFIX` to limit date ranges**:

```sql
-- Good: Only scans 7 days of data
SELECT event_name, COUNT(*) as count
FROM `project.analytics_123456789.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20250101' AND '20250107'
GROUP BY event_name;

-- Bad: Scans all tables (expensive!)
SELECT event_name, COUNT(*) as count
FROM `project.analytics_123456789.events_*`
WHERE event_date BETWEEN '20250101' AND '20250107'
GROUP BY event_name;
```

**Cost Impact**: Can reduce query costs by 90%+

### 2. Select Only Required Columns

```sql
-- Good: Only selects needed columns
SELECT event_name, event_timestamp, user_pseudo_id
FROM `project.analytics_123456789.events_*`
WHERE _TABLE_SUFFIX = '20250101';

-- Bad: Selects all columns
SELECT *
FROM `project.analytics_123456789.events_*`
WHERE _TABLE_SUFFIX = '20250101';
```

**Cost Impact**: Can reduce query costs by 50-80%

### 3. Use LIMIT for Exploratory Queries

```sql
-- Good: Limits results for testing
SELECT event_name, COUNT(*) as count
FROM `project.analytics_123456789.events_*`
WHERE _TABLE_SUFFIX = '20250101'
GROUP BY event_name
LIMIT 10;
```

**Cost Impact**: Doesn't reduce processing costs, but helps avoid accidentally processing too much data

### 4. Create Materialized Views

For frequently run queries, create materialized views:

```sql
CREATE MATERIALIZED VIEW `project.analytics_123456789.daily_event_counts`
AS
SELECT
  event_date,
  event_name,
  COUNT(*) as event_count
FROM `project.analytics_123456789.events_*`
GROUP BY event_date, event_name;
```

**Cost Impact**: Queries against materialized views are much cheaper

### 5. Monitor Query Costs

Before running a query, check the estimated cost:

1. In BigQuery Console, write your query
2. Click "Validator" to see bytes processed
3. Calculate cost: bytes_processed / 1TB × $5

**Example**:
- Query processes 100 MB
- Cost: 0.1 GB / 1000 GB × $5 = $0.0005

## DynamoDB Cost Optimization

### 1. Use On-Demand Pricing for Variable Workloads

```yaml
# For unpredictable traffic patterns
billing-mode: PAY_PER_REQUEST
```

**When to use**:
- Traffic varies significantly
- New application with unknown patterns
- Development/testing environments

**Cost**: $1.25 per million writes, $0.25 per million reads

### 2. Use Provisioned Capacity for Predictable Workloads

```yaml
# For consistent traffic patterns
billing-mode: PROVISIONED
read-capacity-units: 10
write-capacity-units: 5
```

**When to use**:
- Consistent traffic patterns
- High-volume applications
- Cost optimization is priority

**Cost**: $0.00065 per RCU-hour, $0.00065 per WCU-hour

### 3. Enable Auto-Scaling

```yaml
auto-scaling:
  enabled: true
  min-capacity: 5
  max-capacity: 100
  target-utilization: 70
```

**Benefit**: Automatically adjusts capacity based on demand

### 4. Use TTL for Automatic Data Expiration

```java
// Set TTL on items
item.put("ttl", Instant.now().plus(30, ChronoUnit.DAYS).getEpochSecond());
```

**Benefit**: Automatically deletes old data, reducing storage costs

### 5. Optimize Indexes

Only create indexes that are actually used:

```yaml
# Only create necessary GSIs
global-secondary-indexes:
  - index-name: user-id-index
    keys:
      - attribute-name: userId
        key-type: HASH
```

**Cost Impact**: Each GSI costs the same as the base table

## CloudFront Cost Optimization

### 1. Use Price Class to Limit Edge Locations

```typescript
priceClass: cloudfront.PriceClass.PRICE_CLASS_100  // US, Canada, Europe
```

**Options**:
- `PRICE_CLASS_100`: US, Canada, Europe (cheapest)
- `PRICE_CLASS_200`: + Asia, Africa, South America
- `PRICE_CLASS_ALL`: All edge locations (most expensive)

**Cost Impact**: Can reduce costs by 30-50%

### 2. Optimize Cache Hit Ratio

```typescript
cacheBehavior: {
  defaultTTL: 86400,  // 24 hours
  minTTL: 0,
  maxTTL: 31536000,   // 1 year
}
```

**Target**: > 80% cache hit ratio

**Benefit**: Reduces origin requests and data transfer costs

### 3. Enable Compression

```typescript
compress: true
```

**Benefit**: Reduces data transfer costs by 50-70%

### 4. Set Appropriate TTLs

```typescript
// Static assets (JS, CSS, images)
cacheControl: "public, max-age=31536000, immutable"

// HTML files
cacheControl: "no-cache, no-store, must-revalidate"

// API responses
cacheControl: "private, max-age=300"
```

## ECS/Fargate Cost Optimization

### 1. Right-Size Tasks

Monitor CPU and memory usage:

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=backend-service \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average
```

**Target**: 60-80% average utilization

### 2. Use Fargate Spot for Non-Critical Tasks

```typescript
capacityProviderStrategy: [
  {
    capacityProvider: 'FARGATE_SPOT',
    weight: 70,
    base: 0
  },
  {
    capacityProvider: 'FARGATE',
    weight: 30,
    base: 2
  }
]
```

**Cost Savings**: Up to 70% for Spot instances

### 3. Optimize Auto-Scaling

```typescript
scaling: {
  minCapacity: 2,
  maxCapacity: 10,
  targetCpuUtilization: 70,
  scaleInCooldown: 300,
  scaleOutCooldown: 60
}
```

**Benefit**: Scales down during low traffic periods

### 4. Use Scheduled Scaling

For predictable traffic patterns:

```typescript
// Scale down during off-hours
scheduledActions: [
  {
    schedule: 'cron(0 22 * * ? *)',  // 10 PM
    minCapacity: 1,
    maxCapacity: 2
  },
  {
    schedule: 'cron(0 6 * * ? *)',   // 6 AM
    minCapacity: 2,
    maxCapacity: 10
  }
]
```

## S3 Cost Optimization

### 1. Use Lifecycle Policies

```typescript
lifecycleRules: [
  {
    id: 'TransitionToIA',
    transitions: [
      {
        storageClass: s3.StorageClass.INFREQUENT_ACCESS,
        transitionAfter: cdk.Duration.days(30)
      },
      {
        storageClass: s3.StorageClass.GLACIER,
        transitionAfter: cdk.Duration.days(90)
      }
    ],
    expiration: cdk.Duration.days(365)
  }
]
```

**Cost Savings**:
- Standard: $0.023/GB
- IA: $0.0125/GB (46% savings)
- Glacier: $0.004/GB (83% savings)

### 2. Enable Intelligent Tiering

```typescript
storageClass: s3.StorageClass.INTELLIGENT_TIERING
```

**Benefit**: Automatically moves objects between tiers based on access patterns

### 3. Compress Files Before Upload

```java
// Compress files before uploading
byte[] compressed = compress(fileData);
s3Client.putObject(request, RequestBody.fromBytes(compressed));
```

**Cost Impact**: Reduces storage and transfer costs

## Monitoring and Alerting

### 1. Set Up Cost Alerts

```bash
aws budgets create-budget \
  --account-id $AWS_ACCOUNT_ID \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
```

**Example budget.json**:
```json
{
  "BudgetName": "MonthlyBudget",
  "BudgetLimit": {
    "Amount": "500",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
```

### 2. Monitor Cost Trends

```bash
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-31 \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=SERVICE
```

### 3. Use Cost Explorer

1. Go to AWS Cost Explorer
2. View costs by service
3. Identify cost spikes
4. Analyze trends

### 4. Create Cost Dashboard

Create CloudWatch dashboard with:
- Daily costs by service
- Month-to-date costs
- Projected monthly costs
- Cost anomalies

## Cost Optimization Checklist

### Monthly Review

- [ ] Review AWS Cost Explorer
- [ ] Check for unused resources
- [ ] Verify auto-scaling is working
- [ ] Review CloudFront cache hit ratio
- [ ] Check DynamoDB capacity utilization
- [ ] Review BigQuery query costs
- [ ] Optimize slow/expensive queries
- [ ] Update lifecycle policies if needed

### Quarterly Review

- [ ] Analyze traffic patterns
- [ ] Consider reserved instances/savings plans
- [ ] Review and optimize architecture
- [ ] Update capacity planning
- [ ] Benchmark against industry standards

## Cost Optimization Best Practices

### 1. Tag All Resources

```typescript
tags: {
  Environment: 'production',
  Application: 'user-journey-analytics',
  CostCenter: 'engineering',
  Owner: 'platform-team'
}
```

**Benefit**: Enables cost allocation and tracking

### 2. Delete Unused Resources

Regularly audit and delete:
- Unused EBS volumes
- Old snapshots
- Unused Elastic IPs
- Stopped instances
- Old CloudWatch logs

### 3. Use Spot Instances Where Possible

For non-critical workloads:
- Batch processing
- Data analysis
- Testing environments

**Cost Savings**: Up to 90%

### 4. Optimize Data Transfer

- Use CloudFront to reduce origin requests
- Keep data in same region when possible
- Use VPC endpoints for AWS services
- Compress data before transfer

### 5. Right-Size Resources

- Monitor actual usage
- Scale down over-provisioned resources
- Use auto-scaling
- Review quarterly

## Estimated Monthly Costs

### Small Deployment (< 10K users)

- ECS/Fargate: $50-100
- DynamoDB: $20-30
- S3: $5-10
- CloudFront: $10-20
- BigQuery: $1-5
- Other AWS services: $20-30
- **Total: $106-195/month**

### Medium Deployment (10K-100K users)

- ECS/Fargate: $200-400
- DynamoDB: $50-100
- S3: $20-40
- CloudFront: $50-100
- BigQuery: $5-20
- Other AWS services: $50-100
- **Total: $375-760/month**

### Large Deployment (100K+ users)

- ECS/Fargate: $500-1000
- DynamoDB: $100-300
- S3: $50-100
- CloudFront: $100-300
- BigQuery: $20-50
- Other AWS services: $100-200
- **Total: $870-1950/month**

## Cost Savings Summary

By implementing the strategies in this guide:

1. **BigQuery Migration**: 60-70% reduction in analytics storage costs
2. **CloudFront Optimization**: 30-50% reduction in CDN costs
3. **ECS Right-Sizing**: 20-40% reduction in compute costs
4. **S3 Lifecycle Policies**: 50-80% reduction in storage costs
5. **DynamoDB Optimization**: 30-50% reduction in database costs

**Overall Potential Savings**: 40-60% of total infrastructure costs

## Additional Resources

- [AWS Cost Optimization](https://aws.amazon.com/pricing/cost-optimization/)
- [BigQuery Pricing](https://cloud.google.com/bigquery/pricing)
- [Firebase Pricing](https://firebase.google.com/pricing)
- [AWS Cost Explorer](https://aws.amazon.com/aws-cost-management/aws-cost-explorer/)
- [Event Storage Strategy](./EVENT_STORAGE_STRATEGY.md)
- [BigQuery Quick Reference](./BIGQUERY_QUICK_REFERENCE.md)
