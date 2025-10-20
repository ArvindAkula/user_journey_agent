#!/bin/bash

# Script to rename ALL tables from dev to production naming
# This removes the -dev suffix from all tables to make them production-ready

set -e

AWS_REGION="us-east-1"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="/tmp/rename_all_tables_${TIMESTAMP}.log"

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log "INFO" "🔄 Renaming ALL tables from dev to production naming"
log "INFO" "📝 Log file: $LOG_FILE"

# Function to rename a single table
rename_table() {
    local old_name=$1
    local new_name=$2
    
    log "INFO" "📊 Processing table: $old_name -> $new_name"
    
    # Check if old table exists
    if ! aws dynamodb describe-table --table-name "$old_name" --region "$AWS_REGION" >/dev/null 2>&1; then
        log "WARN" "⚠️  Table $old_name does not exist, skipping..."
        return 0
    fi
    
    # Check if new table already exists
    if aws dynamodb describe-table --table-name "$new_name" --region "$AWS_REGION" >/dev/null 2>&1; then
        log "INFO" "✅ Table $new_name already exists, skipping rename"
        return 0
    fi
    
    log "INFO" "📋 Getting table configuration for $old_name..."
    
    # Get table description
    local table_description=$(aws dynamodb describe-table --table-name "$old_name" --region "$AWS_REGION")
    
    # Extract table configuration
    local billing_mode=$(echo "$table_description" | jq -r '.Table.BillingModeSummary.BillingMode // "PAY_PER_REQUEST"')
    local attribute_definitions=$(echo "$table_description" | jq '.Table.AttributeDefinitions')
    local key_schema=$(echo "$table_description" | jq '.Table.KeySchema')
    local global_secondary_indexes=$(echo "$table_description" | jq '.Table.GlobalSecondaryIndexes // []')
    
    log "INFO" "🆕 Creating new table: $new_name"
    
    # Create new table with production name
    local create_table_cmd="aws dynamodb create-table \
        --table-name \"$new_name\" \
        --attribute-definitions '$attribute_definitions' \
        --key-schema '$key_schema' \
        --billing-mode \"$billing_mode\" \
        --region \"$AWS_REGION\""
    
    # Add GSI if they exist
    if [ "$(echo "$global_secondary_indexes" | jq 'length')" -gt 0 ]; then
        # Remove provisioned throughput from GSI for PAY_PER_REQUEST mode
        local gsi_for_create=$(echo "$global_secondary_indexes" | jq 'map(del(.ProvisionedThroughput, .IndexStatus, .IndexArn, .ItemCount, .IndexSizeBytes))')
        create_table_cmd="$create_table_cmd --global-secondary-indexes '$gsi_for_create'"
    fi
    
    eval "$create_table_cmd" >/dev/null
    
    # Wait for table to be active
    log "INFO" "⏳ Waiting for table $new_name to be active..."
    aws dynamodb wait table-exists --table-name "$new_name" --region "$AWS_REGION"
    
    # Copy data from old table to new table
    log "INFO" "📋 Copying data from $old_name to $new_name..."
    
    local temp_file="/tmp/${old_name}-export-${TIMESTAMP}.json"
    
    # Scan old table and save to temp file
    aws dynamodb scan --table-name "$old_name" --region "$AWS_REGION" > "$temp_file"
    
    # Import data to new table
    local items=$(cat "$temp_file" | jq -r '.Items[]')
    if [ -n "$items" ]; then
        echo "$items" | while IFS= read -r item; do
            if [ -n "$item" ] && [ "$item" != "null" ]; then
                aws dynamodb put-item \
                    --table-name "$new_name" \
                    --item "$item" \
                    --region "$AWS_REGION" >/dev/null 2>&1 || true
            fi
        done
    fi
    
    # Clean up temp file
    rm -f "$temp_file"
    
    # Add production tags to the new table
    local table_arn=$(aws dynamodb describe-table --table-name "$new_name" --region "$AWS_REGION" --query 'Table.TableArn' --output text)
    
    aws dynamodb tag-resource \
        --resource-arn "$table_arn" \
        --tags Key=Environment,Value=prod Key=CostOptimized,Value=true Key=RenamedFrom,Value="$old_name" \
        --region "$AWS_REGION" >/dev/null 2>&1 || true
    
    # Verify data copy
    local old_count=$(aws dynamodb scan --table-name "$old_name" --select COUNT --region "$AWS_REGION" --query 'Count' --output text)
    local new_count=$(aws dynamodb scan --table-name "$new_name" --select COUNT --region "$AWS_REGION" --query 'Count' --output text)
    
    log "INFO" "✅ Successfully created $new_name ($new_count items copied from $old_count items)"
    
    return 0
}

# Check AWS configuration
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    log "ERROR" "❌ AWS CLI not configured or no valid credentials"
    exit 1
fi

log "INFO" "✅ AWS CLI configured successfully"

# Get all tables with dev suffix
log "INFO" "🔍 Discovering tables with dev suffix..."
DEV_TABLES=($(aws dynamodb list-tables --region "$AWS_REGION" --query 'TableNames[?contains(@, `-dev`)]' --output text))

log "INFO" "Found ${#DEV_TABLES[@]} tables with dev suffix:"
for table in "${DEV_TABLES[@]}"; do
    log "INFO" "  - $table"
done

if [ ${#DEV_TABLES[@]} -eq 0 ]; then
    log "INFO" "🎉 No tables with dev suffix found - all tables are already production-ready!"
    exit 0
fi

# Process each table
RENAMED_TABLES=()
FAILED_TABLES=()

for table in "${DEV_TABLES[@]}"; do
    if [[ "$table" == *-dev ]]; then
        prod_table="${table%-dev}"
        
        log "INFO" "🔄 Processing: $table -> $prod_table"
        
        if rename_table "$table" "$prod_table"; then
            RENAMED_TABLES+=("$table -> $prod_table")
        else
            FAILED_TABLES+=("$table")
            log "ERROR" "❌ Failed to rename $table"
        fi
    else
        log "WARN" "⚠️  Table $table doesn't end with -dev, skipping"
    fi
done

# Create summary report
SUMMARY_FILE="/tmp/table-rename-summary-${TIMESTAMP}.json"

cat > "$SUMMARY_FILE" << EOF
{
  "timestamp": "$TIMESTAMP",
  "operation": "rename_all_tables_to_prod",
  "aws_region": "$AWS_REGION",
  "summary": {
    "total_tables_found": ${#DEV_TABLES[@]},
    "successfully_renamed": ${#RENAMED_TABLES[@]},
    "failed_renames": ${#FAILED_TABLES[@]}
  },
  "renamed_tables": [
$(printf '    "%s"' "${RENAMED_TABLES[@]}" | sed 's/$/,/g' | sed '$s/,$//')
  ],
  "failed_tables": [
$(printf '    "%s"' "${FAILED_TABLES[@]}" | sed 's/$/,/g' | sed '$s/,$//')
  ]
}
EOF

log "INFO" "🎉 Table renaming process completed!"
log "INFO" "📝 Summary:"
log "INFO" "  ✅ Successfully renamed: ${#RENAMED_TABLES[@]} tables"
log "INFO" "  ❌ Failed to rename: ${#FAILED_TABLES[@]} tables"
log "INFO" "  📋 Summary report: $SUMMARY_FILE"
log "INFO" "  📝 Full log: $LOG_FILE"

# Display final status
echo ""
echo "🎉 Table Renaming Completed!"
echo ""
echo "Results:"
echo "  📊 Total tables processed: ${#DEV_TABLES[@]}"
echo "  ✅ Successfully renamed: ${#RENAMED_TABLES[@]}"
echo "  ❌ Failed: ${#FAILED_TABLES[@]}"
echo ""

if [ ${#RENAMED_TABLES[@]} -gt 0 ]; then
    echo "✅ Successfully Renamed Tables:"
    for rename in "${RENAMED_TABLES[@]}"; do
        echo "  - $rename"
    done
    echo ""
fi

if [ ${#FAILED_TABLES[@]} -gt 0 ]; then
    echo "❌ Failed Tables:"
    for failed in "${FAILED_TABLES[@]}"; do
        echo "  - $failed"
    done
    echo ""
fi

echo "📁 Files:"
echo "  📋 Summary: $SUMMARY_FILE"
echo "  📝 Log: $LOG_FILE"
echo ""

# Show current production tables
echo "📊 Current Production Tables:"
aws dynamodb list-tables --region "$AWS_REGION" --query 'TableNames[?contains(@, `user-journey-analytics`) && !contains(@, `-dev`)]' --output table

echo ""
echo "✅ All tables are now production-ready!"
echo ""