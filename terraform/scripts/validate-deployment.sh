#!/bin/bash

# Deployment validation script for User Journey Analytics Agent
# Usage: ./validate-deployment.sh <environment> [--post-deploy] [--verbose]

set -e

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$TERRAFORM_DIR/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Default values
ENVIRONMENT=${1:-dev}
POST_DEPLOY=false
VERBOSE=false
VALIDATION_ERRORS=0

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --post-deploy)
            POST_DEPLOY=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 <environment> [options]"
            echo ""
            echo "Options:"
            echo "  --post-deploy    Run post-deployment validation"
            echo "  --verbose        Enable verbose output"
            echo "  -h, --help       Show this help message"
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
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_DIR/validate_deployment_${TIMESTAMP}.log"
}

# Validation functions
validation_error() {
    log "ERROR" "$1"
    ((VALIDATION_ERRORS++))
}

validation_warning() {
    log "WARN" "$1"
}

validation_success() {
    log "INFO" "$1"
}

# Pre-deployment validations
validate_prerequisites() {
    log "INFO" "Validating prerequisites..."
    
    # Check AWS CLI
    if command -v aws >/dev/null 2>&1; then
        validation_success "AWS CLI is installed"
    else
        validation_error "AWS CLI is not installed"
    fi
    
    # Check Terraform
    if command -v terraform >/dev/null 2>&1; then
        local tf_version=$(terraform version -json | jq -r '.terraform_version')
        validation_success "Terraform is installed (version: $tf_version)"
    else
        validation_error "Terraform is not installed"
    fi
    
    # Check AWS credentials
    if aws sts get-caller-identity >/dev/null 2>&1; then
        local account_id=$(aws sts get-caller-identity --query Account --output text)
        validation_success "AWS credentials are configured (Account: $account_id)"
    else
        validation_error "AWS credentials are not configured or invalid"
    fi
    
    # Check required environment files
    local required_files=(
        "$TERRAFORM_DIR/environments/${ENVIRONMENT}.tfvars"
        "$TERRAFORM_DIR/environments/${ENVIRONMENT}-backend.hcl"
    )
    
    for file in "${required_files[@]}"; do
        if [[ -f "$file" ]]; then
            validation_success "Found required file: $(basename "$file")"
        else
            validation_error "Missing required file: $file"
        fi
    done
}

validate_backend_setup() {
    log "INFO" "Validating backend setup..."
    
    local backend_file="$TERRAFORM_DIR/environments/${ENVIRONMENT}-backend.hcl"
    
    if [[ -f "$backend_file" ]]; then
        local bucket_name=$(grep "bucket" "$backend_file" | cut -d'"' -f2)
        local dynamodb_table=$(grep "dynamodb_table" "$backend_file" | cut -d'"' -f2)
        local region=$(grep "region" "$backend_file" | cut -d'"' -f2)
        
        # Validate S3 bucket
        if aws s3 ls "s3://$bucket_name" >/dev/null 2>&1; then
            validation_success "Backend S3 bucket exists and is accessible: $bucket_name"
            
            # Check bucket versioning
            if aws s3api get-bucket-versioning --bucket "$bucket_name" | grep -q "Enabled"; then
                validation_success "S3 bucket versioning is enabled"
            else
                validation_warning "S3 bucket versioning is not enabled"
            fi
            
            # Check bucket encryption
            if aws s3api get-bucket-encryption --bucket "$bucket_name" >/dev/null 2>&1; then
                validation_success "S3 bucket encryption is configured"
            else
                validation_warning "S3 bucket encryption is not configured"
            fi
        else
            validation_error "Backend S3 bucket not accessible: $bucket_name"
        fi
        
        # Validate DynamoDB table
        if aws dynamodb describe-table --table-name "$dynamodb_table" --region "$region" >/dev/null 2>&1; then
            validation_success "Backend DynamoDB table exists and is accessible: $dynamodb_table"
        else
            validation_error "Backend DynamoDB table not accessible: $dynamodb_table"
        fi
    else
        validation_error "Backend configuration file not found: $backend_file"
    fi
}

validate_terraform_configuration() {
    log "INFO" "Validating Terraform configuration..."
    
    cd "$TERRAFORM_DIR"
    
    # Initialize Terraform
    if terraform init -backend-config="environments/${ENVIRONMENT}-backend.hcl" >/dev/null 2>&1; then
        validation_success "Terraform initialization successful"
    else
        validation_error "Terraform initialization failed"
        return
    fi
    
    # Select workspace
    if terraform workspace select "$ENVIRONMENT" 2>/dev/null || terraform workspace new "$ENVIRONMENT"; then
        validation_success "Terraform workspace setup successful"
    else
        validation_error "Terraform workspace setup failed"
        return
    fi
    
    # Validate configuration
    if terraform validate; then
        validation_success "Terraform configuration is valid"
    else
        validation_error "Terraform configuration validation failed"
    fi
    
    # Check plan
    if terraform plan -var-file="environments/${ENVIRONMENT}.tfvars" >/dev/null 2>&1; then
        validation_success "Terraform plan is valid"
    else
        validation_error "Terraform plan failed"
    fi
}

validate_aws_permissions() {
    log "INFO" "Validating AWS permissions..."
    
    # Test basic AWS operations
    local test_operations=(
        "s3:ListBucket"
        "dynamodb:ListTables"
        "kinesis:ListStreams"
        "lambda:ListFunctions"
        "iam:ListRoles"
        "cloudwatch:ListMetrics"
    )
    
    # Test S3 permissions
    if aws s3 ls >/dev/null 2>&1; then
        validation_success "S3 list permissions available"
    else
        validation_warning "S3 list permissions may be limited"
    fi
    
    # Test DynamoDB permissions
    if aws dynamodb list-tables >/dev/null 2>&1; then
        validation_success "DynamoDB list permissions available"
    else
        validation_warning "DynamoDB list permissions may be limited"
    fi
    
    # Test IAM permissions
    if aws iam list-roles --max-items 1 >/dev/null 2>&1; then
        validation_success "IAM list permissions available"
    else
        validation_warning "IAM list permissions may be limited"
    fi
    
    # Test Kinesis permissions
    if aws kinesis list-streams >/dev/null 2>&1; then
        validation_success "Kinesis list permissions available"
    else
        validation_warning "Kinesis list permissions may be limited"
    fi
}

# Post-deployment validations
validate_deployed_resources() {
    log "INFO" "Validating deployed resources..."
    
    cd "$TERRAFORM_DIR"
    
    # Get Terraform outputs
    local outputs_json
    if outputs_json=$(terraform output -json 2>/dev/null); then
        validation_success "Terraform outputs retrieved successfully"
    else
        validation_error "Failed to retrieve Terraform outputs"
        return
    fi
    
    # Validate VPC
    if echo "$outputs_json" | jq -e '.vpc_id.value' >/dev/null 2>&1; then
        local vpc_id=$(echo "$outputs_json" | jq -r '.vpc_id.value')
        if aws ec2 describe-vpcs --vpc-ids "$vpc_id" >/dev/null 2>&1; then
            validation_success "VPC exists and is accessible: $vpc_id"
        else
            validation_error "VPC not found or not accessible: $vpc_id"
        fi
    else
        validation_warning "VPC ID not found in outputs"
    fi
    
    # Validate DynamoDB tables
    if echo "$outputs_json" | jq -e '.dynamodb_table_names.value' >/dev/null 2>&1; then
        local table_names=$(echo "$outputs_json" | jq -r '.dynamodb_table_names.value[]')
        for table in $table_names; do
            if aws dynamodb describe-table --table-name "$table" >/dev/null 2>&1; then
                validation_success "DynamoDB table exists: $table"
            else
                validation_error "DynamoDB table not found: $table"
            fi
        done
    else
        validation_warning "DynamoDB table names not found in outputs"
    fi
    
    # Validate Kinesis streams
    if echo "$outputs_json" | jq -e '.kinesis_stream_name.value' >/dev/null 2>&1; then
        local stream_name=$(echo "$outputs_json" | jq -r '.kinesis_stream_name.value')
        if aws kinesis describe-stream --stream-name "$stream_name" >/dev/null 2>&1; then
            validation_success "Kinesis stream exists: $stream_name"
        else
            validation_error "Kinesis stream not found: $stream_name"
        fi
    else
        validation_warning "Kinesis stream name not found in outputs"
    fi
    
    # Validate S3 buckets
    if echo "$outputs_json" | jq -e '.s3_bucket_names.value' >/dev/null 2>&1; then
        local bucket_names=$(echo "$outputs_json" | jq -r '.s3_bucket_names.value[]')
        for bucket in $bucket_names; do
            if aws s3 ls "s3://$bucket" >/dev/null 2>&1; then
                validation_success "S3 bucket exists: $bucket"
            else
                validation_error "S3 bucket not found: $bucket"
            fi
        done
    else
        validation_warning "S3 bucket names not found in outputs"
    fi
    
    # Validate Lambda functions
    if echo "$outputs_json" | jq -e '.lambda_function_names.value' >/dev/null 2>&1; then
        local function_names=$(echo "$outputs_json" | jq -r '.lambda_function_names.value[]')
        for function in $function_names; do
            if aws lambda get-function --function-name "$function" >/dev/null 2>&1; then
                validation_success "Lambda function exists: $function"
            else
                validation_error "Lambda function not found: $function"
            fi
        done
    else
        validation_warning "Lambda function names not found in outputs"
    fi
}

validate_resource_connectivity() {
    log "INFO" "Validating resource connectivity..."
    
    cd "$TERRAFORM_DIR"
    
    # Get outputs
    local outputs_json
    if outputs_json=$(terraform output -json 2>/dev/null); then
        # Test Kinesis to Lambda connectivity
        if echo "$outputs_json" | jq -e '.kinesis_stream_name.value' >/dev/null 2>&1; then
            local stream_name=$(echo "$outputs_json" | jq -r '.kinesis_stream_name.value')
            
            # Check if Lambda functions are configured as Kinesis consumers
            local event_source_mappings=$(aws lambda list-event-source-mappings --event-source-arn "arn:aws:kinesis:*:*:stream/$stream_name" 2>/dev/null || echo "[]")
            local mapping_count=$(echo "$event_source_mappings" | jq '.EventSourceMappings | length')
            
            if [[ $mapping_count -gt 0 ]]; then
                validation_success "Kinesis to Lambda connectivity configured ($mapping_count mappings)"
            else
                validation_warning "No Kinesis to Lambda event source mappings found"
            fi
        fi
        
        # Test DynamoDB table accessibility from Lambda
        if echo "$outputs_json" | jq -e '.lambda_function_names.value' >/dev/null 2>&1; then
            local function_names=$(echo "$outputs_json" | jq -r '.lambda_function_names.value[]')
            for function in $function_names; do
                # Check if Lambda has DynamoDB permissions
                local function_config=$(aws lambda get-function --function-name "$function" 2>/dev/null || echo "{}")
                if echo "$function_config" | jq -e '.Configuration.Role' >/dev/null 2>&1; then
                    validation_success "Lambda function has IAM role configured: $function"
                else
                    validation_warning "Lambda function IAM role not found: $function"
                fi
            done
        fi
    fi
}

validate_monitoring_setup() {
    log "INFO" "Validating monitoring setup..."
    
    # Check CloudWatch log groups
    local log_groups=$(aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/user-journey-analytics-${ENVIRONMENT}" 2>/dev/null || echo '{"logGroups": []}')
    local log_group_count=$(echo "$log_groups" | jq '.logGroups | length')
    
    if [[ $log_group_count -gt 0 ]]; then
        validation_success "CloudWatch log groups found ($log_group_count groups)"
    else
        validation_warning "No CloudWatch log groups found for Lambda functions"
    fi
    
    # Check CloudWatch alarms
    local alarms=$(aws cloudwatch describe-alarms --alarm-name-prefix "user-journey-analytics-${ENVIRONMENT}" 2>/dev/null || echo '{"MetricAlarms": []}')
    local alarm_count=$(echo "$alarms" | jq '.MetricAlarms | length')
    
    if [[ $alarm_count -gt 0 ]]; then
        validation_success "CloudWatch alarms configured ($alarm_count alarms)"
    else
        validation_warning "No CloudWatch alarms found"
    fi
}

# Main validation function
run_validation() {
    log "INFO" "Starting deployment validation for environment: $ENVIRONMENT"
    
    # Pre-deployment validations
    validate_prerequisites
    validate_backend_setup
    validate_terraform_configuration
    validate_aws_permissions
    
    # Post-deployment validations (if requested)
    if [[ "$POST_DEPLOY" == "true" ]]; then
        validate_deployed_resources
        validate_resource_connectivity
        validate_monitoring_setup
    fi
    
    # Summary
    if [[ $VALIDATION_ERRORS -eq 0 ]]; then
        validation_success "All validations passed successfully!"
        return 0
    else
        log "ERROR" "Validation completed with $VALIDATION_ERRORS errors"
        return 1
    fi
}

# Main execution
main() {
    if run_validation; then
        exit 0
    else
        exit 1
    fi
}

# Execute main function
main "$@"