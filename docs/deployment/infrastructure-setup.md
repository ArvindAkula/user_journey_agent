# Infrastructure Setup Guide

## Prerequisites

- AWS CLI configured with appropriate credentials
- Terraform installed (v1.6.0 or later)
- Proper AWS permissions for VPC, Lambda, DynamoDB, etc.

## Quick Start

### 1. Clone and Navigate
```bash
git clone <repository-url>
cd user-journey-analytics-agent
```

### 2. Initialize Terraform
```bash
cd terraform
terraform init
```

### 3. Select Environment
```bash
terraform workspace select dev
# or create new workspace
terraform workspace new dev
```

### 4. Plan Deployment
```bash
terraform plan
```

### 5. Deploy Infrastructure
```bash
terraform apply
```

## Environment Configuration

### Development Environment
- Reduced resource allocation for cost optimization
- Shorter data retention periods
- Single Kinesis shard
- ml.t2.medium SageMaker instances

### Production Environment
- Full resource allocation
- Extended data retention
- Multiple Kinesis shards
- ml.m5.large SageMaker instances

## Cost Optimization

### Demo/Testing (15 days)
Estimated cost: $150-250

### Development Environment
Monthly cost: $800-1,200

### Production Environment
Monthly cost: $1,200-2,000

## Monitoring Setup

After deployment, configure:
- CloudWatch dashboards
- Billing alerts
- Cost monitoring
- Performance metrics

## Troubleshooting

### Common Issues
1. **Terraform Lock**: Use `terraform force-unlock <lock-id>`
2. **Resource Limits**: Check AWS service quotas
3. **Permissions**: Verify IAM policies
4. **Naming Conflicts**: Ensure unique resource names

### Verification Commands
```bash
# Check VPC deployment
aws ec2 describe-vpcs --filters "Name=tag:Project,Values=user-journey-analytics"

# Check Lambda functions
aws lambda list-functions --query 'Functions[?contains(FunctionName, `user-journey-analytics`)]'

# Check DynamoDB tables
aws dynamodb list-tables --query 'TableNames[?contains(@, `user-journey-analytics`)]'
```