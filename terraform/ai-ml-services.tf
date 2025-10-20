# AI/ML Services Infrastructure
# This file contains the configuration for Bedrock Agent, SageMaker, and Lambda functions

# Data sources for existing resources (now production-ready without -dev suffix)
data "aws_dynamodb_table" "user_profiles" {
  name = "user-journey-analytics-user-profiles"
}

data "aws_dynamodb_table" "user_events" {
  name = "user-journey-analytics-user-events"
}

data "aws_dynamodb_table" "struggle_signals" {
  name = "user-journey-analytics-struggle-signals"
}

data "aws_dynamodb_table" "video_engagement" {
  name = "user-journey-analytics-video-engagement"
}

data "aws_kinesis_stream" "user_events" {
  name = "user-journey-analytics-user-events"
}

data "aws_s3_bucket" "analytics_data" {
  bucket = "user-journey-analytics-analytics-data-dev-9bf2a9c5"
}

# SNS Topic for interventions and notifications
resource "aws_sns_topic" "user_interventions" {
  name = "${var.project_name}-user-interventions"
  
  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-user-interventions-${var.environment}"
    Component = "AI-ML"
  })
}

# SNS Topic Policy
resource "aws_sns_topic_policy" "user_interventions_policy" {
  arn = aws_sns_topic.user_interventions.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sns:Publish"
        Resource = aws_sns_topic.user_interventions.arn
      }
    ]
  })
}

# IAM Role for Lambda functions
resource "aws_iam_role" "ai_lambda_role" {
  name = "${var.project_name}-ai-lambda-role-${var.environment}"

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

  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-ai-lambda-role-${var.environment}"
    Component = "AI-ML"
  })
}

# IAM Policy for Lambda functions
resource "aws_iam_role_policy" "ai_lambda_policy" {
  name = "${var.project_name}-ai-lambda-policy-${var.environment}"
  role = aws_iam_role.ai_lambda_role.id

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
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          data.aws_dynamodb_table.user_profiles.arn,
          data.aws_dynamodb_table.user_events.arn,
          data.aws_dynamodb_table.struggle_signals.arn,
          data.aws_dynamodb_table.video_engagement.arn,
          "${data.aws_dynamodb_table.user_profiles.arn}/index/*",
          "${data.aws_dynamodb_table.user_events.arn}/index/*",
          "${data.aws_dynamodb_table.struggle_signals.arn}/index/*",
          "${data.aws_dynamodb_table.video_engagement.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kinesis:GetRecords",
          "kinesis:GetShardIterator",
          "kinesis:DescribeStream",
          "kinesis:ListStreams"
        ]
        Resource = data.aws_kinesis_stream.user_events.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${data.aws_s3_bucket.analytics_data.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.user_interventions.arn
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeAgent",
          "bedrock:InvokeModel"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sagemaker:InvokeEndpoint"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = "*"
      }
    ]
  })
}

# Event Processor Lambda Function
resource "aws_lambda_function" "event_processor" {
  filename         = data.archive_file.event_processor_zip.output_path
  function_name    = "${var.project_name}-event-processor-${var.environment}"
  role            = aws_iam_role.ai_lambda_role.arn
  handler         = "event_processor.lambda_handler"
  runtime         = var.lambda_runtime
  timeout         = var.lambda_timeout
  memory_size     = var.lambda_memory_size

  environment {
    variables = {
      USER_PROFILES_TABLE = data.aws_dynamodb_table.user_profiles.name
      USER_EVENTS_TABLE = data.aws_dynamodb_table.user_events.name
      STRUGGLE_SIGNALS_TABLE = data.aws_dynamodb_table.struggle_signals.name
      VIDEO_ENGAGEMENT_TABLE = data.aws_dynamodb_table.video_engagement.name
      BEDROCK_AGENT_ID = aws_bedrock_agent.user_journey_agent.agent_id
      BEDROCK_AGENT_ALIAS_ID = aws_bedrock_agent_alias.user_journey_agent_alias.agent_alias_id
      SAGEMAKER_ENDPOINT = aws_sagemaker_endpoint.exit_risk_predictor.name
      SNS_TOPIC_ARN = aws_sns_topic.user_interventions.arn
    }
  }

  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-event-processor-${var.environment}"
    Component = "AI-ML"
  })

  depends_on = [aws_cloudwatch_log_group.event_processor_logs]
}

# Struggle Detector Lambda Function
resource "aws_lambda_function" "struggle_detector" {
  filename         = data.archive_file.struggle_detector_zip.output_path
  function_name    = "${var.project_name}-struggle-detector-${var.environment}"
  role            = aws_iam_role.ai_lambda_role.arn
  handler         = "struggle_detector.lambda_handler"
  runtime         = var.lambda_runtime
  timeout         = var.lambda_timeout
  memory_size     = var.lambda_memory_size

  environment {
    variables = {
      USER_PROFILES_TABLE = data.aws_dynamodb_table.user_profiles.name
      USER_EVENTS_TABLE = data.aws_dynamodb_table.user_events.name
      STRUGGLE_SIGNALS_TABLE = data.aws_dynamodb_table.struggle_signals.name
      SAGEMAKER_ENDPOINT = aws_sagemaker_endpoint.exit_risk_predictor.name
      SNS_TOPIC_ARN = aws_sns_topic.user_interventions.arn
    }
  }

  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-struggle-detector-${var.environment}"
    Component = "AI-ML"
  })

  depends_on = [aws_cloudwatch_log_group.struggle_detector_logs]
}

# Video Analyzer Lambda Function
resource "aws_lambda_function" "video_analyzer" {
  filename         = data.archive_file.video_analyzer_zip.output_path
  function_name    = "${var.project_name}-video-analyzer-${var.environment}"
  role            = aws_iam_role.ai_lambda_role.arn
  handler         = "video_analyzer.lambda_handler"
  runtime         = var.lambda_runtime
  timeout         = var.lambda_timeout
  memory_size     = var.lambda_memory_size

  environment {
    variables = {
      VIDEO_ENGAGEMENT_TABLE = data.aws_dynamodb_table.video_engagement.name
      USER_PROFILES_TABLE = data.aws_dynamodb_table.user_profiles.name
      S3_BUCKET = data.aws_s3_bucket.analytics_data.bucket
    }
  }

  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-video-analyzer-${var.environment}"
    Component = "AI-ML"
  })

  depends_on = [aws_cloudwatch_log_group.video_analyzer_logs]
}

# Intervention Executor Lambda Function
resource "aws_lambda_function" "intervention_executor" {
  filename         = data.archive_file.intervention_executor_zip.output_path
  function_name    = "${var.project_name}-intervention-executor-${var.environment}"
  role            = aws_iam_role.ai_lambda_role.arn
  handler         = "intervention_executor.lambda_handler"
  runtime         = var.lambda_runtime
  timeout         = var.lambda_timeout
  memory_size     = var.lambda_memory_size

  environment {
    variables = {
      USER_PROFILES_TABLE = data.aws_dynamodb_table.user_profiles.name
      STRUGGLE_SIGNALS_TABLE = data.aws_dynamodb_table.struggle_signals.name
      SNS_TOPIC_ARN = aws_sns_topic.user_interventions.arn
      SUPPORT_EMAIL = "support@example.com"
      FROM_EMAIL = "noreply@example.com"
    }
  }

  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-intervention-executor-${var.environment}"
    Component = "AI-ML"
  })

  depends_on = [aws_cloudwatch_log_group.intervention_executor_logs]
}

# Archive files for Lambda functions
data "archive_file" "event_processor_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda_functions/event_processor.py"
  output_path = "${path.module}/event_processor.zip"
}

data "archive_file" "struggle_detector_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda_functions/struggle_detector.py"
  output_path = "${path.module}/struggle_detector.zip"
}

data "archive_file" "video_analyzer_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda_functions/video_analyzer.py"
  output_path = "${path.module}/video_analyzer.zip"
}

data "archive_file" "intervention_executor_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda_functions/intervention_executor.py"
  output_path = "${path.module}/intervention_executor.zip"
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "event_processor_logs" {
  name              = "/aws/lambda/${var.project_name}-event-processor-${var.environment}"
  retention_in_days = var.cloudwatch_log_retention_days

  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-event-processor-logs-${var.environment}"
    Component = "AI-ML"
  })
}

resource "aws_cloudwatch_log_group" "struggle_detector_logs" {
  name              = "/aws/lambda/${var.project_name}-struggle-detector-${var.environment}"
  retention_in_days = var.cloudwatch_log_retention_days

  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-struggle-detector-logs-${var.environment}"
    Component = "AI-ML"
  })
}

resource "aws_cloudwatch_log_group" "video_analyzer_logs" {
  name              = "/aws/lambda/${var.project_name}-video-analyzer-${var.environment}"
  retention_in_days = var.cloudwatch_log_retention_days

  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-video-analyzer-logs-${var.environment}"
    Component = "AI-ML"
  })
}

resource "aws_cloudwatch_log_group" "intervention_executor_logs" {
  name              = "/aws/lambda/${var.project_name}-intervention-executor-${var.environment}"
  retention_in_days = var.cloudwatch_log_retention_days

  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-intervention-executor-logs-${var.environment}"
    Component = "AI-ML"
  })
}

# Kinesis Event Source Mapping for Event Processor
resource "aws_lambda_event_source_mapping" "kinesis_event_processor" {
  event_source_arn  = data.aws_kinesis_stream.user_events.arn
  function_name     = aws_lambda_function.event_processor.arn
  starting_position = "LATEST"
  batch_size        = 10
  maximum_batching_window_in_seconds = 5

  depends_on = [aws_lambda_function.event_processor]
}

# Bedrock Agent IAM Role
resource "aws_iam_role" "bedrock_agent_role" {
  name = "${var.project_name}-bedrock-agent-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "bedrock.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-bedrock-agent-role-${var.environment}"
    Component = "AI-ML"
  })
}

# Bedrock Agent Policy
resource "aws_iam_role_policy" "bedrock_agent_policy" {
  name = "${var.project_name}-bedrock-agent-policy-${var.environment}"
  role = aws_iam_role.bedrock_agent_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          aws_lambda_function.struggle_detector.arn,
          aws_lambda_function.video_analyzer.arn,
          aws_lambda_function.intervention_executor.arn
        ]
      }
    ]
  })
}

# Bedrock Agent
resource "aws_bedrock_agent" "user_journey_agent" {
  agent_name              = "${var.project_name}-user-journey-agent-${var.environment}"
  agent_resource_role_arn = aws_iam_role.bedrock_agent_role.arn
  foundation_model        = "anthropic.claude-3-sonnet-20240229-v1:0"
  
  instruction = <<-EOT
    You are an AI agent specialized in analyzing user journey data and orchestrating interventions to improve user experience.
    
    Your primary responsibilities:
    1. Analyze user behavior patterns to detect struggles and friction points
    2. Evaluate video engagement data to understand content effectiveness
    3. Orchestrate appropriate interventions based on risk levels and user context
    4. Provide insights and recommendations for user experience optimization
    
    When analyzing user data:
    - Consider multiple behavioral signals and patterns
    - Evaluate the severity and urgency of user struggles
    - Recommend personalized interventions based on user profile and context
    - Prioritize user success and satisfaction
    
    Always provide clear, actionable recommendations and maintain user privacy and data security.
  EOT

  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-user-journey-agent-${var.environment}"
    Component = "AI-ML"
  })
}

# Bedrock Agent Action Groups
resource "aws_bedrock_agent_action_group" "struggle_detection" {
  action_group_name = "struggle-detection"
  agent_id          = aws_bedrock_agent.user_journey_agent.agent_id
  agent_version     = "DRAFT"
  
  action_group_executor {
    lambda = aws_lambda_function.struggle_detector.arn
  }
  
  api_schema {
    payload = jsonencode({
      openapi = "3.0.0"
      info = {
        title = "Struggle Detection API"
        version = "1.0.0"
      }
      paths = {
        "/analyze-struggle" = {
          post = {
            description = "Analyze user behavior for struggle detection"
            parameters = [
              {
                name = "userId"
                in = "query"
                required = true
                schema = {
                  type = "string"
                }
              }
            ]
            requestBody = {
              content = {
                "application/json" = {
                  schema = {
                    type = "object"
                    properties = {
                      userId = { type = "string" }
                      currentEvent = { type = "object" }
                      analysisType = { type = "string" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })
  }
}

resource "aws_bedrock_agent_action_group" "video_intelligence" {
  action_group_name = "video-intelligence"
  agent_id          = aws_bedrock_agent.user_journey_agent.agent_id
  agent_version     = "DRAFT"
  
  action_group_executor {
    lambda = aws_lambda_function.video_analyzer.arn
  }
  
  api_schema {
    payload = jsonencode({
      openapi = "3.0.0"
      info = {
        title = "Video Intelligence API"
        version = "1.0.0"
      }
      paths = {
        "/analyze-video" = {
          post = {
            description = "Analyze video engagement patterns"
            parameters = [
              {
                name = "userId"
                in = "query"
                required = true
                schema = {
                  type = "string"
                }
              }
            ]
            requestBody = {
              content = {
                "application/json" = {
                  schema = {
                    type = "object"
                    properties = {
                      userId = { type = "string" }
                      videoId = { type = "string" }
                      eventData = { type = "object" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })
  }
}

resource "aws_bedrock_agent_action_group" "intervention_engine" {
  action_group_name = "intervention-engine"
  agent_id          = aws_bedrock_agent.user_journey_agent.agent_id
  agent_version     = "DRAFT"
  
  action_group_executor {
    lambda = aws_lambda_function.intervention_executor.arn
  }
  
  api_schema {
    payload = jsonencode({
      openapi = "3.0.0"
      info = {
        title = "Intervention Engine API"
        version = "1.0.0"
      }
      paths = {
        "/execute-intervention" = {
          post = {
            description = "Execute user intervention"
            parameters = [
              {
                name = "userId"
                in = "query"
                required = true
                schema = {
                  type = "string"
                }
              }
            ]
            requestBody = {
              content = {
                "application/json" = {
                  schema = {
                    type = "object"
                    properties = {
                      userId = { type = "string" }
                      interventionType = { type = "string" }
                      riskLevel = { type = "string" }
                      context = { type = "object" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })
  }
}

# Bedrock Agent Alias
resource "aws_bedrock_agent_alias" "user_journey_agent_alias" {
  agent_alias_name = "production"
  agent_id         = aws_bedrock_agent.user_journey_agent.agent_id
  description      = "Production alias for user journey agent"

  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-agent-alias-${var.environment}"
    Component = "AI-ML"
  })
}

# Lambda permissions for Bedrock Agent
resource "aws_lambda_permission" "bedrock_invoke_struggle_detector" {
  statement_id  = "AllowBedrockInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.struggle_detector.function_name
  principal     = "bedrock.amazonaws.com"
  source_arn    = aws_bedrock_agent.user_journey_agent.agent_arn
}

resource "aws_lambda_permission" "bedrock_invoke_video_analyzer" {
  statement_id  = "AllowBedrockInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.video_analyzer.function_name
  principal     = "bedrock.amazonaws.com"
  source_arn    = aws_bedrock_agent.user_journey_agent.agent_arn
}

resource "aws_lambda_permission" "bedrock_invoke_intervention_executor" {
  statement_id  = "AllowBedrockInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.intervention_executor.function_name
  principal     = "bedrock.amazonaws.com"
  source_arn    = aws_bedrock_agent.user_journey_agent.agent_arn
}