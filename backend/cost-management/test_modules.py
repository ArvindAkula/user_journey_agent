#!/usr/bin/env python3
"""
Simple test to verify all modules can be imported and basic functionality works.
"""

import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    """Test that all modules can be imported."""
    print("Testing module imports...")
    
    try:
        import exceptions
        print("✓ exceptions module imported")
    except Exception as e:
        print(f"✗ Failed to import exceptions: {e}")
        return False
    
    try:
        import error_handler
        print("✓ error_handler module imported")
    except Exception as e:
        print(f"✗ Failed to import error_handler: {e}")
        return False
    
    try:
        import logging_config
        print("✓ logging_config module imported")
    except Exception as e:
        print(f"✗ Failed to import logging_config: {e}")
        return False
    
    try:
        import audit_trail
        print("✓ audit_trail module imported")
    except Exception as e:
        print(f"✗ Failed to import audit_trail: {e}")
        return False
    
    return True


def test_exceptions():
    """Test exception classes."""
    print("\nTesting exception classes...")
    
    from exceptions import (
        CostManagementError,
        ValidationError,
        AWSServiceError,
        ThrottlingError
    )
    
    # Test basic exception
    try:
        raise ValidationError("Test error", details={'key': 'value'})
    except ValidationError as e:
        print(f"✓ ValidationError works: {e.message}")
    
    # Test AWS exception
    try:
        raise ThrottlingError("Rate limited", "lambda", "update_function", "ThrottlingException")
    except ThrottlingError as e:
        print(f"✓ ThrottlingError works: {e.service}.{e.operation}")
    
    return True


def test_logging():
    """Test logging configuration."""
    print("\nTesting logging system...")
    
    from logging_config import setup_logging, get_logger
    
    # Setup logging
    logger = setup_logging(
        log_file="logs/test-aws-resource-manager.log",
        console_level=20,  # INFO
        file_level=10      # DEBUG
    )
    
    print("✓ Logging system initialized")
    
    # Get module logger
    module_logger = get_logger("test_module")
    module_logger.info("Test info message")
    module_logger.debug("Test debug message")
    
    print("✓ Logger created and messages logged")
    
    return True


def test_audit_trail():
    """Test audit trail functionality."""
    print("\nTesting audit trail...")
    
    from audit_trail import AuditTrail, OperationType
    
    # Create audit trail
    audit = AuditTrail(operations_dir="logs/test-operations")
    print("✓ Audit trail initialized")
    
    # Start operation
    op_id = audit.start_operation(
        operation_type=OperationType.STOP,
        dry_run=True,
        test=True
    )
    print(f"✓ Operation started: {op_id}")
    
    # Record a resource change
    audit.record_resource_change(
        resource_id="test-resource-1",
        resource_type="lambda",
        action="stop",
        before_state={"concurrency": 100},
        after_state={"concurrency": 0},
        success=True
    )
    print("✓ Resource change recorded")
    
    # Set cost impact
    audit.set_cost_impact(5.00)
    print("✓ Cost impact set")
    
    # Complete operation
    record = audit.complete_operation(success=True)
    print(f"✓ Operation completed: {record.status.value}")
    
    # Print summary
    print("\n--- Operation Summary ---")
    print(f"Operation ID: {record.operation_id}")
    print(f"Type: {record.operation_type.value}")
    print(f"Status: {record.status.value}")
    print(f"Duration: {record.duration_seconds:.2f}s")
    print(f"Resources: {len(record.resources_affected)}")
    print(f"Cost Impact: ${record.cost_impact:.2f}")
    
    return True


def test_error_handler():
    """Test error handler functionality."""
    print("\nTesting error handler...")
    
    from error_handler import ErrorHandler, retry_with_backoff
    from exceptions import ValidationError, AWSServiceError
    
    # Test error classification
    print("✓ Error handler imported")
    
    # Test retry decorator (without actual retries)
    @retry_with_backoff(max_retries=2, initial_delay=0.1)
    def test_function():
        return "success"
    
    result = test_function()
    print(f"✓ Retry decorator works: {result}")
    
    return True


def test_dry_run():
    """Test dry-run functionality."""
    print("\nTesting dry-run mode...")
    
    from dry_run import DryRunSimulator, DryRunValidator, ChangeType, RiskLevel
    from dry_run_reporter import DryRunReporter
    
    # Test validator
    validator = DryRunValidator()
    print("✓ Dry-run validator initialized")
    
    # Test stop validation
    resources = {
        'kinesis': [{'name': 'test-stream', 'shard_count': 2}],
        'lambda': [{'name': 'test-func', 'reserved_concurrency': None}]
    }
    errors, warnings = validator.validate_stop_operation(resources)
    print(f"✓ Stop validation: {len(errors)} errors, {len(warnings)} warnings")
    
    # Test simulator
    simulator = DryRunSimulator()
    print("✓ Dry-run simulator initialized")
    
    # Simulate stop operation
    current_resources = {
        'kinesis': [
            {
                'name': 'test-stream',
                'shard_count': 2,
                'status': 'ACTIVE'
            }
        ],
        'lambda': [
            {
                'name': 'test-function',
                'reserved_concurrency': None,
                'memory_mb': 1024
            }
        ],
        'sagemaker': [
            {
                'name': 'test-endpoint',
                'status': 'InService',
                'instance_type': 'ml.m5.large',
                'instance_count': 1
            }
        ],
        'cloudwatch': [
            {
                'name': 'test-alarm',
                'enabled': True
            }
        ]
    }
    
    result = simulator.simulate_stop_operation(current_resources)
    print(f"✓ Stop simulation: {len(result.changes)} changes, ${result.total_cost_impact:.2f} savings")
    
    # Test reporter
    reporter = DryRunReporter(use_colors=False)
    print("✓ Dry-run reporter initialized")
    
    # Generate summary
    summary = reporter.generate_summary(result)
    print("✓ Summary generated")
    
    # Save report
    saved_files = reporter.save_report(result, output_dir="logs/test-dry-run-reports")
    print(f"✓ Reports saved: {len(saved_files)} files")
    
    # Print summary
    print("\n--- Dry-Run Summary ---")
    print(f"Operation: {result.operation}")
    print(f"Changes: {len(result.changes)}")
    print(f"Cost Impact: ${result.total_cost_impact:.2f}/month")
    print(f"High-Risk Changes: {len(result.high_risk_changes)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Warnings: {len(result.warnings)}")
    
    return True


def main():
    """Run all tests."""
    print("=" * 80)
    print("AWS Cost Management System - Module Tests")
    print("=" * 80)
    
    tests = [
        ("Module Imports", test_imports),
        ("Exception Classes", test_exceptions),
        ("Logging System", test_logging),
        ("Audit Trail", test_audit_trail),
        ("Error Handler", test_error_handler),
        ("Dry-Run Mode", test_dry_run),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
                print(f"\n✗ {test_name} FAILED")
        except Exception as e:
            failed += 1
            print(f"\n✗ {test_name} FAILED with exception: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 80)
    print(f"Test Results: {passed} passed, {failed} failed")
    print("=" * 80)
    
    if failed == 0:
        print("\n✓ All tests passed!")
        print("\nGenerated files:")
        print("  - logs/test-aws-resource-manager.log (log file)")
        print("  - logs/test-operations/*.json (operation reports)")
        print("  - logs/test-operations/*.txt (human-readable reports)")
        print("  - logs/test-dry-run-reports/*.json (dry-run reports)")
        print("  - logs/test-dry-run-reports/*.txt (dry-run text reports)")
        return 0
    else:
        print("\n✗ Some tests failed")
        return 1


if __name__ == '__main__':
    sys.exit(main())
