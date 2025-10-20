# Monitoring and Logging Configuration

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each = toset([
    "event-processor",
    "struggle-detector", 
    "video-analyzer",
    "intervention-executor"
  ])
  
  name              = "/aws/lambda/${var.project_name}-${each.key}-${var.environment}"
  retention_in_days = var.is_demo_environment ? 7 : (var.environment == "prod" ? 30 : 14)
  
  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "kinesis_analytics_logs" {
  name              = "/aws/kinesisanalytics/${var.project_name}-${var.environment}"
  retention_in_days = var.environment == "prod" ? 30 : 14
  
  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/aws/apigateway/${var.project_name}-${var.environment}"
  retention_in_days = var.environment == "prod" ? 30 : 14
  
  tags = local.common_tags
}

# CloudWatch Dashboards
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-system-health-${var.environment}"
  
  dashboard_body = jsonencode({
    widgets = [
      # System Overview Row
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 8
        height = 6
        
        properties = {
          metrics = [
            ["UserJourneyAnalytics", "UserEventsProcessed"],
            [".", "StruggleSignalsDetected"],
            [".", "InterventionsExecuted"],
            [".", "HighVideoEngagement"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Business Metrics Overview"
          period  = 300
          stat    = "Sum"
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
            ["UserJourneyAnalytics", "AIServiceErrors"],
            [".", "BedrockInvocations"],
            [".", "NovaAnalysisRequests"],
            [".", "SageMakerPredictions"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "AI Services Activity"
          period  = 300
          stat    = "Sum"
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
            ["UserJourneyAnalytics", "DataProcessingLatency"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Processing Latency"
          period  = 300
          stat    = "Average"
          yAxis = {
            left = {
              min = 0
              max = 10000
            }
          }
        }
      },
      
      # Lambda Functions Row
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", "${var.project_name}-event-processor-${var.environment}"],
            [".", ".", ".", "${var.project_name}-struggle-detector-${var.environment}"],
            [".", ".", ".", "${var.project_name}-video-analyzer-${var.environment}"],
            [".", ".", ".", "${var.project_name}-intervention-executor-${var.environment}"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Function Duration"
          period  = 300
          stat    = "Average"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", "${var.project_name}-event-processor-${var.environment}"],
            [".", ".", ".", "${var.project_name}-struggle-detector-${var.environment}"],
            [".", ".", ".", "${var.project_name}-video-analyzer-${var.environment}"],
            [".", ".", ".", "${var.project_name}-intervention-executor-${var.environment}"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Function Errors"
          period  = 300
          stat    = "Sum"
        }
      },
      
      # Data Storage Row
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 8
        height = 6
        
        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "${var.project_name}-user-profiles-${var.environment}"],
            [".", "ConsumedWriteCapacityUnits", ".", "."],
            [".", "ConsumedReadCapacityUnits", ".", "${var.project_name}-user-events-${var.environment}"],
            [".", "ConsumedWriteCapacityUnits", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "DynamoDB Capacity Usage"
          period  = 300
          stat    = "Sum"
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 12
        width  = 8
        height = 6
        
        properties = {
          metrics = [
            ["AWS/DynamoDB", "ThrottledRequests", "TableName", "${var.project_name}-user-profiles-${var.environment}"],
            [".", ".", ".", "${var.project_name}-user-events-${var.environment}"],
            [".", ".", ".", "${var.project_name}-struggle-signals-${var.environment}"],
            [".", ".", ".", "${var.project_name}-video-engagement-${var.environment}"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "DynamoDB Throttles"
          period  = 300
          stat    = "Sum"
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 12
        width  = 8
        height = 6
        
        properties = {
          metrics = [
            ["AWS/Kinesis", "IncomingRecords", "StreamName", "${var.project_name}-user-events-${var.environment}"],
            [".", "OutgoingRecords", ".", "."],
            [".", "GetRecords.IteratorAgeMilliseconds", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Kinesis Stream Health"
          period  = 300
        }
      },
      
      # AI Services Row
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/Bedrock", "ModelInvocationLatency"],
            [".", "ModelInvocationClientError"],
            [".", "ModelInvocationServerError"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Bedrock Service Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 18
        width  = 12
        height = 6
        
        properties = {
          metrics = var.environment != "demo" ? [
            ["AWS/SageMaker", "ModelLatency", "EndpointName", "${var.project_name}-exit-risk-predictor-${var.environment}"],
            [".", "ModelInvocation4XXError", ".", "."],
            [".", "ModelInvocation5XXError", ".", "."]
          ] : [
            ["AWS/Lambda", "Duration", "FunctionName", "${var.project_name}-event-processor-${var.environment}"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = var.environment != "demo" ? "SageMaker Endpoint Metrics" : "Demo Mode - No SageMaker"
          period  = 300
        }
      }
    ]
  })
}

# AI Services Specific Dashboard
resource "aws_cloudwatch_dashboard" "ai_services" {
  dashboard_name = "${var.project_name}-ai-services-${var.environment}"
  
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
            ["UserJourneyAnalytics", "BedrockInvocations"],
            [".", "NovaAnalysisRequests"],
            [".", "SageMakerPredictions"],
            [".", "AIServiceErrors"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "AI Service Usage Patterns"
          period  = 300
          stat    = "Sum"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/Bedrock", "ModelInvocationLatency"],
            ["UserJourneyAnalytics", "DataProcessingLatency"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "AI Service Response Times"
          period  = 300
          stat    = "Average"
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 6
        width  = 24
        height = 6
        
        properties = {
          query   = "SOURCE '${aws_cloudwatch_log_group.lambda_logs["event-processor"].name}'\n| fields @timestamp, @message\n| filter @message like /AI_SERVICE_ERROR/\n| sort @timestamp desc\n| limit 20"
          region  = var.aws_region
          title   = "Recent AI Service Errors"
          view    = "table"
        }
      }
    ]
  })
}

# Performance Dashboard
resource "aws_cloudwatch_dashboard" "performance" {
  dashboard_name = "${var.project_name}-performance-${var.environment}"
  
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
            ["UserJourneyAnalytics", "DataProcessingLatency"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "End-to-End Processing Latency"
          period  = 300
          stat    = "Average"
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
            ["AWS/Lambda", "ConcurrentExecutions", "FunctionName", "${var.project_name}-event-processor-${var.environment}"],
            [".", ".", ".", "${var.project_name}-struggle-detector-${var.environment}"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Concurrency"
          period  = 300
          stat    = "Maximum"
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
            ["AWS/Kinesis", "GetRecords.IteratorAgeMilliseconds", "StreamName", "${var.project_name}-user-events-${var.environment}"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Stream Processing Lag"
          period  = 300
          stat    = "Maximum"
        }
      }
    ]
  })
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = toset([
    "event-processor",
    "struggle-detector",
    "video-analyzer", 
    "intervention-executor"
  ])
  
  alarm_name          = "${var.project_name}-${each.key}-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors lambda errors for ${each.key}"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  
  dimensions = {
    FunctionName = "${var.project_name}-${each.key}-${var.environment}"
  }
  
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  for_each = toset([
    "event-processor",
    "struggle-detector",
    "video-analyzer",
    "intervention-executor"
  ])
  
  alarm_name          = "${var.project_name}-${each.key}-duration-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = "30000" # 30 seconds
  alarm_description   = "This metric monitors lambda duration for ${each.key}"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  
  dimensions = {
    FunctionName = "${var.project_name}-${each.key}-${var.environment}"
  }
  
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "kinesis_iterator_age" {
  alarm_name          = "${var.project_name}-kinesis-iterator-age-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "GetRecords.IteratorAgeMilliseconds"
  namespace           = "AWS/Kinesis"
  period              = "300"
  statistic           = "Maximum"
  threshold           = "60000" # 1 minute
  alarm_description   = "This metric monitors Kinesis iterator age"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  
  dimensions = {
    StreamName = "${var.project_name}-user-events-${var.environment}"
  }
  
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_throttles" {
  for_each = toset([
    "user-profiles",
    "user-events",
    "struggle-signals",
    "video-engagement"
  ])
  
  alarm_name          = "${var.project_name}-${each.key}-throttles-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors DynamoDB throttles for ${each.key}"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  
  dimensions = {
    TableName = "${var.project_name}-${each.key}-${var.environment}"
  }
  
  tags = local.common_tags
}

# Additional CloudWatch Alarms for AI Services
resource "aws_cloudwatch_metric_alarm" "ai_service_errors" {
  alarm_name          = "${var.project_name}-ai-service-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "AIServiceErrors"
  namespace           = "UserJourneyAnalytics"
  period              = "300"
  statistic           = "Sum"
  threshold           = "3"
  alarm_description   = "This metric monitors AI service errors"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
  
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "bedrock_throttling" {
  alarm_name          = "${var.project_name}-bedrock-throttling-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ModelInvocationClientError"
  namespace           = "AWS/Bedrock"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors Bedrock throttling errors"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
  
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "sagemaker_endpoint_errors" {
  count = var.environment != "demo" ? 1 : 0
  
  alarm_name          = "${var.project_name}-sagemaker-endpoint-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ModelInvocation4XXError"
  namespace           = "AWS/SageMaker"
  period              = "300"
  statistic           = "Sum"
  threshold           = "3"
  alarm_description   = "This metric monitors SageMaker endpoint errors"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
  
  dimensions = {
    EndpointName = "${var.project_name}-exit-risk-predictor-${var.environment}"
  }
  
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "timestream_write_errors" {
  alarm_name          = "${var.project_name}-timestream-write-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "UserRequestExceptions"
  namespace           = "AWS/Timestream"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors Timestream write errors"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
  
  dimensions = {
    DatabaseName = "${var.project_name}-analytics-${var.environment}"
  }
  
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "s3_errors" {
  alarm_name          = "${var.project_name}-s3-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4xxErrors"
  namespace           = "AWS/S3"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors S3 4xx errors"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
  
  dimensions = {
    BucketName = "${var.project_name}-event-logs-${var.environment}"
  }
  
  tags = local.common_tags
}

# Performance Alarms
resource "aws_cloudwatch_metric_alarm" "high_data_processing_latency" {
  alarm_name          = "${var.project_name}-high-processing-latency-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "DataProcessingLatency"
  namespace           = "UserJourneyAnalytics"
  period              = "300"
  statistic           = "Average"
  threshold           = "5000" # 5 seconds
  alarm_description   = "This metric monitors high data processing latency"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
  
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "low_event_processing_rate" {
  alarm_name          = "${var.project_name}-low-event-processing-rate-${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "UserEventsProcessed"
  namespace           = "UserJourneyAnalytics"
  period              = "900" # 15 minutes
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors low event processing rate"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "breaching"
  
  tags = local.common_tags
}

# SNS Topic for Alerts is defined in main.tf

# X-Ray Tracing Configuration
resource "aws_xray_sampling_rule" "main" {
  rule_name      = "${var.project_name}-sampling-${var.environment}"
  priority       = 9000
  version        = 1
  reservoir_size = 1
  fixed_rate     = var.is_demo_environment ? 0.1 : 0.05
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"
  
  tags = local.common_tags
}

# High-priority sampling for AI services
resource "aws_xray_sampling_rule" "ai_services" {
  rule_name      = "${var.project_name}-ai-services-sampling-${var.environment}"
  priority       = 1000
  version        = 1
  reservoir_size = 2
  fixed_rate     = 0.2
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "AWS::Lambda::Function"
  service_name   = "${var.project_name}-*-${var.environment}"
  resource_arn   = "*"
  
  tags = local.common_tags
}

# X-Ray Service Map Dashboard
resource "aws_cloudwatch_dashboard" "xray_tracing" {
  dashboard_name = "${var.project_name}-distributed-tracing-${var.environment}"
  
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
            ["AWS/X-Ray", "TracesReceived"],
            [".", "TracesProcessed"],
            [".", "LatencyHigh"],
            [".", "ErrorRate"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "X-Ray Trace Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", "${var.project_name}-event-processor-${var.environment}"],
            ["AWS/X-Ray", "ResponseTime", "ServiceName", "${var.project_name}-event-processor-${var.environment}"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Service Response Times"
          period  = 300
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 6
        width  = 24
        height = 8
        
        properties = {
          query   = "SOURCE '${aws_cloudwatch_log_group.lambda_logs["event-processor"].name}'\n| fields @timestamp, @message, @requestId\n| filter @message like /TRACE_ID/\n| sort @timestamp desc\n| limit 50"
          region  = var.aws_region
          title   = "Recent Trace Events"
          view    = "table"
        }
      }
    ]
  })
}

# X-Ray Alarms
resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  alarm_name          = "${var.project_name}-high-error-rate-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ErrorRate"
  namespace           = "AWS/X-Ray"
  period              = "300"
  statistic           = "Average"
  threshold           = "0.05" # 5% error rate
  alarm_description   = "This metric monitors high error rate across services"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
  
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "high_latency" {
  alarm_name          = "${var.project_name}-high-latency-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "LatencyHigh"
  namespace           = "AWS/X-Ray"
  period              = "300"
  statistic           = "Average"
  threshold           = "10000" # 10 seconds
  alarm_description   = "This metric monitors high latency across services"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
  
  tags = local.common_tags
}

# Custom Metrics for Business Logic
resource "aws_cloudwatch_log_metric_filter" "struggle_signals" {
  name           = "${var.project_name}-struggle-signals-${var.environment}"
  log_group_name = aws_cloudwatch_log_group.lambda_logs["struggle-detector"].name
  pattern        = "[timestamp, request_id, level=\"INFO\", message=\"STRUGGLE_SIGNAL_DETECTED\", ...]"
  
  metric_transformation {
    name      = "StruggleSignalsDetected"
    namespace = "UserJourneyAnalytics"
    value     = "1"
  }
}

resource "aws_cloudwatch_log_metric_filter" "interventions_executed" {
  name           = "${var.project_name}-interventions-executed-${var.environment}"
  log_group_name = aws_cloudwatch_log_group.lambda_logs["intervention-executor"].name
  pattern        = "[timestamp, request_id, level=\"INFO\", message=\"INTERVENTION_EXECUTED\", ...]"
  
  metric_transformation {
    name      = "InterventionsExecuted"
    namespace = "UserJourneyAnalytics"
    value     = "1"
  }
}

resource "aws_cloudwatch_log_metric_filter" "video_engagement_high" {
  name           = "${var.project_name}-high-video-engagement-${var.environment}"
  log_group_name = aws_cloudwatch_log_group.lambda_logs["video-analyzer"].name
  pattern        = "[timestamp, request_id, level=\"INFO\", message=\"HIGH_ENGAGEMENT_DETECTED\", ...]"
  
  metric_transformation {
    name      = "HighVideoEngagement"
    namespace = "UserJourneyAnalytics"
    value     = "1"
  }
}

# Additional Custom Metrics
resource "aws_cloudwatch_log_metric_filter" "ai_service_errors" {
  name           = "${var.project_name}-ai-service-errors-${var.environment}"
  log_group_name = aws_cloudwatch_log_group.lambda_logs["event-processor"].name
  pattern        = "[timestamp, request_id, level=\"ERROR\", message=\"AI_SERVICE_ERROR\", ...]"
  
  metric_transformation {
    name      = "AIServiceErrors"
    namespace = "UserJourneyAnalytics"
    value     = "1"
  }
}

resource "aws_cloudwatch_log_metric_filter" "bedrock_invocations" {
  name           = "${var.project_name}-bedrock-invocations-${var.environment}"
  log_group_name = aws_cloudwatch_log_group.lambda_logs["event-processor"].name
  pattern        = "[timestamp, request_id, level=\"INFO\", message=\"BEDROCK_INVOCATION\", ...]"
  
  metric_transformation {
    name      = "BedrockInvocations"
    namespace = "UserJourneyAnalytics"
    value     = "1"
  }
}

resource "aws_cloudwatch_log_metric_filter" "nova_analysis_requests" {
  name           = "${var.project_name}-nova-analysis-${var.environment}"
  log_group_name = aws_cloudwatch_log_group.lambda_logs["event-processor"].name
  pattern        = "[timestamp, request_id, level=\"INFO\", message=\"NOVA_ANALYSIS_REQUEST\", ...]"
  
  metric_transformation {
    name      = "NovaAnalysisRequests"
    namespace = "UserJourneyAnalytics"
    value     = "1"
  }
}

resource "aws_cloudwatch_log_metric_filter" "sagemaker_predictions" {
  name           = "${var.project_name}-sagemaker-predictions-${var.environment}"
  log_group_name = aws_cloudwatch_log_group.lambda_logs["event-processor"].name
  pattern        = "[timestamp, request_id, level=\"INFO\", message=\"SAGEMAKER_PREDICTION\", ...]"
  
  metric_transformation {
    name      = "SageMakerPredictions"
    namespace = "UserJourneyAnalytics"
    value     = "1"
  }
}

resource "aws_cloudwatch_log_metric_filter" "user_events_processed" {
  name           = "${var.project_name}-user-events-processed-${var.environment}"
  log_group_name = aws_cloudwatch_log_group.lambda_logs["event-processor"].name
  pattern        = "[timestamp, request_id, level=\"INFO\", message=\"EVENT_PROCESSED\", ...]"
  
  metric_transformation {
    name      = "UserEventsProcessed"
    namespace = "UserJourneyAnalytics"
    value     = "1"
  }
}

resource "aws_cloudwatch_log_metric_filter" "data_processing_latency" {
  name           = "${var.project_name}-data-processing-latency-${var.environment}"
  log_group_name = aws_cloudwatch_log_group.lambda_logs["event-processor"].name
  pattern        = "[timestamp, request_id, level=\"INFO\", message=\"PROCESSING_LATENCY\", latency_ms]"
  
  metric_transformation {
    name      = "DataProcessingLatency"
    namespace = "UserJourneyAnalytics"
    value     = "$latency_ms"
  }
}

# Cost Monitoring and Optimization
resource "aws_budgets_budget" "monthly_cost_budget" {
  name         = "${var.project_name}-monthly-budget-${var.environment}"
  budget_type  = "COST"
  limit_amount = var.is_demo_environment ? "300" : (var.environment == "prod" ? "1000" : "500")
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  
  cost_filters {
    tag {
      key = "Project"
      values = [var.project_name]
    }
  }
  
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }
  
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}

# Cost Anomaly Detection
resource "aws_ce_anomaly_detector" "service_monitor" {
  name         = "${var.project_name}-service-anomaly-${var.environment}"
  monitor_type = "DIMENSIONAL"
  
  specification = jsonencode({
    Dimension = "SERVICE"
    MatchOptions = ["EQUALS"]
    Values = ["Amazon Bedrock", "Amazon SageMaker", "Amazon DynamoDB", "AWS Lambda", "Amazon Kinesis"]
  })
  
  tags = local.common_tags
}

resource "aws_ce_anomaly_subscription" "cost_anomaly_alerts" {
  name      = "${var.project_name}-cost-anomaly-alerts-${var.environment}"
  frequency = "DAILY"
  
  monitor_arn_list = [
    aws_ce_anomaly_detector.service_monitor.arn
  ]
  
  subscriber {
    type    = "EMAIL"
    address = var.alert_email
  }
  
  threshold_expression {
    and {
      dimension {
        key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
        values        = [var.is_demo_environment ? "50" : "100"]
        match_options = ["GREATER_THAN_OR_EQUAL"]
      }
    }
  }
  
  tags = local.common_tags
}

# Cost Dashboard
resource "aws_cloudwatch_dashboard" "cost_monitoring" {
  dashboard_name = "${var.project_name}-cost-monitoring-${var.environment}"
  
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
            ["AWS/Lambda", "Duration", "FunctionName", "${var.project_name}-event-processor-${var.environment}"],
            [".", "Invocations", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Cost Drivers"
          period  = 3600
          stat    = "Sum"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "${var.project_name}-user-profiles-${var.environment}"],
            [".", "ConsumedWriteCapacityUnits", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "DynamoDB Cost Drivers"
          period  = 3600
          stat    = "Sum"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 24
        height = 6
        
        properties = {
          metrics = [
            ["AWS/Bedrock", "ModelInvocationLatency"],
            ["UserJourneyAnalytics", "BedrockInvocations"],
            ["UserJourneyAnalytics", "NovaAnalysisRequests"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "AI Services Usage (Cost Impact)"
          period  = 3600
        }
      }
    ]
  })
}

# CloudWatch Insights Queries
resource "aws_cloudwatch_query_definition" "error_analysis" {
  name = "${var.project_name}-error-analysis-${var.environment}"
  
  log_group_names = [
    aws_cloudwatch_log_group.lambda_logs["event-processor"].name,
    aws_cloudwatch_log_group.lambda_logs["struggle-detector"].name,
    aws_cloudwatch_log_group.lambda_logs["video-analyzer"].name,
    aws_cloudwatch_log_group.lambda_logs["intervention-executor"].name
  ]
  
  query_string = <<EOF
fields @timestamp, @message, @logStream
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
EOF
}

resource "aws_cloudwatch_query_definition" "performance_analysis" {
  name = "${var.project_name}-performance-analysis-${var.environment}"
  
  log_group_names = [
    aws_cloudwatch_log_group.lambda_logs["event-processor"].name
  ]
  
  query_string = <<EOF
fields @timestamp, @duration, @billedDuration, @memorySize, @maxMemoryUsed
| filter @type = "REPORT"
| stats avg(@duration), max(@duration), min(@duration) by bin(5m)
EOF
}

resource "aws_cloudwatch_query_definition" "ai_service_usage" {
  name = "${var.project_name}-ai-service-usage-${var.environment}"
  
  log_group_names = [
    aws_cloudwatch_log_group.lambda_logs["event-processor"].name
  ]
  
  query_string = <<EOF
fields @timestamp, @message
| filter @message like /BEDROCK_INVOCATION|NOVA_ANALYSIS_REQUEST|SAGEMAKER_PREDICTION/
| stats count() by bin(1h)
| sort @timestamp desc
EOF
}

resource "aws_cloudwatch_query_definition" "cost_optimization_insights" {
  name = "${var.project_name}-cost-optimization-${var.environment}"
  
  log_group_names = [
    aws_cloudwatch_log_group.lambda_logs["event-processor"].name,
    aws_cloudwatch_log_group.lambda_logs["struggle-detector"].name,
    aws_cloudwatch_log_group.lambda_logs["video-analyzer"].name,
    aws_cloudwatch_log_group.lambda_logs["intervention-executor"].name
  ]
  
  query_string = <<EOF
fields @timestamp, @duration, @billedDuration, @memorySize, @maxMemoryUsed, @logStream
| filter @type = "REPORT"
| stats avg(@duration), avg(@billedDuration), avg(@maxMemoryUsed), count() by @logStream
| sort avg(@billedDuration) desc
EOF
}

# Log Aggregation and Analysis
resource "aws_cloudwatch_log_destination" "central_logging" {
  name       = "${var.project_name}-central-logging-${var.environment}"
  role_arn   = aws_iam_role.log_destination_role.arn
  target_arn = aws_kinesis_stream.log_aggregation.arn
}

resource "aws_kinesis_stream" "log_aggregation" {
  name             = "${var.project_name}-log-aggregation-${var.environment}"
  shard_count      = var.is_demo_environment ? 1 : 2
  retention_period = 24
  
  shard_level_metrics = [
    "IncomingRecords",
    "OutgoingRecords",
  ]
  
  tags = local.common_tags
}

resource "aws_iam_role" "log_destination_role" {
  name = "${var.project_name}-log-destination-role-${var.environment}"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "logs.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.common_tags
}

resource "aws_iam_role_policy" "log_destination_policy" {
  name = "${var.project_name}-log-destination-policy-${var.environment}"
  role = aws_iam_role.log_destination_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kinesis:PutRecord",
          "kinesis:PutRecords"
        ]
        Resource = aws_kinesis_stream.log_aggregation.arn
      }
    ]
  })
}

# Log Analysis Lambda Function
resource "aws_lambda_function" "log_analyzer" {
  filename         = "log_analyzer.zip"
  function_name    = "${var.project_name}-log-analyzer-${var.environment}"
  role            = aws_iam_role.log_analyzer_role.arn
  handler         = "log_analyzer.lambda_handler"
  runtime         = var.lambda_runtime
  timeout         = 300
  memory_size     = 512
  
  environment {
    variables = {
      ENVIRONMENT = var.environment
      PROJECT_NAME = var.project_name
    }
  }
  
  tracing_config {
    mode = "Active"
  }
  
  tags = local.common_tags
}

resource "aws_iam_role" "log_analyzer_role" {
  name = "${var.project_name}-log-analyzer-role-${var.environment}"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "log_analyzer_basic" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.log_analyzer_role.name
}

resource "aws_iam_role_policy" "log_analyzer_policy" {
  name = "${var.project_name}-log-analyzer-policy-${var.environment}"
  role = aws_iam_role.log_analyzer_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kinesis:DescribeStream",
          "kinesis:GetShardIterator",
          "kinesis:GetRecords",
          "kinesis:ListStreams"
        ]
        Resource = aws_kinesis_stream.log_aggregation.arn
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_lambda_event_source_mapping" "log_analyzer_kinesis" {
  event_source_arn  = aws_kinesis_stream.log_aggregation.arn
  function_name     = aws_lambda_function.log_analyzer.arn
  starting_position = "LATEST"
  batch_size        = 100
  
  depends_on = [aws_iam_role_policy_attachment.log_analyzer_basic]
}

# OpenSearch for Log Analysis
resource "aws_opensearch_domain" "log_analytics" {
  count = var.environment != "demo" ? 1 : 0
  
  domain_name    = "${var.project_name}-logs-${var.environment}"
  engine_version = "OpenSearch_2.3"
  
  cluster_config {
    instance_type  = "t3.small.search"
    instance_count = 1
  }
  
  ebs_options {
    ebs_enabled = true
    volume_type = "gp3"
    volume_size = 20
  }
  
  encrypt_at_rest {
    enabled = true
  }
  
  node_to_node_encryption {
    enabled = true
  }
  
  domain_endpoint_options {
    enforce_https = true
  }
  
  access_policies = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "es:*"
        Principal = "*"
        Effect = "Allow"
        Resource = "arn:aws:es:${var.aws_region}:*:domain/${var.project_name}-logs-${var.environment}/*"
      }
    ]
  })
  
  tags = local.common_tags
}

# Additional CloudWatch Insights Queries for Log Analysis
resource "aws_cloudwatch_query_definition" "security_analysis" {
  name = "${var.project_name}-security-analysis-${var.environment}"
  
  log_group_names = [
    aws_cloudwatch_log_group.lambda_logs["event-processor"].name,
    aws_cloudwatch_log_group.lambda_logs["struggle-detector"].name,
    aws_cloudwatch_log_group.lambda_logs["video-analyzer"].name,
    aws_cloudwatch_log_group.lambda_logs["intervention-executor"].name
  ]
  
  query_string = <<EOF
fields @timestamp, @message, @requestId
| filter @message like /SECURITY|UNAUTHORIZED|FORBIDDEN|AUTHENTICATION/
| sort @timestamp desc
| limit 100
EOF
}

resource "aws_cloudwatch_query_definition" "user_journey_analysis" {
  name = "${var.project_name}-user-journey-analysis-${var.environment}"
  
  log_group_names = [
    aws_cloudwatch_log_group.lambda_logs["event-processor"].name
  ]
  
  query_string = <<EOF
fields @timestamp, @message, @requestId
| filter @message like /USER_EVENT|STRUGGLE_SIGNAL|INTERVENTION/
| stats count() by bin(1h)
| sort @timestamp desc
EOF
}

resource "aws_cloudwatch_query_definition" "error_correlation" {
  name = "${var.project_name}-error-correlation-${var.environment}"
  
  log_group_names = [
    aws_cloudwatch_log_group.lambda_logs["event-processor"].name,
    aws_cloudwatch_log_group.lambda_logs["struggle-detector"].name,
    aws_cloudwatch_log_group.lambda_logs["video-analyzer"].name,
    aws_cloudwatch_log_group.lambda_logs["intervention-executor"].name
  ]
  
  query_string = <<EOF
fields @timestamp, @message, @logStream, @requestId
| filter @message like /ERROR|EXCEPTION|FAILED/
| stats count() by @logStream, bin(1h)
| sort @timestamp desc
EOF
}