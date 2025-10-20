#!/bin/bash

# Terraform deployment script for User Journey Analytics Agent
# Usage: ./deploy.sh <environment> [plan|apply|destroy]

set -e

ENVIRONMENT=${1:-dev}
ACTION=${2:-plan}

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    echo "Error: Environment must be dev, staging, or prod"
    exit 1
fi

# Validate action
if [[ ! "$ACTION" =~ ^(plan|apply|destroy)$ ]]; then
    echo "Error: Action must be plan, apply, or destroy"
    exit 1
fi

echo "🚀 Deploying User Journey Analytics Agent - Environment: $ENVIRONMENT, Action: $ACTION"

# Initialize Terraform with environment-specific backend
echo "📋 Initializing Terraform..."
terraform init -backend-config="environments/${ENVIRONMENT}-backend.hcl" -reconfigure

# Select or create workspace
echo "🏗️  Setting up workspace..."
terraform workspace select $ENVIRONMENT 2>/dev/null || terraform workspace new $ENVIRONMENT

# Validate configuration
echo "✅ Validating configuration..."
terraform validate

# Execute the requested action
case $ACTION in
    plan)
        echo "📊 Planning deployment..."
        terraform plan -var-file="environments/${ENVIRONMENT}.tfvars" -out="${ENVIRONMENT}.tfplan"
        ;;
    apply)
        echo "🚀 Applying deployment..."
        if [ -f "${ENVIRONMENT}.tfplan" ]; then
            terraform apply "${ENVIRONMENT}.tfplan"
        else
            terraform apply -var-file="environments/${ENVIRONMENT}.tfvars" -auto-approve
        fi
        ;;
    destroy)
        echo "💥 Destroying infrastructure..."
        terraform destroy -var-file="environments/${ENVIRONMENT}.tfvars" -auto-approve
        ;;
esac

echo "✅ Deployment completed successfully!"

# Show outputs
if [[ "$ACTION" == "apply" ]]; then
    echo "📋 Infrastructure outputs:"
    terraform output
fi