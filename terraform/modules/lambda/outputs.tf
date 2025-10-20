# Outputs for Lambda module

output "event_processor_function_name" {
  description = "Name of the event processor Lambda function"
  value       = aws_lambda_function.event_processor.function_name
}

output "event_processor_function_arn" {
  description = "ARN of the event processor Lambda function"
  value       = aws_lambda_function.event_processor.arn
}

output "struggle_detector_function_name" {
  description = "Name of the struggle detector Lambda function"
  value       = aws_lambda_function.struggle_detector.function_name
}

output "struggle_detector_function_arn" {
  description = "ARN of the struggle detector Lambda function"
  value       = aws_lambda_function.struggle_detector.arn
}

output "video_analyzer_function_name" {
  description = "Name of the video analyzer Lambda function"
  value       = aws_lambda_function.video_analyzer.function_name
}

output "video_analyzer_function_arn" {
  description = "ARN of the video analyzer Lambda function"
  value       = aws_lambda_function.video_analyzer.arn
}

output "intervention_executor_function_name" {
  description = "Name of the intervention executor Lambda function"
  value       = aws_lambda_function.intervention_executor.function_name
}

output "intervention_executor_function_arn" {
  description = "ARN of the intervention executor Lambda function"
  value       = aws_lambda_function.intervention_executor.arn
}