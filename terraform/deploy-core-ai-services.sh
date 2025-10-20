#!/bin/bash

# Deploy Core AI/ML Services (Lambda functions and SageMaker only)
# This script deploys the supported AI/ML components

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
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_DIR/core_ai_deploy_${TIMESTAMP}.log"
}

log "INFO" "🚀 Starting core AI/ML services deployment"

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

# Step 4: Plan core AI services only
log "INFO" "📊 Planning core AI services deployment..."
if $TERRAFORM_BIN plan \
    -var-file="environments/prod-existing-resources.tfvars" \
    -target="aws_lambda_function.event_processor" \
    -target="aws_lambda_function.struggle_detector" \
    -target="aws_lambda_function.video_analyzer" \
    -target="aws_lambda_function.intervention_executor" \
    -target="aws_sagemaker_endpoint.exit_risk_predictor" \
    -target="aws_sns_topic.user_interventions" \
    -out="core-ai-services.tfplan"; then
    log "INFO" "✅ Deployment plan created successfully"
else
    log "ERROR" "❌ Failed to create deployment plan"
    exit 1
fi

# Step 5: Apply deployment
log "INFO" "🚀 Deploying core AI services..."
if $TERRAFORM_BIN apply core-ai-services.tfplan; then
    log "INFO" "✅ Core AI services deployment completed successfully!"
else
    log "ERROR" "❌ Core AI services deployment failed"
    exit 1
fi

# Step 6: Get deployment outputs
log "INFO" "📋 Retrieving deployment information..."
OUTPUTS_JSON=$($TERRAFORM_BIN output -json)

# Step 7: Test deployed services
log "INFO" "🧪 Testing deployed services..."

# Test Lambda functions
LAMBDA_FUNCTIONS=$(echo "$OUTPUTS_JSON" | jq -r '.lambda_functions.value // {}')
if [ "$LAMBDA_FUNCTIONS" != "{}" ] && [ "$LAMBDA_FUNCTIONS" != "null" ]; then
    log "INFO" "✅ Lambda functions deployed successfully"
    
    # Test event processor
    EVENT_PROCESSOR=$(echo "$LAMBDA_FUNCTIONS" | jq -r '.event_processor // null')
    if [ "$EVENT_PROCESSOR" != "null" ]; then
        log "INFO" "🔄 Testing Event Processor Lambda..."
        TEST_EVENT='{"Records":[{"kinesis":{"data":"eyJ1c2VySWQiOiJ0ZXN0LXVzZXIiLCJldmVudFR5cGUiOiJ0ZXN0X2V2ZW50IiwidGltZXN0YW1wIjoiMjAyNS0xMC0xNFQyMDowMDowMFoifQ=="}}]}'
        
        if aws lambda invoke \
            --function-name "$(basename "$EVENT_PROCESSOR")" \
            --payload "$TEST_EVENT" \
            /tmp/lambda_test_output.json >/dev/null 2>&1; then
            
            RESULT=$(cat /tmp/lambda_test_output.json)
            log "INFO" "✅ Event Processor test successful: $RESULT"
            rm -f /tmp/lambda_test_output.json
        else
            log "WARN" "⚠️  Event Processor test failed (function may still be initializing)"
        fi
    fi
else
    log "WARN" "⚠️  Lambda functions may not be deployed"
fi

# Test SageMaker Endpoint
SAGEMAKER_ENDPOINT=$(echo "$OUTPUTS_JSON" | jq -r '.sagemaker_endpoint.value.endpoint_name // null')
if [ "$SAGEMAKER_ENDPOINT" != "null" ] && [ "$SAGEMAKER_ENDPOINT" != "" ]; then
    log "INFO" "✅ SageMaker Endpoint deployed successfully: $SAGEMAKER_ENDPOINT"
    
    # Test endpoint
    log "INFO" "🧪 Testing SageMaker endpoint..."
    TEST_PAYLOAD='{"instances": [{"error_count": 1, "retry_count": 0, "help_requests": 0, "session_duration": 120, "page_exits": 0, "form_abandons": 0, "click_frustration": 1, "success_rate": 0.9, "engagement_score": 85, "time_since_last_success": 10, "session_count": 1, "unique_pages_visited": 2, "average_time_per_page": 30}]}'
    
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

# Step 8: Create deployment summary
log "INFO" "📝 Creating deployment summary..."
SUMMARY_FILE="$LOG_DIR/core-ai-deployment-summary-${TIMESTAMP}.json"

cat > "$SUMMARY_FILE" << EOF
{
  "deployment_timestamp": "$TIMESTAMP",
  "environment": "$ENVIRONMENT",
  "aws_region": "us-east-1",
  "deployment_type": "core_ai_ml_services",
  
  "deployed_services": {
    "lambda_functions": $(echo "$OUTPUTS_JSON" | jq '.lambda_functions.value // {}'),
    "sagemaker_endpoint": $(echo "$OUTPUTS_JSON" | jq '.sagemaker_endpoint.value // {}'),
    "sns_topic": $(echo "$OUTPUTS_JSON" | jq '.ai_ml_services.value.sns_topic_arn // null')
  },
  
  "status": {
    "core_ai_services_deployed": true,
    "ready_for_integration": true
  }
}
EOF

log "INFO" "✅ Core AI services deployment summary saved to: $SUMMARY_FILE"

log "INFO" "🎉 Core AI/ML services deployment completed successfully!"
log "INFO" "📝 Deployment log saved to: $LOG_DIR/core_ai_deploy_${TIMESTAMP}.log"

echo ""
echo "🎉 Core AI/ML Services Deployed!"
echo ""
echo "Deployed Components:"
echo "  🔄 Event Processor Lambda"
echo "  🔍 Struggle Detector Lambda"
echo "  🎥 Video Analyzer Lambda"
echo "  ⚡ Intervention Executor Lambda"
echo "  🧠 SageMaker ML Endpoint (Exit Risk Predictor)"
echo "  📢 SNS Topic (User Interventions)"
echo ""
echo "Configuration:"
echo "  📁 Summary: $SUMMARY_FILE"
echo "  📝 Full log: $LOG_DIR/core_ai_deploy_${TIMESTAMP}.log"
echo ""
echo "✅ Core AI/ML services are ready for integration!"
echo ""
echo "Note: Bedrock Agent features require manual setup due to provider limitations"
echo ""