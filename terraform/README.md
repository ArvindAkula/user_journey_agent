# User Journey Analytics Agent - Terraform Infrastructure

This directory contains the complete Terraform infrastructure configuration for the Intelligent User Journey Orchestrator system. The infrastructure is designed to be scalable, secure, and cost-effective while supporting real-time analytics and AI-powered interventions.

## 🏗️ Architecture Overview

The infrastructure includes the following AWS services:

- **DynamoDB**: User profiles, events, struggle signals, and video engagement data
- **Kinesis Data Streams**: Real-time event processing
- **Kinesis Analytics**: Stream processing with Apache Flink
- **Lambda Functions**: Event processing, struggle detection, video analysis, and interventions
- **Amazon Timestream**: Time-series analytics for metrics and trends
- **Amazon S3**: Data storage, Lambda artifacts, and Terraform state
- **Amazon Bedrock**: AI agent for intelligent decision making
- **Amazon SageMaker**: Machine learning models for predictive analytics
- **IAM**: Roles and policies for secure service interactions

## 📁 Directory Structure

```
terraform/
├── main.tf                     # Main Terraform configuration
├── variables.tf                # Input variables
├── outputs.tf                  # Output values
├── bedrock.tf                  # Bedrock Agent configuration
├── sagemaker.tf               # SageMaker ML models
├── deploy.sh                  # Deployment script
├── modules/                   # Terraform modules
│   ├── dynamodb/             # DynamoDB tables and indexes
│   ├── kinesis/              # Kinesis streams and analytics
│   ├── s3/                   # S3 buckets and policies
│   ├── timestream/           # Timestream database and tables
│   ├── iam/                  # IAM roles and policies
│   └── lambda/               # Lambda functions
└── environments/             # Environment-specific configurations
    ├── dev.tfvars           # Development environment
    ├── staging.tfvars       # Staging environment
    ├── prod.tfvars          # Production environment
    ├── dev-backend.hcl      # Dev backend configuration
    ├── staging-backend.hcl  # Staging backend configuration
    └── prod-backend.hcl     # Production backend configuration
```

## 🚀 Quick Start

### Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.0 installed
3. **Bash** shell for running deployment scripts

### Initial Setup

1. **Clone the repository** and navigate to the terraform directory:
   ```bash
   cd terraform
   ```

2. **Create S3 buckets for Terraform state** (one-time setup):
   ```bash
   # Create state buckets for each environment
   aws s3 mb s3://user-journey-analytics-terraform-state-dev
   aws s3 mb s3://user-journey-analytics-terraform-state-staging
   aws s3 mb s3://user-journey-analytics-terraform-state-prod
   
   # Create DynamoDB tables for state locking
   aws dynamodb create-table \
     --table-name user-journey-analytics-terraform-locks-dev \
     --attribute-definitions AttributeName=LockID,AttributeType=S \
     --key-schema AttributeName=LockID,KeyType=HASH \
     --billing-mode PAY_PER_REQUEST
   ```

3. **Deploy to development environment**:
   ```bash
   ./deploy.sh dev plan    # Review the plan
   ./deploy.sh dev apply   # Apply the changes
   ```

### Environment Deployment

Deploy to different environments using the deployment script:

```bash
# Development
./deploy.sh dev plan
./deploy.sh dev apply

# Staging
./deploy.sh staging plan
./deploy.sh staging apply

# Production
./deploy.sh prod plan
./deploy.sh prod apply
```

### Manual Deployment

If you prefer manual deployment:

```bash
# Initialize with environment-specific backend
terraform init -backend-config="environments/dev-backend.hcl"

# Select workspace
terraform workspace select dev || terraform workspace new dev

# Plan deployment
terraform plan -var-file="environments/dev.tfvars"

# Apply deployment
terraform apply -var-file="environments/dev.tfvars"
```

## 🔧 Configuration

### Environment Variables

Each environment has its own configuration file in the `environments/` directory:

- **dev.tfvars**: Development environment with minimal resources
- **staging.tfvars**: Staging environment with production-like setup
- **prod.tfvars**: Production environment with high availability and retention

### Key Configuration Options

| Variable | Description | Dev | Staging | Prod |
|----------|-------------|-----|---------|------|
| `kinesis_shard_count` | Number of Kinesis shards | 1 | 2 | 4 |
| `lambda_memory_size` | Lambda memory allocation | 512MB | 1024MB | 1024MB |
| `dynamodb_point_in_time_recovery` | Enable PITR | false | true | true |
| `timestream_retention_magnetic_days` | Long-term retention | 30 | 90 | 2555 |

## 📊 Modules

### DynamoDB Module

Creates tables for:
- **User Profiles**: User information and preferences
- **User Events**: Real-time user interactions
- **Struggle Signals**: Detected user difficulties
- **Video Engagement**: Video viewing analytics

Features:
- Global Secondary Indexes for efficient querying
- TTL for automatic data cleanup
- Point-in-time recovery (staging/prod)
- Server-side encryption

### Kinesis Module

Provides:
- **Data Stream**: Real-time event ingestion
- **Analytics Application**: Apache Flink processing
- **KMS Encryption**: Data encryption in transit and at rest

### Lambda Module

Includes four Lambda functions:
- **Event Processor**: Main event processing pipeline
- **Struggle Detector**: AI-powered struggle signal analysis
- **Video Analyzer**: Video engagement intelligence
- **Intervention Executor**: Automated user interventions

### Timestream Module

Time-series database with tables for:
- **Video Engagement**: Video viewing metrics over time
- **User Metrics**: User behavior trends
- **Session Analytics**: Session-based analytics
- **Struggle Signals**: Time-series struggle data

### S3 Module

Buckets for:
- **Event Logs**: Raw event data storage
- **Analytics Data**: Processed analytics data
- **Lambda Artifacts**: Function deployment packages
- **Terraform State**: Infrastructure state files

### IAM Module

Roles and policies for:
- **Lambda Execution**: Function execution permissions
- **Bedrock Agent**: AI agent permissions
- **SageMaker**: ML model training and inference
- **Kinesis Analytics**: Stream processing permissions

## 🤖 AI Services

### Amazon Bedrock Agent

The Bedrock Agent is configured with three action groups:

1. **Struggle Detection**: Analyzes user struggle patterns
2. **Video Intelligence**: Processes video engagement data
3. **Intervention Engine**: Executes user interventions

### Amazon SageMaker

ML components include:
- **Exit Risk Predictor**: Model for predicting user churn
- **Video Engagement Model**: Content recommendation engine
- **Feature Engineering**: Data preprocessing pipeline
- **Notebook Instance**: Development environment (dev only)

## 🔒 Security

### Encryption
- All data encrypted at rest using AWS managed keys
- Kinesis streams encrypted with customer-managed KMS keys
- S3 buckets with server-side encryption

### Access Control
- Least privilege IAM policies
- Service-specific roles with minimal permissions
- Resource-based policies for cross-service access

### Network Security
- Private subnets for sensitive resources
- Security groups with restrictive rules
- VPC endpoints for AWS service communication

## 📈 Monitoring

### CloudWatch Integration
- Lambda function logs and metrics
- DynamoDB performance metrics
- Kinesis stream monitoring
- Custom application metrics

### Alerting
- High error rate alerts
- Performance degradation notifications
- Cost anomaly detection
- Security event monitoring

## 💰 Cost Optimization

### Resource Sizing
- Environment-specific instance types
- Auto-scaling for variable workloads
- Reserved capacity for predictable usage

### Data Lifecycle
- S3 lifecycle policies for cost-effective storage
- DynamoDB TTL for automatic cleanup
- Timestream retention policies

## 🔄 CI/CD Integration

The infrastructure supports CI/CD workflows:

```yaml
# Example GitHub Actions workflow
- name: Deploy Infrastructure
  run: |
    cd terraform
    ./deploy.sh ${{ env.ENVIRONMENT }} apply
```

## 🛠️ Troubleshooting

### Common Issues

1. **State Lock Issues**:
   ```bash
   terraform force-unlock <LOCK_ID>
   ```

2. **Backend Configuration**:
   ```bash
   terraform init -reconfigure
   ```

3. **Module Dependencies**:
   ```bash
   terraform get -update
   ```

### Validation

Validate configuration before deployment:
```bash
terraform validate
terraform fmt -check
```

## 📚 Additional Resources

- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Terraform Best Practices](https://www.terraform.io/docs/cloud/guides/recommended-practices/index.html)
- [AWS Security Best Practices](https://aws.amazon.com/architecture/security-identity-compliance/)

## 🤝 Contributing

1. Follow Terraform formatting standards
2. Update documentation for new resources
3. Test changes in development environment
4. Use semantic versioning for releases

## 📄 License

This infrastructure code is part of the User Journey Analytics Agent project.