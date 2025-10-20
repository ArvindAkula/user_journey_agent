# Kinesis Data Streams and Analytics for User Journey Analytics Agent

# Kinesis Data Stream for real-time event processing
resource "aws_kinesis_stream" "user_events" {
  name             = "${var.project_name}-user-events-${var.environment}"
  shard_count      = var.shard_count
  retention_period = var.retention_period
  
  shard_level_metrics = [
    "IncomingRecords",
    "OutgoingRecords",
    "IncomingBytes",
    "OutgoingBytes",
    "WriteProvisionedThroughputExceeded",
    "ReadProvisionedThroughputExceeded",
    "IteratorAgeMilliseconds"
  ]
  
  stream_mode_details {
    stream_mode = var.stream_mode
  }
  
  encryption_type = "KMS"
  kms_key_id      = aws_kms_key.kinesis_key.arn
  
  tags = var.tags
}

# Auto-scaling for Kinesis Data Stream (when using provisioned mode)
resource "aws_appautoscaling_target" "kinesis_read_target" {
  count              = var.enable_auto_scaling && var.stream_mode == "PROVISIONED" ? 1 : 0
  max_capacity       = var.max_shard_count
  min_capacity       = var.min_shard_count
  resource_id        = "stream/${aws_kinesis_stream.user_events.name}"
  scalable_dimension = "kinesis:shard:count"
  service_namespace  = "kinesis"
}

resource "aws_appautoscaling_policy" "kinesis_read_policy" {
  count              = var.enable_auto_scaling && var.stream_mode == "PROVISIONED" ? 1 : 0
  name               = "${var.project_name}-kinesis-read-scaling-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.kinesis_read_target[0].resource_id
  scalable_dimension = aws_appautoscaling_target.kinesis_read_target[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.kinesis_read_target[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "KinesisStreamIncomingRecords"
    }
    target_value = var.auto_scaling_target_utilization
  }
}

# KMS Key for Kinesis encryption
resource "aws_kms_key" "kinesis_key" {
  description             = "KMS key for Kinesis Data Stream encryption"
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
        Sid    = "Allow Kinesis Service"
        Effect = "Allow"
        Principal = {
          Service = "kinesis.amazonaws.com"
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

resource "aws_kms_alias" "kinesis_key_alias" {
  name          = "alias/${var.project_name}-kinesis-${var.environment}"
  target_key_id = aws_kms_key.kinesis_key.key_id
}

# Kinesis Analytics Application for real-time processing (commented out for demo)
# Note: Requires proper Flink application JAR file
# resource "aws_kinesisanalyticsv2_application" "user_journey_analytics" {
#   name                   = "${var.project_name}-analytics-${var.environment}"
#   runtime_environment    = "FLINK-1_15"
#   service_execution_role = var.kinesis_analytics_role_arn
#   
#   application_configuration {
#     application_code_configuration {
#       code_content {
#         s3_content_location {
#           bucket_arn = "arn:aws:s3:::your-flink-app-bucket"
#           file_key   = "flink-app.jar"
#         }
#       }
#       code_content_type = "ZIPFILE"
#     }
#     
#     flink_application_configuration {
#       checkpoint_configuration {
#         configuration_type = "DEFAULT"
#       }
#       
#       monitoring_configuration {
#         configuration_type = "DEFAULT"
#         log_level         = "INFO"
#         metrics_level     = "APPLICATION"
#       }
#       
#       parallelism_configuration {
#         configuration_type = "DEFAULT"
#       }
#     }
#   }
#   
#   tags = var.tags
# }

# CloudWatch Log Group for Kinesis Analytics
resource "aws_cloudwatch_log_group" "kinesis_analytics_logs" {
  name              = "/aws/kinesisanalytics/${var.project_name}-analytics-${var.environment}"
  retention_in_days = 14
  
  tags = var.tags
}

# CloudWatch Log Stream for Kinesis Analytics
resource "aws_cloudwatch_log_stream" "kinesis_analytics_log_stream" {
  name           = "kinesis-analytics-log-stream"
  log_group_name = aws_cloudwatch_log_group.kinesis_analytics_logs.name
}

# Data sources
data "aws_caller_identity" "current" {}