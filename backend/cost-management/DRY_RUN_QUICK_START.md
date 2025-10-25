# Dry-Run Mode - Quick Start Guide

## What is Dry-Run Mode?

Dry-run mode simulates AWS resource management operations **without making any actual changes**. It shows you:
- What changes would be made
- Estimated cost impact
- Potential errors or issues
- Risk level of each change

## Quick Examples

### 1. Test the Dry-Run System

```bash
# Run the test suite
python3 backend/cost-management/test_modules.py

# Run interactive examples
python3 backend/cost-management/example_dry_run.py
```

### 2. Simulate Stop Operation

```python
from dry_run import DryRunSimulator
from dry_run_reporter import DryRunReporter

# Your current AWS resources
current_resources = {
    'kinesis': [
        {'name': 'my-stream', 'shard_count': 2, 'status': 'ACTIVE'}
    ],
    'lambda': [
        {'name': 'my-function', 'reserved_concurrency': None}
    ]
}

# Simulate
simulator = DryRunSimulator()
result = simulator.simulate_stop_operation(current_resources)

# Display results
reporter = DryRunReporter(use_colors=True)
reporter.print_report(result)

# Check results
print(f"Changes: {len(result.changes)}")
print(f"Savings: ${result.total_cost_impact:.2f}/month")
print(f"Errors: {len(result.errors)}")
print(f"High-risk: {len(result.high_risk_changes)}")
```

### 3. Simulate Start Operation

```python
from dry_run import DryRunSimulator
from dry_run_reporter import DryRunReporter

# Saved state (from previous stop)
saved_state = {
    'kinesis': {'stream_name': 'my-stream', 'shard_count': 2},
    'lambda': [{'name': 'my-function', 'reserved_concurrency': None}]
}

# Current resources (after stop)
current_resources = {
    'kinesis': [{'name': 'my-stream', 'shard_count': 1}],
    'lambda': [{'name': 'my-function', 'reserved_concurrency': 0}]
}

# Simulate
simulator = DryRunSimulator()
result = simulator.simulate_start_operation(saved_state, current_resources)

# Display
reporter = DryRunReporter(use_colors=True)
reporter.print_report(result)
```

### 4. Use from Command Line

```bash
# Simulate stop (text output)
python3 backend/cost-management/cli_dry_run.py stop \
    --resources config/aws-current-resources.json

# Simulate stop (JSON output)
python3 backend/cost-management/cli_dry_run.py stop \
    --resources config/aws-current-resources.json \
    --format json

# Simulate start
python3 backend/cost-management/cli_dry_run.py start \
    --state config/aws-resource-state.json \
    --resources config/aws-current-resources.json
```

### 5. Use with Bash Script

```bash
# The main script already supports dry-run
./scripts/aws-resource-manager.sh stop --dry-run
./scripts/aws-resource-manager.sh start --dry-run
```

## Understanding the Output

### Summary Section
```
Total changes:      4        # Number of resources that would change
High-risk changes:  2        # Changes that could interrupt service
Cost impact:        +$93.70  # Positive = savings, Negative = costs
```

### Risk Levels
- 🟢 **LOW**: Safe (e.g., disabling alarms)
- 🟡 **MEDIUM**: May affect performance (e.g., scaling)
- 🔴 **HIGH**: Will interrupt service (e.g., stopping Lambda)
- ⚫ **CRITICAL**: Severe consequences (reserved)

### Change Symbols
- ➕ CREATE - Create new resource
- 🔄 UPDATE - Update existing resource
- 🗑️ DELETE - Delete resource
- ✅ ENABLE - Enable resource
- ⏸️ DISABLE - Disable resource
- 📈 SCALE_UP - Increase capacity
- 📉 SCALE_DOWN - Decrease capacity

### Cost Impact
- **Positive** (+$X): You will save money
- **Negative** (-$X): You will spend money
- **Zero** ($0): No cost change

## Decision Making

### ✅ Safe to Proceed When:
- No errors detected
- No high-risk changes (or you've reviewed them)
- Cost impact matches expectations
- All warnings are acceptable

### ⚠️ Review Carefully When:
- High-risk changes detected
- Large cost impact (verify it's expected)
- Multiple warnings
- Unfamiliar resource changes

### ❌ Do Not Proceed When:
- Errors detected
- Missing required resources
- State file issues
- Unexpected changes

## Common Scenarios

### Scenario 1: Preview Cost Savings
```python
result = simulator.simulate_stop_operation(current_resources)
print(f"You would save ${result.total_cost_impact:.2f}/month")
print(f"That's ${result.total_cost_impact * 12:.2f}/year")
```

### Scenario 2: Check for Errors
```python
result = simulator.simulate_stop_operation(current_resources)
if result.has_errors:
    print("Cannot proceed:")
    for error in result.errors:
        print(f"  - {error}")
else:
    print("Safe to proceed!")
```

### Scenario 3: Identify High-Risk Changes
```python
result = simulator.simulate_stop_operation(current_resources)
if result.high_risk_changes:
    print("High-risk changes:")
    for change in result.high_risk_changes:
        print(f"  - {change.resource_id}: {change.risk_level.value}")
        for warning in change.warnings:
            print(f"    ⚠️  {warning}")
```

### Scenario 4: Save Report for Review
```python
reporter = DryRunReporter()
saved_files = reporter.save_report(result)
print(f"Report saved to: {saved_files['text']}")
# Share the report with your team for review
```

## Tips

1. **Always dry-run first** - Never skip this step
2. **Review high-risk changes** - Understand the impact
3. **Check cost estimates** - Verify they match expectations
4. **Save reports** - Keep for audit trail
5. **Test in non-prod first** - Validate in safe environment

## Troubleshooting

### "No changes detected"
- Resources may already be in target state
- Check current resource state

### "State file not found"
- Run stop operation first to create state
- Verify state file path

### "Validation errors"
- Fix issues in error messages
- Ensure resources exist
- Check state file completeness

### "High cost estimates"
- Review service breakdown
- Check instance types and counts
- Verify shard counts

## Next Steps

1. Run the examples: `python3 backend/cost-management/example_dry_run.py`
2. Read full documentation: `DRY_RUN_IMPLEMENTATION.md`
3. Review the code: `dry_run.py` and `dry_run_reporter.py`
4. Integrate with your workflow

## Need Help?

- Full documentation: `DRY_RUN_IMPLEMENTATION.md`
- Usage examples: `example_dry_run.py`
- Test suite: `test_modules.py`
- Main README: `README.md`
