"""
Operation audit trail for tracking all cost management operations.

Provides comprehensive logging of operations with before/after state,
duration tracking, and report generation in multiple formats.
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict, field
from enum import Enum

try:
    from .logging_config import get_logger
except ImportError:
    from logging_config import get_logger

logger = get_logger(__name__)


class OperationStatus(Enum):
    """Status of an operation."""
    STARTED = "started"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"


class OperationType(Enum):
    """Type of operation."""
    STOP = "stop"
    START = "start"
    STATUS = "status"
    UPDATE = "update"
    VALIDATE = "validate"


@dataclass
class ResourceChange:
    """Record of a resource state change."""
    resource_id: str
    resource_type: str
    action: str
    before_state: Dict[str, Any]
    after_state: Dict[str, Any]
    success: bool
    error_message: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)


@dataclass
class OperationRecord:
    """Complete record of an operation."""
    operation_id: str
    operation_type: OperationType
    status: OperationStatus
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    user: str = field(default_factory=lambda: os.getenv('USER', 'unknown'))
    hostname: str = field(default_factory=lambda: os.getenv('HOSTNAME', 'unknown'))
    dry_run: bool = False
    resources_affected: List[str] = field(default_factory=list)
    resource_changes: List[ResourceChange] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    cost_impact: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        data['operation_type'] = self.operation_type.value
        data['status'] = self.status.value
        data['start_time'] = self.start_time.isoformat()
        if self.end_time:
            data['end_time'] = self.end_time.isoformat()
        return data


class AuditTrail:
    """Manages operation audit trail with persistence."""
    
    def __init__(self, operations_dir: str = "logs/operations"):
        """
        Initialize audit trail.
        
        Args:
            operations_dir: Directory to store operation reports
        """
        self.operations_dir = Path(operations_dir)
        self.operations_dir.mkdir(parents=True, exist_ok=True)
        self.current_operation: Optional[OperationRecord] = None
        
        logger.debug(f"Audit trail initialized: {self.operations_dir}")
    
    def start_operation(
        self,
        operation_type: OperationType,
        dry_run: bool = False,
        **metadata
    ) -> str:
        """
        Start tracking a new operation.
        
        Args:
            operation_type: Type of operation
            dry_run: Whether this is a dry-run operation
            **metadata: Additional metadata to store
            
        Returns:
            Operation ID
        """
        operation_id = f"{operation_type.value}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        self.current_operation = OperationRecord(
            operation_id=operation_id,
            operation_type=operation_type,
            status=OperationStatus.STARTED,
            start_time=datetime.utcnow(),
            dry_run=dry_run,
            metadata=metadata
        )
        
        logger.info(
            f"Started operation: {operation_id} "
            f"(type: {operation_type.value}, dry_run: {dry_run})"
        )
        
        return operation_id
    
    def record_resource_change(
        self,
        resource_id: str,
        resource_type: str,
        action: str,
        before_state: Dict[str, Any],
        after_state: Dict[str, Any],
        success: bool = True,
        error_message: Optional[str] = None
    ):
        """
        Record a resource state change.
        
        Args:
            resource_id: Unique identifier for the resource
            resource_type: Type of resource (lambda, kinesis, etc.)
            action: Action performed (stop, start, update)
            before_state: State before the change
            after_state: State after the change
            success: Whether the change was successful
            error_message: Error message if change failed
        """
        if not self.current_operation:
            logger.warning("No active operation to record resource change")
            return
        
        change = ResourceChange(
            resource_id=resource_id,
            resource_type=resource_type,
            action=action,
            before_state=before_state,
            after_state=after_state,
            success=success,
            error_message=error_message
        )
        
        self.current_operation.resource_changes.append(change)
        
        if resource_id not in self.current_operation.resources_affected:
            self.current_operation.resources_affected.append(resource_id)
        
        if not success and error_message:
            self.current_operation.errors.append(
                f"{resource_id}: {error_message}"
            )
        
        logger.debug(
            f"Recorded resource change: {resource_id} ({action}) - "
            f"Success: {success}"
        )
    
    def add_error(self, error_message: str):
        """
        Add an error to the current operation.
        
        Args:
            error_message: Error message to record
        """
        if not self.current_operation:
            logger.warning("No active operation to add error")
            return
        
        self.current_operation.errors.append(error_message)
        logger.error(f"Operation error: {error_message}")
    
    def add_warning(self, warning_message: str):
        """
        Add a warning to the current operation.
        
        Args:
            warning_message: Warning message to record
        """
        if not self.current_operation:
            logger.warning("No active operation to add warning")
            return
        
        self.current_operation.warnings.append(warning_message)
        logger.warning(f"Operation warning: {warning_message}")
    
    def set_cost_impact(self, cost_impact: float):
        """
        Set the cost impact of the operation.
        
        Args:
            cost_impact: Estimated cost impact (positive for savings, negative for costs)
        """
        if not self.current_operation:
            logger.warning("No active operation to set cost impact")
            return
        
        self.current_operation.cost_impact = cost_impact
        logger.info(f"Cost impact: ${abs(cost_impact):.2f} {'saved' if cost_impact > 0 else 'added'}")
    
    def complete_operation(self, success: bool = True) -> OperationRecord:
        """
        Complete the current operation and generate reports.
        
        Args:
            success: Whether the operation completed successfully
            
        Returns:
            The completed operation record
        """
        if not self.current_operation:
            raise ValueError("No active operation to complete")
        
        self.current_operation.end_time = datetime.utcnow()
        self.current_operation.duration_seconds = (
            self.current_operation.end_time - self.current_operation.start_time
        ).total_seconds()
        
        # Determine final status
        if not success or self.current_operation.errors:
            if self.current_operation.resource_changes:
                # Some resources succeeded
                self.current_operation.status = OperationStatus.PARTIAL
            else:
                self.current_operation.status = OperationStatus.FAILED
        else:
            self.current_operation.status = OperationStatus.SUCCESS
        
        logger.info(
            f"Completed operation: {self.current_operation.operation_id} "
            f"(status: {self.current_operation.status.value}, "
            f"duration: {self.current_operation.duration_seconds:.2f}s)"
        )
        
        # Save reports
        self._save_json_report()
        self._save_text_report()
        
        completed_operation = self.current_operation
        self.current_operation = None
        
        return completed_operation
    
    def _save_json_report(self):
        """Save operation report in JSON format."""
        if not self.current_operation:
            return
        
        filename = f"{self.current_operation.operation_id}.json"
        filepath = self.operations_dir / filename
        
        try:
            with open(filepath, 'w') as f:
                json.dump(self.current_operation.to_dict(), f, indent=2)
            
            logger.debug(f"Saved JSON report: {filepath}")
        except Exception as e:
            logger.error(f"Failed to save JSON report: {e}")
    
    def _save_text_report(self):
        """Save operation report in human-readable text format."""
        if not self.current_operation:
            return
        
        filename = f"{self.current_operation.operation_id}.txt"
        filepath = self.operations_dir / filename
        
        try:
            with open(filepath, 'w') as f:
                self._write_text_report(f)
            
            logger.debug(f"Saved text report: {filepath}")
        except Exception as e:
            logger.error(f"Failed to save text report: {e}")
    
    def _write_text_report(self, file):
        """Write human-readable report to file."""
        op = self.current_operation
        
        file.write("=" * 80 + "\n")
        file.write("AWS COST MANAGEMENT OPERATION REPORT\n")
        file.write("=" * 80 + "\n\n")
        
        # Operation details
        file.write(f"Operation ID:   {op.operation_id}\n")
        file.write(f"Operation Type: {op.operation_type.value.upper()}\n")
        file.write(f"Status:         {op.status.value.upper()}\n")
        file.write(f"Dry Run:        {'Yes' if op.dry_run else 'No'}\n")
        file.write(f"User:           {op.user}@{op.hostname}\n")
        file.write(f"Start Time:     {op.start_time.strftime('%Y-%m-%d %H:%M:%S UTC')}\n")
        
        if op.end_time:
            file.write(f"End Time:       {op.end_time.strftime('%Y-%m-%d %H:%M:%S UTC')}\n")
            file.write(f"Duration:       {op.duration_seconds:.2f} seconds\n")
        
        file.write("\n")
        
        # Cost impact
        if op.cost_impact is not None:
            file.write("-" * 80 + "\n")
            file.write("COST IMPACT\n")
            file.write("-" * 80 + "\n")
            if op.cost_impact > 0:
                file.write(f"Estimated Savings: ${op.cost_impact:.2f}\n")
            elif op.cost_impact < 0:
                file.write(f"Estimated Cost:    ${abs(op.cost_impact):.2f}\n")
            else:
                file.write("No cost impact\n")
            file.write("\n")
        
        # Resources affected
        file.write("-" * 80 + "\n")
        file.write("RESOURCES AFFECTED\n")
        file.write("-" * 80 + "\n")
        if op.resources_affected:
            for i, resource in enumerate(op.resources_affected, 1):
                file.write(f"{i}. {resource}\n")
        else:
            file.write("No resources affected\n")
        file.write("\n")
        
        # Resource changes
        if op.resource_changes:
            file.write("-" * 80 + "\n")
            file.write("RESOURCE CHANGES\n")
            file.write("-" * 80 + "\n")
            for change in op.resource_changes:
                status_icon = "✓" if change.success else "✗"
                file.write(f"\n{status_icon} {change.resource_id} ({change.resource_type})\n")
                file.write(f"  Action:    {change.action}\n")
                file.write(f"  Timestamp: {change.timestamp}\n")
                
                if not change.success and change.error_message:
                    file.write(f"  Error:     {change.error_message}\n")
                
                # Show key state changes
                if change.before_state != change.after_state:
                    file.write(f"  Before:    {json.dumps(change.before_state, indent=13)[13:]}\n")
                    file.write(f"  After:     {json.dumps(change.after_state, indent=13)[13:]}\n")
            file.write("\n")
        
        # Errors
        if op.errors:
            file.write("-" * 80 + "\n")
            file.write("ERRORS\n")
            file.write("-" * 80 + "\n")
            for i, error in enumerate(op.errors, 1):
                file.write(f"{i}. {error}\n")
            file.write("\n")
        
        # Warnings
        if op.warnings:
            file.write("-" * 80 + "\n")
            file.write("WARNINGS\n")
            file.write("-" * 80 + "\n")
            for i, warning in enumerate(op.warnings, 1):
                file.write(f"{i}. {warning}\n")
            file.write("\n")
        
        # Metadata
        if op.metadata:
            file.write("-" * 80 + "\n")
            file.write("METADATA\n")
            file.write("-" * 80 + "\n")
            for key, value in op.metadata.items():
                file.write(f"{key}: {value}\n")
            file.write("\n")
        
        file.write("=" * 80 + "\n")
    
    def get_operation_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent operation history.
        
        Args:
            limit: Maximum number of operations to return
            
        Returns:
            List of operation records (most recent first)
        """
        json_files = sorted(
            self.operations_dir.glob("*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True
        )
        
        operations = []
        for json_file in json_files[:limit]:
            try:
                with open(json_file, 'r') as f:
                    operations.append(json.load(f))
            except Exception as e:
                logger.warning(f"Failed to read operation file {json_file}: {e}")
        
        return operations
    
    def print_summary(self):
        """Print a summary of the current operation to console."""
        if not self.current_operation:
            print("No active operation")
            return
        
        op = self.current_operation
        
        print("\n" + "=" * 80)
        print("OPERATION SUMMARY")
        print("=" * 80)
        print(f"Operation: {op.operation_type.value.upper()}")
        print(f"Status:    {op.status.value.upper()}")
        
        if op.dry_run:
            print("Mode:      DRY RUN (no changes made)")
        
        if op.resources_affected:
            print(f"Resources: {len(op.resources_affected)} affected")
        
        if op.cost_impact is not None:
            if op.cost_impact > 0:
                print(f"Savings:   ${op.cost_impact:.2f}")
            elif op.cost_impact < 0:
                print(f"Cost:      ${abs(op.cost_impact):.2f}")
        
        if op.errors:
            print(f"Errors:    {len(op.errors)}")
        
        if op.warnings:
            print(f"Warnings:  {len(op.warnings)}")
        
        print("=" * 80 + "\n")
