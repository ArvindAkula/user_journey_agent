"""
Dry-run mode implementation for AWS Cost Management System.

Provides simulation capabilities to preview changes without executing them,
including cost impact analysis and error detection.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from enum import Enum

try:
    from .cost_calculator import CostCalculator, ServiceCost, CostEstimate, CostComparison
    from .logging_config import get_logger
    from .exceptions import ValidationError, DependencyError
except ImportError:
    from cost_calculator import CostCalculator, ServiceCost, CostEstimate, CostComparison
    from logging_config import get_logger
    from exceptions import ValidationError, DependencyError

logger = get_logger(__name__)


class ChangeType(Enum):
    """Type of change to be made."""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    ENABLE = "enable"
    DISABLE = "disable"
    SCALE_UP = "scale_up"
    SCALE_DOWN = "scale_down"


class RiskLevel(Enum):
    """Risk level of a change."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class ResourceChange:
    """Represents a change that would be made to a resource."""
    resource_id: str
    resource_type: str
    change_type: ChangeType
    current_state: Dict[str, Any]
    proposed_state: Dict[str, Any]
    cost_impact: float  # Positive for savings, negative for costs
    risk_level: RiskLevel
    warnings: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'resource_id': self.resource_id,
            'resource_type': self.resource_type,
            'change_type': self.change_type.value,
            'current_state': self.current_state,
            'proposed_state': self.proposed_state,
            'cost_impact': round(self.cost_impact, 4),
            'risk_level': self.risk_level.value,
            'warnings': self.warnings,
            'dependencies': self.dependencies
        }


@dataclass
class DryRunResult:
    """Result of a dry-run operation."""
    operation: str  # 'stop' or 'start'
    timestamp: datetime
    changes: List[ResourceChange]
    total_cost_impact: float
    current_estimate: Optional[CostEstimate] = None
    proposed_estimate: Optional[CostEstimate] = None
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    @property
    def has_errors(self) -> bool:
        """Check if there are any errors."""
        return len(self.errors) > 0
    
    @property
    def has_warnings(self) -> bool:
        """Check if there are any warnings."""
        return len(self.warnings) > 0 or any(c.warnings for c in self.changes)
    
    @property
    def high_risk_changes(self) -> List[ResourceChange]:
        """Get all high or critical risk changes."""
        return [c for c in self.changes if c.risk_level in (RiskLevel.HIGH, RiskLevel.CRITICAL)]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'operation': self.operation,
            'timestamp': self.timestamp.isoformat(),
            'changes': [c.to_dict() for c in self.changes],
            'total_cost_impact': round(self.total_cost_impact, 2),
            'current_estimate': self.current_estimate.to_dict() if self.current_estimate else None,
            'proposed_estimate': self.proposed_estimate.to_dict() if self.proposed_estimate else None,
            'errors': self.errors,
            'warnings': self.warnings,
            'summary': {
                'total_changes': len(self.changes),
                'high_risk_changes': len(self.high_risk_changes),
                'has_errors': self.has_errors,
                'has_warnings': self.has_warnings
            }
        }


class DryRunValidator:
    """Validates operations and identifies potential errors before execution."""
    
    def __init__(self):
        """Initialize dry-run validator."""
        logger.debug("Dry-run validator initialized")
    
    def validate_stop_operation(
        self,
        resources: Dict[str, Any]
    ) -> Tuple[List[str], List[str]]:
        """
        Validate a stop operation.
        
        Args:
            resources: Dictionary of resources to stop
            
        Returns:
            Tuple of (errors, warnings)
        """
        errors = []
        warnings = []
        
        # Check if any resources exist
        if not resources:
            errors.append("No resources found to stop")
            return errors, warnings
        
        # Validate Kinesis streams
        if 'kinesis' in resources:
            kinesis_streams = resources['kinesis']
            if not kinesis_streams:
                warnings.append("No Kinesis streams found")
            else:
                for stream in kinesis_streams:
                    shard_count = stream.get('shard_count', 0)
                    if shard_count <= 1:
                        warnings.append(
                            f"Kinesis stream {stream.get('name')} already at minimum shard count"
                        )
        
        # Validate Lambda functions
        if 'lambda' in resources:
            lambda_functions = resources['lambda']
            if not lambda_functions:
                warnings.append("No Lambda functions found")
            else:
                for func in lambda_functions:
                    concurrency = func.get('reserved_concurrency', 0)
                    if concurrency == 0:
                        warnings.append(
                            f"Lambda function {func.get('name')} already has concurrency set to 0"
                        )
        
        # Validate SageMaker endpoints
        if 'sagemaker' in resources:
            sagemaker_endpoints = resources['sagemaker']
            if not sagemaker_endpoints:
                warnings.append("No SageMaker endpoints found")
            else:
                for endpoint in sagemaker_endpoints:
                    status = endpoint.get('status', '')
                    if status not in ('InService', 'Creating', 'Updating'):
                        warnings.append(
                            f"SageMaker endpoint {endpoint.get('name')} is in {status} state"
                        )
        
        # Validate CloudWatch alarms
        if 'cloudwatch' in resources:
            alarms = resources['cloudwatch']
            if not alarms:
                warnings.append("No CloudWatch alarms found")
            else:
                disabled_count = sum(1 for a in alarms if not a.get('enabled', True))
                if disabled_count == len(alarms):
                    warnings.append("All CloudWatch alarms are already disabled")
        
        logger.debug(f"Stop operation validation: {len(errors)} errors, {len(warnings)} warnings")
        return errors, warnings
    
    def validate_start_operation(
        self,
        state: Dict[str, Any],
        current_resources: Dict[str, Any]
    ) -> Tuple[List[str], List[str]]:
        """
        Validate a start operation.
        
        Args:
            state: Saved state to restore from
            current_resources: Current state of resources
            
        Returns:
            Tuple of (errors, warnings)
        """
        errors = []
        warnings = []
        
        # Check if state exists
        if not state:
            errors.append("No saved state found - cannot restore resources")
            return errors, warnings
        
        # Validate state version
        if 'version' not in state:
            warnings.append("State file missing version information")
        
        # Validate Kinesis streams
        if 'kinesis' in state:
            kinesis_state = state['kinesis']
            if kinesis_state:
                stream_name = kinesis_state.get('stream_name')
                if not stream_name:
                    errors.append("Kinesis stream name missing from state")
                else:
                    # Check if stream exists
                    current_kinesis = current_resources.get('kinesis', [])
                    stream_exists = any(s.get('name') == stream_name for s in current_kinesis)
                    if not stream_exists:
                        errors.append(f"Kinesis stream {stream_name} not found")
        
        # Validate Lambda functions
        if 'lambda' in state:
            lambda_state = state['lambda']
            if lambda_state:
                for func_state in lambda_state:
                    func_name = func_state.get('name')
                    if not func_name:
                        errors.append("Lambda function name missing from state")
                        continue
                    
                    # Check if function exists
                    current_lambda = current_resources.get('lambda', [])
                    func_exists = any(f.get('name') == func_name for f in current_lambda)
                    if not func_exists:
                        errors.append(f"Lambda function {func_name} not found")
        
        # Validate SageMaker endpoints
        if 'sagemaker' in state:
            sagemaker_state = state['sagemaker']
            if sagemaker_state:
                endpoint_config = sagemaker_state.get('endpoint_config')
                if not endpoint_config:
                    warnings.append("SageMaker endpoint config missing from state")
                else:
                    # Check if endpoint already exists
                    current_sagemaker = current_resources.get('sagemaker', [])
                    endpoint_name = sagemaker_state.get('endpoint_name')
                    if endpoint_name:
                        endpoint_exists = any(
                            e.get('name') == endpoint_name 
                            for e in current_sagemaker
                        )
                        if endpoint_exists:
                            warnings.append(
                                f"SageMaker endpoint {endpoint_name} already exists"
                            )
        
        logger.debug(f"Start operation validation: {len(errors)} errors, {len(warnings)} warnings")
        return errors, warnings
    
    def check_dependencies(
        self,
        resource_id: str,
        resource_type: str,
        all_resources: Dict[str, Any]
    ) -> List[str]:
        """
        Check for resource dependencies.
        
        Args:
            resource_id: Resource identifier
            resource_type: Type of resource
            all_resources: All resources in the system
            
        Returns:
            List of dependent resource IDs
        """
        dependencies = []
        
        # Lambda functions may depend on Kinesis streams
        if resource_type == 'kinesis':
            lambda_functions = all_resources.get('lambda', [])
            for func in lambda_functions:
                # Check if function has event source mapping to this stream
                if resource_id in func.get('event_sources', []):
                    dependencies.append(func.get('name'))
        
        # SageMaker endpoints depend on endpoint configs
        if resource_type == 'sagemaker_endpoint':
            # Endpoint config is a dependency
            dependencies.append(f"{resource_id}-config")
        
        return dependencies


class DryRunSimulator:
    """Simulates operations without executing them."""
    
    def __init__(self, cost_calculator: Optional[CostCalculator] = None):
        """
        Initialize dry-run simulator.
        
        Args:
            cost_calculator: Cost calculator instance (creates new if not provided)
        """
        self.cost_calculator = cost_calculator or CostCalculator()
        self.validator = DryRunValidator()
        logger.debug("Dry-run simulator initialized")
    
    def simulate_stop_operation(
        self,
        current_resources: Dict[str, Any]
    ) -> DryRunResult:
        """
        Simulate stopping all resources.
        
        Args:
            current_resources: Current state of all resources
            
        Returns:
            DryRunResult with simulated changes
        """
        logger.info("Simulating stop operation")
        
        changes = []
        errors = []
        warnings = []
        
        # Validate operation
        val_errors, val_warnings = self.validator.validate_stop_operation(current_resources)
        errors.extend(val_errors)
        warnings.extend(val_warnings)
        
        # Calculate current costs
        current_costs = self._calculate_current_costs(current_resources)
        
        # Simulate Kinesis changes
        if 'kinesis' in current_resources:
            for stream in current_resources['kinesis']:
                change = self._simulate_kinesis_stop(stream)
                if change:
                    changes.append(change)
        
        # Simulate Lambda changes
        if 'lambda' in current_resources:
            for func in current_resources['lambda']:
                change = self._simulate_lambda_stop(func)
                if change:
                    changes.append(change)
        
        # Simulate SageMaker changes
        if 'sagemaker' in current_resources:
            for endpoint in current_resources['sagemaker']:
                change = self._simulate_sagemaker_stop(endpoint)
                if change:
                    changes.append(change)
        
        # Simulate CloudWatch changes
        if 'cloudwatch' in current_resources:
            for alarm in current_resources['cloudwatch']:
                change = self._simulate_cloudwatch_stop(alarm)
                if change:
                    changes.append(change)
        
        # Calculate proposed costs (after stopping)
        proposed_resources = self._apply_stop_changes(current_resources)
        proposed_costs = self._calculate_current_costs(proposed_resources)
        
        # Calculate total cost impact
        total_cost_impact = current_costs.monthly_cost - proposed_costs.monthly_cost
        
        result = DryRunResult(
            operation='stop',
            timestamp=datetime.utcnow(),
            changes=changes,
            total_cost_impact=total_cost_impact,
            current_estimate=current_costs,
            proposed_estimate=proposed_costs,
            errors=errors,
            warnings=warnings
        )
        
        logger.info(
            f"Stop simulation complete: {len(changes)} changes, "
            f"${total_cost_impact:.2f}/month savings"
        )
        
        return result
    
    def simulate_start_operation(
        self,
        saved_state: Dict[str, Any],
        current_resources: Dict[str, Any]
    ) -> DryRunResult:
        """
        Simulate starting resources from saved state.
        
        Args:
            saved_state: Saved state to restore from
            current_resources: Current state of resources
            
        Returns:
            DryRunResult with simulated changes
        """
        logger.info("Simulating start operation")
        
        changes = []
        errors = []
        warnings = []
        
        # Validate operation
        val_errors, val_warnings = self.validator.validate_start_operation(
            saved_state, current_resources
        )
        errors.extend(val_errors)
        warnings.extend(val_warnings)
        
        # Calculate current costs
        current_costs = self._calculate_current_costs(current_resources)
        
        # Simulate Kinesis changes
        if 'kinesis' in saved_state:
            kinesis_state = saved_state['kinesis']
            if kinesis_state:
                current_kinesis = next(
                    (s for s in current_resources.get('kinesis', [])
                     if s.get('name') == kinesis_state.get('stream_name')),
                    None
                )
                if current_kinesis:
                    change = self._simulate_kinesis_start(current_kinesis, kinesis_state)
                    if change:
                        changes.append(change)
        
        # Simulate Lambda changes
        if 'lambda' in saved_state:
            for func_state in saved_state['lambda']:
                current_func = next(
                    (f for f in current_resources.get('lambda', [])
                     if f.get('name') == func_state.get('name')),
                    None
                )
                if current_func:
                    change = self._simulate_lambda_start(current_func, func_state)
                    if change:
                        changes.append(change)
        
        # Simulate SageMaker changes
        if 'sagemaker' in saved_state:
            sagemaker_state = saved_state['sagemaker']
            if sagemaker_state:
                change = self._simulate_sagemaker_start(sagemaker_state)
                if change:
                    changes.append(change)
        
        # Simulate CloudWatch changes
        if 'cloudwatch' in saved_state:
            cloudwatch_state = saved_state['cloudwatch']
            if cloudwatch_state:
                for alarm in current_resources.get('cloudwatch', []):
                    change = self._simulate_cloudwatch_start(alarm)
                    if change:
                        changes.append(change)
        
        # Calculate proposed costs (after starting)
        proposed_resources = self._apply_start_changes(current_resources, saved_state)
        proposed_costs = self._calculate_current_costs(proposed_resources)
        
        # Calculate total cost impact (negative because we're adding costs)
        total_cost_impact = current_costs.monthly_cost - proposed_costs.monthly_cost
        
        result = DryRunResult(
            operation='start',
            timestamp=datetime.utcnow(),
            changes=changes,
            total_cost_impact=total_cost_impact,
            current_estimate=current_costs,
            proposed_estimate=proposed_costs,
            errors=errors,
            warnings=warnings
        )
        
        logger.info(
            f"Start simulation complete: {len(changes)} changes, "
            f"${abs(total_cost_impact):.2f}/month cost increase"
        )
        
        return result
    
    def _simulate_kinesis_stop(self, stream: Dict[str, Any]) -> Optional[ResourceChange]:
        """Simulate stopping a Kinesis stream."""
        shard_count = stream.get('shard_count', 0)
        
        if shard_count <= 1:
            return None  # Already at minimum
        
        # Calculate cost impact
        current_cost = self.cost_calculator.calculate_kinesis_cost(shard_count)
        proposed_cost = self.cost_calculator.calculate_kinesis_cost(1)
        cost_impact = current_cost.monthly_cost - proposed_cost.monthly_cost
        
        warnings = []
        if shard_count > 2:
            warnings.append(
                f"Reducing from {shard_count} shards to 1 may impact throughput"
            )
        
        return ResourceChange(
            resource_id=stream.get('name', 'unknown'),
            resource_type='kinesis_stream',
            change_type=ChangeType.SCALE_DOWN,
            current_state={'shard_count': shard_count},
            proposed_state={'shard_count': 1},
            cost_impact=cost_impact,
            risk_level=RiskLevel.MEDIUM if shard_count > 2 else RiskLevel.LOW,
            warnings=warnings
        )
    
    def _simulate_lambda_stop(self, func: Dict[str, Any]) -> Optional[ResourceChange]:
        """Simulate stopping a Lambda function."""
        current_concurrency = func.get('reserved_concurrency', None)
        
        if current_concurrency == 0:
            return None  # Already stopped
        
        warnings = [
            "Function will not be able to process any requests",
            "Event source mappings will be paused"
        ]
        
        return ResourceChange(
            resource_id=func.get('name', 'unknown'),
            resource_type='lambda_function',
            change_type=ChangeType.DISABLE,
            current_state={'reserved_concurrency': current_concurrency or 'unlimited'},
            proposed_state={'reserved_concurrency': 0},
            cost_impact=0,  # Lambda has no idle cost
            risk_level=RiskLevel.HIGH,
            warnings=warnings
        )
    
    def _simulate_sagemaker_stop(self, endpoint: Dict[str, Any]) -> Optional[ResourceChange]:
        """Simulate stopping a SageMaker endpoint."""
        status = endpoint.get('status', '')
        
        if status not in ('InService', 'Creating', 'Updating'):
            return None  # Not running
        
        instance_type = endpoint.get('instance_type', 'ml.m5.large')
        instance_count = endpoint.get('instance_count', 1)
        
        # Calculate cost impact
        current_cost = self.cost_calculator.calculate_sagemaker_cost(
            1, instance_type, instance_count
        )
        cost_impact = current_cost.monthly_cost
        
        warnings = [
            "Endpoint will need to be recreated to use again (5-10 minutes)",
            "Inference requests will fail until endpoint is recreated"
        ]
        
        return ResourceChange(
            resource_id=endpoint.get('name', 'unknown'),
            resource_type='sagemaker_endpoint',
            change_type=ChangeType.DELETE,
            current_state={'status': status, 'instance_type': instance_type},
            proposed_state={'status': 'Deleted'},
            cost_impact=cost_impact,
            risk_level=RiskLevel.HIGH,
            warnings=warnings
        )
    
    def _simulate_cloudwatch_stop(self, alarm: Dict[str, Any]) -> Optional[ResourceChange]:
        """Simulate disabling a CloudWatch alarm."""
        enabled = alarm.get('enabled', True)
        
        if not enabled:
            return None  # Already disabled
        
        return ResourceChange(
            resource_id=alarm.get('name', 'unknown'),
            resource_type='cloudwatch_alarm',
            change_type=ChangeType.DISABLE,
            current_state={'enabled': True},
            proposed_state={'enabled': False},
            cost_impact=0.10 / 30,  # $0.10/month per alarm
            risk_level=RiskLevel.LOW,
            warnings=["Alarm notifications will not be sent"]
        )
    
    def _simulate_kinesis_start(
        self,
        current: Dict[str, Any],
        target: Dict[str, Any]
    ) -> Optional[ResourceChange]:
        """Simulate starting a Kinesis stream."""
        current_shards = current.get('shard_count', 1)
        target_shards = target.get('shard_count', 2)
        
        if current_shards >= target_shards:
            return None  # Already at target
        
        # Calculate cost impact
        current_cost = self.cost_calculator.calculate_kinesis_cost(current_shards)
        proposed_cost = self.cost_calculator.calculate_kinesis_cost(target_shards)
        cost_impact = current_cost.monthly_cost - proposed_cost.monthly_cost
        
        return ResourceChange(
            resource_id=current.get('name', 'unknown'),
            resource_type='kinesis_stream',
            change_type=ChangeType.SCALE_UP,
            current_state={'shard_count': current_shards},
            proposed_state={'shard_count': target_shards},
            cost_impact=cost_impact,
            risk_level=RiskLevel.LOW
        )
    
    def _simulate_lambda_start(
        self,
        current: Dict[str, Any],
        target: Dict[str, Any]
    ) -> Optional[ResourceChange]:
        """Simulate starting a Lambda function."""
        current_concurrency = current.get('reserved_concurrency', None)
        target_concurrency = target.get('reserved_concurrency', None)
        
        if current_concurrency != 0:
            return None  # Already started
        
        return ResourceChange(
            resource_id=current.get('name', 'unknown'),
            resource_type='lambda_function',
            change_type=ChangeType.ENABLE,
            current_state={'reserved_concurrency': 0},
            proposed_state={'reserved_concurrency': target_concurrency or 'unlimited'},
            cost_impact=0,  # Lambda has no idle cost
            risk_level=RiskLevel.LOW
        )
    
    def _simulate_sagemaker_start(
        self,
        target: Dict[str, Any]
    ) -> Optional[ResourceChange]:
        """Simulate starting a SageMaker endpoint."""
        endpoint_name = target.get('endpoint_name')
        endpoint_config = target.get('endpoint_config')
        
        if not endpoint_name or not endpoint_config:
            return None
        
        # Calculate cost impact
        proposed_cost = self.cost_calculator.calculate_sagemaker_cost(1)
        cost_impact = -proposed_cost.monthly_cost  # Negative because adding cost
        
        warnings = [
            "Endpoint creation will take 5-10 minutes",
            "Endpoint will incur charges immediately upon creation"
        ]
        
        return ResourceChange(
            resource_id=endpoint_name,
            resource_type='sagemaker_endpoint',
            change_type=ChangeType.CREATE,
            current_state={'status': 'NotFound'},
            proposed_state={'status': 'Creating', 'config': endpoint_config},
            cost_impact=cost_impact,
            risk_level=RiskLevel.MEDIUM,
            warnings=warnings
        )
    
    def _simulate_cloudwatch_start(self, alarm: Dict[str, Any]) -> Optional[ResourceChange]:
        """Simulate enabling a CloudWatch alarm."""
        enabled = alarm.get('enabled', True)
        
        if enabled:
            return None  # Already enabled
        
        return ResourceChange(
            resource_id=alarm.get('name', 'unknown'),
            resource_type='cloudwatch_alarm',
            change_type=ChangeType.ENABLE,
            current_state={'enabled': False},
            proposed_state={'enabled': True},
            cost_impact=-0.10 / 30,  # Negative because adding cost
            risk_level=RiskLevel.LOW
        )
    
    def _calculate_current_costs(self, resources: Dict[str, Any]) -> CostEstimate:
        """Calculate costs for current resource state."""
        service_costs = []
        
        # Kinesis costs
        if 'kinesis' in resources:
            for stream in resources['kinesis']:
                shard_count = stream.get('shard_count', 0)
                if shard_count > 0:
                    cost = self.cost_calculator.calculate_kinesis_cost(shard_count)
                    service_costs.append(cost)
        
        # Lambda costs (minimal when idle)
        if 'lambda' in resources:
            lambda_count = len(resources['lambda'])
            if lambda_count > 0:
                cost = self.cost_calculator.calculate_lambda_cost(lambda_count)
                service_costs.append(cost)
        
        # SageMaker costs
        if 'sagemaker' in resources:
            for endpoint in resources['sagemaker']:
                if endpoint.get('status') == 'InService':
                    instance_type = endpoint.get('instance_type', 'ml.m5.large')
                    cost = self.cost_calculator.calculate_sagemaker_cost(1, instance_type)
                    service_costs.append(cost)
        
        # CloudWatch costs
        if 'cloudwatch' in resources:
            alarm_count = len(resources['cloudwatch'])
            enabled_count = sum(1 for a in resources['cloudwatch'] if a.get('enabled', True))
            if alarm_count > 0:
                cost = self.cost_calculator.calculate_cloudwatch_cost(
                    alarm_count, alarms_enabled=(enabled_count > 0)
                )
                service_costs.append(cost)
        
        return self.cost_calculator.calculate_total_cost(service_costs)
    
    def _apply_stop_changes(self, resources: Dict[str, Any]) -> Dict[str, Any]:
        """Apply stop changes to resources (for cost calculation)."""
        modified = {}
        
        # Kinesis: scale to 1 shard
        if 'kinesis' in resources:
            modified['kinesis'] = [
                {**s, 'shard_count': 1} for s in resources['kinesis']
            ]
        
        # Lambda: set concurrency to 0
        if 'lambda' in resources:
            modified['lambda'] = [
                {**f, 'reserved_concurrency': 0} for f in resources['lambda']
            ]
        
        # SageMaker: mark as deleted
        if 'sagemaker' in resources:
            modified['sagemaker'] = [
                {**e, 'status': 'Deleted'} for e in resources['sagemaker']
            ]
        
        # CloudWatch: disable alarms
        if 'cloudwatch' in resources:
            modified['cloudwatch'] = [
                {**a, 'enabled': False} for a in resources['cloudwatch']
            ]
        
        return modified
    
    def _apply_start_changes(
        self,
        current: Dict[str, Any],
        target: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Apply start changes to resources (for cost calculation)."""
        modified = {}
        
        # Kinesis: restore shard count
        if 'kinesis' in target:
            target_shards = target['kinesis'].get('shard_count', 2)
            modified['kinesis'] = [
                {**s, 'shard_count': target_shards}
                for s in current.get('kinesis', [])
            ]
        
        # Lambda: remove concurrency limits
        if 'lambda' in target:
            modified['lambda'] = [
                {**f, 'reserved_concurrency': None}
                for f in current.get('lambda', [])
            ]
        
        # SageMaker: mark as InService
        if 'sagemaker' in target:
            modified['sagemaker'] = [
                {**target['sagemaker'], 'status': 'InService'}
            ]
        
        # CloudWatch: enable alarms
        if 'cloudwatch' in target:
            modified['cloudwatch'] = [
                {**a, 'enabled': True}
                for a in current.get('cloudwatch', [])
            ]
        
        return modified
