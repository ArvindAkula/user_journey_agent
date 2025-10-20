# Amazon SageMaker Configuration for ML Models

# S3 bucket for model artifacts
resource "aws_s3_bucket" "model_artifacts" {
  bucket = "${var.project_name}-model-artifacts-${var.environment}-${random_string.bucket_suffix.result}"

  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-model-artifacts-${var.environment}"
    Component = "ML"
  })
}

resource "aws_s3_bucket_versioning" "model_artifacts_versioning" {
  bucket = aws_s3_bucket.model_artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

# SageMaker Execution Role
resource "aws_iam_role" "sagemaker_execution_role" {
  name = "${var.project_name}-sagemaker-execution-role-${var.environment}"

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

  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-sagemaker-execution-role-${var.environment}"
    Component = "ML"
  })
}

# SageMaker Execution Role Policy
resource "aws_iam_role_policy_attachment" "sagemaker_execution_role_policy" {
  role       = aws_iam_role.sagemaker_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess"
}

# Additional policy for S3 access
resource "aws_iam_role_policy" "sagemaker_s3_policy" {
  name = "${var.project_name}-sagemaker-s3-policy-${var.environment}"
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
      }
    ]
  })
}

# SageMaker Model for Exit Risk Prediction
resource "aws_sagemaker_model" "exit_risk_predictor" {
  name               = "${var.project_name}-exit-risk-model-${var.environment}"
  execution_role_arn = aws_iam_role.sagemaker_execution_role.arn
  
  primary_container {
    # Using scikit-learn container for the exit risk prediction model
    image = "246618743249.dkr.ecr.${var.aws_region}.amazonaws.com/sagemaker-scikit-learn:0.23-1-cpu-py3"
    
    model_data_url = "s3://${aws_s3_bucket.model_artifacts.bucket}/exit-risk-predictor/model.tar.gz"
    
    environment = {
      SAGEMAKER_PROGRAM         = "inference.py"
      SAGEMAKER_SUBMIT_DIRECTORY = "/opt/ml/code"
    }
  }
  
  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-exit-risk-model-${var.environment}"
    Component = "ML"
  })

  depends_on = [aws_s3_object.model_package]
}

# SageMaker Endpoint Configuration
resource "aws_sagemaker_endpoint_configuration" "exit_risk_predictor" {
  name = "${var.project_name}-exit-risk-endpoint-config-${var.environment}"
  
  production_variants {
    variant_name           = "primary"
    model_name            = aws_sagemaker_model.exit_risk_predictor.name
    initial_instance_count = var.sagemaker_min_instance_count
    instance_type         = var.sagemaker_instance_type
    initial_variant_weight = 1
  }
  
  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-exit-risk-endpoint-config-${var.environment}"
    Component = "ML"
  })
}

# SageMaker Endpoint
resource "aws_sagemaker_endpoint" "exit_risk_predictor" {
  name                 = "${var.project_name}-exit-risk-endpoint-${var.environment}"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.exit_risk_predictor.name
  
  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-exit-risk-endpoint-${var.environment}"
    Component = "ML"
  })
}

# Placeholder for SageMaker Training Jobs (to be created via API/SDK)
# Note: Training and Processing jobs are typically created dynamically via API calls
# rather than managed through Terraform due to their ephemeral nature

# Upload model artifacts to S3
resource "aws_s3_object" "model_package" {
  bucket = aws_s3_bucket.model_artifacts.bucket
  key    = "exit-risk-predictor/model.tar.gz"
  source = "${path.module}/ml_models/exit_risk_predictor.tar.gz"
  etag   = filemd5("${path.module}/ml_models/exit_risk_predictor.tar.gz")

  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-model-package-${var.environment}"
    Component = "ML"
  })
}

# S3 objects for training scripts and model artifacts
resource "aws_s3_object" "training_script" {
  bucket = aws_s3_bucket.model_artifacts.bucket
  key    = "scripts/training/train_exit_risk_model.py"
  source = "${path.module}/scripts/train_exit_risk_model.py"
  etag   = filemd5("${path.module}/scripts/train_exit_risk_model.py")
  
  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-training-script-${var.environment}"
    Component = "ML"
  })
}

resource "aws_s3_object" "inference_script" {
  bucket = aws_s3_bucket.model_artifacts.bucket
  key    = "scripts/inference/inference.py"
  source = "${path.module}/scripts/inference.py"
  etag   = filemd5("${path.module}/scripts/inference.py")
  
  tags = merge(var.demo_resource_tags, {
    Name = "${var.project_name}-inference-script-${var.environment}"
    Component = "ML"
  })
}

# CloudWatch Log Group for SageMaker
resource "aws_cloudwatch_log_group" "sagemaker_logs" {
  name              = "/aws/sagemaker/${var.project_name}-${var.environment}"
  retention_in_days = 14
  
  tags = local.common_tags
}

# SageMaker Notebook Instance for Development (dev environment only)
resource "aws_sagemaker_notebook_instance" "ml_development" {
  count         = var.environment == "dev" ? 1 : 0
  name          = "${var.project_name}-ml-notebook-${var.environment}"
  role_arn      = module.iam.sagemaker_execution_role_arn
  instance_type = "ml.t3.medium"
  
  default_code_repository = "https://github.com/aws/amazon-sagemaker-examples.git"
  
  tags = local.common_tags
}