"""
Example usage of dry-run functionality.

Demonstrates how to simulate stop and start operations without making actual changes.
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from dry_run import DryRunSimulator, RiskLevel
from dry_run_reporter import DryRunReporter
from cost_calculator import CostCalculator
from logging_config import setup_logging

# Setup logging
setup_logging()


def example_stop_simulation():
    """Example: Simulate stopping all resources."""
    print("\n" + "=" * 80)
    print("EXAMPLE 1: Simulate Stop Operation")
    print("=" * 80)
    
    # Mock current resources (in real implementation, these would come from AWS)
    current_resources = {
        'kinesis': [
            {
                'name': 'user-journey-analytics-user-events',
                'shard_count': 2,
                'status': 'ACTIVE'
            }
        ],
        'lambda': [
            {
                'name': 'event_processor',
                'reserved_concurrency': None,
                'memory_mb': 1024
            },
            {
                'name': 'intervention-executor',
                'reserved_concurrency': None,
                'memory_mb': 512
            }
        ],
        'sagemaker': [
            {
                'name': 'user-journey-analytics-exit-risk-endpoint',
                'status': 'InService',
                'instance_type': 'ml.m5.large',
                'instance_count': 1
            }
        ],
        'cloudwatch': [
            {
                'name': 'user-journey-analytics-lambda-high-duration',
                'enabled': True
            },
            {
                'name': 'user-journey-analytics-kinesis-iterator-age',
                'enabled': True
            }
        ]
    }
    
    # Create simulator
    simulator = DryRunSimulator()
    
    # Simulate stop operation
    result = simulator.simulate_stop_operation(current_resources)
    
    # Create reporter and display results
    reporter = DryRunReporter(use_colors=True)
    reporter.print_report(result)
    
    # Save reports
    saved_files = reporter.save_report(result)
    print(f"\nReports saved to:")
    for format_type, filepath in saved_files.items():
        print(f"  {format_type}: {filepath}")


def example_start_simulation():
    """Example: Simulate starting resources from saved state."""
    print("\n" + "=" * 80)
    print("EXAMPLE 2: Simulate Start Operation")
    print("=" * 80)
    
    # Mock saved state (would be loaded from state file)
    saved_state = {
        'version': '1.0',
        'timestamp': '2025-10-25T10:00:00Z',
        'kinesis': {
            'stream_name': 'user-journey-analytics-user-events',
            'shard_count': 2
        },
        'lambda': [
            {
                'name': 'event_processor',
                'reserved_concurrency': None
            },
            {
                'name': 'intervention-executor',
                'reserved_concurrency': None
            }
        ],
        'sagemaker': {
            'endpoint_name': 'user-journey-analytics-exit-risk-endpoint',
            'endpoint_config': 'user-journey-analytics-exit-risk-endpoint-config',
            'instance_type': 'ml.m5.large'
        },
        'cloudwatch': {
            'alarm_count': 2
        }
    }
    
    # Mock current resources (after stop operation)
    current_resources = {
        'kinesis': [
            {
                'name': 'user-journey-analytics-user-events',
                'shard_count': 1,
                'status': 'ACTIVE'
            }
        ],
        'lambda': [
            {
                'name': 'event_processor',
                'reserved_concurrency': 0,
                'memory_mb': 1024
            },
            {
                'name': 'intervention-executor',
                'reserved_concurrency': 0,
                'memory_mb': 512
            }
        ],
        'sagemaker': [],  # Endpoint deleted
        'cloudwatch': [
            {
                'name': 'user-journey-analytics-lambda-high-duration',
                'enabled': False
            },
            {
                'name': 'user-journey-analytics-kinesis-iterator-age',
                'enabled': False
            }
        ]
    }
    
    # Create simulator
    simulator = DryRunSimulator()
    
    # Simulate start operation
    result = simulator.simulate_start_operation(saved_state, current_resources)
    
    # Create reporter and display results
    reporter = DryRunReporter(use_colors=True)
    reporter.print_report(result)
    
    # Save reports
    saved_files = reporter.save_report(result)
    print(f"\nReports saved to:")
    for format_type, filepath in saved_files.items():
        print(f"  {format_type}: {filepath}")


def example_error_detection():
    """Example: Demonstrate error detection in dry-run."""
    print("\n" + "=" * 80)
    print("EXAMPLE 3: Error Detection")
    print("=" * 80)
    
    # Mock saved state with missing information
    saved_state = {
        'version': '1.0',
        'kinesis': {
            # Missing stream_name - should cause error
            'shard_count': 2
        },
        'lambda': [
            {
                # Missing function name - should cause error
                'reserved_concurrency': None
            }
        ]
    }
    
    # Mock current resources
    current_resources = {
        'kinesis': [
            {
                'name': 'user-journey-analytics-user-events',
                'shard_count': 1,
                'status': 'ACTIVE'
            }
        ],
        'lambda': [
            {
                'name': 'event_processor',
                'reserved_concurrency': 0
            }
        ]
    }
    
    # Create simulator
    simulator = DryRunSimulator()
    
    # Simulate start operation (should detect errors)
    result = simulator.simulate_start_operation(saved_state, current_resources)
    
    # Create reporter and display results
    reporter = DryRunReporter(use_colors=True)
    reporter.print_report(result)
    
    if result.has_errors:
        print("\n" + "=" * 80)
        print("✓ Errors were successfully detected before execution!")
        print("=" * 80)


def example_cost_comparison():
    """Example: Show detailed cost comparison."""
    print("\n" + "=" * 80)
    print("EXAMPLE 4: Cost Comparison")
    print("=" * 80)
    
    # Mock current resources
    current_resources = {
        'kinesis': [
            {
                'name': 'user-journey-analytics-user-events',
                'shard_count': 2,
                'status': 'ACTIVE'
            }
        ],
        'sagemaker': [
            {
                'name': 'user-journey-analytics-exit-risk-endpoint',
                'status': 'InService',
                'instance_type': 'ml.m5.large',
                'instance_count': 1
            }
        ],
        'cloudwatch': [
            {'name': 'alarm-1', 'enabled': True},
            {'name': 'alarm-2', 'enabled': True},
            {'name': 'alarm-3', 'enabled': True}
        ]
    }
    
    # Create simulator
    simulator = DryRunSimulator()
    
    # Simulate stop operation
    result = simulator.simulate_stop_operation(current_resources)
    
    # Display cost comparison
    print("\nCURRENT COSTS:")
    print(f"  Hourly:  ${result.current_estimate.hourly_cost:.4f}")
    print(f"  Daily:   ${result.current_estimate.daily_cost:.2f}")
    print(f"  Monthly: ${result.current_estimate.monthly_cost:.2f}")
    
    print("\nPROPOSED COSTS (after stop):")
    print(f"  Hourly:  ${result.proposed_estimate.hourly_cost:.4f}")
    print(f"  Daily:   ${result.proposed_estimate.daily_cost:.2f}")
    print(f"  Monthly: ${result.proposed_estimate.monthly_cost:.2f}")
    
    print("\nSAVINGS:")
    print(f"  Daily:   ${result.total_cost_impact / 30:.2f}")
    print(f"  Monthly: ${result.total_cost_impact:.2f}")
    print(f"  Annual:  ${result.total_cost_impact * 12:.2f}")
    
    # Show service breakdown
    print("\nCOST BREAKDOWN BY SERVICE:")
    print("-" * 60)
    for service in result.current_estimate.service_breakdown:
        print(f"  {service.service_name:<25} ${service.monthly_cost:>8.2f}/month")


def example_high_risk_changes():
    """Example: Identify high-risk changes."""
    print("\n" + "=" * 80)
    print("EXAMPLE 5: High-Risk Change Detection")
    print("=" * 80)
    
    # Mock resources with high-risk changes
    current_resources = {
        'kinesis': [
            {
                'name': 'production-critical-stream',
                'shard_count': 10,  # Large shard count - high risk to reduce
                'status': 'ACTIVE'
            }
        ],
        'lambda': [
            {
                'name': 'critical-payment-processor',
                'reserved_concurrency': 100,
                'memory_mb': 2048
            }
        ],
        'sagemaker': [
            {
                'name': 'production-ml-endpoint',
                'status': 'InService',
                'instance_type': 'ml.m5.xlarge',
                'instance_count': 2
            }
        ]
    }
    
    # Create simulator
    simulator = DryRunSimulator()
    
    # Simulate stop operation
    result = simulator.simulate_stop_operation(current_resources)
    
    # Display high-risk changes
    if result.high_risk_changes:
        print(f"\nFound {len(result.high_risk_changes)} high-risk change(s):\n")
        
        for change in result.high_risk_changes:
            print(f"Resource: {change.resource_id}")
            print(f"  Type:       {change.resource_type}")
            print(f"  Action:     {change.change_type.value}")
            print(f"  Risk Level: {change.risk_level.value.upper()}")
            print(f"  Warnings:")
            for warning in change.warnings:
                print(f"    - {warning}")
            print()


def main():
    """Run all examples."""
    print("\n" + "=" * 80)
    print("DRY-RUN MODE EXAMPLES")
    print("=" * 80)
    print("\nThese examples demonstrate the dry-run functionality without")
    print("making any actual changes to AWS resources.")
    print("=" * 80)
    
    try:
        # Run examples
        example_stop_simulation()
        input("\nPress Enter to continue to next example...")
        
        example_start_simulation()
        input("\nPress Enter to continue to next example...")
        
        example_error_detection()
        input("\nPress Enter to continue to next example...")
        
        example_cost_comparison()
        input("\nPress Enter to continue to next example...")
        
        example_high_risk_changes()
        
        print("\n" + "=" * 80)
        print("✓ All examples completed successfully!")
        print("=" * 80)
        
    except KeyboardInterrupt:
        print("\n\nExamples interrupted by user.")
    except Exception as e:
        print(f"\n\nError running examples: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
