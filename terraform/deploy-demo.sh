#!/bin/bash

# Demo-optimized deployment script for User Journey Analytics Agent
# This script deploys infrastructure with cost optimizations for demonstration purposes

set -e

ACTION=${1:-plan}
AWS_REGION=${2:-us-east-1}

# Validate action
if [[ ! "$ACTION" =~ ^(plan|apply|destroy|cost-estimate)$ ]]; then
    echo "Error: Action must be plan, apply, destroy, or cost-estimate"
    exit 1
fi

echo "🎯 Demo Deployment - User Journey Analytics Agent"
echo "   Action: $ACTION"
echo "   Region: $AWS_REGION"
echo "   Optimized for: Cost efficiency and demonstration"
echo ""

# Set demo environment variables
export TF_VAR_is_demo_environment=true
export TF_VAR_demo_cost_optimization=true
export TF_VAR_aws_region=$AWS_REGION

# Initialize Terraform with demo backend
echo "📋 Initializing Terraform for demo environment..."
terraform init -backend-config="environments/demo-backend.hcl" -reconfigure

# Select or create demo workspace
echo "🏗️  Setting up demo workspace..."
terraform workspace select demo 2>/dev/null || terraform workspace new demo

# Validate configuration
echo "✅ Validating demo configuration..."
terraform validate

# Execute the requested action
case $ACTION in
    plan)
        echo "📊 Planning demo deployment..."
        terraform plan -var-file="environments/demo.tfvars" -out="demo.tfplan"
        
        echo ""
        echo "💡 Demo Configuration Summary:"
        echo "   • Kinesis: 1 shard (minimal cost)"
        echo "   • Lambda: 256MB memory (cost optimized)"
        echo "   • Data retention: 7-30 days (reduced storage)"
        echo "   • SageMaker: Disabled for demo (significant cost savings)"
        echo "   • Timestream: Disabled for demo (cost optimization)"
        echo ""
        ;;
    apply)
        echo "🚀 Deploying demo infrastructure..."
        if [ -f "demo.tfplan" ]; then
            terraform apply "demo.tfplan"
        else
            terraform apply -var-file="environments/demo.tfvars" -auto-approve
        fi
        
        echo ""
        echo "✅ Demo deployment completed!"
        echo ""
        echo "📋 Next steps:"
        echo "   1. Configure demo data seeding"
        echo "   2. Set up cost monitoring alerts"
        echo "   3. Test demo scenarios"
        echo ""
        ;;
    destroy)
        echo "💥 Destroying demo infrastructure..."
        terraform destroy -var-file="environments/demo.tfvars" -auto-approve
        
        echo ""
        echo "✅ Demo infrastructure destroyed!"
        echo "💰 Cost savings: All AWS resources have been terminated"
        ;;
    cost-estimate)
        echo "💰 Estimating demo costs..."
        
        # Create a cost estimation (requires infracost tool)
        if command -v infracost &> /dev/null; then
            infracost breakdown --path . --terraform-var-file environments/demo.tfvars
        else
            echo "📊 Manual cost estimation for demo environment:"
            echo ""
            echo "Daily estimated costs:"
            echo "   • DynamoDB (PAY_PER_REQUEST): ~$1-5/day"
            echo "   • Kinesis (1 shard): ~$0.36/day"
            echo "   • Lambda (256MB, moderate usage): ~$0.50-2/day"
            echo "   • S3 (minimal storage): ~$0.10-0.50/day"
            echo "   • CloudWatch (basic monitoring): ~$0.20-1/day"
            echo "   • VPC (NAT Gateway): ~$1.35/day"
            echo ""
            echo "Total estimated daily cost: $3-10/day"
            echo "Monthly estimate: $90-300/month"
            echo ""
            echo "💡 Install 'infracost' for detailed cost analysis:"
            echo "   brew install infracost"
            echo "   infracost auth login"
        fi
        ;;
esac

# Show outputs for successful apply
if [[ "$ACTION" == "apply" ]]; then
    echo "📋 Demo infrastructure outputs:"
    terraform output
    
    echo ""
    echo "🎯 Demo Environment Ready!"
    echo ""
    echo "Cost monitoring alerts configured at:"
    echo "   • $100 threshold"
    echo "   • $200 threshold" 
    echo "   • $300 threshold"
    echo ""
    echo "📊 Monitor costs at:"
    echo "   https://console.aws.amazon.com/billing/home#/bills"
    echo ""
fi