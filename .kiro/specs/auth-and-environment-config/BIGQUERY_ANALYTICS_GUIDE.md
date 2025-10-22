# BigQuery Analytics Guide: Querying and Analyzing User Data

## Overview

This guide provides comprehensive information for analysts and administrators on querying and analyzing user journey data in BigQuery. For quick reference and API documentation, see [BigQuery Quick Reference](./BIGQUERY_QUICK_REFERENCE.md).

For setup instructions, see [BigQuery Setup Guide](./BIGQUERY_SETUP_GUIDE.md).

## Quick Links

- [BigQuery Quick Reference](./BIGQUERY_QUICK_REFERENCE.md) - API endpoints, common queries, troubleshooting
- [BigQuery Setup Guide](./BIGQUERY_SETUP_GUIDE.md) - Complete setup instructions
- [Event Storage Strategy](./EVENT_STORAGE_STRATEGY.md) - Understanding data routing
- [Cost Optimization Guide](./COST_OPTIMIZATION_GUIDE.md) - Reducing query costs

## Using BigQuery for Analytics

### Accessing Data

**Via Analytics Dashboard** (Recommended for most users):
1. Log in to https://www.journey-analytics-admin.io
2. Navigate to **Reports** > **Historical Analytics**
3. Select report type and date range
4. View results or export data

**Via BigQuery Console** (For custom queries):
1. Go to [BigQuery Console](https://console.cloud.google.com/bigquery)
2. Select project: `journey-analytics-prod`
3. Navigate to dataset: `analytics_<property_id>`
4. Write and run custom SQL queries

**Via API** (For programmatic access):
See [BigQuery Quick Reference](./BIGQUERY_QUICK_REFERENCE.md) for API endpoints.

### Common Analysis Tasks

For detailed query examples, see [BigQuery Quick Reference](./BIGQUERY_QUICK_REFERENCE.md#common-bigquery-queries).

**User Journey Analysis**:
- Track user paths through the application
- Identify common navigation patterns
- Find drop-off points

**Feature Usage Analysis**:
- Calculator usage patterns
- Video engagement metrics
- Document upload trends

**Behavioral Analysis**:
- Session duration
- Pages per session
- Return visitor patterns

**Conversion Analysis**:
- Funnel analysis
- Conversion rates
- Time to conversion

### Best Practices

1. **Always use date range filters** with `_TABLE_SUFFIX`
2. **Select only needed columns** to reduce costs
3. **Use LIMIT for exploratory queries**
4. **Create saved queries** for repeated analysis
5. **Monitor query costs** in BigQuery Console

For complete best practices, see [BigQuery Quick Reference](./BIGQUERY_QUICK_REFERENCE.md#cost-optimization-tips).

## Additional Resources

- [BigQuery Quick Reference](./BIGQUERY_QUICK_REFERENCE.md)
- [BigQuery Setup Guide](./BIGQUERY_SETUP_GUIDE.md)
- [Event Storage Strategy](./EVENT_STORAGE_STRATEGY.md)
- [Firebase Analytics Documentation](https://firebase.google.com/docs/analytics/bigquery-export)

