# Variables for S3 module

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "lifecycle_transition_days" {
  description = "Days after which objects transition to IA storage"
  type        = number
  default     = 30
}

variable "lifecycle_expiration_days" {
  description = "Days after which objects are deleted"
  type        = number
  default     = 365
}

variable "enable_cross_region_replication" {
  description = "Enable cross-region replication for critical data"
  type        = bool
  default     = false
}

variable "replica_region" {
  description = "AWS region for cross-region replication"
  type        = string
  default     = "us-west-2"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}