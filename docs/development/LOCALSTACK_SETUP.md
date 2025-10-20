# LocalStack Setup Guide

## Overview

LocalStack is a fully functional local AWS cloud stack that allows you to develop and test cloud applications offline. This guide covers the setup and usage of LocalStack for the User Journey Analytics Agent application.

## Prerequisites

- Docker Desktop installed and running
- AWS CLI installed (`brew install awscli` on macOS)
- Basic understanding of AWS services

## Quick Start

### 1. Start LocalStack

```bash
./dev-scripts/start-localstack.sh
```

This script will:
- Start LocalStack container with all required AWS services
- Initialize DynamoDB tables, Kinesis streams, S3 buckets, SQS queues, and SNS topics
- Start Redis for caching
- Start DynamoDB Admin UI for easy table management

### 2. Verify Installation

After starting LocalStack, verify that services are running:

```bash
# Check LocalStack health
curl http://localhost:4566/_localstack/health

# List DynamoDB tables
aws dynamodb list-tables --endpoint-url http://localhost:4566 --region us-east-1

# List S3 buckets
aws s3 ls --endpoint-url http://localhost:4566
```

### 3. Stop LocalStack

```bash
./dev-scripts/stop-localstack.sh
```

## Services and Ports

| Service | Port | Description |
|---------|------|-------------|
| LocalStack Gateway | 4566 | Main endpoint for all AWS services |
| DynamoDB Admin UI | 8001 | Web UI for managing DynamoDB tables |
| Redis | 6379 | Cache and session storage |

## AWS Resources Created

### DynamoDB Tables

1. **user-events**
   - Partition Key: `userId` (String)
   - Sort Key: `timestamp` (Number)
   - Purpose: Store all user interaction events

2. **user-profiles**
   - Partition Key: `userId` (String)
   - Purpose: Store user profile information

3. **struggle-signals**
   - Partition Key: `userId` (String)
   - Sort Key: `timestamp` (Number)
   - Purpose: Store detected struggle signals

4. **interventions**
   - Partition Key: `interventionId` (String)
   - GSI: `UserIdIndex` on `userId`
   - Purpose: Store intervention records

### Kinesis Streams

1. **user-events-stream**
   - Shard Count: 1
   - Purpose: Real-time event streaming

2. **struggle-signals-stream**
   - Shard Count: 1
   - Purpose: Real-time struggle signal streaming

### S3 Buckets

1. **user-journey-uploads**
   - Purpose: User file uploads

2. **user-journey-documents**
   - Purpose: Document storage

3. **user-journey-analytics**
   - Purpose: Analytics data and reports

### SQS Queues

1. **intervention-queue**
   - Purpose: Queue for intervention processing

2. **analytics-processing-queue**
   - Purpose: Queue for analytics processing

3. **intervention-dlq**
   - Purpose: Dead letter queue for failed interventions

### SNS Topics

1. **user-events-topic**
   - Purpose: Publish user events

2. **intervention-alerts-topic**
   - Purpose: Publish intervention alerts

## AWS CLI Configuration

To use AWS CLI with LocalStack, set these environment variables:

```bash
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
```

Add `--endpoint-url http://localhost:4566` to all AWS CLI commands:

```bash
# DynamoDB examples
aws dynamodb scan --table-name user-events --endpoint-url http://localhost:4566

aws dynamodb put-item \
  --table-name user-events \
  --item '{"userId": {"S": "user123"}, "timestamp": {"N": "1634567890"}, "eventType": {"S": "page_view"}}' \
  --endpoint-url http://localhost:4566

# S3 examples
aws s3 cp myfile.txt s3://user-journey-uploads/ --endpoint-url http://localhost:4566

aws s3 ls s3://user-journey-uploads/ --endpoint-url http://localhost:4566

# Kinesis examples
aws kinesis put-record \
  --stream-name user-events-stream \
  --partition-key user123 \
  --data '{"userId":"user123","event":"click"}' \
  --endpoint-url http://localhost:4566

aws kinesis get-shard-iterator \
  --stream-name user-events-stream \
  --shard-id shardId-000000000000 \
  --shard-iterator-type LATEST \
  --endpoint-url http://localhost:4566
```

## DynamoDB Admin UI

Access the DynamoDB Admin UI at http://localhost:8001

Features:
- View all tables and their data
- Add, edit, and delete items
- Query and scan tables
- View table schemas

## Backend Configuration

The backend automatically connects to LocalStack when running in development mode.

**application-dev.yml:**
```yaml
spring:
  profiles: dev

aws:
  mock:
    enabled: true
    endpoint: http://localhost:4566
  region: us-east-1

dynamodb:
  endpoint: http://localhost:4566

kinesis:
  endpoint: http://localhost:4566

s3:
  endpoint: http://localhost:4566

sqs:
  endpoint: http://localhost:4566
```

## Troubleshooting

### LocalStack won't start

1. Check if Docker is running:
   ```bash
   docker info
   ```

2. Check if port 4566 is already in use:
   ```bash
   lsof -i :4566
   ```

3. View LocalStack logs:
   ```bash
   docker-compose -f docker-compose.dev.yml logs -f localstack
   ```

### Resources not created

1. Check initialization logs:
   ```bash
   docker-compose -f docker-compose.dev.yml logs localstack | grep -A 20 "Initializing"
   ```

2. Manually run initialization script:
   ```bash
   ./dev-scripts/init-localstack.sh
   ```

### Connection refused errors

1. Ensure LocalStack is running:
   ```bash
   curl http://localhost:4566/_localstack/health
   ```

2. Check that you're using the correct endpoint URL in your configuration

3. Verify AWS credentials are set (even though they're dummy values for LocalStack)

### Data persistence

LocalStack data is persisted in the `./localstack-data` directory. To reset all data:

```bash
./dev-scripts/stop-localstack.sh
rm -rf ./localstack-data
./dev-scripts/start-localstack.sh
```

## Best Practices

1. **Always use LocalStack in development**: Never connect to production AWS services during development

2. **Reset data regularly**: Clear LocalStack data between major feature changes to avoid stale data issues

3. **Use DynamoDB Admin UI**: Leverage the UI for quick data inspection and debugging

4. **Monitor logs**: Keep an eye on LocalStack logs when debugging AWS service interactions

5. **Test with realistic data**: Populate LocalStack with data that resembles production for better testing

## Advanced Usage

### Custom Initialization

To add custom initialization logic, edit `dev-scripts/init-localstack.sh`:

```bash
# Add your custom AWS resource creation here
aws dynamodb create-table \
  --endpoint-url http://localhost:4566 \
  --table-name my-custom-table \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

### Seed Data

Create a seed data script to populate tables with test data:

```bash
#!/bin/bash
# dev-scripts/seed-localstack-data.sh

export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# Add test users
aws dynamodb put-item \
  --endpoint-url http://localhost:4566 \
  --table-name user-profiles \
  --item '{"userId": {"S": "test-user-1"}, "email": {"S": "test1@example.com"}}'

# Add test events
aws dynamodb put-item \
  --endpoint-url http://localhost:4566 \
  --table-name user-events \
  --item '{"userId": {"S": "test-user-1"}, "timestamp": {"N": "1634567890"}, "eventType": {"S": "page_view"}}'
```

### Docker Compose Profiles

Use Docker Compose profiles to start only specific services:

```bash
# Start only LocalStack (no admin UI)
docker-compose -f docker-compose.dev.yml up -d localstack

# Start LocalStack and Redis only
docker-compose -f docker-compose.dev.yml up -d localstack redis
```

## Integration with Backend

The backend Spring Boot application automatically detects the development profile and connects to LocalStack:

```java
@Configuration
@Profile("dev")
public class AwsConfig {
    @Bean
    public DynamoDbClient dynamoDbClient() {
        return DynamoDbClient.builder()
            .endpointOverride(URI.create("http://localhost:4566"))
            .region(Region.US_EAST_1)
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create("test", "test")
            ))
            .build();
    }
}
```

## Resources

- [LocalStack Documentation](https://docs.localstack.cloud/)
- [LocalStack GitHub](https://github.com/localstack/localstack)
- [AWS CLI Documentation](https://docs.aws.amazon.com/cli/)
- [DynamoDB Local Documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review LocalStack logs: `docker-compose -f docker-compose.dev.yml logs -f localstack`
3. Consult the LocalStack documentation
4. Check the project's development documentation
