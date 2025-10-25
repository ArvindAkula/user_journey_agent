#!/usr/bin/env python3
"""
Simple test script for ResourceController.

Tests basic functionality without making actual AWS API calls.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from controller import ResourceController, OperationResult, ResourceStatusReport
    from service_manager import ResourceStatus
    print("✓ Successfully imported ResourceController")
except ImportError as e:
    print(f"✗ Failed to import ResourceController: {e}")
    sys.exit(1)

def test_controller_initialization():
    """Test controller initialization."""
    print("\n=== Testing Controller Initialization ===")
    try:
        controller = ResourceController(
            project_name="test-project",
            environment="dev",
            region="us-east-1",
            dry_run=True
        )
        print("✓ Controller initialized successfully")
        print(f"  - Project: {controller.project_name}")
        print(f"  - Environment: {controller.environment}")
        print(f"  - Region: {controller.region}")
        print(f"  - Dry run: {controller.dry_run}")
        return True
    except Exception as e:
        print(f"✗ Controller initialization failed: {e}")
        return False

def test_stop_all_resources_dry_run():
    """Test stop_all_resources in dry-run mode."""
    print("\n=== Testing stop_all_resources (dry-run) ===")
    try:
        controller = ResourceController(
            project_name="test-project",
            environment="dev",
            region="us-east-1",
            dry_run=True
        )
        
        result = controller.stop_all_resources(dry_run=True)
        
        print(f"✓ Stop operation completed")
        print(f"  - Success: {result.success}")
        print(f"  - Operation: {result.operation}")
        print(f"  - Resources affected: {len(result.resources_affected)}")
        print(f"  - Errors: {len(result.errors)}")
        print(f"  - Warnings: {len(result.warnings)}")
        print(f"  - Duration: {result.duration_seconds:.2f}s")
        
        # Check result structure
        assert isinstance(result, OperationResult), "Result should be OperationResult"
        assert result.operation == "stop", "Operation should be 'stop'"
        assert isinstance(result.service_results, dict), "Service results should be dict"
        
        return True
    except Exception as e:
        print(f"✗ Stop operation failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_start_all_resources_dry_run():
    """Test start_all_resources in dry-run mode."""
    print("\n=== Testing start_all_resources (dry-run) ===")
    try:
        controller = ResourceController(
            project_name="test-project",
            environment="dev",
            region="us-east-1",
            dry_run=True
        )
        
        result = controller.start_all_resources(dry_run=True)
        
        print(f"✓ Start operation completed")
        print(f"  - Success: {result.success}")
        print(f"  - Operation: {result.operation}")
        print(f"  - Resources affected: {len(result.resources_affected)}")
        print(f"  - Errors: {len(result.errors)}")
        print(f"  - Warnings: {len(result.warnings)}")
        print(f"  - Duration: {result.duration_seconds:.2f}s")
        
        # Check result structure
        assert isinstance(result, OperationResult), "Result should be OperationResult"
        assert result.operation == "start", "Operation should be 'start'"
        assert isinstance(result.service_results, dict), "Service results should be dict"
        
        return True
    except Exception as e:
        print(f"✗ Start operation failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_get_resource_status():
    """Test get_resource_status."""
    print("\n=== Testing get_resource_status ===")
    try:
        controller = ResourceController(
            project_name="test-project",
            environment="dev",
            region="us-east-1",
            dry_run=True
        )
        
        report = controller.get_resource_status()
        
        print(f"✓ Status report generated")
        print(f"  - Overall status: {report.overall_status}")
        print(f"  - Total resources: {report.total_resources}")
        print(f"  - Running resources: {report.running_resources}")
        print(f"  - Stopped resources: {report.stopped_resources}")
        print(f"  - Estimated hourly cost: ${report.estimated_hourly_cost:.4f}")
        print(f"  - Estimated daily cost: ${report.estimated_daily_cost:.2f}")
        print(f"  - Estimated monthly cost: ${report.estimated_monthly_cost:.2f}")
        print(f"  - Services: {', '.join(report.service_status.keys())}")
        print(f"  - Recommendations: {len(report.recommendations)}")
        
        # Check report structure
        assert isinstance(report, ResourceStatusReport), "Report should be ResourceStatusReport"
        assert isinstance(report.service_status, dict), "Service status should be dict"
        assert isinstance(report.recommendations, list), "Recommendations should be list"
        
        return True
    except Exception as e:
        print(f"✗ Status report failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_result_serialization():
    """Test result serialization to dict."""
    print("\n=== Testing Result Serialization ===")
    try:
        controller = ResourceController(
            project_name="test-project",
            environment="dev",
            region="us-east-1",
            dry_run=True
        )
        
        # Test OperationResult serialization
        result = controller.stop_all_resources(dry_run=True)
        result_dict = result.to_dict()
        
        assert isinstance(result_dict, dict), "Result should serialize to dict"
        assert 'success' in result_dict, "Result dict should have 'success'"
        assert 'operation' in result_dict, "Result dict should have 'operation'"
        assert 'timestamp' in result_dict, "Result dict should have 'timestamp'"
        
        print("✓ OperationResult serialization works")
        
        # Test ResourceStatusReport serialization
        report = controller.get_resource_status()
        report_dict = report.to_dict()
        
        assert isinstance(report_dict, dict), "Report should serialize to dict"
        assert 'overall_status' in report_dict, "Report dict should have 'overall_status'"
        assert 'estimated_costs' in report_dict, "Report dict should have 'estimated_costs'"
        
        print("✓ ResourceStatusReport serialization works")
        
        return True
    except Exception as e:
        print(f"✗ Serialization test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests."""
    print("=" * 60)
    print("ResourceController Test Suite")
    print("=" * 60)
    
    tests = [
        test_controller_initialization,
        test_stop_all_resources_dry_run,
        test_start_all_resources_dry_run,
        test_get_resource_status,
        test_result_serialization
    ]
    
    results = []
    for test in tests:
        try:
            results.append(test())
        except Exception as e:
            print(f"\n✗ Test {test.__name__} crashed: {e}")
            import traceback
            traceback.print_exc()
            results.append(False)
    
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("\n✓ All tests passed!")
        return 0
    else:
        print(f"\n✗ {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
