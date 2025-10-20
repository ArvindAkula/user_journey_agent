# Variables for User Journey Analytics Agent Infrastructure

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "user-journey-analytics"
}

# DynamoDB Variables
variable "dynamodb_billing_mode" {
  description = "DynamoDB billing mode"
  type        = string
  default     = "PAY_PER_REQUEST"
}

variable "dynamodb_point_in_time_recovery" {
  description = "Enable point-in-time recovery for DynamoDB tables"
  type        = bool
  default     = true
}

# Kinesis Variables
variable "kinesis_shard_count" {
  description = "Number of shards for Kinesis Data Stream"
  type        = number
  default     = 2
}

variable "kinesis_retention_period" {
  description = "Kinesis data retention period in hours"
  type        = number
  default     = 24
}

# S3 Variables
variable "s3_lifecycle_transition_days" {
  description = "Days after which objects transition to IA storage"
  type        = number
  default     = 30
}

variable "s3_lifecycle_expiration_days" {
  description = "Days after which objects are deleted"
  type        = number
  default     = 365
}

# Lambda Variables
variable "lambda_runtime" {
  description = "Lambda runtime version"
  type        = string
  default     = "python3.11"
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 300
}

variable "lambda_memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 512
}

# Timestream Variables
variable "timestream_retention_memory_hours" {
  description = "Timestream memory store retention in hours"
  type        = number
  default     = 24
}

variable "timestream_retention_magnetic_days" {
  description = "Timestream magnetic store retention in days"
  type        = number
  default     = 365
}

# VPC Variables
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
}

# Demo Configuration Variables
variable "is_demo_environment" {
  description = "Flag to enable demo-optimized configurations for cost savings"
  type        = bool
  default     = false
}

variable "demo_cost_optimization" {
  description = "Enable aggressive cost optimization for demo environments"
  type        = bool
  default     = false
}

# SageMaker Variables
variable "sagemaker_instance_type" {
  description = "SageMaker instance type"
  type        = string
  default     = "ml.m5.large"
}

variable "sagemaker_enable_demo_mode" {
  description = "Enable demo mode for SageMaker with smaller instances"
  type        = bool
  default     = false
}

# Monitoring Variables
variable "alert_email" {
  description = "Email address for CloudWatch alerts"
  type        = string
  default     = ""
}

# Cost Management Variables
variable "cost_alert_thresholds" {
  description = "Cost alert thresholds in USD"
  type        = list(number)
  default     = [100, 200, 300]
}

variable "enable_cost_monitoring" {
  description = "Enable cost monitoring and alerts"
  type        = bool
  default     = true
}

variable "enable_automated_shutdown" {
  description = "Enable automated resource shutdown during non-demo hours"
  type        = bool
  default     = true
}

variable "shutdown_schedule" {
  description = "Cron expression for daily resource shutdown (UTC)"
  type        = string
  default     = "cron(0 18 * * ? *)"  # 6 PM UTC
}

variable "startup_schedule" {
  description = "Cron expression for daily resource startup (UTC)"
  type        = string
  default     = "cron(0 8 * * ? *)"   # 8 AM UTC
}

variable "lifecycle_cleanup_days" {
  description = "Number of days after which to completely teardown demo environment"
  type        = number
  default     = 15
}

variable "enable_lifecycle_management" {
  description = "Enable automatic environment lifecycle management"
  type        = bool
  default     = true
}

variable "demo_resource_tags" {
  description = "Standard tags for demo environment resources"
  type        = map(string)
  default = {
    Environment = "demo"
    Project     = "UserJourneyAnalytics"
    CostCenter  = "Demo"
    Owner       = "HackathonTeam"
    AutoShutdown = "true"
  }
}

# Auto-scaling Variables
variable "enable_lambda_auto_scaling" {
  description = "Enable auto-scaling for Lambda provisioned concurrency"
  type        = bool
  default     = true
}

variable "lambda_min_provisioned_concurrency" {
  description = "Minimum provisioned concurrency for Lambda functions"
  type        = number
  default     = 5
}

variable "lambda_max_provisioned_concurrency" {
  description = "Maximum provisioned concurrency for Lambda functions"
  type        = number
  default     = 100
}

variable "enable_kinesis_auto_scaling" {
  description = "Enable auto-scaling for Kinesis Data Streams"
  type        = bool
  default     = true
}

variable "kinesis_min_shard_count" {
  description = "Minimum shard count for Kinesis auto-scaling"
  type        = number
  default     = 1
}

variable "kinesis_max_shard_count" {
  description = "Maximum shard count for Kinesis auto-scaling"
  type        = number
  default     = 10
}

variable "enable_sagemaker_auto_scaling" {
  description = "Enable auto-scaling for SageMaker endpoints"
  type        = bool
  default     = true
}

variable "sagemaker_min_instance_count" {
  description = "Minimum instance count for SageMaker endpoint"
  type        = number
  default     = 1
}

variable "sagemaker_max_instance_count" {
  description = "Maximum instance count for SageMaker endpoint"
  type        = number
  default     = 5
}

variable "enable_scheduled_scaling" {
  description = "Enable scheduled scaling for demo environments"
  type        = bool
  default     = true
}

variable "demo_scale_down_schedule" {
  description = "Cron expression for scaling down demo resources"
  type        = string
  default     = "cron(0 18 * * ? *)"  # 6 PM UTC
}

variable "demo_scale_up_schedule" {
  description = "Cron expression for scaling up demo resources"
  type        = string
  default     = "cron(0 8 * * ? *)"   # 8 AM UTC
}

# Load Testing Variables
variable "enable_scheduled_load_testing" {
  description = "Enable scheduled load testing"
  type        = bool
  default     = false
}

variable "load_test_schedule" {
  description = "Cron expression for scheduled load testing"
  type        = string
  default     = "cron(0 2 * * ? *)"  # 2 AM UTC daily
}

variable "load_test_duration_seconds" {
  description = "Duration of load tests in seconds"
  type        = number
  default     = 300
}

variable "load_test_concurrent_users" {
  description = "Number of concurrent users for load testing"
  type        = number
  default     = 50
}

variable "load_test_requests_per_second" {
  description = "Requests per second for load testing"
  type        = number
  default     = 100
}

# SQS Variables
variable "sqs_max_receive_count" {
  description = "Maximum number of times a message can be received before being sent to DLQ"
  type        = number
  default     = 3
}

variable "sqs_queue_depth_alarm_threshold" {
  description = "Threshold for SQS queue depth alarm"
  type        = number
  default     = 1000
}

# S3 Cross-Region Replication Variables
variable "enable_s3_cross_region_replication" {
  description = "Enable cross-region replication for S3 buckets"
  type        = bool
  default     = false
}

variable "s3_replica_region" {
  description = "AWS region for S3 cross-region replication"
  type        = string
  default     = "us-west-2"
}

# Monitoring and Logging Variables
variable "cloudwatch_log_retention_days" {
  description = "CloudWatch log retention period in days"
  type        = number
  default     = 14
}

variable "lambda_error_alarm_threshold" {
  description = "Threshold for Lambda error count alarm"
  type        = number
  default     = 5
}

variable "lambda_duration_alarm_threshold" {
  description = "Threshold for Lambda duration alarm in milliseconds"
  type        = number
  default     = 30000
}

variable "kinesis_iterator_age_alarm_threshold" {
  description = "Threshold for Kinesis iterator age alarm in milliseconds"
  type        = number
  default     = 60000
}

variable "application_error_alarm_threshold" {
  description = "Threshold for application error count alarm"
  type        = number
  default     = 10
}

# Intervention Executor Variables
variable "support_email" {
  description = "Support team email for intervention notifications"
  type        = string
  default     = "support@example.com"
}

variable "from_email" {
  description = "From email address for SES notifications"
  type        = string
  default     = "noreply@example.com"
}
