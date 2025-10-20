# Configuration to use existing AWS resources for production
# This approach reuses dev resources to avoid duplication and cost

# Data sources to reference existing resources (removing -dev suffix for production)
data "aws_dynamodb_table" "existing_user_profiles" {
  name = "user-journey-analytics-user-profiles"
}

data "aws_dynamodb_table" "existing_user_events" {
  name = "user-journey-analytics-user-events"
}

data "aws_dynamodb_table" "existing_struggle_signals" {
  name = "user-journey-analytics-struggle-signals"
}

data "aws_dynamodb_table" "existing_video_engagement" {
  name = "user-journey-analytics-video-engagement"
}

data "aws_kinesis_stream" "existing_user_events_stream" {
  name = "user-journey-analytics-user-events"
}

data "aws_s3_bucket" "existing_analytics_data" {
  bucket = "user-journey-analytics-analytics-data-dev-9bf62fd9"
}

data "aws_s3_bucket" "existing_event_logs" {
  bucket = "user-journey-analytics-event-logs-dev-9bf2a9c5"
}

data "aws_s3_bucket" "existing_lambda_artifacts" {
  bucket = "user-journey-analytics-lambda-artifacts-dev-9bf2a9c5"
}

# Local values for production using existing resources
locals {
  use_existing_resources = var.environment == "prod" ? true : false
  
  # Production resource names (reuse existing dev resources)
  prod_dynamodb_tables = {
    user_profiles_table_name     = local.use_existing_resources ? data.aws_dynamodb_table.existing_user_profiles.name : ""
    user_events_table_name       = local.use_existing_resources ? data.aws_dynamodb_table.existing_user_events.name : ""
    struggle_signals_table_name  = local.use_existing_resources ? data.aws_dynamodb_table.existing_struggle_signals.name : ""
    video_engagement_table_name  = local.use_existing_resources ? data.aws_dynamodb_table.existing_video_engagement.name : ""
  }
  
  prod_kinesis_stream = {
    stream_name = local.use_existing_resources ? data.aws_kinesis_stream.existing_user_events_stream.name : ""
    stream_arn  = local.use_existing_resources ? data.aws_kinesis_stream.existing_user_events_stream.arn : ""
  }
  
  prod_s3_buckets = {
    analytics_data_bucket    = local.use_existing_resources ? data.aws_s3_bucket.existing_analytics_data.bucket : ""
    event_logs_bucket       = local.use_existing_resources ? data.aws_s3_bucket.existing_event_logs.bucket : ""
    lambda_artifacts_bucket = local.use_existing_resources ? data.aws_s3_bucket.existing_lambda_artifacts.bucket : ""
  }
}

# Output the existing resource information for production use
output "production_resources" {
  description = "Existing AWS resources to be used for production"
  value = local.use_existing_resources ? {
    dynamodb_tables = local.prod_dynamodb_tables
    kinesis_stream  = local.prod_kinesis_stream
    s3_buckets     = local.prod_s3_buckets
    
    # Resource ARNs for application configuration
    user_profiles_table_arn     = data.aws_dynamodb_table.existing_user_profiles.arn
    user_events_table_arn       = data.aws_dynamodb_table.existing_user_events.arn
    struggle_signals_table_arn  = data.aws_dynamodb_table.existing_struggle_signals.arn
    video_engagement_table_arn  = data.aws_dynamodb_table.existing_video_engagement.arn
    kinesis_stream_arn          = data.aws_kinesis_stream.existing_user_events_stream.arn
    
    # S3 bucket ARNs
    analytics_data_bucket_arn   = data.aws_s3_bucket.existing_analytics_data.arn
    event_logs_bucket_arn       = data.aws_s3_bucket.existing_event_logs.arn
    lambda_artifacts_bucket_arn = data.aws_s3_bucket.existing_lambda_artifacts.arn
  } : null
}