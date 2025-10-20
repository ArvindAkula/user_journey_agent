#!/bin/bash

# Script to rename Terraform state resources and clean up dev environment
# This script will:
# 1. Rename prod S3 bucket from user-journey-analytics-terraform-state-prod to user-journey-analytics-terraform-state
# 2. Rename prod DynamoDB table from user-journey-analytics-terraform-locks-prod to user-journey-analytics-terraform-locks
# 3. Delete dev S3 bucket user-journey-analytics-terraform-state-dev
# 4. Delete dev DynamoDB table user-journey-analytics-terraform-locks-dev

set -e

# Configuration
AWS_REGION="us-east-1"
PROJECT_NAME="user-journey-analytics"

# Current names
OLD_PROD_BUCKET="${PROJECT_NAME}-terraform-state-prod"
OLD_PROD_DYNAMODB="${PROJECT_NAME}-terraform-locks-prod"
DEV_BUCKET="${PROJECT_NAME}-terraform-state-dev"
DEV_DYNAMODB="${PROJECT_NAME}-terraform-locks-dev"

# New names (simplified)
NEW_PROD_BUCKET="${PROJECT_NAME}-terraform-state"
NEW_PROD_DYNAMODB="${PROJECT_NAME}-terraform-locks"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

# Function to check if AWS CLI is configured
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is not installed or not in PATH"
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS CLI is not configured or credentials are invalid"
        exit 1
    fi
    
    log "AWS CLI is configured and working"
}

# Function to check if resource exists
resource_exists() {
    local resource_type=$1
    local resource_name=$2
    
    case $resource_type in
        "s3")
            aws s3api head-bucket --bucket "$resource_name" 2>/dev/null
            ;;
        "dynamodb")
            aws dynamodb describe-table --table-name "$resource_name" --region "$AWS_REGION" 2>/dev/null >/dev/null
            ;;
    esac
}

# Function to backup S3 bucket contents
backup_s3_bucket() {
    local bucket_name=$1
    local backup_dir="./terraform-state-backup-$(date +%Y%m%d-%H%M%S)"
    
    log "Creating backup of S3 bucket: $bucket_name"
    mkdir -p "$backup_dir"
    
    if aws s3 sync "s3://$bucket_name" "$backup_dir/" --region "$AWS_REGION"; then
        log "Backup created successfully at: $backup_dir"
        echo "$backup_dir"
    else
        error "Failed to backup S3 bucket: $bucket_name"
        return 1
    fi
}

# Function to create new S3 bucket with same configuration
create_s3_bucket() {
    local old_bucket=$1
    local new_bucket=$2
    
    log "Creating new S3 bucket: $new_bucket"
    
    # Create the bucket
    if [ "$AWS_REGION" = "us-east-1" ]; then
        aws s3api create-bucket --bucket "$new_bucket" --region "$AWS_REGION"
    else
        aws s3api create-bucket --bucket "$new_bucket" --region "$AWS_REGION" \
            --create-bucket-configuration LocationConstraint="$AWS_REGION"
    fi
    
    # Copy bucket configuration from old bucket
    log "Copying bucket configuration..."
    
    # Enable versioning
    aws s3api put-bucket-versioning --bucket "$new_bucket" \
        --versioning-configuration Status=Enabled --region "$AWS_REGION"
    
    # Copy encryption settings
    if aws s3api get-bucket-encryption --bucket "$old_bucket" --region "$AWS_REGION" 2>/dev/null; then
        local encryption_config=$(aws s3api get-bucket-encryption --bucket "$old_bucket" --region "$AWS_REGION" --output json)
        echo "$encryption_config" | jq '.ServerSideEncryptionConfiguration' > /tmp/encryption.json
        aws s3api put-bucket-encryption --bucket "$new_bucket" --region "$AWS_REGION" \
            --server-side-encryption-configuration file:///tmp/encryption.json
        rm -f /tmp/encryption.json
    fi
    
    # Block public access
    aws s3api put-public-access-block --bucket "$new_bucket" --region "$AWS_REGION" \
        --public-access-block-configuration \
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
    
    log "New S3 bucket created and configured: $new_bucket"
}

# Function to copy S3 bucket contents
copy_s3_contents() {
    local source_bucket=$1
    local dest_bucket=$2
    
    log "Copying contents from $source_bucket to $dest_bucket"
    
    if aws s3 sync "s3://$source_bucket" "s3://$dest_bucket" --region "$AWS_REGION"; then
        log "Successfully copied S3 bucket contents"
    else
        error "Failed to copy S3 bucket contents"
        return 1
    fi
}

# Function to create new DynamoDB table
create_dynamodb_table() {
    local old_table=$1
    local new_table=$2
    
    log "Creating new DynamoDB table: $new_table"
    
    # Get the old table description
    local table_description=$(aws dynamodb describe-table --table-name "$old_table" --region "$AWS_REGION" --output json)
    
    # Extract key schema and attribute definitions
    local key_schema=$(echo "$table_description" | jq '.Table.KeySchema')
    local attribute_definitions=$(echo "$table_description" | jq '.Table.AttributeDefinitions')
    local billing_mode=$(echo "$table_description" | jq -r '.Table.BillingModeSummary.BillingMode // "PROVISIONED"')
    
    # Create the new table
    if [ "$billing_mode" = "PAY_PER_REQUEST" ]; then
        aws dynamodb create-table \
            --table-name "$new_table" \
            --key-schema "$key_schema" \
            --attribute-definitions "$attribute_definitions" \
            --billing-mode PAY_PER_REQUEST \
            --region "$AWS_REGION"
    else
        local read_capacity=$(echo "$table_description" | jq -r '.Table.ProvisionedThroughput.ReadCapacityUnits')
        local write_capacity=$(echo "$table_description" | jq -r '.Table.ProvisionedThroughput.WriteCapacityUnits')
        
        aws dynamodb create-table \
            --table-name "$new_table" \
            --key-schema "$key_schema" \
            --attribute-definitions "$attribute_definitions" \
            --provisioned-throughput ReadCapacityUnits="$read_capacity",WriteCapacityUnits="$write_capacity" \
            --region "$AWS_REGION"
    fi
    
    # Wait for table to be active
    log "Waiting for DynamoDB table to become active..."
    aws dynamodb wait table-exists --table-name "$new_table" --region "$AWS_REGION"
    
    log "New DynamoDB table created: $new_table"
}

# Function to copy DynamoDB table data
copy_dynamodb_data() {
    local source_table=$1
    local dest_table=$2
    
    log "Copying data from $source_table to $dest_table"
    
    # Export data from source table
    local export_file="/tmp/dynamodb_export_$(date +%s).json"
    aws dynamodb scan --table-name "$source_table" --region "$AWS_REGION" --output json > "$export_file"
    
    # Import data to destination table
    local items=$(jq -r '.Items[]' "$export_file")
    if [ -n "$items" ]; then
        echo "$items" | while IFS= read -r item; do
            aws dynamodb put-item --table-name "$dest_table" --item "$item" --region "$AWS_REGION"
        done
    fi
    
    rm -f "$export_file"
    log "Successfully copied DynamoDB table data"
}

# Function to delete S3 bucket
delete_s3_bucket() {
    local bucket_name=$1
    
    log "Deleting S3 bucket: $bucket_name"
    
    # Empty the bucket first
    aws s3 rm "s3://$bucket_name" --recursive --region "$AWS_REGION"
    
    # Delete all versions if versioning is enabled
    aws s3api delete-objects --bucket "$bucket_name" --region "$AWS_REGION" \
        --delete "$(aws s3api list-object-versions --bucket "$bucket_name" --region "$AWS_REGION" \
        --output json --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}')" 2>/dev/null || true
    
    # Delete delete markers
    aws s3api delete-objects --bucket "$bucket_name" --region "$AWS_REGION" \
        --delete "$(aws s3api list-object-versions --bucket "$bucket_name" --region "$AWS_REGION" \
        --output json --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}')" 2>/dev/null || true
    
    # Delete the bucket
    aws s3api delete-bucket --bucket "$bucket_name" --region "$AWS_REGION"
    
    log "Successfully deleted S3 bucket: $bucket_name"
}

# Function to delete DynamoDB table
delete_dynamodb_table() {
    local table_name=$1
    
    log "Deleting DynamoDB table: $table_name"
    
    aws dynamodb delete-table --table-name "$table_name" --region "$AWS_REGION"
    
    # Wait for table to be deleted
    log "Waiting for DynamoDB table to be deleted..."
    aws dynamodb wait table-not-exists --table-name "$table_name" --region "$AWS_REGION"
    
    log "Successfully deleted DynamoDB table: $table_name"
}

# Main execution
main() {
    log "Starting Terraform state resource renaming and cleanup..."
    
    # Check prerequisites
    check_aws_cli
    
    # Check if jq is available (needed for JSON processing)
    if ! command -v jq &> /dev/null; then
        error "jq is not installed. Please install jq to continue."
        exit 1
    fi
    
    # Confirm with user
    echo
    warn "This script will perform the following operations:"
    echo "  1. Rename S3 bucket: $OLD_PROD_BUCKET → $NEW_PROD_BUCKET"
    echo "  2. Rename DynamoDB table: $OLD_PROD_DYNAMODB → $NEW_PROD_DYNAMODB"
    echo "  3. Delete S3 bucket: $DEV_BUCKET"
    echo "  4. Delete DynamoDB table: $DEV_DYNAMODB"
    echo
    warn "This operation cannot be easily undone. Make sure you have backups!"
    echo
    read -p "Do you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log "Operation cancelled by user"
        exit 0
    fi
    
    # Step 1: Handle prod S3 bucket rename
    if resource_exists "s3" "$OLD_PROD_BUCKET"; then
        log "Found existing prod S3 bucket: $OLD_PROD_BUCKET"
        
        # Create backup
        backup_dir=$(backup_s3_bucket "$OLD_PROD_BUCKET")
        
        # Create new bucket
        create_s3_bucket "$OLD_PROD_BUCKET" "$NEW_PROD_BUCKET"
        
        # Copy contents
        copy_s3_contents "$OLD_PROD_BUCKET" "$NEW_PROD_BUCKET"
        
        # Verify copy was successful
        old_count=$(aws s3 ls "s3://$OLD_PROD_BUCKET" --recursive --region "$AWS_REGION" | wc -l)
        new_count=$(aws s3 ls "s3://$NEW_PROD_BUCKET" --recursive --region "$AWS_REGION" | wc -l)
        
        if [ "$old_count" -eq "$new_count" ]; then
            log "Verification successful: Both buckets have $old_count objects"
            
            # Delete old bucket
            delete_s3_bucket "$OLD_PROD_BUCKET"
        else
            error "Verification failed: Object counts don't match (old: $old_count, new: $new_count)"
            exit 1
        fi
    else
        warn "Prod S3 bucket $OLD_PROD_BUCKET not found, skipping rename"
    fi
    
    # Step 2: Handle prod DynamoDB table rename
    if resource_exists "dynamodb" "$OLD_PROD_DYNAMODB"; then
        log "Found existing prod DynamoDB table: $OLD_PROD_DYNAMODB"
        
        # Create new table
        create_dynamodb_table "$OLD_PROD_DYNAMODB" "$NEW_PROD_DYNAMODB"
        
        # Copy data
        copy_dynamodb_data "$OLD_PROD_DYNAMODB" "$NEW_PROD_DYNAMODB"
        
        # Delete old table
        delete_dynamodb_table "$OLD_PROD_DYNAMODB"
    else
        warn "Prod DynamoDB table $OLD_PROD_DYNAMODB not found, skipping rename"
    fi
    
    # Step 3: Delete dev S3 bucket
    if resource_exists "s3" "$DEV_BUCKET"; then
        log "Found dev S3 bucket: $DEV_BUCKET"
        
        # Create backup before deletion
        backup_dir=$(backup_s3_bucket "$DEV_BUCKET")
        
        # Delete bucket
        delete_s3_bucket "$DEV_BUCKET"
    else
        warn "Dev S3 bucket $DEV_BUCKET not found, skipping deletion"
    fi
    
    # Step 4: Delete dev DynamoDB table
    if resource_exists "dynamodb" "$DEV_DYNAMODB"; then
        log "Found dev DynamoDB table: $DEV_DYNAMODB"
        
        # Delete table
        delete_dynamodb_table "$DEV_DYNAMODB"
    else
        warn "Dev DynamoDB table $DEV_DYNAMODB not found, skipping deletion"
    fi
    
    log "✅ All operations completed successfully!"
    echo
    log "Next steps:"
    echo "  1. Update your Terraform backend configuration files to use the new names"
    echo "  2. Update any scripts or documentation that reference the old names"
    echo "  3. Test your Terraform operations to ensure everything works correctly"
    echo
    if [ -n "$backup_dir" ]; then
        log "Backups are available at: $backup_dir"
    fi
}

# Run main function
main "$@"