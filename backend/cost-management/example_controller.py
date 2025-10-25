#!/usr/bin/env python3
"""
Example usage of ResourceController for AWS cost management.

This script demonstrates how to use the ResourceController to:
1. Stop all resources (dry-run)
2. Start all resources (dry-run)
3. Get resource status
4. Save and restore state
"""

import sys
import os
import json

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from controller import ResourceController


def example_stop_resources():
    """Example: Stop all resources in dry-run mode."""
    print("=" * 60)
    print("Example 1: Stop All Resources (Dry Run)")
    print("=" * 60)
    
    # Initialize controller in dry-run mode
    controller = ResourceController(
        project_name="user-journey-analytics",
        environment="prod",
        region="us-east-1",
        dry_run=True
    )
    
    # Stop all resources
    print("\nStopping all resources (dry-run)...")
    result = controller.stop_all_resources()
    
    # Display results
    print(f"\nOperation: {result.operation}")
    print(f"Success: {result.success}")
    print(f"Duration: {result.duration_seconds:.2f}s")
    print(f"Resources affected: {len(result.resources_affected)}")
    print(f"Estimated daily savings: ${result.cost_impact:.2f}")
    
    if result.errors:
        print(f"\nErrors ({len(result.errors)}):")
        for error in result.errors:
            print(f"  - {error}")
    
    if result.warnings:
        print(f"\nWarnings ({len(result.warnings)}):")
        for warning in result.warnings:
            print(f"  - {warning}")
    
    print("\nService Results:")
    for service, service_result in result.service_results.items():
        print(f"  {service}:")
        print(f"    - Success: {service_result.get('success', 'N/A')}")
        print(f"    - Resources: {len(service_result.get('resources_affected', []))}")
    
    return result


def example_start_resources():
    """Example: Start all resources in dry-run mode."""
    print("\n" + "=" * 60)
    print("Example 2: Start All Resources (Dry Run)")
    print("=" * 60)
    
    # Initialize controller in dry-run mode
    controller = ResourceController(
        project_name="user-journey-analytics",
        environment="prod",
        region="us-east-1",
        dry_run=True
    )
    
    # Start all resources
    print("\nStarting all resources (dry-run)...")
    result = controller.start_all_resources()
    
    # Display results
    print(f"\nOperation: {result.operation}")
    print(f"Success: {result.success}")
    print(f"Duration: {result.duration_seconds:.2f}s")
    print(f"Resources affected: {len(result.resources_affected)}")
    
    if result.errors:
        print(f"\nErrors ({len(result.errors)}):")
        for error in result.errors:
            print(f"  - {error}")
    
    if result.warnings:
        print(f"\nWarnings ({len(result.warnings)}):")
        for warning in result.warnings:
            print(f"  - {warning}")
    
    print("\nService Results:")
    for service, service_result in result.service_results.items():
        print(f"  {service}:")
        print(f"    - Success: {service_result.get('success', 'N/A')}")
        print(f"    - Resources: {len(service_result.get('resources_affected', []))}")
    
    return result


def example_get_status():
    """Example: Get current resource status."""
    print("\n" + "=" * 60)
    print("Example 3: Get Resource Status")
    print("=" * 60)
    
    # Initialize controller
    controller = ResourceController(
        project_name="user-journey-analytics",
        environment="prod",
        region="us-east-1"
    )
    
    # Get status
    print("\nGetting resource status...")
    report = controller.get_resource_status()
    
    # Display results
    print(f"\nOverall Status: {report.overall_status}")
    print(f"Total Resources: {report.total_resources}")
    print(f"Running: {report.running_resources}")
    print(f"Stopped: {report.stopped_resources}")
    
    print(f"\nEstimated Costs:")
    print(f"  Hourly:  ${report.estimated_hourly_cost:.4f}")
    print(f"  Daily:   ${report.estimated_daily_cost:.2f}")
    print(f"  Monthly: ${report.estimated_monthly_cost:.2f}")
    
    print(f"\nService Status:")
    for service, status in report.service_status.items():
        print(f"  {service}:")
        if 'error' in status:
            print(f"    - Error: {status['error']}")
        else:
            print(f"    - Status: {status.get('status', 'N/A')}")
            print(f"    - Resources: {status.get('total_resources', 0)}")
            print(f"    - Running: {status.get('running_resources', 0)}")
            print(f"    - Stopped: {status.get('stopped_resources', 0)}")
    
    if report.recommendations:
        print(f"\nRecommendations ({len(report.recommendations)}):")
        for i, rec in enumerate(report.recommendations, 1):
            print(f"  {i}. {rec}")
    
    return report


def example_save_and_restore_state():
    """Example: Save and restore resource state."""
    print("\n" + "=" * 60)
    print("Example 4: Save and Restore State")
    print("=" * 60)
    
    # Initialize controller
    controller = ResourceController(
        project_name="user-journey-analytics",
        environment="prod",
        region="us-east-1",
        state_file="config/aws-resource-state-example.json"
    )
    
    # Save state
    print("\nSaving resource state...")
    try:
        success = controller.save_state()
        if success:
            print("✓ State saved successfully")
        else:
            print("✗ State save failed")
    except Exception as e:
        print(f"✗ State save error: {e}")
    
    # Check if state file exists
    if controller.state_manager.state_exists():
        print(f"✓ State file exists: {controller.state_manager.state_file}")
        
        # Load state
        print("\nLoading resource state...")
        try:
            state = controller.state_manager.load_state()
            print(f"✓ State loaded successfully")
            print(f"  - Version: {state.version}")
            print(f"  - Timestamp: {state.timestamp}")
            print(f"  - Project: {state.project}")
            print(f"  - Environment: {state.environment}")
            print(f"  - Resource types: {len(state.resources)}")
            
            for resource_type, resources in state.resources.items():
                print(f"    - {resource_type}: {len(resources)} items")
        except Exception as e:
            print(f"✗ State load error: {e}")
    else:
        print("✗ State file does not exist")


def example_json_export():
    """Example: Export results to JSON."""
    print("\n" + "=" * 60)
    print("Example 5: Export Results to JSON")
    print("=" * 60)
    
    # Initialize controller
    controller = ResourceController(
        project_name="user-journey-analytics",
        environment="prod",
        region="us-east-1",
        dry_run=True
    )
    
    # Get status and convert to JSON
    print("\nGetting status and exporting to JSON...")
    report = controller.get_resource_status()
    report_json = json.dumps(report.to_dict(), indent=2)
    
    print("\nJSON Output (first 500 chars):")
    print(report_json[:500] + "...")
    
    # Save to file
    output_file = "logs/resource-status-example.json"
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w') as f:
        f.write(report_json)
    
    print(f"\n✓ Full JSON saved to: {output_file}")


def main():
    """Run all examples."""
    print("\n" + "=" * 60)
    print("ResourceController Usage Examples")
    print("=" * 60)
    print("\nThese examples demonstrate the ResourceController API.")
    print("All operations are in dry-run mode and won't modify AWS resources.")
    print()
    
    try:
        # Run examples
        example_stop_resources()
        example_start_resources()
        example_get_status()
        example_save_and_restore_state()
        example_json_export()
        
        print("\n" + "=" * 60)
        print("All examples completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ Example failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
