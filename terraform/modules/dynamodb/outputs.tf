# Outputs for DynamoDB module

output "user_profiles_table_name" {
  description = "Name of the User Profiles table"
  value       = aws_dynamodb_table.user_profiles.name
}

output "user_profiles_table_arn" {
  description = "ARN of the User Profiles table"
  value       = aws_dynamodb_table.user_profiles.arn
}

output "user_events_table_name" {
  description = "Name of the User Events table"
  value       = aws_dynamodb_table.user_events.name
}

output "user_events_table_arn" {
  description = "ARN of the User Events table"
  value       = aws_dynamodb_table.user_events.arn
}

output "struggle_signals_table_name" {
  description = "Name of the Struggle Signals table"
  value       = aws_dynamodb_table.struggle_signals.name
}

output "struggle_signals_table_arn" {
  description = "ARN of the Struggle Signals table"
  value       = aws_dynamodb_table.struggle_signals.arn
}

output "video_engagement_table_name" {
  description = "Name of the Video Engagement table"
  value       = aws_dynamodb_table.video_engagement.name
}

output "video_engagement_table_arn" {
  description = "ARN of the Video Engagement table"
  value       = aws_dynamodb_table.video_engagement.arn
}