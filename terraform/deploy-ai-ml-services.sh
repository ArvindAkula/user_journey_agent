#!/bin/bash

# Deploy AI/ML Services for User Journey Analytics
# This script deploys Lambda functions, Bedrock Agent, and SageMaker endpoint

set -e

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
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_DIR/ai_ml_deploy_${TIMESTAMP}.log"
}

log "INFO" "🚀 Starting AI/ML services deployment"

# Build ML model first
log "INFO" "📦 Building ML model package..."
python scripts/create_simple_model.py

# Initialize Terraform
log "INFO" "🔧 Initializing Terraform..."
$TERRAFORM_BIN init

# Select workspace
if $TERRAFORM_BIN workspace select prod 2>/dev/null || $TERRAFORM_BIN workspace new prod; then
    log "INFO" "✅ Terraform workspace setup successful"
else
    log "ERROR" "❌ Terraform workspace setup failed"
    exit 1
fi

# Plan deployment
log "INFO" "📊 Planning AI/ML services deployment..."
$TERRAFORM_BIN plan \
    -var-file="environments/prod-existing-resources.tfvars" \
    -target="aws_lambda_function.event_processor" \
    -target="aws_lambda_function.struggle_detector" \
    -target="aws_lambda_function.video_analyzer" \
    -target="aws_lambda_function.intervention_executor" \
    -target="aws_bedrock_agent.user_journey_agent" \
    -target="aws_sagemaker_endpoint.exit_risk_predictor" \
    -out="ai-ml-services.tfplan"

# Apply deployment
log "INFO" "🚀 Deploying AI/ML services..."
$TERRAFORM_BIN apply ai-ml-services.tfplan

log "INFO" "🎉 AI/ML services deployment completed successfully!"

echo ""
echo "🎉 AI/ML Services Deployed!"
echo ""
echo "Components:"
echo "  🔄 Event Processor Lambda"
echo "  🔍 Struggle Detector Lambda"  
echo "  🎥 Video Analyzer Lambda"
echo "  ⚡ Intervention Executor Lambda"
echo "  🤖 Bedrock Agent"
echo "  🧠 SageMaker ML Endpoint"
echo ""