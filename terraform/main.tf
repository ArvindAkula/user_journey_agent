# Main Terraform configuration for User Journey Analytics Agent
terraform {
  required_version = ">= 1.4.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 5.100.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "= 2.7.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "= 3.7.2"
    }
  }
  
  backend "s3" {
    # Backend configuration will be provided via backend config file
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "user-journey-analytics"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Local values
locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name
  
  # Demo-optimized configurations
  kinesis_shard_count = var.is_demo_environment ? 1 : var.kinesis_shard_count
  lambda_memory_size  = var.is_demo_environment ? 256 : var.lambda_memory_size
  lambda_timeout      = var.is_demo_environment ? 180 : var.lambda_timeout
  
  # Data retention periods for demo
  s3_lifecycle_transition_days = var.is_demo_environment ? 7 : var.s3_lifecycle_transition_days
  s3_lifecycle_expiration_days = var.is_demo_environment ? 30 : var.s3_lifecycle_expiration_days
  timestream_retention_memory_hours = var.is_demo_environment ? 24 : var.timestream_retention_memory_hours
  timestream_retention_magnetic_days = var.is_demo_environment ? 7 : var.timestream_retention_magnetic_days
  
  common_tags = {
    Project     = "user-journey-analytics"
    Environment = var.environment
    ManagedBy   = "terraform"
    DemoMode    = var.is_demo_environment ? "true" : "false"
  }
}

# Module: VPC and Networking
module "vpc" {
  source = "./modules/vpc"
  
  project_name          = var.project_name
  environment           = var.environment
  vpc_cidr              = var.vpc_cidr
  public_subnet_cidrs   = var.public_subnet_cidrs
  private_subnet_cidrs  = var.private_subnet_cidrs
  tags                  = local.common_tags
}

# Module: IAM Roles and Policies
module "iam" {
  source = "./modules/iam"
  
  project_name = var.project_name
  environment  = var.environment
  tags         = local.common_tags
}

# Provider for replica region (for cross-region replication)
provider "aws" {
  alias  = "replica"
  region = var.s3_replica_region
  
  default_tags {
    tags = {
      Project     = "user-journey-analytics"
      Environment = var.environment
      ManagedBy   = "terraform"
      Purpose     = "CrossRegionReplica"
    }
  }
}

# Module: S3 Buckets
module "s3" {
  source = "./modules/s3"
  
  project_name                    = var.project_name
  environment                     = var.environment
  lifecycle_transition_days       = local.s3_lifecycle_transition_days
  lifecycle_expiration_days       = local.s3_lifecycle_expiration_days
  enable_cross_region_replication = var.enable_s3_cross_region_replication
  replica_region                  = var.s3_replica_region
  tags                           = local.common_tags
  
  providers = {
    aws.replica = aws.replica
  }
}

# Module: DynamoDB Tables
module "dynamodb" {
  source = "./modules/dynamodb"
  
  project_name            = var.project_name
  environment             = var.environment
  billing_mode            = var.dynamodb_billing_mode
  point_in_time_recovery  = var.dynamodb_point_in_time_recovery
  tags                    = local.common_tags
}

# Module: Timestream Database (conditional creation for demo)
module "timestream" {
  count  = var.is_demo_environment ? 0 : 1
  source = "./modules/timestream"
  
  project_name               = var.project_name
  environment                = var.environment
  retention_memory_hours     = local.timestream_retention_memory_hours
  retention_magnetic_days    = local.timestream_retention_magnetic_days
  rejected_data_bucket_name  = module.s3.analytics_data_bucket_name
  tags                       = local.common_tags
}

# Module: Kinesis Data Streams
module "kinesis" {
  source = "./modules/kinesis"
  
  project_name                    = var.project_name
  environment                     = var.environment
  shard_count                     = local.kinesis_shard_count
  retention_period                = var.kinesis_retention_period
  stream_mode                     = var.is_demo_environment ? "ON_DEMAND" : "PROVISIONED"
  enable_auto_scaling             = var.enable_kinesis_auto_scaling
  min_shard_count                 = var.kinesis_min_shard_count
  max_shard_count                 = var.kinesis_max_shard_count
  auto_scaling_target_utilization = 70
  kinesis_analytics_role_arn      = module.iam.kinesis_analytics_role_arn
  tags                            = local.common_tags
}

# Module: SQS Queues
module "sqs" {
  source = "./modules/sqs"
  
  project_name                = var.project_name
  environment                 = var.environment
  max_receive_count           = var.sqs_max_receive_count
  queue_depth_alarm_threshold = var.sqs_queue_depth_alarm_threshold
  alarm_actions               = var.alert_email != "" ? [aws_sns_topic.alerts.arn] : []
  tags                        = local.common_tags
}

# Module: Monitoring and Logging
module "monitoring" {
  source = "./modules/monitoring"
  
  project_name                    = var.project_name
  environment                     = var.environment
  aws_region                      = var.aws_region
  log_retention_days              = var.cloudwatch_log_retention_days
  dynamodb_table_names            = [
    module.dynamodb.user_profiles_table_name,
    module.dynamodb.user_events_table_name,
    module.dynamodb.struggle_signals_table_name,
    module.dynamodb.video_engagement_table_name
  ]
  lambda_function_names           = [
    module.lambda.event_processor_function_name,
    module.lambda.struggle_detector_function_name,
    module.lambda.video_analyzer_function_name,
    module.lambda.intervention_executor_function_name
  ]
  kinesis_stream_name             = module.kinesis.data_stream_name
  sns_topic_arn                   = aws_sns_topic.alerts.arn
  lambda_error_threshold          = var.lambda_error_alarm_threshold
  lambda_duration_threshold       = var.lambda_duration_alarm_threshold
  kinesis_iterator_age_threshold  = var.kinesis_iterator_age_alarm_threshold
  application_error_threshold     = var.application_error_alarm_threshold
  create_additional_sns_topic     = false
  additional_alert_email          = ""
  tags                            = local.common_tags
}

# SNS Topic for Alerts (defined here to be available for Lambda module)
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts"
  
  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "email_alerts" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Module: Lambda Functions with Performance Optimizations
module "lambda" {
  source = "./modules/lambda"
  
  project_name                  = var.project_name
  environment                   = var.environment
  runtime                       = var.lambda_runtime
  timeout                       = local.lambda_timeout
  memory_size                   = local.lambda_memory_size
  optimized_memory_size         = var.is_demo_environment ? 512 : 1024
  reserved_concurrency          = var.is_demo_environment ? 50 : 100
  enable_provisioned_concurrency = var.enable_lambda_auto_scaling
  provisioned_concurrency_count = var.lambda_min_provisioned_concurrency
  dlq_arn                       = ""  # Will be created in module
  enable_x_ray_tracing          = true
  batch_size                    = var.is_demo_environment ? 50 : 100
  parallelization_factor        = var.is_demo_environment ? 5 : 10
  maximum_batching_window_in_seconds = 5
  lambda_execution_role_arn     = module.iam.lambda_execution_role_arn
  user_profiles_table_name      = module.dynamodb.user_profiles_table_name
  user_events_table_name        = module.dynamodb.user_events_table_name
  struggle_signals_table_name   = module.dynamodb.struggle_signals_table_name
  video_engagement_table_name   = module.dynamodb.video_engagement_table_name
  timestream_database_name      = "user-journey-analytics-${var.environment}"
  kinesis_stream_name           = module.kinesis.data_stream_name
  kinesis_stream_arn            = module.kinesis.data_stream_arn
  bedrock_agent_id              = ""  # Will be populated after Bedrock agent is created
  subnet_ids                    = module.vpc.private_subnet_ids
  security_group_ids            = [module.vpc.lambda_security_group_id]
  sns_topic_arn                 = aws_sns_topic.alerts.arn
  tags                          = local.common_tags
}



# SageMaker resources are now defined in sagemaker.tf

# Note: Bedrock Agent resources and cost monitoring are defined in separate files