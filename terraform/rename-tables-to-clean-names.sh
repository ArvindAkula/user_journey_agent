#!/bin/bash

# Script to rename DynamoDB tables from dev names to clean production names
# This removes the -dev suffix to create clean table names

set -e

AWS_REGION="us-east-1"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="/tmp/rename_tables_${TIMESTAMP}.log"

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log "INFO" "🔄 Renaming DynamoDB tables to clean production names..."
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
rename_table() {
    local old_name=$1
    local new_name=$2
    
    log "INFO" "📊 Renaming table: $old_name -> $new_name"
    
    # Check if old table exists
    if ! aws dynamodb describe-table --table-name "$old_name" --region "$AWS_REGION" >/dev/null 2>&1; then
        log "WARN" "⚠️  Table $old_name does not exist, skipping..."
        return
    fi
    
    # Check if new table already exists
    if aws dynamodb describe-table --table-name "$new_name" --region "$AWS_REGION" >/dev/null 2>&1; then
        log "INFO" "✅ Table $new_name already exists, skipping rename..."
        return
    fi
    
    # Create backup first
    local backup_name="${old_name}-backup-${TIMESTAMP}"
    log "INFO" "💾 Creating backup: $backup_name"
    aws dynamodb create-backup \
        --table-name "$old_name" \
        --backup-name "$backup_name" \
        --region "$AWS_REGION" >/dev/null 2>&1 || {
        log "WARN" "⚠️  Could not create backup for $old_name"
    }
    
    # Get table description
    log "INFO" "📋 Getting table configuration..."
    local table_description=$(aws dynamodb describe-table --table-name "$old_name" --region "$AWS_REGION")
    
    # Extract table configuration
    local billing_mode=$(echo "$table_description" | jq -r '.Table.BillingModeSummary.BillingMode // "PAY_PER_REQUEST"')
    local attribute_definitions=$(echo "$table_description" | jq '.Table.AttributeDefinitions')
    local key_schema=$(echo "$table_description" | jq '.Table.KeySchema')
    local global_secondary_indexes=$(echo "$table_description" | jq '.Table.GlobalSecondaryIndexes // []')
    
    # Create new table with clean name
    log "INFO" "🆕 Creating new table: $new_name"
    
    local create_table_cmd="aws dynamodb create-table \
        --table-name \"$new_name\" \
        --attribute-definitions '$attribute_definitions' \
        --key-schema '$key_schema' \
        --billing-mode \"$billing_mode\" \
        --region \"$AWS_REGION\""
    
    # Add GSI if they exist
    if [ "$(echo "$global_secondary_indexes" | jq 'length')" -gt 0 ]; then
        # Remove runtime fields from GSI for creation
        local gsi_for_create=$(echo "$global_secondary_indexes" | jq 'map(del(.ProvisionedThroughput, .IndexStatus, .IndexArn, .ItemCount, .IndexSizeBytes))')
        create_table_cmd="$create_table_cmd --global-secondary-indexes '$gsi_for_create'"
    fi
    
    # Execute table creation
    eval "$create_table_cmd" >/dev/null 2>&1 || {
        log "ERROR" "❌ Failed to create table $new_name"
        return 1
    }
    
    # Wait for table to be active
    log "INFO" "⏳ Waiting for table to be active..."
    aws dynamodb wait table-exists --table-name "$new_name" --region "$AWS_REGION" || {
        log "ERROR" "❌ Table $new_name did not become active"
        return 1
    }
    
    # Copy data from old table to new table
    log "INFO" "📋 Copying data from $old_name to $new_name..."
    
    # Get item count first
    local item_count=$(aws dynamodb scan --table-name "$old_name" --select COUNT --region "$AWS_REGION" --query 'Count' --output text 2>/dev/null || echo "0")
    log "INFO" "📊 Found $item_count items to copy"
    
    if [ "$item_count" -gt 0 ]; then
        # Export data from old table
        local temp_file="/tmp/${old_name}-export-${TIMESTAMP}.json"
        aws dynamodb scan --table-name "$old_name" --region "$AWS_REGION" > "$temp_file"
        
        # Import data to new table using batch write
        local items=$(cat "$temp_file" | jq -r '.Items[]' | jq -s .)
        
        # Process items in batches of 25 (DynamoDB batch limit)
        local batch_size=25
        local total_items=$(echo "$items" | jq 'length')
        local batches=$(( (total_items + batch_size - 1) / batch_size ))
        
        log "INFO" "📦 Processing $total_items items in $batches batches..."
        
        for ((i=0; i<batches; i++)); do
            local start=$((i * batch_size))
            local batch_items=$(echo "$items" | jq ".[$start:$((start + batch_size))]")
            
            # Create batch write request
            local batch_request=$(echo "$batch_items" | jq "{
                \"RequestItems\": {
                    \"$new_name\": [
                        .[] | {
                            \"PutRequest\": {
                                \"Item\": .
                            }
                        }
                    ]
                }
            }")
            
            # Execute batch write
            echo "$batch_request" > "/tmp/batch-${i}.json"
            aws dynamodb batch-write-item --request-items file:///tmp/batch-${i}.json --region "$AWS_REGION" >/dev/null 2>&1 || {
                log "WARN" "⚠️  Failed to write batch $((i+1))"
            }
            
            # Clean up batch file
            rm -f "/tmp/batch-${i}.json"
            
            log "INFO" "✅ Processed batch $((i+1))/$batches"
        done
        
        # Clean up temp file
        rm -f "$temp_file"
    fi
    
    # Verify data copy
    local new_item_count=$(aws dynamodb scan --table-name "$new_name" --select COUNT --region "$AWS_REGION" --query 'Count' --output text 2>/dev/null || echo "0")
    log "INFO" "📊 Verification: $new_name has $new_item_count items"
    
    if [ "$item_count" -eq "$new_item_count" ]; then
        log "INFO" "✅ Data copy successful!"
        
        # Delete old table
        log "INFO" "🗑️  Deleting old table: $old_name"
        aws dynamodb delete-table --table-name "$old_name" --region "$AWS_REGION" >/dev/null 2>&1 || {
            log "WARN" "⚠️  Could not delete old table $old_name"
        }
        
        log "INFO" "✅ Successfully renamed table: $old_name -> $new_name"
    else
        log "ERROR" "❌ Data copy verification failed for $new_name"
        return 1
    fi
}

# Function to rename Kinesis stream
rename_kinesis_stream() {
    local old_name=$1
    local new_name=$2
    
    log "INFO" "🌊 Renaming Kinesis stream: $old_name -> $new_name"
    
    # Check if old stream exists
    if ! aws kinesis describe-stream --stream-name "$old_name" --region "$AWS_REGION" >/dev/null 2>&1; then
        log "WARN" "⚠️  Stream $old_name does not exist, skipping..."
        return
    fi
    
    # Check if new stream already exists
    if aws kinesis describe-stream --stream-name "$new_name" --region "$AWS_REGION" >/dev/null 2>&1; then
        log "INFO" "✅ Stream $new_name already exists, skipping rename..."
        return
    fi
    
    # Get stream configuration
    local stream_description=$(aws kinesis describe-stream --stream-name "$old_name" --region "$AWS_REGION")
    local shard_count=$(echo "$stream_description" | jq '.StreamDescription.Shards | length')
    local retention_period=$(echo "$stream_description" | jq -r '.StreamDescription.RetentionPeriodHours')
    
    # Create new stream
    log "INFO" "🆕 Creating new Kinesis stream: $new_name"
    aws kinesis create-stream \
        --stream-name "$new_name" \
        --shard-count "$shard_count" \
        --region "$AWS_REGION" >/dev/null
    
    # Wait for stream to be active
    log "INFO" "⏳ Waiting for stream to be active..."
    aws kinesis wait stream-exists --stream-name "$new_name" --region "$AWS_REGION"
    
    # Update retention period if different from default
    if [ "$retention_period" != "24" ]; then
        aws kinesis increase-stream-retention-period \
            --stream-name "$new_name" \
            --retention-period-hours "$retention_period" \
            --region "$AWS_REGION" >/dev/null
    fi
    
    # Delete old stream
    log "INFO" "🗑️  Deleting old stream: $old_name"
    aws kinesis delete-stream --stream-name "$old_name" --region "$AWS_REGION" >/dev/null
    
    log "INFO" "✅ Successfully renamed stream: $old_name -> $new_name"
}

# Check AWS configuration
check_aws_config

# Define table mappings
declare -a TABLE_MAPPINGS=(
    "user-journey-analytics-struggle-signals-dev:user-journey-analytics-struggle-signals"
    "user-journey-analytics-terraform-locks-dev:user-journey-analytics-terraform-locks"
    "user-journey-analytics-user-events-dev:user-journey-analytics-user-events"
    "user-journey-analytics-user-profiles-dev:user-journey-analytics-user-profiles"
    "user-journey-analytics-video-engagement-dev:user-journey-analytics-video-engagement"
)

# Rename DynamoDB tables
log "INFO" "📊 Processing DynamoDB tables..."
for mapping in "${TABLE_MAPPINGS[@]}"; do
    IFS=':' read -r old_name new_name <<< "$mapping"
    rename_table "$old_name" "$new_name"
done

# Rename Kinesis stream
log "INFO" "🌊 Processing Kinesis streams..."
rename_kinesis_stream "user-journey-analytics-user-events-dev" "user-journey-analytics-user-events"

# Create updated production configuration
log "INFO" "📝 Creating updated production configuration..."
cat > "/tmp/production-resources-final-${TIMESTAMP}.json" << EOF
{
  "environment": "prod",
  "aws_region": "$AWS_REGION",
  "deployment_type": "clean_names",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  
  "dynamodb": {
    "user_profiles_table": "user-journey-analytics-user-profiles",
    "user_events_table": "user-journey-analytics-user-events",
    "struggle_signals_table": "user-journey-analytics-struggle-signals",
    "video_engagement_table": "user-journey-analytics-video-engagement",
    "terraform_locks_table": "user-journey-analytics-terraform-locks"
  },
  
  "kinesis": {
    "user_events_stream": "user-journey-analytics-user-events"
  },
  
  "s3": {
    "analytics_data_bucket": "user-journey-analytics-analytics-data-dev-9bf2a9c5",
    "event_logs_bucket": "user-journey-analytics-event-logs-dev-9bf2a9c5",
    "lambda_artifacts_bucket": "user-journey-analytics-lambda-artifacts-dev-9bf2a9c5"
  },
  
  "configuration": {
    "mock_mode": false,
    "localstack_enabled": false,
    "production_mode": true,
    "clean_names": true
  }
}
EOF

log "INFO" "🎉 Table renaming completed!"
log "INFO" "📝 Summary:"
log "INFO" "  ✅ Renamed ${#TABLE_MAPPINGS[@]} DynamoDB tables to clean names"
log "INFO" "  ✅ Renamed Kinesis stream to clean name"
log "INFO" "  📋 Updated config saved to: /tmp/production-resources-final-${TIMESTAMP}.json"
log "INFO" "  📝 Full log saved to: $LOG_FILE"

echo ""
echo "🎉 Renaming completed successfully!"
echo ""
echo "Final Production Resources:"
echo "  📊 DynamoDB Tables:"
aws dynamodb list-tables --region "$AWS_REGION" --query 'TableNames[?contains(@, `user-journey-analytics`)]' --output table
echo ""
echo "  🌊 Kinesis Streams:"
aws kinesis list-streams --region "$AWS_REGION" --query 'StreamNames[?contains(@, `user-journey-analytics`)]' --output table
echo ""
echo "Next steps:"
echo "1. Update application configuration to use clean table names"
echo "2. Test connectivity to renamed resources"
echo "3. Deploy applications with updated configuration"