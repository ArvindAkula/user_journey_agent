#!/usr/bin/env python3
"""
CLI integration for dry-run mode.

This script is called by the bash script to perform dry-run simulations.
"""

import sys
import json
import argparse
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from dry_run import DryRunSimulator
from dry_run_reporter import DryRunReporter
from logging_config import setup_logging, get_logger


def load_current_resources(resources_file: str) -> dict:
    """
    Load current resources from JSON file.
    
    Args:
        resources_file: Path to resources JSON file
        
    Returns:
        Dictionary of current resources
    """
    try:
        with open(resources_file, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError as e:
        print(f"Error parsing resources file: {e}", file=sys.stderr)
        return {}


def load_saved_state(state_file: str) -> dict:
    """
    Load saved state from JSON file.
    
    Args:
        state_file: Path to state JSON file
        
    Returns:
        Dictionary of saved state
    """
    try:
        with open(state_file, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: State file not found: {state_file}", file=sys.stderr)
        return {}
    except json.JSONDecodeError as e:
        print(f"Error parsing state file: {e}", file=sys.stderr)
        return {}


def simulate_stop(resources_file: str, output_format: str = 'text') -> int:
    """
    Simulate stop operation.
    
    Args:
        resources_file: Path to current resources JSON file
        output_format: Output format ('text' or 'json')
        
    Returns:
        Exit code (0 for success, 1 for errors)
    """
    # Load current resources
    current_resources = load_current_resources(resources_file)
    
    if not current_resources:
        print("Error: No resources to simulate", file=sys.stderr)
        return 1
    
    # Create simulator
    simulator = DryRunSimulator()
    
    # Simulate stop operation
    result = simulator.simulate_stop_operation(current_resources)
    
    # Create reporter
    reporter = DryRunReporter(use_colors=(output_format == 'text'))
    
    # Output results
    if output_format == 'json':
        print(reporter.generate_json_report(result))
    else:
        print(reporter.generate_text_report(result))
    
    # Return exit code based on errors
    return 1 if result.has_errors else 0


def simulate_start(state_file: str, resources_file: str, output_format: str = 'text') -> int:
    """
    Simulate start operation.
    
    Args:
        state_file: Path to saved state JSON file
        resources_file: Path to current resources JSON file
        output_format: Output format ('text' or 'json')
        
    Returns:
        Exit code (0 for success, 1 for errors)
    """
    # Load saved state
    saved_state = load_saved_state(state_file)
    
    if not saved_state:
        print("Error: No saved state to simulate", file=sys.stderr)
        return 1
    
    # Load current resources
    current_resources = load_current_resources(resources_file)
    
    # Create simulator
    simulator = DryRunSimulator()
    
    # Simulate start operation
    result = simulator.simulate_start_operation(saved_state, current_resources)
    
    # Create reporter
    reporter = DryRunReporter(use_colors=(output_format == 'text'))
    
    # Output results
    if output_format == 'json':
        print(reporter.generate_json_report(result))
    else:
        print(reporter.generate_text_report(result))
    
    # Return exit code based on errors
    return 1 if result.has_errors else 0


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Dry-run simulation for AWS resource management'
    )
    
    parser.add_argument(
        'operation',
        choices=['stop', 'start'],
        help='Operation to simulate'
    )
    
    parser.add_argument(
        '--resources',
        default='config/aws-current-resources.json',
        help='Path to current resources JSON file'
    )
    
    parser.add_argument(
        '--state',
        default='config/aws-resource-state.json',
        help='Path to saved state JSON file (for start operation)'
    )
    
    parser.add_argument(
        '--format',
        choices=['text', 'json'],
        default='text',
        help='Output format'
    )
    
    parser.add_argument(
        '--log-file',
        default='logs/aws-resource-manager.log',
        help='Log file path'
    )
    
    parser.add_argument(
        '--quiet',
        action='store_true',
        help='Suppress logging output'
    )
    
    args = parser.parse_args()
    
    # Setup logging
    if not args.quiet:
        setup_logging(log_file=args.log_file)
    
    # Run simulation
    try:
        if args.operation == 'stop':
            exit_code = simulate_stop(args.resources, args.format)
        else:  # start
            exit_code = simulate_start(args.state, args.resources, args.format)
        
        sys.exit(exit_code)
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
