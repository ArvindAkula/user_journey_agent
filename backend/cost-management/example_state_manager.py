#!/usr/bin/env python3
"""
Example usage of the StateManager module.

Demonstrates:
- Saving resource state
- Loading resource state
- S3 backup (if configured)
- State validation
"""

import sys
import os
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from state_manager import StateManager, ResourceState
from logging_config import setup_logging

# Setup logging
logger = setup_logging(
    log_file="logs/test-state-manager.log",
    console_level="INFO"
)


def example_save_state():
    """Example: Save resource state."""
    print("\n" + "="*80)
    print("Example 1: Saving Resource State")
    print("="*80)
    
    # Initialize StateManager
    state_manager = StateManager(
        state_file="config/aws-resource-state.json",
        project_name="user-journey-analytics",
        environment="prod"
    )
    
    # Example resource configurations
    resources = {
        "lambda_functions": [
            {
                "name": "user-journey-analytics-event-processor-prod",
                "reserved_concurrency": 100,
                "provisioned_concurrency": 50,
                "memory_size": 1024,
                "timeout": 300,
                "runtime": "python3.11"
            },
            {
                "name": "user-journey-analytics-intervention-executor-prod",
                "reserved_concurrency": 50,
                "provisioned_concurrency": 0,
                "memory_size": 512,
                "timeout": 60,
                "runtime": "python3.11"
            }
        ],
        "kinesis_streams": [
            {
                "name": "user-journey-analytics-user-events-prod",
                "shard_count": 2,
                "retention_period": 24,
                "stream_mode": "PROVISIONED"
            }
        ],
        "dynamodb_tables": [
            {
                "name": "user-journey-analytics-user-profiles-prod",
                "billing_mode": "PAY_PER_REQUEST",
                "read_capacity": 0,
                "write_capacity": 0
            },
            {
                "name": "user-journey-analytics-audit-logs-prod",
                "billing_mode": "PAY_PER_REQUEST",
                "read_capacity": 0,
                "write_capacity": 0
            }
        ],
        "cloudwatch_alarms": [
            {
                "name": "user-journey-analytics-lambda-high-duration-prod",
                "enabled": True,
                "threshold": 5000,
                "evaluation_periods": 2
            },
            {
                "name": "user-journey-analytics-kinesis-iterator-age-prod",
                "enabled": True,
                "threshold": 60000,
                "evaluation_periods": 1
            }
        ]
    }
    
    # Metadata
    metadata = {
        "operation": "manual_save",
        "user": os.getenv("USER", "unknown"),
        "reason": "Example state save"
    }
    
    # Save state
    try:
        success = state_manager.save_state(resources, metadata)
        if success:
            print(f"✓ State saved successfully to: {state_manager.state_file}")
            print(f"  - Lambda functions: {len(resources['lambda_functions'])}")
            print(f"  - Kinesis streams: {len(resources['kinesis_streams'])}")
            print(f"  - DynamoDB tables: {len(resources['dynamodb_tables'])}")
            print(f"  - CloudWatch alarms: {len(resources['cloudwatch_alarms'])}")
    except Exception as e:
        print(f"✗ Failed to save state: {e}")
        return False
    
    return True


def example_load_state():
    """Example: Load resource state."""
    print("\n" + "="*80)
    print("Example 2: Loading Resource State")
    print("="*80)
    
    # Initialize StateManager
    state_manager = StateManager(
        state_file="config/aws-resource-state.json",
        project_name="user-journey-analytics",
        environment="prod"
    )
    
    # Check if state exists
    if not state_manager.state_exists():
        print("✗ State file does not exist. Run example_save_state() first.")
        return False
    
    # Load state
    try:
        state = state_manager.load_state()
        
        print(f"✓ State loaded successfully")
        print(f"  - Version: {state.version}")
        print(f"  - Timestamp: {state.timestamp}")
        print(f"  - Project: {state.project}")
        print(f"  - Environment: {state.environment}")
        print(f"\nResource counts:")
        for resource_type, resources in state.resources.items():
            print(f"  - {resource_type}: {len(resources)}")
        
        if state.metadata:
            print(f"\nMetadata:")
            for key, value in state.metadata.items():
                print(f"  - {key}: {value}")
        
        return state
        
    except Exception as e:
        print(f"✗ Failed to load state: {e}")
        return None


def example_s3_backup():
    """Example: S3 backup (requires S3 configuration)."""
    print("\n" + "="*80)
    print("Example 3: S3 Backup")
    print("="*80)
    
    # Get S3 bucket from environment or config
    s3_bucket = os.getenv("STATE_BACKUP_S3_BUCKET")
    
    if not s3_bucket:
        print("⚠ S3 backup not configured (set STATE_BACKUP_S3_BUCKET environment variable)")
        print("  Skipping S3 backup example")
        return False
    
    # Initialize StateManager with S3 backup
    state_manager = StateManager(
        state_file="config/aws-resource-state.json",
        s3_bucket=s3_bucket,
        s3_prefix="state-backups/",
        project_name="user-journey-analytics",
        environment="prod"
    )
    
    # Check if state exists
    if not state_manager.state_exists():
        print("✗ State file does not exist. Run example_save_state() first.")
        return False
    
    # Backup to S3
    try:
        success = state_manager.backup_to_s3()
        if success:
            print(f"✓ State backed up to S3: s3://{s3_bucket}/state-backups/")
            
            # List backups
            backups = state_manager.list_backups()
            print(f"\nAvailable backups: {len(backups)}")
            for backup in backups[:5]:  # Show first 5
                print(f"  - {backup['key']} ({backup['size']} bytes)")
        
        return True
        
    except Exception as e:
        print(f"✗ Failed to backup to S3: {e}")
        return False


def example_restore_from_s3():
    """Example: Restore from S3 backup."""
    print("\n" + "="*80)
    print("Example 4: Restore from S3")
    print("="*80)
    
    # Get S3 bucket from environment or config
    s3_bucket = os.getenv("STATE_BACKUP_S3_BUCKET")
    
    if not s3_bucket:
        print("⚠ S3 backup not configured (set STATE_BACKUP_S3_BUCKET environment variable)")
        print("  Skipping S3 restore example")
        return False
    
    # Initialize StateManager with S3 backup
    state_manager = StateManager(
        state_file="config/aws-resource-state.json",
        s3_bucket=s3_bucket,
        s3_prefix="state-backups/",
        project_name="user-journey-analytics",
        environment="prod"
    )
    
    # Restore from S3 (most recent backup)
    try:
        state = state_manager.restore_from_s3()
        
        print(f"✓ State restored from S3")
        print(f"  - Version: {state.version}")
        print(f"  - Timestamp: {state.timestamp}")
        print(f"  - Project: {state.project}")
        print(f"  - Environment: {state.environment}")
        
        return True
        
    except Exception as e:
        print(f"✗ Failed to restore from S3: {e}")
        return False


def main():
    """Run all examples."""
    print("\n" + "="*80)
    print("StateManager Examples")
    print("="*80)
    
    # Example 1: Save state
    if not example_save_state():
        print("\n✗ Failed to save state. Exiting.")
        return 1
    
    # Example 2: Load state
    state = example_load_state()
    if not state:
        print("\n✗ Failed to load state. Exiting.")
        return 1
    
    # Example 3: S3 backup (optional)
    example_s3_backup()
    
    # Example 4: Restore from S3 (optional)
    # Uncomment to test restore
    # example_restore_from_s3()
    
    print("\n" + "="*80)
    print("✓ All examples completed successfully")
    print("="*80)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
