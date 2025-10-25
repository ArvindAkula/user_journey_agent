# AWS Cost Management System - Error Handling & Logging

This module provides comprehensive error handling, logging, and audit trail capabilities for the AWS Cost Management System.

## Components

### 1. Exception Hierarchy (`exceptions.py`)

Custom exception classes for different error scenarios:

- **`CostManagementError`**: Base exception for all cost management errors
- **`ValidationError`**: Input validation failures
- **`StateError`**: State file operation failures
- **`AWSServiceError`**: AWS service operation failures
  - **`ThrottlingError`**: API throttling/rate limiting
  - **`PermissionError`**: IAM permission issues
  - **`ResourceNotFoundError`**: Resource not found
- **`DependencyError`**: Resource dependency conflicts
- **`ConfigurationError`**: Invalid or missing configuration

### 2. Error Handler (`error_handler.py`)

Centralized error handling with retry logic:

#### Features

- **Automatic Retry**: Exponential backoff for transient errors
- **Error Classification**: Identifies retryable vs. non-retryable errors
- **User-Friendly Messages**: Converts AWS errors to readable messages
- **Logging Integration**: All errors are logged with context

#### Decorators

**`@retry_with_backoff`**: Automatically retry failed operations
```python
@retry_with_backoff(max_retries=3, initial_delay=1.0, backoff_factor=2.0)
def my_aws_operation():
    # Will retry up to 3 times with exponential backoff
    pass
```

**`@safe_aws_call`**: Wrap AWS API calls with error handling
```python
@safe_aws_call(service='lambda', operation='update_function_configuration')
def update_lambda_config():
    # AWS errors are automatically converted to custom exceptions
    pass
```

#### Error Handler Methods

- **`handle_validation_error()`**: Display validation errors with details
- **`handle_aws_error()`**: Convert AWS errors to custom exceptions
- **`handle_state_error()`**: Handle state file errors with recovery suggestions
- **`handle_dependency_error()`**: Display dependency chains

### 3. Logging System (`logging_config.py`)

Dual-output logging with color support:

#### Features

- **Console Output**: INFO level with colors for readability
- **File Output**: DEBUG level with detailed information
- **User Context**: Includes username and hostname in logs
- **Timestamps**: All logs include precise timestamps
- **Operation Timing**: Context manager for timing operations

#### Setup

```python
from logging_config import setup_logging, get_logger

# Initialize logging system
setup_logging(
    log_file="logs/aws-resource-manager.log",
    console_level=logging.INFO,
    file_level=logging.DEBUG
)

# Get logger for your module
logger = get_logger(__name__)
```

#### Usage

```python
# Basic logging
logger.info("Starting operation")
logger.debug("Detailed debug information")
logger.warning("Warning message")
logger.error("Error occurred")

# Operation timing with context manager
from logging_config import OperationLogger

with OperationLogger(logger, "stop_resources", resource_count=5):
    # Your operation code here
    pass
# Automatically logs duration

# Convenience functions
from logging_config import (
    log_operation_start,
    log_operation_success,
    log_operation_failure,
    log_resource_change
)

log_operation_start(logger, "stop_lambda", function_name="my-function")
# ... perform operation ...
log_operation_success(logger, "stop_lambda", duration=1.5)
```

### 4. Audit Trail (`audit_trail.py`)

Complete operation tracking with report generation:

#### Features

- **Operation Tracking**: Start, track, and complete operations
- **Resource Changes**: Record before/after state for all resources
- **Cost Impact**: Track estimated cost savings/additions
- **Error Recording**: Capture all errors and warnings
- **Report Generation**: JSON and human-readable formats
- **Operation History**: Query past operations

#### Usage

```python
from audit_trail import AuditTrail, OperationType

# Initialize audit trail
audit = AuditTrail(operations_dir="logs/operations")

# Start an operation
operation_id = audit.start_operation(
    operation_type=OperationType.STOP,
    dry_run=False,
    environment='prod'
)

# Record resource changes
audit.record_resource_change(
    resource_id="my-lambda-function",
    resource_type="lambda",
    action="stop",
    before_state={"concurrency": 100},
    after_state={"concurrency": 0},
    success=True
)

# Add errors or warnings
audit.add_error("Failed to stop resource X")
audit.add_warning("Resource Y was already stopped")

# Set cost impact
audit.set_cost_impact(12.50)  # $12.50 saved

# Complete operation (generates reports)
operation_record = audit.complete_operation(success=True)

# Print summary to console
audit.print_summary()
```

#### Report Formats

**JSON Report** (`logs/operations/{operation_id}.json`):
- Machine-readable format
- Complete operation details
- All resource changes
- Errors and warnings

**Text Report** (`logs/operations/{operation_id}.txt`):
- Human-readable format
- Formatted for easy reading
- Summary and detailed sections
- Cost impact highlighted

## Integration Example

Here's how to use all components together:

```python
from logging_config import setup_logging, get_logger, OperationLogger
from error_handler import retry_with_backoff, safe_aws_call
from audit_trail import AuditTrail, OperationType
from exceptions import AWSServiceError

# Setup
setup_logging()
logger = get_logger(__name__)
audit = AuditTrail()

# Start operation
operation_id = audit.start_operation(OperationType.STOP, dry_run=False)

try:
    with OperationLogger(logger, "stop_all_resources"):
        # Your AWS operations here
        
        @retry_with_backoff(max_retries=3)
        @safe_aws_call(service='lambda', operation='put_function_concurrency')
        def stop_lambda(function_name):
            # AWS API call
            before = {"concurrency": 100}
            after = {"concurrency": 0}
            
            # Record change
            audit.record_resource_change(
                resource_id=function_name,
                resource_type="lambda",
                action="stop",
                before_state=before,
                after_state=after,
                success=True
            )
        
        stop_lambda("my-function")
        
        audit.set_cost_impact(10.00)
        operation_record = audit.complete_operation(success=True)
        
except AWSServiceError as e:
    logger.error(f"AWS operation failed: {e}")
    audit.add_error(str(e))
    audit.complete_operation(success=False)
    raise
```

## Log Files

### Console Output
- Level: INFO
- Format: `LEVEL - message`
- Colors: Enabled for better readability

### File Output
- Location: `logs/aws-resource-manager.log`
- Level: DEBUG
- Format: `timestamp - user@host - module - level - function:line - message`
- Rotation: Manual (consider adding rotation in production)

### Operation Reports
- Location: `logs/operations/`
- Formats: JSON (`.json`) and Text (`.txt`)
- Naming: `{operation_type}_{timestamp}.{ext}`
- Retention: Manual cleanup (consider adding retention policy)

## Error Handling Patterns

### Pattern 1: Retry on Transient Errors
```python
@retry_with_backoff(max_retries=3, initial_delay=1.0)
def my_operation():
    # Automatically retries on ThrottlingError and AWSServiceError
    pass
```

### Pattern 2: Safe AWS Calls
```python
@safe_aws_call(service='kinesis', operation='update_shard_count')
def update_kinesis():
    # AWS errors are converted to custom exceptions
    pass
```

### Pattern 3: Combined Retry + Safe Call
```python
@retry_with_backoff(max_retries=3)
@safe_aws_call(service='lambda', operation='update_function')
def update_lambda():
    # Both retry logic and error handling
    pass
```

### Pattern 4: Manual Error Handling
```python
try:
    # Your operation
    pass
except ThrottlingError as e:
    # Specific handling for throttling
    logger.warning(f"Throttled, will retry: {e}")
    raise
except PermissionError as e:
    # Specific handling for permissions
    logger.error(f"Permission denied: {e}")
    # Don't retry, fail fast
    raise
except AWSServiceError as e:
    # Generic AWS error handling
    logger.error(f"AWS error: {e}")
    raise
```

## Best Practices

1. **Always use logging**: Log at appropriate levels (DEBUG, INFO, WARNING, ERROR)
2. **Use audit trail for operations**: Track all resource changes
3. **Apply retry decorators**: Use `@retry_with_backoff` for AWS API calls
4. **Handle specific errors**: Catch specific exception types when possible
5. **Provide context**: Include relevant details in error messages
6. **Generate reports**: Complete operations to generate audit reports
7. **Monitor log files**: Regularly check logs for issues
8. **Review operation history**: Use audit trail to track changes over time

## Testing

Run the example script to test all components:

```bash
cd backend/cost-management
python3 example_usage.py
```

This will:
- Initialize logging
- Create example operations
- Generate audit reports
- Demonstrate error handling

Check the output:
- Console: Real-time colored output
- `logs/aws-resource-manager.log`: Detailed logs
- `logs/operations/`: Operation reports

## Dependencies

Install required packages:

```bash
pip install -r requirements.txt
```

Required packages:
- `boto3`: AWS SDK
- `botocore`: AWS SDK core
- `dataclasses-json`: JSON serialization (Python < 3.10)
- `typing-extensions`: Type hints

### 5. Dry-Run Mode (`dry_run.py`, `dry_run_reporter.py`)

Simulate operations without making actual changes:

#### Features

- **Operation Simulation**: Preview stop/start operations before execution
- **Cost Impact Analysis**: Calculate estimated cost savings/increases
- **Error Detection**: Identify potential issues before execution
- **Risk Assessment**: Classify changes by risk level (LOW, MEDIUM, HIGH, CRITICAL)
- **Dependency Checking**: Detect resource dependencies
- **Detailed Reporting**: Generate comprehensive reports in text and JSON formats

#### Components

**DryRunSimulator**: Simulates operations and calculates impacts
```python
from dry_run import DryRunSimulator

simulator = DryRunSimulator()

# Simulate stop operation
result = simulator.simulate_stop_operation(current_resources)

# Simulate start operation
result = simulator.simulate_start_operation(saved_state, current_resources)
```

**DryRunValidator**: Validates operations and detects errors
```python
from dry_run import DryRunValidator

validator = DryRunValidator()

# Validate stop operation
errors, warnings = validator.validate_stop_operation(resources)

# Validate start operation
errors, warnings = validator.validate_start_operation(state, current_resources)
```

**DryRunReporter**: Generates formatted reports
```python
from dry_run_reporter import DryRunReporter

reporter = DryRunReporter(use_colors=True)

# Print report to console
reporter.print_report(result)

# Save reports to files
saved_files = reporter.save_report(result)
```

#### Usage Example

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
    ]
}

# Simulate stop operation
simulator = DryRunSimulator()
result = simulator.simulate_stop_operation(current_resources)

# Display results
reporter = DryRunReporter(use_colors=True)
reporter.print_report(result)

# Check for errors
if result.has_errors:
    print("Cannot proceed - errors detected")
    for error in result.errors:
        print(f"  - {error}")
else:
    print(f"Safe to proceed - {len(result.changes)} changes")
    print(f"Estimated savings: ${result.total_cost_impact:.2f}/month")
```

#### Dry-Run Result

The `DryRunResult` object contains:

- **operation**: Operation type ('stop' or 'start')
- **timestamp**: When simulation was performed
- **changes**: List of `ResourceChange` objects
- **total_cost_impact**: Total cost impact (positive = savings, negative = costs)
- **current_estimate**: Current cost estimate
- **proposed_estimate**: Proposed cost estimate after changes
- **errors**: List of errors that would prevent execution
- **warnings**: List of warnings to consider
- **high_risk_changes**: Changes classified as high or critical risk

#### Resource Change

Each `ResourceChange` includes:

- **resource_id**: Resource identifier
- **resource_type**: Type of resource (kinesis_stream, lambda_function, etc.)
- **change_type**: Type of change (CREATE, UPDATE, DELETE, ENABLE, DISABLE, SCALE_UP, SCALE_DOWN)
- **current_state**: Current resource state
- **proposed_state**: Proposed resource state
- **cost_impact**: Cost impact for this specific change
- **risk_level**: Risk level (LOW, MEDIUM, HIGH, CRITICAL)
- **warnings**: Specific warnings for this change
- **dependencies**: Dependent resources

#### Risk Levels

- **LOW**: Safe changes with minimal impact (e.g., disabling alarms)
- **MEDIUM**: Changes that may affect performance (e.g., scaling Kinesis)
- **HIGH**: Changes that will interrupt service (e.g., stopping Lambda, deleting SageMaker endpoints)
- **CRITICAL**: Changes with severe consequences (reserved for future use)

#### Report Formats

**Text Report**: Human-readable with colors and formatting
- Summary section with totals
- Cost comparison (current vs. proposed)
- Detailed changes by resource type
- High-risk change warnings
- Error and warning sections

**JSON Report**: Machine-readable for automation
- Complete simulation results
- All resource changes with details
- Cost estimates and comparisons
- Errors and warnings

#### CLI Integration

The bash script supports dry-run mode:

```bash
# Dry-run stop operation
./scripts/aws-resource-manager.sh stop --dry-run

# Dry-run start operation
./scripts/aws-resource-manager.sh start --dry-run
```

#### Testing Dry-Run

Run the dry-run examples:

```bash
cd backend/cost-management
python3 example_dry_run.py
```

This demonstrates:
1. Stop operation simulation
2. Start operation simulation
3. Error detection
4. Cost comparison
5. High-risk change identification

## Future Enhancements

- [ ] Log rotation and retention policies
- [ ] CloudWatch Logs integration
- [ ] Metrics collection (operation counts, durations)
- [ ] Alert integration (SNS notifications)
- [ ] Web dashboard for viewing audit trail
- [ ] Advanced filtering and search for operation history
- [ ] Dry-run scheduling (preview scheduled operations)
- [ ] What-if analysis (compare multiple scenarios)
