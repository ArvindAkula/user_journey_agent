#!/bin/bash

echo "🚀 Starting Backend in Production Mode"
echo ""

# Load environment variables from .env.production
if [ -f "../.env.production" ]; then
    echo "📋 Loading environment variables from .env.production..."
    set -a
    source ../.env.production
    set +a
    echo "✅ Environment variables loaded"
    echo ""
    echo "🔐 Security Configuration:"
    echo "   JWT_SECRET: ${JWT_SECRET:0:20}..."
    echo "   ENCRYPTION_KEY: ${ENCRYPTION_KEY:0:10}..."
    echo ""
    echo "☁️  AWS Configuration:"
    echo "   AWS_REGION: $AWS_REGION"
    echo "   AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:0:15}..."
    echo "   AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY:0:10}..."
    echo "   AWS_MOCK_MODE: $AWS_MOCK_MODE"
    echo ""
    echo "💾 DynamoDB Configuration:"
    echo "   DYNAMODB_TABLE_PREFIX: $DYNAMODB_TABLE_PREFIX"
    echo "   DYNAMODB_READ_CAPACITY: $DYNAMODB_READ_CAPACITY"
    echo "   DYNAMODB_WRITE_CAPACITY: $DYNAMODB_WRITE_CAPACITY"
    echo ""
    echo "🌊 Kinesis Configuration:"
    echo "   KINESIS_STREAM_NAME: $KINESIS_STREAM_NAME"
    echo "   KINESIS_SHARD_COUNT: $KINESIS_SHARD_COUNT"
    echo ""
    echo "🔥 Firebase Configuration:"
    echo "   FIREBASE_PROJECT_ID: $FIREBASE_PROJECT_ID"
    echo "   FIREBASE_API_KEY: ${FIREBASE_API_KEY:0:15}..."
    echo ""
    echo "📊 SQS Configuration:"
    echo "   AWS_SQS_EVENT_PROCESSING_QUEUE_URL: ${AWS_SQS_EVENT_PROCESSING_QUEUE_URL:0:50}..."
    echo "   AWS_SQS_EVENT_PROCESSING_DLQ_URL: ${AWS_SQS_EVENT_PROCESSING_DLQ_URL:0:50}..."
    echo ""
    echo "🤖 Bedrock Configuration:"
    echo "   BEDROCK_AGENT_ID: $BEDROCK_AGENT_ID"
    echo "   BEDROCK_AGENT_ALIAS_ID: $BEDROCK_AGENT_ALIAS_ID"
    echo "   NOVA_MODEL_ID: $NOVA_MODEL_ID"
    echo ""
    echo "🌐 CORS Configuration:"
    echo "   CORS_ALLOWED_ORIGINS: $CORS_ALLOWED_ORIGINS"
    echo ""
    echo "📝 Logging Configuration:"
    echo "   LOG_LEVEL: $LOG_LEVEL"
    echo "   ROOT_LOG_LEVEL: $ROOT_LOG_LEVEL"
    echo ""
    echo "⚙️  Feature Flags:"
    echo "   ANALYTICS_ENABLED: $ANALYTICS_ENABLED"
    echo "   ENABLE_REALTIME: $ENABLE_REALTIME"
    echo "   ENABLE_AMAZON_Q: $ENABLE_AMAZON_Q"
    echo ""
else
    echo "❌ .env.production file not found!"
    exit 1
fi

# Verify critical variables are set
echo "🔍 Verifying critical environment variables..."
MISSING_VARS=()

if [ -z "$JWT_SECRET" ]; then
    MISSING_VARS+=("JWT_SECRET")
fi

if [ -z "$AWS_ACCESS_KEY_ID" ]; then
    MISSING_VARS+=("AWS_ACCESS_KEY_ID")
fi

if [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    MISSING_VARS+=("AWS_SECRET_ACCESS_KEY")
fi

if [ -z "$AWS_REGION" ]; then
    MISSING_VARS+=("AWS_REGION")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "❌ Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please check your .env.production file"
    exit 1
fi

echo "✅ All critical environment variables are set"
echo ""

# Start Spring Boot
echo "🔧 Starting Spring Boot with production profile..."
echo "   Profile: production"
echo "   Port: ${BACKEND_PORT:-8080}"
echo ""
mvn spring-boot:run -Dspring-boot.run.profiles=production
