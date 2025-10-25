"""
Lambda service manager for AWS resource management.

Manages Lambda functions by setting concurrency limits to prevent invocations
when not in use and restore normal operation when needed.
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


class LambdaManager(ServiceManager):
    """
    Manages Lambda functions lifecycle and concurrency settings.
    
    Cost optimization strategy:
    - Stop: Set reserved concurrency to 0 (prevents all invocations)
    - Start: Remove concurrency limits (restore normal operation)
    
    AWS Pricing (us-east-1):
    - Request: $0.20 per 1M requests
    - Duration: $0.0000166667 per GB-second
    - Note: Lambda has no idle cost - only charged when invoked
    """
    
    # AWS Lambda pricing constants (us-east-1)
    REQUEST_COST_PER_MILLION = 0.20  # USD per 1M requests
    DURATION_COST_PER_GB_SECOND = 0.0000166667  # USD per GB-second
    
    # Target Lambda functions for cost management
    TARGET_FUNCTIONS = [
        "event_processor",
        "intervention-executor"
    ]
    
    def __init__(
        self,
        project_name: str = "user-journey-analytics",
        environment: str = "prod",
        region: str = "us-east-1",
        dry_run: bool = False
    ):
        """
        Initialize Lambda manager.
        
        Args:
            project_name: Project name for resource filtering
            environment: Environment name (dev, staging, prod)
            region: AWS region
            dry_run: If True, simulate operations without making changes
        """
        super().__init__(project_name, environment, region, dry_run)
        
        if not BOTO3_AVAILABLE:
            raise ImportError("boto3 is required for LambdaManager")
        
        self.lambda_client = boto3.client('lambda', region_name=region)
        
        # Build function names - try both with and without project prefix
        # Some functions may not have the project prefix
        self.function_names = []
        for func in self.TARGET_FUNCTIONS:
            # Try with project prefix first
            func_with_prefix = f"{project_name}-{func}"
            if environment != "prod":
                func_with_prefix += f"-{environment}"
            
            # Check if function exists with prefix
            try:
                self.lambda_client.get_function_configuration(FunctionName=func_with_prefix)
                self.function_names.append(func_with_prefix)
                self.logger.debug(f"Found function with prefix: {func_with_prefix}")
            except ClientError as e:
                if e.response.get('Error', {}).get('Code') == 'ResourceNotFoundException':
                    # Try without prefix
                    try:
                        self.lambda_client.get_function_configuration(FunctionName=func)
                        self.function_names.append(func)
                        self.logger.debug(f"Found function without prefix: {func}")
                    except ClientError:
                        self.logger.warning(f"Function not found: {func} (tried with and without prefix)")
                else:
                    self.logger.warning(f"Error checking function {func_with_prefix}: {e}")
        
        self.logger.info(
            f"LambdaManager initialized for functions: {', '.join(self.function_names)}"
        )
    
    @retry_with_backoff(max_retries=3, initial_delay=1.0)
    def stop(self, dry_run: Optional[bool] = None) -> ServiceResult:
        """
        Set reserved concurrency to 0 for all managed Lambda functions.
        This prevents any invocations and ensures zero cost.
        
        Args:
            dry_run: Override instance dry_run setting if provided
            
        Returns:
            ServiceResult with operation outcome
        """
        is_dry_run = self._is_dry_run(dry_run)
        operation = "stop"
        
        with OperationLogger(self.logger, operation, functions=len(self.function_names), dry_run=is_dry_run):
            resources_affected = []
            errors = []
            warnings = []
            
            for function_name in self.function_names:
                try:
                    # Get current function configuration
                    func_config = self._get_function_config(function_name)
                    
                    if func_config is None:
                        warnings.append(f"Function not found: {function_name}")
                        self.logger.warning(f"Function not found: {function_name}")
                        continue
                    
                    current_concurrency = func_config.get('reserved_concurrent_executions')
                    
                    # Check if already stopped
                    if current_concurrency == 0:
                        self.logger.info(
                            f"Function {function_name} already has concurrency set to 0"
                        )
                        warnings.append(f"{function_name}: already stopped")
                        resources_affected.append(function_name)
                        continue
                    
                    if is_dry_run:
                        self._log_dry_run(
                            operation,
                            f"Would set reserved concurrency to 0 for {function_name}"
                        )
                        resources_affected.append(function_name)
                        continue
                    
                    # Set reserved concurrency to 0
                    self.logger.info(f"Setting reserved concurrency to 0 for {function_name}")
                    
                    self.lambda_client.put_function_concurrency(
                        FunctionName=function_name,
                        ReservedConcurrentExecutions=0
                    )
                    
                    self.logger.info(f"Successfully stopped function: {function_name}")
                    resources_affected.append(function_name)
                    
                except ClientError as e:
                    error_code = e.response.get('Error', {}).get('Code', 'Unknown')
                    error_msg = e.response.get('Error', {}).get('Message', str(e))
                    
                    error_text = f"{function_name}: {error_msg}"
                    errors.append(error_text)
                    self.logger.error(f"Failed to stop function {function_name}: {error_msg}")
                    
                except Exception as e:
                    error_text = f"{function_name}: {str(e)}"
                    errors.append(error_text)
                    self.logger.error(f"Unexpected error stopping function {function_name}: {e}")
            
            # Determine overall success
            success = len(errors) == 0 and len(resources_affected) > 0
            
            return ServiceResult(
                success=success,
                operation=operation,
                service_type="lambda",
                resources_affected=resources_affected,
                errors=errors,
                warnings=warnings,
                details={
                    'total_functions': len(self.function_names),
                    'stopped_functions': len(resources_affected),
                    'failed_functions': len(errors),
                    'dry_run': is_dry_run
                }
            )
    
    @retry_with_backoff(max_retries=3, initial_delay=1.0)
    def start(self, dry_run: Optional[bool] = None) -> ServiceResult:
        """
        Remove concurrency limits from all managed Lambda functions.
        This restores normal operation.
        
        Args:
            dry_run: Override instance dry_run setting if provided
            
        Returns:
            ServiceResult with operation outcome
        """
        is_dry_run = self._is_dry_run(dry_run)
        operation = "start"
        
        with OperationLogger(self.logger, operation, functions=len(self.function_names), dry_run=is_dry_run):
            resources_affected = []
            errors = []
            warnings = []
            
            for function_name in self.function_names:
                try:
                    # Get current function configuration
                    func_config = self._get_function_config(function_name)
                    
                    if func_config is None:
                        warnings.append(f"Function not found: {function_name}")
                        self.logger.warning(f"Function not found: {function_name}")
                        continue
                    
                    current_concurrency = func_config.get('reserved_concurrent_executions')
                    
                    # Check if already started (no concurrency limit)
                    if current_concurrency is None:
                        self.logger.info(
                            f"Function {function_name} already has no concurrency limit"
                        )
                        warnings.append(f"{function_name}: already started")
                        resources_affected.append(function_name)
                        continue
                    
                    if is_dry_run:
                        self._log_dry_run(
                            operation,
                            f"Would remove concurrency limit for {function_name}"
                        )
                        resources_affected.append(function_name)
                        continue
                    
                    # Remove concurrency limit
                    self.logger.info(f"Removing concurrency limit for {function_name}")
                    
                    self.lambda_client.delete_function_concurrency(
                        FunctionName=function_name
                    )
                    
                    self.logger.info(f"Successfully started function: {function_name}")
                    resources_affected.append(function_name)
                    
                except ClientError as e:
                    error_code = e.response.get('Error', {}).get('Code', 'Unknown')
                    error_msg = e.response.get('Error', {}).get('Message', str(e))
                    
                    # ResourceNotFoundException when trying to delete non-existent concurrency is OK
                    if error_code == 'ResourceNotFoundException':
                        self.logger.info(
                            f"Function {function_name} already has no concurrency limit"
                        )
                        warnings.append(f"{function_name}: already started")
                        resources_affected.append(function_name)
                        continue
                    
                    error_text = f"{function_name}: {error_msg}"
                    errors.append(error_text)
                    self.logger.error(f"Failed to start function {function_name}: {error_msg}")
                    
                except Exception as e:
                    error_text = f"{function_name}: {str(e)}"
                    errors.append(error_text)
                    self.logger.error(f"Unexpected error starting function {function_name}: {e}")
            
            # Determine overall success
            success = len(errors) == 0 and len(resources_affected) > 0
            
            return ServiceResult(
                success=success,
                operation=operation,
                service_type="lambda",
                resources_affected=resources_affected,
                errors=errors,
                warnings=warnings,
                details={
                    'total_functions': len(self.function_names),
                    'started_functions': len(resources_affected),
                    'failed_functions': len(errors),
                    'dry_run': is_dry_run
                }
            )
    
    def get_status(self) -> ServiceStatus:
        """
        Get current status of all managed Lambda functions.
        
        Returns:
            ServiceStatus with current state information
        """
        with OperationLogger(self.logger, "get_status", functions=len(self.function_names)):
            resources = []
            running_count = 0
            stopped_count = 0
            
            for function_name in self.function_names:
                try:
                    func_config = self._get_function_config(function_name)
                    
                    if func_config is None:
                        resources.append({
                            'name': function_name,
                            'status': 'NOT_FOUND',
                            'reserved_concurrency': None
                        })
                        continue
                    
                    concurrency = func_config.get('reserved_concurrent_executions')
                    
                    # Determine status based on concurrency setting
                    if concurrency == 0:
                        status = 'STOPPED'
                        stopped_count += 1
                    elif concurrency is None:
                        status = 'RUNNING'
                        running_count += 1
                    else:
                        status = 'RUNNING'  # Has a limit but not 0
                        running_count += 1
                    
                    resources.append({
                        'name': function_name,
                        'status': status,
                        'reserved_concurrency': concurrency,
                        'memory_mb': func_config.get('memory_size'),
                        'timeout_seconds': func_config.get('timeout'),
                        'runtime': func_config.get('runtime')
                    })
                    
                except Exception as e:
                    self.logger.warning(f"Failed to get status for {function_name}: {e}")
                    resources.append({
                        'name': function_name,
                        'status': 'ERROR',
                        'error': str(e)
                    })
            
            # Determine overall status
            if stopped_count == len(self.function_names):
                overall_status = ResourceStatus.STOPPED
            elif running_count > 0:
                overall_status = ResourceStatus.RUNNING
            else:
                overall_status = ResourceStatus.UNKNOWN
            
            # Calculate estimated cost (Lambda has no idle cost)
            estimated_cost = self.estimate_cost()
            
            return ServiceStatus(
                service_type="lambda",
                status=overall_status,
                resources=resources,
                total_resources=len(self.function_names),
                running_resources=running_count,
                stopped_resources=stopped_count,
                estimated_hourly_cost=estimated_cost,
                details={
                    'note': 'Lambda has no idle cost - only charged when invoked'
                }
            )
    
    def estimate_cost(self) -> float:
        """
        Estimate hourly cost for Lambda functions.
        
        Note: Lambda has no idle cost. Cost is only incurred when functions
        are invoked. This method returns 0.0 for idle cost estimation.
        
        Returns:
            Estimated hourly cost in USD (always 0.0 for idle state)
        """
        # Lambda has no idle cost - only charged per invocation and duration
        # When functions are stopped (concurrency = 0), cost is guaranteed to be 0
        # When functions are running but not invoked, cost is also 0
        
        self.logger.debug("Lambda idle cost: $0.00/hour (no idle charges)")
        return 0.0
    
    def save_configuration(self) -> Dict[str, Any]:
        """
        Save current Lambda function configurations.
        
        Returns:
            Dictionary containing function configurations
        """
        with OperationLogger(self.logger, "save_configuration", functions=len(self.function_names)):
            configurations = []
            
            for function_name in self.function_names:
                try:
                    func_config = self._get_function_config(function_name)
                    
                    if func_config is None:
                        self.logger.warning(f"Function not found: {function_name}")
                        continue
                    
                    config = {
                        'function_name': function_name,
                        'reserved_concurrent_executions': func_config.get('reserved_concurrent_executions'),
                        'memory_size': func_config.get('memory_size'),
                        'timeout': func_config.get('timeout'),
                        'runtime': func_config.get('runtime'),
                        'handler': func_config.get('handler'),
                        'environment': func_config.get('environment', {})
                    }
                    
                    configurations.append(config)
                    self.logger.debug(f"Saved configuration for: {function_name}")
                    
                except Exception as e:
                    self.logger.error(f"Failed to save config for {function_name}: {e}")
            
            self.logger.info(f"Saved configurations for {len(configurations)} functions")
            return {'functions': configurations}
    
    def restore_configuration(self, config: Dict[str, Any]) -> bool:
        """
        Restore Lambda functions from saved configuration.
        
        Args:
            config: Configuration dictionary from save_configuration()
            
        Returns:
            True if restoration was successful
        """
        with OperationLogger(self.logger, "restore_configuration"):
            try:
                # Validate configuration
                self._validate_configuration(config, ['functions'])
                
                functions = config['functions']
                restored_count = 0
                
                for func_config in functions:
                    function_name = func_config['function_name']
                    target_concurrency = func_config.get('reserved_concurrent_executions')
                    
                    try:
                        current_config = self._get_function_config(function_name)
                        
                        if current_config is None:
                            self.logger.warning(f"Function not found: {function_name}")
                            continue
                        
                        current_concurrency = current_config.get('reserved_concurrent_executions')
                        
                        # Restore concurrency setting if different
                        if current_concurrency != target_concurrency:
                            if target_concurrency is None:
                                # Remove concurrency limit
                                self.logger.info(
                                    f"Removing concurrency limit for {function_name}"
                                )
                                try:
                                    self.lambda_client.delete_function_concurrency(
                                        FunctionName=function_name
                                    )
                                except ClientError as e:
                                    if e.response.get('Error', {}).get('Code') != 'ResourceNotFoundException':
                                        raise
                            else:
                                # Set specific concurrency limit
                                self.logger.info(
                                    f"Setting concurrency to {target_concurrency} for {function_name}"
                                )
                                self.lambda_client.put_function_concurrency(
                                    FunctionName=function_name,
                                    ReservedConcurrentExecutions=target_concurrency
                                )
                            
                            restored_count += 1
                        else:
                            self.logger.debug(
                                f"Function {function_name} already at target concurrency"
                            )
                        
                    except Exception as e:
                        self.logger.error(
                            f"Failed to restore configuration for {function_name}: {e}"
                        )
                
                self.logger.info(f"Restored configurations for {restored_count} functions")
                return True
                
            except ValidationError:
                raise
            except Exception as e:
                self.logger.error(f"Failed to restore Lambda configurations: {e}")
                raise AWSServiceError(
                    f"Failed to restore configurations: {e}",
                    service="lambda",
                    operation="restore_configuration",
                    details={'config': config}
                )
    
    @retry_with_backoff(max_retries=3, initial_delay=1.0)
    def _get_function_config(self, function_name: str) -> Optional[Dict[str, Any]]:
        """
        Get Lambda function configuration.
        
        Args:
            function_name: Name of the Lambda function
            
        Returns:
            Dictionary with function configuration or None if not found
        """
        try:
            response = self.lambda_client.get_function_configuration(
                FunctionName=function_name
            )
            
            return {
                'function_name': response['FunctionName'],
                'function_arn': response['FunctionArn'],
                'runtime': response['Runtime'],
                'handler': response['Handler'],
                'memory_size': response['MemorySize'],
                'timeout': response['Timeout'],
                'reserved_concurrent_executions': response.get('ReservedConcurrentExecutions'),
                'environment': response.get('Environment', {}),
                'last_modified': response['LastModified']
            }
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            
            if error_code == 'ResourceNotFoundException':
                self.logger.debug(f"Function not found: {function_name}")
                return None
            
            raise AWSServiceError(
                f"Failed to get function configuration: {e}",
                service="lambda",
                operation="get_function_configuration",
                error_code=error_code,
                details={'function_name': function_name}
            )
