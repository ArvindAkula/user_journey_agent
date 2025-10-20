# Variables for DynamoDB module

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "billing_mode" {
  description = "DynamoDB billing mode"
  type        = string
  default     = "PAY_PER_REQUEST"
}

variable "point_in_time_recovery" {
  description = "Enable point-in-time recovery"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Performance optimization variables
variable "user_profiles_read_capacity" {
  description = "Read capacity units for user profiles table"
  type        = number
  default     = 100
}

variable "user_profiles_write_capacity" {
  description = "Write capacity units for user profiles table"
  type        = number
  default     = 100
}

variable "user_events_read_capacity" {
  description = "Read capacity units for user events table"
  type        = number
  default     = 200
}

variable "user_events_write_capacity" {
  description = "Write capacity units for user events table"
  type        = number
  default     = 500
}

variable "gsi_read_capacity" {
  description = "Read capacity units for GSI"
  type        = number
  default     = 50
}

variable "gsi_write_capacity" {
  description = "Write capacity units for GSI"
  type        = number
  default     = 50
}

variable "enable_auto_scaling" {
  description = "Enable auto-scaling for DynamoDB tables"
  type        = bool
  default     = true
}

variable "auto_scaling_min_capacity" {
  description = "Minimum capacity for auto-scaling"
  type        = number
  default     = 5
}

variable "auto_scaling_max_capacity" {
  description = "Maximum capacity for auto-scaling"
  type        = number
  default     = 1000
}

variable "auto_scaling_target_utilization" {
  description = "Target utilization percentage for auto-scaling"
  type        = number
  default     = 70
}

variable "enable_dax" {
  description = "Enable DynamoDB Accelerator (DAX) for caching"
  type        = bool
  default     = false
}

variable "dax_node_type" {
  description = "DAX node type"
  type        = string
  default     = "dax.t3.small"
}

variable "dax_cluster_size" {
  description = "Number of nodes in DAX cluster"
  type        = number
  default     = 2
}