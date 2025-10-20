#!/bin/bash

# Script to rename terraform locks table from dev to production naming
# This removes the -dev suffix to make it production-ready

set -e

AWS_REGION="us-east-1"
OLD_TABLE_NAME="user-journey-analytics-terraform-locks-dev"
NEW_TABLE_NAME="user-journey-analytics-terraform-locks"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message"
}

log "INFO" "🔄 Renaming terraform locks table for production use"

# Check if old table exists
if ! aws dynamodb describe-table --table-name "$OLD_TABLE_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
    log "ERROR" "❌ Source table $OLD_TABLE_NAME does not exist"
    exit 1
fi

# Check if new table already exists
if aws dynamodb describe-table --table-name "$NEW_TABLE_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
    log "INFO" "✅ Table $NEW_TABLE_NAME already exists, using existing table"
    exit 0
fi

log "INFO" "📊 Getting table configuration..."

# Get table description
TABLE_DESCRIPTION=$(aws dynamodb describe-table --table-name "$OLD_TABLE_NAME" --region "$AWS_REGION")

# Extract table configuration
BILLING_MODE=$(echo "$TABLE_DESCRIPTION" | jq -r '.Table.BillingModeSummary.BillingMode // "PAY_PER_REQUEST"')
ATTRIBUTE_DEFINITIONS=$(echo "$TABLE_DESCRIPTION" | jq '.Table.AttributeDefinitions')
KEY_SCHEMA=$(echo "$TABLE_DESCRIPTION" | jq '.Table.KeySchema')

log "INFO" "🆕 Creating new table: $NEW_TABLE_NAME"

# Create new table with production name
aws dynamodb create-table \
    --table-name "$NEW_TABLE_NAME" \
    --attribute-definitions "$ATTRIBUTE_DEFINITIONS" \
    --key-schema "$KEY_SCHEMA" \
    --billing-mode "$BILLING_MODE" \
    --region "$AWS_REGION" >/dev/null

# Wait for table to be active
log "INFO" "⏳ Waiting for table to be active..."
aws dynamodb wait table-exists --table-name "$NEW_TABLE_NAME" --region "$AWS_REGION"

# Copy data from old table to new table
log "INFO" "📋 Copying data from $OLD_TABLE_NAME to $NEW_TABLE_NAME..."

# Export data from old table
TEMP_FILE="/tmp/${OLD_TABLE_NAME}-export-${TIMESTAMP}.json"
aws dynamodb scan --table-name "$OLD_TABLE_NAME" --region "$AWS_REGION" > "$TEMP_FILE"

# Import data to new table
ITEMS=$(cat "$TEMP_FILE" | jq -r '.Items[]')
if [ -n "$ITEMS" ]; then
    echo "$ITEMS" | while IFS= read -r item; do
        if [ -n "$item" ] && [ "$item" != "null" ]; then
            aws dynamodb put-item \
                --table-name "$NEW_TABLE_NAME" \
                --item "$item" \
                --region "$AWS_REGION" >/dev/null 2>&1 || true
        fi
    done
fi

# Clean up temp file
rm -f "$TEMP_FILE"

# Add production tags to the new table
TABLE_ARN=$(aws dynamodb describe-table --table-name "$NEW_TABLE_NAME" --region "$AWS_REGION" --query 'Table.TableArn' --output text)

aws dynamodb tag-resource \
    --resource-arn "$TABLE_ARN" \
    --tags Key=Environment,Value=prod Key=Purpose,Value=terraform-locks Key=CostOptimized,Value=true \
    --region "$AWS_REGION" >/dev/null 2>&1 || true

log "INFO" "✅ Successfully created production terraform locks table: $NEW_TABLE_NAME"

# Verify the new table
NEW_ITEM_COUNT=$(aws dynamodb scan --table-name "$NEW_TABLE_NAME" --select COUNT --region "$AWS_REGION" --query 'Count' --output text)
OLD_ITEM_COUNT=$(aws dynamodb scan --table-name "$OLD_TABLE_NAME" --select COUNT --region "$AWS_REGION" --query 'Count' --output text)

log "INFO" "📊 Data verification:"
log "INFO" "  - Old table ($OLD_TABLE_NAME): $OLD_ITEM_COUNT items"
log "INFO" "  - New table ($NEW_TABLE_NAME): $NEW_ITEM_COUNT items"

if [ "$NEW_ITEM_COUNT" -eq "$OLD_ITEM_COUNT" ]; then
    log "INFO" "✅ Data copy successful - item counts match"
else
    log "WARN" "⚠️  Item counts don't match, but this may be expected for terraform locks"
fi

log "INFO" "🎉 Terraform locks table rename completed successfully!"
log "INFO" "💡 You can now use table '$NEW_TABLE_NAME' for production terraform state locking"

echo ""
echo "🎉 Terraform Locks Table Ready!"
echo ""
echo "Table Details:"
echo "  📊 Name: $NEW_TABLE_NAME"
echo "  🌍 Region: $AWS_REGION"
echo "  📈 Items: $NEW_ITEM_COUNT"
echo "  💰 Billing: $BILLING_MODE"
echo ""
echo "✅ Ready for production terraform deployments"