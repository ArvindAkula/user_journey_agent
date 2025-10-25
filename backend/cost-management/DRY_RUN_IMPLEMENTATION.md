# Dry-Run Mode Implementation

## Overview

The dry-run mode allows you to simulate AWS resource management operations (stop/start) without making any actual changes. This helps you:

- Preview what changes would be made
- Estimate cost impact before execution
- Identify potential errors and issues
- Assess risk levels of proposed changes
- Make informed decisions about resource management

## Components

### 1. Core Modules

#### `dry_run.py`
Contains the main simulation logic:

- **`DryRunSimulator`**: Simulates stop and start operations
  - Calculates cost impacts
  - Identifies resource changes
  - Applies business logic without AWS API calls
  
- **`DryRunValidator`**: Validates operations before execution
  - Checks for missing resources
  - Validates state files
  - Identifies dependency issues
  
- **`ResourceChange`**: Represents a single resource change
  - Tracks before/after state
  - Calculates cost impact
  - Assigns risk level
  - Records warnings
  
- **`DryRunResult`**: Complete simulation result
  - All proposed changes
  - Total cost impact
  - Current vs. proposed costs
  - Errors and warnings

#### `dry_run_reporter.py`
Generates formatted reports:

- **`DryRunReporter`**: Creates reports in multiple formats
  - Text reports with colors and formatting
  - JSON reports for automation
  - Summary views
  - Change tables
  - Saves reports to files

#### `cli_dry_run.py`
CLI integration for bash scripts:

- Loads current resources from JSON
- Loads saved state from JSON
- Runs simulations
- Outputs results in text or JSON format
- Returns appropriate exit codes

### 2. Data Models

#### Change Types
- `CREATE`: Create new resource
- `UPDATE`: Update existing resource
- `DELETE`: Delete resource
- `ENABLE`: Enable resource
- `DISABLE`: Disable resource
- `SCALE_UP`: Increase capacity
- `SCALE_DOWN`: Decrease capacity

#### Risk Levels
- `LOW`: Safe changes with minimal impact
- `MEDIUM`: Changes that may affect performance
- `HIGH`: Changes that will interrupt service
- `CRITICAL`: Changes with severe consequences

## Usage

### Python API

#### Simulate Stop Operation

```python
from dry_run import DryRunSimulator
from dry_run_reporter import DryRunReporter

# Current resources (from AWS)
current_resources = {
    'kinesis': [
        {'name': 'my-stream', 'shard_count': 2, 'status': 'ACTIVE'}
    ],
    'lambda': [
        {'name': 'my-function', 'reserved_concurrency': None}
    ],
    'sagemaker': [
        {'name': 'my-endpoint', 'status': 'InService', 'instance_type': 'ml.m5.large'}
    ],
    'cloudwatch': [
        {'name': 'my-alarm', 'enabled': True}
    ]
}

# Create simulator
simulator = DryRunSimulator()

# Simulate stop operation
result = simulator.simulate_stop_operation(current_resources)

# Display results
reporter = DryRunReporter(use_colors=True)
reporter.print_report(result)

# Check for issues
if result.has_errors:
    print("Cannot proceed - errors detected:")
    for error in result.errors:
        print(f"  - {error}")
    exit(1)

if result.high_risk_changes:
    print(f"Warning: {len(result.high_risk_changes)} high-risk changes")
    for change in result.high_risk_changes:
        print(f"  - {change.resource_id}: {change.risk_level.value}")

print(f"Estimated savings: ${result.total_cost_impact:.2f}/month")
```

#### Simulate Start Operation

```python
from dry_run import DryRunSimulator
from dry_run_reporter import DryRunReporter

# Saved state (from state file)
saved_state = {
    'version': '1.0',
    'timestamp': '2025-10-25T10:00:00Z',
    'kinesis': {
        'stream_name': 'my-stream',
        'shard_count': 2
    },
    'lambda': [
        {'name': 'my-function', 'reserved_concurrency': None}
    ],
    'sagemaker': {
        'endpoint_name': 'my-endpoint',
        'endpoint_config': 'my-endpoint-config'
    }
}

# Current resources (after stop)
current_resources = {
    'kinesis': [
        {'name': 'my-stream', 'shard_count': 1, 'status': 'ACTIVE'}
    ],
    'lambda': [
        {'name': 'my-function', 'reserved_concurrency': 0}
    ],
    'sagemaker': [],  # Endpoint deleted
    'cloudwatch': [
        {'name': 'my-alarm', 'enabled': False}
    ]
}

# Simulate start operation
simulator = DryRunSimulator()
result = simulator.simulate_start_operation(saved_state, current_resources)

# Display results
reporter = DryRunReporter(use_colors=True)
reporter.print_report(result)

print(f"Estimated cost increase: ${abs(result.total_cost_impact):.2f}/month")
```

### Command Line Interface

#### Using the CLI Script

```bash
# Simulate stop operation (text output)
python3 backend/cost-management/cli_dry_run.py stop \
    --resources config/aws-current-resources.json \
    --format text

# Simulate stop operation (JSON output)
python3 backend/cost-management/cli_dry_run.py stop \
    --resources config/aws-current-resources.json \
    --format json

# Simulate start operation
python3 backend/cost-management/cli_dry_run.py start \
    --state config/aws-resource-state.json \
    --resources config/aws-current-resources.json \
    --format text

# Quiet mode (no logging)
python3 backend/cost-management/cli_dry_run.py stop \
    --resources config/aws-current-resources.json \
    --quiet
```

#### Exit Codes

- `0`: Success (no errors detected)
- `1`: Errors detected (operation should not proceed)

### Bash Script Integration

The main bash script (`scripts/aws-resource-manager.sh`) already supports dry-run mode:

```bash
# Dry-run stop operation
./scripts/aws-resource-manager.sh stop --dry-run

# Dry-run start operation
./scripts/aws-resource-manager.sh start --dry-run

# Regular status (always safe, no changes)
./scripts/aws-resource-manager.sh status
```

## Report Formats

### Text Report

Human-readable report with:
- Color-coded output (risk levels, cost impacts)
- Summary section (total changes, high-risk count, cost impact)
- Cost comparison (current vs. proposed)
- Detailed changes by resource type
- Change symbols (➕ create, 🔄 update, 🗑️ delete, ✅ enable, ⏸️ disable, 📈 scale up, 📉 scale down)
- Risk level indicators
- Warnings and errors
- High-risk change alerts

Example:
```
================================================================================
DRY RUN SIMULATION REPORT
================================================================================
Operation:  STOP
Timestamp:  2025-10-25 14:07:17 UTC
Mode:       SIMULATION ONLY - NO CHANGES WILL BE MADE

--------------------------------------------------------------------------------
SUMMARY
--------------------------------------------------------------------------------
Total changes:      4
High-risk changes:  2
Cost impact:        +$93.70/month (savings)

--------------------------------------------------------------------------------
COST COMPARISON
--------------------------------------------------------------------------------
Current monthly cost:   $    104.50
Proposed monthly cost:  $     10.80
Difference:             $     93.70

--------------------------------------------------------------------------------
PROPOSED CHANGES
--------------------------------------------------------------------------------

KINESIS STREAM:
----------------------------------------

📉 my-stream
  Action:      Scale Down
  Risk Level:  LOW
  Cost Impact: +$10.80/month
  Current:     shard_count=2
  Proposed:    shard_count=1

LAMBDA FUNCTION:
----------------------------------------

⏸️ my-function
  Action:      Disable
  Risk Level:  HIGH
  Cost Impact: $0.00/month
  Current:     reserved_concurrency=unlimited
  Proposed:    reserved_concurrency=0
  Warnings:
    - Function will not be able to process any requests
    - Event source mappings will be paused

⚠️  HIGH-RISK CHANGES DETECTED
--------------------------------------------------------------------------------
The following changes have been identified as high or critical risk:
  • my-function (lambda_function) - HIGH
  • my-endpoint (sagemaker_endpoint) - HIGH

================================================================================
⚠️  Review high-risk changes carefully before proceeding
================================================================================
```

### JSON Report

Machine-readable report with complete details:

```json
{
  "operation": "stop",
  "timestamp": "2025-10-25T14:07:17.123456",
  "changes": [
    {
      "resource_id": "my-stream",
      "resource_type": "kinesis_stream",
      "change_type": "scale_down",
      "current_state": {"shard_count": 2},
      "proposed_state": {"shard_count": 1},
      "cost_impact": 10.8,
      "risk_level": "low",
      "warnings": [],
      "dependencies": []
    }
  ],
  "total_cost_impact": 93.7,
  "current_estimate": {
    "timestamp": "2025-10-25T14:07:17.123456",
    "hourly_cost": 0.1453,
    "daily_cost": 3.49,
    "monthly_cost": 104.5,
    "service_breakdown": [...]
  },
  "proposed_estimate": {
    "timestamp": "2025-10-25T14:07:17.123456",
    "hourly_cost": 0.015,
    "daily_cost": 0.36,
    "monthly_cost": 10.8,
    "service_breakdown": [...]
  },
  "errors": [],
  "warnings": [],
  "summary": {
    "total_changes": 4,
    "high_risk_changes": 2,
    "has_errors": false,
    "has_warnings": false
  }
}
```

## Validation Rules

### Stop Operation Validation

1. **Resources Exist**: At least one resource must be present
2. **Already Optimized**: Warns if resources are already at minimum
3. **Resource State**: Checks if resources are in valid state for stopping

### Start Operation Validation

1. **State File Exists**: Saved state must be available
2. **State Completeness**: Required fields must be present
3. **Resource Existence**: Resources to start must exist in AWS
4. **Duplicate Resources**: Warns if resources already exist

### Dependency Checking

- Lambda functions depending on Kinesis streams
- SageMaker endpoints depending on endpoint configs
- CloudWatch alarms depending on monitored resources

## Risk Assessment

### Low Risk
- Disabling CloudWatch alarms
- Scaling Kinesis from 2 to 1 shard
- Enabling previously disabled resources

### Medium Risk
- Scaling Kinesis with more than 2 shards
- Creating SageMaker endpoints (cost impact)
- Updating resource configurations

### High Risk
- Disabling Lambda functions (service interruption)
- Deleting SageMaker endpoints (service interruption + recreation time)
- Stopping critical production resources

### Critical Risk
- Reserved for future use (e.g., deleting data, irreversible operations)

## Cost Calculation

### Included in Estimates

- **Kinesis**: Shard hours ($0.015/shard/hour)
- **Lambda**: Invocations and compute time (with free tier)
- **SageMaker**: Instance hours (varies by instance type)
- **CloudWatch**: Alarms ($0.10/alarm/month), logs, metrics
- **DynamoDB**: On-demand or provisioned capacity

### Not Included

- Data transfer costs
- S3 storage costs (minimal)
- SNS notification costs (minimal)
- API request costs (minimal)

## Examples

### Example 1: Basic Stop Simulation

```bash
# Run example
python3 backend/cost-management/example_dry_run.py
```

This demonstrates:
- Stop operation simulation
- Start operation simulation
- Error detection
- Cost comparison
- High-risk change identification

### Example 2: Integration Test

```bash
# Run tests
python3 backend/cost-management/test_modules.py
```

This tests:
- Module imports
- Validator functionality
- Simulator functionality
- Reporter functionality
- Report generation

## Best Practices

1. **Always Dry-Run First**: Run dry-run before actual operations
2. **Review High-Risk Changes**: Carefully review any high-risk changes
3. **Check Cost Impact**: Verify estimated costs match expectations
4. **Save Reports**: Keep dry-run reports for audit trail
5. **Validate State**: Ensure state files are complete and valid
6. **Test in Non-Prod**: Test dry-run in non-production first
7. **Monitor Warnings**: Address warnings before proceeding
8. **Fix Errors**: Resolve all errors before attempting actual operation

## Troubleshooting

### No Changes Detected

**Problem**: Dry-run shows no changes
**Solution**: Resources may already be in target state

### Missing State File

**Problem**: Start simulation fails with "state file not found"
**Solution**: Run stop operation first to create state file

### High Cost Estimates

**Problem**: Cost estimates seem too high
**Solution**: Review service breakdown, check instance types and counts

### Validation Errors

**Problem**: Dry-run reports errors
**Solution**: Fix issues identified in error messages before proceeding

## Files Generated

### During Testing
- `logs/test-dry-run-reports/*.json` - JSON reports
- `logs/test-dry-run-reports/*.txt` - Text reports
- `logs/test-aws-resource-manager.log` - Log file

### During Production Use
- `logs/dry-run-reports/*.json` - JSON reports
- `logs/dry-run-reports/*.txt` - Text reports
- `logs/aws-resource-manager.log` - Log file

## Future Enhancements

- [ ] What-if analysis (compare multiple scenarios)
- [ ] Scheduled dry-runs (preview scheduled operations)
- [ ] Historical comparison (compare with past operations)
- [ ] Cost forecasting (predict future costs based on trends)
- [ ] Recommendation engine (suggest optimal configurations)
- [ ] Web dashboard (visualize dry-run results)
- [ ] Slack/email notifications (send dry-run reports)
- [ ] Multi-region support (simulate across regions)

## Related Documentation

- [README.md](README.md) - Main documentation
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Implementation details
- [example_dry_run.py](example_dry_run.py) - Usage examples
- [test_modules.py](test_modules.py) - Test suite
