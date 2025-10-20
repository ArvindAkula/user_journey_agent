#!/bin/bash

# Setup script for Terraform backend infrastructure
# This creates the S3 bucket and DynamoDB table needed for Terraform state management

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-us-east-1}

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod|demo)$ ]]; then
    echo "Error: Environment must be dev, staging, prod, or demo"
    exit 1
fi

PROJECT_NAME="user-journey-analytics"
BUCKET_NAME="${PROJECT_NAME}-terraform-state-${ENVIRONMENT}"
DYNAMODB_TABLE="${PROJECT_NAME}-terraform-locks-${ENVIRONMENT}"

echo "🚀 Setting up Terraform backend for environment: $ENVIRONMENT"

# Create S3 bucket for Terraform state
echo "📦 Creating S3 bucket: $BUCKET_NAME"
if aws s3 ls "s3://$BUCKET_NAME" 2>&1 | grep -q 'NoSuchBucket'; then
    aws s3 mb "s3://$BUCKET_NAME" --region "$AWS_REGION"
    
    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket "$BUCKET_NAME" \
        --versioning-configuration Status=Enabled
    
    # Enable server-side encryption
    aws s3api put-bucket-encryption \
        --bucket "$BUCKET_NAME" \
        --server-side-encryption-configuration '{
            "Rules": [
                {
                    "ApplyServerSideEncryptionByDefault": {
                        "SSEAlgorithm": "AES256"
                    }
                }
            ]
        }'
    
    # Block public access
    aws s3api put-public-access-block \
        --bucket "$BUCKET_NAME" \
        --public-access-block-configuration \
        BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
    
    echo "✅ S3 bucket created and configured"
else
    echo "ℹ️  S3 bucket already exists"
fi

# Create DynamoDB table for Terraform locks
echo "🔒 Creating DynamoDB table: $DYNAMODB_TABLE"
if ! aws dynamodb describe-table --table-name "$DYNAMODB_TABLE" >/dev/null 2>&1; then
    aws dynamodb create-table \
        --table-name "$DYNAMODB_TABLE" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region "$AWS_REGION" \
        --tags Key=Project,Value="$PROJECT_NAME" Key=Environment,Value="$ENVIRONMENT" Key=ManagedBy,Value=terraform
    
    echo "⏳ Waiting for DynamoDB table to be active..."
    aws dynamodb wait table-exists --table-name "$DYNAMODB_TABLE"
    echo "✅ DynamoDB table created"
else
    echo "ℹ️  DynamoDB table already exists"
fi

echo "✅ Terraform backend setup completed successfully!"
echo ""
echo "Backend configuration:"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  DynamoDB Table: $DYNAMODB_TABLE"
echo "  Region: $AWS_REGION"