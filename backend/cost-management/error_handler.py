"""
Error handling utilities with retry logic for AWS operations.
"""

import time
import logging
from typing import Callable, Any, Optional, Type, Tuple
from functools import wraps
from botocore.exceptions import ClientError, BotoCoreError

try:
    from .exceptions import (
        AWSServiceError,
        ThrottlingError,
        PermissionError,
        ResourceNotFoundError,
        ValidationError,
        StateError,
        DependencyError,
        ConfigurationError
    )
except ImportError:
    from exceptions import (
        AWSServiceError,
        ThrottlingError,
        PermissionError,
        ResourceNotFoundError,
        ValidationError,
        StateError,
        DependencyError,
        ConfigurationError
    )

logger = logging.getLogger(__name__)


class ErrorHandler:
    """Centralized error handling for the cost management system."""
    
    # AWS error codes that should trigger retries
    RETRYABLE_ERROR_CODES = {
        'ThrottlingException',
        'TooManyRequestsException',
        'RequestLimitExceeded',
        'ServiceUnavailable',
        'InternalError',
        'RequestTimeout',
        'PriorRequestNotComplete'
    }
    
    # AWS error codes that indicate permission issues
    PERMISSION_ERROR_CODES = {
        'AccessDenied',
        'AccessDeniedException',
        'UnauthorizedOperation',
        'UnauthorizedException',
        'Forbidden',
        'InvalidClientTokenId'
    }
    
    # AWS error codes that indicate resource not found
    NOT_FOUND_ERROR_CODES = {
        'ResourceNotFoundException',
        'NoSuchEntity',
        'NotFound',
        'InvalidParameterValue'
    }
    
    @staticmethod
    def handle_validation_error(error: ValidationError) -> None:
        """
        Handle validation errors by logging and providing user-friendly message.
        
        Args:
            error: The validation error to handle
        """
        logger.error(f"Validation error: {error}")
        print(f"\n❌ Validation Error: {error.message}")
        if error.details:
            print(f"   Details: {error.details}")
        raise error
    
    @staticmethod
    def handle_aws_error(error: Exception, service: str, operation: str) -> AWSServiceError:
        """
        Handle AWS errors and convert to appropriate custom exception.
        
        Args:
            error: The original AWS error
            service: The AWS service name
            operation: The operation being performed
            
        Returns:
            Appropriate AWSServiceError subclass
        """
        if isinstance(error, ClientError):
            error_code = error.response.get('Error', {}).get('Code', 'Unknown')
            error_message = error.response.get('Error', {}).get('Message', str(error))
            
            logger.error(
                f"AWS {service} error during {operation}: {error_code} - {error_message}",
                extra={'error_code': error_code, 'service': service, 'operation': operation}
            )
            
            # Determine the appropriate exception type
            if error_code in ErrorHandler.RETRYABLE_ERROR_CODES:
                return ThrottlingError(
                    error_message, service, operation, error_code,
                    details={'retryable': True}
                )
            elif error_code in ErrorHandler.PERMISSION_ERROR_CODES:
                return PermissionError(
                    error_message, service, operation, error_code,
                    details={'action_required': 'Check IAM permissions'}
                )
            elif error_code in ErrorHandler.NOT_FOUND_ERROR_CODES:
                return ResourceNotFoundError(
                    error_message, service, operation, error_code
                )
            else:
                return AWSServiceError(error_message, service, operation, error_code)
        
        elif isinstance(error, BotoCoreError):
            logger.error(f"BotoCore error during {service}.{operation}: {str(error)}")
            return AWSServiceError(str(error), service, operation)
        
        else:
            logger.error(f"Unexpected error during {service}.{operation}: {str(error)}")
            return AWSServiceError(str(error), service, operation)
    
    @staticmethod
    def handle_state_error(error: StateError) -> None:
        """
        Handle state file errors with recovery suggestions.
        
        Args:
            error: The state error to handle
        """
        logger.error(f"State error: {error}")
        print(f"\n❌ State Error: {error.message}")
        if error.details:
            print(f"   Details: {error.details}")
        print("\n💡 Suggestions:")
        print("   - Check if the state file exists and is readable")
        print("   - Try restoring from S3 backup if configured")
        print("   - Run with --force to create a new state file")
        raise error
    
    @staticmethod
    def handle_dependency_error(error: DependencyError) -> None:
        """
        Handle dependency errors by showing dependency chain.
        
        Args:
            error: The dependency error to handle
        """
        logger.error(f"Dependency error: {error}")
        print(f"\n❌ Dependency Error: {error.message}")
        print(f"   Resource: {error.resource}")
        print(f"   Dependencies: {', '.join(error.dependencies)}")
        print("\n💡 Suggestion: Stop dependent resources first or use --force to override")
        raise error


def retry_with_backoff(
    max_retries: int = 3,
    initial_delay: float = 1.0,
    backoff_factor: float = 2.0,
    exceptions: Tuple[Type[Exception], ...] = (ThrottlingError, AWSServiceError)
) -> Callable:
    """
    Decorator to retry functions with exponential backoff.
    
    Args:
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds before first retry
        backoff_factor: Multiplier for delay between retries
        exceptions: Tuple of exception types to catch and retry
        
    Returns:
        Decorated function with retry logic
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            delay = initial_delay
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    
                    # Don't retry on permission errors
                    if isinstance(e, PermissionError):
                        logger.error(f"Permission error, not retrying: {e}")
                        raise
                    
                    # Don't retry on resource not found (unless it's the first attempt)
                    if isinstance(e, ResourceNotFoundError) and attempt > 0:
                        logger.error(f"Resource not found, not retrying: {e}")
                        raise
                    
                    if attempt < max_retries:
                        logger.warning(
                            f"Attempt {attempt + 1}/{max_retries} failed: {e}. "
                            f"Retrying in {delay:.1f}s..."
                        )
                        time.sleep(delay)
                        delay *= backoff_factor
                    else:
                        logger.error(
                            f"All {max_retries} retry attempts failed for {func.__name__}"
                        )
                except Exception as e:
                    # Don't retry unexpected exceptions
                    logger.error(f"Unexpected error in {func.__name__}: {e}")
                    raise
            
            # If we get here, all retries failed
            if last_exception:
                raise last_exception
        
        return wrapper
    return decorator


def safe_aws_call(service: str, operation: str) -> Callable:
    """
    Decorator to safely execute AWS API calls with error handling.
    
    Args:
        service: AWS service name (e.g., 'lambda', 'kinesis')
        operation: Operation name (e.g., 'update_function_configuration')
        
    Returns:
        Decorated function with error handling
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            try:
                return func(*args, **kwargs)
            except Exception as e:
                aws_error = ErrorHandler.handle_aws_error(e, service, operation)
                raise aws_error
        
        return wrapper
    return decorator
