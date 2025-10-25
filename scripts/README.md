# AWS Resource Manager

Comprehensive script to manage AWS resources for the User Journey Analytics project, enabling zero-cost operation when resources are not in use.

## Features

✅ **SageMaker Endpoint Management** - Stop/start ML endpoints (saves ~$47/month)  
✅ **Kinesis Stream Scaling** - Scale between 1-2 shards (saves ~$11/month)  
✅ **Lambda Concurrency Control** - Prevent invocations when not needed  
✅ **CloudWatch Alarm Management** - Disable/enable alarms (saves ~$1/month)  
✅ **State Persistence** - Saves configuration before stopping, restores on start  
✅ **Dry-Run Mode** - Preview changes before executing  
✅ **Cost Estimation** - Shows current and potential savings  

## Quick Start

### Check Current Status
```bash
./scripts/aws-resource-manager.sh status
```

### Stop All Resources (Save Money)
```bash
# Preview what will be stopped
./scripts/aws-resource-manager.sh stop --dry-run

# Actually stop resources
./scripts/aws-resource-manager.sh stop
```

### Start All Resources
```bash
# Preview what will be started
./scripts/aws-resource-manager.sh start --dry-run

# Actually start resources
./scripts/aws-resource-manager.sh start
```

## Commands

### `status`
Shows current state of all AWS resources and estimated costs.

**Example Output:**
```
AWS Resource Status
===================
1. SageMaker Endpoint: InService (~$1.56/day)
2. Kinesis Stream: 2 shards (~$0.72/day)
3. Lambda Functions: No limits
4. CloudWatch Alarms: 9 alarms (~$0.03/day)

Daily cost: ~$2.31
Monthly cost: ~$69.30
```

### `stop`
Stops or scales down all billable resources to minimize costs.

**What it does:**
- Deletes SageMaker endpoint (preserves endpoint config)
- Scales Kinesis stream from 2 shards to 1
- Sets Lambda reserved concurrency to 0 (prevents invocations)
- Disables CloudWatch alarms (preserves configurations)
- Saves current state to `config/aws-resource-state.json`

**Options:**
- `--dry-run` - Show what would be done without making changes
- `--force` - Skip confirmation prompt

**Example:**
```bash
# Preview changes
./scripts/aws-resource-manager.sh stop --dry-run

# Stop with confirmation
./scripts/aws-resource-manager.sh stop

# Stop without confirmation
./scripts/aws-resource-manager.sh stop --force
```

**Expected Savings:**
- Daily: ~$1.95
- Monthly: ~$58.50

### `start`
Restarts all resources from saved state.

**What it does:**
- Recreates SageMaker endpoint from saved config
- Scales Kinesis stream back to original shard count
- Removes Lambda concurrency limits
- Re-enables CloudWatch alarms

**Options:**
- `--dry-run` - Show what would be done without making changes

**Example:**
```bash
# Preview changes
./scripts/aws-resource-manager.sh start --dry-run

# Start resources
./scripts/aws-resource-manager.sh start
```

**Note:** SageMaker endpoint takes 5-10 minutes to become operational.

## Resources Managed

### 1. SageMaker Endpoint
- **Name:** `user-journey-analytics-exit-risk-endpoint`
- **Instance:** ml.t2.medium
- **Cost:** ~$1.56/day ($47/month)
- **Stop Action:** Delete endpoint (config preserved)
- **Start Action:** Recreate from config

### 2. Kinesis Data Stream
- **Name:** `user-journey-analytics-user-events`
- **Normal:** 2 shards
- **Optimized:** 1 shard
- **Cost:** ~$0.36/shard/day
- **Savings:** ~$0.36/day when scaled down

### 3. Lambda Functions
- **Functions:** `event_processor`, `intervention-executor`
- **Stop Action:** Set reserved concurrency to 0
- **Start Action:** Remove concurrency limit
- **Cost:** $0 when idle (only charged on invocation)

### 4. CloudWatch Alarms
- **Count:** 9 alarms
- **Cost:** ~$0.10/alarm/month
- **Stop Action:** Disable alarm actions
- **Start Action:** Enable alarm actions

### 5. DynamoDB Tables (Not Modified)
- **Billing:** On-demand (pay per request)
- **Cost:** $0 when idle
- **Action:** No changes needed

## Cost Breakdown

### Current State (All Running)
| Resource | Daily Cost | Monthly Cost |
|----------|-----------|--------------|
| SageMaker Endpoint | $1.56 | $47.00 |
| Kinesis (2 shards) | $0.72 | $22.00 |
| CloudWatch Alarms | $0.03 | $1.00 |
| **Total** | **$2.31** | **$69.30** |

### Optimized State (After Stop)
| Resource | Daily Cost | Monthly Cost |
|----------|-----------|--------------|
| SageMaker Endpoint | $0.00 | $0.00 |
| Kinesis (1 shard) | $0.36 | $11.00 |
| CloudWatch Alarms | $0.00 | $0.00 |
| **Total** | **$0.36** | **$10.80** |

**Monthly Savings: $58.50**

## State File

The script saves resource configuration to `config/aws-resource-state.json` before stopping resources.

**Example State File:**
```json
{
  "timestamp": "2025-10-24T18:30:00Z",
  "project": "user-journey-analytics",
  "sagemaker": {
    "endpoint_name": "user-journey-analytics-exit-risk-endpoint",
    "endpoint_config": "user-journey-analytics-exit-risk-endpoint-config"
  },
  "kinesis": {
    "stream_name": "user-journey-analytics-user-events",
    "shard_count": 2
  },
  "lambda": [
    {"name": "event_processor", "reserved_concurrency": 0},
    {"name": "intervention-executor", "reserved_concurrency": 0}
  ],
  "cloudwatch": {
    "alarm_count": 9
  }
}
```

## Logs

All operations are logged to `logs/aws-resource-manager.log` with timestamps.

**Example Log Entry:**
```
[2025-10-24 18:30:15] [INFO] Stopping AWS Resources
[2025-10-24 18:30:16] [INFO] SageMaker endpoint deleted
[2025-10-24 18:30:18] [SUCCESS] Kinesis scaled down to 1 shard
[2025-10-24 18:30:20] [SUCCESS] All resources stopped successfully!
```

## Prerequisites

- AWS CLI installed and configured
- Appropriate IAM permissions for:
  - SageMaker (DescribeEndpoint, DeleteEndpoint, CreateEndpoint)
  - Kinesis (DescribeStream, UpdateShardCount)
  - Lambda (GetFunction, PutFunctionConcurrency, DeleteFunctionConcurrency)
  - CloudWatch (DescribeAlarms, DisableAlarmActions, EnableAlarmActions)
- `jq` command-line JSON processor
- `bc` calculator for cost calculations

## Installation

```bash
# Make script executable
chmod +x scripts/aws-resource-manager.sh

# Test with status command
./scripts/aws-resource-manager.sh status
```

## Use Cases

### Daily Development
Stop resources at end of day, start in the morning:
```bash
# End of day
./scripts/aws-resource-manager.sh stop

# Start of day
./scripts/aws-resource-manager.sh start
```

### Weekend Shutdown
Stop resources on Friday, start on Monday:
```bash
# Friday evening
./scripts/aws-resource-manager.sh stop

# Monday morning
./scripts/aws-resource-manager.sh start
```

### Demo Preparation
Ensure all resources are running before a demo:
```bash
# Check status
./scripts/aws-resource-manager.sh status

# Start if needed
./scripts/aws-resource-manager.sh start

# Wait 10 minutes for SageMaker endpoint
```

## Troubleshooting

### State File Not Found
If you try to start without a state file:
```
ERROR: State file not found: config/aws-resource-state.json
Cannot restore resources without saved state
```

**Solution:** Run `stop` command first to create the state file, or manually create the state file with your desired configuration.

### SageMaker Endpoint Takes Long Time
SageMaker endpoints take 5-10 minutes to create. This is normal AWS behavior.

**Check Status:**
```bash
aws sagemaker describe-endpoint \
  --endpoint-name user-journey-analytics-exit-risk-endpoint \
  --query 'EndpointStatus'
```

### Kinesis Scaling Fails
Kinesis can only scale by doubling or halving shard count.

**Valid Transitions:**
- 1 → 2 shards ✅
- 2 → 1 shard ✅
- 2 → 3 shards ❌

### Permission Denied
Ensure your AWS credentials have the necessary permissions listed in Prerequisites.

## Safety Features

1. **Confirmation Prompt** - Asks for confirmation before stopping (unless `--force` is used)
2. **Dry-Run Mode** - Preview changes without executing
3. **State Backup** - Saves configuration before making changes
4. **Detailed Logging** - All operations logged with timestamps
5. **Error Handling** - Continues with other resources if one fails

## Future Enhancements

- [ ] Scheduled automation (cron jobs)
- [ ] Slack/email notifications
- [ ] Cost tracking over time
- [ ] Multi-region support
- [ ] Resource group filtering
- [ ] Terraform state integration

## Support

For issues or questions:
1. Check the logs: `cat logs/aws-resource-manager.log`
2. Run with dry-run: `./scripts/aws-resource-manager.sh stop --dry-run`
3. Check AWS console for resource status
4. Review state file: `cat config/aws-resource-state.json`

## License

Part of the User Journey Analytics project.
