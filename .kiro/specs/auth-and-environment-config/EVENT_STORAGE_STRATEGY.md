# Event Storage Strategy Documentation

## Overview

This document describes the optimized event storage strategy that reduces costs by routing events to appropriate storage based on their criticality and real-time requirements.

## Storage Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Events                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │  Event Router         │
                │  (Strategy Service)   │
                └───────────┬───────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
    ┌──────────────────┐    ┌──────────────────┐
    │ Critical Events  │    │ Non-Critical     │
    │                  │    │ Events           │
    └────────┬─────────┘    └────────┬─────────┘
             │                       │
             ▼                       ▼
    ┌──────────────────┐    ┌──────────────────┐
    │   DynamoDB       │    │  Firebase        │
    │   (Real-time)    │    │  Analytics Only  │
    │   +              │    │                  │
    │   Firebase       │    │                  │
    └────────┬─────────┘    └────────┬─────────┘
             │                       │
             └───────────┬───────────┘
                         │
                         ▼
              ┌──────────────────┐
              │    BigQuery      │
              │  (Historical)    │
              │  via Firebase    │
              │  Export          │
              └──────────────────┘
```

## Event Classification

### Critical Events (DynamoDB + Firebase)

These events require real-time access and are stored in both DynamoDB and Firebase Analytics:

#### 1. Struggle Signals
- `struggle_signal` - User experiencing difficulty
- `error` - Application errors
- `feature_interaction` - Feature usage tracking

**Why Critical:** Need immediate detection for intervention triggers

#### 2. Exit Risk Indicators
- `exit_intent` - User showing signs of leaving
- `session_timeout` - Session about to expire
- `rapid_navigation` - User navigating quickly (confusion indicator)

**Why Critical:** Need real-time prediction for exit risk model

#### 3. Intervention Triggers
- `intervention_triggered` - Intervention was triggered
- `intervention_completed` - User completed intervention

**Why Critical:** Need immediate tracking for intervention effectiveness

#### 4. Active Session Data
- `session_start` - User session begins
- `session_end` - User session ends

**Why Critical:** Need real-time session management

#### 5. User Profile Updates
- `profile_updated` - User profile changed
- `preferences_changed` - User preferences modified

**Why Critical:** Need immediate access to current user state

### Non-Critical Events (Firebase Analytics Only)

These events are stored only in Firebase Analytics for cost optimization:

#### 1. Page Views
- `page_view` - User viewed a page
- `navigation` - User navigated between pages

**Why Non-Critical:** Historical analysis only, no real-time requirements

#### 2. Calculator Interactions
- `calculator_interaction` - User used calculator
- `calculation_complete` - Calculation finished

**Why Non-Critical:** Analytics and trend analysis, not time-sensitive

#### 3. Video Engagement
- `video_engagement` - Video play, pause, complete events
- `video_progress` - Video playback progress

**Why Non-Critical:** Engagement metrics for historical analysis

#### 4. Document Uploads
- `document_upload` - User uploaded document
- `document_viewed` - User viewed document

**Why Non-Critical:** Usage tracking for historical analysis

#### 5. Search Events
- `search` - User performed search
- `search_results` - Search results displayed

**Why Non-Critical:** Search analytics for historical analysis

## Cost Analysis

### Before Optimization (All events in DynamoDB)

Assumptions:
- 1 million events per month
- Average event size: 1 KB
- 50% read requests, 50% write requests

**DynamoDB Costs:**
- Storage: 1 GB × $0.25 = $0.25/month
- Write requests: 500,000 × $1.25/million = $0.63/month
- Read requests: 500,000 × $0.25/million = $0.13/month
- **Total: ~$1.01/month**

Wait, that's actually quite cheap! Let me recalculate with more realistic numbers:

### Realistic Cost Analysis

Assumptions:
- 10 million events per month (more realistic for production)
- Average event size: 2 KB
- 30% critical events, 70% non-critical events
- Read-heavy workload (80% reads, 20% writes)

#### Before Optimization (All events in DynamoDB)

**DynamoDB Costs:**
- Storage: 20 GB × $0.25 = $5.00/month
- Write requests: 2 million × $1.25/million = $2.50/month
- Read requests: 8 million × $0.25/million = $2.00/month
- **Total: ~$9.50/month**

**Firebase Analytics:**
- Free (included in Firebase plan)

**BigQuery:**
- Not used

**Grand Total: $9.50/month**

#### After Optimization (Critical events in DynamoDB, all in Firebase)

**DynamoDB Costs (30% of events):**
- Storage: 6 GB × $0.25 = $1.50/month
- Write requests: 600,000 × $1.25/million = $0.75/month
- Read requests: 2.4 million × $0.25/million = $0.60/month
- **Subtotal: ~$2.85/month**

**Firebase Analytics:**
- Free (included in Firebase plan)

**BigQuery (for historical queries):**
- Storage: 20 GB × $0.02 = $0.40/month
- Queries: ~100 queries/month × 0.1 GB × $5/TB = $0.05/month
- **Subtotal: ~$0.45/month**

**Grand Total: $3.30/month**

**Cost Savings: $6.20/month (65% reduction)**

### Scaling to Higher Volumes

At 100 million events per month:

#### Before Optimization
- DynamoDB: ~$95/month
- **Total: $95/month**

#### After Optimization
- DynamoDB (30%): ~$28.50/month
- BigQuery: ~$4.50/month
- **Total: $33/month**

**Cost Savings: $62/month (65% reduction)**

## Configuration

### Enable Optimization

In `application-prod.yml`:

```yaml
event-storage:
  optimization-enabled: true
```

### Disable Optimization (Store all events in DynamoDB)

```yaml
event-storage:
  optimization-enabled: false
```

## Implementation

### Using the Event Storage Strategy Service

```java
@Autowired
private EventStorageStrategyService storageStrategy;

// Store an event using optimized strategy
UserEvent event = new UserEvent();
event.setEventType("page_view");
event.setUserId("user123");
// ... set other properties

boolean success = storageStrategy.storeEvent(event);
```

### Adding Custom Critical Event Types

```java
// Add a new critical event type
storageStrategy.addCriticalEventType("custom_critical_event");

// Remove a critical event type
storageStrategy.removeCriticalEventType("feature_interaction");
```

### Getting Storage Statistics

```java
StorageStatistics stats = storageStrategy.getStorageStatistics();
System.out.println("Optimization enabled: " + stats.isOptimizationEnabled());
System.out.println("Critical event types: " + stats.getCriticalEventTypes());
System.out.println("Strategy: " + stats.getStrategy());
```

## Querying Events

### Real-Time Queries (Last 7 days)

Use DynamoDB for critical events and recent data:

```java
// Query recent critical events from DynamoDB
List<UserEvent> recentEvents = dynamoDBService.getUserEvents(
    userId, 
    System.currentTimeMillis() - (7 * 24 * 60 * 60 * 1000),
    System.currentTimeMillis()
);
```

### Historical Queries (Older than 7 days)

Use BigQuery for all events (critical and non-critical):

```java
// Query historical events from BigQuery
List<BigQueryEventResult> historicalEvents = bigQueryService.getHistoricalEvents(
    userId,
    LocalDate.now().minusDays(90),
    LocalDate.now().minusDays(7)
);
```

## Migration Plan

### Phase 1: Dual-Write (Week 1-2)
- Enable dual-write for all events
- Write to both DynamoDB and Firebase Analytics
- Monitor data consistency
- Validate BigQuery export

### Phase 2: Gradual Transition (Week 3-4)
- Enable optimization for non-critical events
- Monitor application performance
- Validate query patterns
- Adjust critical event list if needed

### Phase 3: Full Optimization (Week 5+)
- Disable dual-write
- Use optimized storage strategy
- Archive old DynamoDB data
- Monitor cost savings

### Phase 4: Cleanup (Week 6+)
- Remove old DynamoDB data (older than 30 days)
- Optimize BigQuery queries
- Document final architecture
- Celebrate cost savings! 🎉

## Monitoring

### Key Metrics to Monitor

1. **Event Write Success Rate**
   - DynamoDB write success rate
   - Firebase Analytics write success rate
   - Overall success rate

2. **Query Performance**
   - DynamoDB query latency
   - BigQuery query latency
   - Cache hit rate

3. **Cost Metrics**
   - DynamoDB storage costs
   - DynamoDB request costs
   - BigQuery storage costs
   - BigQuery query costs

4. **Data Consistency**
   - Event count comparison (DynamoDB vs BigQuery)
   - Data validation errors
   - Missing events

### CloudWatch Alarms

Set up alarms for:
- High event write failure rate (>5%)
- High query latency (>1 second)
- Unexpected cost increases (>20% month-over-month)

## Troubleshooting

### Issue: Events not appearing in BigQuery

**Solution:**
1. Check Firebase Analytics Debug View
2. Verify BigQuery export is enabled
3. Wait 24-48 hours for initial export
4. Check Firebase Console for export errors

### Issue: High DynamoDB costs

**Solution:**
1. Verify optimization is enabled
2. Check critical event list
3. Review event classification
4. Consider adjusting critical event types

### Issue: Query performance degradation

**Solution:**
1. Check BigQuery query patterns
2. Optimize table partitioning
3. Use appropriate date ranges
4. Consider materialized views

## Best Practices

1. **Review Critical Event List Regularly**
   - Evaluate which events truly need real-time access
   - Remove events that can be moved to Firebase-only

2. **Use Appropriate Query Patterns**
   - DynamoDB for recent data (last 7 days)
   - BigQuery for historical analysis (older than 7 days)

3. **Monitor Costs**
   - Set up cost alerts
   - Review monthly cost reports
   - Optimize based on usage patterns

4. **Test Before Production**
   - Validate in development environment
   - Run load tests
   - Verify data consistency

## References

- [DynamoDB Pricing](https://aws.amazon.com/dynamodb/pricing/)
- [Firebase Analytics Pricing](https://firebase.google.com/pricing)
- [BigQuery Pricing](https://cloud.google.com/bigquery/pricing)
- [Event Storage Strategy Service](../backend/src/main/java/com/userjourney/analytics/service/EventStorageStrategyService.java)
