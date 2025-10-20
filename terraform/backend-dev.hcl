bucket = "user-journey-analytics-terraform-state-dev"
key    = "env:/dev/dev/terraform.tfstate"
region = "us-east-1"
encrypt = true
dynamodb_table = "terraform-state-lock"