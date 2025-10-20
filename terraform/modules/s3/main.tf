# S3 Buckets for User Journey Analytics Agent

# Provider for replica region (conditional)
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
      configuration_aliases = [aws.replica]
    }
  }
}

# S3 bucket for event logs
resource "aws_s3_bucket" "event_logs" {
  bucket = "${var.project_name}-event-logs-${var.environment}-${random_id.bucket_suffix.hex}"
  
  tags = var.tags
}

resource "aws_s3_bucket_versioning" "event_logs_versioning" {
  bucket = aws_s3_bucket.event_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "event_logs_encryption" {
  bucket = aws_s3_bucket.event_logs.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "event_logs_pab" {
  bucket = aws_s3_bucket.event_logs.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "event_logs_lifecycle" {
  bucket = aws_s3_bucket.event_logs.id
  
  rule {
    id     = "event_logs_lifecycle"
    status = "Enabled"
    
    filter {
      prefix = ""
    }
    
    transition {
      days          = var.lifecycle_transition_days
      storage_class = "STANDARD_IA"
    }
    
    transition {
      days          = var.lifecycle_transition_days * 2
      storage_class = "GLACIER"
    }
    
    expiration {
      days = var.lifecycle_expiration_days
    }
    
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# S3 bucket for analytics data
resource "aws_s3_bucket" "analytics_data" {
  bucket = "${var.project_name}-analytics-data-${var.environment}-${random_id.bucket_suffix.hex}"
  
  tags = var.tags
}

resource "aws_s3_bucket_versioning" "analytics_data_versioning" {
  bucket = aws_s3_bucket.analytics_data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "analytics_data_encryption" {
  bucket = aws_s3_bucket.analytics_data.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "analytics_data_pab" {
  bucket = aws_s3_bucket.analytics_data.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "analytics_data_lifecycle" {
  bucket = aws_s3_bucket.analytics_data.id
  
  rule {
    id     = "analytics_data_lifecycle"
    status = "Enabled"
    
    filter {
      prefix = ""
    }
    
    transition {
      days          = var.lifecycle_transition_days
      storage_class = "STANDARD_IA"
    }
    
    transition {
      days          = var.lifecycle_transition_days * 3
      storage_class = "GLACIER"
    }
    
    expiration {
      days = var.lifecycle_expiration_days * 2
    }
  }
}

# S3 bucket for Lambda artifacts
resource "aws_s3_bucket" "lambda_artifacts" {
  bucket = "${var.project_name}-lambda-artifacts-${var.environment}-${random_id.bucket_suffix.hex}"
  
  tags = var.tags
}

resource "aws_s3_bucket_versioning" "lambda_artifacts_versioning" {
  bucket = aws_s3_bucket.lambda_artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "lambda_artifacts_encryption" {
  bucket = aws_s3_bucket.lambda_artifacts.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "lambda_artifacts_pab" {
  bucket = aws_s3_bucket.lambda_artifacts.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket for Terraform state (backend)
resource "aws_s3_bucket" "terraform_state" {
  bucket = "${var.project_name}-terraform-state-${var.environment}-${random_id.bucket_suffix.hex}"
  
  tags = var.tags
}

resource "aws_s3_bucket_versioning" "terraform_state_versioning" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state_encryption" {
  bucket = aws_s3_bucket.terraform_state.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state_pab" {
  bucket = aws_s3_bucket.terraform_state.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket for ML models
resource "aws_s3_bucket" "ml_models" {
  bucket = "${var.project_name}-ml-models-${var.environment}-${random_id.bucket_suffix.hex}"
  
  tags = var.tags
}

resource "aws_s3_bucket_versioning" "ml_models_versioning" {
  bucket = aws_s3_bucket.ml_models.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "ml_models_encryption" {
  bucket = aws_s3_bucket.ml_models.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "ml_models_pab" {
  bucket = aws_s3_bucket.ml_models.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Random ID for unique bucket naming
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# S3 bucket policy for event logs
resource "aws_s3_bucket_policy" "event_logs_policy" {
  bucket = aws_s3_bucket.event_logs.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowKinesisFirehoseAccess"
        Effect = "Allow"
        Principal = {
          Service = "firehose.amazonaws.com"
        }
        Action = [
          "s3:AbortMultipartUpload",
          "s3:GetBucketLocation",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:ListBucketMultipartUploads",
          "s3:PutObject"
        ]
        Resource = [
          aws_s3_bucket.event_logs.arn,
          "${aws_s3_bucket.event_logs.arn}/*"
        ]
      },
      {
        Sid    = "AllowLambdaAccess"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.event_logs.arn}/*"
        ]
      },
      {
        Sid    = "DenyInsecureConnections"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.event_logs.arn,
          "${aws_s3_bucket.event_logs.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# Cross-region replication for critical data (production only)
resource "aws_s3_bucket_replication_configuration" "analytics_data_replication" {
  count  = var.enable_cross_region_replication ? 1 : 0
  role   = aws_iam_role.replication_role[0].arn
  bucket = aws_s3_bucket.analytics_data.id

  rule {
    id     = "ReplicateAnalyticsData"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.analytics_data_replica[0].arn
      storage_class = "STANDARD_IA"
      
      encryption_configuration {
        replica_kms_key_id = aws_kms_key.s3_replica_key[0].arn
      }
    }
  }

  depends_on = [aws_s3_bucket_versioning.analytics_data_versioning]
}

# Replica bucket for cross-region replication
resource "aws_s3_bucket" "analytics_data_replica" {
  count    = var.enable_cross_region_replication ? 1 : 0
  provider = aws.replica
  bucket   = "${var.project_name}-analytics-data-replica-${var.environment}-${random_id.bucket_suffix.hex}"
  
  tags = merge(var.tags, {
    Purpose = "CrossRegionReplica"
  })
}

resource "aws_s3_bucket_versioning" "analytics_data_replica_versioning" {
  count    = var.enable_cross_region_replication ? 1 : 0
  provider = aws.replica
  bucket   = aws_s3_bucket.analytics_data_replica[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

# IAM role for S3 replication
resource "aws_iam_role" "replication_role" {
  count = var.enable_cross_region_replication ? 1 : 0
  name  = "${var.project_name}-s3-replication-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_policy" "replication_policy" {
  count = var.enable_cross_region_replication ? 1 : 0
  name  = "${var.project_name}-s3-replication-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging"
        ]
        Resource = "${aws_s3_bucket.analytics_data.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.analytics_data.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags"
        ]
        Resource = "${aws_s3_bucket.analytics_data_replica[0].arn}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "replication_policy_attachment" {
  count      = var.enable_cross_region_replication ? 1 : 0
  role       = aws_iam_role.replication_role[0].name
  policy_arn = aws_iam_policy.replication_policy[0].arn
}

# KMS key for replica bucket encryption
resource "aws_kms_key" "s3_replica_key" {
  count                   = var.enable_cross_region_replication ? 1 : 0
  provider                = aws.replica
  description             = "KMS key for S3 replica bucket encryption"
  deletion_window_in_days = 7
  
  tags = var.tags
}

resource "aws_kms_alias" "s3_replica_key_alias" {
  count         = var.enable_cross_region_replication ? 1 : 0
  provider      = aws.replica
  name          = "alias/${var.project_name}-s3-replica-${var.environment}"
  target_key_id = aws_kms_key.s3_replica_key[0].key_id
}

# S3 bucket policy for analytics data with granular permissions
resource "aws_s3_bucket_policy" "analytics_data_policy" {
  bucket = aws_s3_bucket.analytics_data.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowApplicationServiceAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-application-service-${var.environment}"
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "${aws_s3_bucket.analytics_data.arn}/processed-data/*",
          "${aws_s3_bucket.analytics_data.arn}/raw-events/*"
        ]
      },
      {
        Sid    = "AllowAnalyticsDashboardReadAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-analytics-dashboard-${var.environment}"
        }
        Action = [
          "s3:GetObject"
        ]
        Resource = [
          "${aws_s3_bucket.analytics_data.arn}/processed-data/*"
        ]
      },
      {
        Sid    = "AllowLambdaProcessingAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-lambda-execution-${var.environment}"
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.analytics_data.arn}/*"
        ]
      },
      {
        Sid    = "DenyInsecureConnections"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.analytics_data.arn,
          "${aws_s3_bucket.analytics_data.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# S3 bucket policy for ML models with restricted access
resource "aws_s3_bucket_policy" "ml_models_policy" {
  bucket = aws_s3_bucket.ml_models.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSageMakerAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-sagemaker-execution-${var.environment}"
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.ml_models.arn,
          "${aws_s3_bucket.ml_models.arn}/*"
        ]
      },
      {
        Sid    = "AllowLambdaModelAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-lambda-execution-${var.environment}"
        }
        Action = [
          "s3:GetObject"
        ]
        Resource = [
          "${aws_s3_bucket.ml_models.arn}/*"
        ]
      },
      {
        Sid    = "DenyInsecureConnections"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.ml_models.arn,
          "${aws_s3_bucket.ml_models.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# Data sources
data "aws_caller_identity" "current" {}