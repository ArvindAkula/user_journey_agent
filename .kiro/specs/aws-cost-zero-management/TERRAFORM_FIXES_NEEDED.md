# Terraform Configuration Fixes Needed

## Current Issues

### 1. Terraform State Not Accessible
**Problem:** Running `terraform state list` shows "No state file was found"  
**Cause:** Backend configuration mismatch or state not initialized  
**Impact:** Cannot manage existing resources with Terraform

### 2. Resources Not Managed by Terraform
Some resources appear to be created manually or outside of the current Terraform configuration:
- Lambda function `demo-fin-stream-handler` (not in Terraform)
- Some DynamoDB tables may not be in current state

### 3. Failed SageMaker Endpoint
**Resource:** `user-journey-analytics-exit-risk-endpoint`  
**Status:** Failed  
**Error:** "Primary container did not pass ping health check"  
**Impact:** Resource exists but not functional, should be deleted or fixed

## Recommended Fixes

### Fix 1: Initialize Terraform Backend

```bash
cd terraform
terraform init -backend-config=backend-dev.hcl -reconfigure
```

This will reconfigure the backend to use the correct S3 bucket and DynamoDB table.

### Fix 2: Import Existing Resources

After initializing, import resources that exist in AWS but not in Terraform state:

```bash
# Import Kinesis stream
terraform import module.kinesis.aws_kinesis_stream.user_events user-journey-analytics-user-events

# Import DynamoDB tables
terraform import module.dynamodb.aws_dynamodb_table.user_profiles user-journey-analytics-user-profiles
terraform import module.dynamodb.aws_dynamodb_table.user_events user-journey-analytics-user-events
terraform import module.dynamodb.aws_dynamodb_table.struggle_signals user-journey-analytics-struggle-signals
terraform import module.dynamodb.aws_dynamodb_table.video_engagement user-journey-analytics-video-engagement

# Import Lambda functions
terraform import module.lambda.aws_lambda_function.event_processor event_processor
terraform import module.lambda.aws_lambda_function.intervention_executor intervention-executor
```

### Fix 3: Delete Failed SageMaker Endpoint

```bash
aws sagemaker delete-endpoint --endpoint-name user-journey-analytics-exit-risk-endpoint
```

Then update Terraform to not create it, or fix the container health check issue.

### Fix 4: Add Resource Tagging

Ensure all resources have consistent tags for identification:

```hcl
tags = {
  Project     = "user-journey-analytics"
  Environment = var.environment
  ManagedBy   = "terraform"
  CostCenter  = "demo"
}
```

### Fix 5: Update Terraform Variables for Cost Optimization

Add variables to easily switch between cost modes:

```hcl
variable "cost_optimization_mode" {
  description = "Enable cost optimization (minimal resources)"
  type        = bool
  default     = false
}

# In kinesis module
shard_count = var.cost_optimization_mode ? 1 : var.kinesis_shard_count
```

## Implementation Plan

1. **Backup Current State**
   ```bash
   aws s3 cp s3://user-journey-analytics-terraform-state-dev/ ./terraform-state-backup/ --recursive
   ```

2. **Reinitialize Terraform**
   ```bash
   cd terraform
   terraform init -backend-config=backend-dev.hcl -reconfigure
   ```

3. **Verify State**
   ```bash
   terraform state list
   terraform plan
   ```

4. **Import Missing Resources**
   - Use import commands above for resources not in state

5. **Clean Up Failed Resources**
   ```bash
   aws sagemaker delete-endpoint --endpoint-name user-journey-analytics-exit-risk-endpoint
   ```

6. **Apply Terraform Configuration**
   ```bash
   terraform plan -out=tfplan
   terraform apply tfplan
   ```

7. **Verify All Resources**
   ```bash
   terraform state list
   aws resourcegroupstaggingapi get-resources --tag-filters Key=Project,Values=user-journey-analytics
   ```

## Expected Outcome

After these fixes:
- All resources will be managed by Terraform
- Resource state will be accessible and up-to-date
- Failed resources will be cleaned up
- Cost optimization can be controlled via Terraform variables
- The resource manager script can reliably stop/start resources
