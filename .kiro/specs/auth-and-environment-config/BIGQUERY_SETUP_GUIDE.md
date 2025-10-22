# BigQuery Integration Setup Guide

## Overview

This guide provides step-by-step instructions for configuring Firebase Analytics BigQuery export to enable cost-effective historical analytics data storage and querying.

## Prerequisites

- Firebase project with Analytics enabled
- Google Cloud Platform (GCP) project linked to Firebase
- Billing enabled on GCP project
- Owner or Editor role on the GCP project

## Task 10.1: Configure Firebase Analytics BigQuery Export

### Step 1: Enable BigQuery API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** > **Library**
4. Search for "BigQuery API"
5. Click **Enable** if not already enabled

### Step 2: Link Firebase to BigQuery

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon (⚙️) next to **Project Overview**
4. Select **Project settings**
5. Navigate to the **Integrations** tab
6. Find **BigQuery** in the list
7. Click **Link** button

### Step 3: Configure BigQuery Export Settings

1. In the BigQuery linking dialog, you'll see options for:
   - **Analytics**: Enable this to export Firebase Analytics data
   - **Crashlytics**: (Optional) Enable if you want crash data
   - **Cloud Messaging**: (Optional) Enable if you want messaging data

2. For Analytics, configure:
   - **Export Type**: Select "Daily" (recommended for cost optimization)
     - Daily export: Data exported once per day (lower cost)
     - Streaming export: Real-time data export (higher cost)
   - **Dataset Location**: Choose a location close to your users
     - US (multi-region)
     - EU (multi-region)
     - Or specific regions
   
3. Click **Link to BigQuery**

### Step 4: Verify BigQuery Dataset Creation

1. Go to [BigQuery Console](https://console.cloud.google.com/bigquery)
2. In the Explorer panel, expand your project
3. You should see a new dataset named `analytics_<property_id>`
   - Example: `analytics_123456789`
4. The dataset will contain:
   - `events_YYYYMMDD` tables (daily partitioned tables)
   - `events_intraday_YYYYMMDD` tables (for current day data)

### Step 5: Configure Export Schedule

The export schedule is automatically configured when you enable BigQuery linking:

- **Daily Export**: Data is exported once per day, typically around 3 AM PST
- **Intraday Tables**: Updated multiple times per day for current day data
- **Table Partitioning**: Each day's data is stored in a separate table

### Step 6: Verify Data Export

After 24-48 hours, verify that data is being exported:

1. Go to BigQuery Console
2. Navigate to your `analytics_<property_id>` dataset
3. Check for tables named `events_YYYYMMDD`
4. Run a test query:

```sql
SELECT
  event_name,
  COUNT(*) as event_count
FROM
  `your-project-id.analytics_123456789.events_*`
WHERE
  _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', CURRENT_DATE() - 1)
GROUP BY
  event_name
ORDER BY
  event_count DESC
LIMIT 10;
```

### Step 7: Set Up BigQuery Permissions

Grant necessary permissions to your backend service account:

1. Go to BigQuery Console
2. Select your `analytics_<property_id>` dataset
3. Click **SHARING** > **Permissions**
4. Click **ADD PRINCIPAL**
5. Enter your service account email (e.g., `firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com`)
6. Assign roles:
   - **BigQuery Data Viewer**: Read access to tables
   - **BigQuery Job User**: Run queries
7. Click **Save**

## BigQuery Schema Overview

### Events Table Schema

Firebase Analytics exports data to BigQuery with the following key fields:

```
events_YYYYMMDD
├── event_date: STRING (YYYYMMDD format)
├── event_timestamp: INTEGER (microseconds since epoch)
├── event_name: STRING (e.g., 'page_view', 'calculator_interaction')
├── event_params: ARRAY<STRUCT>
│   ├── key: STRING
│   └── value: STRUCT
│       ├── string_value: STRING
│       ├── int_value: INTEGER
│       ├── float_value: FLOAT
│       └── double_value: FLOAT
├── user_pseudo_id: STRING (anonymous user ID)
├── user_id: STRING (authenticated user ID, if set)
├── user_properties: ARRAY<STRUCT>
│   ├── key: STRING
│   └── value: STRUCT
│       ├── string_value: STRING
│       ├── int_value: INTEGER
│       └── set_timestamp_micros: INTEGER
├── device: STRUCT
│   ├── category: STRING
│   ├── mobile_brand_name: STRING
│   ├── mobile_model_name: STRING
│   ├── operating_system: STRING
│   └── language: STRING
├── geo: STRUCT
│   ├── continent: STRING
│   ├── country: STRING
│   ├── region: STRING
│   └── city: STRING
└── app_info: STRUCT
    ├── id: STRING
    ├── version: STRING
    └── install_source: STRING
```

## Example Queries

### Query 1: Get All Events for a User

```sql
SELECT
  event_name,
  event_timestamp,
  event_params
FROM
  `your-project-id.analytics_123456789.events_*`
WHERE
  user_pseudo_id = 'user-id-here'
  AND _TABLE_SUFFIX BETWEEN '20250101' AND '20251231'
ORDER BY
  event_timestamp;
```

### Query 2: Calculator Interaction Analysis

```sql
SELECT
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'loan_amount') as loan_amount,
  (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'interest_rate') as interest_rate,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'term_years') as term_years,
  COUNT(*) as calculation_count
FROM
  `your-project-id.analytics_123456789.events_*`
WHERE
  event_name = 'calculator_interaction'
  AND _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                       AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
GROUP BY
  loan_amount, interest_rate, term_years
ORDER BY
  calculation_count DESC
LIMIT 20;
```

### Query 3: Video Engagement Metrics

```sql
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'video_id') as video_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'action') as action,
  COUNT(*) as action_count,
  COUNT(DISTINCT user_pseudo_id) as unique_users
FROM
  `your-project-id.analytics_123456789.events_*`
WHERE
  event_name = 'video_engagement'
  AND _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
                       AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
GROUP BY
  video_id, action
ORDER BY
  action_count DESC;
```

### Query 4: User Journey Analysis

```sql
WITH user_sessions AS (
  SELECT
    user_pseudo_id,
    event_name,
    event_timestamp,
    LAG(event_name) OVER (PARTITION BY user_pseudo_id ORDER BY event_timestamp) as previous_event,
    LEAD(event_name) OVER (PARTITION BY user_pseudo_id ORDER BY event_timestamp) as next_event
  FROM
    `your-project-id.analytics_123456789.events_*`
  WHERE
    _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', CURRENT_DATE() - 1)
)
SELECT
  previous_event,
  event_name as current_event,
  next_event,
  COUNT(*) as sequence_count
FROM
  user_sessions
WHERE
  previous_event IS NOT NULL
  AND next_event IS NOT NULL
GROUP BY
  previous_event, current_event, next_event
ORDER BY
  sequence_count DESC
LIMIT 50;
```

## Cost Optimization Tips

### 1. Use Table Partitioning

Always use `_TABLE_SUFFIX` to limit the date range:

```sql
-- Good: Only scans 7 days of data
WHERE _TABLE_SUFFIX BETWEEN '20250101' AND '20250107'

-- Bad: Scans all tables
WHERE event_date BETWEEN '20250101' AND '20250107'
```

### 2. Select Only Required Columns

```sql
-- Good: Only selects needed columns
SELECT event_name, event_timestamp FROM ...

-- Bad: Selects all columns
SELECT * FROM ...
```

### 3. Use Clustering

BigQuery automatically clusters Firebase Analytics tables by `user_pseudo_id`, so queries filtering by user are efficient.

### 4. Monitor Query Costs

1. Go to BigQuery Console
2. Click on a query
3. Check "Bytes processed" to estimate cost
4. BigQuery pricing: $5 per TB processed

### 5. Use Materialized Views for Common Queries

Create materialized views for frequently run queries to reduce processing costs.

## Estimated Costs

### BigQuery Storage Costs

- **Active storage**: $0.02 per GB/month
- **Long-term storage** (90+ days): $0.01 per GB/month

### BigQuery Query Costs

- **On-demand pricing**: $5 per TB processed
- **Flat-rate pricing**: $2,000/month for 100 slots (for high-volume usage)

### Example Cost Calculation

Assuming:
- 1 million events per month
- Average event size: 2 KB
- Total storage: 2 GB/month
- 100 queries per day, each processing 100 MB

**Monthly Costs:**
- Storage: 2 GB × $0.02 = $0.04
- Queries: 100 queries/day × 30 days × 0.1 GB × $5/1000 GB = $1.50
- **Total: ~$1.54/month**

Compare to DynamoDB-only approach: ~$150-200/month

**Cost Savings: ~99%**

## Troubleshooting

### Issue: No tables appearing in BigQuery

**Solution:**
1. Wait 24-48 hours after enabling export
2. Verify Firebase Analytics is receiving events
3. Check Firebase Console > Analytics > Events to confirm data collection
4. Verify billing is enabled on GCP project

### Issue: Permission denied errors

**Solution:**
1. Verify service account has BigQuery Data Viewer role
2. Verify service account has BigQuery Job User role
3. Check dataset-level permissions

### Issue: Query costs are high

**Solution:**
1. Always use `_TABLE_SUFFIX` to limit date ranges
2. Select only required columns
3. Use `LIMIT` clause for exploratory queries
4. Consider using materialized views for common queries

## Next Steps

After completing this setup:

1. ✅ Task 10.1 Complete: BigQuery export configured
2. ➡️ Task 10.2: Create BigQueryAnalyticsService in backend
3. ➡️ Task 10.3: Update Analytics Dashboard to use BigQuery
4. ➡️ Task 10.4: Implement dual-write strategy
5. ➡️ Task 10.5: Optimize event storage strategy

## References

- [Firebase Analytics BigQuery Export](https://firebase.google.com/docs/analytics/bigquery-export)
- [BigQuery Schema for Firebase Analytics](https://support.google.com/firebase/answer/7029846)
- [BigQuery Pricing](https://cloud.google.com/bigquery/pricing)
- [BigQuery Best Practices](https://cloud.google.com/bigquery/docs/best-practices)
