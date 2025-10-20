# Auto-scaling Configuration for AWS Services

# Application Auto Scaling for Lambda Provisioned Concurrency
resource "aws_appautoscaling_target" "lambda_event_processor_concurrency" {
  count              = var.enable_lambda_auto_scaling ? 1 : 0
  max_capacity       = var.lambda_max_provisioned_concurrency
  min_capacity       = var.lambda_min_provisioned_concurrency
  resource_id        = "function:${module.lambda.event_processor_function_name}:provisioned"
  scalable_dimension = "lambda:function:ProvisionedConcurrency"
  service_namespace  = "lambda"
}

resource "aws_appautoscaling_policy" "lambda_event_processor_scaling" {
  count              = var.enable_lambda_auto_scaling ? 1 : 0
  name               = "${var.project_name}-lambda-event-processor-scaling-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.lambda_event_processor_concurrency[0].resource_id
  scalable_dimension = aws_appautoscaling_target.lambda_event_processor_concurrency[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.lambda_event_processor_concurrency[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "LambdaProvisionedConcurrencyUtilization"
    }
    target_value = 70.0
  }
}

# Kinesis Data Streams Auto Scaling
resource "aws_appautoscaling_target" "kinesis_stream_shards" {
  count              = var.enable_kinesis_auto_scaling ? 1 : 0
  max_capacity       = var.kinesis_max_shard_count
  min_capacity       = var.kinesis_min_shard_count
  resource_id        = "stream/${module.kinesis.data_stream_name}"
  scalable_dimension = "kinesis:stream:shard:count"
  service_namespace  = "kinesis"
}

resource "aws_appautoscaling_policy" "kinesis_stream_scaling" {
  count              = var.enable_kinesis_auto_scaling ? 1 : 0
  name               = "${var.project_name}-kinesis-stream-scaling-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.kinesis_stream_shards[0].resource_id
  scalable_dimension = aws_appautoscaling_target.kinesis_stream_shards[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.kinesis_stream_shards[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "KinesisStreamIncomingRecords"
    }
    target_value = 20000.0  # Records per shard per second
  }
}

# SageMaker Endpoint Auto Scaling
resource "aws_appautoscaling_target" "sagemaker_endpoint" {
  count              = var.environment != "demo" && var.enable_sagemaker_auto_scaling ? 1 : 0
  max_capacity       = var.sagemaker_max_instance_count
  min_capacity       = var.sagemaker_min_instance_count
  resource_id        = "endpoint/${aws_sagemaker_endpoint.exit_risk_predictor[0].name}/variant/primary"
  scalable_dimension = "sagemaker:variant:DesiredInstanceCount"
  service_namespace  = "sagemaker"
}

resource "aws_appautoscaling_policy" "sagemaker_endpoint_scaling" {
  count              = var.environment != "demo" && var.enable_sagemaker_auto_scaling ? 1 : 0
  name               = "${var.project_name}-sagemaker-endpoint-scaling-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.sagemaker_endpoint[0].resource_id
  scalable_dimension = aws_appautoscaling_target.sagemaker_endpoint[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.sagemaker_endpoint[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "SageMakerVariantInvocationsPerInstance"
    }
    target_value = 100.0  # Invocations per instance per minute
  }
}

# API Gateway Auto Scaling (for caching)
resource "aws_api_gateway_method_settings" "analytics_caching" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  stage_name  = aws_api_gateway_stage.main.stage_name
  method_path = "analytics/GET"

  settings {
    # Enable caching for better performance
    caching_enabled      = var.environment == "prod" ? true : false
    cache_ttl_in_seconds = 300  # 5 minutes
    cache_key_parameters = ["method.request.querystring.userId"]
    
    # Throttling settings
    throttling_rate_limit  = var.is_demo_environment ? 100 : 1000
    throttling_burst_limit = var.is_demo_environment ? 200 : 2000
    
    # Logging
    logging_level      = "INFO"
    data_trace_enabled = true
    metrics_enabled    = true
  }
}

# CloudWatch Auto Scaling for Custom Metrics
resource "aws_cloudwatch_metric_alarm" "high_event_processing_load" {
  alarm_name          = "${var.project_name}-high-event-processing-load-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "UserEventsProcessed"
  namespace           = "UserJourneyAnalytics"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10000"
  alarm_description   = "This metric monitors high event processing load"
  alarm_actions       = [aws_sns_topic.scaling_alerts.arn]
  
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_concurrent_executions_high" {
  alarm_name          = "${var.project_name}-lambda-concurrent-executions-high-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ConcurrentExecutions"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Maximum"
  threshold           = "800"
  alarm_description   = "This metric monitors high Lambda concurrent executions"
  alarm_actions       = [aws_sns_topic.scaling_alerts.arn]
  
  dimensions = {
    FunctionName = module.lambda.event_processor_function_name
  }
  
  tags = local.common_tags
}

# SNS Topic for Scaling Alerts
resource "aws_sns_topic" "scaling_alerts" {
  name = "${var.project_name}-scaling-alerts-${var.environment}"
  
  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "scaling_email_alerts" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.scaling_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Auto Scaling Notifications
resource "aws_autoscaling_notification" "lambda_scaling_notifications" {
  count       = var.enable_lambda_auto_scaling ? 1 : 0
  group_names = [aws_appautoscaling_target.lambda_event_processor_concurrency[0].resource_id]

  notifications = [
    "autoscaling:EC2_INSTANCE_LAUNCH",
    "autoscaling:EC2_INSTANCE_TERMINATE",
    "autoscaling:EC2_INSTANCE_LAUNCH_ERROR",
    "autoscaling:EC2_INSTANCE_TERMINATE_ERROR",
  ]

  topic_arn = aws_sns_topic.scaling_alerts.arn
}

# Scheduled Scaling for Demo Environment (Cost Optimization)
resource "aws_appautoscaling_scheduled_action" "demo_scale_down" {
  count              = var.is_demo_environment && var.enable_scheduled_scaling ? 1 : 0
  name               = "${var.project_name}-demo-scale-down-${var.environment}"
  service_namespace  = "lambda"
  resource_id        = aws_appautoscaling_target.lambda_event_processor_concurrency[0].resource_id
  scalable_dimension = "lambda:function:ProvisionedConcurrency"
  schedule           = var.demo_scale_down_schedule

  scalable_target_action {
    min_capacity = 0
    max_capacity = 0
  }
}

resource "aws_appautoscaling_scheduled_action" "demo_scale_up" {
  count              = var.is_demo_environment && var.enable_scheduled_scaling ? 1 : 0
  name               = "${var.project_name}-demo-scale-up-${var.environment}"
  service_namespace  = "lambda"
  resource_id        = aws_appautoscaling_target.lambda_event_processor_concurrency[0].resource_id
  scalable_dimension = "lambda:function:ProvisionedConcurrency"
  schedule           = var.demo_scale_up_schedule

  scalable_target_action {
    min_capacity = var.lambda_min_provisioned_concurrency
    max_capacity = var.lambda_max_provisioned_concurrency
  }
}

# Performance Monitoring Dashboard for Auto Scaling
resource "aws_cloudwatch_dashboard" "auto_scaling_performance" {
  dashboard_name = "${var.project_name}-auto-scaling-performance-${var.environment}"
  
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
            ["AWS/Lambda", "ConcurrentExecutions", "FunctionName", module.lambda.event_processor_function_name],
            [".", "ProvisionedConcurrencyUtilization", ".", "."],
            [".", "Duration", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Performance and Scaling"
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
            ["AWS/Kinesis", "IncomingRecords", "StreamName", module.kinesis.data_stream_name],
            [".", "OutgoingRecords", ".", "."],
            [".", "GetRecords.IteratorAgeMilliseconds", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Kinesis Stream Performance"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 24
        height = 6
        
        properties = {
          metrics = var.environment != "demo" ? [
            ["AWS/SageMaker", "ModelLatency", "EndpointName", aws_sagemaker_endpoint.exit_risk_predictor[0].name],
            [".", "Invocations", ".", "."],
            [".", "InvocationsPerInstance", ".", "."]
          ] : [
            ["UserJourneyAnalytics", "UserEventsProcessed"],
            [".", "DataProcessingLatency"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = var.environment != "demo" ? "SageMaker Endpoint Performance" : "Demo Mode - Processing Metrics"
          period  = 300
        }
      }
    ]
  })
}