"""
Cost calculation module for AWS resources.

Provides cost estimation for various AWS services based on current pricing
and resource configurations. Supports cost breakdown, comparison, and reporting.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum

try:
    from .logging_config import get_logger
except ImportError:
    from logging_config import get_logger

logger = get_logger(__name__)


class AWSRegion(Enum):
    """AWS regions with pricing variations."""
    US_EAST_1 = "us-east-1"
    US_WEST_2 = "us-west-2"
    EU_WEST_1 = "eu-west-1"


# AWS Pricing Constants (US East 1 - as of 2025)
# These are approximate values and should be updated based on actual AWS pricing

class KinesisPricing:
    """Kinesis Data Streams pricing."""
    SHARD_HOUR = 0.015  # $ per shard hour
    PUT_PAYLOAD_UNIT = 0.014  # $ per million PUT payload units (25KB)
    EXTENDED_RETENTION_HOUR = 0.020  # $ per shard hour for retention > 24h
    ENHANCED_FANOUT_HOUR = 0.015  # $ per consumer-shard hour
    ENHANCED_FANOUT_GB = 0.013  # $ per GB retrieved


class LambdaPricing:
    """Lambda pricing."""
    REQUEST = 0.20 / 1_000_000  # $ per million requests
    GB_SECOND = 0.0000166667  # $ per GB-second
    FREE_TIER_REQUESTS = 1_000_000  # Free requests per month
    FREE_TIER_GB_SECONDS = 400_000  # Free GB-seconds per month


class CloudWatchPricing:
    """CloudWatch pricing."""
    ALARM = 0.10  # $ per alarm per month
    LOG_INGESTION_GB = 0.50  # $ per GB ingested
    LOG_STORAGE_GB = 0.03  # $ per GB per month
    CUSTOM_METRIC = 0.30  # $ per custom metric per month
    API_REQUEST = 0.01 / 1000  # $ per 1000 API requests


class DynamoDBPricing:
    """DynamoDB pricing."""
    ON_DEMAND_WRITE = 1.25 / 1_000_000  # $ per million write request units
    ON_DEMAND_READ = 0.25 / 1_000_000  # $ per million read request units
    PROVISIONED_WRITE = 0.00065  # $ per WCU per hour
    PROVISIONED_READ = 0.00013  # $ per RCU per hour
    STORAGE_GB = 0.25  # $ per GB per month


class SageMakerPricing:
    """SageMaker pricing (instance-based)."""
    ML_M5_LARGE_HOUR = 0.115  # $ per hour for ml.m5.large
    ML_M5_XLARGE_HOUR = 0.23  # $ per hour for ml.m5.xlarge
    ML_T3_MEDIUM_HOUR = 0.05  # $ per hour for ml.t3.medium


@dataclass
class ServiceCost:
    """Cost breakdown for a single service."""
    service_name: str
    resource_count: int
    hourly_cost: float
    daily_cost: float
    monthly_cost: float
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'service_name': self.service_name,
            'resource_count': self.resource_count,
            'hourly_cost': round(self.hourly_cost, 4),
            'daily_cost': round(self.daily_cost, 2),
            'monthly_cost': round(self.monthly_cost, 2),
            'details': self.details
        }


@dataclass
class CostEstimate:
    """Complete cost estimate for all resources."""
    timestamp: datetime
    hourly_cost: float
    daily_cost: float
    monthly_cost: float
    service_breakdown: List[ServiceCost]
    total_resources: int
    region: str = "us-east-1"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'timestamp': self.timestamp.isoformat(),
            'region': self.region,
            'total_resources': self.total_resources,
            'hourly_cost': round(self.hourly_cost, 4),
            'daily_cost': round(self.daily_cost, 2),
            'monthly_cost': round(self.monthly_cost, 2),
            'service_breakdown': [s.to_dict() for s in self.service_breakdown]
        }


@dataclass
class CostComparison:
    """Comparison between current and optimized costs."""
    current_estimate: CostEstimate
    optimized_estimate: CostEstimate
    savings_hourly: float
    savings_daily: float
    savings_monthly: float
    savings_percentage: float
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'current': self.current_estimate.to_dict(),
            'optimized': self.optimized_estimate.to_dict(),
            'savings': {
                'hourly': round(self.savings_hourly, 4),
                'daily': round(self.savings_daily, 2),
                'monthly': round(self.savings_monthly, 2),
                'percentage': round(self.savings_percentage, 1)
            }
        }


class CostCalculator:
    """Calculate costs for AWS resources."""
    
    def __init__(self, region: str = "us-east-1"):
        """
        Initialize cost calculator.
        
        Args:
            region: AWS region for pricing
        """
        self.region = region
        logger.debug(f"Cost calculator initialized for region: {region}")
    
    def calculate_kinesis_cost(
        self,
        shard_count: int,
        retention_hours: int = 24,
        put_records_per_hour: int = 0,
        enhanced_fanout_consumers: int = 0
    ) -> ServiceCost:
        """
        Calculate Kinesis Data Streams cost.
        
        Args:
            shard_count: Number of shards
            retention_hours: Data retention period in hours
            put_records_per_hour: Number of PUT records per hour
            enhanced_fanout_consumers: Number of enhanced fanout consumers
            
        Returns:
            ServiceCost with Kinesis cost breakdown
        """
        # Shard hours cost
        hourly_shard_cost = shard_count * KinesisPricing.SHARD_HOUR
        
        # Extended retention cost (if > 24 hours)
        extended_retention_cost = 0
        if retention_hours > 24:
            extended_hours = retention_hours - 24
            extended_retention_cost = shard_count * (extended_hours / 24) * KinesisPricing.EXTENDED_RETENTION_HOUR
        
        # PUT payload cost (assuming average 5KB per record)
        put_payload_units = (put_records_per_hour * 5) / 25  # 25KB per unit
        put_cost_hourly = (put_payload_units / 1_000_000) * KinesisPricing.PUT_PAYLOAD_UNIT
        
        # Enhanced fanout cost
        enhanced_fanout_cost = enhanced_fanout_consumers * shard_count * KinesisPricing.ENHANCED_FANOUT_HOUR
        
        hourly_cost = hourly_shard_cost + extended_retention_cost + put_cost_hourly + enhanced_fanout_cost
        daily_cost = hourly_cost * 24
        monthly_cost = daily_cost * 30
        
        details = {
            'shard_count': shard_count,
            'retention_hours': retention_hours,
            'shard_cost_hourly': round(hourly_shard_cost, 4),
            'extended_retention_cost_hourly': round(extended_retention_cost, 4),
            'put_cost_hourly': round(put_cost_hourly, 4),
            'enhanced_fanout_cost_hourly': round(enhanced_fanout_cost, 4)
        }
        
        logger.debug(f"Kinesis cost calculated: ${hourly_cost:.4f}/hour for {shard_count} shards")
        
        return ServiceCost(
            service_name='Kinesis Data Streams',
            resource_count=shard_count,
            hourly_cost=hourly_cost,
            daily_cost=daily_cost,
            monthly_cost=monthly_cost,
            details=details
        )
    
    def calculate_lambda_cost(
        self,
        function_count: int,
        invocations_per_hour: int = 0,
        avg_duration_ms: int = 1000,
        avg_memory_mb: int = 1024,
        reserved_concurrency: int = 0
    ) -> ServiceCost:
        """
        Calculate Lambda cost.
        
        Args:
            function_count: Number of Lambda functions
            invocations_per_hour: Number of invocations per hour
            avg_duration_ms: Average execution duration in milliseconds
            avg_memory_mb: Average memory allocation in MB
            reserved_concurrency: Reserved concurrency (if any)
            
        Returns:
            ServiceCost with Lambda cost breakdown
        """
        # Request cost
        monthly_invocations = invocations_per_hour * 24 * 30
        billable_invocations = max(0, monthly_invocations - LambdaPricing.FREE_TIER_REQUESTS)
        request_cost_monthly = billable_invocations * LambdaPricing.REQUEST
        
        # Compute cost (GB-seconds)
        gb_memory = avg_memory_mb / 1024
        duration_seconds = avg_duration_ms / 1000
        gb_seconds_per_invocation = gb_memory * duration_seconds
        monthly_gb_seconds = monthly_invocations * gb_seconds_per_invocation
        billable_gb_seconds = max(0, monthly_gb_seconds - LambdaPricing.FREE_TIER_GB_SECONDS)
        compute_cost_monthly = billable_gb_seconds * LambdaPricing.GB_SECOND
        
        monthly_cost = request_cost_monthly + compute_cost_monthly
        daily_cost = monthly_cost / 30
        hourly_cost = daily_cost / 24
        
        # Note: If reserved concurrency is 0, Lambda won't execute, so cost is $0
        if reserved_concurrency == 0 and invocations_per_hour > 0:
            logger.debug("Lambda has reserved concurrency of 0, actual invocations will be 0")
            hourly_cost = 0
            daily_cost = 0
            monthly_cost = 0
        
        details = {
            'function_count': function_count,
            'invocations_per_hour': invocations_per_hour,
            'avg_duration_ms': avg_duration_ms,
            'avg_memory_mb': avg_memory_mb,
            'reserved_concurrency': reserved_concurrency,
            'request_cost_monthly': round(request_cost_monthly, 4),
            'compute_cost_monthly': round(compute_cost_monthly, 4),
            'note': 'Includes free tier deduction' if billable_invocations < monthly_invocations else 'Exceeds free tier'
        }
        
        logger.debug(f"Lambda cost calculated: ${hourly_cost:.4f}/hour for {function_count} functions")
        
        return ServiceCost(
            service_name='Lambda',
            resource_count=function_count,
            hourly_cost=hourly_cost,
            daily_cost=daily_cost,
            monthly_cost=monthly_cost,
            details=details
        )
    
    def calculate_cloudwatch_cost(
        self,
        alarm_count: int,
        log_ingestion_gb_per_day: float = 0,
        log_storage_gb: float = 0,
        custom_metrics: int = 0,
        alarms_enabled: bool = True
    ) -> ServiceCost:
        """
        Calculate CloudWatch cost.
        
        Args:
            alarm_count: Number of CloudWatch alarms
            log_ingestion_gb_per_day: GB of logs ingested per day
            log_storage_gb: GB of logs stored
            custom_metrics: Number of custom metrics
            alarms_enabled: Whether alarms are enabled
            
        Returns:
            ServiceCost with CloudWatch cost breakdown
        """
        # Alarm cost (only if enabled)
        alarm_cost_monthly = alarm_count * CloudWatchPricing.ALARM if alarms_enabled else 0
        
        # Log ingestion cost
        log_ingestion_monthly = log_ingestion_gb_per_day * 30 * CloudWatchPricing.LOG_INGESTION_GB
        
        # Log storage cost
        log_storage_monthly = log_storage_gb * CloudWatchPricing.LOG_STORAGE_GB
        
        # Custom metrics cost
        custom_metrics_monthly = custom_metrics * CloudWatchPricing.CUSTOM_METRIC
        
        monthly_cost = alarm_cost_monthly + log_ingestion_monthly + log_storage_monthly + custom_metrics_monthly
        daily_cost = monthly_cost / 30
        hourly_cost = daily_cost / 24
        
        details = {
            'alarm_count': alarm_count,
            'alarms_enabled': alarms_enabled,
            'alarm_cost_monthly': round(alarm_cost_monthly, 2),
            'log_ingestion_gb_per_day': log_ingestion_gb_per_day,
            'log_ingestion_cost_monthly': round(log_ingestion_monthly, 2),
            'log_storage_gb': log_storage_gb,
            'log_storage_cost_monthly': round(log_storage_monthly, 2),
            'custom_metrics': custom_metrics,
            'custom_metrics_cost_monthly': round(custom_metrics_monthly, 2)
        }
        
        logger.debug(f"CloudWatch cost calculated: ${hourly_cost:.4f}/hour for {alarm_count} alarms")
        
        return ServiceCost(
            service_name='CloudWatch',
            resource_count=alarm_count + custom_metrics,
            hourly_cost=hourly_cost,
            daily_cost=daily_cost,
            monthly_cost=monthly_cost,
            details=details
        )
    
    def calculate_dynamodb_cost(
        self,
        table_count: int,
        billing_mode: str = "PAY_PER_REQUEST",
        read_units_per_hour: int = 0,
        write_units_per_hour: int = 0,
        storage_gb: float = 0,
        provisioned_rcu: int = 0,
        provisioned_wcu: int = 0
    ) -> ServiceCost:
        """
        Calculate DynamoDB cost.
        
        Args:
            table_count: Number of DynamoDB tables
            billing_mode: PAY_PER_REQUEST or PROVISIONED
            read_units_per_hour: Read request units per hour (on-demand)
            write_units_per_hour: Write request units per hour (on-demand)
            storage_gb: Storage in GB
            provisioned_rcu: Provisioned read capacity units
            provisioned_wcu: Provisioned write capacity units
            
        Returns:
            ServiceCost with DynamoDB cost breakdown
        """
        if billing_mode == "PAY_PER_REQUEST":
            # On-demand pricing
            monthly_reads = read_units_per_hour * 24 * 30
            monthly_writes = write_units_per_hour * 24 * 30
            
            read_cost_monthly = (monthly_reads / 1_000_000) * DynamoDBPricing.ON_DEMAND_READ
            write_cost_monthly = (monthly_writes / 1_000_000) * DynamoDBPricing.ON_DEMAND_WRITE
            capacity_cost_monthly = read_cost_monthly + write_cost_monthly
        else:
            # Provisioned pricing
            capacity_cost_hourly = (
                provisioned_rcu * DynamoDBPricing.PROVISIONED_READ +
                provisioned_wcu * DynamoDBPricing.PROVISIONED_WRITE
            )
            capacity_cost_monthly = capacity_cost_hourly * 24 * 30
        
        # Storage cost
        storage_cost_monthly = storage_gb * DynamoDBPricing.STORAGE_GB
        
        monthly_cost = capacity_cost_monthly + storage_cost_monthly
        daily_cost = monthly_cost / 30
        hourly_cost = daily_cost / 24
        
        details = {
            'table_count': table_count,
            'billing_mode': billing_mode,
            'storage_gb': storage_gb,
            'storage_cost_monthly': round(storage_cost_monthly, 2),
            'capacity_cost_monthly': round(capacity_cost_monthly, 2)
        }
        
        if billing_mode == "PAY_PER_REQUEST":
            details['read_units_per_hour'] = read_units_per_hour
            details['write_units_per_hour'] = write_units_per_hour
        else:
            details['provisioned_rcu'] = provisioned_rcu
            details['provisioned_wcu'] = provisioned_wcu
        
        logger.debug(f"DynamoDB cost calculated: ${hourly_cost:.4f}/hour for {table_count} tables")
        
        return ServiceCost(
            service_name='DynamoDB',
            resource_count=table_count,
            hourly_cost=hourly_cost,
            daily_cost=daily_cost,
            monthly_cost=monthly_cost,
            details=details
        )
    
    def calculate_sagemaker_cost(
        self,
        endpoint_count: int,
        instance_type: str = "ml.m5.large",
        instance_count_per_endpoint: int = 1
    ) -> ServiceCost:
        """
        Calculate SageMaker endpoint cost.
        
        Args:
            endpoint_count: Number of SageMaker endpoints
            instance_type: Instance type (e.g., ml.m5.large)
            instance_count_per_endpoint: Number of instances per endpoint
            
        Returns:
            ServiceCost with SageMaker cost breakdown
        """
        # Map instance types to hourly costs
        instance_costs = {
            'ml.m5.large': SageMakerPricing.ML_M5_LARGE_HOUR,
            'ml.m5.xlarge': SageMakerPricing.ML_M5_XLARGE_HOUR,
            'ml.t3.medium': SageMakerPricing.ML_T3_MEDIUM_HOUR
        }
        
        instance_hourly_cost = instance_costs.get(instance_type, SageMakerPricing.ML_M5_LARGE_HOUR)
        
        total_instances = endpoint_count * instance_count_per_endpoint
        hourly_cost = total_instances * instance_hourly_cost
        daily_cost = hourly_cost * 24
        monthly_cost = daily_cost * 30
        
        details = {
            'endpoint_count': endpoint_count,
            'instance_type': instance_type,
            'instance_count_per_endpoint': instance_count_per_endpoint,
            'total_instances': total_instances,
            'instance_hourly_cost': round(instance_hourly_cost, 4)
        }
        
        logger.debug(f"SageMaker cost calculated: ${hourly_cost:.4f}/hour for {endpoint_count} endpoints")
        
        return ServiceCost(
            service_name='SageMaker',
            resource_count=endpoint_count,
            hourly_cost=hourly_cost,
            daily_cost=daily_cost,
            monthly_cost=monthly_cost,
            details=details
        )
    
    def calculate_total_cost(self, service_costs: List[ServiceCost]) -> CostEstimate:
        """
        Calculate total cost from multiple services.
        
        Args:
            service_costs: List of ServiceCost objects
            
        Returns:
            CostEstimate with total costs
        """
        total_hourly = sum(s.hourly_cost for s in service_costs)
        total_daily = sum(s.daily_cost for s in service_costs)
        total_monthly = sum(s.monthly_cost for s in service_costs)
        total_resources = sum(s.resource_count for s in service_costs)
        
        estimate = CostEstimate(
            timestamp=datetime.utcnow(),
            hourly_cost=total_hourly,
            daily_cost=total_daily,
            monthly_cost=total_monthly,
            service_breakdown=service_costs,
            total_resources=total_resources,
            region=self.region
        )
        
        logger.info(
            f"Total cost calculated: ${total_hourly:.4f}/hour, "
            f"${total_daily:.2f}/day, ${total_monthly:.2f}/month"
        )
        
        return estimate
    
    def compare_costs(
        self,
        current_costs: List[ServiceCost],
        optimized_costs: List[ServiceCost]
    ) -> CostComparison:
        """
        Compare current costs with optimized costs.
        
        Args:
            current_costs: List of current service costs
            optimized_costs: List of optimized service costs
            
        Returns:
            CostComparison with savings analysis
        """
        current_estimate = self.calculate_total_cost(current_costs)
        optimized_estimate = self.calculate_total_cost(optimized_costs)
        
        savings_hourly = current_estimate.hourly_cost - optimized_estimate.hourly_cost
        savings_daily = current_estimate.daily_cost - optimized_estimate.daily_cost
        savings_monthly = current_estimate.monthly_cost - optimized_estimate.monthly_cost
        
        # Calculate percentage savings
        if current_estimate.monthly_cost > 0:
            savings_percentage = (savings_monthly / current_estimate.monthly_cost) * 100
        else:
            savings_percentage = 0
        
        comparison = CostComparison(
            current_estimate=current_estimate,
            optimized_estimate=optimized_estimate,
            savings_hourly=savings_hourly,
            savings_daily=savings_daily,
            savings_monthly=savings_monthly,
            savings_percentage=savings_percentage
        )
        
        logger.info(
            f"Cost comparison: ${savings_monthly:.2f}/month savings "
            f"({savings_percentage:.1f}% reduction)"
        )
        
        return comparison
