# Variables for Monitoring module

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention period in days"
  type        = number
  default     = 14
}

variable "dynamodb_table_names" {
  description = "List of DynamoDB table names to monitor"
  type        = list(string)
}

variable "lambda_function_names" {
  description = "List of Lambda function names to monitor"
  type        = list(string)
}

variable "kinesis_stream_name" {
  description = "Kinesis stream name to monitor"
  type        = string
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for alarm notifications"
  type        = string
}

variable "lambda_error_threshold" {
  description = "Threshold for Lambda error count alarm"
  type        = number
  default     = 5
}

variable "lambda_duration_threshold" {
  description = "Threshold for Lambda duration alarm in milliseconds"
  type        = number
  default     = 30000
}

variable "kinesis_iterator_age_threshold" {
  description = "Threshold for Kinesis iterator age alarm in milliseconds"
  type        = number
  default     = 60000
}

variable "application_error_threshold" {
  description = "Threshold for application error count alarm"
  type        = number
  default     = 10
}

variable "create_additional_sns_topic" {
  description = "Whether to create an additional SNS topic for alerts"
  type        = bool
  default     = false
}

variable "additional_alert_email" {
  description = "Additional email address for alert notifications"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}