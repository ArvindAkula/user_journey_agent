"""
Resource controller orchestration for AWS cost management.

This module coordinates all service managers to provide unified control
over AWS resource lifecycle for cost optimization.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any, Optional, List
from enum import Enum

try:
    from .service_manager import ServiceResult, ServiceStatus, ResourceStatus
    from .kinesis_manager import KinesisManager
    from .lambda_manager import LambdaManager
    from .cloudwatch_manager import CloudWatchManager
    from .state_manager import StateManager
    from .cost_calculator import CostCalculator
    from .exceptions import AWSServiceError, StateError, ValidationError
    from .logging_config import get_logger, OperationLogger
except ImportError:
    from service_manager import ServiceResult, ServiceStatus, ResourceStatus
    from kinesis_manager import KinesisManager
    from lambda_manager import LambdaManager
    from cloudwatch_manager import CloudWatchManager
    from state_manager import StateManager
    from cost_calculator import CostCalculator
    from exceptions import AWSServiceError, StateError, ValidationError
    from logging_config import get_logger, OperationLogger

logger = get_logger(__name__)


class OperationType(Enum):
    """Types of operations supported by the controller."""
    STOP = "stop"
    START = "start"
    STATUS = "status"


@dataclass
class OperationResult:
    """Result of a controller operation (stop_all, start_all, etc.)."""
    success: bool
    operation: str
    timestamp: str
    resources_affected: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    cost_impact: float = 0.0
    duration_seconds: float = 0.0
    service_results: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            'success': self.success,
            'operation': self.operation,
            'timestamp': self.timestamp,
            'resources_affected': self.resources_affected,
            'errors': self.errors,
            'warnings': self.warnings,
            'cost_impact': round(self.cost_impact, 4),
            'duration_seconds': round(self.duration_seconds, 2),
            'service_results': self.service_results
        }


@dataclass
class ResourceStatusReport:
    """Complete status report for all managed resources."""
    timestamp: str
    overall_status: str
    total_resources: int
    running_resources: int
    stopped_resources: int
    estimated_hourly_cost: float
    estimated_daily_cost: float
    estimated_monthly_cost: float
    service_status: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            'timestamp': self.timestamp,
            'overall_status': self.overall_status,
            'total_resources': self.total_resources,
            'running_resources': self.running_resources,
            'stopped_resources': self.stopped_resources,
            'estimated_costs': {
                'hourly': round(self.estimated_hourly_cost, 4),
                'daily': round(self.estimated_daily_cost, 2),
                'monthly': round(self.estimated_monthly_cost, 2)
            },
            'service_status': self.service_status,
            'recommendations': self.recommendations
        }


class ResourceController:
    """
    Main controller that orchestrates all AWS service managers.
    
    Coordinates stop, start, and status operations across:
    - Kinesis Data Streams
    - Lambda functions
    - CloudWatch alarms
    
    Handles state persistence, error recovery, and cost estimation.
    """
    
    def __init__(
        self,
        project_name: str = "user-journey-analytics",
        environment: str = "prod",
        region: str = "us-east-1",
        state_file: str = "config/aws-resource-state.json",
        s3_bucket: Optional[str] = None,
        dry_run: bool = False
    ):
        """
        Initialize resource controller.
        
        Args:
            project_name: Project name for resource filtering
            environment: Environment name (dev, staging, prod)
            region: AWS region
            state_file: Path to state file for configuration persistence
            s3_bucket: Optional S3 bucket for state backups
            dry_run: If True, simulate operations without making changes
        """
        self.project_name = project_name
        self.environment = environment
        self.region = region
        self.dry_run = dry_run
        
        # Initialize service managers
        self.kinesis_manager = KinesisManager(
            project_name=project_name,
            environment=environment,
            region=region,
            dry_run=dry_run
        )
        
        self.lambda_manager = LambdaManager(
            project_name=project_name,
            environment=environment,
            region=region,
            dry_run=dry_run
        )
        
        self.cloudwatch_manager = CloudWatchManager(
            project_name=project_name,
            environment=environment,
            region=region,
            dry_run=dry_run
        )
        
        # Initialize state manager
        self.state_manager = StateManager(
            state_file=state_file,
            s3_bucket=s3_bucket,
            project_name=project_name,
            environment=environment
        )
        
        # Initialize cost calculator
        self.cost_calculator = CostCalculator(region=region)
        
        logger.info(
            f"ResourceController initialized: project={project_name}, "
            f"env={environment}, region={region}, dry_run={dry_run}"
        )
    
    def stop_all_resources(self, dry_run: Optional[bool] = None) -> OperationResult:
        """
        Stop all managed AWS resources to minimize costs.
        
        Operation order:
        1. Save current resource state
        2. Stop Lambda functions (set concurrency to 0)
        3. Reduce Kinesis stream shards
        4. Disable CloudWatch alarms
        
        Args:
            dry_run: Override instance dry_run setting if provided
            
        Returns:
            OperationResult with operation outcome and cost savings
        """
        is_dry_run = dry_run if dry_run is not None else self.dry_run
        operation = OperationType.STOP.value
        start_time = datetime.utcnow()
        
        with OperationLogger(logger, operation, dry_run=is_dry_run):
            resources_affected = []
            errors = []
            warnings = []
            service_results = {}
            
            try:
                # Step 1: Save current state (unless dry run)
                if not is_dry_run:
                    logger.info("Saving current resource state before stopping")
                    try:
                        self.save_state()
                        logger.info("Resource state saved successfully")
                    except Exception as e:
                        error_msg = f"Failed to save state: {e}"
                        logger.error(error_msg)
                        errors.append(error_msg)
                        # Continue with stop operation even if state save fails
                else:
                    logger.info("[DRY RUN] Would save current resource state")
                
                # Step 2: Stop Lambda functions
                logger.info("Stopping Lambda functions")
                try:
                    lambda_result = self.lambda_manager.stop(dry_run=is_dry_run)
                    service_results['lambda'] = lambda_result.to_dict()
                    resources_affected.extend(lambda_result.resources_affected)
                    errors.extend(lambda_result.errors)
                    warnings.extend(lambda_result.warnings)
                    
                    if lambda_result.success:
                        logger.info(f"Lambda stop completed: {len(lambda_result.resources_affected)} functions")
                    else:
                        logger.warning(f"Lambda stop had errors: {len(lambda_result.errors)}")
                        
                except Exception as e:
                    error_msg = f"Lambda stop failed: {e}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    service_results['lambda'] = {'success': False, 'error': str(e)}
                
                # Step 3: Reduce Kinesis stream shards
                logger.info("Reducing Kinesis stream capacity")
                try:
                    kinesis_result = self.kinesis_manager.stop(dry_run=is_dry_run)
                    service_results['kinesis'] = kinesis_result.to_dict()
                    resources_affected.extend(kinesis_result.resources_affected)
                    errors.extend(kinesis_result.errors)
                    warnings.extend(kinesis_result.warnings)
                    
                    if kinesis_result.success:
                        logger.info(f"Kinesis stop completed: {len(kinesis_result.resources_affected)} streams")
                    else:
                        logger.warning(f"Kinesis stop had errors: {len(kinesis_result.errors)}")
                        
                except Exception as e:
                    error_msg = f"Kinesis stop failed: {e}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    service_results['kinesis'] = {'success': False, 'error': str(e)}
                
                # Step 4: Disable CloudWatch alarms
                logger.info("Disabling CloudWatch alarms")
                try:
                    cloudwatch_result = self.cloudwatch_manager.stop(dry_run=is_dry_run)
                    service_results['cloudwatch'] = cloudwatch_result.to_dict()
                    resources_affected.extend(cloudwatch_result.resources_affected)
                    errors.extend(cloudwatch_result.errors)
                    warnings.extend(cloudwatch_result.warnings)
                    
                    if cloudwatch_result.success:
                        logger.info(f"CloudWatch stop completed: {len(cloudwatch_result.resources_affected)} alarms")
                    else:
                        logger.warning(f"CloudWatch stop had errors: {len(cloudwatch_result.errors)}")
                        
                except Exception as e:
                    error_msg = f"CloudWatch stop failed: {e}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    service_results['cloudwatch'] = {'success': False, 'error': str(e)}
                
                # Calculate cost impact
                cost_impact = self._calculate_cost_savings()
                
                # Calculate duration
                end_time = datetime.utcnow()
                duration = (end_time - start_time).total_seconds()
                
                # Determine overall success
                success = len(errors) == 0 and len(resources_affected) > 0
                
                result = OperationResult(
                    success=success,
                    operation=operation,
                    timestamp=start_time.isoformat() + "Z",
                    resources_affected=resources_affected,
                    errors=errors,
                    warnings=warnings,
                    cost_impact=cost_impact,
                    duration_seconds=duration,
                    service_results=service_results
                )
                
                if success:
                    logger.info(
                        f"Stop operation completed successfully: "
                        f"{len(resources_affected)} resources affected, "
                        f"estimated savings: ${cost_impact:.2f}/day"
                    )
                else:
                    logger.warning(
                        f"Stop operation completed with errors: "
                        f"{len(errors)} errors, {len(resources_affected)} resources affected"
                    )
                
                return result
                
            except Exception as e:
                logger.error(f"Stop operation failed: {e}")
                end_time = datetime.utcnow()
                duration = (end_time - start_time).total_seconds()
                
                return OperationResult(
                    success=False,
                    operation=operation,
                    timestamp=start_time.isoformat() + "Z",
                    resources_affected=resources_affected,
                    errors=errors + [f"Operation failed: {e}"],
                    warnings=warnings,
                    duration_seconds=duration,
                    service_results=service_results
                )

    def start_all_resources(self, dry_run: Optional[bool] = None) -> OperationResult:
        """
        Start all managed AWS resources from stopped state.
        
        Operation order:
        1. Load saved resource state
        2. Enable CloudWatch alarms
        3. Restore Kinesis stream shards
        4. Start Lambda functions (remove concurrency limits)
        5. Verify resources are operational
        
        Args:
            dry_run: Override instance dry_run setting if provided
            
        Returns:
            OperationResult with operation outcome
        """
        is_dry_run = dry_run if dry_run is not None else self.dry_run
        operation = OperationType.START.value
        start_time = datetime.utcnow()
        
        with OperationLogger(logger, operation, dry_run=is_dry_run):
            resources_affected = []
            errors = []
            warnings = []
            service_results = {}
            
            try:
                # Step 1: Load saved state
                if not is_dry_run:
                    logger.info("Loading saved resource state")
                    try:
                        if not self.state_manager.state_exists():
                            warning_msg = "No saved state found, using default configurations"
                            logger.warning(warning_msg)
                            warnings.append(warning_msg)
                        else:
                            state = self.state_manager.load_state()
                            logger.info(f"Resource state loaded: {len(state.resources)} resource types")
                    except Exception as e:
                        error_msg = f"Failed to load state: {e}"
                        logger.error(error_msg)
                        warnings.append(error_msg)
                        # Continue with start operation using defaults
                else:
                    logger.info("[DRY RUN] Would load saved resource state")
                
                # Step 2: Enable CloudWatch alarms
                logger.info("Enabling CloudWatch alarms")
                try:
                    cloudwatch_result = self.cloudwatch_manager.start(dry_run=is_dry_run)
                    service_results['cloudwatch'] = cloudwatch_result.to_dict()
                    resources_affected.extend(cloudwatch_result.resources_affected)
                    errors.extend(cloudwatch_result.errors)
                    warnings.extend(cloudwatch_result.warnings)
                    
                    if cloudwatch_result.success:
                        logger.info(f"CloudWatch start completed: {len(cloudwatch_result.resources_affected)} alarms")
                    else:
                        logger.warning(f"CloudWatch start had errors: {len(cloudwatch_result.errors)}")
                        
                except Exception as e:
                    error_msg = f"CloudWatch start failed: {e}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    service_results['cloudwatch'] = {'success': False, 'error': str(e)}
                
                # Step 3: Restore Kinesis stream shards
                logger.info("Restoring Kinesis stream capacity")
                try:
                    kinesis_result = self.kinesis_manager.start(dry_run=is_dry_run)
                    service_results['kinesis'] = kinesis_result.to_dict()
                    resources_affected.extend(kinesis_result.resources_affected)
                    errors.extend(kinesis_result.errors)
                    warnings.extend(kinesis_result.warnings)
                    
                    if kinesis_result.success:
                        logger.info(f"Kinesis start completed: {len(kinesis_result.resources_affected)} streams")
                    else:
                        logger.warning(f"Kinesis start had errors: {len(kinesis_result.errors)}")
                        
                except Exception as e:
                    error_msg = f"Kinesis start failed: {e}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    service_results['kinesis'] = {'success': False, 'error': str(e)}
                
                # Step 4: Start Lambda functions
                logger.info("Starting Lambda functions")
                try:
                    lambda_result = self.lambda_manager.start(dry_run=is_dry_run)
                    service_results['lambda'] = lambda_result.to_dict()
                    resources_affected.extend(lambda_result.resources_affected)
                    errors.extend(lambda_result.errors)
                    warnings.extend(lambda_result.warnings)
                    
                    if lambda_result.success:
                        logger.info(f"Lambda start completed: {len(lambda_result.resources_affected)} functions")
                    else:
                        logger.warning(f"Lambda start had errors: {len(lambda_result.errors)}")
                        
                except Exception as e:
                    error_msg = f"Lambda start failed: {e}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    service_results['lambda'] = {'success': False, 'error': str(e)}
                
                # Step 5: Verify resources are operational (unless dry run)
                if not is_dry_run:
                    logger.info("Verifying resources are operational")
                    try:
                        verification_warnings = self._verify_resources_operational()
                        warnings.extend(verification_warnings)
                    except Exception as e:
                        warning_msg = f"Resource verification failed: {e}"
                        logger.warning(warning_msg)
                        warnings.append(warning_msg)
                else:
                    logger.info("[DRY RUN] Would verify resources are operational")
                
                # Calculate duration
                end_time = datetime.utcnow()
                duration = (end_time - start_time).total_seconds()
                
                # Determine overall success
                success = len(errors) == 0 and len(resources_affected) > 0
                
                result = OperationResult(
                    success=success,
                    operation=operation,
                    timestamp=start_time.isoformat() + "Z",
                    resources_affected=resources_affected,
                    errors=errors,
                    warnings=warnings,
                    duration_seconds=duration,
                    service_results=service_results
                )
                
                if success:
                    logger.info(
                        f"Start operation completed successfully: "
                        f"{len(resources_affected)} resources affected"
                    )
                else:
                    logger.warning(
                        f"Start operation completed with errors: "
                        f"{len(errors)} errors, {len(resources_affected)} resources affected"
                    )
                
                return result
                
            except Exception as e:
                logger.error(f"Start operation failed: {e}")
                end_time = datetime.utcnow()
                duration = (end_time - start_time).total_seconds()
                
                return OperationResult(
                    success=False,
                    operation=operation,
                    timestamp=start_time.isoformat() + "Z",
                    resources_affected=resources_affected,
                    errors=errors + [f"Operation failed: {e}"],
                    warnings=warnings,
                    duration_seconds=duration,
                    service_results=service_results
                )
    
    def get_resource_status(self) -> ResourceStatusReport:
        """
        Get current status of all managed resources.
        
        Queries status from all service managers and generates a comprehensive
        status report including cost estimates and recommendations.
        
        Returns:
            ResourceStatusReport with complete status information
        """
        with OperationLogger(logger, "get_resource_status"):
            try:
                timestamp = datetime.utcnow().isoformat() + "Z"
                service_status = {}
                total_resources = 0
                running_resources = 0
                stopped_resources = 0
                total_hourly_cost = 0.0
                
                # Get Lambda status
                try:
                    lambda_status = self.lambda_manager.get_status()
                    service_status['lambda'] = lambda_status.to_dict()
                    total_resources += lambda_status.total_resources
                    running_resources += lambda_status.running_resources
                    stopped_resources += lambda_status.stopped_resources
                    total_hourly_cost += lambda_status.estimated_hourly_cost
                    logger.debug(f"Lambda status: {lambda_status.total_resources} functions")
                except Exception as e:
                    logger.error(f"Failed to get Lambda status: {e}")
                    service_status['lambda'] = {'error': str(e)}
                
                # Get Kinesis status
                try:
                    kinesis_status = self.kinesis_manager.get_status()
                    service_status['kinesis'] = kinesis_status.to_dict()
                    total_resources += kinesis_status.total_resources
                    running_resources += kinesis_status.running_resources
                    stopped_resources += kinesis_status.stopped_resources
                    total_hourly_cost += kinesis_status.estimated_hourly_cost
                    logger.debug(f"Kinesis status: {kinesis_status.total_resources} streams")
                except Exception as e:
                    logger.error(f"Failed to get Kinesis status: {e}")
                    service_status['kinesis'] = {'error': str(e)}
                
                # Get CloudWatch status
                try:
                    cloudwatch_status = self.cloudwatch_manager.get_status()
                    service_status['cloudwatch'] = cloudwatch_status.to_dict()
                    total_resources += cloudwatch_status.total_resources
                    running_resources += cloudwatch_status.running_resources
                    stopped_resources += cloudwatch_status.stopped_resources
                    total_hourly_cost += cloudwatch_status.estimated_hourly_cost
                    logger.debug(f"CloudWatch status: {cloudwatch_status.total_resources} alarms")
                except Exception as e:
                    logger.error(f"Failed to get CloudWatch status: {e}")
                    service_status['cloudwatch'] = {'error': str(e)}
                
                # Calculate daily and monthly costs
                daily_cost = total_hourly_cost * 24
                monthly_cost = daily_cost * 30
                
                # Determine overall status
                if stopped_resources == total_resources and total_resources > 0:
                    overall_status = ResourceStatus.STOPPED.value
                elif running_resources > 0:
                    overall_status = ResourceStatus.RUNNING.value
                else:
                    overall_status = ResourceStatus.UNKNOWN.value
                
                # Generate recommendations
                recommendations = self._generate_recommendations(
                    service_status,
                    total_hourly_cost,
                    running_resources,
                    stopped_resources
                )
                
                report = ResourceStatusReport(
                    timestamp=timestamp,
                    overall_status=overall_status,
                    total_resources=total_resources,
                    running_resources=running_resources,
                    stopped_resources=stopped_resources,
                    estimated_hourly_cost=total_hourly_cost,
                    estimated_daily_cost=daily_cost,
                    estimated_monthly_cost=monthly_cost,
                    service_status=service_status,
                    recommendations=recommendations
                )
                
                logger.info(
                    f"Status report generated: {total_resources} resources, "
                    f"${monthly_cost:.2f}/month estimated cost"
                )
                
                return report
                
            except Exception as e:
                logger.error(f"Failed to generate status report: {e}")
                raise AWSServiceError(
                    f"Failed to get resource status: {e}",
                    service="controller",
                    operation="get_resource_status"
                )
    
    def save_state(self) -> bool:
        """
        Save current resource configurations to state file.
        
        Returns:
            True if save was successful
        """
        with OperationLogger(logger, "save_state"):
            try:
                resources = {}
                
                # Save Lambda configurations
                try:
                    lambda_config = self.lambda_manager.save_configuration()
                    resources['lambda_functions'] = lambda_config.get('functions', [])
                    logger.debug(f"Saved {len(resources['lambda_functions'])} Lambda configurations")
                except Exception as e:
                    logger.warning(f"Failed to save Lambda configuration: {e}")
                    resources['lambda_functions'] = []
                
                # Save Kinesis configurations
                try:
                    kinesis_config = self.kinesis_manager.save_configuration()
                    resources['kinesis_streams'] = [kinesis_config]
                    logger.debug("Saved Kinesis configuration")
                except Exception as e:
                    logger.warning(f"Failed to save Kinesis configuration: {e}")
                    resources['kinesis_streams'] = []
                
                # Save CloudWatch configurations
                try:
                    cloudwatch_config = self.cloudwatch_manager.save_configuration()
                    resources['cloudwatch_alarms'] = cloudwatch_config.get('alarms', [])
                    logger.debug(f"Saved {len(resources['cloudwatch_alarms'])} CloudWatch configurations")
                except Exception as e:
                    logger.warning(f"Failed to save CloudWatch configuration: {e}")
                    resources['cloudwatch_alarms'] = []
                
                # Save to state manager
                metadata = {
                    'saved_by': 'ResourceController',
                    'operation': 'save_state'
                }
                
                self.state_manager.save_state(resources, metadata)
                logger.info("Resource state saved successfully")
                
                return True
                
            except Exception as e:
                logger.error(f"Failed to save resource state: {e}")
                raise StateError(
                    f"Failed to save state: {e}",
                    details={'error': str(e)}
                )
    
    def restore_state(self) -> bool:
        """
        Restore resources from saved state file.
        
        Returns:
            True if restoration was successful
        """
        with OperationLogger(logger, "restore_state"):
            try:
                # Load state
                state = self.state_manager.load_state()
                logger.info(f"Loaded state from {state.timestamp}")
                
                success = True
                
                # Restore Lambda configurations
                if 'lambda_functions' in state.resources:
                    try:
                        lambda_config = {'functions': state.resources['lambda_functions']}
                        self.lambda_manager.restore_configuration(lambda_config)
                        logger.info("Lambda configurations restored")
                    except Exception as e:
                        logger.error(f"Failed to restore Lambda configuration: {e}")
                        success = False
                
                # Restore Kinesis configurations
                if 'kinesis_streams' in state.resources and state.resources['kinesis_streams']:
                    try:
                        kinesis_config = state.resources['kinesis_streams'][0]
                        self.kinesis_manager.restore_configuration(kinesis_config)
                        logger.info("Kinesis configuration restored")
                    except Exception as e:
                        logger.error(f"Failed to restore Kinesis configuration: {e}")
                        success = False
                
                # Restore CloudWatch configurations
                if 'cloudwatch_alarms' in state.resources:
                    try:
                        cloudwatch_config = {'alarms': state.resources['cloudwatch_alarms']}
                        self.cloudwatch_manager.restore_configuration(cloudwatch_config)
                        logger.info("CloudWatch configurations restored")
                    except Exception as e:
                        logger.error(f"Failed to restore CloudWatch configuration: {e}")
                        success = False
                
                if success:
                    logger.info("Resource state restored successfully")
                else:
                    logger.warning("Resource state restored with some errors")
                
                return success
                
            except Exception as e:
                logger.error(f"Failed to restore resource state: {e}")
                raise StateError(
                    f"Failed to restore state: {e}",
                    details={'error': str(e)}
                )
    
    def _calculate_cost_savings(self) -> float:
        """
        Calculate estimated daily cost savings from stop operation.
        
        Returns:
            Estimated daily savings in USD
        """
        try:
            # Estimate savings from Kinesis shard reduction (2 shards to 1)
            kinesis_savings = 1 * 0.015 * 24  # 1 shard * $0.015/hour * 24 hours
            
            # Lambda has no idle cost, so no savings
            lambda_savings = 0.0
            
            # CloudWatch alarms still cost when disabled, minimal savings
            cloudwatch_savings = 0.0
            
            total_savings = kinesis_savings + lambda_savings + cloudwatch_savings
            
            logger.debug(f"Estimated daily savings: ${total_savings:.2f}")
            return total_savings
            
        except Exception as e:
            logger.warning(f"Failed to calculate cost savings: {e}")
            return 0.0
    
    def _verify_resources_operational(self) -> List[str]:
        """
        Verify that all resources are operational after start operation.
        
        Returns:
            List of warning messages for any issues found
        """
        warnings = []
        
        try:
            # Check Lambda functions
            lambda_status = self.lambda_manager.get_status()
            if lambda_status.stopped_resources > 0:
                warnings.append(
                    f"{lambda_status.stopped_resources} Lambda functions still have concurrency limits"
                )
            
            # Check Kinesis streams
            kinesis_status = self.kinesis_manager.get_status()
            if kinesis_status.status == ResourceStatus.STOPPED:
                warnings.append("Kinesis stream is still at minimal capacity")
            elif kinesis_status.status == ResourceStatus.STARTING:
                warnings.append("Kinesis stream is still updating (may take a few minutes)")
            
            # Check CloudWatch alarms
            cloudwatch_status = self.cloudwatch_manager.get_status()
            if cloudwatch_status.stopped_resources > 0:
                warnings.append(
                    f"{cloudwatch_status.stopped_resources} CloudWatch alarms are still disabled"
                )
            
            if not warnings:
                logger.info("All resources verified as operational")
            else:
                logger.warning(f"Resource verification found {len(warnings)} issues")
            
            return warnings
            
        except Exception as e:
            logger.error(f"Resource verification failed: {e}")
            return [f"Verification failed: {e}"]
    
    def _generate_recommendations(
        self,
        service_status: Dict[str, Dict[str, Any]],
        hourly_cost: float,
        running_resources: int,
        stopped_resources: int
    ) -> List[str]:
        """
        Generate cost optimization recommendations based on current status.
        
        Args:
            service_status: Status information for all services
            hourly_cost: Current estimated hourly cost
            running_resources: Number of running resources
            stopped_resources: Number of stopped resources
            
        Returns:
            List of recommendation strings
        """
        recommendations = []
        
        try:
            # Check if resources are running but could be stopped
            if running_resources > 0 and hourly_cost > 0:
                daily_cost = hourly_cost * 24
                monthly_cost = daily_cost * 30
                
                if monthly_cost > 10:
                    recommendations.append(
                        f"Resources are running with estimated cost of ${monthly_cost:.2f}/month. "
                        "Consider stopping resources when not in use to reduce costs."
                    )
            
            # Check if all resources are stopped
            if stopped_resources > 0 and running_resources == 0:
                recommendations.append(
                    "All resources are stopped. Run 'start' command to restore functionality."
                )
            
            # Check Kinesis status
            if 'kinesis' in service_status and 'resources' in service_status['kinesis']:
                kinesis_resources = service_status['kinesis']['resources']
                if kinesis_resources:
                    shard_count = kinesis_resources[0].get('shard_count', 0)
                    if shard_count == 1:
                        recommendations.append(
                            "Kinesis stream is at minimal capacity (1 shard). "
                            "Increase to 2 shards for production workloads."
                        )
            
            # Check Lambda status
            if 'lambda' in service_status and 'resources' in service_status['lambda']:
                lambda_resources = service_status['lambda']['resources']
                stopped_lambdas = [r for r in lambda_resources if r.get('reserved_concurrency') == 0]
                if stopped_lambdas:
                    recommendations.append(
                        f"{len(stopped_lambdas)} Lambda functions have concurrency set to 0 "
                        "and cannot process events. Remove limits to enable processing."
                    )
            
            # Check CloudWatch alarms
            if 'cloudwatch' in service_status and 'resources' in service_status['cloudwatch']:
                cloudwatch_resources = service_status['cloudwatch']['resources']
                disabled_alarms = [r for r in cloudwatch_resources if not r.get('actions_enabled')]
                if disabled_alarms:
                    recommendations.append(
                        f"{len(disabled_alarms)} CloudWatch alarms are disabled. "
                        "Enable alarms to receive notifications for issues."
                    )
            
            # General recommendation if no specific issues
            if not recommendations:
                recommendations.append(
                    "All resources are in optimal state. Monitor costs regularly."
                )
            
            logger.debug(f"Generated {len(recommendations)} recommendations")
            return recommendations
            
        except Exception as e:
            logger.warning(f"Failed to generate recommendations: {e}")
            return ["Unable to generate recommendations due to an error"]
