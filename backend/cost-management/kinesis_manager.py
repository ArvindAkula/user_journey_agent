"""
Kinesis service manager for AWS resource management.

Manages Kinesis Data Streams by adjusting shard counts to minimize costs
when not in use and restore capacity when needed.
"""

from typing import Dict, Any, Optional, List

try:
    import boto3
    from botocore.exceptions import ClientError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False
    boto3 = None
    ClientError = Exception

try:
    from .service_manager import ServiceManager, ServiceResult, ServiceStatus, ResourceStatus
    from .exceptions import AWSServiceError, ValidationError
    from .error_handler import retry_with_backoff
    from .logging_config import get_logger, OperationLogger
except ImportError:
    from service_manager import ServiceManager, ServiceResult, ServiceStatus, ResourceStatus
    from exceptions import AWSServiceError, ValidationError
    from error_handler import retry_with_backoff
    from logging_config import get_logger, OperationLogger

logger = get_logger(__name__)


class KinesisManager(ServiceManager):
    """
    Manages Kinesis Data Streams lifecycle and shard counts.
    
    Cost optimization strategy:
    - Stop: Reduce shard count from 2 to 1 (saves ~$0.36/day)
    - Start: Restore shard count to original value (typically 2)
    
    AWS Pricing (us-east-1):
    - Shard hour: $0.015
    - PUT payload unit (25KB): $0.014 per million
    """
    
    # AWS Kinesis pricing constants (us-east-1)
    SHARD_HOUR_COST = 0.015  # USD per shard hour
    PUT_PAYLOAD_UNIT_COST = 0.014  # USD per million PUT payload units (25KB each)
    
    # Stream configuration
    STREAM_NAME = "user-journey-analytics-user-events"
    MINIMAL_SHARD_COUNT = 1
    DEFAULT_SHARD_COUNT = 2
    
    def __init__(
        self,
        project_name: str = "user-journey-analytics",
        environment: str = "prod",
        region: str = "us-east-1",
        dry_run: bool = False
    ):
        """
        Initialize Kinesis manager.
        
        Args:
            project_name: Project name for resource filtering
            environment: Environment name (dev, staging, prod)
            region: AWS region
            dry_run: If True, simulate operations without making changes
        """
        super().__init__(project_name, environment, region, dry_run)
        
        if not BOTO3_AVAILABLE:
            raise ImportError("boto3 is required for KinesisManager")
        
        self.kinesis_client = boto3.client('kinesis', region_name=region)
        self.stream_name = f"{project_name}-user-events"
        if environment != "prod":
            self.stream_name += f"-{environment}"
        
        self.logger.info(f"KinesisManager initialized for stream: {self.stream_name}")
    
    @retry_with_backoff(max_retries=3, initial_delay=1.0)
    def stop(self, dry_run: Optional[bool] = None) -> ServiceResult:
        """
        Reduce Kinesis stream to minimal shard count to minimize costs.
        
        Args:
            dry_run: Override instance dry_run setting if provided
            
        Returns:
            ServiceResult with operation outcome
        """
        is_dry_run = self._is_dry_run(dry_run)
        operation = "stop"
        
        with OperationLogger(self.logger, operation, stream=self.stream_name, dry_run=is_dry_run):
            try:
                # Get current stream configuration
                stream_info = self._describe_stream()
                current_shard_count = stream_info['shard_count']
                stream_status = stream_info['status']
                
                self.logger.info(
                    f"Current stream state: {current_shard_count} shards, status: {stream_status}"
                )
                
                # Check if stream is already at minimal capacity
                if current_shard_count <= self.MINIMAL_SHARD_COUNT:
                    self.logger.info(
                        f"Stream already at minimal shard count ({current_shard_count}), no action needed"
                    )
                    return ServiceResult(
                        success=True,
                        operation=operation,
                        service_type="kinesis",
                        resources_affected=[self.stream_name],
                        warnings=[f"Stream already at minimal shard count: {current_shard_count}"],
                        details={
                            'stream_name': self.stream_name,
                            'shard_count': current_shard_count,
                            'action': 'none'
                        }
                    )
                
                # Calculate cost savings
                shard_reduction = current_shard_count - self.MINIMAL_SHARD_COUNT
                hourly_savings = shard_reduction * self.SHARD_HOUR_COST
                daily_savings = hourly_savings * 24
                
                if is_dry_run:
                    self._log_dry_run(
                        operation,
                        f"Would reduce {self.stream_name} from {current_shard_count} to "
                        f"{self.MINIMAL_SHARD_COUNT} shards (saves ${daily_savings:.2f}/day)"
                    )
                    return ServiceResult(
                        success=True,
                        operation=operation,
                        service_type="kinesis",
                        resources_affected=[self.stream_name],
                        details={
                            'stream_name': self.stream_name,
                            'current_shard_count': current_shard_count,
                            'target_shard_count': self.MINIMAL_SHARD_COUNT,
                            'estimated_daily_savings': round(daily_savings, 2),
                            'dry_run': True
                        }
                    )
                
                # Update shard count
                self.logger.info(
                    f"Reducing stream from {current_shard_count} to {self.MINIMAL_SHARD_COUNT} shards"
                )
                
                self.kinesis_client.update_shard_count(
                    StreamName=self.stream_name,
                    TargetShardCount=self.MINIMAL_SHARD_COUNT,
                    ScalingType='UNIFORM_SCALING'
                )
                
                self.logger.info(
                    f"Successfully initiated shard count reduction "
                    f"(saves ${daily_savings:.2f}/day)"
                )
                
                return ServiceResult(
                    success=True,
                    operation=operation,
                    service_type="kinesis",
                    resources_affected=[self.stream_name],
                    details={
                        'stream_name': self.stream_name,
                        'previous_shard_count': current_shard_count,
                        'new_shard_count': self.MINIMAL_SHARD_COUNT,
                        'estimated_daily_savings': round(daily_savings, 2)
                    }
                )
                
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', 'Unknown')
                error_msg = e.response.get('Error', {}).get('Message', str(e))
                
                self.logger.error(f"Failed to stop Kinesis stream: {error_msg}")
                
                raise AWSServiceError(
                    f"Failed to reduce shard count: {error_msg}",
                    service="kinesis",
                    operation=operation,
                    error_code=error_code,
                    details={'stream_name': self.stream_name}
                )
            except Exception as e:
                self.logger.error(f"Unexpected error stopping Kinesis stream: {e}")
                raise AWSServiceError(
                    f"Unexpected error: {e}",
                    service="kinesis",
                    operation=operation,
                    details={'stream_name': self.stream_name}
                )
    
    @retry_with_backoff(max_retries=3, initial_delay=1.0)
    def start(self, dry_run: Optional[bool] = None) -> ServiceResult:
        """
        Restore Kinesis stream to operational shard count.
        
        Args:
            dry_run: Override instance dry_run setting if provided
            
        Returns:
            ServiceResult with operation outcome
        """
        is_dry_run = self._is_dry_run(dry_run)
        operation = "start"
        
        with OperationLogger(self.logger, operation, stream=self.stream_name, dry_run=is_dry_run):
            try:
                # Get current stream configuration
                stream_info = self._describe_stream()
                current_shard_count = stream_info['shard_count']
                stream_status = stream_info['status']
                
                self.logger.info(
                    f"Current stream state: {current_shard_count} shards, status: {stream_status}"
                )
                
                # Determine target shard count from saved config or use default
                target_shard_count = self.DEFAULT_SHARD_COUNT
                
                # Check if stream is already at target capacity
                if current_shard_count >= target_shard_count:
                    self.logger.info(
                        f"Stream already at target shard count ({current_shard_count}), no action needed"
                    )
                    return ServiceResult(
                        success=True,
                        operation=operation,
                        service_type="kinesis",
                        resources_affected=[self.stream_name],
                        warnings=[f"Stream already at target shard count: {current_shard_count}"],
                        details={
                            'stream_name': self.stream_name,
                            'shard_count': current_shard_count,
                            'action': 'none'
                        }
                    )
                
                if is_dry_run:
                    self._log_dry_run(
                        operation,
                        f"Would increase {self.stream_name} from {current_shard_count} to "
                        f"{target_shard_count} shards"
                    )
                    return ServiceResult(
                        success=True,
                        operation=operation,
                        service_type="kinesis",
                        resources_affected=[self.stream_name],
                        details={
                            'stream_name': self.stream_name,
                            'current_shard_count': current_shard_count,
                            'target_shard_count': target_shard_count,
                            'dry_run': True
                        }
                    )
                
                # Update shard count
                self.logger.info(
                    f"Increasing stream from {current_shard_count} to {target_shard_count} shards"
                )
                
                self.kinesis_client.update_shard_count(
                    StreamName=self.stream_name,
                    TargetShardCount=target_shard_count,
                    ScalingType='UNIFORM_SCALING'
                )
                
                self.logger.info(f"Successfully initiated shard count increase")
                
                return ServiceResult(
                    success=True,
                    operation=operation,
                    service_type="kinesis",
                    resources_affected=[self.stream_name],
                    details={
                        'stream_name': self.stream_name,
                        'previous_shard_count': current_shard_count,
                        'new_shard_count': target_shard_count
                    }
                )
                
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', 'Unknown')
                error_msg = e.response.get('Error', {}).get('Message', str(e))
                
                self.logger.error(f"Failed to start Kinesis stream: {error_msg}")
                
                raise AWSServiceError(
                    f"Failed to increase shard count: {error_msg}",
                    service="kinesis",
                    operation=operation,
                    error_code=error_code,
                    details={'stream_name': self.stream_name}
                )
            except Exception as e:
                self.logger.error(f"Unexpected error starting Kinesis stream: {e}")
                raise AWSServiceError(
                    f"Unexpected error: {e}",
                    service="kinesis",
                    operation=operation,
                    details={'stream_name': self.stream_name}
                )
    
    def get_status(self) -> ServiceStatus:
        """
        Get current status of Kinesis stream.
        
        Returns:
            ServiceStatus with current state information
        """
        with OperationLogger(self.logger, "get_status", stream=self.stream_name):
            try:
                stream_info = self._describe_stream()
                
                # Determine overall status
                if stream_info['status'] == 'ACTIVE':
                    if stream_info['shard_count'] <= self.MINIMAL_SHARD_COUNT:
                        status = ResourceStatus.STOPPED
                    else:
                        status = ResourceStatus.RUNNING
                elif stream_info['status'] == 'UPDATING':
                    status = ResourceStatus.STARTING  # or STOPPING, but we'll use STARTING
                else:
                    status = ResourceStatus.UNKNOWN
                
                # Calculate estimated cost
                estimated_cost = self.estimate_cost()
                
                return ServiceStatus(
                    service_type="kinesis",
                    status=status,
                    resources=[{
                        'name': self.stream_name,
                        'shard_count': stream_info['shard_count'],
                        'status': stream_info['status'],
                        'retention_hours': stream_info['retention_hours'],
                        'stream_mode': stream_info.get('stream_mode', 'PROVISIONED')
                    }],
                    total_resources=1,
                    running_resources=1 if status == ResourceStatus.RUNNING else 0,
                    stopped_resources=1 if status == ResourceStatus.STOPPED else 0,
                    estimated_hourly_cost=estimated_cost,
                    details={
                        'stream_name': self.stream_name,
                        'shard_count': stream_info['shard_count'],
                        'stream_status': stream_info['status']
                    }
                )
                
            except Exception as e:
                self.logger.error(f"Failed to get Kinesis status: {e}")
                raise AWSServiceError(
                    f"Failed to get stream status: {e}",
                    service="kinesis",
                    operation="get_status",
                    details={'stream_name': self.stream_name}
                )
    
    def estimate_cost(self) -> float:
        """
        Estimate hourly cost for current Kinesis configuration.
        
        Returns:
            Estimated hourly cost in USD
        """
        try:
            stream_info = self._describe_stream()
            shard_count = stream_info['shard_count']
            
            # Calculate shard hour cost
            hourly_cost = shard_count * self.SHARD_HOUR_COST
            
            # Note: PUT payload costs are usage-based and not included in idle cost
            # We only calculate the fixed shard hour cost
            
            self.logger.debug(
                f"Estimated Kinesis cost: ${hourly_cost:.4f}/hour "
                f"({shard_count} shards × ${self.SHARD_HOUR_COST}/hour)"
            )
            
            return hourly_cost
            
        except Exception as e:
            self.logger.warning(f"Failed to estimate Kinesis cost: {e}")
            return 0.0
    
    def save_configuration(self) -> Dict[str, Any]:
        """
        Save current Kinesis stream configuration.
        
        Returns:
            Dictionary containing stream configuration
        """
        with OperationLogger(self.logger, "save_configuration", stream=self.stream_name):
            try:
                stream_info = self._describe_stream()
                
                config = {
                    'stream_name': self.stream_name,
                    'shard_count': stream_info['shard_count'],
                    'retention_hours': stream_info['retention_hours'],
                    'stream_mode': stream_info.get('stream_mode', 'PROVISIONED'),
                    'encryption_type': stream_info.get('encryption_type', 'NONE'),
                    'key_id': stream_info.get('key_id')
                }
                
                self.logger.info(f"Saved configuration for stream: {self.stream_name}")
                return config
                
            except Exception as e:
                self.logger.error(f"Failed to save Kinesis configuration: {e}")
                raise AWSServiceError(
                    f"Failed to save stream configuration: {e}",
                    service="kinesis",
                    operation="save_configuration",
                    details={'stream_name': self.stream_name}
                )
    
    def restore_configuration(self, config: Dict[str, Any]) -> bool:
        """
        Restore Kinesis stream from saved configuration.
        
        Args:
            config: Configuration dictionary from save_configuration()
            
        Returns:
            True if restoration was successful
        """
        with OperationLogger(self.logger, "restore_configuration", stream=self.stream_name):
            try:
                # Validate configuration
                self._validate_configuration(config, ['stream_name', 'shard_count'])
                
                target_shard_count = config['shard_count']
                current_info = self._describe_stream()
                current_shard_count = current_info['shard_count']
                
                if current_shard_count == target_shard_count:
                    self.logger.info(
                        f"Stream already at target shard count: {target_shard_count}"
                    )
                    return True
                
                # Update shard count to match saved configuration
                self.logger.info(
                    f"Restoring stream from {current_shard_count} to {target_shard_count} shards"
                )
                
                self.kinesis_client.update_shard_count(
                    StreamName=self.stream_name,
                    TargetShardCount=target_shard_count,
                    ScalingType='UNIFORM_SCALING'
                )
                
                self.logger.info(f"Successfully restored stream configuration")
                return True
                
            except ValidationError:
                raise
            except Exception as e:
                self.logger.error(f"Failed to restore Kinesis configuration: {e}")
                raise AWSServiceError(
                    f"Failed to restore stream configuration: {e}",
                    service="kinesis",
                    operation="restore_configuration",
                    details={'stream_name': self.stream_name, 'config': config}
                )
    
    @retry_with_backoff(max_retries=3, initial_delay=1.0)
    def _describe_stream(self) -> Dict[str, Any]:
        """
        Get detailed information about the Kinesis stream.
        
        Returns:
            Dictionary with stream information
        """
        try:
            response = self.kinesis_client.describe_stream(
                StreamName=self.stream_name
            )
            
            stream_desc = response['StreamDescription']
            
            return {
                'stream_name': stream_desc['StreamName'],
                'status': stream_desc['StreamStatus'],
                'shard_count': len(stream_desc['Shards']),
                'retention_hours': stream_desc['RetentionPeriodHours'],
                'stream_mode': stream_desc.get('StreamModeDetails', {}).get('StreamMode', 'PROVISIONED'),
                'encryption_type': stream_desc.get('EncryptionType', 'NONE'),
                'key_id': stream_desc.get('KeyId'),
                'stream_arn': stream_desc['StreamARN']
            }
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            
            if error_code == 'ResourceNotFoundException':
                raise AWSServiceError(
                    f"Kinesis stream not found: {self.stream_name}",
                    service="kinesis",
                    operation="describe_stream",
                    error_code=error_code,
                    details={'stream_name': self.stream_name}
                )
            
            raise AWSServiceError(
                f"Failed to describe stream: {e}",
                service="kinesis",
                operation="describe_stream",
                error_code=error_code,
                details={'stream_name': self.stream_name}
            )
