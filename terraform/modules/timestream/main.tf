# Amazon Timestream for User Journey Analytics Agent

# Timestream Database
resource "aws_timestreamwrite_database" "user_journey_analytics" {
  database_name = "${var.project_name}-${var.environment}"
  
  kms_key_id = aws_kms_key.timestream_key.arn
  
  tags = var.tags
}

# KMS Key for Timestream encryption
resource "aws_kms_key" "timestream_key" {
  description             = "KMS key for Timestream database encryption"
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
        Sid    = "Allow Timestream Service"
        Effect = "Allow"
        Principal = {
          Service = "timestream.amazonaws.com"
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

resource "aws_kms_alias" "timestream_key_alias" {
  name          = "alias/${var.project_name}-timestream-${var.environment}"
  target_key_id = aws_kms_key.timestream_key.key_id
}

# Video Engagement Table
resource "aws_timestreamwrite_table" "video_engagement" {
  database_name = aws_timestreamwrite_database.user_journey_analytics.database_name
  table_name    = "video-engagement"
  
  retention_properties {
    memory_store_retention_period_in_hours  = var.retention_memory_hours
    magnetic_store_retention_period_in_days = var.retention_magnetic_days
  }
  
  magnetic_store_write_properties {
    enable_magnetic_store_writes = true
    
    magnetic_store_rejected_data_location {
      s3_configuration {
        bucket_name = var.rejected_data_bucket_name
        object_key_prefix = "video-engagement-rejected/"
      }
    }
  }
  
  tags = var.tags
}

# User Metrics Table
resource "aws_timestreamwrite_table" "user_metrics" {
  database_name = aws_timestreamwrite_database.user_journey_analytics.database_name
  table_name    = "user-metrics"
  
  retention_properties {
    memory_store_retention_period_in_hours  = var.retention_memory_hours
    magnetic_store_retention_period_in_days = var.retention_magnetic_days
  }
  
  magnetic_store_write_properties {
    enable_magnetic_store_writes = true
    
    magnetic_store_rejected_data_location {
      s3_configuration {
        bucket_name = var.rejected_data_bucket_name
        object_key_prefix = "user-metrics-rejected/"
      }
    }
  }
  
  tags = var.tags
}

# Session Analytics Table
resource "aws_timestreamwrite_table" "session_analytics" {
  database_name = aws_timestreamwrite_database.user_journey_analytics.database_name
  table_name    = "session-analytics"
  
  retention_properties {
    memory_store_retention_period_in_hours  = var.retention_memory_hours
    magnetic_store_retention_period_in_days = var.retention_magnetic_days
  }
  
  magnetic_store_write_properties {
    enable_magnetic_store_writes = true
    
    magnetic_store_rejected_data_location {
      s3_configuration {
        bucket_name = var.rejected_data_bucket_name
        object_key_prefix = "session-analytics-rejected/"
      }
    }
  }
  
  tags = var.tags
}

# Struggle Signals Time Series Table
resource "aws_timestreamwrite_table" "struggle_signals_timeseries" {
  database_name = aws_timestreamwrite_database.user_journey_analytics.database_name
  table_name    = "struggle-signals-timeseries"
  
  retention_properties {
    memory_store_retention_period_in_hours  = var.retention_memory_hours
    magnetic_store_retention_period_in_days = var.retention_magnetic_days
  }
  
  magnetic_store_write_properties {
    enable_magnetic_store_writes = true
    
    magnetic_store_rejected_data_location {
      s3_configuration {
        bucket_name = var.rejected_data_bucket_name
        object_key_prefix = "struggle-signals-rejected/"
      }
    }
  }
  
  tags = var.tags
}

# Data sources
data "aws_caller_identity" "current" {}