# BigQuery Integration - Quick Reference

## Environment Variables

### Required for Production

```bash
# BigQuery Configuration
BIGQUERY_ENABLED=true
BIGQUERY_PROJECT_ID=your-firebase-project-id
BIGQUERY_DATASET_ID=analytics_123456789
BIGQUERY_CREDENTIALS_PATH=/path/to/firebase-service-account.json

# Optional: Migration Settings
DUAL_WRITE_ENABLED=false
EVENT_STORAGE_OPTIMIZATION=true
```

## API Endpoints

### Check BigQuery Status
```bash
GET /api/bigquery/status
Authorization: Bearer {token}
```

### Get User Historical Events
```bash
GET /api/bigquery/events/user/{userId}?startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer {token}
```

### Analyze User Journey
```bash
GET /api/bigquery/journey/user/{userId}?startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer {token}
```

### Get Event Aggregations
```bash
GET /api/bigquery/events/aggregations?startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer {token}
```

### Get Calculator Statistics
```bash
GET /api/bigquery/calculator/statistics?startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer {token}
```

### Get Video Engagement Metrics
```bash
GET /api/bigquery/video/engagement?startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer {token}
```

## Frontend Usage

### Import BigQuery Service
```typescript
import bigQueryService from '../services/BigQueryService';
```

### Check Status
```typescript
const status = await bigQueryService.checkStatus();
console.log('BigQuery available:', status.available);
```

### Query Historical Events
```typescript
const events = await bigQueryService.getUserHistoricalEvents(
  'user123',
  '2025-01-01',
  '2025-01-31'
);
```

### Analyze User Journey
```typescript
const journey = await bigQueryService.analyzeUserJourney(
  'user123',
  '2025-01-01',
  '2025-01-31'
);
```

### Get Event Aggregations
```typescript
const aggregations = await bigQueryService.getEventAggregations(
  '2025-01-01',
  '2025-01-31'
);
```

### Use Date Range Helper
```typescript
const { startDate, endDate } = bigQueryService.getDateRange('last30days');
const stats = await bigQueryService.getCalculatorStatistics(startDate, endDate);
```

## Backend Usage

### Inject BigQuery Service
```java
@Autowired
private BigQueryAnalyticsService bigQueryService;
```

### Check Availability
```java
if (bigQueryService.isAvailable()) {
    // BigQuery is configured and ready
}
```

### Query Historical Events
```java
List<BigQueryEventResult> events = bigQueryService.getHistoricalEvents(
    userId,
    LocalDate.of(2025, 1, 1),
    LocalDate.of(2025, 1, 31)
);
```

### Analyze User Journey
```java
UserJourneyAnalysis journey = bigQueryService.analyzeUserJourney(
    userId,
    LocalDate.of(2025, 1, 1),
    LocalDate.of(2025, 1, 31)
);
```

### Get Event Aggregations
```java
List<EventCountAggregation> aggregations = bigQueryService.getEventCountAggregations(
    LocalDate.of(2025, 1, 1),
    LocalDate.of(2025, 1, 31)
);
```

## Event Storage Strategy

### Using Event Storage Strategy Service
```java
@Autowired
private EventStorageStrategyService storageStrategy;

// Store event with optimized routing
UserEvent event = new UserEvent();
event.setEventType("page_view");
event.setUserId("user123");
boolean success = storageStrategy.storeEvent(event);
```

### Check if Event is Critical
```java
boolean isCritical = storageStrategy.isCriticalEvent("struggle_signal");
// Returns: true (critical events go to DynamoDB + Firebase)

boolean isCritical = storageStrategy.isCriticalEvent("page_view");
// Returns: false (non-critical events go to Firebase only)
```

### Get Storage Statistics
```java
StorageStatistics stats = storageStrategy.getStorageStatistics();
System.out.println("Optimization enabled: " + stats.isOptimizationEnabled());
System.out.println("Critical event types: " + stats.getCriticalEventTypes());
```

### Add Custom Critical Event Type
```java
storageStrategy.addCriticalEventType("custom_critical_event");
```

## Critical Event Types

Events stored in DynamoDB + Firebase (real-time access):
- `struggle_signal`
- `error`
- `feature_interaction`
- `exit_intent`
- `session_timeout`
- `rapid_navigation`
- `intervention_triggered`
- `intervention_completed`
- `session_start`
- `session_end`
- `profile_updated`
- `preferences_changed`

Non-critical events stored in Firebase only (historical access):
- `page_view`
- `navigation`
- `calculator_interaction`
- `video_engagement`
- `document_upload`
- `search`

## Migration Phases

### Phase 1: Enable Dual-Write
```yaml
dual-write:
  enabled: true
```

### Phase 2: Enable Optimization
```yaml
event-storage:
  optimization-enabled: true
```

### Phase 3: Disable Dual-Write
```yaml
dual-write:
  enabled: false
```

## Common BigQuery Queries

### Query All Events for a User
```sql
SELECT
  event_name,
  event_timestamp,
  event_params
FROM
  `project-id.analytics_123456789.events_*`
WHERE
  user_pseudo_id = 'user-id'
  AND _TABLE_SUFFIX BETWEEN '20250101' AND '20251231'
ORDER BY
  event_timestamp;
```

### Calculator Interaction Analysis
```sql
SELECT
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'loan_amount') as loan_amount,
  COUNT(*) as calculation_count
FROM
  `project-id.analytics_123456789.events_*`
WHERE
  event_name = 'calculator_interaction'
  AND _TABLE_SUFFIX BETWEEN '20250101' AND '20250131'
GROUP BY
  loan_amount
ORDER BY
  calculation_count DESC;
```

### Video Engagement Metrics
```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'video_id') as video_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'action') as action,
  COUNT(*) as action_count
FROM
  `project-id.analytics_123456789.events_*`
WHERE
  event_name = 'video_engagement'
  AND _TABLE_SUFFIX BETWEEN '20250101' AND '20250131'
GROUP BY
  video_id, action;
```

## Cost Optimization Tips

1. **Always use _TABLE_SUFFIX** to limit date ranges
2. **Select only required columns** (avoid SELECT *)
3. **Use LIMIT** for exploratory queries
4. **Monitor query costs** in BigQuery Console
5. **Create materialized views** for common queries

## Troubleshooting

### BigQuery Not Available
- Check `BIGQUERY_ENABLED` environment variable
- Verify credentials file exists
- Check Firebase Analytics export is enabled

### Query Failures
- Verify dataset exists in BigQuery Console
- Check table naming format (events_YYYYMMDD)
- Validate date range format (YYYY-MM-DD)

### High Costs
- Review query patterns (use _TABLE_SUFFIX)
- Check SELECT statements (avoid SELECT *)
- Monitor BigQuery Console for query costs

## Documentation Links

- [BigQuery Setup Guide](./BIGQUERY_SETUP_GUIDE.md)
- [Event Storage Strategy](./EVENT_STORAGE_STRATEGY.md)
- [Task 10 Implementation Summary](./TASK_10_IMPLEMENTATION_SUMMARY.md)
