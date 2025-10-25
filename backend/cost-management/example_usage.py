#!/usr/bin/env python3
"""
Example usage of the error handling, logging, and audit trail system.

This demonstrates how to use the components together in a typical
cost management operation.
"""

import sys
import os
from typing import Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Now we can import as if running as a module
if __name__ == '__main__':
    from logging_config import setup_logging, get_logger, OperationLogger
    from error_handler import (
        retry_with_backoff,
        safe_aws_call,
        ErrorHandler
    )
    from exceptions import (
        AWSServiceError,
        ThrottlingError,
        ValidationError,
        StateError
    )
    from audit_trail import AuditTrail, OperationType
else:
    from .logging_config import setup_logging, get_logger, OperationLogger
    from .error_handler import (
        retry_with_backoff,
        safe_aws_call,
        ErrorHandler
    )
    from .exceptions import (
        AWSServiceError,
        ThrottlingError,
        ValidationError,
        StateError
    )
    from .audit_trail import AuditTrail, OperationType


# Initialize logging
setup_logging(console_level=20, file_level=10)  # INFO for console, DEBUG for file
logger = get_logger(__name__)


class ExampleServiceManager:
    """Example service manager demonstrating error handling patterns."""
    
    def __init__(self):
        self.logger = get_logger(self.__class__.__name__)
    
    @retry_with_backoff(max_retries=3, initial_delay=1.0)
    @safe_aws_call(service='example', operation='get_resource')
    def get_resource_with_retry(self, resource_id: str) -> Dict[str, Any]:
        """
        Example method with retry logic and error handling.
        
        This demonstrates:
        - Automatic retry on transient errors
        - AWS error handling
        - Proper logging
        """
        self.logger.info(f"Fetching resource: {resource_id}")
        
        # Simulate AWS API call
        # In real code, this would be: boto3.client('service').describe_resource(...)
        
        # For demonstration, we'll return mock data
        return {
            'ResourceId': resource_id,
            'State': 'active',
            'Configuration': {'key': 'value'}
        }
    
    def stop_resource(self, resource_id: str, audit: AuditTrail) -> bool:
        """
        Example method showing audit trail integration.
        
        This demonstrates:
        - Recording resource state changes
        - Error handling with audit trail
        - Before/after state tracking
        """
        try:
            # Get current state
            before_state = self.get_resource_with_retry(resource_id)
            
            self.logger.info(f"Stopping resource: {resource_id}")
            
            # Simulate stopping the resource
            # In real code: boto3.client('service').stop_resource(...)
            
            after_state = {
                'ResourceId': resource_id,
                'State': 'stopped',
                'Configuration': before_state.get('Configuration', {})
            }
            
            # Record the change in audit trail
            audit.record_resource_change(
                resource_id=resource_id,
                resource_type='example',
                action='stop',
                before_state=before_state,
                after_state=after_state,
                success=True
            )
            
            self.logger.info(f"Successfully stopped resource: {resource_id}")
            return True
            
        except AWSServiceError as e:
            error_msg = f"Failed to stop resource {resource_id}: {e}"
            self.logger.error(error_msg)
            audit.add_error(error_msg)
            return False
        except Exception as e:
            error_msg = f"Unexpected error stopping resource {resource_id}: {e}"
            self.logger.error(error_msg)
            audit.add_error(error_msg)
            return False


def example_operation_with_audit():
    """
    Example of a complete operation with audit trail.
    
    This demonstrates:
    - Starting an operation
    - Recording resource changes
    - Handling errors
    - Completing the operation with reports
    """
    logger.info("Starting example operation with audit trail")
    
    # Initialize audit trail
    audit = AuditTrail(operations_dir="logs/operations")
    
    # Start tracking the operation
    operation_id = audit.start_operation(
        operation_type=OperationType.STOP,
        dry_run=False,
        environment='dev',
        reason='Example demonstration'
    )
    
    try:
        # Create service manager
        service_manager = ExampleServiceManager()
        
        # Perform operations on multiple resources
        resources = ['resource-1', 'resource-2', 'resource-3']
        
        for resource_id in resources:
            success = service_manager.stop_resource(resource_id, audit)
            
            if not success:
                audit.add_warning(f"Failed to stop {resource_id}, continuing with others")
        
        # Set cost impact
        audit.set_cost_impact(12.50)  # $12.50 saved
        
        # Complete successfully
        operation_record = audit.complete_operation(success=True)
        
        # Print summary
        audit.print_summary()
        
        logger.info(f"Operation completed: {operation_id}")
        logger.info(f"Reports saved to: logs/operations/{operation_id}.*")
        
        return operation_record
        
    except Exception as e:
        logger.error(f"Operation failed: {e}")
        audit.add_error(str(e))
        audit.complete_operation(success=False)
        raise


def example_with_operation_logger():
    """
    Example using the OperationLogger context manager.
    
    This demonstrates:
    - Automatic timing of operations
    - Context manager for clean code
    - Automatic error logging
    """
    logger.info("Starting example with operation logger")
    
    with OperationLogger(logger, "example_operation", resource_count=5):
        # Simulate some work
        logger.info("Performing operation steps...")
        
        # In real code, this would be actual AWS operations
        import time
        time.sleep(0.5)
        
        logger.info("Operation steps completed")
    
    # The context manager automatically logs duration


def example_error_handling():
    """
    Example of different error handling scenarios.
    
    This demonstrates:
    - Validation errors
    - State errors
    - AWS service errors
    - Custom error handling
    """
    logger.info("Starting error handling examples")
    
    # Example 1: Validation error
    try:
        if not "valid_input":
            raise ValidationError(
                "Invalid input provided",
                details={'expected': 'string', 'received': 'none'}
            )
    except ValidationError as e:
        ErrorHandler.handle_validation_error(e)
    
    # Example 2: State error
    try:
        raise StateError(
            "State file not found",
            details={'path': 'config/aws-resource-state.json'}
        )
    except StateError as e:
        ErrorHandler.handle_state_error(e)


def main():
    """Main entry point for examples."""
    print("\n" + "=" * 80)
    print("AWS Cost Management System - Error Handling & Logging Examples")
    print("=" * 80 + "\n")
    
    try:
        # Example 1: Operation with audit trail
        print("\n--- Example 1: Operation with Audit Trail ---\n")
        example_operation_with_audit()
        
        # Example 2: Operation logger
        print("\n--- Example 2: Operation Logger ---\n")
        example_with_operation_logger()
        
        print("\n" + "=" * 80)
        print("Examples completed successfully!")
        print("Check logs/aws-resource-manager.log for detailed logs")
        print("Check logs/operations/ for operation reports")
        print("=" * 80 + "\n")
        
    except Exception as e:
        logger.error(f"Example failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
