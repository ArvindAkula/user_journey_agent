# Staging backend configuration
bucket         = "user-journey-analytics-terraform-state-staging"
key            = "staging/terraform.tfstate"
region         = "us-east-1"
encrypt        = true
dynamodb_table = "user-journey-analytics-terraform-locks-staging"