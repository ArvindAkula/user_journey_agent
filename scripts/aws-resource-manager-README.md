# AWS Resource Manager - User Journey Analytics

Complete documentation for the AWS Cost Management System that enables zero-cost operation when resources are not actively needed.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Cost Savings](#cost-savings)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)
- [FAQ](#faq)

## Overview

The AWS Resource Manager is a comprehensive cost management system that allows you to:

- **Stop all AWS resources** with a single command to achieve zero or near-zero AWS costs
- **Start resources on-demand** when needed for demos, development, or production
- **Preview changes** with dry-run mode before executing
- **Track costs** in real-time with detailed breakdowns
- **Preserve data** while stopping services (no data loss)
- **Audit operations** with comprehensive logging and reporting

### What Gets Managed

The system manages the following AWS resources for the User Journey Analytics project:

| Resource Type | Stop Action | Cost Savings | Start Action |
|--------------|-------------|--------------|--------------|
| **SageMaker Endpoints** | Delete endpoint (preserve config) | ~$1.56/day | Recreate from config |
| **Kinesis Streams** | Scale down to 1 shard | ~$0.36/day | Restore original shard count |
| **Lambda Functions** | Set concurrency to 0 | $0 (prevents invocations) | Remove concurrency limit |
| **CloudWatch Alarms** | Disable alarm actions | ~$0.03/day | Re-enable alarm actions |
| **DynamoDB Tables** | No action (on-demand) | $0 (already optimized) | No action needed |

**Total Estimated Savings: ~$2/day or ~$60/month**

### Key Features

- ✅ **Safe Operations**: Dry-run mode and confirmation prompts
- ✅ **State Preservation**: Saves configurations before stopping
- ✅ **Idempotent**: Can be run multiple times safely
- ✅ **Fast Recovery**: Resources restored in minutes
- ✅ **No Data Loss**: All data preserved in DynamoDB and S3
- ✅ **Comprehensive Logging**: Full audit trail of all operations
- ✅ **Cost Transparency**: Real-time cost estimates

## Installation

### Prerequisites

1. **AWS CLI** (version 2.x or higher)
   ```bash
   # Check if installed
   aws --version
   
   # Install on macOS
   brew install awscli
   
   # Install on Linux
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   ```

2. **Python 3.8+** (for cost calculation and dry-run features)
   ```bash
   python3 --version
   ```

3. **jq** (for JSON processing)
   ```bash
   # macOS
   brew install jq
   
   # Linux
   sudo apt-get install jq
   ```

4. **AWS Credentials** configured with appropriate permissions
   ```bash
   aws configure
   ```

### Required IAM Permissions

Your AWS user/role needs the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:GetFunction",
        "lambda:GetFunctionConcurrency",
        "lambda:PutFunctionConcurrency",
        "lambda:DeleteFunctionConcurrency"
      ],
      "Resource": "arn:aws:lambda:*:*:function:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "sagemaker:DescribeEndpoint",
        "sagemaker:DeleteEndpoint",
        "sagemaker:CreateEndpoint"
      ],
      "Resource": "arn:aws:sagemaker:*:*:endpoint/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "kinesis:DescribeStream",
        "kinesis:UpdateShardCount"
      ],
      "Resource": "arn:aws:kinesis:*:*:stream/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:DescribeAlarms",
        "cloudwatch:DisableAlarmActions",
        "cloudwatch:EnableAlarmActions"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:ListTables",
        "dynamodb:DescribeTable"
      ],
      "Resource": "*"
    }
  ]
}
```

### Setup Steps

1. **Clone the repository** (if not already done)
   ```bash
   cd /path/to/user-journey-analytics
   ```

2. **Make the script executable**
   ```bash
   chmod +x scripts/aws-resource-manager.sh
   ```

3. **Install Python dependencies** (for dry-run and cost calculation)
   ```bash
   cd backend/cost-management
   pip3 install -r requirements.txt
   ```

4. **Verify installation**
   ```bash
   ./scripts/aws-resource-manager.sh --help
   ```

## Quick Start

### Check Current Status

See what resources are running and their costs:

```bash
./scripts/aws-resource-manager.sh status
```

### Preview Stop Operation (Dry Run)

See what would be stopped without making changes:

```bash
./scripts/aws-resource-manager.sh stop --dry-run
```

### Stop All Resources

Stop all resources to save costs:

```bash
./scripts/aws-resource-manager.sh stop
```

You'll be prompted to confirm. To skip confirmation:

```bash
./scripts/aws-resource-manager.sh stop --force
```

### Start All Resources

Restore all resources from saved state:

```bash
./scripts/aws-resource-manager.sh start
```

## Usage

### Command Reference

#### `status` - Show Resource Status

Displays current state of all resources and estimated costs.

```bash
./scripts/aws-resource-manager.sh status
```

**Output includes:**
- Status of each resource type
- Current configuration (shards, instances, etc.)
- Estimated daily and monthly costs
- Optimization recommendations

**Example output:**
```
=========================================
AWS Resource Status
=========================================

1. SageMaker Endpoint
-------------------
Status: InService
Instance: ml.m5.large
Cost: ~$1.56/day

2. Kinesis Data Stream
-------------------
Status: ACTIVE
Shards: 2
Cost: ~$0.72/day

...

Cost Summary
=========================================
Daily cost: ~$2.31
Monthly cost: ~$69.30

💡 Tip: Run './scripts/aws-resource-manager.sh stop' to reduce costs
```

#### `stop` - Stop All Resources

Stops or scales down all resources to minimize costs.

```bash
./scripts/aws-resource-manager.sh stop [OPTIONS]
```

**Options:**
- `--dry-run`: Preview changes without executing
- `--force`: Skip confirmation prompt

**What happens:**
1. Saves current state to `config/aws-resource-state.json`
2. Deletes SageMaker endpoints (preserves configs)
3. Scales Kinesis streams to 1 shard
4. Sets Lambda concurrency to 0
5. Disables CloudWatch alarms
6. Generates operation report

**Example:**
```bash
# Preview first
./scripts/aws-resource-manager.sh stop --dry-run

# Execute
./scripts/aws-resource-manager.sh stop

# Or skip confirmation
./scripts/aws-resource-manager.sh stop --force
```

#### `start` - Start All Resources

Restores all resources from saved state.

```bash
./scripts/aws-resource-manager.sh start [OPTIONS]
```

**Options:**
- `--dry-run`: Preview changes without executing

**What happens:**
1. Loads state from `config/aws-resource-state.json`
2. Recreates SageMaker endpoints (5-10 minutes)
3. Scales Kinesis streams to original shard count
4. Removes Lambda concurrency limits
5. Re-enables CloudWatch alarms
6. Verifies resources are operational

**Example:**
```bash
# Preview first
./scripts/aws-resource-manager.sh start --dry-run

# Execute
./scripts/aws-resource-manager.sh start
```

### Advanced Usage

#### Using Python Dry-Run Module

For more detailed dry-run analysis with cost breakdowns:

```bash
cd backend/cost-management

# Simulate stop operation
python3 cli_dry_run.py stop --resources ../../config/aws-current-resources.json

# Simulate start operation
python3 cli_dry_run.py start \
  --state ../../config/aws-resource-state.json \
  --resources ../../config/aws-current-resources.json

# Output as JSON
python3 cli_dry_run.py stop --format json
```

#### Scheduling with Cron

Automatically stop resources at night and start in the morning:

```bash
# Edit crontab
crontab -e

# Stop at 6 PM weekdays
0 18 * * 1-5 cd /path/to/project && ./scripts/aws-resource-manager.sh stop --force

# Start at 8 AM weekdays
0 8 * * 1-5 cd /path/to/project && ./scripts/aws-resource-manager.sh start
```

## Configuration

### Configuration File

The system uses `config/aws-resource-manager.conf` for configuration (optional):

```bash
# Project identification
PROJECT_NAME="user-journey-analytics"
ENVIRONMENT="prod"

# AWS Configuration
AWS_REGION="us-east-1"
AWS_PROFILE="default"

# State Management
STATE_FILE="config/aws-resource-state.json"
STATE_BACKUP_S3_BUCKET=""  # Optional S3 backup

# Notifications
SNS_TOPIC_ARN=""  # Optional SNS notifications

# Behavior
REQUIRE_CONFIRMATION=true
DRY_RUN_DEFAULT=false
PARALLEL_OPERATIONS=true
MAX_WORKERS=10
```

### State File

The state file (`config/aws-resource-state.json`) stores resource configurations:

```json
{
  "timestamp": "2025-10-25T14:30:00Z",
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
    {
      "name": "event_processor",
      "reserved_concurrency": 0
    },
    {
      "name": "intervention-executor",
      "reserved_concurrency": 0
    }
  ],
  "cloudwatch": {
    "alarm_count": 9
  }
}
```

**Important:** Never commit this file to version control as it may contain sensitive information.

### Log Files

Logs are written to:
- **Console**: Colored output with INFO level
- **File**: `logs/aws-resource-manager.log` with DEBUG level
- **Operations**: `logs/operations/` directory for operation reports

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI Interface                            │
│              (scripts/aws-resource-manager.sh)               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├─── stop command
                     ├─── start command
                     └─── status command
                     │
┌────────────────────┴────────────────────────────────────────┐
│                  Python Modules                              │
│         (backend/cost-management/*.py)                       │
├──────────────────────────────────────────────────────────────┤
│  • dry_run.py          - Simulation engine                   │
│  • cost_calculator.py  - Cost estimation                     │
│  • audit_trail.py      - Operation tracking                  │
│  • error_handler.py    - Error handling & retry              │
│  • logging_config.py   - Logging setup                       │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────────┐
│                    AWS Services                              │
├──────────────────────────────────────────────────────────────┤
│  • SageMaker       - ML endpoints                            │
│  • Kinesis         - Data streams                            │
│  • Lambda          - Functions                               │
│  • CloudWatch      - Alarms & logs                           │
│  • DynamoDB        - Tables                                  │
└──────────────────────────────────────────────────────────────┘
```

### Operation Flow

#### Stop Operation
```
1. User runs: ./scripts/aws-resource-manager.sh stop
2. Script prompts for confirmation (unless --force)
3. Current state is saved to config/aws-resource-state.json
4. Resources are stopped/scaled down in order:
   a. SageMaker endpoints deleted
   b. Kinesis streams scaled to 1 shard
   c. Lambda concurrency set to 0
   d. CloudWatch alarms disabled
5. Operation report generated
6. Cost savings displayed
```

#### Start Operation
```
1. User runs: ./scripts/aws-resource-manager.sh start
2. Script loads state from config/aws-resource-state.json
3. Resources are started/scaled up in order:
   a. SageMaker endpoints recreated
   b. Kinesis streams scaled to original count
   c. Lambda concurrency limits removed
   d. CloudWatch alarms re-enabled
4. Resources verified operational
5. Operation report generated
```

## Cost Savings

### Detailed Cost Breakdown

#### SageMaker Endpoints

**Current Cost (Running):**
- Instance: ml.m5.large
- Cost: $0.115/hour × 24 hours = $2.76/day
- Monthly: ~$82.80

**Optimized Cost (Stopped):**
- Endpoint deleted, config preserved
- Cost: $0/day
- **Savings: $2.76/day or $82.80/month**

**Note:** Endpoint takes 5-10 minutes to recreate when starting.

#### Kinesis Data Streams

**Current Cost (2 shards):**
- Shard cost: $0.015/hour × 2 shards × 24 hours = $0.72/day
- Monthly: ~$21.60

**Optimized Cost (1 shard):**
- Shard cost: $0.015/hour × 1 shard × 24 hours = $0.36/day
- Monthly: ~$10.80
- **Savings: $0.36/day or $10.80/month**

**Note:** 1 shard supports up to 1 MB/sec input, 2 MB/sec output.

#### Lambda Functions

**Current Cost (Active):**
- No idle cost
- Only charged per invocation
- Cost: $0/day when not invoked

**Optimized Cost (Concurrency = 0):**
- Prevents all invocations
- Cost: $0/day
- **Savings: Prevents unexpected charges**

**Note:** Functions cannot be invoked when concurrency is 0.

#### CloudWatch Alarms

**Current Cost (9 alarms enabled):**
- Alarm cost: $0.10/month per alarm
- Total: $0.90/month or ~$0.03/day

**Optimized Cost (Alarms disabled):**
- Alarms preserved but actions disabled
- Cost: $0/day
- **Savings: $0.03/day or $0.90/month**

**Note:** Alarms don't send notifications when disabled.

### Total Savings Summary

| Scenario | Daily Cost | Monthly Cost | Annual Cost |
|----------|-----------|--------------|-------------|
| **All Running** | $3.51 | $105.30 | $1,263.60 |
| **All Stopped** | $0.36 | $10.80 | $129.60 |
| **Savings** | **$3.15** | **$94.50** | **$1,134.00** |

**Savings Percentage: 90%**

### Cost Optimization Strategies

1. **Development Mode**: Stop resources overnight and weekends
   - Savings: ~$2.25/day × 16 hours/day = ~$36/day
   - Monthly: ~$1,080

2. **Demo Mode**: Stop resources except during demos
   - Savings: ~$3.15/day × 25 days/month = ~$78.75/month

3. **Production Mode**: Keep resources running, optimize configurations
   - Use on-demand billing for DynamoDB
   - Right-size SageMaker instances
   - Optimize Kinesis shard count

## Troubleshooting

### Common Issues

#### Issue: "AWS CLI is not installed"

**Solution:**
```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Verify
aws --version
```

#### Issue: "State file not found"

**Error:**
```
[ERROR] State file not found: config/aws-resource-state.json
Cannot restore resources without saved state
```

**Solution:**
1. Run `stop` command first to create state file:
   ```bash
   ./scripts/aws-resource-manager.sh stop
   ```

2. Or manually create state file from current resources:
   ```bash
   # Get current resource configurations from AWS
   # Save to config/aws-resource-state.json
   ```

#### Issue: "Permission denied" errors

**Error:**
```
An error occurred (AccessDeniedException) when calling the DescribeEndpoint operation
```

**Solution:**
1. Check IAM permissions (see [Required IAM Permissions](#required-iam-permissions))
2. Verify AWS credentials:
   ```bash
   aws sts get-caller-identity
   ```
3. Check AWS profile:
   ```bash
   export AWS_PROFILE=your-profile
   ```

#### Issue: SageMaker endpoint stuck in "Creating" state

**Symptoms:**
- Endpoint shows "Creating" status for > 15 minutes
- Start operation appears to hang

**Solution:**
1. Check endpoint status:
   ```bash
   aws sagemaker describe-endpoint \
     --endpoint-name user-journey-analytics-exit-risk-endpoint
   ```

2. Check for errors in endpoint events:
   ```bash
   aws sagemaker describe-endpoint \
     --endpoint-name user-journey-analytics-exit-risk-endpoint \
     --query 'ProductionVariants[0].DesiredInstanceCount'
   ```

3. If stuck, delete and recreate:
   ```bash
   aws sagemaker delete-endpoint \
     --endpoint-name user-journey-analytics-exit-risk-endpoint
   
   # Wait a few minutes, then run start again
   ./scripts/aws-resource-manager.sh start
   ```

#### Issue: Kinesis shard count not updating

**Symptoms:**
- Shard count remains the same after stop/start
- "ResourceInUseException" error

**Solution:**
1. Check stream status:
   ```bash
   aws kinesis describe-stream \
     --stream-name user-journey-analytics-user-events
   ```

2. Wait for stream to be in ACTIVE state
3. Retry operation:
   ```bash
   ./scripts/aws-resource-manager.sh stop
   ```

#### Issue: Lambda concurrency not updating

**Symptoms:**
- Functions still processing events after stop
- Concurrency shows as "unlimited"

**Solution:**
1. Verify concurrency setting:
   ```bash
   aws lambda get-function-concurrency \
     --function-name event_processor
   ```

2. Manually set concurrency:
   ```bash
   aws lambda put-function-concurrency \
     --function-name event_processor \
     --reserved-concurrent-executions 0
   ```

### Debugging

#### Enable Debug Logging

```bash
# Set log level to DEBUG
export LOG_LEVEL=DEBUG

# Run command
./scripts/aws-resource-manager.sh status

# Check logs
tail -f logs/aws-resource-manager.log
```

#### Dry-Run Mode

Always test with dry-run first:

```bash
# Preview stop operation
./scripts/aws-resource-manager.sh stop --dry-run

# Preview start operation
./scripts/aws-resource-manager.sh start --dry-run
```

#### Manual Resource Inspection

```bash
# Check SageMaker endpoints
aws sagemaker list-endpoints

# Check Kinesis streams
aws kinesis list-streams

# Check Lambda functions
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `user-journey`)]'

# Check CloudWatch alarms
aws cloudwatch describe-alarms --alarm-name-prefix user-journey-analytics
```

### Getting Help

1. **Check logs**: `logs/aws-resource-manager.log`
2. **Run status command**: `./scripts/aws-resource-manager.sh status`
3. **Use dry-run mode**: `./scripts/aws-resource-manager.sh stop --dry-run`
4. **Review state file**: `cat config/aws-resource-state.json | jq`
5. **Check AWS Console**: Verify resource states manually

## Best Practices

### Before Stopping Resources

1. ✅ **Run dry-run first**
   ```bash
   ./scripts/aws-resource-manager.sh stop --dry-run
   ```

2. ✅ **Check current status**
   ```bash
   ./scripts/aws-resource-manager.sh status
   ```

3. ✅ **Verify no active users/processes**
   - Check application logs
   - Verify no active sessions
   - Confirm no scheduled jobs running

4. ✅ **Backup state file**
   ```bash
   cp config/aws-resource-state.json config/aws-resource-state.backup.json
   ```

5. ✅ **Notify team members** (if applicable)

### After Stopping Resources

1. ✅ **Verify resources stopped**
   ```bash
   ./scripts/aws-resource-manager.sh status
   ```

2. ✅ **Check AWS billing dashboard** after 24 hours

3. ✅ **Keep state file safe**
   - Don't delete `config/aws-resource-state.json`
   - Consider backing up to S3

### Before Starting Resources

1. ✅ **Verify state file exists**
   ```bash
   ls -la config/aws-resource-state.json
   ```

2. ✅ **Run dry-run first**
   ```bash
   ./scripts/aws-resource-manager.sh start --dry-run
   ```

3. ✅ **Check AWS service health**
   - Verify no AWS outages
   - Check service quotas

### After Starting Resources

1. ✅ **Verify all resources operational**
   ```bash
   ./scripts/aws-resource-manager.sh status
   ```

2. ✅ **Test application functionality**
   - Send test events
   - Verify data processing
   - Check endpoints responding

3. ✅ **Monitor for 15 minutes**
   - Watch CloudWatch logs
   - Check for errors
   - Verify metrics

### Security Best Practices

1. ✅ **Use IAM roles** instead of access keys when possible
2. ✅ **Apply least privilege** permissions
3. ✅ **Never commit** state files to version control
4. ✅ **Rotate credentials** regularly
5. ✅ **Enable CloudTrail** for audit logging
6. ✅ **Use MFA** for production accounts

### Cost Optimization Best Practices

1. ✅ **Stop resources** when not needed (nights, weekends)
2. ✅ **Use on-demand billing** for DynamoDB
3. ✅ **Right-size instances** (don't over-provision)
4. ✅ **Monitor costs** regularly with AWS Cost Explorer
5. ✅ **Set up billing alerts** for unexpected charges
6. ✅ **Review and optimize** monthly

## FAQ

### General Questions

**Q: Will I lose data when stopping resources?**

A: No. All data in DynamoDB and S3 is preserved. Only compute resources (SageMaker, Lambda) are stopped. Kinesis streams are scaled down but not deleted.

**Q: How long does it take to stop resources?**

A: Typically 2-5 minutes. SageMaker endpoint deletion is the slowest operation.

**Q: How long does it take to start resources?**

A: 5-15 minutes. SageMaker endpoint creation takes the longest (5-10 minutes).

**Q: Can I stop only specific resources?**

A: Currently, the script stops all resources. For selective stopping, you can modify the script or use AWS CLI directly.

**Q: What happens if the start operation fails?**

A: The script will log errors and continue with other resources. Check logs and retry. Resources can be started manually via AWS Console if needed.

**Q: Can I run this in production?**

A: Yes, but test thoroughly in development first. Use dry-run mode and schedule stops during maintenance windows.

### Cost Questions

**Q: How much will I actually save?**

A: Approximately $3.15/day or $94.50/month when all resources are stopped. Actual savings depend on your usage patterns.

**Q: Are there any costs when resources are stopped?**

A: Minimal. Kinesis with 1 shard costs ~$0.36/day. DynamoDB on-demand has no idle cost. S3 storage costs remain.

**Q: Will I be charged for data transfer?**

A: Data transfer charges apply when starting/stopping resources, but these are typically negligible (< $0.01).

### Technical Questions

**Q: What if I lose the state file?**

A: You can manually recreate resources using AWS Console or Terraform. The state file just makes it easier to restore exact configurations.

**Q: Can I customize which resources are managed?**

A: Yes. Edit `scripts/aws-resource-manager.sh` and modify the resource lists. You can also create custom scripts for specific resource groups.

**Q: Does this work with multiple AWS accounts?**

A: Yes. Use AWS profiles:
```bash
export AWS_PROFILE=dev-account
./scripts/aws-resource-manager.sh stop
```

**Q: Can I schedule automatic stop/start?**

A: Yes. Use cron jobs (see [Scheduling with Cron](#scheduling-with-cron)).

**Q: What about Terraform-managed resources?**

A: This script works alongside Terraform. It modifies resource configurations (shard count, concurrency) without changing Terraform state. To fully integrate, consider using Terraform variables for these settings.

### Troubleshooting Questions

**Q: Why is my SageMaker endpoint not starting?**

A: Common causes:
- Insufficient service quota
- Invalid endpoint configuration
- IAM permission issues
- Check CloudWatch logs for details

**Q: Why are Lambda functions still being invoked after stop?**

A: Verify concurrency is set to 0:
```bash
aws lambda get-function-concurrency --function-name event_processor
```

**Q: Can I undo a stop operation?**

A: Yes. Run the start command:
```bash
./scripts/aws-resource-manager.sh start
```

## Additional Resources

### Documentation

- [AWS Cost Management Best Practices](https://docs.aws.amazon.com/cost-management/)
- [SageMaker Pricing](https://aws.amazon.com/sagemaker/pricing/)
- [Kinesis Pricing](https://aws.amazon.com/kinesis/data-streams/pricing/)
- [Lambda Pricing](https://aws.amazon.com/lambda/pricing/)

### Related Files

- `backend/cost-management/README.md` - Python modules documentation
- `backend/cost-management/DRY_RUN_QUICK_START.md` - Dry-run mode guide
- `.kiro/specs/aws-cost-zero-management/design.md` - System design document
- `.kiro/specs/aws-cost-zero-management/requirements.md` - Requirements specification

### Support

For issues or questions:
1. Check this documentation
2. Review logs in `logs/aws-resource-manager.log`
3. Run dry-run mode to diagnose issues
4. Check AWS Console for resource states
5. Review operation reports in `logs/operations/`

---

**Version:** 1.0.0  
**Last Updated:** October 25, 2025  
**Maintained by:** User Journey Analytics Team
