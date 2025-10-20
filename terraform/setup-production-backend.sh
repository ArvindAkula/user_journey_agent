#!/bin/bash

# Setup production backend infrastructure for Terraform state management
# This script creates the S3 bucket and DynamoDB table needed for Terraform remote state

set -e

ENVIRONMENT="prod"
PROJECT_NAME="user-journey-analytics"
AWS_REGION="us-east-1"
BUCKET_NAME="${PROJECT_NAME}-terraform-state-${ENVIRONMENT}"
DYNAMODB_TABLE="${PROJECT_NAME}-terraform-locks-${ENVIRONMENT}"

echo "🚀 Setting up Terraform backend infrastructure for production..."
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo "S3 Bucket: $BUCKET_NAME"
echo "DynamoDB Table: $DYNAMODB_TABLE"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "❌ Error: AWS CLI is not configured or credentials are invalid"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: $ACCOUNT_ID"

# Create S3 bucket for Terraform state
echo "📦 Creating S3 bucket for Terraform state..."
if aws s3 ls "s3://$BUCKET_NAME" >/dev/null 2>&1; then
    echo "✅ S3 bucket already exists: $BUCKET_NAME"
else
    if [ "$AWS_REGION" = "us-east-1" ]; then
        aws s3 mb "s3://$BUCKET_NAME" --region "$AWS_REGION"
    else
        aws s3 mb "s3://$BUCKET_NAME" --region "$AWS_REGION" --create-bucket-configuration LocationConstraint="$AWS_REGION"
    fi
    echo "✅ Created S3 bucket: $BUCKET_NAME"
fi

# Enable versioning on the S3 bucket
echo "🔄 Enabling versioning on S3 bucket..."
aws s3api put-bucket-versioning \
    --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled
echo "✅ Versioning enabled on S3 bucket"

# Enable server-side encryption on the S3 bucket
echo "🔒 Enabling server-side encryption on S3 bucket..."
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
echo "✅ Server-side encryption enabled on S3 bucket"

# Block public access to the S3 bucket
echo "🚫 Blocking public access to S3 bucket..."
aws s3api put-public-access-block \
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration \
        BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
echo "✅ Public access blocked on S3 bucket"

# Create DynamoDB table for Terraform state locking
echo "🗄️  Creating DynamoDB table for Terraform state locking..."
if aws dynamodb describe-table --table-name "$DYNAMODB_TABLE" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo "✅ DynamoDB table already exists: $DYNAMODB_TABLE"
else
    aws dynamodb create-table \
        --table-name "$DYNAMODB_TABLE" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region "$AWS_REGION" \
        --tags Key=Project,Value="$PROJECT_NAME" Key=Environment,Value="$ENVIRONMENT" Key=Purpose,Value=TerraformStateLocking
    
    echo "⏳ Waiting for DynamoDB table to be active..."
    aws dynamodb wait table-exists --table-name "$DYNAMODB_TABLE" --region "$AWS_REGION"
    echo "✅ Created DynamoDB table: $DYNAMODB_TABLE"
fi

echo ""
echo "🎉 Backend infrastructure setup completed successfully!"
echo ""
echo "Backend configuration:"
echo "  bucket         = \"$BUCKET_NAME\""
echo "  key            = \"prod/terraform.tfstate\""
echo "  region         = \"$AWS_REGION\""
echo "  encrypt        = true"
echo "  dynamodb_table = \"$DYNAMODB_TABLE\""
echo ""
echo "You can now run: ./deploy.sh prod plan"