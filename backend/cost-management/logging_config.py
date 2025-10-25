"""
Logging configuration for the AWS Cost Management System.

Provides dual-output logging:
- Console output at INFO level for user feedback
- File output at DEBUG level for detailed troubleshooting
"""

import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional


class ColoredFormatter(logging.Formatter):
    """Custom formatter with color support for console output."""
    
    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[35m',   # Magenta
        'RESET': '\033[0m'        # Reset
    }
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record with colors for console output."""
        # Add color to level name
        if record.levelname in self.COLORS:
            record.levelname = (
                f"{self.COLORS[record.levelname]}"
                f"{record.levelname}"
                f"{self.COLORS['RESET']}"
            )
        
        return super().format(record)


class UserInfoFilter(logging.Filter):
    """Filter to add user and system information to log records."""
    
    def __init__(self):
        super().__init__()
        self.username = os.getenv('USER', 'unknown')
        self.hostname = os.getenv('HOSTNAME', 'unknown')
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Add user information to the log record."""
        record.username = self.username
        record.hostname = self.hostname
        return True


def setup_logging(
    log_file: Optional[str] = None,
    console_level: int = logging.INFO,
    file_level: int = logging.DEBUG,
    log_dir: str = "logs"
) -> logging.Logger:
    """
    Configure logging for the cost management system.
    
    Args:
        log_file: Path to log file (default: logs/aws-resource-manager.log)
        console_level: Logging level for console output (default: INFO)
        file_level: Logging level for file output (default: DEBUG)
        log_dir: Directory for log files (default: logs)
        
    Returns:
        Configured logger instance
    """
    # Create logs directory if it doesn't exist
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)
    
    # Default log file path
    if log_file is None:
        log_file = log_path / "aws-resource-manager.log"
    else:
        log_file = Path(log_file)
    
    # Create root logger
    logger = logging.getLogger('cost_management')
    logger.setLevel(logging.DEBUG)  # Capture all levels
    
    # Remove existing handlers to avoid duplicates
    logger.handlers.clear()
    
    # Console handler with INFO level and colors
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(console_level)
    
    console_format = '%(levelname)s - %(message)s'
    console_formatter = ColoredFormatter(console_format)
    console_handler.setFormatter(console_formatter)
    
    # File handler with DEBUG level and detailed format
    file_handler = logging.FileHandler(log_file, mode='a', encoding='utf-8')
    file_handler.setLevel(file_level)
    
    file_format = (
        '%(asctime)s - %(username)s@%(hostname)s - '
        '%(name)s - %(levelname)s - '
        '%(funcName)s:%(lineno)d - %(message)s'
    )
    file_formatter = logging.Formatter(file_format, datefmt='%Y-%m-%d %H:%M:%S')
    file_handler.setFormatter(file_formatter)
    
    # Add user info filter to file handler
    user_filter = UserInfoFilter()
    file_handler.addFilter(user_filter)
    
    # Add handlers to logger
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    
    # Log startup message
    logger.info("=" * 80)
    logger.info(f"AWS Cost Management System - Logging initialized")
    logger.info(f"Log file: {log_file}")
    logger.info(f"Console level: {logging.getLevelName(console_level)}")
    logger.info(f"File level: {logging.getLevelName(file_level)}")
    logger.info("=" * 80)
    
    return logger


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance for a specific module.
    
    Args:
        name: Module name (typically __name__)
        
    Returns:
        Logger instance
    """
    return logging.getLogger(f'cost_management.{name}')


class OperationLogger:
    """Context manager for logging operations with timing."""
    
    def __init__(self, logger: logging.Logger, operation: str, **context):
        """
        Initialize operation logger.
        
        Args:
            logger: Logger instance to use
            operation: Name of the operation
            **context: Additional context to log
        """
        self.logger = logger
        self.operation = operation
        self.context = context
        self.start_time = None
    
    def __enter__(self):
        """Start operation logging."""
        self.start_time = datetime.now()
        
        context_str = ", ".join(f"{k}={v}" for k, v in self.context.items())
        log_msg = f"Starting operation: {self.operation}"
        if context_str:
            log_msg += f" ({context_str})"
        
        self.logger.info(log_msg)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Complete operation logging with duration."""
        duration = (datetime.now() - self.start_time).total_seconds()
        
        if exc_type is None:
            self.logger.info(
                f"Completed operation: {self.operation} "
                f"(duration: {duration:.2f}s)"
            )
        else:
            self.logger.error(
                f"Failed operation: {self.operation} "
                f"(duration: {duration:.2f}s, error: {exc_val})"
            )
        
        # Don't suppress exceptions
        return False


def log_operation_start(logger: logging.Logger, operation: str, **details):
    """
    Log the start of an operation with details.
    
    Args:
        logger: Logger instance
        operation: Operation name
        **details: Operation details to log
    """
    details_str = ", ".join(f"{k}={v}" for k, v in details.items())
    logger.info(f"▶ Starting: {operation} | {details_str}")


def log_operation_success(logger: logging.Logger, operation: str, **details):
    """
    Log successful completion of an operation.
    
    Args:
        logger: Logger instance
        operation: Operation name
        **details: Operation details to log
    """
    details_str = ", ".join(f"{k}={v}" for k, v in details.items())
    logger.info(f"✓ Success: {operation} | {details_str}")


def log_operation_failure(logger: logging.Logger, operation: str, error: Exception, **details):
    """
    Log failure of an operation.
    
    Args:
        logger: Logger instance
        operation: Operation name
        error: Exception that caused the failure
        **details: Operation details to log
    """
    details_str = ", ".join(f"{k}={v}" for k, v in details.items())
    logger.error(f"✗ Failed: {operation} | {details_str} | Error: {error}")


def log_resource_change(logger: logging.Logger, resource: str, action: str, 
                        before: dict, after: dict):
    """
    Log a resource state change.
    
    Args:
        logger: Logger instance
        resource: Resource identifier
        action: Action performed (stop, start, update)
        before: State before change
        after: State after change
    """
    logger.info(f"Resource change: {resource}")
    logger.info(f"  Action: {action}")
    logger.debug(f"  Before: {before}")
    logger.debug(f"  After: {after}")
