bucket = "user-journey-analytics-terraform-state"
key    = "env:/prod/prod/terraform.tfstate"
region = "us-east-1"
encrypt = true
dynamodb_table = "user-journey-analytics-terraform-locks"
