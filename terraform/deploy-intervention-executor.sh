#!/bin/bash

# Deploy Intervention Executor Lambda Function
# This script deploys the intervention executor that triggers when exitRiskScore > 70

set -e

echo "🚀 Deploying Intervention Executor Lambda..."
echo "=============================================="

# Set AWS region
export AWS_REGION=${AWS_REGION:-us-east-1}
export ENVIRONMENT=${ENVIRONMENT:-prod}

echo "📍 Region: $AWS_REGION"
echo "🏷️  Environment: $ENVIRONMENT"
echo ""

# Navigate to terraform directory
cd "$(dirname "$0")"

# Initialize Terraform if needed
if [ ! -d ".terraform" ]; then
    echo "🔧 Initializing Terraform..."
    terraform init
    echo ""
fi

# Validate Terraform configuration
echo "✅ Validating Terraform configuration..."
terraform validate
echo ""

# Plan the deployment
echo "📋 Planning deployment..."
terraform plan \
    -target=aws_lambda_function.intervention_executor \
    -target=aws_iam_role.intervention_executor_role \
    -target=aws_iam_role_policy.intervention_executor_policy \
    -target=aws_sns_topic.intervention_notifications \
    -target=aws_cloudwatch_log_group.intervention_executor_logs \
    -var="environment=$ENVIRONMENT" \
    -var="aws_region=$AWS_REGION" \
    -out=tfplan-intervention
echo ""

# Ask for confirmation
read -p "🤔 Do you want to apply these changes? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Deployment cancelled"
    rm -f tfplan-intervention
    exit 0
fi

# Apply the changes
echo ""
echo "🚀 Applying changes..."
terraform apply tfplan-intervention

# Clean up plan file
rm -f tfplan-intervention

echo ""
echo "✅ Deployment complete!"
echo ""

# Get the Lambda function ARN
LAMBDA_ARN=$(terraform output -raw intervention_executor_function_arn 2>/dev/null || echo "N/A")
SNS_TOPIC_ARN=$(terraform output -raw intervention_sns_topic_arn 2>/dev/null || echo "N/A")

echo "📊 Deployment Summary:"
echo "====================="
echo "Lambda Function ARN: $LAMBDA_ARN"
echo "SNS Topic ARN: $SNS_TOPIC_ARN"
echo ""

# Test the Lambda function
echo "🧪 Testing Lambda function..."
aws lambda invoke \
    --function-name intervention-executor \
    --payload '{"userId":"test-user","interventionType":"live_chat_offer","riskLevel":"high","riskScore":0.85}' \
    --region $AWS_REGION \
    response.json

echo ""
echo "📄 Lambda Response:"
cat response.json | jq '.' 2>/dev/null || cat response.json
rm -f response.json

echo ""
echo "✅ Intervention Executor is now deployed and ready!"
echo ""
echo "📝 Next Steps:"
echo "1. Update the struggle_detector Lambda to use this function"
echo "2. Configure SNS topic subscriptions for notifications"
echo "3. Set up SES for email interventions (if needed)"
echo "4. Test the end-to-end flow with a high-risk user scenario"
echo ""
