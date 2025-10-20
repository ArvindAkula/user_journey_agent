# Outputs for Monitoring module

output "application_log_group_name" {
  description = "Name of the application CloudWatch log group"
  value       = aws_cloudwatch_log_group.application_logs.name
}

output "application_log_group_arn" {
  description = "ARN of the application CloudWatch log group"
  value       = aws_cloudwatch_log_group.application_logs.arn
}

output "lambda_event_processor_log_group_name" {
  description = "Name of the Lambda event processor log group"
  value       = aws_cloudwatch_log_group.lambda_event_processor_logs.name
}

output "lambda_struggle_detector_log_group_name" {
  description = "Name of the Lambda struggle detector log group"
  value       = aws_cloudwatch_log_group.lambda_struggle_detector_logs.name
}

output "lambda_video_analyzer_log_group_name" {
  description = "Name of the Lambda video analyzer log group"
  value       = aws_cloudwatch_log_group.lambda_video_analyzer_logs.name
}

output "lambda_intervention_executor_log_group_name" {
  description = "Name of the Lambda intervention executor log group"
  value       = aws_cloudwatch_log_group.lambda_intervention_executor_logs.name
}

output "api_gateway_log_group_name" {
  description = "Name of the API Gateway log group"
  value       = aws_cloudwatch_log_group.api_gateway_logs.name
}

output "system_dashboard_name" {
  description = "Name of the system CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.system_dashboard.dashboard_name
}

output "business_dashboard_name" {
  description = "Name of the business CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.business_dashboard.dashboard_name
}

output "system_dashboard_url" {
  description = "URL of the system CloudWatch dashboard"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.system_dashboard.dashboard_name}"
}

output "business_dashboard_url" {
  description = "URL of the business CloudWatch dashboard"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.business_dashboard.dashboard_name}"
}

output "additional_sns_topic_arn" {
  description = "ARN of the additional SNS topic (if created)"
  value       = var.create_additional_sns_topic ? aws_sns_topic.additional_alerts[0].arn : null
}

output "system_health_alarm_name" {
  description = "Name of the system health composite alarm"
  value       = aws_cloudwatch_composite_alarm.system_health_alarm.alarm_name
}