# CloudWatch Monitoring and Logging for User Journey Analytics Agent

# CloudWatch Log Groups for all application components
resource "aws_cloudwatch_log_group" "application_logs" {
  name              = "/aws/application/${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days
  
  tags = var.tags
}

resource "aws_cloudwatch_log_group" "lambda_event_processor_logs" {
  name              = "/aws/lambda/${var.project_name}-event-processor-${var.environment}"
  retention_in_days = var.log_retention_days
  
  tags = var.tags
}

resource "aws_cloudwatch_log_group" "lambda_struggle_detector_logs" {
  name              = "/aws/lambda/${var.project_name}-struggle-detector-${var.environment}"
  retention_in_days = var.log_retention_days
  
  tags = var.tags
}

resource "aws_cloudwatch_log_group" "lambda_video_analyzer_logs" {
  name              = "/aws/lambda/${var.project_name}-video-analyzer-${var.environment}"
  retention_in_days = var.log_retention_days
  
  tags = var.tags
}

resource "aws_cloudwatch_log_group" "lambda_intervention_executor_logs" {
  name              = "/aws/lambda/${var.project_name}-intervention-executor-${var.environment}"
  retention_in_days = var.log_retention_days
  
  tags = var.tags
}

resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/aws/apigateway/${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days
  
  tags = var.tags
}

# CloudWatch Alarms for critical metrics and error rates

# DynamoDB Throttling Alarms
resource "aws_cloudwatch_metric_alarm" "dynamodb_throttling_alarm" {
  for_each = toset(var.dynamodb_table_names)
  
  alarm_name          = "${var.project_name}-dynamodb-throttling-${each.key}-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors DynamoDB throttling for ${each.key}"
  alarm_actions       = [var.sns_topic_arn]
  
  dimensions = {
    TableName = each.key
  }
  
  tags = var.tags
}

# Lambda Error Rate Alarms
resource "aws_cloudwatch_metric_alarm" "lambda_error_rate_alarm" {
  for_each = toset(var.lambda_function_names)
  
  alarm_name          = "${var.project_name}-lambda-error-rate-${each.key}-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.lambda_error_threshold
  alarm_description   = "This metric monitors Lambda error rate for ${each.key}"
  alarm_actions       = [var.sns_topic_arn]
  
  dimensions = {
    FunctionName = each.key
  }
  
  tags = var.tags
}

# Lambda Duration Alarms
resource "aws_cloudwatch_metric_alarm" "lambda_duration_alarm" {
  for_each = toset(var.lambda_function_names)
  
  alarm_name          = "${var.project_name}-lambda-duration-${each.key}-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = var.lambda_duration_threshold
  alarm_description   = "This metric monitors Lambda duration for ${each.key}"
  alarm_actions       = [var.sns_topic_arn]
  
  dimensions = {
    FunctionName = each.key
  }
  
  tags = var.tags
}

# Kinesis Iterator Age Alarm
resource "aws_cloudwatch_metric_alarm" "kinesis_iterator_age_alarm" {
  alarm_name          = "${var.project_name}-kinesis-iterator-age-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "GetRecords.IteratorAgeMilliseconds"
  namespace           = "AWS/Kinesis"
  period              = "300"
  statistic           = "Maximum"
  threshold           = var.kinesis_iterator_age_threshold
  alarm_description   = "This metric monitors Kinesis iterator age"
  alarm_actions       = [var.sns_topic_arn]
  
  dimensions = {
    StreamName = var.kinesis_stream_name
  }
  
  tags = var.tags
}

# Kinesis Incoming Records Alarm
resource "aws_cloudwatch_metric_alarm" "kinesis_incoming_records_alarm" {
  alarm_name          = "${var.project_name}-kinesis-incoming-records-${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "IncomingRecords"
  namespace           = "AWS/Kinesis"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "This metric monitors Kinesis incoming records (low activity alert)"
  alarm_actions       = [var.sns_topic_arn]
  treat_missing_data  = "breaching"
  
  dimensions = {
    StreamName = var.kinesis_stream_name
  }
  
  tags = var.tags
}

# Application Error Log Alarm
resource "aws_cloudwatch_metric_alarm" "application_error_log_alarm" {
  alarm_name          = "${var.project_name}-application-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ErrorCount"
  namespace           = "CWLogs"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.application_error_threshold
  alarm_description   = "This metric monitors application error logs"
  alarm_actions       = [var.sns_topic_arn]
  
  tags = var.tags
}

# CloudWatch Dashboard for system monitoring
resource "aws_cloudwatch_dashboard" "system_dashboard" {
  dashboard_name = "${var.project_name}-system-dashboard-${var.environment}"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", var.dynamodb_table_names[0]],
            [".", "ConsumedWriteCapacityUnits", ".", "."],
            [".", "ThrottledRequests", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "DynamoDB Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", var.lambda_function_names[0]],
            [".", "Errors", ".", "."],
            [".", "Invocations", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/Kinesis", "IncomingRecords", "StreamName", var.kinesis_stream_name],
            [".", "OutgoingRecords", ".", "."],
            [".", "GetRecords.IteratorAgeMilliseconds", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Kinesis Metrics"
          period  = 300
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 18
        width  = 24
        height = 6
        
        properties = {
          query   = "SOURCE '/aws/application/${var.project_name}-${var.environment}' | fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 100"
          region  = var.aws_region
          title   = "Recent Application Errors"
        }
      }
    ]
  })
  
  tags = var.tags
}

# Custom CloudWatch Dashboard for business metrics
resource "aws_cloudwatch_dashboard" "business_dashboard" {
  dashboard_name = "${var.project_name}-business-dashboard-${var.environment}"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 8
        height = 6
        
        properties = {
          metrics = [
            ["UserJourneyAnalytics", "ActiveUsers", "Environment", var.environment],
            [".", "NewUsers", ".", "."],
            [".", "SessionCount", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "User Engagement Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 0
        width  = 8
        height = 6
        
        properties = {
          metrics = [
            ["UserJourneyAnalytics", "StruggleSignalsDetected", "Environment", var.environment],
            [".", "InterventionsExecuted", ".", "."],
            [".", "VideoEngagementRate", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "AI/ML Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 0
        width  = 8
        height = 6
        
        properties = {
          metrics = [
            ["UserJourneyAnalytics", "EventProcessingLatency", "Environment", var.environment],
            [".", "DataPipelineErrors", ".", "."],
            [".", "RealTimeUpdateLatency", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Performance Metrics"
          period  = 300
        }
      }
    ]
  })
  
  tags = var.tags
}

# CloudWatch Metric Filters for custom application metrics
resource "aws_cloudwatch_log_metric_filter" "error_count_filter" {
  name           = "${var.project_name}-error-count-${var.environment}"
  log_group_name = aws_cloudwatch_log_group.application_logs.name
  pattern        = "[timestamp, request_id, level=\"ERROR\", ...]"
  
  metric_transformation {
    name      = "ErrorCount"
    namespace = "UserJourneyAnalytics"
    value     = "1"
    
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "struggle_signal_filter" {
  name           = "${var.project_name}-struggle-signals-${var.environment}"
  log_group_name = aws_cloudwatch_log_group.lambda_struggle_detector_logs.name
  pattern        = "[timestamp, request_id, level, message=\"STRUGGLE_DETECTED\", ...]"
  
  metric_transformation {
    name      = "StruggleSignalsDetected"
    namespace = "UserJourneyAnalytics"
    value     = "1"
    
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "intervention_filter" {
  name           = "${var.project_name}-interventions-${var.environment}"
  log_group_name = aws_cloudwatch_log_group.lambda_intervention_executor_logs.name
  pattern        = "[timestamp, request_id, level, message=\"INTERVENTION_EXECUTED\", ...]"
  
  metric_transformation {
    name      = "InterventionsExecuted"
    namespace = "UserJourneyAnalytics"
    value     = "1"
    
    default_value = "0"
  }
}

# SNS Topic for additional alert notifications (if not provided)
resource "aws_sns_topic" "additional_alerts" {
  count = var.create_additional_sns_topic ? 1 : 0
  name  = "${var.project_name}-additional-alerts-${var.environment}"
  
  tags = var.tags
}

resource "aws_sns_topic_subscription" "additional_email_alerts" {
  count     = var.create_additional_sns_topic && var.additional_alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.additional_alerts[0].arn
  protocol  = "email"
  endpoint  = var.additional_alert_email
}

# CloudWatch Composite Alarms for complex scenarios
resource "aws_cloudwatch_composite_alarm" "system_health_alarm" {
  alarm_name        = "${var.project_name}-system-health-${var.environment}"
  alarm_description = "Composite alarm for overall system health"
  
  alarm_rule = join(" OR ", [
    "ALARM(${aws_cloudwatch_metric_alarm.lambda_error_rate_alarm[var.lambda_function_names[0]].alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.dynamodb_throttling_alarm[var.dynamodb_table_names[0]].alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.kinesis_iterator_age_alarm.alarm_name})"
  ])
  
  alarm_actions = [var.sns_topic_arn]
  
  tags = var.tags
}