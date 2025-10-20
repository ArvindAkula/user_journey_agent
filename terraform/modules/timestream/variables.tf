# Variables for Timestream module

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "retention_memory_hours" {
  description = "Memory store retention period in hours"
  type        = number
  default     = 24
}

variable "retention_magnetic_days" {
  description = "Magnetic store retention period in days"
  type        = number
  default     = 365
}

variable "rejected_data_bucket_name" {
  description = "S3 bucket name for rejected data"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}