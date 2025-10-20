#!/bin/bash

# Setup Local AWS Services for User Journey Analytics
echo "🚀 Setting up local AWS services..."

# Wait for LocalStack to be ready
echo "⏳ Waiting for LocalStack to be ready..."
until curl -s http://localhost:4566/_localstack/health | grep -q '"dynamodb": "available"'; do
  echo "Waiting for LocalStack DynamoDB..."
  sleep 2
done

echo "✅ LocalStack is ready!"

# Set AWS CLI to use LocalStack
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
export AWS_ENDPOINT_URL=http://localhost:4566

# Create DynamoDB Tables
echo "📊 Creating DynamoDB tables..."

# User Profiles Table
aws dynamodb create-table \
    --table-name UserProfiles \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
        AttributeName=userSegment,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
    --global-secondary-indexes \
        IndexName=UserSegmentIndex,KeySchema=[{AttributeName=userSegment,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --endpoint-url http://localhost:4566

# User Events Table
aws dynamodb create-table \
    --table-name UserEvents \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
        AttributeName=timestamp,AttributeType=N \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
        AttributeName=timestamp,KeyType=RANGE \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --endpoint-url http://localhost:4566

# Struggle Signals Table
aws dynamodb create-table \
    --table-name StruggleSignals \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
        AttributeName=featureId,AttributeType=S \
        AttributeName=struggleCount,AttributeType=N \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
        AttributeName=featureId,KeyType=RANGE \
    --global-secondary-indexes \
        IndexName=FeatureStruggleIndex,KeySchema=[{AttributeName=featureId,KeyType=HASH},{AttributeName=struggleCount,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --endpoint-url http://localhost:4566

# Video Engagement Table
aws dynamodb create-table \
    --table-name VideoEngagement \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
        AttributeName=videoId,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
        AttributeName=videoId,KeyType=RANGE \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --endpoint-url http://localhost:4566

echo "✅ DynamoDB tables created!"

# Create Kinesis Stream
echo "🌊 Creating Kinesis stream..."
aws kinesis create-stream \
    --stream-name user-events-stream \
    --shard-count 1 \
    --endpoint-url http://localhost:4566

echo "✅ Kinesis stream created!"

# Create S3 Bucket
echo "🪣 Creating S3 bucket..."
aws s3 mb s3://user-journey-analytics-data \
    --endpoint-url http://localhost:4566

echo "✅ S3 bucket created!"

# Create SQS Queues
echo "📬 Creating SQS queues..."
aws sqs create-queue \
    --queue-name user-events-dlq \
    --endpoint-url http://localhost:4566

aws sqs create-queue \
    --queue-name user-events-retry \
    --endpoint-url http://localhost:4566

echo "✅ SQS queues created!"

# Seed some sample data
echo "🌱 Seeding sample data..."

# Create sample user profile
aws dynamodb put-item \
    --table-name UserProfiles \
    --item '{
        "userId": {"S": "demo-user-1"},
        "userSegment": {"S": "new_user"},
        "createdAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"},
        "lastActiveAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"},
        "preferences": {
            "M": {
                "contentCategories": {"SS": ["tutorial", "educational"]},
                "preferredInteractionStyle": {"S": "guided"}
            }
        },
        "behaviorMetrics": {
            "M": {
                "totalSessions": {"N": "1"},
                "avgSessionDuration": {"N": "300"},
                "featureAdoptionRate": {"N": "0.2"}
            }
        },
        "riskFactors": {
            "M": {
                "exitRiskScore": {"N": "25"},
                "lastRiskAssessment": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}
            }
        }
    }' \
    --endpoint-url http://localhost:4566

echo "✅ Sample data seeded!"

echo "🎉 Local AWS setup complete!"
echo ""
echo "📋 Services available:"
echo "   - DynamoDB: http://localhost:4566"
echo "   - DynamoDB Admin UI: http://localhost:8001"
echo "   - Kinesis: http://localhost:4566"
echo "   - S3: http://localhost:4566"
echo "   - Redis: localhost:6379"
echo ""
echo "🔧 Next steps:"
echo "   1. Start the backend: cd backend && mvn spring-boot:run"
echo "   2. Start the frontend: cd frontend && npm start"
echo "   3. Open http://localhost:3000 to see the app"