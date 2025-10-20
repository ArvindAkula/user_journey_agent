# Bedrock Agent IAM Configuration
# Note: Bedrock agents must be created manually via AWS Console as Terraform support is not yet available

# IAM Role for Bedrock Agent
resource "aws_iam_role" "bedrock_agent_role" {
  name = "user-journey-analytics-bedrock-agent-role"

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

  tags = {
    Name = "user-journey-analytics-bedrock-agent-role"
  }
}

# IAM Policy for Bedrock Agent
resource "aws_iam_role_policy" "bedrock_agent_policy" {
  name = "user-journey-analytics-bedrock-agent-policy"
  role = aws_iam_role.bedrock_agent_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = [
          "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-micro-v1:0",
          "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0",
          "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          "arn:aws:lambda:us-east-1:${data.aws_caller_identity.current.account_id}:function:user-journey-analytics-*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = [
          aws_sns_topic.alerts.arn,
          aws_sns_topic.user_interventions.arn,
          aws_sns_topic.performance_alerts.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.event_processing.arn,
          aws_sqs_queue.struggle_signal_processing.arn,
          aws_sqs_queue.video_analysis_processing.arn,
          aws_sqs_queue.intervention_execution.arn
        ]
      }
    ]
  })
}

# Bedrock Agent
resource "aws_bedrockagent_agent" "user_journey_agent" {
  agent_name              = "user-journey-analytics-agent"
  agent_resource_role_arn = aws_iam_role.bedrock_agent_role.arn
  foundation_model        = "amazon.nova-micro-v1:0"
  description             = "AI agent for user journey analytics and intervention management"
  
  instruction = <<-EOT
You are an AI agent specialized in analyzing user journey data and providing intelligent interventions to improve user experience and reduce churn.

Your primary responsibilities include:
1. Analyzing user behavior patterns and identifying struggle signals
2. Processing video engagement data to understand user interactions
3. Executing targeted interventions based on user context
4. Providing real-time recommendations to improve user experience

When analyzing user data:
- Look for patterns that indicate user frustration or confusion
- Identify drop-off points in the user journey
- Assess video engagement metrics for content effectiveness
- Consider user context and history when making recommendations

When executing interventions:
- Prioritize user experience and value delivery
- Use appropriate communication channels based on user preferences
- Ensure interventions are timely and contextually relevant
- Track intervention effectiveness for continuous improvement

Always maintain user privacy and follow data protection guidelines.
EOT

  tags = {
    Name = "user-journey-analytics-agent"
    Environment = "prod"
  }
}

# Bedrock Agent Alias
resource "aws_bedrockagent_agent_alias" "user_journey_agent_alias" {
  agent_alias_name = "production"
  agent_id         = aws_bedrockagent_agent.user_journey_agent.agent_id
  description      = "Production alias for user journey analytics agent"

  tags = {
    Name = "user-journey-analytics-agent-alias"
    Environment = "prod"
  }
}

# Output the Bedrock Agent information
output "bedrock_agent_info" {
  description = "Bedrock Agent information"
  value = {
    agent_id = aws_bedrockagent_agent.user_journey_agent.agent_id
    agent_arn = aws_bedrockagent_agent.user_journey_agent.agent_arn
    agent_alias_id = aws_bedrockagent_agent_alias.user_journey_agent_alias.agent_alias_id
    agent_name = aws_bedrockagent_agent.user_journey_agent.agent_name
  }
}

# Output the IAM role ARN for reference
output "bedrock_agent_role_arn" {
  description = "IAM Role ARN for Bedrock Agent"
  value = aws_iam_role.bedrock_agent_role.arn
}