#!/bin/bash

# Production deployment script for User Journey Analytics Agent
# This script deploys the complete AWS infrastructure for production

set -e

# Configuration
ENVIRONMENT="prod"
TERRAFORM_BIN="../terraform-bin/terraform"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create logs directory
mkdir -p "$LOG_DIR"

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_DIR/production_deploy_${TIMESTAMP}.log"
}

log "INFO" "🚀 Starting production deployment for User Journey Analytics Agent"

# Validate prerequisites
log "INFO" "📋 Validating prerequisites..."

# Check if terraform binary exists
if [[ ! -f "$TERRAFORM_BIN" ]]; then
    log "ERROR" "Terraform binary not found at $TERRAFORM_BIN"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    log "ERROR" "AWS credentials are not configured or invalid"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
log "INFO" "AWS Account ID: $ACCOUNT_ID"

# Check required files
REQUIRED_FILES=(
    "environments/prod.tfvars"
    "environments/prod-backend.hcl"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$file" ]]; then
        log "ERROR" "Required file not found: $file"
        exit 1
    fi
done

log "INFO" "✅ Prerequisites validated successfully"

# Initialize Terraform
log "INFO" "🔧 Initializing Terraform..."
if $TERRAFORM_BIN init -backend-config="environments/prod-backend.hcl" -reconfigure; then
    log "INFO" "✅ Terraform initialization successful"
else
    log "ERROR" "❌ Terraform initialization failed"
    exit 1
fi

# Select or create workspace
log "INFO" "🏗️  Setting up Terraform workspace..."
if $TERRAFORM_BIN workspace select prod 2>/dev/null || $TERRAFORM_BIN workspace new prod; then
    log "INFO" "✅ Terraform workspace setup successful"
else
    log "ERROR" "❌ Terraform workspace setup failed"
    exit 1
fi

# Validate configuration
log "INFO" "✅ Validating Terraform configuration..."
if $TERRAFORM_BIN validate; then
    log "INFO" "✅ Terraform configuration is valid"
else
    log "ERROR" "❌ Terraform configuration validation failed"
    exit 1
fi

# Create deployment plan
log "INFO" "📊 Creating deployment plan..."
if $TERRAFORM_BIN plan -var-file="environments/prod.tfvars" -out="prod.tfplan"; then
    log "INFO" "✅ Deployment plan created successfully"
else
    log "ERROR" "❌ Failed to create deployment plan"
    exit 1
fi

# Show plan summary
log "INFO" "📋 Deployment plan summary:"
$TERRAFORM_BIN show -no-color prod.tfplan | head -50

# Apply the deployment
log "INFO" "🚀 Applying deployment to production..."
if $TERRAFORM_BIN apply prod.tfplan; then
    log "INFO" "✅ Production deployment completed successfully!"
else
    log "ERROR" "❌ Production deployment failed"
    exit 1
fi

# Show outputs
log "INFO" "📋 Infrastructure outputs:"
$TERRAFORM_BIN output

# Validate deployed resources
log "INFO" "🔍 Validating deployed resources..."

# Get outputs for validation
OUTPUTS_JSON=$($TERRAFORM_BIN output -json)

# Validate key resources
if echo "$OUTPUTS_JSON" | jq -e '.vpc_id.value' >/dev/null 2>&1; then
    VPC_ID=$(echo "$OUTPUTS_JSON" | jq -r '.vpc_id.value')
    if aws ec2 describe-vpcs --vpc-ids "$VPC_ID" >/dev/null 2>&1; then
        log "INFO" "✅ VPC validated: $VPC_ID"
    else
        log "ERROR" "❌ VPC validation failed: $VPC_ID"
    fi
fi

# Validate DynamoDB tables
if echo "$OUTPUTS_JSON" | jq -e '.dynamodb_table_names.value' >/dev/null 2>&1; then
    TABLE_NAMES=$(echo "$OUTPUTS_JSON" | jq -r '.dynamodb_table_names.value[]')
    for table in $TABLE_NAMES; do
        if aws dynamodb describe-table --table-name "$table" >/dev/null 2>&1; then
            log "INFO" "✅ DynamoDB table validated: $table"
        else
            log "ERROR" "❌ DynamoDB table validation failed: $table"
        fi
    done
fi

# Validate Kinesis streams
if echo "$OUTPUTS_JSON" | jq -e '.kinesis_stream_name.value' >/dev/null 2>&1; then
    STREAM_NAME=$(echo "$OUTPUTS_JSON" | jq -r '.kinesis_stream_name.value')
    if aws kinesis describe-stream --stream-name "$STREAM_NAME" >/dev/null 2>&1; then
        log "INFO" "✅ Kinesis stream validated: $STREAM_NAME"
    else
        log "ERROR" "❌ Kinesis stream validation failed: $STREAM_NAME"
    fi
fi

# Validate S3 buckets
if echo "$OUTPUTS_JSON" | jq -e '.s3_bucket_names.value' >/dev/null 2>&1; then
    BUCKET_NAMES=$(echo "$OUTPUTS_JSON" | jq -r '.s3_bucket_names.value[]')
    for bucket in $BUCKET_NAMES; do
        if aws s3 ls "s3://$bucket" >/dev/null 2>&1; then
            log "INFO" "✅ S3 bucket validated: $bucket"
        else
            log "ERROR" "❌ S3 bucket validation failed: $bucket"
        fi
    done
fi

# Validate Lambda functions
if echo "$OUTPUTS_JSON" | jq -e '.lambda_function_names.value' >/dev/null 2>&1; then
    FUNCTION_NAMES=$(echo "$OUTPUTS_JSON" | jq -r '.lambda_function_names.value[]')
    for function in $FUNCTION_NAMES; do
        if aws lambda get-function --function-name "$function" >/dev/null 2>&1; then
            log "INFO" "✅ Lambda function validated: $function"
        else
            log "ERROR" "❌ Lambda function validation failed: $function"
        fi
    done
fi

log "INFO" "🎉 Production infrastructure deployment and validation completed!"
log "INFO" "📝 Deployment log saved to: $LOG_DIR/production_deploy_${TIMESTAMP}.log"

# Save outputs to file for reference
echo "$OUTPUTS_JSON" > "$LOG_DIR/terraform_outputs_${TIMESTAMP}.json"
log "INFO" "📄 Terraform outputs saved to: $LOG_DIR/terraform_outputs_${TIMESTAMP}.json"

echo ""
echo "🎉 Production deployment completed successfully!"
echo ""
echo "Next steps:"
echo "1. Deploy applications using task 7.2"
echo "2. Validate end-to-end functionality using task 7.3"
echo ""