#!/bin/bash

# Terraform validation script for User Journey Analytics Agent
# Usage: ./validate-terraform.sh [environment] [--fix] [--verbose]

set -e

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$TERRAFORM_DIR/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Default values
ENVIRONMENT=${1:-all}
FIX_ISSUES=false
VERBOSE=false
EXIT_CODE=0

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --fix)
            FIX_ISSUES=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [environment] [options]"
            echo ""
            echo "Arguments:"
            echo "  environment    Target environment (dev|staging|prod|all)"
            echo ""
            echo "Options:"
            echo "  --fix         Attempt to fix formatting issues"
            echo "  --verbose     Enable verbose output"
            echo "  -h, --help    Show this help message"
            exit 0
            ;;
        *)
            ENVIRONMENT=$1
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
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_DIR/validate_${TIMESTAMP}.log"
}

# Error handling
validation_error() {
    log "ERROR" "$1"
    EXIT_CODE=1
}

validation_warning() {
    log "WARN" "$1"
}

validation_success() {
    log "INFO" "$1"
}

# Validation functions
validate_terraform_syntax() {
    log "INFO" "Validating Terraform syntax..."
    
    cd "$TERRAFORM_DIR"
    
    if terraform fmt -check=true -diff=true; then
        validation_success "Terraform formatting is correct"
    else
        if [[ "$FIX_ISSUES" == "true" ]]; then
            log "INFO" "Fixing Terraform formatting..."
            terraform fmt -recursive
            validation_success "Terraform formatting fixed"
        else
            validation_error "Terraform formatting issues found. Run with --fix to auto-correct."
        fi
    fi
    
    if terraform validate; then
        validation_success "Terraform configuration is valid"
    else
        validation_error "Terraform configuration validation failed"
    fi
}

validate_required_files() {
    log "INFO" "Validating required files..."
    
    local required_files=(
        "$TERRAFORM_DIR/main.tf"
        "$TERRAFORM_DIR/variables.tf"
        "$TERRAFORM_DIR/outputs.tf"
        "$TERRAFORM_DIR/versions.tf"
    )
    
    for file in "${required_files[@]}"; do
        if [[ -f "$file" ]]; then
            validation_success "Found required file: $(basename "$file")"
        else
            validation_error "Missing required file: $file"
        fi
    done
}

validate_module_structure() {
    log "INFO" "Validating module structure..."
    
    local modules_dir="$TERRAFORM_DIR/modules"
    local expected_modules=(
        "vpc"
        "iam"
        "s3"
        "dynamodb"
        "kinesis"
        "sqs"
        "lambda"
        "monitoring"
        "timestream"
    )
    
    for module in "${expected_modules[@]}"; do
        local module_dir="$modules_dir/$module"
        if [[ -d "$module_dir" ]]; then
            validation_success "Found module: $module"
            
            # Check for required module files
            local module_files=("main.tf" "variables.tf" "outputs.tf")
            for file in "${module_files[@]}"; do
                if [[ -f "$module_dir/$file" ]]; then
                    validation_success "  Found $file in $module module"
                else
                    validation_error "  Missing $file in $module module"
                fi
            done
        else
            validation_error "Missing module directory: $module"
        fi
    done
}

validate_environment_configs() {
    local env=$1
    log "INFO" "Validating environment configuration for: $env"
    
    local tfvars_file="$TERRAFORM_DIR/environments/${env}.tfvars"
    local backend_file="$TERRAFORM_DIR/environments/${env}-backend.hcl"
    
    # Check tfvars file
    if [[ -f "$tfvars_file" ]]; then
        validation_success "Found tfvars file for $env"
        
        # Validate required variables
        local required_vars=(
            "environment"
            "aws_region"
            "project_name"
        )
        
        for var in "${required_vars[@]}"; do
            if grep -q "^$var\s*=" "$tfvars_file"; then
                validation_success "  Found required variable: $var"
            else
                validation_error "  Missing required variable in $env.tfvars: $var"
            fi
        done
    else
        validation_error "Missing tfvars file: $tfvars_file"
    fi
    
    # Check backend file
    if [[ -f "$backend_file" ]]; then
        validation_success "Found backend file for $env"
        
        # Validate required backend config
        local required_backend_vars=(
            "bucket"
            "key"
            "region"
            "dynamodb_table"
        )
        
        for var in "${required_backend_vars[@]}"; do
            if grep -q "^$var\s*=" "$backend_file"; then
                validation_success "  Found required backend config: $var"
            else
                validation_error "  Missing required backend config in $env-backend.hcl: $var"
            fi
        done
    else
        validation_error "Missing backend file: $backend_file"
    fi
}

validate_security_best_practices() {
    log "INFO" "Validating security best practices..."
    
    cd "$TERRAFORM_DIR"
    
    # Check for hardcoded secrets
    if grep -r "password\s*=" . --include="*.tf" --include="*.tfvars" | grep -v "var\." | grep -v "local\."; then
        validation_error "Found potential hardcoded passwords"
    else
        validation_success "No hardcoded passwords found"
    fi
    
    # Check for hardcoded access keys
    if grep -r "access_key\s*=" . --include="*.tf" --include="*.tfvars" | grep -v "var\." | grep -v "local\."; then
        validation_error "Found potential hardcoded access keys"
    else
        validation_success "No hardcoded access keys found"
    fi
    
    # Check for encryption settings
    if grep -r "encrypt.*=.*true" . --include="*.tf"; then
        validation_success "Found encryption configurations"
    else
        validation_warning "No encryption configurations found"
    fi
    
    # Check for versioning on S3 buckets
    if grep -r "versioning" . --include="*.tf" | grep -q "enabled.*=.*true"; then
        validation_success "Found S3 versioning configurations"
    else
        validation_warning "No S3 versioning configurations found"
    fi
}

validate_resource_naming() {
    log "INFO" "Validating resource naming conventions..."
    
    cd "$TERRAFORM_DIR"
    
    # Check for consistent naming patterns
    local naming_issues=0
    
    # Check resource names follow pattern: project-component-environment
    while IFS= read -r line; do
        if [[ "$line" =~ resource[[:space:]]+\"[^\"]+\"[[:space:]]+\"([^\"]+)\" ]]; then
            local resource_name="${BASH_REMATCH[1]}"
            if [[ ! "$resource_name" =~ ^[a-z0-9_]+$ ]]; then
                validation_error "Resource name '$resource_name' doesn't follow naming convention"
                ((naming_issues++))
            fi
        fi
    done < <(grep -r "^resource " . --include="*.tf")
    
    if [[ $naming_issues -eq 0 ]]; then
        validation_success "All resource names follow naming conventions"
    fi
}

validate_tags() {
    log "INFO" "Validating resource tagging..."
    
    cd "$TERRAFORM_DIR"
    
    # Check for common tags
    local required_tags=("Project" "Environment" "ManagedBy")
    local tags_found=0
    
    for tag in "${required_tags[@]}"; do
        if grep -r "\"$tag\"" . --include="*.tf" | grep -q "tags"; then
            validation_success "Found required tag: $tag"
            ((tags_found++))
        else
            validation_warning "Missing required tag: $tag"
        fi
    done
    
    if [[ $tags_found -eq ${#required_tags[@]} ]]; then
        validation_success "All required tags are configured"
    fi
}

validate_outputs() {
    log "INFO" "Validating Terraform outputs..."
    
    local outputs_file="$TERRAFORM_DIR/outputs.tf"
    
    if [[ -f "$outputs_file" ]]; then
        # Check for essential outputs
        local required_outputs=(
            "vpc_id"
            "dynamodb_table_names"
            "kinesis_stream_name"
            "s3_bucket_names"
        )
        
        for output in "${required_outputs[@]}"; do
            if grep -q "output \"$output\"" "$outputs_file"; then
                validation_success "Found required output: $output"
            else
                validation_warning "Missing recommended output: $output"
            fi
        done
    else
        validation_error "Missing outputs.tf file"
    fi
}

run_tflint() {
    log "INFO" "Running tflint validation..."
    
    cd "$TERRAFORM_DIR"
    
    if command -v tflint >/dev/null 2>&1; then
        if tflint --init && tflint; then
            validation_success "tflint validation passed"
        else
            validation_error "tflint validation failed"
        fi
    else
        validation_warning "tflint not installed, skipping advanced linting"
    fi
}

run_checkov() {
    log "INFO" "Running Checkov security scan..."
    
    cd "$TERRAFORM_DIR"
    
    if command -v checkov >/dev/null 2>&1; then
        if checkov -d . --framework terraform --quiet; then
            validation_success "Checkov security scan passed"
        else
            validation_error "Checkov security scan found issues"
        fi
    else
        validation_warning "Checkov not installed, skipping security scan"
    fi
}

# Main validation function
run_validation() {
    local env=$1
    
    log "INFO" "Starting Terraform validation for environment: $env"
    
    # Core validations
    validate_terraform_syntax
    validate_required_files
    validate_module_structure
    
    # Environment-specific validations
    if [[ "$env" != "all" ]]; then
        validate_environment_configs "$env"
    else
        for environment in dev staging prod; do
            validate_environment_configs "$environment"
        done
    fi
    
    # Security and best practices
    validate_security_best_practices
    validate_resource_naming
    validate_tags
    validate_outputs
    
    # External tools (if available)
    run_tflint
    run_checkov
    
    # Summary
    if [[ $EXIT_CODE -eq 0 ]]; then
        validation_success "All validations passed successfully!"
    else
        log "ERROR" "Validation completed with errors. Check the log for details."
    fi
}

# Main execution
main() {
    log "INFO" "Starting Terraform validation process"
    
    # Change to terraform directory
    cd "$TERRAFORM_DIR"
    
    # Run validation
    run_validation "$ENVIRONMENT"
    
    log "INFO" "Validation process completed"
    exit $EXIT_CODE
}

# Execute main function
main "$@"