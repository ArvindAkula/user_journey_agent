"""
State management module for AWS resource configurations.

This module handles saving and loading resource state to enable
stopping and restarting AWS resources while preserving their configurations.
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict, field
from enum import Enum

try:
    import boto3
    from botocore.exceptions import ClientError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False
    boto3 = None
    ClientError = Exception

try:
    from .exceptions import StateError, ValidationError, ConfigurationError
    from .error_handler import ErrorHandler, retry_with_backoff
    from .logging_config import get_logger, OperationLogger
except ImportError:
    from exceptions import StateError, ValidationError, ConfigurationError
    from error_handler import ErrorHandler, retry_with_backoff
    from logging_config import get_logger, OperationLogger

logger = get_logger(__name__)


class ResourceType(Enum):
    """Enumeration of supported AWS resource types."""
    LAMBDA = "lambda_functions"
    SAGEMAKER = "sagemaker_endpoints"
    KINESIS = "kinesis_streams"
    DYNAMODB = "dynamodb_tables"
    CLOUDWATCH = "cloudwatch_alarms"


@dataclass
class ResourceConfig:
    """Configuration for a single AWS resource."""
    name: str
    type: str
    configuration: Dict[str, Any]
    tags: Dict[str, str] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ResourceConfig':
        """Create ResourceConfig from dictionary."""
        return cls(**data)


@dataclass
class ResourceState:
    """Complete state of all managed AWS resources."""
    version: str
    timestamp: str
    project: str
    environment: str
    resources: Dict[str, List[Dict[str, Any]]]
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ResourceState':
        """Create ResourceState from dictionary."""
        return cls(**data)


class StateManager:
    """
    Manages persistence and restoration of AWS resource state.
    
    Handles:
    - Saving resource configurations to local JSON files
    - Loading resource configurations from local JSON files
    - Optional S3 backup functionality
    - State validation and versioning
    """
    
    STATE_VERSION = "1.0"
    STATE_SCHEMA_VERSION = "1.0"
    
    def __init__(
        self,
        state_file: str = "config/aws-resource-state.json",
        s3_bucket: Optional[str] = None,
        s3_prefix: str = "state-backups/",
        project_name: str = "user-journey-analytics",
        environment: str = "prod"
    ):
        """
        Initialize StateManager.
        
        Args:
            state_file: Path to local state file
            s3_bucket: Optional S3 bucket for backups
            s3_prefix: S3 key prefix for backup files
            project_name: Project name for state identification
            environment: Environment name (dev, staging, prod)
        """
        self.state_file = Path(state_file)
        self.s3_bucket = s3_bucket
        self.s3_prefix = s3_prefix
        self.project_name = project_name
        self.environment = environment
        
        # Initialize S3 client if bucket is configured
        self.s3_client = None
        if s3_bucket and BOTO3_AVAILABLE:
            try:
                self.s3_client = boto3.client('s3')
                logger.info(f"S3 backup enabled: s3://{s3_bucket}/{s3_prefix}")
            except Exception as e:
                logger.warning(f"Failed to initialize S3 client: {e}")
        
        # Ensure state file directory exists
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"StateManager initialized: {self.state_file}")
    
    def save_state(
        self,
        resources: Dict[str, List[Dict[str, Any]]],
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Save resource state to local file and optionally to S3.
        
        Args:
            resources: Dictionary of resource type to list of resource configs
            metadata: Optional metadata to include in state
            
        Returns:
            True if save was successful
            
        Raises:
            StateError: If save operation fails
        """
        with OperationLogger(logger, "save_state", file=str(self.state_file)):
            try:
                # Create state object
                state = ResourceState(
                    version=self.STATE_VERSION,
                    timestamp=datetime.utcnow().isoformat() + "Z",
                    project=self.project_name,
                    environment=self.environment,
                    resources=resources,
                    metadata=metadata or {}
                )
                
                # Validate state before saving
                self._validate_state(state.to_dict())
                
                # Convert to JSON
                state_json = json.dumps(state.to_dict(), indent=2, sort_keys=True)
                
                # Save to local file
                self._save_to_file(state_json)
                
                # Backup to S3 if configured
                if self.s3_client and self.s3_bucket:
                    try:
                        self._backup_to_s3(state_json)
                    except Exception as e:
                        logger.warning(f"S3 backup failed (continuing): {e}")
                
                logger.info(f"State saved successfully: {len(resources)} resource types")
                return True
                
            except Exception as e:
                error_msg = f"Failed to save state: {e}"
                logger.error(error_msg)
                raise StateError(
                    error_msg,
                    details={'file': str(self.state_file), 'error': str(e)}
                )
    
    def load_state(self) -> ResourceState:
        """
        Load resource state from local file.
        
        Returns:
            ResourceState object with loaded configuration
            
        Raises:
            StateError: If load operation fails or file doesn't exist
        """
        with OperationLogger(logger, "load_state", file=str(self.state_file)):
            try:
                # Check if state file exists
                if not self.state_file.exists():
                    raise StateError(
                        f"State file not found: {self.state_file}",
                        details={'file': str(self.state_file)}
                    )
                
                # Read state file
                with open(self.state_file, 'r') as f:
                    state_data = json.load(f)
                
                # Validate state
                self._validate_state(state_data)
                
                # Create ResourceState object
                state = ResourceState.from_dict(state_data)
                
                logger.info(
                    f"State loaded successfully: {len(state.resources)} resource types, "
                    f"timestamp: {state.timestamp}"
                )
                
                return state
                
            except json.JSONDecodeError as e:
                error_msg = f"Invalid JSON in state file: {e}"
                logger.error(error_msg)
                raise StateError(
                    error_msg,
                    details={'file': str(self.state_file), 'error': str(e)}
                )
            except StateError:
                raise
            except Exception as e:
                error_msg = f"Failed to load state: {e}"
                logger.error(error_msg)
                raise StateError(
                    error_msg,
                    details={'file': str(self.state_file), 'error': str(e)}
                )
    
    def state_exists(self) -> bool:
        """
        Check if state file exists.
        
        Returns:
            True if state file exists
        """
        return self.state_file.exists()
    
    def backup_to_s3(self) -> bool:
        """
        Backup current state file to S3.
        
        Returns:
            True if backup was successful
            
        Raises:
            StateError: If backup fails
            ConfigurationError: If S3 is not configured
        """
        if not self.s3_client or not self.s3_bucket:
            raise ConfigurationError(
                "S3 backup not configured",
                details={'s3_bucket': self.s3_bucket}
            )
        
        with OperationLogger(logger, "backup_to_s3", bucket=self.s3_bucket):
            try:
                # Read current state file
                if not self.state_file.exists():
                    raise StateError(f"State file not found: {self.state_file}")
                
                with open(self.state_file, 'r') as f:
                    state_json = f.read()
                
                # Upload to S3
                self._backup_to_s3(state_json)
                
                return True
                
            except Exception as e:
                error_msg = f"Failed to backup state to S3: {e}"
                logger.error(error_msg)
                raise StateError(
                    error_msg,
                    details={'bucket': self.s3_bucket, 'error': str(e)}
                )
    
    @retry_with_backoff(max_retries=2, initial_delay=1.0)
    def restore_from_s3(self, timestamp: Optional[str] = None) -> ResourceState:
        """
        Restore state from S3 backup.
        
        Args:
            timestamp: Optional specific timestamp to restore (format: YYYY-MM-DDTHH:MM:SS)
                      If None, restores the most recent backup
        
        Returns:
            ResourceState object with restored configuration
            
        Raises:
            StateError: If restore fails
            ConfigurationError: If S3 is not configured
        """
        if not self.s3_client or not self.s3_bucket:
            raise ConfigurationError(
                "S3 backup not configured",
                details={'s3_bucket': self.s3_bucket}
            )
        
        with OperationLogger(logger, "restore_from_s3", bucket=self.s3_bucket):
            try:
                # Determine S3 key
                if timestamp:
                    s3_key = self._get_s3_key(timestamp)
                else:
                    # Find most recent backup
                    s3_key = self._find_latest_backup()
                
                logger.info(f"Restoring from S3: s3://{self.s3_bucket}/{s3_key}")
                
                # Download from S3
                response = self.s3_client.get_object(
                    Bucket=self.s3_bucket,
                    Key=s3_key
                )
                
                state_json = response['Body'].read().decode('utf-8')
                state_data = json.loads(state_json)
                
                # Validate state
                self._validate_state(state_data)
                
                # Save to local file
                self._save_to_file(state_json)
                
                # Create ResourceState object
                state = ResourceState.from_dict(state_data)
                
                logger.info(f"State restored from S3: {s3_key}")
                
                return state
                
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', 'Unknown')
                if error_code == 'NoSuchKey':
                    raise StateError(
                        f"Backup not found in S3: {s3_key}",
                        details={'bucket': self.s3_bucket, 'key': s3_key}
                    )
                raise StateError(
                    f"Failed to restore from S3: {e}",
                    details={'bucket': self.s3_bucket, 'error': str(e)}
                )
            except Exception as e:
                error_msg = f"Failed to restore state from S3: {e}"
                logger.error(error_msg)
                raise StateError(
                    error_msg,
                    details={'bucket': self.s3_bucket, 'error': str(e)}
                )
    
    def list_backups(self) -> List[Dict[str, Any]]:
        """
        List available S3 backups.
        
        Returns:
            List of backup metadata dictionaries
            
        Raises:
            ConfigurationError: If S3 is not configured
        """
        if not self.s3_client or not self.s3_bucket:
            raise ConfigurationError(
                "S3 backup not configured",
                details={'s3_bucket': self.s3_bucket}
            )
        
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.s3_bucket,
                Prefix=self.s3_prefix
            )
            
            backups = []
            for obj in response.get('Contents', []):
                backups.append({
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat(),
                    'timestamp': self._extract_timestamp_from_key(obj['Key'])
                })
            
            # Sort by timestamp (most recent first)
            backups.sort(key=lambda x: x['last_modified'], reverse=True)
            
            logger.info(f"Found {len(backups)} backups in S3")
            return backups
            
        except Exception as e:
            logger.error(f"Failed to list S3 backups: {e}")
            return []
    
    def _validate_state(self, state_data: Dict[str, Any]) -> None:
        """
        Validate state data structure.
        
        Args:
            state_data: State dictionary to validate
            
        Raises:
            ValidationError: If state is invalid
        """
        required_fields = ['version', 'timestamp', 'project', 'environment', 'resources']
        
        for field in required_fields:
            if field not in state_data:
                raise ValidationError(
                    f"Missing required field in state: {field}",
                    details={'field': field}
                )
        
        # Validate version
        if state_data['version'] != self.STATE_VERSION:
            logger.warning(
                f"State version mismatch: expected {self.STATE_VERSION}, "
                f"got {state_data['version']}"
            )
        
        # Validate resources structure
        if not isinstance(state_data['resources'], dict):
            raise ValidationError(
                "Invalid resources structure: must be a dictionary",
                details={'type': type(state_data['resources']).__name__}
            )
        
        # Validate each resource type
        for resource_type, resources in state_data['resources'].items():
            if not isinstance(resources, list):
                raise ValidationError(
                    f"Invalid resource list for {resource_type}: must be a list",
                    details={'resource_type': resource_type, 'type': type(resources).__name__}
                )
        
        logger.debug("State validation passed")
    
    def _save_to_file(self, state_json: str) -> None:
        """
        Save state JSON to local file.
        
        Args:
            state_json: JSON string to save
        """
        # Create backup of existing file if it exists
        if self.state_file.exists():
            backup_file = self.state_file.with_suffix('.json.backup')
            self.state_file.rename(backup_file)
            logger.debug(f"Created backup: {backup_file}")
        
        # Write new state file
        with open(self.state_file, 'w') as f:
            f.write(state_json)
        
        logger.debug(f"State written to file: {self.state_file}")
    
    @retry_with_backoff(max_retries=2, initial_delay=1.0)
    def _backup_to_s3(self, state_json: str) -> None:
        """
        Upload state to S3 with timestamp.
        
        Args:
            state_json: JSON string to upload
        """
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        s3_key = self._get_s3_key(timestamp)
        
        self.s3_client.put_object(
            Bucket=self.s3_bucket,
            Key=s3_key,
            Body=state_json.encode('utf-8'),
            ContentType='application/json',
            Metadata={
                'project': self.project_name,
                'environment': self.environment,
                'timestamp': timestamp
            }
        )
        
        logger.info(f"State backed up to S3: s3://{self.s3_bucket}/{s3_key}")
    
    def _get_s3_key(self, timestamp: str) -> str:
        """
        Generate S3 key for state backup.
        
        Args:
            timestamp: Timestamp string
            
        Returns:
            S3 key path
        """
        filename = f"state_{self.project_name}_{self.environment}_{timestamp}.json"
        return f"{self.s3_prefix}{filename}"
    
    def _find_latest_backup(self) -> str:
        """
        Find the most recent backup in S3.
        
        Returns:
            S3 key of the most recent backup
            
        Raises:
            StateError: If no backups found
        """
        backups = self.list_backups()
        
        if not backups:
            raise StateError(
                "No backups found in S3",
                details={'bucket': self.s3_bucket, 'prefix': self.s3_prefix}
            )
        
        return backups[0]['key']
    
    def _extract_timestamp_from_key(self, key: str) -> str:
        """
        Extract timestamp from S3 key.
        
        Args:
            key: S3 key
            
        Returns:
            Timestamp string or empty string if not found
        """
        try:
            # Expected format: state_project_env_YYYYMMDD_HHMMSS.json
            parts = key.split('_')
            if len(parts) >= 2:
                # Get last two parts before .json
                timestamp = '_'.join(parts[-2:]).replace('.json', '')
                return timestamp
        except Exception:
            pass
        
        return ""
