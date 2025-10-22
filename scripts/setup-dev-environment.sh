#!/bin/bash

# Development Environment Setup Script
# This script sets up LocalStack and Firebase Emulator for local development

set -e

echo "=========================================="
echo "Development Environment Setup"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"

# Start LocalStack
echo ""
echo "Starting LocalStack..."
if docker ps | grep -q localstack; then
    echo -e "${YELLOW}LocalStack is already running${NC}"
else
    docker run -d \
        --name localstack \
        -p 4566:4566 \
        -p 4571:4571 \
        -e SERVICES=dynamodb,kinesis,s3,sqs,cloudwatch,ec2,lambda \
        -e DEBUG=1 \
        -e DATA_DIR=/tmp/localstack/data \
        localstack/localstack
    
    echo -e "${GREEN}✓ LocalStack started${NC}"
    
    # Wait for LocalStack to be ready
    echo "Waiting for LocalStack to be ready..."
    sleep 5
fi

# Verify LocalStack health
echo ""
echo "Checking LocalStack health..."
if curl -s http://localhost:4566/_localstack/health > /dev/null; then
    echo -e "${GREEN}✓ LocalStack is healthy${NC}"
else
    echo -e "${RED}Error: LocalStack is not responding${NC}"
    exit 1
fi

# Initialize LocalStack resources
echo ""
echo "Initializing LocalStack resources..."

# Create DynamoDB tables
echo "Creating DynamoDB tables..."
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
    --table-name UserProfiles \
    --attribute-definitions AttributeName=userId,AttributeType=S \
    --key-schema AttributeName=userId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region us-east-1 > /dev/null 2>&1 || echo "UserProfiles table already exists"

aws --endpoint-url=http://localhost:4566 dynamodb create-table \
    --table-name UserEvents \
    --attribute-definitions AttributeName=eventId,AttributeType=S \
    --key-schema AttributeName=eventId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region us-east-1 > /dev/null 2>&1 || echo "UserEvents table already exists"

echo -e "${GREEN}✓ DynamoDB tables created${NC}"

# Create Kinesis stream
echo "Creating Kinesis stream..."
aws --endpoint-url=http://localhost:4566 kinesis create-stream \
    --stream-name user-events-stream-dev \
    --shard-count 1 \
    --region us-east-1 > /dev/null 2>&1 || echo "Kinesis stream already exists"

echo -e "${GREEN}✓ Kinesis stream created${NC}"

# Create S3 bucket
echo "Creating S3 bucket..."
aws --endpoint-url=http://localhost:4566 s3 mb s3://user-journey-analytics-data-dev \
    --region us-east-1 > /dev/null 2>&1 || echo "S3 bucket already exists"

echo -e "${GREEN}✓ S3 bucket created${NC}"

# Create SQS queues
echo "Creating SQS queues..."
aws --endpoint-url=http://localhost:4566 sqs create-queue \
    --queue-name user-journey-dlq-dev \
    --region us-east-1 > /dev/null 2>&1 || echo "DLQ already exists"

aws --endpoint-url=http://localhost:4566 sqs create-queue \
    --queue-name user-journey-retry-dev \
    --region us-east-1 > /dev/null 2>&1 || echo "Retry queue already exists"

echo -e "${GREEN}✓ SQS queues created${NC}"

# List created resources
echo ""
echo "=========================================="
echo "LocalStack Resources Summary"
echo "=========================================="
echo "DynamoDB Tables:"
aws --endpoint-url=http://localhost:4566 dynamodb list-tables --region us-east-1 | grep -A 10 TableNames

echo ""
echo "Kinesis Streams:"
aws --endpoint-url=http://localhost:4566 kinesis list-streams --region us-east-1 | grep -A 10 StreamNames

echo ""
echo "S3 Buckets:"
aws --endpoint-url=http://localhost:4566 s3 ls

echo ""
echo "SQS Queues:"
aws --endpoint-url=http://localhost:4566 sqs list-queues --region us-east-1 | grep -A 10 QueueUrls

echo ""
echo "=========================================="
echo -e "${GREEN}Development environment setup complete!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Start Firebase Emulator: firebase emulators:start"
echo "2. Start Backend: cd backend && SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run"
echo "3. Start Frontend: cd packages/user-app && npm start"
echo ""
echo "LocalStack UI: http://localhost:4566"
echo "Firebase Emulator UI: http://localhost:4000 (after starting emulator)"
echo ""
