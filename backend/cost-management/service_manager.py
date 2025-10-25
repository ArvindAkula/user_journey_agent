"""
Base service manager interface for AWS resource management.

This module defines the abstract base class that all AWS service managers
must implement, providing a consistent interface for stop, start, status,
and cost estimation operations.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, Any, Optional, List

try:
    from .logging_config import get_logger
    from .exceptions import AWSServiceError, ValidationError
except ImportError:
    from logging_config import get_logger
    from exceptions import AWSServiceError, ValidationError

logger = get_logger(__name__)


class ResourceStatus(Enum):
    """Enumeration of possible resource states."""
    RUNNING = "running"
    STOPPED = "stopped"
    STARTING = "starting"
    STOPPING = "stopping"
    FAILED = "failed"
    UNKNOWN = "unknown"


@dataclass
class ServiceResult:
    """Result of a service operation (stop, start, etc.)."""
    success: bool
    operation: str
    service_type: str
    resources_affected: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            'success': self.success,
            'operation': self.operation,
            'service_type': self.service_type,
            'resources_affected': self.resources_affected,
            'errors': self.errors,
            'warnings': self.warnings,
            'details': self.details,
            'timestamp': self.timestamp
        }


@dataclass
class ServiceStatus:
    """Status information for a service."""
    service_type: str
    status: ResourceStatus
    resources: List[Dict[str, Any]] = field(default_factory=list)
    total_resources: int = 0
    running_resources: int = 0
    stopped_resources: int = 0
    estimated_hourly_cost: float = 0.0
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            'service_type': self.service_type,
            'status': self.status.value,
            'resources': self.resources,
            'total_resources': self.total_resources,
            'running_resources': self.running_resources,
            'stopped_resources': self.stopped_resources,
            'estimated_hourly_cost': self.estimated_hourly_cost,
            'details': self.details,
            'timestamp': self.timestamp
        }


class ServiceManager(ABC):
    """
    Abstract base class for AWS service managers.
    
    All service-specific managers (Lambda, Kinesis, etc.) must inherit from
    this class and implement the required methods.
    """
    
    def __init__(
        self,
        project_name: str = "user-journey-analytics",
        environment: str = "prod",
        region: str = "us-east-1",
        dry_run: bool = False
    ):
        """
        Initialize service manager.
        
        Args:
            project_name: Project name for resource filtering
            environment: Environment name (dev, staging, prod)
            region: AWS region
            dry_run: If True, simulate operations without making changes
        """
        self.project_name = project_name
        self.environment = environment
        self.region = region
        self.dry_run = dry_run
        self.logger = get_logger(self.__class__.__name__)
        
        self.logger.debug(
            f"Initialized {self.__class__.__name__}: "
            f"project={project_name}, env={environment}, region={region}, dry_run={dry_run}"
        )
    
    @abstractmethod
    def stop(self, dry_run: Optional[bool] = None) -> ServiceResult:
        """
        Stop or minimize resources to reduce costs.
        
        Args:
            dry_run: Override instance dry_run setting if provided
            
        Returns:
            ServiceResult with operation outcome
            
        Raises:
            AWSServiceError: If operation fails
        """
        pass
    
    @abstractmethod
    def start(self, dry_run: Optional[bool] = None) -> ServiceResult:
        """
        Start or restore resources to operational state.
        
        Args:
            dry_run: Override instance dry_run setting if provided
            
        Returns:
            ServiceResult with operation outcome
            
        Raises:
            AWSServiceError: If operation fails
        """
        pass
    
    @abstractmethod
    def get_status(self) -> ServiceStatus:
        """
        Get current status of all managed resources.
        
        Returns:
            ServiceStatus with current state information
            
        Raises:
            AWSServiceError: If status check fails
        """
        pass
    
    @abstractmethod
    def estimate_cost(self) -> float:
        """
        Estimate hourly cost for current resource configuration.
        
        Returns:
            Estimated hourly cost in USD
            
        Raises:
            AWSServiceError: If cost estimation fails
        """
        pass
    
    @abstractmethod
    def save_configuration(self) -> Dict[str, Any]:
        """
        Save current resource configurations for later restoration.
        
        Returns:
            Dictionary containing resource configurations
            
        Raises:
            AWSServiceError: If configuration save fails
        """
        pass
    
    @abstractmethod
    def restore_configuration(self, config: Dict[str, Any]) -> bool:
        """
        Restore resources from saved configuration.
        
        Args:
            config: Configuration dictionary from save_configuration()
            
        Returns:
            True if restoration was successful
            
        Raises:
            AWSServiceError: If configuration restore fails
            ValidationError: If configuration is invalid
        """
        pass
    
    def _is_dry_run(self, dry_run_override: Optional[bool] = None) -> bool:
        """
        Determine if operation should be in dry-run mode.
        
        Args:
            dry_run_override: Override instance setting if provided
            
        Returns:
            True if operation should be dry-run
        """
        return dry_run_override if dry_run_override is not None else self.dry_run
    
    def _get_resource_tags(self) -> Dict[str, str]:
        """
        Get standard resource tags for filtering.
        
        Returns:
            Dictionary of tag key-value pairs
        """
        return {
            'Project': self.project_name,
            'Environment': self.environment
        }
    
    def _log_dry_run(self, operation: str, details: str):
        """
        Log a dry-run operation.
        
        Args:
            operation: Operation name
            details: Operation details
        """
        self.logger.info(f"[DRY RUN] {operation}: {details}")
    
    def _validate_configuration(self, config: Dict[str, Any], required_fields: List[str]) -> None:
        """
        Validate configuration dictionary has required fields.
        
        Args:
            config: Configuration to validate
            required_fields: List of required field names
            
        Raises:
            ValidationError: If validation fails
        """
        missing_fields = [field for field in required_fields if field not in config]
        
        if missing_fields:
            raise ValidationError(
                f"Missing required configuration fields: {', '.join(missing_fields)}",
                details={'missing_fields': missing_fields, 'config': config}
            )
