# DynamoDB Tables for User Journey Analytics Agent

# User Profiles Table with Performance Optimizations
resource "aws_dynamodb_table" "user_profiles" {
  name           = "${var.project_name}-user-profiles-${var.environment}"
  billing_mode   = var.billing_mode
  hash_key       = "userId"
  
  # Provisioned throughput for predictable performance
  dynamic "read_capacity" {
    for_each = var.billing_mode == "PROVISIONED" ? [1] : []
    content {
      read_capacity = var.user_profiles_read_capacity
    }
  }
  
  dynamic "write_capacity" {
    for_each = var.billing_mode == "PROVISIONED" ? [1] : []
    content {
      write_capacity = var.user_profiles_write_capacity
    }
  }
  
  attribute {
    name = "userId"
    type = "S"
  }
  
  attribute {
    name = "userSegment"
    type = "S"
  }
  
  attribute {
    name = "lastActiveAt"
    type = "N"
  }
  
  global_secondary_index {
    name            = "UserSegmentIndex"
    hash_key        = "userSegment"
    range_key       = "lastActiveAt"
    projection_type = "KEYS_ONLY"  # Optimized projection for better performance
    
    dynamic "read_capacity" {
      for_each = var.billing_mode == "PROVISIONED" ? [1] : []
      content {
        read_capacity = var.gsi_read_capacity
      }
    }
    
    dynamic "write_capacity" {
      for_each = var.billing_mode == "PROVISIONED" ? [1] : []
      content {
        write_capacity = var.gsi_write_capacity
      }
    }
  }
  
  # Performance optimization: Enable DynamoDB Accelerator (DAX) compatible settings
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"
  
  point_in_time_recovery {
    enabled = var.point_in_time_recovery
  }
  
  tags = var.tags
}

# Auto-scaling for User Profiles Table
resource "aws_appautoscaling_target" "user_profiles_read_target" {
  count              = var.enable_auto_scaling && var.billing_mode == "PROVISIONED" ? 1 : 0
  max_capacity       = var.auto_scaling_max_capacity
  min_capacity       = var.auto_scaling_min_capacity
  resource_id        = "table/${aws_dynamodb_table.user_profiles.name}"
  scalable_dimension = "dynamodb:table:ReadCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "user_profiles_read_policy" {
  count              = var.enable_auto_scaling && var.billing_mode == "PROVISIONED" ? 1 : 0
  name               = "${var.project_name}-user-profiles-read-scaling-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.user_profiles_read_target[0].resource_id
  scalable_dimension = aws_appautoscaling_target.user_profiles_read_target[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.user_profiles_read_target[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBReadCapacityUtilization"
    }
    target_value = var.auto_scaling_target_utilization
  }
}

resource "aws_appautoscaling_target" "user_profiles_write_target" {
  count              = var.enable_auto_scaling && var.billing_mode == "PROVISIONED" ? 1 : 0
  max_capacity       = var.auto_scaling_max_capacity
  min_capacity       = var.auto_scaling_min_capacity
  resource_id        = "table/${aws_dynamodb_table.user_profiles.name}"
  scalable_dimension = "dynamodb:table:WriteCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "user_profiles_write_policy" {
  count              = var.enable_auto_scaling && var.billing_mode == "PROVISIONED" ? 1 : 0
  name               = "${var.project_name}-user-profiles-write-scaling-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.user_profiles_write_target[0].resource_id
  scalable_dimension = aws_appautoscaling_target.user_profiles_write_target[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.user_profiles_write_target[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBWriteCapacityUtilization"
    }
    target_value = var.auto_scaling_target_utilization
  }
}

# User Events Table
resource "aws_dynamodb_table" "user_events" {
  name           = "${var.project_name}-user-events-${var.environment}"
  billing_mode   = var.billing_mode
  hash_key       = "userId"
  range_key      = "timestamp"
  
  # Provisioned throughput for predictable performance
  dynamic "read_capacity" {
    for_each = var.billing_mode == "PROVISIONED" ? [1] : []
    content {
      read_capacity = var.user_events_read_capacity
    }
  }
  
  dynamic "write_capacity" {
    for_each = var.billing_mode == "PROVISIONED" ? [1] : []
    content {
      write_capacity = var.user_events_write_capacity
    }
  }
  
  attribute {
    name = "userId"
    type = "S"
  }
  
  attribute {
    name = "timestamp"
    type = "N"
  }
  
  attribute {
    name = "eventType"
    type = "S"
  }
  
  attribute {
    name = "sessionId"
    type = "S"
  }
  
  global_secondary_index {
    name            = "EventTypeIndex"
    hash_key        = "eventType"
    range_key       = "timestamp"
    projection_type = "KEYS_ONLY"  # Optimized projection for better performance
    
    dynamic "read_capacity" {
      for_each = var.billing_mode == "PROVISIONED" ? [1] : []
      content {
        read_capacity = var.gsi_read_capacity
      }
    }
    
    dynamic "write_capacity" {
      for_each = var.billing_mode == "PROVISIONED" ? [1] : []
      content {
        write_capacity = var.gsi_write_capacity
      }
    }
  }
  
  global_secondary_index {
    name            = "SessionIndex"
    hash_key        = "sessionId"
    range_key       = "timestamp"
    projection_type = "KEYS_ONLY"  # Optimized projection for better performance
    
    dynamic "read_capacity" {
      for_each = var.billing_mode == "PROVISIONED" ? [1] : []
      content {
        read_capacity = var.gsi_read_capacity
      }
    }
    
    dynamic "write_capacity" {
      for_each = var.billing_mode == "PROVISIONED" ? [1] : []
      content {
        write_capacity = var.gsi_write_capacity
      }
    }
  }
  
  # Performance optimization: Enable DynamoDB Streams for real-time processing
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"
  
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
  
  point_in_time_recovery {
    enabled = var.point_in_time_recovery
  }
  
  tags = var.tags
}

# Struggle Signals Table
resource "aws_dynamodb_table" "struggle_signals" {
  name           = "${var.project_name}-struggle-signals-${var.environment}"
  billing_mode   = var.billing_mode
  hash_key       = "userId"
  range_key      = "featureId"
  
  attribute {
    name = "userId"
    type = "S"
  }
  
  attribute {
    name = "featureId"
    type = "S"
  }
  
  attribute {
    name = "severity"
    type = "S"
  }
  
  attribute {
    name = "detectedAt"
    type = "N"
  }
  
  global_secondary_index {
    name            = "FeatureStruggleIndex"
    hash_key        = "featureId"
    range_key       = "severity"
    projection_type = "ALL"
  }
  
  global_secondary_index {
    name            = "SeverityTimeIndex"
    hash_key        = "severity"
    range_key       = "detectedAt"
    projection_type = "ALL"
  }
  
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
  
  point_in_time_recovery {
    enabled = var.point_in_time_recovery
  }
  
  tags = var.tags
}

# Video Engagement Table
resource "aws_dynamodb_table" "video_engagement" {
  name           = "${var.project_name}-video-engagement-${var.environment}"
  billing_mode   = var.billing_mode
  hash_key       = "userId"
  range_key      = "videoId"
  
  attribute {
    name = "userId"
    type = "S"
  }
  
  attribute {
    name = "videoId"
    type = "S"
  }
  
  attribute {
    name = "lastWatchedAt"
    type = "N"
  }
  
  attribute {
    name = "interestScore"
    type = "N"
  }
  
  global_secondary_index {
    name            = "VideoPopularityIndex"
    hash_key        = "videoId"
    range_key       = "lastWatchedAt"
    projection_type = "ALL"
  }
  
  global_secondary_index {
    name            = "UserInterestIndex"
    hash_key        = "userId"
    range_key       = "interestScore"
    projection_type = "ALL"
  }
  
  point_in_time_recovery {
    enabled = var.point_in_time_recovery
  }
  
  tags = var.tags
}