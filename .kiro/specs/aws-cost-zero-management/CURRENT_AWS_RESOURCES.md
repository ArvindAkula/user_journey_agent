# Current AWS Resources Inventory

**Date:** October 23, 2025  
**AWS Account:** 908333442759  
**Region:** us-east-1

## Summary

This document lists all AWS resources currently deployed for the User Journey Analytics project.

## Resources Found

### 1. DynamoDB Tables (5 tables)
- `user-journey-analytics-audit-logs`
- `user-journey-analytics-struggle-signals`
- `user-journey-analytics-user-events`
- `user-journey-analytics-user-profiles`
- `user-journey-analytics-video-engagement`

**Billing Mode:** PAY_PER_REQUEST (on-demand)  
**Cost Impact:** Minimal when not in use (only pay for actual reads/writes)

### 2. Kinesis Data Streams (1 stream)
- `user-journey-analytics-user-events`
  - **Status:** ACTIVE
  - **Mode:** PROVISIONED
  - **Shard Count:** 2
  - **Cost Impact:** ~$0.015/hour per shard = ~$0.72/day for 2 shards

### 3. Lambda Functions (3 functions)
- `event_processor` (Python 3.13, 512MB, 60s timeout)
- `intervention-executor` (Python 3.11, 512MB, 60s timeout)
- `demo-fin-stream-handler` (Python 3.13, 128MB, 3s timeout)

**Cost Impact:** Only charged when invoked (no idle cost)

### 4. SageMaker Endpoints (1 endpoint - FAILED)
- `user-journey-analytics-exit-risk-endpoint`
  - **Status:** Failed
  - **Config:** user-journey-analytics-exit-risk-endpoint-config
  - **Issue:** Primary container did not pass ping health check
  - **Cost Impact:** $0 (failed endpoints don't incur charges)

### 5. S3 Buckets (7 buckets)
- `user-journey-analytics`
- `user-journey-analytics-analytics-data-dev-9bf2a9c5`
- `user-journey-analytics-event-logs-dev-9bf2a9c5`
- `user-journey-analytics-lambda-artifacts-dev-9bf2a9c5`
- `user-journey-analytics-model-artifacts`
- `user-journey-analytics-terraform-state`
- `user-journey-analytics-terraform-state-demo`

**Cost Impact:** Storage costs only (~$0.023/GB/month)

### 6. CloudWatch Alarms (9 alarms)
- `user-journey-analytics-event-processor-duration-dev`
- `user-journey-analytics-event-processor-errors-dev`
- `user-journey-analytics-intervention-executor-duration-dev`
- `user-journey-analytics-intervention-executor-errors-dev`
- `user-journey-analytics-kinesis-iterator-age-dev`
- `user-journey-analytics-struggle-detector-duration-dev`
- `user-journey-analytics-struggle-detector-errors-dev`
- `user-journey-analytics-video-analyzer-duration-dev`
- `user-journey-analytics-video-analyzer-errors-dev`

**Status:** All in INSUFFICIENT_DATA state  
**Cost Impact:** $0.10/alarm/month = ~$0.90/month

### 7. SNS Topics (4 topics)
- `user-journey-analytics-alerts`
- `user-journey-analytics-alerts-dev`
- `user-journey-analytics-performance-alerts`
- `user-journey-analytics-user-interventions`

**Cost Impact:** Minimal (only charged for published messages)

## Current Daily Cost Estimate

| Service | Daily Cost |
|---------|-----------|
| Kinesis (2 shards) | $0.72 |
| DynamoDB (on-demand, idle) | $0.00 |
| Lambda (idle) | $0.00 |
| SageMaker (failed) | $0.00 |
| S3 Storage (~10GB) | $0.01 |
| CloudWatch Alarms | $0.03 |
| SNS (idle) | $0.00 |
| **TOTAL** | **~$0.76/day** |

**Monthly Estimate:** ~$23/month

## Primary Cost Driver

**Kinesis Data Streams** is the main cost driver at ~$0.72/day. This is because it uses PROVISIONED mode with 2 shards that run 24/7.

## Recommendations for Zero Cost

1. **Stop Kinesis Stream:** Update to 1 shard or delete when not in use
2. **Keep DynamoDB:** Already on-demand, no cost when idle
3. **Keep Lambda:** No cost when not invoked
4. **Fix or Delete SageMaker Endpoint:** Currently failed, should be deleted or fixed
5. **Keep S3 Buckets:** Minimal storage cost, needed for state and data
6. **Disable CloudWatch Alarms:** Can be disabled when not monitoring

## Terraform State Status

- **Backend:** S3 bucket `user-journey-analytics-terraform-state-dev`
- **Lock Table:** `terraform-state-lock`
- **Status:** Backend configuration needs migration
- **Issue:** Terraform state is not currently accessible locally

## Action Items

1. Fix Terraform backend configuration to access state
2. Verify all resources are managed by Terraform
3. Add proper tagging to all resources for identification
4. Create resource management script to stop/start Kinesis
5. Delete or fix failed SageMaker endpoint
