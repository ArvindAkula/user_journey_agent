# Cost Management and Monitoring Infrastructure

# CloudWatch Dashboard for Cost Monitoring
resource "aws_cloudwatch_dashboard" "demo_cost_monitoring" {
  dashboard_name = "DemoEnvironmentCostMonitoring"

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
            ["AWS/Billing", "EstimatedCharges", "Currency", "USD"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"
          title   = "Demo Environment Daily Costs"
          period  = 86400
          stat    = "Maximum"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 6
        height = 6

        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", { "stat" = "Sum" }],
            ["AWS/Lambda", "Duration", { "stat" = "Average" }]
          ]
          view   = "timeSeries"
          region = var.aws_region
          title  = "Lambda Usage"
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 6
        y      = 6
        width  = 6
        height = 6

        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", { "stat" = "Sum" }],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", { "stat" = "Sum" }]
          ]
          view   = "timeSeries"
          region = var.aws_region
          title  = "DynamoDB Usage"
          period = 300
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
            ["AWS/Kinesis", "IncomingRecords", { "stat" = "Sum" }],
            ["AWS/Kinesis", "OutgoingRecords", { "stat" = "Sum" }]
          ]
          view   = "timeSeries"
          region = var.aws_region
          title  = "Kinesis Stream Activity"
          period = 300
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
    Project     = "UserJourneyAnalytics"
    CostCenter  = "Demo"
  }
}

# Billing Alerts
resource "aws_cloudwatch_metric_alarm" "demo_cost_alert_100" {
  alarm_name          = "DemoCostAlert-100"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  period              = "86400"
  statistic           = "Maximum"
  threshold           = "100"
  alarm_description   = "Demo environment cost alert at $100"
  alarm_actions       = [aws_sns_topic.cost_alerts.arn]

  dimensions = {
    Currency = "USD"
  }

  tags = {
    Environment = var.environment
    Project     = "UserJourneyAnalytics"
  }
}

resource "aws_cloudwatch_metric_alarm" "demo_cost_alert_200" {
  alarm_name          = "DemoCostAlert-200"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  period              = "86400"
  statistic           = "Maximum"
  threshold           = "200"
  alarm_description   = "Demo environment cost alert at $200"
  alarm_actions       = [aws_sns_topic.cost_alerts.arn]

  dimensions = {
    Currency = "USD"
  }

  tags = {
    Environment = var.environment
    Project     = "UserJourneyAnalytics"
  }
}

resource "aws_cloudwatch_metric_alarm" "demo_cost_alert_300" {
  alarm_name          = "DemoCostAlert-300"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  period              = "86400"
  statistic           = "Maximum"
  threshold           = "300"
  alarm_description   = "Demo environment cost alert at $300 - CRITICAL"
  alarm_actions       = [aws_sns_topic.cost_alerts.arn, aws_sns_topic.emergency_shutdown.arn]

  dimensions = {
    Currency = "USD"
  }

  tags = {
    Environment = var.environment
    Project     = "UserJourneyAnalytics"
  }
}

# SNS Topics for Cost Alerts
resource "aws_sns_topic" "cost_alerts" {
  name = "demo-cost-alerts"

  tags = {
    Environment = var.environment
    Project     = "UserJourneyAnalytics"
  }
}

resource "aws_sns_topic" "emergency_shutdown" {
  name = "demo-emergency-shutdown"

  tags = {
    Environment = var.environment
    Project     = "UserJourneyAnalytics"
  }
}

# SNS Topic Subscriptions (email notifications)
resource "aws_sns_topic_subscription" "cost_alert_email" {
  topic_arn = aws_sns_topic.cost_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_sns_topic_subscription" "emergency_shutdown_email" {
  topic_arn = aws_sns_topic.emergency_shutdown.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Lambda function for automated resource shutdown
resource "aws_lambda_function" "resource_shutdown" {
  filename         = "resource_shutdown.zip"
  function_name    = "demo-resource-shutdown"
  role            = aws_iam_role.shutdown_lambda_role.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.shutdown_lambda_zip.output_base64sha256
  runtime         = "python3.9"
  timeout         = 300

  environment {
    variables = {
      ENVIRONMENT_TAG = var.environment
    }
  }

  tags = {
    Environment = var.environment
    Project     = "UserJourneyAnalytics"
  }
}

# Lambda function for automated resource startup
resource "aws_lambda_function" "resource_startup" {
  filename         = "resource_startup.zip"
  function_name    = "demo-resource-startup"
  role            = aws_iam_role.shutdown_lambda_role.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.startup_lambda_zip.output_base64sha256
  runtime         = "python3.9"
  timeout         = 300

  environment {
    variables = {
      ENVIRONMENT_TAG = var.environment
    }
  }

  tags = {
    Environment = var.environment
    Project     = "UserJourneyAnalytics"
  }
}

# Lambda function for complete teardown
resource "aws_lambda_function" "environment_teardown" {
  filename         = "environment_teardown.zip"
  function_name    = "demo-environment-teardown"
  role            = aws_iam_role.teardown_lambda_role.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.teardown_lambda_zip.output_base64sha256
  runtime         = "python3.9"
  timeout         = 900

  environment {
    variables = {
      ENVIRONMENT_TAG = var.environment
    }
  }

  tags = {
    Environment = var.environment
    Project     = "UserJourneyAnalytics"
  }
}

# EventBridge rules for scheduled shutdown/startup
resource "aws_cloudwatch_event_rule" "daily_shutdown" {
  name                = "demo-daily-shutdown"
  description         = "Trigger daily shutdown of demo resources"
  schedule_expression = "cron(0 18 * * ? *)"  # 6 PM UTC daily

  tags = {
    Environment = var.environment
    Project     = "UserJourneyAnalytics"
  }
}

resource "aws_cloudwatch_event_rule" "daily_startup" {
  name                = "demo-daily-startup"
  description         = "Trigger daily startup of demo resources"
  schedule_expression = "cron(0 8 * * ? *)"   # 8 AM UTC daily

  tags = {
    Environment = var.environment
    Project     = "UserJourneyAnalytics"
  }
}

resource "aws_cloudwatch_event_rule" "lifecycle_cleanup" {
  name                = "demo-lifecycle-cleanup"
  description         = "Trigger complete environment cleanup after 15 days"
  schedule_expression = "cron(0 2 */15 * ? *)" # Every 15 days at 2 AM UTC

  tags = {
    Environment = var.environment
    Project     = "UserJourneyAnalytics"
  }
}

# EventBridge targets
resource "aws_cloudwatch_event_target" "shutdown_target" {
  rule      = aws_cloudwatch_event_rule.daily_shutdown.name
  target_id = "ShutdownLambdaTarget"
  arn       = aws_lambda_function.resource_shutdown.arn
}

resource "aws_cloudwatch_event_target" "startup_target" {
  rule      = aws_cloudwatch_event_rule.daily_startup.name
  target_id = "StartupLambdaTarget"
  arn       = aws_lambda_function.resource_startup.arn
}

resource "aws_cloudwatch_event_target" "teardown_target" {
  rule      = aws_cloudwatch_event_rule.lifecycle_cleanup.name
  target_id = "TeardownLambdaTarget"
  arn       = aws_lambda_function.environment_teardown.arn
}

# Lambda permissions for EventBridge
resource "aws_lambda_permission" "allow_eventbridge_shutdown" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.resource_shutdown.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_shutdown.arn
}

resource "aws_lambda_permission" "allow_eventbridge_startup" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.resource_startup.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_startup.arn
}

resource "aws_lambda_permission" "allow_eventbridge_teardown" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.environment_teardown.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.lifecycle_cleanup.arn
}

# Lambda permission for SNS to trigger emergency shutdown
resource "aws_lambda_permission" "allow_sns_emergency_shutdown" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.resource_shutdown.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.emergency_shutdown.arn
}

# SNS subscription to trigger Lambda on emergency shutdown
resource "aws_sns_topic_subscription" "emergency_shutdown_lambda" {
  topic_arn = aws_sns_topic.emergency_shutdown.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.resource_shutdown.arn
}

# IAM role for shutdown/startup Lambda functions
resource "aws_iam_role" "shutdown_lambda_role" {
  name = "demo-shutdown-lambda-role"

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

  tags = {
    Environment = var.environment
    Project     = "UserJourneyAnalytics"
  }
}

# IAM role for teardown Lambda function
resource "aws_iam_role" "teardown_lambda_role" {
  name = "demo-teardown-lambda-role"

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

  tags = {
    Environment = var.environment
    Project     = "UserJourneyAnalytics"
  }
}

# IAM policies for Lambda functions
resource "aws_iam_role_policy" "shutdown_lambda_policy" {
  name = "demo-shutdown-lambda-policy"
  role = aws_iam_role.shutdown_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2:StopInstances",
          "ec2:StartInstances",
          "ec2:DescribeTags"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:UpdateTable",
          "dynamodb:DescribeTable"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "kinesis:DescribeStream",
          "kinesis:UpdateShardCount"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "teardown_lambda_policy" {
  name = "demo-teardown-lambda-policy"
  role = aws_iam_role.teardown_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "*"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:RequestedRegion" = var.aws_region
          }
        }
      }
    ]
  })
}

# Archive files for Lambda functions
data "archive_file" "shutdown_lambda_zip" {
  type        = "zip"
  output_path = "resource_shutdown.zip"
  source {
    content = templatefile("${path.module}/lambda_functions/resource_shutdown.py", {
      environment_tag = var.environment
    })
    filename = "index.py"
  }
}

data "archive_file" "startup_lambda_zip" {
  type        = "zip"
  output_path = "resource_startup.zip"
  source {
    content = templatefile("${path.module}/lambda_functions/resource_startup.py", {
      environment_tag = var.environment
    })
    filename = "index.py"
  }
}

data "archive_file" "teardown_lambda_zip" {
  type        = "zip"
  output_path = "environment_teardown.zip"
  source {
    content = templatefile("${path.module}/lambda_functions/environment_teardown.py", {
      environment_tag = var.environment
    })
    filename = "index.py"
  }
}