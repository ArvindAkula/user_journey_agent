# Terraform Deployment Scripts

This directory contains comprehensive scripts for managing Terraform deployments of the User Journey Analytics Agent infrastructure.

## Scripts Overview

### Core Deployment Scripts

#### `deploy-infrastructure.sh`
Enhanced deployment script with comprehensive validation and error handling.

```bash
# Basic usage
./deploy-infrastructure.sh <environment> [plan|apply|destroy]

# With options
./deploy-infrastructure.sh prod apply --auto-approve --verbose

# Validation only
./deploy-infrastructure.sh dev plan --validate-only
```

**Features:**
- Pre-deployment validation checks
- Automatic backend configuration validation
- Comprehensive logging
- Plan file management
- Error handling and rollback support

#### `validate-terraform.sh`
Comprehensive validation script for Terraform configurations.

```bash
# Validate all environments
./validate-terraform.sh all

# Validate specific environment
./validate-terraform.sh prod

# Fix formatting issues
./validate-terraform.sh dev --fix --verbose
```

**Validations:**
- Terraform syntax and formatting
- Required files and module structure
- Environment configurations
- Security best practices
- Resource naming conventions
- Tagging compliance

#### `manage-state.sh`
State management script for backup, restore, and maintenance operations.

```bash
# Setup backend
./manage-state.sh setup-backend prod

# Backup state
./manage-state.sh backup-state prod

# Restore from backup
./manage-state.sh restore-state prod backup_20241214_120000

# Show state info
./manage-state.sh show-state dev

# Validate state consistency
./manage-state.sh validate-state prod
```

**Features:**
- Automated backend setup
- State backup and restore
- State validation and consistency checks
- Lock management
- S3 and local backup support

#### `test-terraform.sh`
Comprehensive testing framework for Terraform configurations.

```bash
# Run all tests
./test-terraform.sh all dev

# Run specific test types
./test-terraform.sh unit
./test-terraform.sh security
./test-terraform.sh integration dev

# Parallel execution
./test-terraform.sh all dev --parallel --verbose
```

**Test Types:**
- **Unit Tests**: Syntax, validation, structure
- **Integration Tests**: Backend, initialization, planning
- **Security Tests**: Hardcoded secrets, encryption, IAM
- **Performance Tests**: Plan execution time, configuration size
- **Compliance Tests**: Tagging, naming conventions, documentation

#### `validate-deployment.sh`
Pre and post-deployment validation script.

```bash
# Pre-deployment validation
./validate-deployment.sh prod

# Post-deployment validation
./validate-deployment.sh prod --post-deploy --verbose
```

**Validations:**
- Prerequisites and credentials
- Backend setup and accessibility
- Terraform configuration validity
- AWS permissions
- Deployed resource verification
- Resource connectivity testing
- Monitoring setup validation

## Usage Workflows

### Initial Setup

1. **Setup Backend Infrastructure**
   ```bash
   ./manage-state.sh setup-backend prod
   ```

2. **Validate Configuration**
   ```bash
   ./validate-terraform.sh prod
   ```

3. **Run Tests**
   ```bash
   ./test-terraform.sh all prod
   ```

### Standard Deployment

1. **Pre-deployment Validation**
   ```bash
   ./validate-deployment.sh prod
   ```

2. **Create and Review Plan**
   ```bash
   ./deploy-infrastructure.sh prod plan
   ```

3. **Apply Infrastructure**
   ```bash
   ./deploy-infrastructure.sh prod apply
   ```

4. **Post-deployment Validation**
   ```bash
   ./validate-deployment.sh prod --post-deploy
   ```

### Maintenance Operations

1. **Backup State Before Changes**
   ```bash
   ./manage-state.sh backup-state prod
   ```

2. **Validate State Consistency**
   ```bash
   ./manage-state.sh validate-state prod
   ```

3. **Run Security Audit**
   ```bash
   ./test-terraform.sh security prod
   ```

## Environment Configuration

### Required Files

Each environment requires:
- `environments/{env}.tfvars` - Environment-specific variables
- `environments/{env}-backend.hcl` - Backend configuration

### Backend Configuration Format

```hcl
# Production backend configuration
bucket         = "user-journey-analytics-terraform-state-prod"
key            = "prod/terraform.tfstate"
region         = "us-east-1"
encrypt        = true
dynamodb_table = "user-journey-analytics-terraform-locks-prod"
```

### Environment Variables Format

```hcl
# Production environment configuration
environment = "prod"
aws_region  = "us-east-1"

# Service configurations
dynamodb_billing_mode = "PAY_PER_REQUEST"
kinesis_shard_count   = 4
lambda_memory_size    = 1024
```

## Logging and Monitoring

### Log Files

All scripts create detailed logs in `terraform/logs/`:
- `deploy_{environment}_{timestamp}.log` - Deployment logs
- `validate_{timestamp}.log` - Validation logs
- `test_{timestamp}.log` - Test execution logs
- `state_management_{timestamp}.log` - State operation logs

### Log Levels

- **INFO**: General information and progress
- **WARN**: Warnings that don't stop execution
- **ERROR**: Errors that require attention
- **PASS/FAIL**: Test results

## Error Handling

### Common Issues and Solutions

1. **Backend Not Configured**
   ```bash
   # Solution: Setup backend first
   ./manage-state.sh setup-backend <environment>
   ```

2. **State Lock Issues**
   ```bash
   # Solution: Force unlock (use carefully)
   ./manage-state.sh unlock-state <environment>
   ```

3. **Configuration Validation Errors**
   ```bash
   # Solution: Run validation with fix option
   ./validate-terraform.sh <environment> --fix
   ```

4. **AWS Permission Issues**
   ```bash
   # Check AWS credentials and permissions
   aws sts get-caller-identity
   aws iam get-user
   ```

### Recovery Procedures

1. **Restore from Backup**
   ```bash
   ./manage-state.sh list-backups prod
   ./manage-state.sh restore-state prod <backup_name>
   ```

2. **Rollback Deployment**
   ```bash
   # Use previous plan or destroy and redeploy
   ./deploy-infrastructure.sh prod destroy --auto-approve
   ```

## Security Considerations

### Sensitive Data Handling

- Never commit `.tfvars` files with sensitive data
- Use environment variables for secrets
- Enable S3 bucket encryption for state files
- Use DynamoDB encryption for state locks

### Access Control

- Use IAM roles with least privilege
- Enable MFA for production deployments
- Audit access to state files regularly
- Monitor Terraform operations via CloudTrail

## Performance Optimization

### Parallel Operations

```bash
# Run tests in parallel
./test-terraform.sh all dev --parallel

# Use multiple Terraform processes (advanced)
export TF_CLI_ARGS_plan="-parallelism=10"
```

### State Management

- Keep state files small by using modules
- Use remote state for team collaboration
- Regular state cleanup and optimization
- Monitor state file size and performance

## Troubleshooting

### Debug Mode

Enable verbose logging for detailed output:
```bash
./deploy-infrastructure.sh prod plan --verbose
./validate-terraform.sh prod --verbose
```

### Common Commands

```bash
# Check Terraform version
terraform version

# Validate configuration manually
terraform validate

# Format code
terraform fmt -recursive

# Show current state
terraform show

# List resources
terraform state list
```

### Support Resources

- [Terraform Documentation](https://www.terraform.io/docs)
- [AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Project README](../../README.md)
- [Architecture Documentation](../../docs/architecture/)

## Contributing

When adding new scripts or modifying existing ones:

1. Follow the established logging patterns
2. Add comprehensive error handling
3. Include help documentation
4. Add appropriate tests
5. Update this README

### Script Template

```bash
#!/bin/bash
set -e

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/../logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_DIR/script_${TIMESTAMP}.log"
}

# Main execution
main() {
    log "INFO" "Script started"
    # Script logic here
    log "INFO" "Script completed"
}

main "$@"
```