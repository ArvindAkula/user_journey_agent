# Variables for Lambda module

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "runtime" {
  description = "Lambda runtime version"
  type        = string
  default     = "python3.11"
}

variable "timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 300
}

variable "memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 512
}

variable "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  type        = string
}

variable "user_profiles_table_name" {
  description = "Name of the User Profiles DynamoDB table"
  type        = string
}

variable "user_events_table_name" {
  description = "Name of the User Events DynamoDB table"
  type        = string
}

variable "struggle_signals_table_name" {
  description = "Name of the Struggle Signals DynamoDB table"
  type        = string
}

variable "video_engagement_table_name" {
  description = "Name of the Video Engagement DynamoDB table"
  type        = string
}

variable "timestream_database_name" {
  description = "Name of the Timestream database"
  type        = string
}

variable "kinesis_stream_name" {
  description = "Name of the Kinesis Data Stream"
  type        = string
}

variable "kinesis_stream_arn" {
  description = "ARN of the Kinesis Data Stream"
  type        = string
}

variable "bedrock_agent_id" {
  description = "ID of the Bedrock Agent"
  type        = string
  default     = ""
}

variable "sns_topic_arn" {
  description = "ARN of the SNS topic for notifications"
  type        = string
  default     = ""
}

variable "subnet_ids" {
  description = "List of subnet IDs for Lambda VPC configuration"
  type        = list(string)
  default     = []
}

variable "security_group_ids" {
  description = "List of security group IDs for Lambda VPC configuration"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Performance optimization variables
variable "optimized_memory_size" {
  description = "Optimized Lambda function memory size in MB based on profiling"
  type        = number
  default     = 1024
}

variable "reserved_concurrency" {
  description = "Reserved concurrency for Lambda functions"
  type        = number
  default     = 100
}

variable "enable_provisioned_concurrency" {
  description = "Enable provisioned concurrency for consistent performance"
  type        = bool
  default     = false
}

variable "provisioned_concurrency_count" {
  description = "Number of provisioned concurrent executions"
  type        = number
  default     = 10
}

variable "dlq_arn" {
  description = "ARN of the dead letter queue for error handling"
  type        = string
  default     = ""
}

variable "enable_x_ray_tracing" {
  description = "Enable X-Ray tracing for performance monitoring"
  type        = bool
  default     = true
}

variable "batch_size" {
  description = "Batch size for Kinesis event source mapping"
  type        = number
  default     = 100
}

variable "parallelization_factor" {
  description = "Parallelization factor for Kinesis processing"
  type        = number
  default     = 10
}

variable "maximum_batching_window_in_seconds" {
  description = "Maximum batching window for Kinesis events"
  type        = number
  default     = 5
}