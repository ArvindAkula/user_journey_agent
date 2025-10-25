"""
Cost reporting module for generating detailed cost breakdowns and visualizations.

Provides formatted reports showing cost breakdowns by service, cost comparisons,
and savings analysis in both text and JSON formats.
"""

import json
from typing import List, Dict, Any, Optional
from datetime import datetime

try:
    from .cost_calculator import CostEstimate, CostComparison, ServiceCost
    from .logging_config import get_logger
except ImportError:
    from cost_calculator import CostEstimate, CostComparison, ServiceCost
    from logging_config import get_logger

logger = get_logger(__name__)


class CostReporter:
    """Generate cost reports in various formats."""
    
    def __init__(self):
        """Initialize cost reporter."""
        logger.debug("Cost reporter initialized")
    
    def generate_cost_breakdown_text(self, estimate: CostEstimate) -> str:
        """
        Generate a text-based cost breakdown report.
        
        Args:
            estimate: Cost estimate to report
            
        Returns:
            Formatted text report
        """
        lines = []
        lines.append("=" * 80)
        lines.append("AWS COST BREAKDOWN")
        lines.append("=" * 80)
        lines.append(f"Timestamp: {estimate.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        lines.append(f"Region:    {estimate.region}")
        lines.append(f"Resources: {estimate.total_resources} total")
        lines.append("")
        
        # Summary costs
        lines.append("-" * 80)
        lines.append("TOTAL COSTS")
        lines.append("-" * 80)
        lines.append(f"Hourly:   ${estimate.hourly_cost:>10.4f}")
        lines.append(f"Daily:    ${estimate.daily_cost:>10.2f}")
        lines.append(f"Monthly:  ${estimate.monthly_cost:>10.2f}")
        lines.append("")
        
        # Service breakdown
        if estimate.service_breakdown:
            lines.append("-" * 80)
            lines.append("COST BY SERVICE")
            lines.append("-" * 80)
            lines.append(f"{'Service':<25} {'Resources':>10} {'Hourly':>12} {'Daily':>12} {'Monthly':>12}")
            lines.append("-" * 80)
            
            for service in estimate.service_breakdown:
                lines.append(
                    f"{service.service_name:<25} "
                    f"{service.resource_count:>10} "
                    f"${service.hourly_cost:>11.4f} "
                    f"${service.daily_cost:>11.2f} "
                    f"${service.monthly_cost:>11.2f}"
                )
            
            lines.append("")
            
            # Detailed breakdown for each service
            lines.append("-" * 80)
            lines.append("DETAILED BREAKDOWN")
            lines.append("-" * 80)
            
            for service in estimate.service_breakdown:
                lines.append(f"\n{service.service_name}:")
                lines.append(f"  Resources: {service.resource_count}")
                lines.append(f"  Monthly Cost: ${service.monthly_cost:.2f}")
                
                if service.details:
                    lines.append("  Details:")
                    for key, value in service.details.items():
                        if isinstance(value, (int, float)):
                            if isinstance(value, float):
                                lines.append(f"    - {key}: {value:.4f}")
                            else:
                                lines.append(f"    - {key}: {value}")
                        else:
                            lines.append(f"    - {key}: {value}")
        
        lines.append("")
        lines.append("=" * 80)
        
        report = "\n".join(lines)
        logger.debug("Generated cost breakdown text report")
        return report
    
    def generate_comparison_text(self, comparison: CostComparison) -> str:
        """
        Generate a text-based cost comparison report.
        
        Args:
            comparison: Cost comparison to report
            
        Returns:
            Formatted text report
        """
        lines = []
        lines.append("=" * 80)
        lines.append("COST COMPARISON: CURRENT vs OPTIMIZED")
        lines.append("=" * 80)
        lines.append("")
        
        # Current costs
        lines.append("-" * 80)
        lines.append("CURRENT COSTS")
        lines.append("-" * 80)
        lines.append(f"Hourly:   ${comparison.current_estimate.hourly_cost:>10.4f}")
        lines.append(f"Daily:    ${comparison.current_estimate.daily_cost:>10.2f}")
        lines.append(f"Monthly:  ${comparison.current_estimate.monthly_cost:>10.2f}")
        lines.append("")
        
        # Optimized costs
        lines.append("-" * 80)
        lines.append("OPTIMIZED COSTS")
        lines.append("-" * 80)
        lines.append(f"Hourly:   ${comparison.optimized_estimate.hourly_cost:>10.4f}")
        lines.append(f"Daily:    ${comparison.optimized_estimate.daily_cost:>10.2f}")
        lines.append(f"Monthly:  ${comparison.optimized_estimate.monthly_cost:>10.2f}")
        lines.append("")
        
        # Savings
        lines.append("-" * 80)
        lines.append("ESTIMATED SAVINGS")
        lines.append("-" * 80)
        lines.append(f"Hourly:   ${comparison.savings_hourly:>10.4f}")
        lines.append(f"Daily:    ${comparison.savings_daily:>10.2f}")
        lines.append(f"Monthly:  ${comparison.savings_monthly:>10.2f}")
        lines.append(f"Percentage: {comparison.savings_percentage:>8.1f}%")
        lines.append("")
        
        # Service-by-service comparison
        lines.append("-" * 80)
        lines.append("SAVINGS BY SERVICE")
        lines.append("-" * 80)
        lines.append(f"{'Service':<25} {'Current':>12} {'Optimized':>12} {'Savings':>12} {'%':>8}")
        lines.append("-" * 80)
        
        # Create a map of services for comparison
        current_services = {s.service_name: s for s in comparison.current_estimate.service_breakdown}
        optimized_services = {s.service_name: s for s in comparison.optimized_estimate.service_breakdown}
        
        all_services = set(current_services.keys()) | set(optimized_services.keys())
        
        for service_name in sorted(all_services):
            current_cost = current_services.get(service_name, ServiceCost(service_name, 0, 0, 0, 0)).monthly_cost
            optimized_cost = optimized_services.get(service_name, ServiceCost(service_name, 0, 0, 0, 0)).monthly_cost
            savings = current_cost - optimized_cost
            savings_pct = (savings / current_cost * 100) if current_cost > 0 else 0
            
            lines.append(
                f"{service_name:<25} "
                f"${current_cost:>11.2f} "
                f"${optimized_cost:>11.2f} "
                f"${savings:>11.2f} "
                f"{savings_pct:>7.1f}%"
            )
        
        lines.append("")
        
        # Visual representation
        lines.append("-" * 80)
        lines.append("VISUAL COMPARISON")
        lines.append("-" * 80)
        
        self._add_cost_bar_chart(
            lines,
            "Current Monthly Cost",
            comparison.current_estimate.monthly_cost,
            comparison.current_estimate.monthly_cost
        )
        
        self._add_cost_bar_chart(
            lines,
            "Optimized Monthly Cost",
            comparison.optimized_estimate.monthly_cost,
            comparison.current_estimate.monthly_cost
        )
        
        self._add_cost_bar_chart(
            lines,
            "Monthly Savings",
            comparison.savings_monthly,
            comparison.current_estimate.monthly_cost,
            char='$'
        )
        
        lines.append("")
        lines.append("=" * 80)
        
        report = "\n".join(lines)
        logger.info(f"Generated cost comparison report: ${comparison.savings_monthly:.2f}/month savings")
        return report
    
    def _add_cost_bar_chart(
        self,
        lines: List[str],
        label: str,
        value: float,
        max_value: float,
        char: str = '█',
        width: int = 50
    ):
        """
        Add a simple bar chart to the report.
        
        Args:
            lines: List to append chart lines to
            label: Label for the bar
            value: Value to display
            max_value: Maximum value for scaling
            char: Character to use for the bar
            width: Width of the bar in characters
        """
        if max_value > 0:
            bar_length = int((value / max_value) * width)
        else:
            bar_length = 0
        
        bar = char * bar_length
        lines.append(f"{label:<25} ${value:>8.2f} {bar}")
    
    def generate_savings_summary(self, comparison: CostComparison) -> str:
        """
        Generate a concise savings summary.
        
        Args:
            comparison: Cost comparison
            
        Returns:
            Brief summary text
        """
        lines = []
        lines.append("💰 COST SAVINGS SUMMARY")
        lines.append("")
        lines.append(f"Current monthly cost:   ${comparison.current_estimate.monthly_cost:.2f}")
        lines.append(f"Optimized monthly cost: ${comparison.optimized_estimate.monthly_cost:.2f}")
        lines.append(f"Monthly savings:        ${comparison.savings_monthly:.2f} ({comparison.savings_percentage:.1f}%)")
        lines.append("")
        lines.append(f"Annual savings:         ${comparison.savings_monthly * 12:.2f}")
        
        summary = "\n".join(lines)
        logger.debug("Generated savings summary")
        return summary
    
    def generate_cost_breakdown_json(self, estimate: CostEstimate) -> str:
        """
        Generate a JSON cost breakdown report.
        
        Args:
            estimate: Cost estimate to report
            
        Returns:
            JSON string
        """
        report = estimate.to_dict()
        json_str = json.dumps(report, indent=2)
        logger.debug("Generated cost breakdown JSON report")
        return json_str
    
    def generate_comparison_json(self, comparison: CostComparison) -> str:
        """
        Generate a JSON cost comparison report.
        
        Args:
            comparison: Cost comparison to report
            
        Returns:
            JSON string
        """
        report = comparison.to_dict()
        json_str = json.dumps(report, indent=2)
        logger.debug("Generated cost comparison JSON report")
        return json_str
    
    def print_cost_breakdown(self, estimate: CostEstimate):
        """
        Print cost breakdown to console.
        
        Args:
            estimate: Cost estimate to print
        """
        print("\n" + self.generate_cost_breakdown_text(estimate))
    
    def print_cost_comparison(self, comparison: CostComparison):
        """
        Print cost comparison to console.
        
        Args:
            comparison: Cost comparison to print
        """
        print("\n" + self.generate_comparison_text(comparison))
    
    def print_savings_summary(self, comparison: CostComparison):
        """
        Print savings summary to console.
        
        Args:
            comparison: Cost comparison to print
        """
        print("\n" + self.generate_savings_summary(comparison))
    
    def save_report(
        self,
        content: str,
        filename: str,
        output_dir: str = "logs/cost-reports"
    ) -> str:
        """
        Save a report to a file.
        
        Args:
            content: Report content
            filename: Filename (without path)
            output_dir: Output directory
            
        Returns:
            Path to saved file
        """
        from pathlib import Path
        
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        filepath = output_path / filename
        
        try:
            with open(filepath, 'w') as f:
                f.write(content)
            
            logger.info(f"Saved cost report to: {filepath}")
            return str(filepath)
        except Exception as e:
            logger.error(f"Failed to save cost report: {e}")
            raise
    
    def generate_recommendations(
        self,
        estimate: CostEstimate,
        idle_threshold: float = 0.10
    ) -> List[str]:
        """
        Generate cost optimization recommendations.
        
        Args:
            estimate: Current cost estimate
            idle_threshold: Threshold for considering a service "idle" (monthly cost)
            
        Returns:
            List of recommendation strings
        """
        recommendations = []
        
        for service in estimate.service_breakdown:
            service_name = service.service_name
            monthly_cost = service.monthly_cost
            details = service.details
            
            # Kinesis recommendations
            if service_name == 'Kinesis Data Streams':
                shard_count = details.get('shard_count', 0)
                if shard_count > 1 and monthly_cost < idle_threshold:
                    recommendations.append(
                        f"Consider reducing Kinesis shards from {shard_count} to 1 "
                        f"to save ~${monthly_cost * 0.5:.2f}/month"
                    )
            
            # Lambda recommendations
            elif service_name == 'Lambda':
                reserved_concurrency = details.get('reserved_concurrency', None)
                if reserved_concurrency and reserved_concurrency > 0:
                    recommendations.append(
                        f"Lambda has reserved concurrency of {reserved_concurrency}. "
                        f"Set to 0 when not in use to prevent invocations."
                    )
            
            # CloudWatch recommendations
            elif service_name == 'CloudWatch':
                alarms_enabled = details.get('alarms_enabled', True)
                alarm_count = details.get('alarm_count', 0)
                if alarms_enabled and alarm_count > 0:
                    alarm_cost = details.get('alarm_cost_monthly', 0)
                    recommendations.append(
                        f"Disable {alarm_count} CloudWatch alarms when not monitoring "
                        f"to save ${alarm_cost:.2f}/month"
                    )
            
            # SageMaker recommendations
            elif service_name == 'SageMaker':
                endpoint_count = details.get('endpoint_count', 0)
                if endpoint_count > 0 and monthly_cost > 0:
                    recommendations.append(
                        f"Delete {endpoint_count} SageMaker endpoint(s) when not in use "
                        f"to save ${monthly_cost:.2f}/month"
                    )
            
            # DynamoDB recommendations
            elif service_name == 'DynamoDB':
                billing_mode = details.get('billing_mode', 'PAY_PER_REQUEST')
                if billing_mode == 'PROVISIONED':
                    recommendations.append(
                        f"DynamoDB is in PROVISIONED mode. Consider switching to "
                        f"PAY_PER_REQUEST for variable workloads to reduce idle costs."
                    )
        
        # General recommendation if total cost is significant
        if estimate.monthly_cost > 10:
            recommendations.append(
                f"Total monthly cost is ${estimate.monthly_cost:.2f}. "
                f"Use the stop command to reduce costs to near-zero when not in use."
            )
        
        logger.debug(f"Generated {len(recommendations)} cost optimization recommendations")
        return recommendations
    
    def print_recommendations(self, recommendations: List[str]):
        """
        Print cost optimization recommendations to console.
        
        Args:
            recommendations: List of recommendations
        """
        if not recommendations:
            print("\n✓ No cost optimization recommendations at this time.")
            return
        
        print("\n" + "=" * 80)
        print("💡 COST OPTIMIZATION RECOMMENDATIONS")
        print("=" * 80)
        
        for i, rec in enumerate(recommendations, 1):
            print(f"\n{i}. {rec}")
        
        print("\n" + "=" * 80)
