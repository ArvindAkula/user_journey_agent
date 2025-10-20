#!/bin/bash

# Terraform state management script for User Journey Analytics Agent
# Usage: ./manage-state.sh <command> [options]

set -e

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$TERRAFORM_DIR/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Default values
COMMAND=""
ENVIRONMENT=""
VERBOSE=false

# Create logs directory
mkdir -p "$LOG_DIR"

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_DIR/state_management_${TIMESTAMP}.log"
}

# Error handling
error_exit() {
    log "ERROR" "$1"
    exit 1
}

# Help function
show_help() {
    cat << EOF
Terraform State Management Script

Usage: $0 <command> [options]

Commands:
  setup-backend <env>           Set up S3 backend and DynamoDB table
  backup-state <env>            Create backup of current state
  restore-state <env> <backup>  Restore state from backup
  list-backups <env>            List available state backups
  migrate-state <from> <to>     Migrate state between environments
  import-resource <env>         Import existing AWS resource
  remove-resource <env>         Remove resource from state
  show-state <env>              Show current state information
  lock-state <env>              Manually lock state
  unlock-state <env>            Manually unlock state
  validate-state <env>          Validate state consistency

Options:
  --verbose                     Enable verbose output
  -h, --help                    Show this help message

Examples:
  $0 setup-backend prod
  $0 backup-state prod
  $0 restore-state prod backup_20241214_120000
  $0 show-state dev
  $0 validate-state staging

EOF
}

# Parse command line arguments
parse_arguments() {
    if [[ $# -eq 0 ]]; then
        show_help
        exit 0
    fi
    
    COMMAND=$1
    shift
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                if [[ -z "$ENVIRONMENT" ]]; then
                    ENVIRONMENT=$1
                else
                    # Additional arguments for specific commands
                    case $COMMAND in
                        restore-state)
                            BACKUP_NAME=$1
                            ;;
                        migrate-state)
                            TARGET_ENV=$1
                            ;;
                        import-resource)
                            RESOURCE_ADDRESS=$1
                            RESOURCE_ID=$2
                            shift
                            ;;
                        remove-resource)
                            RESOURCE_ADDRESS=$1
                            ;;
                    esac
                fi
                shift
                ;;
        esac
    done
}

# Validation functions
validate_environment() {
    if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod|demo)$ ]]; then
        error_exit "Environment must be dev, staging, prod, or demo"
    fi
}

validate_aws_credentials() {
    log "INFO" "Validating AWS credentials..."
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error_exit "AWS credentials not configured or invalid"
    fi
}

# Backend setup functions
setup_backend() {
    log "INFO" "Setting up Terraform backend for environment: $ENVIRONMENT"
    
    validate_environment
    validate_aws_credentials
    
    local project_name="user-journey-analytics"
    local bucket_name="${project_name}-terraform-state-${ENVIRONMENT}"
    local dynamodb_table="${project_name}-terraform-locks-${ENVIRONMENT}"
    local aws_region="us-east-1"
    
    # Create S3 bucket
    log "INFO" "Creating S3 bucket: $bucket_name"
    if ! aws s3 ls "s3://$bucket_name" >/dev/null 2>&1; then
        aws s3 mb "s3://$bucket_name" --region "$aws_region"
        
        # Configure bucket settings
        aws s3api put-bucket-versioning \
            --bucket "$bucket_name" \
            --versioning-configuration Status=Enabled
        
        aws s3api put-bucket-encryption \
            --bucket "$bucket_name" \
            --server-side-encryption-configuration '{
                "Rules": [
                    {
                        "ApplyServerSideEncryptionByDefault": {
                            "SSEAlgorithm": "AES256"
                        }
                    }
                ]
            }'
        
        aws s3api put-public-access-block \
            --bucket "$bucket_name" \
            --public-access-block-configuration \
            BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
        
        log "INFO" "S3 bucket created and configured"
    else
        log "INFO" "S3 bucket already exists"
    fi
    
    # Create DynamoDB table
    log "INFO" "Creating DynamoDB table: $dynamodb_table"
    if ! aws dynamodb describe-table --table-name "$dynamodb_table" >/dev/null 2>&1; then
        aws dynamodb create-table \
            --table-name "$dynamodb_table" \
            --attribute-definitions AttributeName=LockID,AttributeType=S \
            --key-schema AttributeName=LockID,KeyType=HASH \
            --billing-mode PAY_PER_REQUEST \
            --region "$aws_region"
        
        aws dynamodb wait table-exists --table-name "$dynamodb_table"
        log "INFO" "DynamoDB table created"
    else
        log "INFO" "DynamoDB table already exists"
    fi
    
    # Create backend configuration file
    local backend_file="$TERRAFORM_DIR/environments/${ENVIRONMENT}-backend.hcl"
    cat > "$backend_file" << EOF
# ${ENVIRONMENT^} backend configuration
bucket         = "$bucket_name"
key            = "${ENVIRONMENT}/terraform.tfstate"
region         = "$aws_region"
encrypt        = true
dynamodb_table = "$dynamodb_table"
EOF
    
    log "INFO" "Backend configuration saved to: $backend_file"
    log "INFO" "Backend setup completed successfully"
}

# State backup functions
backup_state() {
    log "INFO" "Creating state backup for environment: $ENVIRONMENT"
    
    validate_environment
    validate_aws_credentials
    
    cd "$TERRAFORM_DIR"
    
    # Initialize terraform if needed
    if [[ ! -d ".terraform" ]]; then
        terraform init -backend-config="environments/${ENVIRONMENT}-backend.hcl"
    fi
    
    # Select workspace
    terraform workspace select "$ENVIRONMENT" 2>/dev/null || terraform workspace new "$ENVIRONMENT"
    
    # Create backup directory
    local backup_dir="$TERRAFORM_DIR/backups/$ENVIRONMENT"
    mkdir -p "$backup_dir"
    
    # Create backup
    local backup_file="$backup_dir/terraform_state_backup_${TIMESTAMP}.tfstate"
    terraform state pull > "$backup_file"
    
    # Compress backup
    gzip "$backup_file"
    local compressed_backup="${backup_file}.gz"
    
    log "INFO" "State backup created: $compressed_backup"
    
    # Upload to S3 for additional safety
    local bucket_name="user-journey-analytics-terraform-state-${ENVIRONMENT}"
    local s3_backup_key="backups/terraform_state_backup_${TIMESTAMP}.tfstate.gz"
    
    if aws s3 cp "$compressed_backup" "s3://$bucket_name/$s3_backup_key"; then
        log "INFO" "Backup also uploaded to S3: s3://$bucket_name/$s3_backup_key"
    else
        log "WARN" "Failed to upload backup to S3"
    fi
}

# State restore functions
restore_state() {
    if [[ -z "$BACKUP_NAME" ]]; then
        error_exit "Backup name required for restore operation"
    fi
    
    log "INFO" "Restoring state for environment: $ENVIRONMENT from backup: $BACKUP_NAME"
    
    validate_environment
    validate_aws_credentials
    
    cd "$TERRAFORM_DIR"
    
    local backup_dir="$TERRAFORM_DIR/backups/$ENVIRONMENT"
    local backup_file="$backup_dir/${BACKUP_NAME}.gz"
    
    if [[ ! -f "$backup_file" ]]; then
        # Try to download from S3
        local bucket_name="user-journey-analytics-terraform-state-${ENVIRONMENT}"
        local s3_backup_key="backups/${BACKUP_NAME}.gz"
        
        log "INFO" "Backup not found locally, trying to download from S3..."
        if aws s3 cp "s3://$bucket_name/$s3_backup_key" "$backup_file"; then
            log "INFO" "Backup downloaded from S3"
        else
            error_exit "Backup file not found: $backup_file"
        fi
    fi
    
    # Create current state backup before restore
    log "INFO" "Creating backup of current state before restore..."
    backup_state
    
    # Decompress and restore
    local temp_backup="/tmp/restore_${TIMESTAMP}.tfstate"
    gunzip -c "$backup_file" > "$temp_backup"
    
    # Initialize terraform if needed
    if [[ ! -d ".terraform" ]]; then
        terraform init -backend-config="environments/${ENVIRONMENT}-backend.hcl"
    fi
    
    # Select workspace
    terraform workspace select "$ENVIRONMENT" 2>/dev/null || terraform workspace new "$ENVIRONMENT"
    
    # Push restored state
    terraform state push "$temp_backup"
    
    # Cleanup
    rm "$temp_backup"
    
    log "INFO" "State restored successfully from backup: $BACKUP_NAME"
}

# List backups
list_backups() {
    log "INFO" "Listing backups for environment: $ENVIRONMENT"
    
    validate_environment
    
    local backup_dir="$TERRAFORM_DIR/backups/$ENVIRONMENT"
    
    if [[ -d "$backup_dir" ]]; then
        log "INFO" "Local backups:"
        ls -la "$backup_dir"/*.gz 2>/dev/null || log "INFO" "No local backups found"
    fi
    
    # List S3 backups
    local bucket_name="user-journey-analytics-terraform-state-${ENVIRONMENT}"
    if aws s3 ls "s3://$bucket_name/backups/" 2>/dev/null; then
        log "INFO" "S3 backups:"
        aws s3 ls "s3://$bucket_name/backups/"
    else
        log "INFO" "No S3 backups found or bucket doesn't exist"
    fi
}

# Show state information
show_state() {
    log "INFO" "Showing state information for environment: $ENVIRONMENT"
    
    validate_environment
    
    cd "$TERRAFORM_DIR"
    
    # Initialize terraform if needed
    if [[ ! -d ".terraform" ]]; then
        terraform init -backend-config="environments/${ENVIRONMENT}-backend.hcl"
    fi
    
    # Select workspace
    terraform workspace select "$ENVIRONMENT" 2>/dev/null || terraform workspace new "$ENVIRONMENT"
    
    log "INFO" "Current workspace: $(terraform workspace show)"
    log "INFO" "State resources:"
    terraform state list
    
    log "INFO" "State statistics:"
    terraform show -json | jq '.values.root_module.resources | length' 2>/dev/null || echo "jq not available for detailed stats"
}

# Validate state consistency
validate_state() {
    log "INFO" "Validating state consistency for environment: $ENVIRONMENT"
    
    validate_environment
    
    cd "$TERRAFORM_DIR"
    
    # Initialize terraform if needed
    if [[ ! -d ".terraform" ]]; then
        terraform init -backend-config="environments/${ENVIRONMENT}-backend.hcl"
    fi
    
    # Select workspace
    terraform workspace select "$ENVIRONMENT" 2>/dev/null || terraform workspace new "$ENVIRONMENT"
    
    # Run terraform plan to check for drift
    log "INFO" "Checking for configuration drift..."
    if terraform plan -var-file="environments/${ENVIRONMENT}.tfvars" -detailed-exitcode; then
        log "INFO" "State is consistent with configuration"
    else
        local exit_code=$?
        if [[ $exit_code -eq 2 ]]; then
            log "WARN" "Configuration drift detected"
        else
            log "ERROR" "Plan failed with exit code: $exit_code"
        fi
    fi
    
    # Validate state file integrity
    log "INFO" "Validating state file integrity..."
    if terraform state pull | jq . >/dev/null 2>&1; then
        log "INFO" "State file is valid JSON"
    else
        log "ERROR" "State file is corrupted or invalid"
    fi
}

# Lock/unlock state
lock_state() {
    log "INFO" "Manually locking state for environment: $ENVIRONMENT"
    validate_environment
    
    # This is typically handled automatically by Terraform
    # Manual locking is mainly for emergency situations
    log "WARN" "Manual state locking should only be used in emergency situations"
    log "INFO" "State locking is automatically managed by Terraform during operations"
}

unlock_state() {
    if [[ -z "$LOCK_ID" ]]; then
        read -p "Enter lock ID to unlock: " LOCK_ID
    fi
    
    log "INFO" "Manually unlocking state for environment: $ENVIRONMENT"
    validate_environment
    
    cd "$TERRAFORM_DIR"
    
    if terraform force-unlock "$LOCK_ID"; then
        log "INFO" "State unlocked successfully"
    else
        log "ERROR" "Failed to unlock state"
    fi
}

# Main execution
main() {
    parse_arguments "$@"
    
    case $COMMAND in
        setup-backend)
            setup_backend
            ;;
        backup-state)
            backup_state
            ;;
        restore-state)
            restore_state
            ;;
        list-backups)
            list_backups
            ;;
        show-state)
            show_state
            ;;
        validate-state)
            validate_state
            ;;
        lock-state)
            lock_state
            ;;
        unlock-state)
            unlock_state
            ;;
        --help|-h|help)
            show_help
            ;;
        *)
            error_exit "Unknown command: $COMMAND. Use --help for usage information."
            ;;
    esac
}

# Execute main function
main "$@"