# Implementation Plan

## Overview
This implementation plan creates a unified AWS resource management script that can stop/delete and start/create all AWS resources for the User Journey Analytics project to achieve zero or minimal AWS costs.

- [x] 1. Fix Terraform configuration and clean up existing resources
  - Reinitialize Terraform backend to access state
  - Import existing resources into Terraform state
  - Delete failed SageMaker endpoint
  - Verify all resources are properly managed
  - _Requirements: 1.1, 1.6, 7.1, 7.2_

- [x] 1.1 Reinitialize Terraform backend
  - Backup current Terraform state from S3
  - Run `terraform init -backend-config=backend-dev.hcl -reconfigure`
  - Verify state is accessible with `terraform state list`
  - _Requirements: 1.1, 1.6_

- [x] 1.2 Clean up failed SageMaker endpoint
  - Delete the failed endpoint: `aws sagemaker delete-endpoint --endpoint-name user-journey-analytics-exit-risk-endpoint`
  - Verify deletion completed
  - Update Terraform to not recreate it (or fix the health check issue)
  - _Requirements: 1.3, 7.1_

- [x] 1.3 Import existing resources into Terraform
  - Import Kinesis stream
  - Import DynamoDB tables
  - Import Lambda functions
  - Import CloudWatch alarms
  - Import SNS topics
  - Run `terraform plan` to verify no changes needed
  - _Requirements: 1.1, 1.6_

- [x] 2. Create resource state management module
  - Create Python module for saving and loading resource configurations
  - Implement JSON schema for resource state
  - Add S3 backup functionality
  - Add state validation
  - _Requirements: 1.6, 7.1, 7.2, 7.5_

- [x] 2.1 Create state manager Python module
  - Create `backend/cost-management/state_manager.py`
  - Implement `StateManager` class with save/load methods
  - Define JSON schema for resource state
  - Add error handling for missing or corrupted state files
  - _Requirements: 1.6, 7.5_

- [x] 2.2 Implement state persistence
  - Save state to `config/aws-resource-state.json`
  - Add optional S3 backup functionality
  - Implement state versioning
  - Add timestamp and metadata to state files
  - _Requirements: 1.6, 7.1, 7.2_

- [x] 3. Create AWS service manager modules
  - Create base service manager interface
  - Implement Kinesis manager
  - Implement Lambda manager
  - Implement CloudWatch manager
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 2.4, 2.5_

- [x] 3.1 Create base service manager interface
  - Create `backend/cost-management/service_manager.py`
  - Define abstract `ServiceManager` base class
  - Implement common methods: stop, start, get_status, estimate_cost
  - Add configuration save/restore methods
  - _Requirements: 1.1, 2.1_

- [x] 3.2 Implement Kinesis service manager
  - Create `backend/cost-management/kinesis_manager.py`
  - Implement stop: update shard count from 2 to 1
  - Implement start: restore shard count to 2
  - Implement status: get current shard count and stream state
  - Implement cost estimation: calculate based on shard hours
  - _Requirements: 1.4, 2.4, 3.1, 3.2_

- [x] 3.3 Implement Lambda service manager
  - Create `backend/cost-management/lambda_manager.py`
  - Implement stop: set reserved concurrency to 0 for event_processor and intervention-executor
  - Implement start: remove concurrency limits
  - Implement status: get concurrency settings for all Lambda functions
  - Implement cost estimation: calculate based on invocations (note: $0 when idle)
  - _Requirements: 1.2, 2.2, 3.1, 3.2_

- [x] 3.4 Implement CloudWatch service manager
  - Create `backend/cost-management/cloudwatch_manager.py`
  - Implement stop: disable all 9 CloudWatch alarms
  - Implement start: re-enable all alarms
  - Implement status: get alarm states
  - Implement cost estimation: calculate alarm costs
  - _Requirements: 1.5, 2.5, 3.1, 3.2_

- [x] 4. Create resource controller orchestration
  - Create main controller that coordinates all service managers
  - Implement stop_all_resources method
  - Implement start_all_resources method
  - Implement get_resource_status method
  - Add dry-run mode support
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 8.2, 8.3_

- [x] 4.1 Create resource controller module
  - Create `backend/cost-management/controller.py`
  - Implement `ResourceController` class
  - Initialize all service managers (Kinesis, Lambda, CloudWatch)
  - Add resource identification by project tags
  - _Requirements: 1.1, 2.1_

- [x] 4.2 Implement stop_all_resources method
  - Call stop on all service managers in correct order
  - Save resource state before stopping
  - Handle errors and continue with other resources
  - Generate operation report
  - Support dry-run mode
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 8.1, 8.2_

- [x] 4.3 Implement start_all_resources method
  - Load saved resource state
  - Call start on all service managers in correct order
  - Verify each resource is operational after starting
  - Generate operation report
  - Support dry-run mode
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 8.1, 8.2_

- [x] 4.4 Implement get_resource_status method
  - Query status from all service managers
  - Calculate total estimated costs
  - Generate status report with resource details
  - Identify idle resources
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5. Create CLI script
  - Create bash script `scripts/aws-resource-manager.sh`
  - Implement stop command
  - Implement start command
  - Implement status command
  - Add help documentation
  - _Requirements: 1.1, 2.1, 3.1, 8.1, 8.2, 10.1, 10.2, 10.5_

- [x] 5.1 Create main CLI script structure
  - Create `scripts/aws-resource-manager.sh`
  - Add command parsing (stop, start, status)
  - Add flag parsing (--dry-run, --force, --help)
  - Add configuration loading from `config/aws-resource-manager.conf`
  - Add colored output for better readability
  - _Requirements: 1.1, 2.1, 3.1_

- [x] 5.2 Implement stop command
  - Call Python controller's stop_all_resources method
  - Show confirmation prompt unless --force is used
  - Display resources that will be stopped
  - Show estimated cost savings
  - Generate and display operation report
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 8.1, 8.2_

- [x] 5.3 Implement start command
  - Call Python controller's start_all_resources method
  - Verify state file exists
  - Display resources that will be started
  - Show progress for each resource
  - Generate and display operation report
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 8.1, 8.2_

- [x] 5.4 Implement status command
  - Call Python controller's get_resource_status method
  - Display current state of all resources
  - Show estimated hourly, daily, and monthly costs
  - Highlight resources that are running but idle
  - Provide cost optimization recommendations
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5.5 Add help and documentation
  - Implement --help flag with usage examples
  - Add inline comments explaining each command
  - Create examples for common use cases
  - Document configuration options
  - _Requirements: 8.1, 10.5_

- [x] 6. Create configuration file
  - Create `config/aws-resource-manager.conf`
  - Add project identification settings
  - Add AWS configuration settings
  - Add behavior settings
  - Document all configuration options
  - _Requirements: 1.1, 1.6, 10.1_

- [x] 7. Add error handling and logging
  - Implement comprehensive error handling in all modules
  - Add retry logic for AWS API calls
  - Create logging configuration
  - Add operation audit trail
  - _Requirements: 8.4, 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 7.1 Implement error handling
  - Add try-catch blocks in all service managers
  - Implement retry logic with exponential backoff for AWS API calls
  - Handle specific AWS errors (throttling, permissions, not found)
  - Provide user-friendly error messages
  - _Requirements: 8.4, 10.3_

- [x] 7.2 Implement logging system
  - Configure Python logging to write to `logs/aws-resource-manager.log`
  - Add console output with INFO level
  - Add file output with DEBUG level
  - Include timestamps, operation details, and user information
  - _Requirements: 10.1, 10.2, 10.5_

- [x] 7.3 Create operation audit trail
  - Log all operations with before/after state
  - Record operation duration and outcome
  - Save operation reports to `logs/operations/` directory
  - Generate JSON and human-readable formats
  - _Requirements: 10.1, 10.2, 10.4, 10.5_

- [x] 8. Create cost estimation module
  - Implement cost calculation for each service
  - Create cost breakdown report
  - Add cost comparison (current vs. optimized)
  - _Requirements: 1.7, 3.2, 3.3, 8.3_

- [x] 8.1 Create cost calculator module
  - Create `backend/cost-management/cost_calculator.py`
  - Implement cost calculation for Kinesis (shard hours)
  - Implement cost calculation for Lambda (invocations, duration)
  - Implement cost calculation for CloudWatch (alarms, logs)
  - Add cost constants based on AWS pricing
  - _Requirements: 3.2, 3.3_

- [x] 8.2 Implement cost reporting
  - Generate cost breakdown by service
  - Calculate hourly, daily, and monthly estimates
  - Show cost savings from stop operation
  - Create visual cost comparison
  - _Requirements: 1.7, 3.2, 3.3, 8.3_

- [x] 9. Add dry-run mode implementation
  - Implement dry-run flag in all service managers
  - Show what would be changed without making changes
  - Display estimated cost impact
  - Identify potential errors before execution
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 10. Create documentation and examples
  - Write README for the cost management system
  - Add usage examples
  - Document configuration options
  - Create troubleshooting guide
  - _Requirements: 10.1, 10.5_

- [x] 10.1 Create README documentation
  - Create `scripts/aws-resource-manager-README.md`
  - Document installation steps
  - Provide usage examples for all commands
  - Explain configuration options
  - Add troubleshooting section
  - _Requirements: 10.1, 10.5_

- [x] 10.2 Add inline code documentation
  - Add docstrings to all Python classes and methods
  - Add comments explaining complex logic
  - Document expected inputs and outputs
  - Add type hints for better code clarity
  - _Requirements: 10.1, 10.5_

- [x] 11. Testing and validation
  - Test stop operation in dry-run mode
  - Test actual stop operation
  - Verify cost reduction
  - Test start operation
  - Verify all resources are functional after restart
  - _Requirements: 1.1, 1.7, 2.1, 2.7, 7.5, 8.1, 8.5_

- [x] 11.1 Test dry-run mode
  - Run `./scripts/aws-resource-manager.sh stop --dry-run`
  - Verify no actual changes are made
  - Verify output shows what would be changed
  - Verify cost estimates are displayed
  - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [x] 11.2 Test stop operation
  - Run `./scripts/aws-resource-manager.sh stop`
  - Verify Kinesis stream updated to 1 shard
  - Verify Lambda concurrency set to 0
  - Verify CloudWatch alarms disabled
  - Verify state file created
  - Check AWS billing after 24 hours
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 11.3 Test start operation
  - Run `./scripts/aws-resource-manager.sh start`
  - Verify Kinesis stream restored to 2 shards
  - Verify Lambda concurrency limits removed
  - Verify CloudWatch alarms re-enabled
  - Test application functionality
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.5_

- [x] 11.4 Test status command
  - Run `./scripts/aws-resource-manager.sh status`
  - Verify all resources are listed
  - Verify cost estimates are accurate
  - Verify recommendations are helpful
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
