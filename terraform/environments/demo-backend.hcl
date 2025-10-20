# Demo backend configuration
bucket         = "user-journey-analytics-terraform-state-demo"
key            = "demo/terraform.tfstate"
region         = "us-east-1"
encrypt        = true
dynamodb_table = "user-journey-analytics-terraform-locks-demo"