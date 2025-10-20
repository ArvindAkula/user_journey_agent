#!/bin/bash

# Production deployment script using existing AWS resources
# This script validates existing resources and configures production to use them

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
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_DIR/production_existing_deploy_${TIMESTAMP}.log"
}

log "INFO" "🚀 Starting production deployment using existing AWS resources"

# Validate existing resources
log "INFO" "🔍 Validating existing AWS resources..."

# Check DynamoDB tables
REQUIRED_TABLES=(
    "user-journey-analytics-user-profiles-dev"
    "user-journey-analytics-user-events-dev"
    "user-journey-analytics-struggle-signals-dev"
    "user-journey-analytics-video-engagement-dev"
)

for table in "${REQUIRED_TABLES[@]}"; do
    if aws dynamodb describe-table --table-name "$table" --region us-east-1 >/dev/null 2>&1; then
        log "INFO" "✅ DynamoDB table exists: $table"
    else
        log "ERROR" "❌ Required DynamoDB table not found: $table"
        exit 1
    fi
done

# Check Kinesis stream
KINESIS_STREAM="user-journey-analytics-user-events-dev"
if aws kinesis describe-stream --stream-name "$KINESIS_STREAM" --region us-east-1 >/dev/null 2>&1; then
    log "INFO" "✅ Kinesis stream exists: $KINESIS_STREAM"
else
    log "ERROR" "❌ Required Kinesis stream not found: $KINESIS_STREAM"
    exit 1
fi

# Check S3 buckets
REQUIRED_BUCKETS=(
    "user-journey-analytics-analytics-data-dev-9bf62fd9"
    "user-journey-analytics-event-logs-dev-9bf2a9c5"
    "user-journey-analytics-lambda-artifacts-dev-9bf2a9c5"
)

for bucket in "${REQUIRED_BUCKETS[@]}"; do
    if aws s3 ls "s3://$bucket" >/dev/null 2>&1; then
        log "INFO" "✅ S3 bucket exists: $bucket"
    else
        log "ERROR" "❌ Required S3 bucket not found: $bucket"
        exit 1
    fi
done

log "INFO" "✅ All required AWS resources validated successfully"

# Initialize Terraform with minimal configuration
log "INFO" "🔧 Initializing Terraform for resource validation..."
if $TERRAFORM_BIN init -backend-config="environments/prod-backend.hcl" -reconfigure; then
    log "INFO" "✅ Terraform initialization successful"
else
    log "ERROR" "❌ Terraform initialization failed"
    exit 1
fi

# Select workspace
if $TERRAFORM_BIN workspace select prod 2>/dev/null || $TERRAFORM_BIN workspace new prod; then
    log "INFO" "✅ Terraform workspace setup successful"
else
    log "ERROR" "❌ Terraform workspace setup failed"
    exit 1
fi

# Validate configuration with existing resources
log "INFO" "✅ Validating Terraform configuration..."
if $TERRAFORM_BIN validate; then
    log "INFO" "✅ Terraform configuration is valid"
else
    log "ERROR" "❌ Terraform configuration validation failed"
    exit 1
fi

# Plan with existing resources
log "INFO" "📊 Creating deployment plan for existing resources..."
if $TERRAFORM_BIN plan -var-file="environments/prod.tfvars" -var="use_existing_resources=true" -out="prod-existing.tfplan"; then
    log "INFO" "✅ Deployment plan created successfully"
else
    log "ERROR" "❌ Failed to create deployment plan"
    exit 1
fi

# Apply minimal configuration (mainly outputs and data sources)
log "INFO" "🚀 Applying configuration for existing resources..."
if $TERRAFORM_BIN apply prod-existing.tfplan; then
    log "INFO" "✅ Production configuration applied successfully!"
else
    log "ERROR" "❌ Production configuration failed"
    exit 1
fi

# Get resource information
log "INFO" "📋 Retrieving resource information..."
OUTPUTS_JSON=$($TERRAFORM_BIN output -json)

# Create production configuration file for applications
log "INFO" "📝 Creating production configuration file..."
cat > "$LOG_DIR/production-resources.json" << EOF
{
  "environment": "prod",
  "aws_region": "us-east-1",
  "dynamodb": {
    "user_profiles_table": "user-journey-analytics-user-profiles-dev",
    "user_events_table": "user-journey-analytics-user-events-dev",
    "struggle_signals_table": "user-journey-analytics-struggle-signals-dev",
    "video_engagement_table": "user-journey-analytics-video-engagement-dev"
  },
  "kinesis": {
    "stream_name": "user-journey-analytics-user-events-dev"
  },
  "s3": {
    "analytics_data_bucket": "user-journey-analytics-analytics-data-dev-9bf62fd9",
    "event_logs_bucket": "user-journey-analytics-event-logs-dev-9bf2a9c5",
    "lambda_artifacts_bucket": "user-journey-analytics-lambda-artifacts-dev-9bf2a9c5"
  },
  "deployment_timestamp": "$TIMESTAMP",
  "deployment_type": "existing_resources"
}
EOF

log "INFO" "✅ Production configuration saved to: $LOG_DIR/production-resources.json"

# Test connectivity to resources
log "INFO" "🔗 Testing connectivity to AWS resources..."

# Test DynamoDB access
for table in "${REQUIRED_TABLES[@]}"; do
    ITEM_COUNT=$(aws dynamodb scan --table-name "$table" --select COUNT --region us-east-1 --query 'Count' --output text 2>/dev/null || echo "0")
    log "INFO" "📊 $table: $ITEM_COUNT items"
done

# Test Kinesis stream status
STREAM_STATUS=$(aws kinesis describe-stream --stream-name "$KINESIS_STREAM" --region us-east-1 --query 'StreamDescription.StreamStatus' --output text)
log "INFO" "🌊 Kinesis stream status: $STREAM_STATUS"

# Test S3 bucket access
for bucket in "${REQUIRED_BUCKETS[@]}"; do
    OBJECT_COUNT=$(aws s3 ls "s3://$bucket" --recursive | wc -l | tr -d ' ')
    log "INFO" "🪣 $bucket: $OBJECT_COUNT objects"
done

log "INFO" "🎉 Production deployment using existing resources completed successfully!"
log "INFO" "📝 Deployment log saved to: $LOG_DIR/production_existing_deploy_${TIMESTAMP}.log"

echo ""
echo "🎉 Production infrastructure validated and configured!"
echo ""
echo "Resource Configuration:"
echo "  DynamoDB Tables: ${#REQUIRED_TABLES[@]} tables (reusing dev)"
echo "  Kinesis Stream: $KINESIS_STREAM (reusing dev)"
echo "  S3 Buckets: ${#REQUIRED_BUCKETS[@]} buckets (reusing dev)"
echo ""
echo "Configuration file: $LOG_DIR/production-resources.json"
echo ""
echo "Next steps:"
echo "1. Update application configuration to use these resources"
echo "2. Deploy applications using task 7.2"
echo "3. Validate end-to-end functionality using task 7.3"
echo ""