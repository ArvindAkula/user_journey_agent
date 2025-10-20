# Load Testing and Performance Benchmarking Configuration

# Load Testing Lambda Function
resource "aws_lambda_function" "load_tester" {
  filename         = data.archive_file.load_tester_zip.output_path
  function_name    = "${var.project_name}-load-tester-${var.environment}"
  role            = module.iam.lambda_execution_role_arn
  handler         = "load_tester.lambda_handler"
  source_code_hash = data.archive_file.load_tester_zip.output_base64sha256
  runtime         = "python3.11"
  timeout         = 900  # 15 minutes
  memory_size     = 1024
  
  environment {
    variables = {
      ENVIRONMENT                = var.environment
      PROJECT_NAME              = var.project_name
      KINESIS_STREAM_NAME       = module.kinesis.data_stream_name
      API_GATEWAY_URL           = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
      CLOUDFRONT_DOMAIN         = aws_cloudfront_distribution.frontend_assets.domain_name
      LOAD_TEST_DURATION_SECONDS = var.load_test_duration_seconds
      CONCURRENT_USERS          = var.load_test_concurrent_users
      REQUESTS_PER_SECOND       = var.load_test_requests_per_second
    }
  }
  
  tags = local.common_tags
}

data "archive_file" "load_tester_zip" {
  type        = "zip"
  output_path = "${path.root}/load_tester.zip"
  
  source {
    content = templatefile("${path.module}/lambda_functions/load_tester.py", {
      environment = var.environment
    })
    filename = "load_tester.py"
  }
  
  source {
    content = file("${path.module}/lambda_functions/requirements.txt")
    filename = "requirements.txt"
  }
}

# Performance Benchmarking Lambda Function
resource "aws_lambda_function" "performance_benchmark" {
  filename         = data.archive_file.performance_benchmark_zip.output_path
  function_name    = "${var.project_name}-performance-benchmark-${var.environment}"
  role            = module.iam.lambda_execution_role_arn
  handler         = "performance_benchmark.lambda_handler"
  source_code_hash = data.archive_file.performance_benchmark_zip.output_base64sha256
  runtime         = "python3.11"
  timeout         = 900
  memory_size     = 1024
  
  environment {
    variables = {
      ENVIRONMENT     = var.environment
      PROJECT_NAME    = var.project_name
      BENCHMARK_SUITE = "comprehensive"
    }
  }
  
  tags = local.common_tags
}

data "archive_file" "performance_benchmark_zip" {
  type        = "zip"
  output_path = "${path.root}/performance_benchmark.zip"
  
  source {
    content = templatefile("${path.module}/lambda_functions/performance_benchmark.py", {
      environment = var.environment
    })
    filename = "performance_benchmark.py"
  }
}

# Step Functions State Machine for Orchestrating Load Tests
resource "aws_sfn_state_machine" "load_test_orchestrator" {
  name     = "${var.project_name}-load-test-orchestrator-${var.environment}"
  role_arn = aws_iam_role.step_functions_role.arn

  definition = jsonencode({
    Comment = "Load Test Orchestrator for User Journey Analytics"
    StartAt = "PrepareLoadTest"
    States = {
      PrepareLoadTest = {
        Type = "Task"
        Resource = aws_lambda_function.load_tester.arn
        Parameters = {
          "action" = "prepare"
          "test_type" = "baseline"
        }
        Next = "RunBaselineTest"
        Retry = [
          {
            ErrorEquals = ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException"]
            IntervalSeconds = 2
            MaxAttempts = 3
            BackoffRate = 2.0
          }
        ]
      }
      
      RunBaselineTest = {
        Type = "Task"
        Resource = aws_lambda_function.load_tester.arn
        Parameters = {
          "action" = "execute"
          "test_type" = "baseline"
          "duration_seconds" = 300
          "concurrent_users" = 10
          "requests_per_second" = 50
        }
        Next = "AnalyzeBaselineResults"
      }
      
      AnalyzeBaselineResults = {
        Type = "Task"
        Resource = aws_lambda_function.performance_benchmark.arn
        Parameters = {
          "action" = "analyze"
          "test_type" = "baseline"
        }
        Next = "RunStressTest"
      }
      
      RunStressTest = {
        Type = "Task"
        Resource = aws_lambda_function.load_tester.arn
        Parameters = {
          "action" = "execute"
          "test_type" = "stress"
          "duration_seconds" = 600
          "concurrent_users" = 100
          "requests_per_second" = 500
        }
        Next = "AnalyzeStressResults"
      }
      
      AnalyzeStressResults = {
        Type = "Task"
        Resource = aws_lambda_function.performance_benchmark.arn
        Parameters = {
          "action" = "analyze"
          "test_type" = "stress"
        }
        Next = "RunSpikeTest"
      }
      
      RunSpikeTest = {
        Type = "Task"
        Resource = aws_lambda_function.load_tester.arn
        Parameters = {
          "action" = "execute"
          "test_type" = "spike"
          "duration_seconds" = 180
          "concurrent_users" = 500
          "requests_per_second" = 1000
        }
        Next = "GenerateReport"
      }
      
      GenerateReport = {
        Type = "Task"
        Resource = aws_lambda_function.performance_benchmark.arn
        Parameters = {
          "action" = "report"
          "test_types" = ["baseline", "stress", "spike"]
        }
        End = true
      }
    }
  })

  tags = local.common_tags
}

# IAM Role for Step Functions
resource "aws_iam_role" "step_functions_role" {
  name = "${var.project_name}-step-functions-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "step_functions_policy" {
  name = "${var.project_name}-step-functions-policy-${var.environment}"
  role = aws_iam_role.step_functions_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          aws_lambda_function.load_tester.arn,
          aws_lambda_function.performance_benchmark.arn
        ]
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

# CloudWatch Event Rule for Scheduled Load Testing
resource "aws_cloudwatch_event_rule" "scheduled_load_test" {
  count               = var.enable_scheduled_load_testing ? 1 : 0
  name                = "${var.project_name}-scheduled-load-test-${var.environment}"
  description         = "Trigger scheduled load testing"
  schedule_expression = var.load_test_schedule
  
  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "load_test_target" {
  count     = var.enable_scheduled_load_testing ? 1 : 0
  rule      = aws_cloudwatch_event_rule.scheduled_load_test[0].name
  target_id = "LoadTestTarget"
  arn       = aws_sfn_state_machine.load_test_orchestrator.arn
  role_arn  = aws_iam_role.step_functions_role.arn
}

# S3 Bucket for Load Test Results
resource "aws_s3_bucket" "load_test_results" {
  bucket = "${var.project_name}-load-test-results-${var.environment}-${random_string.bucket_suffix.result}"
  
  tags = local.common_tags
}

resource "aws_s3_bucket_versioning" "load_test_results" {
  bucket = aws_s3_bucket.load_test_results.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "load_test_results" {
  bucket = aws_s3_bucket.load_test_results.id

  rule {
    id     = "load_test_cleanup"
    status = "Enabled"

    expiration {
      days = var.is_demo_environment ? 7 : 30
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

# CloudWatch Dashboard for Load Testing Results
resource "aws_cloudwatch_dashboard" "load_testing_results" {
  dashboard_name = "${var.project_name}-load-testing-results-${var.environment}"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 2
        
        properties = {
          markdown = "# Load Testing Results Dashboard\n\nThis dashboard shows the results of automated load testing and performance benchmarks."
        }
      },
      
      {
        type   = "metric"
        x      = 0
        y      = 2
        width  = 8
        height = 6
        
        properties = {
          metrics = [
            ["UserJourneyAnalytics/LoadTesting", "ResponseTime"],
            [".", "Throughput"],
            [".", "ErrorRate"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Load Test Performance Metrics"
          period  = 300
        }
      },
      
      {
        type   = "metric"
        x      = 8
        y      = 2
        width  = 8
        height = 6
        
        properties = {
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", module.lambda.event_processor_function_name],
            [".", "ConcurrentExecutions", ".", "."],
            [".", "Errors", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Performance Under Load"
          period  = 300
        }
      },
      
      {
        type   = "metric"
        x      = 16
        y      = 2
        width  = 8
        height = 6
        
        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", module.dynamodb.user_profiles_table_name],
            [".", "ConsumedWriteCapacityUnits", ".", "."],
            [".", "ThrottledRequests", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "DynamoDB Performance Under Load"
          period  = 300
        }
      },
      
      {
        type   = "log"
        x      = 0
        y      = 8
        width  = 24
        height = 6
        
        properties = {
          query   = "SOURCE '/aws/lambda/${aws_lambda_function.load_tester.function_name}'\n| fields @timestamp, @message\n| filter @message like /LOAD_TEST_RESULT/\n| sort @timestamp desc\n| limit 50"
          region  = var.aws_region
          title   = "Recent Load Test Results"
          view    = "table"
        }
      }
    ]
  })
}

# Performance Benchmark Alarms
resource "aws_cloudwatch_metric_alarm" "load_test_high_response_time" {
  alarm_name          = "${var.project_name}-load-test-high-response-time-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ResponseTime"
  namespace           = "UserJourneyAnalytics/LoadTesting"
  period              = "300"
  statistic           = "Average"
  threshold           = "2000"  # 2 seconds
  alarm_description   = "Load test response time is too high"
  alarm_actions       = [aws_sns_topic.performance_alerts.arn]
  treat_missing_data  = "notBreaching"
  
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "load_test_high_error_rate" {
  alarm_name          = "${var.project_name}-load-test-high-error-rate-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ErrorRate"
  namespace           = "UserJourneyAnalytics/LoadTesting"
  period              = "300"
  statistic           = "Average"
  threshold           = "5"  # 5%
  alarm_description   = "Load test error rate is too high"
  alarm_actions       = [aws_sns_topic.performance_alerts.arn]
  treat_missing_data  = "notBreaching"
  
  tags = local.common_tags
}

# Lambda Permissions for Step Functions
resource "aws_lambda_permission" "allow_step_functions_load_tester" {
  statement_id  = "AllowExecutionFromStepFunctions"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.load_tester.function_name
  principal     = "states.amazonaws.com"
  source_arn    = aws_sfn_state_machine.load_test_orchestrator.arn
}

resource "aws_lambda_permission" "allow_step_functions_benchmark" {
  statement_id  = "AllowExecutionFromStepFunctions"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.performance_benchmark.function_name
  principal     = "states.amazonaws.com"
  source_arn    = aws_sfn_state_machine.load_test_orchestrator.arn
}