# SageMaker Configuration for Exit Risk Prediction

# S3 bucket for model artifacts
resource "aws_s3_bucket" "model_artifacts" {
  bucket = "user-journey-analytics-model-artifacts"

  tags = {
    Name = "user-journey-analytics-model-artifacts"
    Environment = "prod"
    Component = "ML"
  }
}

resource "aws_s3_bucket_versioning" "model_artifacts_versioning" {
  bucket = aws_s3_bucket.model_artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "model_artifacts_encryption" {
  bucket = aws_s3_bucket.model_artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "model_artifacts_pab" {
  bucket = aws_s3_bucket.model_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# SageMaker Execution Role
resource "aws_iam_role" "sagemaker_execution_role" {
  name = "user-journey-analytics-sagemaker-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "sagemaker.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "user-journey-analytics-sagemaker-execution-role"
    Environment = "prod"
    Component = "ML"
  }
}

# SageMaker Execution Role Policy
resource "aws_iam_role_policy_attachment" "sagemaker_execution_role_policy" {
  role       = aws_iam_role.sagemaker_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess"
}

# Additional policy for S3 access
resource "aws_iam_role_policy" "sagemaker_s3_policy" {
  name = "user-journey-analytics-sagemaker-s3-policy"
  role = aws_iam_role.sagemaker_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.model_artifacts.arn,
          "${aws_s3_bucket.model_artifacts.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# Model package is uploaded manually via AWS CLI
# The model.tar.gz file is already uploaded to S3

# SageMaker Model for Exit Risk Prediction
resource "aws_sagemaker_model" "exit_risk_predictor" {
  name               = "user-journey-analytics-exit-risk-model"
  execution_role_arn = aws_iam_role.sagemaker_execution_role.arn
  
  primary_container {
    # Using scikit-learn container for our model
    image = "683313688378.dkr.ecr.us-east-1.amazonaws.com/sagemaker-scikit-learn:0.23-1-cpu-py3"
    
    model_data_url = "s3://${aws_s3_bucket.model_artifacts.bucket}/exit-risk-predictor/model.tar.gz"
    
    environment = {
      SAGEMAKER_PROGRAM         = "inference.py"
      SAGEMAKER_SUBMIT_DIRECTORY = "/opt/ml/code"
    }
  }
  
  tags = {
    Name = "user-journey-analytics-exit-risk-model"
    Environment = "prod"
    Component = "ML"
  }

  # Model package is uploaded manually
}

# SageMaker Endpoint Configuration
resource "aws_sagemaker_endpoint_configuration" "exit_risk_predictor" {
  name = "user-journey-analytics-exit-risk-endpoint-config"
  
  production_variants {
    variant_name           = "primary"
    model_name            = aws_sagemaker_model.exit_risk_predictor.name
    initial_instance_count = 1
    instance_type         = "ml.t2.medium"  # Cost-effective instance for demo
    initial_variant_weight = 1
  }
  
  tags = {
    Name = "user-journey-analytics-exit-risk-endpoint-config"
    Environment = "prod"
    Component = "ML"
  }
}

# SageMaker Endpoint
resource "aws_sagemaker_endpoint" "exit_risk_predictor" {
  name                 = "user-journey-analytics-exit-risk-endpoint"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.exit_risk_predictor.name
  
  tags = {
    Name = "user-journey-analytics-exit-risk-endpoint"
    Environment = "prod"
    Component = "ML"
  }
}

# CloudWatch Log Group for SageMaker
resource "aws_cloudwatch_log_group" "sagemaker_logs" {
  name              = "/aws/sagemaker/user-journey-analytics"
  retention_in_days = 14
  
  tags = {
    Name = "user-journey-analytics-sagemaker-logs"
    Environment = "prod"
  }
}

# Output SageMaker information
output "sagemaker_info" {
  description = "SageMaker endpoint information"
  value = {
    endpoint_name = aws_sagemaker_endpoint.exit_risk_predictor.name
    endpoint_arn = aws_sagemaker_endpoint.exit_risk_predictor.arn
    model_name = aws_sagemaker_model.exit_risk_predictor.name
    model_artifacts_bucket = aws_s3_bucket.model_artifacts.bucket
  }
}