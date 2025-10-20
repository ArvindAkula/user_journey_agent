# Performance Monitoring and Alerting Configuration

# Enhanced CloudWatch Dashboard for Performance Monitoring
resource "aws_cloudwatch_dashboard" "performance_optimization" {
  dashboard_name = "${var.project_name}-performance-optimization-${var.environment}"
  
  dashboard_body = jsonencode({
    widgets = [
      # Lambda Performance Metrics
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 8
        height = 6
        
        properties = {
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", module.lambda.event_processor_function_name],
            [".", "MemoryUtilization", ".", "."],
            [".", "ConcurrentExecutions", ".", "."],
            [".", "ProvisionedConcurrencyUtilization", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Performance Metrics"
          period  = 300
          stat    = "Average"
        }
      },
      
      # DynamoDB Performance Metrics
      {
        type   = "metric"
        x      = 8
        y      = 0
        width  = 8
        height = 6
        
        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", module.dynamodb.user_profiles_table_name],
            [".", "ConsumedWriteCapacityUnits", ".", "."],
            [".", "SuccessfulRequestLatency", ".", ".", "Operation", "Query"],
            [".", ".", ".", ".", ".", "PutItem"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "DynamoDB Performance"
          period  = 300
        }
      },
      
      # CloudFront Performance Metrics
      {
        type   = "metric"
        x      = 16
        y      = 0
        width  = 8
        height = 6
        
        properties = {
          metrics = [
            ["AWS/CloudFront", "OriginLatency", "DistributionId", aws_cloudfront_distribution.frontend_assets.id],
            [".", "CacheHitRate", ".", "."],
            [".", "Requests", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "CloudFront Performance"
          period  = 300
        }
      },
      
      # Kinesis Performance Metrics
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/Kinesis", "IncomingRecords", "StreamName", module.kinesis.data_stream_name],
            [".", "OutgoingRecords", ".", "."],
            [".", "GetRecords.IteratorAgeMilliseconds", ".", "."],
            [".", "WriteProvisionedThroughputExceeded", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Kinesis Stream Performance"
          period  = 300
        }
      },
      
      # Custom Application Metrics
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["UserJourneyAnalytics", "DataProcessingLatency"],
            [".", "UserEventsProcessed"],
            [".", "BedrockInvocations"],
            [".", "AIServiceErrors"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Application Performance Metrics"
          period  = 300
        }
      },
      
      # Performance Percentiles
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 24
        height = 6
        
        properties = {
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", module.lambda.event_processor_function_name, { "stat": "p50" }],
            ["...", { "stat": "p90" }],
            ["...", { "stat": "p95" }],
            ["...", { "stat": "p99" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Duration Percentiles"
          period  = 300
        }
      }
    ]
  })
}

# Performance Alarms
resource "aws_cloudwatch_metric_alarm" "lambda_high_duration" {
  alarm_name          = "${var.project_name}-lambda-high-duration-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = "10000"  # 10 seconds
  alarm_description   = "Lambda function duration is too high"
  alarm_actions       = [aws_sns_topic.performance_alerts.arn]
  
  dimensions = {
    FunctionName = module.lambda.event_processor_function_name
  }
  
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_high_memory_utilization" {
  alarm_name          = "${var.project_name}-lambda-high-memory-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"  # 85%
  alarm_description   = "Lambda function memory utilization is too high"
  alarm_actions       = [aws_sns_topic.performance_alerts.arn]
  
  dimensions = {
    FunctionName = module.lambda.event_processor_function_name
  }
  
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_high_latency" {
  alarm_name          = "${var.project_name}-dynamodb-high-latency-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "SuccessfulRequestLatency"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Average"
  threshold           = "100"  # 100ms
  alarm_description   = "DynamoDB request latency is too high"
  alarm_actions       = [aws_sns_topic.performance_alerts.arn]
  
  dimensions = {
    TableName = module.dynamodb.user_profiles_table_name
    Operation = "Query"
  }
  
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "cloudfront_low_cache_hit_rate" {
  alarm_name          = "${var.project_name}-cloudfront-low-cache-hit-${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CacheHitRate"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"  # 80%
  alarm_description   = "CloudFront cache hit rate is too low"
  alarm_actions       = [aws_sns_topic.performance_alerts.arn]
  
  dimensions = {
    DistributionId = aws_cloudfront_distribution.frontend_assets.id
  }
  
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "kinesis_high_iterator_age" {
  alarm_name          = "${var.project_name}-kinesis-high-iterator-age-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "GetRecords.IteratorAgeMilliseconds"
  namespace           = "AWS/Kinesis"
  period              = "300"
  statistic           = "Maximum"
  threshold           = "30000"  # 30 seconds
  alarm_description   = "Kinesis iterator age is too high indicating processing lag"
  alarm_actions       = [aws_sns_topic.performance_alerts.arn]
  
  dimensions = {
    StreamName = module.kinesis.data_stream_name
  }
  
  tags = local.common_tags
}

# SNS Topic for Performance Alerts
resource "aws_sns_topic" "performance_alerts" {
  name = "${var.project_name}-performance-alerts"
  
  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "performance_email_alerts" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.performance_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Custom Metrics for Performance Monitoring
resource "aws_cloudwatch_log_metric_filter" "connection_pool_metrics" {
  name           = "${var.project_name}-connection-pool-metrics-${var.environment}"
  log_group_name = "/aws/lambda/${module.lambda.event_processor_function_name}"
  pattern        = "[timestamp, request_id, level=\"INFO\", message=\"PERFORMANCE_METRIC\", function_name, duration_ms]"
  
  metric_transformation {
    name      = "FunctionPerformance"
    namespace = "UserJourneyAnalytics/Performance"
    value     = "$duration_ms"
  }
}

resource "aws_cloudwatch_log_metric_filter" "memory_optimization_metrics" {
  name           = "${var.project_name}-memory-optimization-${var.environment}"
  log_group_name = "/aws/lambda/${module.lambda.event_processor_function_name}"
  pattern        = "[timestamp, request_id, level=\"WARNING\", message=\"High memory usage detected:\", memory_percent]"
  
  metric_transformation {
    name      = "HighMemoryUsage"
    namespace = "UserJourneyAnalytics/Performance"
    value     = "1"
  }
}

resource "aws_cloudwatch_log_metric_filter" "cache_hit_metrics" {
  name           = "${var.project_name}-cache-hit-metrics-${var.environment}"
  log_group_name = "/aws/lambda/${module.lambda.event_processor_function_name}"
  pattern        = "[timestamp, request_id, level=\"INFO\", message=\"Cache hit for Bedrock model:\", model_id]"
  
  metric_transformation {
    name      = "CacheHits"
    namespace = "UserJourneyAnalytics/Performance"
    value     = "1"
  }
}

# Performance Optimization Recommendations Dashboard
resource "aws_cloudwatch_dashboard" "optimization_recommendations" {
  dashboard_name = "${var.project_name}-optimization-recommendations-${var.environment}"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 2
        
        properties = {
          markdown = "# Performance Optimization Recommendations\n\nThis dashboard provides insights and recommendations for optimizing system performance."
        }
      },
      
      {
        type   = "metric"
        x      = 0
        y      = 2
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["UserJourneyAnalytics/Performance", "FunctionPerformance"],
            [".", "HighMemoryUsage"],
            [".", "CacheHits"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Performance Optimization Metrics"
          period  = 300
        }
      },
      
      {
        type   = "log"
        x      = 12
        y      = 2
        width  = 12
        height = 6
        
        properties = {
          query   = "SOURCE '/aws/lambda/${module.lambda.event_processor_function_name}'\n| fields @timestamp, @message\n| filter @message like /PERFORMANCE_METRIC/\n| sort @timestamp desc\n| limit 20"
          region  = var.aws_region
          title   = "Recent Performance Metrics"
          view    = "table"
        }
      },
      
      {
        type   = "text"
        x      = 0
        y      = 8
        width  = 24
        height = 4
        
        properties = {
          markdown = "## Optimization Recommendations\n\n1. **Lambda Memory**: Monitor memory utilization and adjust allocation based on usage patterns\n2. **DynamoDB**: Use projection expressions and consistent reads judiciously\n3. **CloudFront**: Optimize cache behaviors and TTL settings\n4. **Connection Pooling**: Monitor connection pool efficiency and adjust pool sizes\n5. **Batch Processing**: Use batch operations for DynamoDB and Timestream writes"
        }
      }
    ]
  })
}

# Automated Performance Optimization Lambda
resource "aws_lambda_function" "performance_optimizer" {
  filename         = data.archive_file.performance_optimizer_zip.output_path
  function_name    = "${var.project_name}-performance-optimizer-${var.environment}"
  role            = module.iam.lambda_execution_role_arn
  handler         = "performance_optimizer.lambda_handler"
  source_code_hash = data.archive_file.performance_optimizer_zip.output_base64sha256
  runtime         = "python3.11"
  timeout         = 300
  memory_size     = 512
  
  environment {
    variables = {
      ENVIRONMENT = var.environment
      PROJECT_NAME = var.project_name
    }
  }
  
  tags = local.common_tags
}

data "archive_file" "performance_optimizer_zip" {
  type        = "zip"
  output_path = "${path.root}/performance_optimizer.zip"
  
  source {
    content = templatefile("${path.module}/lambda_functions/performance_optimizer.py", {
      environment = var.environment
    })
    filename = "performance_optimizer.py"
  }
}

# CloudWatch Event Rule to trigger performance optimization
resource "aws_cloudwatch_event_rule" "performance_optimization_schedule" {
  name                = "${var.project_name}-performance-optimization-${var.environment}"
  description         = "Trigger performance optimization analysis"
  schedule_expression = "rate(1 hour)"
  
  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "performance_optimizer_target" {
  rule      = aws_cloudwatch_event_rule.performance_optimization_schedule.name
  target_id = "PerformanceOptimizerTarget"
  arn       = aws_lambda_function.performance_optimizer.arn
}

resource "aws_lambda_permission" "allow_cloudwatch_performance_optimizer" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.performance_optimizer.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.performance_optimization_schedule.arn
}