#!/bin/bash

# Enhanced Terraform deployment script for User Journey Analytics Agent
# Usage: ./deploy-infrastructure.sh <environment> [plan|apply|destroy] [--auto-approve] [--validate-only]

set -e

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$TERRAFORM_DIR/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Default values
ENVIRONMENT=${1:-dev}
ACTION=${2:-plan}
AUTO_APPROVE=false
VALIDATE_ONLY=false
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --auto-approve)
            AUTO_APPROVE=true
            shift
            ;;
        --validate-only)
            VALIDATE_ONLY=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 <environment> [plan|apply|destroy] [options]"
            echo ""
            echo "Arguments:"
            echo "  environment    Target environment (dev|staging|prod)"
            echo "  action         Terraform action (plan|apply|destroy)"
            echo ""
            echo "Options:"
            echo "  --auto-approve    Skip interactive approval for apply/destroy"
            echo "  --validate-only   Only run validation checks"
            echo "  --verbose         Enable verbose output"
            echo "  -h, --help        Show this help message"
            exit 0
            ;;
        *)
            # Skip unknown options
            shift
            ;;
    esac
done

# Create logs directory
mkdir -p "$LOG_DIR"

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_DIR/deploy_${ENVIRONMENT}_${TIMESTAMP}.log"
}

# Error handling
error_exit() {
    log "ERROR" "$1"
    exit 1
}

# Validation functions
validate_environment() {
    if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
        error_exit "Environment must be dev, staging, or prod"
    fi
}

validate_action() {
    if [[ ! "$ACTION" =~ ^(plan|apply|destroy)$ ]]; then
        error_exit "Action must be plan, apply, or destroy"
    fi
}

validate_aws_credentials() {
    log "INFO" "Validating AWS credentials..."
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error_exit "AWS credentials not configured or invalid"
    fi
    
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    log "INFO" "Using AWS Account: $account_id"
}

validate_terraform_files() {
    log "INFO" "Validating Terraform configuration files..."
    
    # Check required files exist
    local required_files=(
        "$TERRAFORM_DIR/main.tf"
        "$TERRAFORM_DIR/variables.tf"
        "$TERRAFORM_DIR/outputs.tf"
        "$TERRAFORM_DIR/environments/${ENVIRONMENT}.tfvars"
        "$TERRAFORM_DIR/environments/${ENVIRONMENT}-backend.hcl"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            error_exit "Required file not found: $file"
        fi
    done
    
    log "INFO" "All required Terraform files found"
}

validate_backend_configuration() {
    log "INFO" "Validating backend configuration..."
    
    local backend_file="$TERRAFORM_DIR/environments/${ENVIRONMENT}-backend.hcl"
    local bucket_name=$(grep "bucket" "$backend_file" | cut -d'"' -f2)
    local dynamodb_table=$(grep "dynamodb_table" "$backend_file" | cut -d'"' -f2)
    
    # Check if S3 bucket exists
    if ! aws s3 ls "s3://$bucket_name" >/dev/null 2>&1; then
        log "WARN" "S3 bucket $bucket_name does not exist. Run setup-backend.sh first."
        return 1
    fi
    
    # Check if DynamoDB table exists
    if ! aws dynamodb describe-table --table-name "$dynamodb_table" >/dev/null 2>&1; then
        log "WARN" "DynamoDB table $dynamodb_table does not exist. Run setup-backend.sh first."
        return 1
    fi
    
    log "INFO" "Backend configuration validated successfully"
}

# Pre-deployment checks
run_pre_deployment_checks() {
    log "INFO" "Running pre-deployment checks..."
    
    validate_environment
    validate_action
    validate_aws_credentials
    validate_terraform_files
    
    if ! validate_backend_configuration; then
        if [[ "$AUTO_APPROVE" == "false" ]]; then
            read -p "Backend not configured. Do you want to set it up now? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                log "INFO" "Setting up backend..."
                "$TERRAFORM_DIR/setup-backend.sh" "$ENVIRONMENT"
            else
                error_exit "Backend configuration required. Run setup-backend.sh first."
            fi
        else
            error_exit "Backend configuration required. Run setup-backend.sh first."
        fi
    fi
}

# Terraform operations
initialize_terraform() {
    log "INFO" "Initializing Terraform..."
    
    cd "$TERRAFORM_DIR"
    
    if [[ "$VERBOSE" == "true" ]]; then
        terraform init -backend-config="environments/${ENVIRONMENT}-backend.hcl" -reconfigure
    else
        terraform init -backend-config="environments/${ENVIRONMENT}-backend.hcl" -reconfigure >/dev/null
    fi
    
    log "INFO" "Terraform initialized successfully"
}

setup_workspace() {
    log "INFO" "Setting up Terraform workspace..."
    
    if terraform workspace list | grep -q "$ENVIRONMENT"; then
        terraform workspace select "$ENVIRONMENT"
        log "INFO" "Selected existing workspace: $ENVIRONMENT"
    else
        terraform workspace new "$ENVIRONMENT"
        log "INFO" "Created new workspace: $ENVIRONMENT"
    fi
}

validate_configuration() {
    log "INFO" "Validating Terraform configuration..."
    
    if ! terraform validate; then
        error_exit "Terraform configuration validation failed"
    fi
    
    log "INFO" "Terraform configuration is valid"
}

run_terraform_plan() {
    log "INFO" "Running Terraform plan..."
    
    local plan_file="${ENVIRONMENT}_${TIMESTAMP}.tfplan"
    local plan_output="$LOG_DIR/plan_${ENVIRONMENT}_${TIMESTAMP}.txt"
    
    if terraform plan -var-file="environments/${ENVIRONMENT}.tfvars" -out="$plan_file" | tee "$plan_output"; then
        log "INFO" "Terraform plan completed successfully"
        log "INFO" "Plan saved to: $plan_file"
        log "INFO" "Plan output saved to: $plan_output"
        echo "$plan_file" > "$LOG_DIR/latest_plan_${ENVIRONMENT}.txt"
    else
        error_exit "Terraform plan failed"
    fi
}

run_terraform_apply() {
    log "INFO" "Running Terraform apply..."
    
    local plan_file
    if [[ -f "$LOG_DIR/latest_plan_${ENVIRONMENT}.txt" ]]; then
        plan_file=$(cat "$LOG_DIR/latest_plan_${ENVIRONMENT}.txt")
    fi
    
    local apply_args=""
    if [[ -n "$plan_file" && -f "$plan_file" ]]; then
        apply_args="$plan_file"
        log "INFO" "Applying from plan file: $plan_file"
    else
        apply_args="-var-file=environments/${ENVIRONMENT}.tfvars"
        if [[ "$AUTO_APPROVE" == "true" ]]; then
            apply_args="$apply_args -auto-approve"
        fi
        log "INFO" "Applying with direct configuration"
    fi
    
    if terraform apply $apply_args; then
        log "INFO" "Terraform apply completed successfully"
        
        # Save outputs
        local outputs_file="$LOG_DIR/outputs_${ENVIRONMENT}_${TIMESTAMP}.json"
        terraform output -json > "$outputs_file"
        log "INFO" "Outputs saved to: $outputs_file"
        
        # Display key outputs
        log "INFO" "Key infrastructure outputs:"
        terraform output
    else
        error_exit "Terraform apply failed"
    fi
}

run_terraform_destroy() {
    log "INFO" "Running Terraform destroy..."
    
    local destroy_args="-var-file=environments/${ENVIRONMENT}.tfvars"
    if [[ "$AUTO_APPROVE" == "true" ]]; then
        destroy_args="$destroy_args -auto-approve"
    fi
    
    if terraform destroy $destroy_args; then
        log "INFO" "Terraform destroy completed successfully"
    else
        error_exit "Terraform destroy failed"
    fi
}

# Main execution
main() {
    log "INFO" "Starting Terraform deployment - Environment: $ENVIRONMENT, Action: $ACTION"
    
    # Run pre-deployment checks
    run_pre_deployment_checks
    
    # If validate-only flag is set, only run validation
    if [[ "$VALIDATE_ONLY" == "true" ]]; then
        log "INFO" "Running validation-only mode"
        initialize_terraform
        setup_workspace
        validate_configuration
        log "INFO" "Validation completed successfully"
        exit 0
    fi
    
    # Initialize Terraform
    initialize_terraform
    
    # Setup workspace
    setup_workspace
    
    # Validate configuration
    validate_configuration
    
    # Execute the requested action
    case $ACTION in
        plan)
            run_terraform_plan
            ;;
        apply)
            run_terraform_apply
            ;;
        destroy)
            run_terraform_destroy
            ;;
    esac
    
    log "INFO" "Deployment completed successfully!"
}

# Execute main function
main "$@"