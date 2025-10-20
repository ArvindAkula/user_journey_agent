# Outputs for Timestream module

output "database_name" {
  description = "Name of the Timestream database"
  value       = aws_timestreamwrite_database.user_journey_analytics.database_name
}

output "database_arn" {
  description = "ARN of the Timestream database"
  value       = aws_timestreamwrite_database.user_journey_analytics.arn
}

output "video_engagement_table_name" {
  description = "Name of the video engagement table"
  value       = aws_timestreamwrite_table.video_engagement.table_name
}

output "video_engagement_table_arn" {
  description = "ARN of the video engagement table"
  value       = aws_timestreamwrite_table.video_engagement.arn
}

output "user_metrics_table_name" {
  description = "Name of the user metrics table"
  value       = aws_timestreamwrite_table.user_metrics.table_name
}

output "user_metrics_table_arn" {
  description = "ARN of the user metrics table"
  value       = aws_timestreamwrite_table.user_metrics.arn
}

output "session_analytics_table_name" {
  description = "Name of the session analytics table"
  value       = aws_timestreamwrite_table.session_analytics.table_name
}

output "session_analytics_table_arn" {
  description = "ARN of the session analytics table"
  value       = aws_timestreamwrite_table.session_analytics.arn
}

output "struggle_signals_timeseries_table_name" {
  description = "Name of the struggle signals timeseries table"
  value       = aws_timestreamwrite_table.struggle_signals_timeseries.table_name
}

output "struggle_signals_timeseries_table_arn" {
  description = "ARN of the struggle signals timeseries table"
  value       = aws_timestreamwrite_table.struggle_signals_timeseries.arn
}

output "kms_key_arn" {
  description = "ARN of the KMS key for Timestream encryption"
  value       = aws_kms_key.timestream_key.arn
}