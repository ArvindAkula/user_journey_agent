"""
Dry-run reporting module for displaying simulation results.

Provides formatted reports showing what changes would be made,
cost impacts, and potential issues in both text and JSON formats.
"""

import json
from typing import List, Dict, Any
from datetime import datetime

try:
    from .dry_run import DryRunResult, ResourceChange, RiskLevel, ChangeType
    from .logging_config import get_logger
except ImportError:
    from dry_run import DryRunResult, ResourceChange, RiskLevel, ChangeType
    from logging_config import get_logger

logger = get_logger(__name__)


class DryRunReporter:
    """Generate dry-run reports in various formats."""
    
    # Color codes for terminal output
    COLORS = {
        'red': '\033[0;31m',
        'green': '\033[0;32m',
        'yellow': '\033[1;33m',
        'blue': '\033[0;34m',
        'magenta': '\033[0;35m',
        'cyan': '\033[0;36m',
        'white': '\033[1;37m',
        'reset': '\033[0m'
    }
    
    # Risk level colors
    RISK_COLORS = {
        RiskLevel.LOW: 'green',
        RiskLevel.MEDIUM: 'yellow',
        RiskLevel.HIGH: 'magenta',
        RiskLevel.CRITICAL: 'red'
    }
    
    # Change type symbols
    CHANGE_SYMBOLS = {
        ChangeType.CREATE: '➕',
        ChangeType.UPDATE: '🔄',
        ChangeType.DELETE: '🗑️',
        ChangeType.ENABLE: '✅',
        ChangeType.DISABLE: '⏸️',
        ChangeType.SCALE_UP: '📈',
        ChangeType.SCALE_DOWN: '📉'
    }
    
    def __init__(self, use_colors: bool = True):
        """
        Initialize dry-run reporter.
        
        Args:
            use_colors: Whether to use colored output
        """
        self.use_colors = use_colors
        logger.debug("Dry-run reporter initialized")
    
    def _colorize(self, text: str, color: str) -> str:
        """
        Colorize text for terminal output.
        
        Args:
            text: Text to colorize
            color: Color name
            
        Returns:
            Colorized text (or plain text if colors disabled)
        """
        if not self.use_colors:
            return text
        
        color_code = self.COLORS.get(color, '')
        reset_code = self.COLORS['reset']
        return f"{color_code}{text}{reset_code}"
    
    def generate_text_report(self, result: DryRunResult) -> str:
        """
        Generate a text-based dry-run report.
        
        Args:
            result: Dry-run result to report
            
        Returns:
            Formatted text report
        """
        lines = []
        
        # Header
        lines.append("=" * 80)
        lines.append(self._colorize("DRY RUN SIMULATION REPORT", 'cyan'))
        lines.append("=" * 80)
        lines.append(f"Operation:  {result.operation.upper()}")
        lines.append(f"Timestamp:  {result.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        lines.append(f"Mode:       {self._colorize('SIMULATION ONLY - NO CHANGES WILL BE MADE', 'yellow')}")
        lines.append("")
        
        # Errors (if any)
        if result.errors:
            lines.append(self._colorize("❌ ERRORS DETECTED", 'red'))
            lines.append("-" * 80)
            for i, error in enumerate(result.errors, 1):
                lines.append(f"{i}. {error}")
            lines.append("")
            lines.append(self._colorize(
                "⚠️  Operation cannot proceed due to errors above",
                'red'
            ))
            lines.append("=" * 80)
            return "\n".join(lines)
        
        # Warnings (if any)
        if result.warnings:
            lines.append(self._colorize("⚠️  WARNINGS", 'yellow'))
            lines.append("-" * 80)
            for i, warning in enumerate(result.warnings, 1):
                lines.append(f"{i}. {warning}")
            lines.append("")
        
        # Summary
        lines.append("-" * 80)
        lines.append("SUMMARY")
        lines.append("-" * 80)
        lines.append(f"Total changes:      {len(result.changes)}")
        lines.append(f"High-risk changes:  {len(result.high_risk_changes)}")
        
        if result.total_cost_impact > 0:
            lines.append(
                f"Cost impact:        {self._colorize(f'+${result.total_cost_impact:.2f}/month (savings)', 'green')}"
            )
        elif result.total_cost_impact < 0:
            lines.append(
                f"Cost impact:        {self._colorize(f'${abs(result.total_cost_impact):.2f}/month (cost increase)', 'red')}"
            )
        else:
            lines.append("Cost impact:        $0.00/month (no change)")
        
        lines.append("")
        
        # Cost comparison
        if result.current_estimate and result.proposed_estimate:
            lines.append("-" * 80)
            lines.append("COST COMPARISON")
            lines.append("-" * 80)
            lines.append(f"Current monthly cost:   ${result.current_estimate.monthly_cost:>10.2f}")
            lines.append(f"Proposed monthly cost:  ${result.proposed_estimate.monthly_cost:>10.2f}")
            lines.append(f"Difference:             ${abs(result.total_cost_impact):>10.2f}")
            lines.append("")
        
        # Changes by resource type
        if result.changes:
            lines.append("-" * 80)
            lines.append("PROPOSED CHANGES")
            lines.append("-" * 80)
            
            # Group changes by resource type
            changes_by_type = {}
            for change in result.changes:
                resource_type = change.resource_type
                if resource_type not in changes_by_type:
                    changes_by_type[resource_type] = []
                changes_by_type[resource_type].append(change)
            
            # Display each resource type
            for resource_type, changes in sorted(changes_by_type.items()):
                lines.append(f"\n{resource_type.upper().replace('_', ' ')}:")
                lines.append("-" * 40)
                
                for change in changes:
                    self._add_change_details(lines, change)
        
        # High-risk changes warning
        if result.high_risk_changes:
            lines.append("")
            lines.append(self._colorize("⚠️  HIGH-RISK CHANGES DETECTED", 'red'))
            lines.append("-" * 80)
            lines.append("The following changes have been identified as high or critical risk:")
            for change in result.high_risk_changes:
                risk_color = self.RISK_COLORS[change.risk_level]
                lines.append(
                    f"  • {change.resource_id} ({change.resource_type}) - "
                    f"{self._colorize(change.risk_level.value.upper(), risk_color)}"
                )
            lines.append("")
        
        # Footer
        lines.append("=" * 80)
        if result.has_errors:
            lines.append(self._colorize(
                "❌ Cannot proceed: Please fix errors above",
                'red'
            ))
        elif result.high_risk_changes:
            lines.append(self._colorize(
                "⚠️  Review high-risk changes carefully before proceeding",
                'yellow'
            ))
        else:
            lines.append(self._colorize(
                "✓ No issues detected - safe to proceed",
                'green'
            ))
        lines.append("=" * 80)
        
        report = "\n".join(lines)
        logger.debug("Generated dry-run text report")
        return report
    
    def _add_change_details(self, lines: List[str], change: ResourceChange):
        """Add detailed change information to report."""
        # Change header
        symbol = self.CHANGE_SYMBOLS.get(change.change_type, '•')
        risk_color = self.RISK_COLORS[change.risk_level]
        
        lines.append(f"\n{symbol} {change.resource_id}")
        lines.append(f"  Action:      {change.change_type.value.replace('_', ' ').title()}")
        lines.append(f"  Risk Level:  {self._colorize(change.risk_level.value.upper(), risk_color)}")
        
        # Cost impact
        if change.cost_impact > 0:
            lines.append(f"  Cost Impact: {self._colorize(f'+${change.cost_impact:.2f}/month', 'green')}")
        elif change.cost_impact < 0:
            lines.append(f"  Cost Impact: {self._colorize(f'${abs(change.cost_impact):.2f}/month', 'red')}")
        else:
            lines.append(f"  Cost Impact: $0.00/month")
        
        # State changes
        if change.current_state != change.proposed_state:
            lines.append(f"  Current:     {self._format_state(change.current_state)}")
            lines.append(f"  Proposed:    {self._format_state(change.proposed_state)}")
        
        # Warnings
        if change.warnings:
            lines.append(f"  Warnings:")
            for warning in change.warnings:
                lines.append(f"    - {self._colorize(warning, 'yellow')}")
        
        # Dependencies
        if change.dependencies:
            lines.append(f"  Dependencies: {', '.join(change.dependencies)}")
    
    def _format_state(self, state: Dict[str, Any]) -> str:
        """Format state dictionary for display."""
        if not state:
            return "N/A"
        
        # Format key-value pairs
        parts = []
        for key, value in state.items():
            if isinstance(value, bool):
                value = "enabled" if value else "disabled"
            parts.append(f"{key}={value}")
        
        return ", ".join(parts)
    
    def generate_json_report(self, result: DryRunResult) -> str:
        """
        Generate a JSON dry-run report.
        
        Args:
            result: Dry-run result to report
            
        Returns:
            JSON string
        """
        report = result.to_dict()
        json_str = json.dumps(report, indent=2)
        logger.debug("Generated dry-run JSON report")
        return json_str
    
    def generate_summary(self, result: DryRunResult) -> str:
        """
        Generate a brief summary of the dry-run.
        
        Args:
            result: Dry-run result
            
        Returns:
            Brief summary text
        """
        lines = []
        
        if result.has_errors:
            lines.append(self._colorize("❌ DRY RUN FAILED", 'red'))
            lines.append(f"   {len(result.errors)} error(s) detected")
        else:
            lines.append(self._colorize("✓ DRY RUN SUCCESSFUL", 'green'))
            lines.append(f"   {len(result.changes)} change(s) would be made")
            
            if result.total_cost_impact > 0:
                lines.append(
                    f"   {self._colorize(f'${result.total_cost_impact:.2f}/month savings', 'green')}"
                )
            elif result.total_cost_impact < 0:
                lines.append(
                    f"   {self._colorize(f'${abs(result.total_cost_impact):.2f}/month cost increase', 'red')}"
                )
            
            if result.high_risk_changes:
                lines.append(
                    f"   {self._colorize(f'{len(result.high_risk_changes)} high-risk change(s)', 'yellow')}"
                )
        
        summary = "\n".join(lines)
        logger.debug("Generated dry-run summary")
        return summary
    
    def print_report(self, result: DryRunResult):
        """
        Print dry-run report to console.
        
        Args:
            result: Dry-run result to print
        """
        print("\n" + self.generate_text_report(result))
    
    def print_summary(self, result: DryRunResult):
        """
        Print dry-run summary to console.
        
        Args:
            result: Dry-run result to print
        """
        print("\n" + self.generate_summary(result))
    
    def save_report(
        self,
        result: DryRunResult,
        output_dir: str = "logs/dry-run-reports"
    ) -> Dict[str, str]:
        """
        Save dry-run report to files.
        
        Args:
            result: Dry-run result to save
            output_dir: Output directory
            
        Returns:
            Dictionary with paths to saved files
        """
        from pathlib import Path
        
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        timestamp = result.timestamp.strftime('%Y%m%d_%H%M%S')
        base_filename = f"dry_run_{result.operation}_{timestamp}"
        
        saved_files = {}
        
        # Save text report
        text_file = output_path / f"{base_filename}.txt"
        try:
            with open(text_file, 'w') as f:
                # Disable colors for file output
                original_colors = self.use_colors
                self.use_colors = False
                f.write(self.generate_text_report(result))
                self.use_colors = original_colors
            
            saved_files['text'] = str(text_file)
            logger.info(f"Saved text report to: {text_file}")
        except Exception as e:
            logger.error(f"Failed to save text report: {e}")
        
        # Save JSON report
        json_file = output_path / f"{base_filename}.json"
        try:
            with open(json_file, 'w') as f:
                f.write(self.generate_json_report(result))
            
            saved_files['json'] = str(json_file)
            logger.info(f"Saved JSON report to: {json_file}")
        except Exception as e:
            logger.error(f"Failed to save JSON report: {e}")
        
        return saved_files
    
    def generate_change_table(self, changes: List[ResourceChange]) -> str:
        """
        Generate a table of changes.
        
        Args:
            changes: List of resource changes
            
        Returns:
            Formatted table string
        """
        if not changes:
            return "No changes"
        
        lines = []
        lines.append(f"{'Resource':<30} {'Type':<20} {'Action':<15} {'Cost Impact':<15} {'Risk':<10}")
        lines.append("-" * 90)
        
        for change in changes:
            cost_str = f"${abs(change.cost_impact):.2f}"
            if change.cost_impact > 0:
                cost_str = f"+{cost_str}"
            elif change.cost_impact < 0:
                cost_str = f"-{cost_str}"
            
            lines.append(
                f"{change.resource_id[:29]:<30} "
                f"{change.resource_type[:19]:<20} "
                f"{change.change_type.value[:14]:<15} "
                f"{cost_str:<15} "
                f"{change.risk_level.value:<10}"
            )
        
        return "\n".join(lines)
