# Outputs for IAM module

output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_execution_role.arn
}

output "lambda_execution_role_name" {
  description = "Name of the Lambda execution role"
  value       = aws_iam_role.lambda_execution_role.name
}

output "bedrock_agent_role_arn" {
  description = "ARN of the Bedrock Agent role"
  value       = aws_iam_role.bedrock_agent_role.arn
}

output "bedrock_agent_role_name" {
  description = "Name of the Bedrock Agent role"
  value       = aws_iam_role.bedrock_agent_role.name
}

output "sagemaker_execution_role_arn" {
  description = "ARN of the SageMaker execution role"
  value       = aws_iam_role.sagemaker_execution_role.arn
}

output "sagemaker_execution_role_name" {
  description = "Name of the SageMaker execution role"
  value       = aws_iam_role.sagemaker_execution_role.name
}

output "kinesis_analytics_role_arn" {
  description = "ARN of the Kinesis Analytics role"
  value       = aws_iam_role.kinesis_analytics_role.arn
}

output "kinesis_analytics_role_name" {
  description = "Name of the Kinesis Analytics role"
  value       = aws_iam_role.kinesis_analytics_role.name
}

output "api_gateway_cloudwatch_role_arn" {
  description = "ARN of the API Gateway CloudWatch role"
  value       = aws_iam_role.api_gateway_cloudwatch_role.arn
}

output "kinesis_to_dynamodb_role_arn" {
  description = "ARN of the Kinesis to DynamoDB data flow role"
  value       = aws_iam_role.kinesis_to_dynamodb_role.arn
}

output "kinesis_to_dynamodb_role_name" {
  description = "Name of the Kinesis to DynamoDB data flow role"
  value       = aws_iam_role.kinesis_to_dynamodb_role.name
}

output "application_service_role_arn" {
  description = "ARN of the application service role"
  value       = aws_iam_role.application_service_role.arn
}

output "application_service_role_name" {
  description = "Name of the application service role"
  value       = aws_iam_role.application_service_role.name
}

output "application_service_instance_profile_arn" {
  description = "ARN of the application service instance profile"
  value       = aws_iam_instance_profile.application_service_profile.arn
}

output "analytics_dashboard_role_arn" {
  description = "ARN of the analytics dashboard role"
  value       = aws_iam_role.analytics_dashboard_role.arn
}

output "analytics_dashboard_role_name" {
  description = "Name of the analytics dashboard role"
  value       = aws_iam_role.analytics_dashboard_role.name
}

output "analytics_dashboard_instance_profile_arn" {
  description = "ARN of the analytics dashboard instance profile"
  value       = aws_iam_instance_profile.analytics_dashboard_profile.arn
}