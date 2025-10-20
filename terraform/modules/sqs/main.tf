# SQS Queues for User Journey Analytics Agent

# Main event processing queue
resource "aws_sqs_queue" "event_processing" {
  name                       = "${var.project_name}-event-processing"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600  # 14 days
  receive_wait_time_seconds  = 20       # Long polling
  visibility_timeout_seconds = 300      # 5 minutes
  
  # Enable server-side encryption
  kms_master_key_id                 = aws_kms_key.sqs_key.arn
  kms_data_key_reuse_period_seconds = 300
  
  # Dead letter queue configuration
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.event_processing_dlq.arn
    maxReceiveCount     = var.max_receive_count
  })
  
  tags = var.tags
}

# Dead letter queue for failed event processing
resource "aws_sqs_queue" "event_processing_dlq" {
  name                       = "${var.project_name}-event-processing-dlq"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600  # 14 days
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 300
  
  # Enable server-side encryption
  kms_master_key_id                 = aws_kms_key.sqs_key.arn
  kms_data_key_reuse_period_seconds = 300
  
  tags = merge(var.tags, {
    Purpose = "DeadLetterQueue"
  })
}

# Struggle signal processing queue
resource "aws_sqs_queue" "struggle_signal_processing" {
  name                       = "${var.project_name}-struggle-signals"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 180      # 3 minutes for faster processing
  
  # Enable server-side encryption
  kms_master_key_id                 = aws_kms_key.sqs_key.arn
  kms_data_key_reuse_period_seconds = 300
  
  # Dead letter queue configuration
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.struggle_signal_processing_dlq.arn
    maxReceiveCount     = var.max_receive_count
  })
  
  tags = var.tags
}

# Dead letter queue for struggle signal processing
resource "aws_sqs_queue" "struggle_signal_processing_dlq" {
  name                       = "${var.project_name}-struggle-signals-dlq"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 180
  
  # Enable server-side encryption
  kms_master_key_id                 = aws_kms_key.sqs_key.arn
  kms_data_key_reuse_period_seconds = 300
  
  tags = merge(var.tags, {
    Purpose = "DeadLetterQueue"
  })
}

# Video analysis processing queue
resource "aws_sqs_queue" "video_analysis_processing" {
  name                       = "${var.project_name}-video-analysis"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 600      # 10 minutes for video processing
  
  # Enable server-side encryption
  kms_master_key_id                 = aws_kms_key.sqs_key.arn
  kms_data_key_reuse_period_seconds = 300
  
  # Dead letter queue configuration
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.video_analysis_processing_dlq.arn
    maxReceiveCount     = var.max_receive_count
  })
  
  tags = var.tags
}

# Dead letter queue for video analysis processing
resource "aws_sqs_queue" "video_analysis_processing_dlq" {
  name                       = "${var.project_name}-video-analysis-dlq"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 600
  
  # Enable server-side encryption
  kms_master_key_id                 = aws_kms_key.sqs_key.arn
  kms_data_key_reuse_period_seconds = 300
  
  tags = merge(var.tags, {
    Purpose = "DeadLetterQueue"
  })
}

# Intervention execution queue
resource "aws_sqs_queue" "intervention_execution" {
  name                       = "${var.project_name}-intervention-execution"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 120      # 2 minutes for intervention execution
  
  # Enable server-side encryption
  kms_master_key_id                 = aws_kms_key.sqs_key.arn
  kms_data_key_reuse_period_seconds = 300
  
  # Dead letter queue configuration
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.intervention_execution_dlq.arn
    maxReceiveCount     = var.max_receive_count
  })
  
  tags = var.tags
}

# Dead letter queue for intervention execution
resource "aws_sqs_queue" "intervention_execution_dlq" {
  name                       = "${var.project_name}-intervention-execution-dlq"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 120
  
  # Enable server-side encryption
  kms_master_key_id                 = aws_kms_key.sqs_key.arn
  kms_data_key_reuse_period_seconds = 300
  
  tags = merge(var.tags, {
    Purpose = "DeadLetterQueue"
  })
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
      },
      {
        Sid    = "Allow Lambda Service"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
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
  
  tags = var.tags
}

resource "aws_kms_alias" "sqs_key_alias" {
  name          = "alias/${var.project_name}-sqs"
  target_key_id = aws_kms_key.sqs_key.key_id
}

# CloudWatch alarms for queue monitoring
resource "aws_cloudwatch_metric_alarm" "event_processing_queue_depth" {
  alarm_name          = "${var.project_name}-event-processing-queue-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ApproximateNumberOfVisibleMessages"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.queue_depth_alarm_threshold
  alarm_description   = "This metric monitors event processing queue depth"
  alarm_actions       = var.alarm_actions
  
  dimensions = {
    QueueName = aws_sqs_queue.event_processing.name
  }
  
  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "event_processing_dlq_messages" {
  alarm_name          = "${var.project_name}-event-processing-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ApproximateNumberOfVisibleMessages"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Average"
  threshold           = "0"
  alarm_description   = "This metric monitors messages in the dead letter queue"
  alarm_actions       = var.alarm_actions
  
  dimensions = {
    QueueName = aws_sqs_queue.event_processing_dlq.name
  }
  
  tags = var.tags
}

# Data sources
data "aws_caller_identity" "current" {}