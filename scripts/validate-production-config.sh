#!/bin/bash

# Production Configuration Validation Script
# This script validates that all required environment variables are set for production deployment

set -e

echo "🔍 Validating Production Configuration..."
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validation results
VALIDATION_ERRORS=0
VALIDATION_WARNINGS=0

# Function to check required environment variable
check_required_var() {
    local var_name=$1
    local var_value=${!var_name}
    local description=$2
    
    if [ -z "$var_value" ]; then
        echo -e "${RED}❌ MISSING: $var_name${NC} - $description"
        ((VALIDATION_ERRORS++))
        return 1
    elif [[ "$var_value" == *"REPLACE"* ]] || [[ "$var_value" == *"YOUR_"* ]] || [[ "$var_value" == *"yourdomain"* ]]; then
        echo -e "${YELLOW}⚠️  PLACEHOLDER: $var_name${NC} - Contains placeholder value: $var_value"
        ((VALIDATION_WARNINGS++))
        return 1
    else
        echo -e "${GREEN}✅ OK: $var_name${NC}"
        return 0
    fi
}

# Function to check optional environment variable
check_optional_var() {
    local var_name=$1
    local var_value=${!var_name}
    local description=$2
    local default_value=$3
    
    if [ -z "$var_value" ]; then
        echo -e "${YELLOW}⚠️  OPTIONAL: $var_name${NC} - $description (will use default: $default_value)"
        ((VALIDATION_WARNINGS++))
    else
        echo -e "${GREEN}✅ OK: $var_name${NC}"
    fi
}

echo ""
echo "🔐 AWS Configuration"
echo "-------------------"
check_required_var "AWS_REGION" "AWS region for deployment"
check_required_var "AWS_ACCESS_KEY_ID" "AWS access key ID"
check_required_var "AWS_SECRET_ACCESS_KEY" "AWS secret access key"

echo ""
echo "🗄️  AWS Services Configuration"
echo "-----------------------------"
check_required_var "KINESIS_STREAM_NAME" "Kinesis stream name for event processing"
check_required_var "S3_BUCKET_NAME" "S3 bucket name for file storage"
check_required_var "AWS_SQS_DLQ_URL" "SQS Dead Letter Queue URL"
check_required_var "AWS_SQS_RETRY_QUEUE_URL" "SQS Retry Queue URL"

echo ""
echo "🤖 AI/ML Services Configuration"
echo "------------------------------"
check_required_var "BEDROCK_AGENT_ID" "Bedrock Agent ID for AI processing"
check_required_var "BEDROCK_AGENT_ALIAS_ID" "Bedrock Agent Alias ID"
check_required_var "SAGEMAKER_EXIT_RISK_ENDPOINT" "SageMaker endpoint for exit risk prediction"

echo ""
echo "🔥 Firebase Configuration"
echo "------------------------"
check_required_var "FIREBASE_PROJECT_ID" "Firebase project ID"
check_required_var "FIREBASE_API_KEY" "Firebase API key"
check_required_var "FIREBASE_AUTH_DOMAIN" "Firebase auth domain"
check_required_var "FIREBASE_STORAGE_BUCKET" "Firebase storage bucket"
check_required_var "FIREBASE_MESSAGING_SENDER_ID" "Firebase messaging sender ID"
check_required_var "FIREBASE_APP_ID" "Firebase app ID"

echo ""
echo "🔒 Security Configuration"
echo "------------------------"
check_required_var "JWT_SECRET" "JWT secret for token signing"
check_required_var "ENCRYPTION_KEY" "Encryption key for sensitive data"
check_required_var "REDIS_HOST" "Redis host for caching and rate limiting"
check_required_var "REDIS_PASSWORD" "Redis password"

echo ""
echo "🌐 Domain Configuration"
echo "----------------------"
check_required_var "API_BASE_URL" "Base URL for API endpoints"
check_required_var "CORS_ALLOWED_ORIGINS" "Allowed origins for CORS"

echo ""
echo "📊 Optional Configuration"
echo "------------------------"
check_optional_var "RATE_LIMIT_RPM" "Rate limit requests per minute" "1000"
check_optional_var "KINESIS_SHARD_COUNT" "Number of Kinesis shards" "2"
check_optional_var "DYNAMODB_READ_CAPACITY" "DynamoDB read capacity units" "10"
check_optional_var "DYNAMODB_WRITE_CAPACITY" "DynamoDB write capacity units" "10"

echo ""
echo "🔍 Configuration File Validation"
echo "-------------------------------"

# Check if production configuration files exist
if [ -f "backend/src/main/resources/application-production.yml" ]; then
    echo -e "${GREEN}✅ OK: application-production.yml exists${NC}"
else
    echo -e "${RED}❌ MISSING: backend/src/main/resources/application-production.yml${NC}"
    ((VALIDATION_ERRORS++))
fi

if [ -f "docker-compose.production.yml" ]; then
    echo -e "${GREEN}✅ OK: docker-compose.production.yml exists${NC}"
else
    echo -e "${RED}❌ MISSING: docker-compose.production.yml${NC}"
    ((VALIDATION_ERRORS++))
fi

if [ -f ".env.production" ]; then
    echo -e "${GREEN}✅ OK: .env.production exists${NC}"
else
    echo -e "${YELLOW}⚠️  MISSING: .env.production (copy from .env.production.template)${NC}"
    ((VALIDATION_WARNINGS++))
fi

# Check Firebase service account file
if [ -f "firebase-service-account-prod.json" ]; then
    echo -e "${GREEN}✅ OK: firebase-service-account-prod.json exists${NC}"
else
    echo -e "${RED}❌ MISSING: firebase-service-account-prod.json${NC}"
    echo "   Download this file from Firebase Console > Project Settings > Service Accounts"
    ((VALIDATION_ERRORS++))
fi

echo ""
echo "📋 Validation Summary"
echo "===================="

if [ $VALIDATION_ERRORS -eq 0 ] && [ $VALIDATION_WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 All configuration checks passed! Ready for production deployment.${NC}"
    exit 0
elif [ $VALIDATION_ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Configuration has $VALIDATION_WARNINGS warnings but no critical errors.${NC}"
    echo -e "${YELLOW}   Review warnings above and proceed with caution.${NC}"
    exit 0
else
    echo -e "${RED}❌ Configuration validation failed with $VALIDATION_ERRORS errors and $VALIDATION_WARNINGS warnings.${NC}"
    echo -e "${RED}   Fix all errors before attempting production deployment.${NC}"
    echo ""
    echo "💡 Next Steps:"
    echo "   1. Copy .env.production.template to .env.production"
    echo "   2. Replace all placeholder values with real credentials"
    echo "   3. Download Firebase service account JSON from Firebase Console"
    echo "   4. Run this script again to validate configuration"
    exit 1
fi