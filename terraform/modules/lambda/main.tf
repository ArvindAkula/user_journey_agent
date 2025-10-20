# Lambda Functions for User Journey Analytics Agent

# Event Processor Lambda Function - Optimized for performance
resource "aws_lambda_function" "event_processor" {
  filename         = data.archive_file.event_processor_zip.output_path
  function_name    = "${var.project_name}-event-processor-${var.environment}"
  role            = var.lambda_execution_role_arn
  handler         = "event_processor.lambda_handler"
  source_code_hash = data.archive_file.event_processor_zip.output_base64sha256
  runtime         = var.runtime
  timeout         = var.timeout
  memory_size     = var.optimized_memory_size
  
  # Performance optimizations
  reserved_concurrent_executions = var.reserved_concurrency
  
  # Enable provisioned concurrency for consistent performance
  dynamic "provisioned_concurrency_config" {
    for_each = var.enable_provisioned_concurrency ? [1] : []
    content {
      provisioned_concurrent_executions = var.provisioned_concurrency_count
    }
  }
  
  # Dead letter queue for error handling
  dead_letter_config {
    target_arn = var.dlq_arn
  }
  
  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = var.security_group_ids
  }
  
  tracing_config {
    mode = var.enable_x_ray_tracing ? "Active" : "PassThrough"
  }
  
  environment {
    variables = {
      ENVIRONMENT                    = var.environment
      USER_PROFILES_TABLE           = var.user_profiles_table_name
      USER_EVENTS_TABLE             = var.user_events_table_name
      STRUGGLE_SIGNALS_TABLE        = var.struggle_signals_table_name
      VIDEO_ENGAGEMENT_TABLE        = var.video_engagement_table_name
      TIMESTREAM_DATABASE           = var.timestream_database_name
      KINESIS_STREAM_NAME           = var.kinesis_stream_name
      BEDROCK_AGENT_ID              = var.bedrock_agent_id
      # Performance optimization environment variables
      DYNAMODB_CONNECTION_POOL_SIZE = "20"
      TIMESTREAM_CONNECTION_POOL_SIZE = "10"
      BEDROCK_CONNECTION_POOL_SIZE = "5"
      ENABLE_CACHING               = "true"
      CACHE_TTL_SECONDS           = "300"
    }
  }
  
  tags = var.tags
}

# Struggle Detector Lambda Function - Optimized
resource "aws_lambda_function" "struggle_detector" {
  filename         = data.archive_file.struggle_detector_zip.output_path
  function_name    = "${var.project_name}-struggle-detector-${var.environment}"
  role            = var.lambda_execution_role_arn
  handler         = "struggle_detector.lambda_handler"
  source_code_hash = data.archive_file.struggle_detector_zip.output_base64sha256
  runtime         = var.runtime
  timeout         = var.timeout
  memory_size     = var.optimized_memory_size
  
  # Performance optimizations
  reserved_concurrent_executions = var.reserved_concurrency
  
  # Dead letter queue for error handling
  dead_letter_config {
    target_arn = var.dlq_arn
  }
  
  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = var.security_group_ids
  }
  
  tracing_config {
    mode = var.enable_x_ray_tracing ? "Active" : "PassThrough"
  }
  
  environment {
    variables = {
      ENVIRONMENT                    = var.environment
      STRUGGLE_SIGNALS_TABLE        = var.struggle_signals_table_name
      USER_PROFILES_TABLE           = var.user_profiles_table_name
      TIMESTREAM_DATABASE           = var.timestream_database_name
      # Performance optimization environment variables
      DYNAMODB_CONNECTION_POOL_SIZE = "15"
      TIMESTREAM_CONNECTION_POOL_SIZE = "5"
      ENABLE_CACHING               = "true"
      CACHE_TTL_SECONDS           = "180"
    }
  }
  
  tags = var.tags
}

# Video Analyzer Lambda Function - Optimized
resource "aws_lambda_function" "video_analyzer" {
  filename         = data.archive_file.video_analyzer_zip.output_path
  function_name    = "${var.project_name}-video-analyzer-${var.environment}"
  role            = var.lambda_execution_role_arn
  handler         = "video_analyzer.lambda_handler"
  source_code_hash = data.archive_file.video_analyzer_zip.output_base64sha256
  runtime         = var.runtime
  timeout         = var.timeout
  memory_size     = var.optimized_memory_size
  
  # Performance optimizations
  reserved_concurrent_executions = var.reserved_concurrency
  
  # Dead letter queue for error handling
  dead_letter_config {
    target_arn = var.dlq_arn
  }
  
  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = var.security_group_ids
  }
  
  tracing_config {
    mode = var.enable_x_ray_tracing ? "Active" : "PassThrough"
  }
  
  environment {
    variables = {
      ENVIRONMENT                    = var.environment
      VIDEO_ENGAGEMENT_TABLE        = var.video_engagement_table_name
      USER_PROFILES_TABLE           = var.user_profiles_table_name
      TIMESTREAM_DATABASE           = var.timestream_database_name
      # Performance optimization environment variables
      DYNAMODB_CONNECTION_POOL_SIZE = "15"
      TIMESTREAM_CONNECTION_POOL_SIZE = "5"
      ENABLE_CACHING               = "true"
      CACHE_TTL_SECONDS           = "240"
    }
  }
  
  tags = var.tags
}

# Intervention Executor Lambda Function - Optimized
resource "aws_lambda_function" "intervention_executor" {
  filename         = data.archive_file.intervention_executor_zip.output_path
  function_name    = "${var.project_name}-intervention-executor-${var.environment}"
  role            = var.lambda_execution_role_arn
  handler         = "intervention_executor.lambda_handler"
  source_code_hash = data.archive_file.intervention_executor_zip.output_base64sha256
  runtime         = var.runtime
  timeout         = var.timeout
  memory_size     = var.optimized_memory_size
  
  # Performance optimizations
  reserved_concurrent_executions = var.reserved_concurrency
  
  # Dead letter queue for error handling
  dead_letter_config {
    target_arn = var.dlq_arn
  }
  
  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = var.security_group_ids
  }
  
  tracing_config {
    mode = var.enable_x_ray_tracing ? "Active" : "PassThrough"
  }
  
  environment {
    variables = {
      ENVIRONMENT                    = var.environment
      USER_PROFILES_TABLE           = var.user_profiles_table_name
      STRUGGLE_SIGNALS_TABLE        = var.struggle_signals_table_name
      SNS_TOPIC_ARN                 = var.sns_topic_arn
      # Performance optimization environment variables
      DYNAMODB_CONNECTION_POOL_SIZE = "10"
      SNS_CONNECTION_POOL_SIZE     = "5"
      ENABLE_CACHING               = "true"
      CACHE_TTL_SECONDS           = "120"
    }
  }
  
  tags = var.tags
}

# SQS Dead Letter Queue for Lambda error handling
resource "aws_sqs_queue" "lambda_dlq" {
  name                      = "${var.project_name}-lambda-dlq-${var.environment}"
  message_retention_seconds = 1209600  # 14 days
  
  tags = var.tags
}

# Kinesis Event Source Mapping for Event Processor - Optimized
resource "aws_lambda_event_source_mapping" "kinesis_event_source" {
  event_source_arn                   = var.kinesis_stream_arn
  function_name                      = aws_lambda_function.event_processor.arn
  starting_position                  = "LATEST"
  batch_size                         = var.batch_size
  maximum_batching_window_in_seconds = var.maximum_batching_window_in_seconds
  parallelization_factor             = var.parallelization_factor
  
  # Error handling configuration
  maximum_retry_attempts = 3
  maximum_record_age_in_seconds = 3600  # 1 hour
  bisect_batch_on_function_error = true
  
  # Destination configuration for failed records
  destination_config {
    on_failure {
      destination_arn = aws_sqs_queue.lambda_dlq.arn
    }
  }
  
  depends_on = [aws_lambda_function.event_processor]
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "event_processor_logs" {
  name              = "/aws/lambda/${aws_lambda_function.event_processor.function_name}"
  retention_in_days = 14
  
  tags = var.tags
}

resource "aws_cloudwatch_log_group" "struggle_detector_logs" {
  name              = "/aws/lambda/${aws_lambda_function.struggle_detector.function_name}"
  retention_in_days = 14
  
  tags = var.tags
}

resource "aws_cloudwatch_log_group" "video_analyzer_logs" {
  name              = "/aws/lambda/${aws_lambda_function.video_analyzer.function_name}"
  retention_in_days = 14
  
  tags = var.tags
}

resource "aws_cloudwatch_log_group" "intervention_executor_logs" {
  name              = "/aws/lambda/${aws_lambda_function.intervention_executor.function_name}"
  retention_in_days = 14
  
  tags = var.tags
}

# Lambda function source code archives
data "archive_file" "event_processor_zip" {
  type        = "zip"
  output_path = "${path.module}/event_processor.zip"
  source {
    content = templatefile("${path.module}/lambda_functions/event_processor.py", {
      environment = var.environment
    })
    filename = "event_processor.py"
  }
  source {
    content  = file("${path.module}/lambda_functions/requirements.txt")
    filename = "requirements.txt"
  }
}

data "archive_file" "struggle_detector_zip" {
  type        = "zip"
  output_path = "${path.module}/struggle_detector.zip"
  source {
    content = templatefile("${path.module}/lambda_functions/struggle_detector.py", {
      environment = var.environment
    })
    filename = "struggle_detector.py"
  }
  source {
    content  = file("${path.module}/lambda_functions/requirements.txt")
    filename = "requirements.txt"
  }
}

data "archive_file" "video_analyzer_zip" {
  type        = "zip"
  output_path = "${path.module}/video_analyzer.zip"
  source {
    content = templatefile("${path.module}/lambda_functions/video_analyzer.py", {
      environment = var.environment
    })
    filename = "video_analyzer.py"
  }
  source {
    content  = file("${path.module}/lambda_functions/requirements.txt")
    filename = "requirements.txt"
  }
}

data "archive_file" "intervention_executor_zip" {
  type        = "zip"
  output_path = "${path.module}/intervention_executor.zip"
  source {
    content = templatefile("${path.module}/lambda_functions/intervention_executor.py", {
      environment = var.environment
    })
    filename = "intervention_executor.py"
  }
  source {
    content  = file("${path.module}/lambda_functions/requirements.txt")
    filename = "requirements.txt"
  }
}