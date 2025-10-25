"""
CloudWatch service manager for AWS resource management.

Manages CloudWatch alarms by disabling them when not in use to minimize costs
and re-enabling them when needed.
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


class CloudWatchManager(ServiceManager):
    """
    Manages CloudWatch alarms lifecycle and action states.
    
    Cost optimization strategy:
    - Stop: Disable alarm actions for all alarms (saves ~$0.03/day)
    - Start: Re-enable alarm actions for all alarms
    
    AWS Pricing (us-east-1):
    - Standard alarm: $0.10 per alarm per month (~$0.0033/day)
    - High-resolution alarm: $0.30 per alarm per month (~$0.01/day)
    - Note: Alarms still incur cost when disabled, but we prevent unnecessary SNS notifications
    """
    
    # AWS CloudWatch pricing constants (us-east-1)
    STANDARD_ALARM_MONTHLY_COST = 0.10  # USD per alarm per month
    HIGH_RES_ALARM_MONTHLY_COST = 0.30  # USD per alarm per month
    
    # Expected number of alarms (from design document)
    EXPECTED_ALARM_COUNT = 9
    
    def __init__(
        self,
        project_name: str = "user-journey-analytics",
        environment: str = "prod",
        region: str = "us-east-1",
        dry_run: bool = False
    ):
        """
        Initialize CloudWatch manager.
        
        Args:
            project_name: Project name for resource filtering
            environment: Environment name (dev, staging, prod)
            region: AWS region
            dry_run: If True, simulate operations without making changes
        """
        super().__init__(project_name, environment, region, dry_run)
        
        if not BOTO3_AVAILABLE:
            raise ImportError("boto3 is required for CloudWatchManager")
        
        self.cloudwatch_client = boto3.client('cloudwatch', region_name=region)
        
        # Build alarm name prefix for filtering
        self.alarm_prefix = f"{project_name}-"
        if environment != "prod":
            self.alarm_suffix = f"-{environment}"
        else:
            self.alarm_suffix = "-prod"
        
        self.logger.info(
            f"CloudWatchManager initialized for alarms matching: {self.alarm_prefix}*{self.alarm_suffix}"
        )
    
    @retry_with_backoff(max_retries=3, initial_delay=1.0)
    def stop(self, dry_run: Optional[bool] = None) -> ServiceResult:
        """
        Disable actions for all managed CloudWatch alarms.
        
        Args:
            dry_run: Override instance dry_run setting if provided
            
        Returns:
            ServiceResult with operation outcome
        """
        is_dry_run = self._is_dry_run(dry_run)
        operation = "stop"
        
        with OperationLogger(self.logger, operation, dry_run=is_dry_run):
            try:
                # Get all project alarms
                alarms = self._list_project_alarms()
                
                if not alarms:
                    self.logger.warning("No CloudWatch alarms found for this project")
                    return ServiceResult(
                        success=True,
                        operation=operation,
                        service_type="cloudwatch",
                        warnings=["No alarms found"],
                        details={'alarm_count': 0}
                    )
                
                # Filter alarms that have actions enabled
                alarms_to_disable = [
                    alarm for alarm in alarms
                    if alarm.get('ActionsEnabled', False)
                ]
                
                if not alarms_to_disable:
                    self.logger.info("All alarms already have actions disabled")
                    return ServiceResult(
                        success=True,
                        operation=operation,
                        service_type="cloudwatch",
                        resources_affected=[a['AlarmName'] for a in alarms],
                        warnings=["All alarms already disabled"],
                        details={
                            'total_alarms': len(alarms),
                            'already_disabled': len(alarms)
                        }
                    )
                
                alarm_names = [alarm['AlarmName'] for alarm in alarms_to_disable]
                
                if is_dry_run:
                    self._log_dry_run(
                        operation,
                        f"Would disable actions for {len(alarm_names)} alarms"
                    )
                    return ServiceResult(
                        success=True,
                        operation=operation,
                        service_type="cloudwatch",
                        resources_affected=alarm_names,
                        details={
                            'total_alarms': len(alarms),
                            'alarms_to_disable': len(alarm_names),
                            'dry_run': True
                        }
                    )
                
                # Disable alarm actions
                self.logger.info(f"Disabling actions for {len(alarm_names)} alarms")
                
                self.cloudwatch_client.disable_alarm_actions(
                    AlarmNames=alarm_names
                )
                
                self.logger.info(f"Successfully disabled {len(alarm_names)} alarms")
                
                return ServiceResult(
                    success=True,
                    operation=operation,
                    service_type="cloudwatch",
                    resources_affected=alarm_names,
                    details={
                        'total_alarms': len(alarms),
                        'disabled_alarms': len(alarm_names)
                    }
                )
                
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', 'Unknown')
                error_msg = e.response.get('Error', {}).get('Message', str(e))
                
                self.logger.error(f"Failed to disable CloudWatch alarms: {error_msg}")
                
                raise AWSServiceError(
                    f"Failed to disable alarms: {error_msg}",
                    service="cloudwatch",
                    operation=operation,
                    error_code=error_code
                )
            except Exception as e:
                self.logger.error(f"Unexpected error disabling CloudWatch alarms: {e}")
                raise AWSServiceError(
                    f"Unexpected error: {e}",
                    service="cloudwatch",
                    operation=operation
                )
    
    @retry_with_backoff(max_retries=3, initial_delay=1.0)
    def start(self, dry_run: Optional[bool] = None) -> ServiceResult:
        """
        Enable actions for all managed CloudWatch alarms.
        
        Args:
            dry_run: Override instance dry_run setting if provided
            
        Returns:
            ServiceResult with operation outcome
        """
        is_dry_run = self._is_dry_run(dry_run)
        operation = "start"
        
        with OperationLogger(self.logger, operation, dry_run=is_dry_run):
            try:
                # Get all project alarms
                alarms = self._list_project_alarms()
                
                if not alarms:
                    self.logger.warning("No CloudWatch alarms found for this project")
                    return ServiceResult(
                        success=True,
                        operation=operation,
                        service_type="cloudwatch",
                        warnings=["No alarms found"],
                        details={'alarm_count': 0}
                    )
                
                # Filter alarms that have actions disabled
                alarms_to_enable = [
                    alarm for alarm in alarms
                    if not alarm.get('ActionsEnabled', True)
                ]
                
                if not alarms_to_enable:
                    self.logger.info("All alarms already have actions enabled")
                    return ServiceResult(
                        success=True,
                        operation=operation,
                        service_type="cloudwatch",
                        resources_affected=[a['AlarmName'] for a in alarms],
                        warnings=["All alarms already enabled"],
                        details={
                            'total_alarms': len(alarms),
                            'already_enabled': len(alarms)
                        }
                    )
                
                alarm_names = [alarm['AlarmName'] for alarm in alarms_to_enable]
                
                if is_dry_run:
                    self._log_dry_run(
                        operation,
                        f"Would enable actions for {len(alarm_names)} alarms"
                    )
                    return ServiceResult(
                        success=True,
                        operation=operation,
                        service_type="cloudwatch",
                        resources_affected=alarm_names,
                        details={
                            'total_alarms': len(alarms),
                            'alarms_to_enable': len(alarm_names),
                            'dry_run': True
                        }
                    )
                
                # Enable alarm actions
                self.logger.info(f"Enabling actions for {len(alarm_names)} alarms")
                
                self.cloudwatch_client.enable_alarm_actions(
                    AlarmNames=alarm_names
                )
                
                self.logger.info(f"Successfully enabled {len(alarm_names)} alarms")
                
                return ServiceResult(
                    success=True,
                    operation=operation,
                    service_type="cloudwatch",
                    resources_affected=alarm_names,
                    details={
                        'total_alarms': len(alarms),
                        'enabled_alarms': len(alarm_names)
                    }
                )
                
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', 'Unknown')
                error_msg = e.response.get('Error', {}).get('Message', str(e))
                
                self.logger.error(f"Failed to enable CloudWatch alarms: {error_msg}")
                
                raise AWSServiceError(
                    f"Failed to enable alarms: {error_msg}",
                    service="cloudwatch",
                    operation=operation,
                    error_code=error_code
                )
            except Exception as e:
                self.logger.error(f"Unexpected error enabling CloudWatch alarms: {e}")
                raise AWSServiceError(
                    f"Unexpected error: {e}",
                    service="cloudwatch",
                    operation=operation
                )
    
    def get_status(self) -> ServiceStatus:
        """
        Get current status of all managed CloudWatch alarms.
        
        Returns:
            ServiceStatus with current state information
        """
        with OperationLogger(self.logger, "get_status"):
            try:
                alarms = self._list_project_alarms()
                
                if not alarms:
                    return ServiceStatus(
                        service_type="cloudwatch",
                        status=ResourceStatus.UNKNOWN,
                        resources=[],
                        total_resources=0,
                        running_resources=0,
                        stopped_resources=0,
                        estimated_hourly_cost=0.0,
                        details={'note': 'No alarms found'}
                    )
                
                # Process alarm information
                resources = []
                enabled_count = 0
                disabled_count = 0
                
                for alarm in alarms:
                    actions_enabled = alarm.get('ActionsEnabled', False)
                    
                    if actions_enabled:
                        enabled_count += 1
                        status = 'ENABLED'
                    else:
                        disabled_count += 1
                        status = 'DISABLED'
                    
                    resources.append({
                        'name': alarm['AlarmName'],
                        'status': status,
                        'actions_enabled': actions_enabled,
                        'state': alarm.get('StateValue', 'UNKNOWN'),
                        'metric_name': alarm.get('MetricName'),
                        'namespace': alarm.get('Namespace')
                    })
                
                # Determine overall status
                if disabled_count == len(alarms):
                    overall_status = ResourceStatus.STOPPED
                elif enabled_count > 0:
                    overall_status = ResourceStatus.RUNNING
                else:
                    overall_status = ResourceStatus.UNKNOWN
                
                # Calculate estimated cost
                estimated_cost = self.estimate_cost()
                
                return ServiceStatus(
                    service_type="cloudwatch",
                    status=overall_status,
                    resources=resources,
                    total_resources=len(alarms),
                    running_resources=enabled_count,
                    stopped_resources=disabled_count,
                    estimated_hourly_cost=estimated_cost,
                    details={
                        'note': 'Alarms incur cost even when disabled; disabling prevents SNS notifications'
                    }
                )
                
            except Exception as e:
                self.logger.error(f"Failed to get CloudWatch status: {e}")
                raise AWSServiceError(
                    f"Failed to get alarm status: {e}",
                    service="cloudwatch",
                    operation="get_status"
                )
    
    def estimate_cost(self) -> float:
        """
        Estimate hourly cost for CloudWatch alarms.
        
        Note: Alarms incur cost even when disabled. This estimates the cost
        based on the number of alarms.
        
        Returns:
            Estimated hourly cost in USD
        """
        try:
            alarms = self._list_project_alarms()
            alarm_count = len(alarms)
            
            # Assume all are standard alarms (not high-resolution)
            # Convert monthly cost to hourly: monthly / 30 days / 24 hours
            monthly_cost = alarm_count * self.STANDARD_ALARM_MONTHLY_COST
            hourly_cost = monthly_cost / 30 / 24
            
            self.logger.debug(
                f"Estimated CloudWatch cost: ${hourly_cost:.6f}/hour "
                f"({alarm_count} alarms × ${self.STANDARD_ALARM_MONTHLY_COST}/month)"
            )
            
            return hourly_cost
            
        except Exception as e:
            self.logger.warning(f"Failed to estimate CloudWatch cost: {e}")
            return 0.0
    
    def save_configuration(self) -> Dict[str, Any]:
        """
        Save current CloudWatch alarm configurations.
        
        Returns:
            Dictionary containing alarm configurations
        """
        with OperationLogger(self.logger, "save_configuration"):
            try:
                alarms = self._list_project_alarms()
                
                configurations = []
                for alarm in alarms:
                    config = {
                        'alarm_name': alarm['AlarmName'],
                        'actions_enabled': alarm.get('ActionsEnabled', False),
                        'alarm_actions': alarm.get('AlarmActions', []),
                        'ok_actions': alarm.get('OKActions', []),
                        'insufficient_data_actions': alarm.get('InsufficientDataActions', []),
                        'metric_name': alarm.get('MetricName'),
                        'namespace': alarm.get('Namespace'),
                        'statistic': alarm.get('Statistic'),
                        'period': alarm.get('Period'),
                        'evaluation_periods': alarm.get('EvaluationPeriods'),
                        'threshold': alarm.get('Threshold'),
                        'comparison_operator': alarm.get('ComparisonOperator')
                    }
                    configurations.append(config)
                
                self.logger.info(f"Saved configurations for {len(configurations)} alarms")
                return {'alarms': configurations}
                
            except Exception as e:
                self.logger.error(f"Failed to save CloudWatch configurations: {e}")
                raise AWSServiceError(
                    f"Failed to save alarm configurations: {e}",
                    service="cloudwatch",
                    operation="save_configuration"
                )
    
    def restore_configuration(self, config: Dict[str, Any]) -> bool:
        """
        Restore CloudWatch alarms from saved configuration.
        
        Args:
            config: Configuration dictionary from save_configuration()
            
        Returns:
            True if restoration was successful
        """
        with OperationLogger(self.logger, "restore_configuration"):
            try:
                # Validate configuration
                self._validate_configuration(config, ['alarms'])
                
                alarms = config['alarms']
                restored_count = 0
                
                # Get current alarm states
                current_alarms = self._list_project_alarms()
                current_alarm_map = {
                    alarm['AlarmName']: alarm
                    for alarm in current_alarms
                }
                
                # Separate alarms to enable and disable
                alarms_to_enable = []
                alarms_to_disable = []
                
                for alarm_config in alarms:
                    alarm_name = alarm_config['alarm_name']
                    target_enabled = alarm_config.get('actions_enabled', True)
                    
                    if alarm_name not in current_alarm_map:
                        self.logger.warning(f"Alarm not found: {alarm_name}")
                        continue
                    
                    current_enabled = current_alarm_map[alarm_name].get('ActionsEnabled', False)
                    
                    if current_enabled != target_enabled:
                        if target_enabled:
                            alarms_to_enable.append(alarm_name)
                        else:
                            alarms_to_disable.append(alarm_name)
                
                # Enable alarms
                if alarms_to_enable:
                    self.logger.info(f"Enabling {len(alarms_to_enable)} alarms")
                    self.cloudwatch_client.enable_alarm_actions(
                        AlarmNames=alarms_to_enable
                    )
                    restored_count += len(alarms_to_enable)
                
                # Disable alarms
                if alarms_to_disable:
                    self.logger.info(f"Disabling {len(alarms_to_disable)} alarms")
                    self.cloudwatch_client.disable_alarm_actions(
                        AlarmNames=alarms_to_disable
                    )
                    restored_count += len(alarms_to_disable)
                
                if restored_count == 0:
                    self.logger.info("All alarms already at target state")
                else:
                    self.logger.info(f"Restored configurations for {restored_count} alarms")
                
                return True
                
            except ValidationError:
                raise
            except Exception as e:
                self.logger.error(f"Failed to restore CloudWatch configurations: {e}")
                raise AWSServiceError(
                    f"Failed to restore configurations: {e}",
                    service="cloudwatch",
                    operation="restore_configuration",
                    details={'config': config}
                )
    
    @retry_with_backoff(max_retries=3, initial_delay=1.0)
    def _list_project_alarms(self) -> List[Dict[str, Any]]:
        """
        List all CloudWatch alarms for this project.
        
        Returns:
            List of alarm descriptions
        """
        try:
            alarms = []
            next_token = None
            
            while True:
                params = {}
                if next_token:
                    params['NextToken'] = next_token
                
                response = self.cloudwatch_client.describe_alarms(**params)
                
                # Filter alarms by project prefix
                for alarm in response.get('MetricAlarms', []):
                    alarm_name = alarm['AlarmName']
                    if alarm_name.startswith(self.alarm_prefix):
                        alarms.append(alarm)
                
                next_token = response.get('NextToken')
                if not next_token:
                    break
            
            self.logger.debug(f"Found {len(alarms)} alarms for project")
            return alarms
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            raise AWSServiceError(
                f"Failed to list alarms: {e}",
                service="cloudwatch",
                operation="describe_alarms",
                error_code=error_code
            )
