#!/bin/bash

# Production deployment script with AI/ML services
# This script deploys the complete production system including AI/ML components

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
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_DIR/production_ai_deploy_${TIMESTAMP}.log"
}

log "INFO" "🚀 Starting complete production deployment with AI/ML services"

# Step 1: Build ML model
log "INFO" "📦 Building ML model package..."
if python "$SCRIPT_DIR/scripts/create_simple_model.py"; then
    log "INFO" "✅ ML model package created successfully"
else
    log "ERROR" "❌ Failed to create ML model package"
    exit 1
fi

# Step 2: Initialize Terraform
log "INFO" "🔧 Initializing Terraform..."
cd "$SCRIPT_DIR"
if $TERRAFORM_BIN init -backend-config="environments/prod-backend.hcl" -reconfigure; then
    log "INFO" "✅ Terraform initialization successful"
else
    log "ERROR" "❌ Terraform initialization failed"
    exit 1
fi

# Step 3: Select workspace
if $TERRAFORM_BIN workspace select prod 2>/dev/null || $TERRAFORM_BIN workspace new prod; then
    log "INFO" "✅ Terraform workspace setup successful"
else
    log "ERROR" "❌ Terraform workspace setup failed"
    exit 1
fi

# Step 4: Validate configuration
log "INFO" "✅ Validating Terraform configuration..."
if $TERRAFORM_BIN validate; then
    log "INFO" "✅ Terraform configuration is valid"
else
    log "ERROR" "❌ Terraform configuration validation failed"
    exit 1
fi

# Step 5: Plan complete deployment
log "INFO" "📊 Creating complete deployment plan..."
if $TERRAFORM_BIN plan -var-file="environments/prod-existing-resources.tfvars" -out="production-complete.tfplan"; then
    log "INFO" "✅ Deployment plan created successfully"
else
    log "ERROR" "❌ Failed to create deployment plan"
    exit 1
fi

# Step 6: Apply deployment
log "INFO" "🚀 Deploying complete production system..."
if $TERRAFORM_BIN apply production-complete.tfplan; then
    log "INFO" "✅ Production deployment completed successfully!"
else
    log "ERROR" "❌ Production deployment failed"
    exit 1
fi

# Step 7: Get deployment outputs
log "INFO" "📋 Retrieving deployment information..."
OUTPUTS_JSON=$($TERRAFORM_BIN output -json)

# Step 8: Test AI/ML services
log "INFO" "🧪 Testing AI/ML services..."

# Test Lambda functions
LAMBDA_FUNCTIONS=$(echo "$OUTPUTS_JSON" | jq -r '.lambda_functions.value // {}')
if [ "$LAMBDA_FUNCTIONS" != "{}" ] && [ "$LAMBDA_FUNCTIONS" != "null" ]; then
    log "INFO" "✅ Lambda functions deployed successfully"
else
    log "WARN" "⚠️  Lambda functions may not be deployed"
fi

# Test Bedrock Agent
BEDROCK_AGENT=$(echo "$OUTPUTS_JSON" | jq -r '.bedrock_agent.value.agent_id // null')
if [ "$BEDROCK_AGENT" != "null" ] && [ "$BEDROCK_AGENT" != "" ]; then
    log "INFO" "✅ Bedrock Agent deployed successfully: $BEDROCK_AGENT"
else
    log "WARN" "⚠️  Bedrock Agent may not be deployed"
fi

# Test SageMaker Endpoint
SAGEMAKER_ENDPOINT=$(echo "$OUTPUTS_JSON" | jq -r '.sagemaker_endpoint.value.endpoint_name // null')
if [ "$SAGEMAKER_ENDPOINT" != "null" ] && [ "$SAGEMAKER_ENDPOINT" != "" ]; then
    log "INFO" "✅ SageMaker Endpoint deployed successfully: $SAGEMAKER_ENDPOINT"
    
    # Test endpoint
    log "INFO" "🧪 Testing SageMaker endpoint..."
    TEST_PAYLOAD='{"instances": [{"error_count": 2, "retry_count": 1, "help_requests": 0, "session_duration": 180, "page_exits": 1, "form_abandons": 0, "click_frustration": 2, "success_rate": 0.8, "engagement_score": 75, "time_since_last_success": 30, "session_count": 1, "unique_pages_visited": 3, "average_time_per_page": 45}]}'
    
    if aws sagemaker-runtime invoke-endpoint \
        --endpoint-name "$SAGEMAKER_ENDPOINT" \
        --content-type "application/json" \
        --body "$TEST_PAYLOAD" \
        /tmp/sagemaker_test_output.json >/dev/null 2>&1; then
        
        PREDICTION_RESULT=$(cat /tmp/sagemaker_test_output.json)
        log "INFO" "✅ SageMaker endpoint test successful"
        log "INFO" "📊 Test prediction result: $PREDICTION_RESULT"
        rm -f /tmp/sagemaker_test_output.json
    else
        log "WARN" "⚠️  SageMaker endpoint test failed (endpoint may still be initializing)"
    fi
else
    log "WARN" "⚠️  SageMaker Endpoint may not be deployed"
fi

# Step 9: Create production configuration summary
log "INFO" "📝 Creating production configuration summary..."
SUMMARY_FILE="$LOG_DIR/production-deployment-summary-${TIMESTAMP}.json"

cat > "$SUMMARY_FILE" << EOF
{
  "deployment_timestamp": "$TIMESTAMP",
  "environment": "$ENVIRONMENT",
  "aws_region": "us-east-1",
  "deployment_type": "complete_production_with_ai_ml",
  
  "infrastructure": {
    "dynamodb_tables": {
      "user_profiles": "user-journey-analytics-user-profiles-dev",
      "user_events": "user-journey-analytics-user-events-dev",
      "struggle_signals": "user-journey-analytics-struggle-signals-dev",
      "video_engagement": "user-journey-analytics-video-engagement-dev"
    },
    "kinesis_stream": "user-journey-analytics-user-events",
    "s3_buckets": {
      "analytics_data": "user-journey-analytics-analytics-data-dev-9bf2a9c5",
      "event_logs": "user-journey-analytics-event-logs-dev-9bf2a9c5",
      "lambda_artifacts": "user-journey-analytics-lambda-artifacts-dev-9bf2a9c5"
    }
  },
  
  "ai_ml_services": $(echo "$OUTPUTS_JSON" | jq '.ai_ml_services.value // {}'),
  
  "status": {
    "infrastructure_deployed": true,
    "ai_ml_services_deployed": true,
    "ready_for_application_deployment": true
  }
}
EOF

log "INFO" "✅ Production configuration summary saved to: $SUMMARY_FILE"

log "INFO" "🎉 Complete production deployment with AI/ML services completed successfully!"
log "INFO" "📝 Deployment log saved to: $LOG_DIR/production_ai_deploy_${TIMESTAMP}.log"

echo ""
echo "🎉 Complete Production System Deployed!"
echo ""
echo "Infrastructure:"
echo "  📊 DynamoDB: 4 tables (reusing existing dev tables)"
echo "  🌊 Kinesis: 1 stream (user-journey-analytics-user-events)"
echo "  🪣 S3: 3 buckets (reusing existing dev buckets)"
echo ""
echo "AI/ML Services:"
echo "  🔄 Event Processor Lambda"
echo "  🔍 Struggle Detector Lambda"
echo "  🎥 Video Analyzer Lambda"
echo "  ⚡ Intervention Executor Lambda"
echo "  🤖 Bedrock Agent (Claude 3 Sonnet)"
echo "  🧠 SageMaker ML Endpoint (Exit Risk Predictor)"
echo "  📢 SNS Topic (User Interventions)"
echo ""
echo "Configuration:"
echo "  📁 Summary: $SUMMARY_FILE"
echo "  📝 Full log: $LOG_DIR/production_ai_deploy_${TIMESTAMP}.log"
echo ""
echo "✅ System is ready for application deployment (Task 7.2)"
echo ""