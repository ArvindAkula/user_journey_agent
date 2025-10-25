#!/usr/bin/env python3
"""
Example usage of cost calculation and reporting functionality.

Demonstrates how to calculate costs for various AWS services and generate
detailed cost reports with breakdowns and comparisons.
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from cost_calculator import CostCalculator
from cost_reporter import CostReporter
from logging_config import setup_logging

# Setup logging
setup_logging()


def example_kinesis_cost():
    """Example: Calculate Kinesis Data Streams cost."""
    print("\n" + "=" * 80)
    print("EXAMPLE 1: Kinesis Data Streams Cost Calculation")
    print("=" * 80)
    
    calculator = CostCalculator(region="us-east-1")
    
    # Calculate cost for 2 shards
    cost_2_shards = calculator.calculate_kinesis_cost(
        shard_count=2,
        retention_hours=24,
        put_records_per_hour=1000
    )
    
    print("\nKinesis Stream with 2 shards:")
    print(f"  Hourly cost:  ${cost_2_shards.hourly_cost:.4f}")
    print(f"  Daily cost:   ${cost_2_shards.daily_cost:.2f}")
    print(f"  Monthly cost: ${cost_2_shards.monthly_cost:.2f}")
    print(f"\nDetails:")
    for key, value in cost_2_shards.details.items():
        print(f"  {key}: {value}")
    
    # Calculate cost for 1 shard (optimized)
    cost_1_shard = calculator.calculate_kinesis_cost(
        shard_count=1,
        retention_hours=24,
        put_records_per_hour=1000
    )
    
    print("\nKinesis Stream with 1 shard (optimized):")
    print(f"  Hourly cost:  ${cost_1_shard.hourly_cost:.4f}")
    print(f"  Daily cost:   ${cost_1_shard.daily_cost:.2f}")
    print(f"  Monthly cost: ${cost_1_shard.monthly_cost:.2f}")
    
    savings = cost_2_shards.monthly_cost - cost_1_shard.monthly_cost
    print(f"\nMonthly savings: ${savings:.2f}")


def example_lambda_cost():
    """Example: Calculate Lambda cost."""
    print("\n" + "=" * 80)
    print("EXAMPLE 2: Lambda Cost Calculation")
    print("=" * 80)
    
    calculator = CostCalculator(region="us-east-1")
    
    # Calculate cost for active Lambda functions
    cost_active = calculator.calculate_lambda_cost(
        function_count=2,
        invocations_per_hour=1000,
        avg_duration_ms=500,
        avg_memory_mb=1024,
        reserved_concurrency=0
    )
    
    print("\nLambda Functions (active):")
    print(f"  Function count: 2")
    print(f"  Invocations/hour: 1000")
    print(f"  Avg duration: 500ms")
    print(f"  Avg memory: 1024MB")
    print(f"\nCosts:")
    print(f"  Hourly cost:  ${cost_active.hourly_cost:.4f}")
    print(f"  Daily cost:   ${cost_active.daily_cost:.2f}")
    print(f"  Monthly cost: ${cost_active.monthly_cost:.2f}")
    print(f"\nDetails:")
    for key, value in cost_active.details.items():
        print(f"  {key}: {value}")
    
    # Calculate cost with concurrency = 0 (stopped)
    cost_stopped = calculator.calculate_lambda_cost(
        function_count=2,
        invocations_per_hour=0,
        avg_duration_ms=500,
        avg_memory_mb=1024,
        reserved_concurrency=0
    )
    
    print("\nLambda Functions (concurrency = 0):")
    print(f"  Monthly cost: ${cost_stopped.monthly_cost:.2f}")
    print(f"  Note: No invocations possible when concurrency is 0")


def example_sagemaker_cost():
    """Example: Calculate SageMaker endpoint cost."""
    print("\n" + "=" * 80)
    print("EXAMPLE 3: SageMaker Endpoint Cost Calculation")
    print("=" * 80)
    
    calculator = CostCalculator(region="us-east-1")
    
    # Calculate cost for ml.m5.large
    cost_m5_large = calculator.calculate_sagemaker_cost(
        endpoint_count=1,
        instance_type="ml.m5.large",
        instance_count_per_endpoint=1
    )
    
    print("\nSageMaker Endpoint (ml.m5.large):")
    print(f"  Hourly cost:  ${cost_m5_large.hourly_cost:.4f}")
    print(f"  Daily cost:   ${cost_m5_large.daily_cost:.2f}")
    print(f"  Monthly cost: ${cost_m5_large.monthly_cost:.2f}")
    print(f"  Annual cost:  ${cost_m5_large.monthly_cost * 12:.2f}")
    
    # Calculate cost for ml.t3.medium (cheaper alternative)
    cost_t3_medium = calculator.calculate_sagemaker_cost(
        endpoint_count=1,
        instance_type="ml.t3.medium",
        instance_count_per_endpoint=1
    )
    
    print("\nSageMaker Endpoint (ml.t3.medium - cheaper alternative):")
    print(f"  Monthly cost: ${cost_t3_medium.monthly_cost:.2f}")
    
    savings = cost_m5_large.monthly_cost - cost_t3_medium.monthly_cost
    print(f"\nPotential savings: ${savings:.2f}/month")
    
    # Cost when deleted
    print("\nSageMaker Endpoint (deleted):")
    print(f"  Monthly cost: $0.00")
    print(f"  Savings: ${cost_m5_large.monthly_cost:.2f}/month")


def example_cloudwatch_cost():
    """Example: Calculate CloudWatch cost."""
    print("\n" + "=" * 80)
    print("EXAMPLE 4: CloudWatch Cost Calculation")
    print("=" * 80)
    
    calculator = CostCalculator(region="us-east-1")
    
    # Calculate cost with alarms enabled
    cost_enabled = calculator.calculate_cloudwatch_cost(
        alarm_count=9,
        log_ingestion_gb_per_day=0.5,
        log_storage_gb=10,
        custom_metrics=5,
        alarms_enabled=True
    )
    
    print("\nCloudWatch (alarms enabled):")
    print(f"  Alarm count: 9")
    print(f"  Log ingestion: 0.5 GB/day")
    print(f"  Log storage: 10 GB")
    print(f"  Custom metrics: 5")
    print(f"\nCosts:")
    print(f"  Hourly cost:  ${cost_enabled.hourly_cost:.4f}")
    print(f"  Daily cost:   ${cost_enabled.daily_cost:.2f}")
    print(f"  Monthly cost: ${cost_enabled.monthly_cost:.2f}")
    print(f"\nDetails:")
    for key, value in cost_enabled.details.items():
        print(f"  {key}: {value}")
    
    # Calculate cost with alarms disabled
    cost_disabled = calculator.calculate_cloudwatch_cost(
        alarm_count=9,
        log_ingestion_gb_per_day=0.5,
        log_storage_gb=10,
        custom_metrics=5,
        alarms_enabled=False
    )
    
    print("\nCloudWatch (alarms disabled):")
    print(f"  Monthly cost: ${cost_disabled.monthly_cost:.2f}")
    
    savings = cost_enabled.monthly_cost - cost_disabled.monthly_cost
    print(f"\nSavings from disabling alarms: ${savings:.2f}/month")


def example_dynamodb_cost():
    """Example: Calculate DynamoDB cost."""
    print("\n" + "=" * 80)
    print("EXAMPLE 5: DynamoDB Cost Calculation")
    print("=" * 80)
    
    calculator = CostCalculator(region="us-east-1")
    
    # On-demand billing (recommended)
    cost_on_demand = calculator.calculate_dynamodb_cost(
        table_count=5,
        billing_mode="PAY_PER_REQUEST",
        read_units_per_hour=100,
        write_units_per_hour=50,
        storage_gb=5
    )
    
    print("\nDynamoDB Tables (on-demand billing):")
    print(f"  Table count: 5")
    print(f"  Read units/hour: 100")
    print(f"  Write units/hour: 50")
    print(f"  Storage: 5 GB")
    print(f"\nCosts:")
    print(f"  Hourly cost:  ${cost_on_demand.hourly_cost:.4f}")
    print(f"  Daily cost:   ${cost_on_demand.daily_cost:.2f}")
    print(f"  Monthly cost: ${cost_on_demand.monthly_cost:.2f}")
    print(f"\nNote: On-demand billing has no idle cost")
    
    # Provisioned billing (for comparison)
    cost_provisioned = calculator.calculate_dynamodb_cost(
        table_count=5,
        billing_mode="PROVISIONED",
        storage_gb=5,
        provisioned_rcu=10,
        provisioned_wcu=10
    )
    
    print("\nDynamoDB Tables (provisioned billing):")
    print(f"  Provisioned RCU: 10")
    print(f"  Provisioned WCU: 10")
    print(f"  Monthly cost: ${cost_provisioned.monthly_cost:.2f}")
    print(f"\nNote: Provisioned billing has idle cost even with no traffic")


def example_total_cost_estimate():
    """Example: Calculate total cost for all services."""
    print("\n" + "=" * 80)
    print("EXAMPLE 6: Total Cost Estimate")
    print("=" * 80)
    
    calculator = CostCalculator(region="us-east-1")
    
    # Calculate costs for all services
    service_costs = []
    
    # Kinesis
    kinesis_cost = calculator.calculate_kinesis_cost(shard_count=2)
    service_costs.append(kinesis_cost)
    
    # Lambda
    lambda_cost = calculator.calculate_lambda_cost(
        function_count=2,
        invocations_per_hour=1000,
        avg_duration_ms=500,
        avg_memory_mb=1024
    )
    service_costs.append(lambda_cost)
    
    # SageMaker
    sagemaker_cost = calculator.calculate_sagemaker_cost(
        endpoint_count=1,
        instance_type="ml.m5.large"
    )
    service_costs.append(sagemaker_cost)
    
    # CloudWatch
    cloudwatch_cost = calculator.calculate_cloudwatch_cost(
        alarm_count=9,
        alarms_enabled=True
    )
    service_costs.append(cloudwatch_cost)
    
    # DynamoDB
    dynamodb_cost = calculator.calculate_dynamodb_cost(
        table_count=5,
        billing_mode="PAY_PER_REQUEST",
        storage_gb=5
    )
    service_costs.append(dynamodb_cost)
    
    # Calculate total
    total_estimate = calculator.calculate_total_cost(service_costs)
    
    # Generate report
    reporter = CostReporter()
    reporter.print_cost_breakdown(total_estimate)


def example_cost_comparison():
    """Example: Compare current vs optimized costs."""
    print("\n" + "=" * 80)
    print("EXAMPLE 7: Cost Comparison (Current vs Optimized)")
    print("=" * 80)
    
    calculator = CostCalculator(region="us-east-1")
    
    # Current costs (all resources running)
    current_costs = [
        calculator.calculate_kinesis_cost(shard_count=2),
        calculator.calculate_lambda_cost(function_count=2, invocations_per_hour=1000),
        calculator.calculate_sagemaker_cost(endpoint_count=1, instance_type="ml.m5.large"),
        calculator.calculate_cloudwatch_cost(alarm_count=9, alarms_enabled=True),
        calculator.calculate_dynamodb_cost(table_count=5, billing_mode="PAY_PER_REQUEST", storage_gb=5)
    ]
    
    # Optimized costs (resources stopped/scaled down)
    optimized_costs = [
        calculator.calculate_kinesis_cost(shard_count=1),  # Scaled down
        calculator.calculate_lambda_cost(function_count=2, invocations_per_hour=0, reserved_concurrency=0),  # Stopped
        # SageMaker deleted (not included)
        calculator.calculate_cloudwatch_cost(alarm_count=9, alarms_enabled=False),  # Disabled
        calculator.calculate_dynamodb_cost(table_count=5, billing_mode="PAY_PER_REQUEST", storage_gb=5)  # Same
    ]
    
    # Generate comparison
    comparison = calculator.compare_costs(current_costs, optimized_costs)
    
    # Generate report
    reporter = CostReporter()
    reporter.print_cost_comparison(comparison)
    reporter.print_savings_summary(comparison)


def example_cost_recommendations():
    """Example: Generate cost optimization recommendations."""
    print("\n" + "=" * 80)
    print("EXAMPLE 8: Cost Optimization Recommendations")
    print("=" * 80)
    
    calculator = CostCalculator(region="us-east-1")
    
    # Calculate current costs
    service_costs = [
        calculator.calculate_kinesis_cost(shard_count=2),
        calculator.calculate_lambda_cost(function_count=2, invocations_per_hour=1000),
        calculator.calculate_sagemaker_cost(endpoint_count=1, instance_type="ml.m5.large"),
        calculator.calculate_cloudwatch_cost(alarm_count=9, alarms_enabled=True),
        calculator.calculate_dynamodb_cost(table_count=5, billing_mode="PROVISIONED", 
                                          provisioned_rcu=10, provisioned_wcu=10, storage_gb=5)
    ]
    
    total_estimate = calculator.calculate_total_cost(service_costs)
    
    # Generate recommendations
    reporter = CostReporter()
    recommendations = reporter.generate_recommendations(total_estimate)
    
    reporter.print_recommendations(recommendations)


def main():
    """Run all cost calculation examples."""
    print("\n" + "=" * 80)
    print("COST CALCULATION AND REPORTING EXAMPLES")
    print("=" * 80)
    print("\nThese examples demonstrate cost calculation for various AWS services")
    print("and how to generate detailed cost reports.")
    print("=" * 80)
    
    try:
        # Run examples
        example_kinesis_cost()
        input("\nPress Enter to continue to next example...")
        
        example_lambda_cost()
        input("\nPress Enter to continue to next example...")
        
        example_sagemaker_cost()
        input("\nPress Enter to continue to next example...")
        
        example_cloudwatch_cost()
        input("\nPress Enter to continue to next example...")
        
        example_dynamodb_cost()
        input("\nPress Enter to continue to next example...")
        
        example_total_cost_estimate()
        input("\nPress Enter to continue to next example...")
        
        example_cost_comparison()
        input("\nPress Enter to continue to next example...")
        
        example_cost_recommendations()
        
        print("\n" + "=" * 80)
        print("✓ All examples completed successfully!")
        print("=" * 80)
        
    except KeyboardInterrupt:
        print("\n\nExamples interrupted by user.")
    except Exception as e:
        print(f"\n\nError running examples: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
