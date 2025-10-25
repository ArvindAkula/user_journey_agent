"""
Custom exceptions for the AWS Cost Management System.
"""

from typing import Optional, Dict, Any


class CostManagementError(Exception):
    """Base exception for all cost management errors."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}
    
    def __str__(self):
        if self.details:
            return f"{self.message} - Details: {self.details}"
        return self.message


class ValidationError(CostManagementError):
    """Raised when input validation fails."""
    pass


class StateError(CostManagementError):
    """Raised when state file operations fail."""
    pass


class AWSServiceError(CostManagementError):
    """Raised when AWS service operations fail."""
    
    def __init__(self, message: str, service: str, operation: str, 
                 error_code: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, details)
        self.service = service
        self.operation = operation
        self.error_code = error_code
    
    def __str__(self):
        error_msg = f"AWS {self.service} error during {self.operation}: {self.message}"
        if self.error_code:
            error_msg += f" (Error Code: {self.error_code})"
        if self.details:
            error_msg += f" - Details: {self.details}"
        return error_msg


class ThrottlingError(AWSServiceError):
    """Raised when AWS API throttling occurs."""
    pass


class PermissionError(AWSServiceError):
    """Raised when AWS permission errors occur."""
    pass


class ResourceNotFoundError(AWSServiceError):
    """Raised when AWS resource is not found."""
    pass


class DependencyError(CostManagementError):
    """Raised when resource dependencies prevent an operation."""
    
    def __init__(self, message: str, resource: str, dependencies: list, 
                 details: Optional[Dict[str, Any]] = None):
        super().__init__(message, details)
        self.resource = resource
        self.dependencies = dependencies
    
    def __str__(self):
        deps = ", ".join(self.dependencies)
        return f"{self.message} - Resource: {self.resource}, Dependencies: {deps}"


class ConfigurationError(CostManagementError):
    """Raised when configuration is invalid or missing."""
    pass
