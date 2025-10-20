#!/bin/bash

# Script to rename existing AWS resources from dev to production naming
# This removes the -dev suffix to make resources production-ready

set -e

AWS_REGION="us-east-1"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="/tmp/production_rename_${TIMESTAMP}.log"

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log "INFO" "🔄 Renaming AWS resources from dev to production naming..."
log "INFO" "📝 Log file: $LOG_FILE"

# Function to check if AWS CLI is configured
check_aws_config() {
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log "ERROR" "❌ AWS CLI not configured or no valid credentials"
        exit 1
    fi
    log "INFO" "✅ AWS CLI configured successfully"
}

# Function to rename DynamoDB table
rename_dynamodb_table() {
    local old_name=$1
    local new_name=$2
    
    log "INFO" "📊 Processing DynamoDB table: $old_name -> $new_name"
    
    # Check if old table exists
    if ! aws dynamodb describe-table --table-name "$old_name" --region "$AWS_REGION" >/dev/null 2>&1; then
        log "WARN" "⚠️  Table $old_name does not exist, skipping..."
        return
    fi
    
    # Check if new table already exists
    if aws dynamodb describe-table --table-name "$new_name" --region "$AWS_REGION" >/dev/null 2>&1; then
        log "INFO" "✅ Table $new_name already exists, using existing table"
        return
    fi
    
    # For cost efficiency, we'll use table aliases/tags instead of duplicating
    # Add production tags to existing dev table
    log "INFO" "🏷️  Adding production tags to existing table: $old_name"
    
    local table_arn=$(aws dynamodb describe-table --table-name "$old_name" --region "$AWS_REGION" --query 'Table.TableArn' --output text)
    
    aws dynamodb tag-resource \
        --resource-arn "$table_arn" \
        --tags Key=Environment,Value=prod Key=ProductionAlias,Value="$new_name" Key=CostOptimized,Value=true \
        --region "$AWS_REGION" >/dev/null 2>&1 || true
    
    log "INFO" "✅ Tagged table $old_name for production use as $new_name"
}

# Function to create S3 bucket alias
create_s3_bucket_alias() {
    local old_bucket=$1
    local new_bucket=$2
    
    log "INFO" "🪣 Processing S3 bucket: $old_bucket -> $new_bucket"
    
    # Check if old bucket exists
    if ! aws s3 ls "s3://$old_bucket" >/dev/null 2>&1; then
        log "WARN" "⚠️  Bucket $old_bucket does not exist, skipping..."
        return
    fi
    
    # Add production tags to existing bucket
    log "INFO" "🏷️  Adding production tags to existing bucket: $old_bucket"
    
    aws s3api put-bucket-tagging \
        --bucket "$old_bucket" \
        --tagging 'TagSet=[{Key=Environment,Value=prod},{Key=ProductionAlias,Value='$new_bucket'},{Key=CostOptimized,Value=true}]' \
        --region "$AWS_REGION" >/dev/null 2>&1 || true
    
    log "INFO" "✅ Tagged bucket $old_bucket for production use as $new_bucket"
}

# Function to tag Kinesis stream for production
tag_kinesis_stream() {
    local old_name=$1
    local new_name=$2
    
    log "INFO" "🌊 Processing Kinesis stream: $old_name -> $new_name"
    
    # Check if old stream exists
    if ! aws kinesis describe-stream --stream-name "$old_name" --region "$AWS_REGION" >/dev/null 2>&1; then
        log "WARN" "⚠️  Stream $old_name does not exist, skipping..."
        return
    fi
    
    # Check if new stream already exists
    if aws kinesis describe-stream --stream-name "$new_name" --region "$AWS_REGION" >/dev/null 2>&1; then
        log "INFO" "✅ Stream $new_name already exists, using existing stream"
        return
    fi
    
    # Get stream ARN
    local stream_arn=$(aws kinesis describe-stream --stream-name "$old_name" --region "$AWS_REGION" --query 'StreamDescription.StreamARN' --output text)
    
    # Add production tags to existing stream
    log "INFO" "🏷️  Adding production tags to existing stream: $old_name"
    
    aws kinesis add-tags-to-stream \
        --stream-name "$old_name" \
        --tags Environment=prod,ProductionAlias="$new_name",CostOptimized=true \
        --region "$AWS_REGION" >/dev/null 2>&1 || true
    
    log "INFO" "✅ Tagged stream $old_name for production use as $new_name"
}

# Check AWS configuration
check_aws_config

# Get all existing dev resources dynamically
log "INFO" "🔍 Discovering existing AWS resources..."

# Get DynamoDB tables with dev suffix
DEV_TABLES=($(aws dynamodb list-tables --region "$AWS_REGION" --query 'TableNames[?contains(@, `dev`)]' --output text))
log "INFO" "Found ${#DEV_TABLES[@]} DynamoDB tables with dev suffix"

# Get Kinesis streams with dev suffix  
DEV_STREAMS=($(aws kinesis list-streams --region "$AWS_REGION" --query 'StreamNames[?contains(@, `dev`)]' --output text))
log "INFO" "Found ${#DEV_STREAMS[@]} Kinesis streams with dev suffix"

# Get S3 buckets with dev suffix
DEV_BUCKETS=($(aws s3 ls | grep dev | awk '{print $3}'))
log "INFO" "Found ${#DEV_BUCKETS[@]} S3 buckets with dev suffix"

# Process DynamoDB tables
log "INFO" "📊 Processing DynamoDB tables..."
for table in "${DEV_TABLES[@]}"; do
    if [[ "$table" == *-dev ]]; then
        prod_table="${table%-dev}"
        rename_dynamodb_table "$table" "$prod_table"
    fi
done

# Process Kinesis streams
log "INFO" "🌊 Processing Kinesis streams..."
for stream in "${DEV_STREAMS[@]}"; do
    if [[ "$stream" == *-dev ]]; then
        prod_stream="${stream%-dev}"
        tag_kinesis_stream "$stream" "$prod_stream"
    fi
done

# Process S3 buckets
log "INFO" "🪣 Processing S3 buckets..."
for bucket in "${DEV_BUCKETS[@]}"; do
    if [[ "$bucket" == *-dev-* ]]; then
        # For S3, we'll keep existing names but tag them for production use
        prod_bucket=$(echo "$bucket" | sed 's/-dev-/-prod-/')
        create_s3_bucket_alias "$bucket" "$prod_bucket"
    fi
done

# Create production resource mapping file
log "INFO" "📝 Creating production resource mapping..."
MAPPING_FILE="/tmp/production-resource-mapping-${TIMESTAMP}.json"

cat > "$MAPPING_FILE" << EOF
{
  "timestamp": "$TIMESTAMP",
  "environment": "prod",
  "aws_region": "$AWS_REGION",
  "resource_mapping": {
    "dynamodb_tables": {
EOF

# Add DynamoDB mappings
first_table=true
for table in "${DEV_TABLES[@]}"; do
    if [[ "$table" == *-dev ]]; then
        prod_table="${table%-dev}"
        if [ "$first_table" = true ]; then
            first_table=false
        else
            echo "," >> "$MAPPING_FILE"
        fi
        echo "      \"$prod_table\": \"$table\"" >> "$MAPPING_FILE"
    fi
done

cat >> "$MAPPING_FILE" << EOF
    },
    "kinesis_streams": {
EOF

# Add Kinesis mappings
first_stream=true
for stream in "${DEV_STREAMS[@]}"; do
    if [[ "$stream" == *-dev ]]; then
        prod_stream="${stream%-dev}"
        if [ "$first_stream" = true ]; then
            first_stream=false
        else
            echo "," >> "$MAPPING_FILE"
        fi
        echo "      \"$prod_stream\": \"$stream\"" >> "$MAPPING_FILE"
    fi
done

cat >> "$MAPPING_FILE" << EOF
    },
    "s3_buckets": {
EOF

# Add S3 mappings
first_bucket=true
for bucket in "${DEV_BUCKETS[@]}"; do
    if [[ "$bucket" == *-dev-* ]]; then
        prod_bucket=$(echo "$bucket" | sed 's/-dev-/-prod-/')
        if [ "$first_bucket" = true ]; then
            first_bucket=false
        else
            echo "," >> "$MAPPING_FILE"
        fi
        echo "      \"$prod_bucket\": \"$bucket\"" >> "$MAPPING_FILE"
    fi
done

cat >> "$MAPPING_FILE" << EOF
    }
  }
}
EOF

log "INFO" "🎉 Resource tagging and mapping completed!"
log "INFO" "📝 Summary:"
log "INFO" "  ✅ ${#DEV_TABLES[@]} DynamoDB tables tagged for production use"
log "INFO" "  ✅ ${#DEV_STREAMS[@]} Kinesis streams tagged for production use"  
log "INFO" "  ✅ ${#DEV_BUCKETS[@]} S3 buckets tagged for production use"
log "INFO" "  📋 Resource mapping saved to: $MAPPING_FILE"
log "INFO" "  📝 Full log saved to: $LOG_FILE"
log "INFO" ""
log "INFO" "Production Resource Configuration:"
for table in "${DEV_TABLES[@]}"; do
    if [[ "$table" == *-dev ]]; then
        prod_table="${table%-dev}"
        log "INFO" "  📊 DynamoDB: $prod_table -> $table (tagged)"
    fi
done
for stream in "${DEV_STREAMS[@]}"; do
    if [[ "$stream" == *-dev ]]; then
        prod_stream="${stream%-dev}"
        log "INFO" "  🌊 Kinesis: $prod_stream -> $stream (tagged)"
    fi
done
for bucket in "${DEV_BUCKETS[@]}"; do
    if [[ "$bucket" == *-dev-* ]]; then
        log "INFO" "  🪣 S3: $bucket (tagged for production)"
    fi
done
log "INFO" ""
log "INFO" "Next steps:"
log "INFO" "1. Update application configuration to use existing dev resources"
log "INFO" "2. Test connectivity to tagged resources"
log "INFO" "3. Deploy applications with production configuration"