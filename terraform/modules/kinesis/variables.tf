# Variables for Kinesis module

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "shard_count" {
  description = "Number of shards for Kinesis Data Stream"
  type        = number
  default     = 2
}

variable "retention_period" {
  description = "Data retention period in hours"
  type        = number
  default     = 24
}

variable "kinesis_analytics_role_arn" {
  description = "ARN of the IAM role for Kinesis Analytics"
  type        = string
}

variable "stream_mode" {
  description = "Stream mode for Kinesis Data Stream (PROVISIONED or ON_DEMAND)"
  type        = string
  default     = "PROVISIONED"
  validation {
    condition     = contains(["PROVISIONED", "ON_DEMAND"], var.stream_mode)
    error_message = "Stream mode must be either PROVISIONED or ON_DEMAND."
  }
}

variable "enable_auto_scaling" {
  description = "Enable auto-scaling for Kinesis Data Stream"
  type        = bool
  default     = true
}

variable "min_shard_count" {
  description = "Minimum shard count for auto-scaling"
  type        = number
  default     = 1
}

variable "max_shard_count" {
  description = "Maximum shard count for auto-scaling"
  type        = number
  default     = 10
}

variable "auto_scaling_target_utilization" {
  description = "Target utilization percentage for auto-scaling"
  type        = number
  default     = 70
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}