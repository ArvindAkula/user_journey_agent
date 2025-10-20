# Outputs for S3 module

output "event_logs_bucket_name" {
  description = "Name of the event logs S3 bucket"
  value       = aws_s3_bucket.event_logs.bucket
}

output "event_logs_bucket_arn" {
  description = "ARN of the event logs S3 bucket"
  value       = aws_s3_bucket.event_logs.arn
}

output "analytics_data_bucket_name" {
  description = "Name of the analytics data S3 bucket"
  value       = aws_s3_bucket.analytics_data.bucket
}

output "analytics_data_bucket_arn" {
  description = "ARN of the analytics data S3 bucket"
  value       = aws_s3_bucket.analytics_data.arn
}

output "lambda_artifacts_bucket_name" {
  description = "Name of the Lambda artifacts S3 bucket"
  value       = aws_s3_bucket.lambda_artifacts.bucket
}

output "lambda_artifacts_bucket_arn" {
  description = "ARN of the Lambda artifacts S3 bucket"
  value       = aws_s3_bucket.lambda_artifacts.arn
}

output "terraform_state_bucket_name" {
  description = "Name of the Terraform state S3 bucket"
  value       = aws_s3_bucket.terraform_state.bucket
}

output "terraform_state_bucket_arn" {
  description = "ARN of the Terraform state S3 bucket"
  value       = aws_s3_bucket.terraform_state.arn
}

output "ml_models_bucket_name" {
  description = "Name of the ML models S3 bucket"
  value       = aws_s3_bucket.ml_models.bucket
}

output "ml_models_bucket_arn" {
  description = "ARN of the ML models S3 bucket"
  value       = aws_s3_bucket.ml_models.arn
}