# Outputs for Kinesis module

output "data_stream_name" {
  description = "Name of the Kinesis Data Stream"
  value       = aws_kinesis_stream.user_events.name
}

output "data_stream_arn" {
  description = "ARN of the Kinesis Data Stream"
  value       = aws_kinesis_stream.user_events.arn
}

# Commented out for demo - requires Flink application JAR
# output "analytics_application_name" {
#   description = "Name of the Kinesis Analytics application"
#   value       = aws_kinesisanalyticsv2_application.user_journey_analytics.name
# }

# output "analytics_application_arn" {
#   description = "ARN of the Kinesis Analytics application"
#   value       = aws_kinesisanalyticsv2_application.user_journey_analytics.arn
# }

output "kms_key_arn" {
  description = "ARN of the KMS key for Kinesis encryption"
  value       = aws_kms_key.kinesis_key.arn
}