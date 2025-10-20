#!/bin/bash

# Fix Terraform Deployment Script
# Handles common Terraform issues and deploys infrastructure properly

set -e

ENVIRONMENT=${1:-dev}
ACTION=${2:-plan}

echo "🔧 Fixing Terraform Deployment Issues"
echo "====================================="
echo "Environment: $ENVIRONMENT"
echo "Action: $ACTION"
echo ""

# Function to kill stuck terraform processes
cleanup_terraform_processes() {
    echo "🧹 Cleaning up stuck Terraform processes..."
    pkill -9 -f "terraform-provider" 2>/dev/null || true
    sleep 2
}

# Function to clean terraform cache
clean_terraform_cache() {
    echo "🗑️  Cleaning Terraform cache..."
    rm -rf .terraform/providers/*/
    rm -f .terraform.lock.hcl
}

# Function to force unlock terraform state
force_unlock_state() {
    echo "🔓 Checking for state locks..."
    
    # Try to get any existing lock ID
    LOCK_OUTPUT=$(../terraform-bin/terraform plan -var-file="environments/${ENVIRONMENT}.tfvars" 2>&1 || true)
    
    if echo "$LOCK_OUTPUT" | grep -q "Lock Info:"; then
        LOCK_ID=$(echo "$LOCK_OUTPUT" | grep "ID:" | awk '{print $2}')
        if [ ! -z "$LOCK_ID" ]; then
            echo "Found lock ID: $LOCK_ID"
            echo "Forcing unlock..."
            ../terraform-bin/terraform force-unlock -force "$LOCK_ID" || true
        fi
    fi
}

# Function to reinitialize terraform
reinitialize_terraform() {
    echo "🔄 Reinitializing Terraform..."
    
    # Set timeout for terraform commands
    export TF_PLUGIN_TIMEOUT=60s
    export TF_INPUT=false
    
    # Initialize with backend config file
    ../terraform-bin/terraform init \
        -backend-config="environments/${ENVIRONMENT}-backend.hcl" \
        -upgrade \
        -reconfigure || {
        echo "❌ Terraform init failed"
        return 1
    }
}

# Function to run terraform plan
run_terraform_plan() {
    echo "📋 Running Terraform plan..."
    
    # Set environment variables to prevent hanging
    export TF_PLUGIN_TIMEOUT=60s
    export TF_INPUT=false
    
    # Run plan (no timeout on macOS)
    ../terraform-bin/terraform plan \
        -var-file="environments/${ENVIRONMENT}.tfvars" \
        -out=tfplan \
        -detailed-exitcode || {
        echo "❌ Terraform plan failed"
        return 1
    }
}

# Function to run terraform apply
run_terraform_apply() {
    echo "🚀 Running Terraform apply..."
    
    # Set environment variables
    export TF_PLUGIN_TIMEOUT=60s
    export TF_INPUT=false
    
    # Check if plan file exists
    if [ ! -f "tfplan" ]; then
        echo "❌ No plan file found. Run plan first."
        return 1
    fi
    
    # Apply (no timeout on macOS)
    ../terraform-bin/terraform apply tfplan || {
        echo "❌ Terraform apply failed"
        return 1
    }
}

# Function to validate terraform configuration
validate_terraform() {
    echo "✅ Validating Terraform configuration..."
    
    ../terraform-bin/terraform validate || {
        echo "❌ Terraform configuration is invalid"
        return 1
    }
    
    echo "✅ Configuration is valid"
}

# Main execution
main() {
    cd "$(dirname "$0")"
    
    # Step 1: Cleanup
    cleanup_terraform_processes
    
    # Step 2: Force unlock if needed
    force_unlock_state
    
    # Step 3: Clean cache if needed
    if [ "$ACTION" = "clean" ] || [ "$ACTION" = "reset" ]; then
        clean_terraform_cache
    fi
    
    # Step 4: Reinitialize
    if ! reinitialize_terraform; then
        echo "❌ Failed to initialize Terraform"
        exit 1
    fi
    
    # Step 5: Validate
    if ! validate_terraform; then
        echo "❌ Terraform validation failed"
        exit 1
    fi
    
    # Step 6: Execute action
    case $ACTION in
        plan)
            if run_terraform_plan; then
                echo "✅ Terraform plan completed successfully"
                echo ""
                echo "📊 Plan Summary:"
                ../terraform-bin/terraform show -no-color tfplan | head -20
            else
                echo "❌ Terraform plan failed"
                exit 1
            fi
            ;;
        apply)
            if run_terraform_plan && run_terraform_apply; then
                echo "✅ Terraform apply completed successfully"
                echo ""
                echo "📊 Infrastructure Status:"
                ../terraform-bin/terraform output
            else
                echo "❌ Terraform apply failed"
                exit 1
            fi
            ;;
        destroy)
            echo "🗑️  Destroying infrastructure..."
            export TF_INPUT=false
            ../terraform-bin/terraform destroy \
                -var-file="environments/${ENVIRONMENT}.tfvars" \
                -auto-approve || {
                echo "❌ Terraform destroy failed"
                exit 1
            }
            echo "✅ Infrastructure destroyed successfully"
            ;;
        clean|reset)
            echo "✅ Terraform cache cleaned and reinitialized"
            ;;
        *)
            echo "❌ Unknown action: $ACTION"
            echo "Available actions: plan, apply, destroy, clean, reset"
            exit 1
            ;;
    esac
}

# Check if terraform binary exists
if [ ! -f "../terraform-bin/terraform" ]; then
    echo "❌ Terraform binary not found at ../terraform-bin/terraform"
    exit 1
fi

# Check if environment file exists
if [ ! -f "environments/${ENVIRONMENT}.tfvars" ]; then
    echo "❌ Environment file not found: environments/${ENVIRONMENT}.tfvars"
    exit 1
fi

# Run main function
main "$@"