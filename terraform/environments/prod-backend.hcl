# Production backend configuration
bucket         = "user-journey-analytics-terraform-state-prod"
key            = "prod/terraform.tfstate"
region         = "us-east-1"
encrypt        = true
dynamodb_table = "user-journey-analytics-terraform-locks"