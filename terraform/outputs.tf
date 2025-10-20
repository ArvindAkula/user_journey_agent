# Outputs for User Journey Analytics Agent Infrastructure

# DynamoDB Outputs
output "dynamodb_user_profiles_table_name" {
  description = "Name of the User Profiles DynamoDB table"
  value       = module.dynamodb.user_profiles_table_name
}

output "dynamodb_user_events_table_name" {
  description = "Name of the User Events DynamoDB table"
  value       = module.dynamodb.user_events_table_name
}

output "dynamodb_struggle_signals_table_name" {
  description = "Name of the Struggle Signals DynamoDB table"
  value       = module.dynamodb.struggle_signals_table_name
}

output "dynamodb_video_engagement_table_name" {
  description = "Name of the Video Engagement DynamoDB table"
  value       = module.dynamodb.video_engagement_table_name
}

# Kinesis Outputs
output "kinesis_data_stream_name" {
  description = "Name of the Kinesis Data Stream"
  value       = module.kinesis.data_stream_name
}

output "kinesis_data_stream_arn" {
  description = "ARN of the Kinesis Data Stream"
  value       = module.kinesis.data_stream_arn
}

# S3 Outputs
output "s3_event_logs_bucket_name" {
  description = "Name of the S3 bucket for event logs"
  value       = module.s3.event_logs_bucket_name
}

output "s3_analytics_data_bucket_name" {
  description = "Name of the S3 bucket for analytics data"
  value       = module.s3.analytics_data_bucket_name
}

output "s3_lambda_artifacts_bucket_name" {
  description = "Name of the S3 bucket for Lambda artifacts"
  value       = module.s3.lambda_artifacts_bucket_name
}

output "s3_ml_models_bucket_name" {
  description = "Name of the S3 bucket for ML models"
  value       = module.s3.ml_models_bucket_name
}

# Timestream Outputs (conditional based on demo mode)
output "timestream_database_name" {
  description = "Name of the Timestream database"
  value       = var.is_demo_environment ? null : module.timestream[0].database_name
}

output "timestream_video_engagement_table_name" {
  description = "Name of the Timestream video engagement table"
  value       = var.is_demo_environment ? null : module.timestream[0].video_engagement_table_name
}

output "timestream_user_metrics_table_name" {
  description = "Name of the Timestream user metrics table"
  value       = var.is_demo_environment ? null : module.timestream[0].user_metrics_table_name
}

# IAM Outputs
output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = module.iam.lambda_execution_role_arn
}

output "bedrock_agent_role_arn" {
  description = "ARN of the Bedrock Agent role"
  value       = module.iam.bedrock_agent_role_arn
}

output "sagemaker_execution_role_arn" {
  description = "ARN of the SageMaker execution role"
  value       = module.iam.sagemaker_execution_role_arn
}

# Lambda Outputs
output "event_processor_function_name" {
  description = "Name of the event processor Lambda function"
  value       = module.lambda.event_processor_function_name
}

output "struggle_detector_function_name" {
  description = "Name of the struggle detector Lambda function"
  value       = module.lambda.struggle_detector_function_name
}

output "video_analyzer_function_name" {
  description = "Name of the video analyzer Lambda function"
  value       = module.lambda.video_analyzer_function_name
}

output "intervention_executor_function_name" {
  description = "Name of the intervention executor Lambda function"
  value       = module.lambda.intervention_executor_function_name
}

# Bedrock Outputs
output "bedrock_agent_role_arn_local" {
  description = "ARN of the Bedrock Agent role created locally"
  value       = aws_iam_role.bedrock_agent_role.arn
}

# SageMaker Outputs (conditional based on demo mode)
output "sagemaker_exit_risk_endpoint_name" {
  description = "Name of the SageMaker exit risk prediction endpoint"
  value       = var.is_demo_environment ? null : (length(aws_sagemaker_endpoint.exit_risk_predictor) > 0 ? aws_sagemaker_endpoint.exit_risk_predictor[0].name : null)
}

output "sagemaker_model_name" {
  description = "Name of the SageMaker exit risk model"
  value       = var.is_demo_environment ? null : (length(aws_sagemaker_model.exit_risk_predictor) > 0 ? aws_sagemaker_model.exit_risk_predictor[0].name : null)
}

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnet_ids
}

# SQS Outputs
output "sqs_event_processing_queue_name" {
  description = "Name of the SQS event processing queue"
  value       = module.sqs.event_processing_queue_name
}

output "sqs_event_processing_queue_arn" {
  description = "ARN of the SQS event processing queue"
  value       = module.sqs.event_processing_queue_arn
}

output "sqs_event_processing_dlq_name" {
  description = "Name of the SQS event processing dead letter queue"
  value       = module.sqs.event_processing_dlq_name
}

output "sqs_struggle_signal_processing_queue_name" {
  description = "Name of the SQS struggle signal processing queue"
  value       = module.sqs.struggle_signal_processing_queue_name
}

output "sqs_video_analysis_processing_queue_name" {
  description = "Name of the SQS video analysis processing queue"
  value       = module.sqs.video_analysis_processing_queue_name
}

output "sqs_intervention_execution_queue_name" {
  description = "Name of the SQS intervention execution queue"
  value       = module.sqs.intervention_execution_queue_name
}

# Monitoring Outputs
output "cloudwatch_system_dashboard_url" {
  description = "URL of the CloudWatch system dashboard"
  value       = module.monitoring.system_dashboard_url
}

output "cloudwatch_business_dashboard_url" {
  description = "URL of the CloudWatch business dashboard"
  value       = module.monitoring.business_dashboard_url
}

output "application_log_group_name" {
  description = "Name of the application CloudWatch log group"
  value       = module.monitoring.application_log_group_name
}

output "system_health_alarm_name" {
  description = "Name of the system health composite alarm"
  value       = module.monitoring.system_health_alarm_name
}

output "sns_alerts_topic_arn" {
  description = "ARN of the SNS alerts topic"
  value       = aws_sns_topic.alerts.arn
}

# AI/ML Services Outputs
output "ai_ml_services" {
  description = "AI/ML services information"
  value = {
    event_processor_function_name = try(aws_lambda_function.event_processor.function_name, null)
    struggle_detector_function_name = try(aws_lambda_function.struggle_detector.function_name, null)
    video_analyzer_function_name = try(aws_lambda_function.video_analyzer.function_name, null)
    intervention_executor_function_name = try(aws_lambda_function.intervention_executor.function_name, null)
    bedrock_agent_id = try(aws_bedrock_agent.user_journey_agent.agent_id, null)
    bedrock_agent_alias_id = try(aws_bedrock_agent_alias.user_journey_agent_alias.agent_alias_id, null)
    sagemaker_endpoint_name = try(aws_sagemaker_endpoint.exit_risk_predictor.name, null)
    sns_topic_arn = try(aws_sns_topic.user_interventions.arn, null)
  }
}

output "lambda_functions" {
  description = "Lambda function ARNs for AI/ML processing"
  value = {
    event_processor = try(aws_lambda_function.event_processor.arn, null)
    struggle_detector = try(aws_lambda_function.struggle_detector.arn, null)
    video_analyzer = try(aws_lambda_function.video_analyzer.arn, null)
    intervention_executor = try(aws_lambda_function.intervention_executor.arn, null)
  }
}

output "bedrock_agent" {
  description = "Bedrock Agent information"
  value = {
    agent_id = try(aws_bedrock_agent.user_journey_agent.agent_id, null)
    agent_arn = try(aws_bedrock_agent.user_journey_agent.agent_arn, null)
    agent_alias_id = try(aws_bedrock_agent_alias.user_journey_agent_alias.agent_alias_id, null)
  }
}

output "sagemaker_endpoint" {
  description = "SageMaker endpoint information"
  value = {
    endpoint_name = try(aws_sagemaker_endpoint.exit_risk_predictor.name, null)
    endpoint_arn = try(aws_sagemaker_endpoint.exit_risk_predictor.arn, null)
    model_name = try(aws_sagemaker_model.exit_risk_predictor.name, null)
  }
}