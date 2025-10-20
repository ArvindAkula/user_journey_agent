# Development backend configuration
bucket         = "user-journey-analytics-terraform-state-dev"
key            = "dev/terraform.tfstate"
region         = "us-east-1"
encrypt        = true
dynamodb_table = "user-journey-analytics-terraform-locks-dev"