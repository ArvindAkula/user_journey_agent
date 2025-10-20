# Simple deployment for S3, SQS, and SNS resources only

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.100"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# Data sources
data "aws_caller_identity" "current" {}

# S3 Bucket
resource "aws_s3_bucket" "user_journey_analytics" {
  bucket = "user-journey-analytics"
  
  tags = {
    Name        = "user-journey-analytics"
    Environment = "prod"
    Project     = "user-journey-analytics"
  }
}

# S3 Bucket versioning
resource "aws_s3_bucket_versioning" "user_journey_analytics" {
  bucket = aws_s3_bucket.user_journey_analytics.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "user_journey_analytics" {
  bucket = aws_s3_bucket.user_journey_analytics.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 Bucket public access block
resource "aws_s3_bucket_public_access_block" "user_journey_analytics" {
  bucket = aws_s3_bucket.user_journey_analytics.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# KMS Key for SQS encryption
resource "aws_kms_key" "sqs_key" {
  description             = "KMS key for SQS queue encryption"
  deletion_window_in_days = 7
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow SQS Service"
        Effect = "Allow"
        Principal = {
          Service = "sqs.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })
  
  tags = {
    Name = "user-journey-analytics-sqs-key"
  }
}

resource "aws_kms_alias" "sqs_key_alias" {
  name          = "alias/user-journey-analytics-sqs"
  target_key_id = aws_kms_key.sqs_key.key_id
}

# SQS Queues
resource "aws_sqs_queue" "event_processing_dlq" {
  name                       = "user-journey-analytics-event-processing-dlq"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600  # 14 days
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 300
  
  kms_master_key_id                 = aws_kms_key.sqs_key.arn
  kms_data_key_reuse_period_seconds = 300
  
  tags = {
    Name = "user-journey-analytics-event-processing-dlq"
    Purpose = "DeadLetterQueue"
  }
}

resource "aws_sqs_queue" "event_processing" {
  name                       = "user-journey-analytics-event-processing"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600  # 14 days
  receive_wait_time_seconds  = 20       # Long polling
  visibility_timeout_seconds = 300      # 5 minutes
  
  kms_master_key_id                 = aws_kms_key.sqs_key.arn
  kms_data_key_reuse_period_seconds = 300
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.event_processing_dlq.arn
    maxReceiveCount     = 3
  })
  
  tags = {
    Name = "user-journey-analytics-event-processing"
  }
}

resource "aws_sqs_queue" "struggle_signal_processing_dlq" {
  name                       = "user-journey-analytics-struggle-signals-dlq"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 180
  
  kms_master_key_id                 = aws_kms_key.sqs_key.arn
  kms_data_key_reuse_period_seconds = 300
  
  tags = {
    Name = "user-journey-analytics-struggle-signals-dlq"
    Purpose = "DeadLetterQueue"
  }
}

resource "aws_sqs_queue" "struggle_signal_processing" {
  name                       = "user-journey-analytics-struggle-signals"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 180      # 3 minutes for faster processing
  
  kms_master_key_id                 = aws_kms_key.sqs_key.arn
  kms_data_key_reuse_period_seconds = 300
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.struggle_signal_processing_dlq.arn
    maxReceiveCount     = 3
  })
  
  tags = {
    Name = "user-journey-analytics-struggle-signals"
  }
}

resource "aws_sqs_queue" "video_analysis_processing_dlq" {
  name                       = "user-journey-analytics-video-analysis-dlq"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 600
  
  kms_master_key_id                 = aws_kms_key.sqs_key.arn
  kms_data_key_reuse_period_seconds = 300
  
  tags = {
    Name = "user-journey-analytics-video-analysis-dlq"
    Purpose = "DeadLetterQueue"
  }
}

resource "aws_sqs_queue" "video_analysis_processing" {
  name                       = "user-journey-analytics-video-analysis"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 600      # 10 minutes for video processing
  
  kms_master_key_id                 = aws_kms_key.sqs_key.arn
  kms_data_key_reuse_period_seconds = 300
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.video_analysis_processing_dlq.arn
    maxReceiveCount     = 3
  })
  
  tags = {
    Name = "user-journey-analytics-video-analysis"
  }
}

resource "aws_sqs_queue" "intervention_execution_dlq" {
  name                       = "user-journey-analytics-intervention-execution-dlq"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 120
  
  kms_master_key_id                 = aws_kms_key.sqs_key.arn
  kms_data_key_reuse_period_seconds = 300
  
  tags = {
    Name = "user-journey-analytics-intervention-execution-dlq"
    Purpose = "DeadLetterQueue"
  }
}

resource "aws_sqs_queue" "intervention_execution" {
  name                       = "user-journey-analytics-intervention-execution"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 120      # 2 minutes for intervention execution
  
  kms_master_key_id                 = aws_kms_key.sqs_key.arn
  kms_data_key_reuse_period_seconds = 300
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.intervention_execution_dlq.arn
    maxReceiveCount     = 3
  })
  
  tags = {
    Name = "user-journey-analytics-intervention-execution"
  }
}

# SNS Topics
resource "aws_sns_topic" "alerts" {
  name = "user-journey-analytics-alerts"
  
  tags = {
    Name = "user-journey-analytics-alerts"
  }
}

resource "aws_sns_topic" "user_interventions" {
  name = "user-journey-analytics-user-interventions"
  
  tags = {
    Name = "user-journey-analytics-user-interventions"
  }
}

resource "aws_sns_topic" "performance_alerts" {
  name = "user-journey-analytics-performance-alerts"
  
  tags = {
    Name = "user-journey-analytics-performance-alerts"
  }
}

# Outputs
output "s3_bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.user_journey_analytics.bucket
}

output "sqs_queues" {
  description = "SQS queue names"
  value = {
    event_processing = aws_sqs_queue.event_processing.name
    event_processing_dlq = aws_sqs_queue.event_processing_dlq.name
    struggle_signals = aws_sqs_queue.struggle_signal_processing.name
    struggle_signals_dlq = aws_sqs_queue.struggle_signal_processing_dlq.name
    video_analysis = aws_sqs_queue.video_analysis_processing.name
    video_analysis_dlq = aws_sqs_queue.video_analysis_processing_dlq.name
    intervention_execution = aws_sqs_queue.intervention_execution.name
    intervention_execution_dlq = aws_sqs_queue.intervention_execution_dlq.name
  }
}

output "sns_topics" {
  description = "SNS topic ARNs"
  value = {
    alerts = aws_sns_topic.alerts.arn
    user_interventions = aws_sns_topic.user_interventions.arn
    performance_alerts = aws_sns_topic.performance_alerts.arn
  }
}