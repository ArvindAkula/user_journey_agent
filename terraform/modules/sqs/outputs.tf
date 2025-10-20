# Outputs for SQS module

output "event_processing_queue_name" {
  description = "Name of the event processing queue"
  value       = aws_sqs_queue.event_processing.name
}

output "event_processing_queue_arn" {
  description = "ARN of the event processing queue"
  value       = aws_sqs_queue.event_processing.arn
}

output "event_processing_queue_url" {
  description = "URL of the event processing queue"
  value       = aws_sqs_queue.event_processing.url
}

output "event_processing_dlq_name" {
  description = "Name of the event processing dead letter queue"
  value       = aws_sqs_queue.event_processing_dlq.name
}

output "event_processing_dlq_arn" {
  description = "ARN of the event processing dead letter queue"
  value       = aws_sqs_queue.event_processing_dlq.arn
}

output "event_processing_dlq_url" {
  description = "URL of the event processing dead letter queue"
  value       = aws_sqs_queue.event_processing_dlq.url
}

output "struggle_signal_processing_queue_name" {
  description = "Name of the struggle signal processing queue"
  value       = aws_sqs_queue.struggle_signal_processing.name
}

output "struggle_signal_processing_queue_arn" {
  description = "ARN of the struggle signal processing queue"
  value       = aws_sqs_queue.struggle_signal_processing.arn
}

output "struggle_signal_processing_queue_url" {
  description = "URL of the struggle signal processing queue"
  value       = aws_sqs_queue.struggle_signal_processing.url
}

output "struggle_signal_processing_dlq_name" {
  description = "Name of the struggle signal processing dead letter queue"
  value       = aws_sqs_queue.struggle_signal_processing_dlq.name
}

output "struggle_signal_processing_dlq_arn" {
  description = "ARN of the struggle signal processing dead letter queue"
  value       = aws_sqs_queue.struggle_signal_processing_dlq.arn
}

output "video_analysis_processing_queue_name" {
  description = "Name of the video analysis processing queue"
  value       = aws_sqs_queue.video_analysis_processing.name
}

output "video_analysis_processing_queue_arn" {
  description = "ARN of the video analysis processing queue"
  value       = aws_sqs_queue.video_analysis_processing.arn
}

output "video_analysis_processing_queue_url" {
  description = "URL of the video analysis processing queue"
  value       = aws_sqs_queue.video_analysis_processing.url
}

output "video_analysis_processing_dlq_name" {
  description = "Name of the video analysis processing dead letter queue"
  value       = aws_sqs_queue.video_analysis_processing_dlq.name
}

output "video_analysis_processing_dlq_arn" {
  description = "ARN of the video analysis processing dead letter queue"
  value       = aws_sqs_queue.video_analysis_processing_dlq.arn
}

output "intervention_execution_queue_name" {
  description = "Name of the intervention execution queue"
  value       = aws_sqs_queue.intervention_execution.name
}

output "intervention_execution_queue_arn" {
  description = "ARN of the intervention execution queue"
  value       = aws_sqs_queue.intervention_execution.arn
}

output "intervention_execution_queue_url" {
  description = "URL of the intervention execution queue"
  value       = aws_sqs_queue.intervention_execution.url
}

output "intervention_execution_dlq_name" {
  description = "Name of the intervention execution dead letter queue"
  value       = aws_sqs_queue.intervention_execution_dlq.name
}

output "intervention_execution_dlq_arn" {
  description = "ARN of the intervention execution dead letter queue"
  value       = aws_sqs_queue.intervention_execution_dlq.arn
}

output "sqs_kms_key_arn" {
  description = "ARN of the KMS key used for SQS encryption"
  value       = aws_kms_key.sqs_key.arn
}

output "sqs_kms_key_id" {
  description = "ID of the KMS key used for SQS encryption"
  value       = aws_kms_key.sqs_key.key_id
}