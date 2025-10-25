#!/bin/bash
#
# AWS Resource Manager for User Journey Analytics
# Manages AWS resources to achieve zero-cost operation when not in use
#
# Usage:
#   ./scripts/aws-resource-manager.sh stop [--dry-run] [--force]
#   ./scripts/aws-resource-manager.sh start [--dry-run]
#   ./scripts/aws-resource-manager.sh status
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="user-journey-analytics"
STATE_FILE="config/aws-resource-state.json"
LOG_FILE="logs/aws-resource-manager.log"

# Flags
DRY_RUN=false
FORCE=false

# Create directories if they don't exist
mkdir -p config logs

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# Function to check if AWS CLI is installed
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
}

# Function to save current state
save_state() {
    log_info "Saving current resource state..."
    
    local state_json="{"
    state_json+="\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
    state_json+="\"project\":\"$PROJECT_NAME\","
    
    # Save SageMaker endpoint state
    log_info "Saving SageMaker endpoint state..."
    local sagemaker_endpoint=$(aws sagemaker describe-endpoint \
        --endpoint-name ${PROJECT_NAME}-exit-risk-endpoint 2>/dev/null || echo "")
    
    if [ -n "$sagemaker_endpoint" ]; then
        local endpoint_config=$(echo "$sagemaker_endpoint" | jq -r '.EndpointConfigName')
        state_json+="\"sagemaker\":{\"endpoint_name\":\"${PROJECT_NAME}-exit-risk-endpoint\",\"endpoint_config\":\"$endpoint_config\"},"
    else
        state_json+="\"sagemaker\":null,"
    fi
    
    # Save Kinesis stream state
    log_info "Saving Kinesis stream state..."
    local kinesis_stream=$(aws kinesis describe-stream \
        --stream-name ${PROJECT_NAME}-user-events 2>/dev/null || echo "")
    
    if [ -n "$kinesis_stream" ]; then
        local shard_count=$(echo "$kinesis_stream" | jq -r '.StreamDescription.Shards | length')
        state_json+="\"kinesis\":{\"stream_name\":\"${PROJECT_NAME}-user-events\",\"shard_count\":$shard_count},"
    else
        state_json+="\"kinesis\":null,"
    fi
    
    # Save Lambda function states
    log_info "Saving Lambda function states..."
    state_json+="\"lambda\":["
    
    local lambda_functions=("event_processor" "intervention-executor")
    local first=true
    for func in "${lambda_functions[@]}"; do
        local func_config=$(aws lambda get-function-concurrency --function-name "$func" 2>/dev/null || echo "")
        if [ "$first" = true ]; then
            first=false
        else
            state_json+=","
        fi
        
        if [ -n "$func_config" ]; then
            local concurrency=$(echo "$func_config" | jq -r '.ReservedConcurrentExecutions // 0')
            state_json+="{\"name\":\"$func\",\"reserved_concurrency\":$concurrency}"
        else
            state_json+="{\"name\":\"$func\",\"reserved_concurrency\":0}"
        fi
    done
    state_json+="],"
    
    # Save CloudWatch alarm states
    log_info "Saving CloudWatch alarm states..."
    local alarms=$(aws cloudwatch describe-alarms \
        --alarm-name-prefix "$PROJECT_NAME" 2>/dev/null || echo "")
    
    if [ -n "$alarms" ]; then
        local alarm_count=$(echo "$alarms" | jq -r '.MetricAlarms | length')
        state_json+="\"cloudwatch\":{\"alarm_count\":$alarm_count}"
    else
        state_json+="\"cloudwatch\":{\"alarm_count\":0}"
    fi
    
    state_json+="}"
    
    # Save to file
    echo "$state_json" | jq '.' > "$STATE_FILE"
    log_success "State saved to $STATE_FILE"
}

# Function to stop all resources
stop_resources() {
    log_info "========================================="
    log_info "Stopping AWS Resources"
    log_info "========================================="
    
    if [ "$DRY_RUN" = true ]; then
        log_warning "DRY RUN MODE - No actual changes will be made"
    fi
    
    # Save current state before stopping
    if [ "$DRY_RUN" = false ]; then
        save_state
    fi
    
    local total_savings=0
    
    # Stop SageMaker endpoint
    log_info ""
    log_info "1. SageMaker Endpoint"
    log_info "-------------------"
    local endpoint_status=$(aws sagemaker describe-endpoint \
        --endpoint-name ${PROJECT_NAME}-exit-risk-endpoint \
        --query 'EndpointStatus' --output text 2>/dev/null || echo "NotFound")
    
    if [ "$endpoint_status" = "InService" ]; then
        log_info "Current status: InService"
        log_info "Action: Delete endpoint (saves ~\$1.56/day)"
        
        if [ "$DRY_RUN" = false ]; then
            aws sagemaker delete-endpoint --endpoint-name ${PROJECT_NAME}-exit-risk-endpoint
            log_success "SageMaker endpoint deleted"
        fi
        total_savings=$(echo "$total_savings + 1.56" | bc)
    else
        log_info "Status: $endpoint_status (no action needed)"
    fi
    
    # Scale down Kinesis
    log_info ""
    log_info "2. Kinesis Data Stream"
    log_info "-------------------"
    local shard_count=$(aws kinesis describe-stream \
        --stream-name ${PROJECT_NAME}-user-events \
        --query 'StreamDescription.Shards | length(@)' --output text 2>/dev/null || echo "0")
    
    if [ "$shard_count" -gt 1 ]; then
        log_info "Current shards: $shard_count"
        log_info "Action: Scale down to 1 shard (saves ~\$0.36/day)"
        
        if [ "$DRY_RUN" = false ]; then
            aws kinesis update-shard-count \
                --stream-name ${PROJECT_NAME}-user-events \
                --target-shard-count 1 \
                --scaling-type UNIFORM_SCALING
            log_success "Kinesis scaled down to 1 shard"
        fi
        total_savings=$(echo "$total_savings + 0.36" | bc)
    else
        log_info "Current shards: $shard_count (already optimized)"
    fi
    
    # Set Lambda concurrency to 0
    log_info ""
    log_info "3. Lambda Functions"
    log_info "-------------------"
    local lambda_functions=("event_processor" "intervention-executor")
    
    for func in "${lambda_functions[@]}"; do
        local exists=$(aws lambda get-function --function-name "$func" 2>/dev/null || echo "")
        if [ -n "$exists" ]; then
            log_info "Function: $func"
            log_info "Action: Set reserved concurrency to 0 (prevents invocations)"
            
            if [ "$DRY_RUN" = false ]; then
                aws lambda put-function-concurrency \
                    --function-name "$func" \
                    --reserved-concurrent-executions 0
                log_success "Concurrency set to 0 for $func"
            fi
        fi
    done
    
    # Disable CloudWatch alarms
    log_info ""
    log_info "4. CloudWatch Alarms"
    log_info "-------------------"
    local alarm_names=$(aws cloudwatch describe-alarms \
        --alarm-name-prefix "$PROJECT_NAME" \
        --query 'MetricAlarms[].AlarmName' --output text 2>/dev/null || echo "")
    
    if [ -n "$alarm_names" ]; then
        local alarm_count=$(echo "$alarm_names" | wc -w)
        log_info "Found $alarm_count alarms"
        log_info "Action: Disable all alarms (saves ~\$0.03/day)"
        
        if [ "$DRY_RUN" = false ]; then
            for alarm in $alarm_names; do
                aws cloudwatch disable-alarm-actions --alarm-names "$alarm"
            done
            log_success "Disabled $alarm_count alarms"
        fi
        total_savings=$(echo "$total_savings + 0.03" | bc)
    else
        log_info "No alarms found"
    fi
    
    # Summary
    log_info ""
    log_info "========================================="
    log_info "Summary"
    log_info "========================================="
    log_success "Estimated daily savings: \$${total_savings}"
    log_success "Estimated monthly savings: \$$(echo "$total_savings * 30" | bc)"
    
    if [ "$DRY_RUN" = false ]; then
        log_success "All resources stopped successfully!"
        log_info "State saved to: $STATE_FILE"
    else
        log_warning "DRY RUN completed - no changes made"
    fi
}

# Function to start all resources
start_resources() {
    log_info "========================================="
    log_info "Starting AWS Resources"
    log_info "========================================="
    
    if [ "$DRY_RUN" = true ]; then
        log_warning "DRY RUN MODE - No actual changes will be made"
    fi
    
    # Check if state file exists
    if [ ! -f "$STATE_FILE" ]; then
        log_error "State file not found: $STATE_FILE"
        log_error "Cannot restore resources without saved state"
        exit 1
    fi
    
    log_info "Loading state from: $STATE_FILE"
    
    # Start SageMaker endpoint
    log_info ""
    log_info "1. SageMaker Endpoint"
    log_info "-------------------"
    local endpoint_name=$(jq -r '.sagemaker.endpoint_name // empty' "$STATE_FILE")
    local endpoint_config=$(jq -r '.sagemaker.endpoint_config // empty' "$STATE_FILE")
    
    if [ -n "$endpoint_name" ] && [ -n "$endpoint_config" ]; then
        local current_status=$(aws sagemaker describe-endpoint \
            --endpoint-name "$endpoint_name" \
            --query 'EndpointStatus' --output text 2>/dev/null || echo "NotFound")
        
        if [ "$current_status" = "NotFound" ]; then
            log_info "Action: Create endpoint from config: $endpoint_config"
            
            if [ "$DRY_RUN" = false ]; then
                aws sagemaker create-endpoint \
                    --endpoint-name "$endpoint_name" \
                    --endpoint-config-name "$endpoint_config"
                log_success "SageMaker endpoint creation initiated"
                log_info "Endpoint will be ready in 5-10 minutes"
            fi
        else
            log_info "Status: $current_status (already exists)"
        fi
    else
        log_info "No SageMaker endpoint in saved state"
    fi
    
    # Scale up Kinesis
    log_info ""
    log_info "2. Kinesis Data Stream"
    log_info "-------------------"
    local saved_shard_count=$(jq -r '.kinesis.shard_count // 2' "$STATE_FILE")
    local stream_name=$(jq -r '.kinesis.stream_name // empty' "$STATE_FILE")
    
    if [ -n "$stream_name" ]; then
        local current_shards=$(aws kinesis describe-stream \
            --stream-name "$stream_name" \
            --query 'StreamDescription.Shards | length(@)' --output text 2>/dev/null || echo "0")
        
        if [ "$current_shards" -lt "$saved_shard_count" ]; then
            log_info "Current shards: $current_shards"
            log_info "Action: Scale up to $saved_shard_count shards"
            
            if [ "$DRY_RUN" = false ]; then
                aws kinesis update-shard-count \
                    --stream-name "$stream_name" \
                    --target-shard-count "$saved_shard_count" \
                    --scaling-type UNIFORM_SCALING
                log_success "Kinesis scaled up to $saved_shard_count shards"
            fi
        else
            log_info "Current shards: $current_shards (already at target)"
        fi
    fi
    
    # Remove Lambda concurrency limits
    log_info ""
    log_info "3. Lambda Functions"
    log_info "-------------------"
    local lambda_count=$(jq -r '.lambda | length' "$STATE_FILE")
    
    for ((i=0; i<$lambda_count; i++)); do
        local func_name=$(jq -r ".lambda[$i].name" "$STATE_FILE")
        log_info "Function: $func_name"
        log_info "Action: Remove concurrency limit"
        
        if [ "$DRY_RUN" = false ]; then
            aws lambda delete-function-concurrency --function-name "$func_name" 2>/dev/null || true
            log_success "Concurrency limit removed for $func_name"
        fi
    done
    
    # Enable CloudWatch alarms
    log_info ""
    log_info "4. CloudWatch Alarms"
    log_info "-------------------"
    local alarm_names=$(aws cloudwatch describe-alarms \
        --alarm-name-prefix "$PROJECT_NAME" \
        --query 'MetricAlarms[].AlarmName' --output text 2>/dev/null || echo "")
    
    if [ -n "$alarm_names" ]; then
        local alarm_count=$(echo "$alarm_names" | wc -w)
        log_info "Found $alarm_count alarms"
        log_info "Action: Enable all alarms"
        
        if [ "$DRY_RUN" = false ]; then
            for alarm in $alarm_names; do
                aws cloudwatch enable-alarm-actions --alarm-names "$alarm"
            done
            log_success "Enabled $alarm_count alarms"
        fi
    fi
    
    # Summary
    log_info ""
    log_info "========================================="
    log_info "Summary"
    log_info "========================================="
    
    if [ "$DRY_RUN" = false ]; then
        log_success "All resources started successfully!"
        log_info "Note: SageMaker endpoint may take 5-10 minutes to be fully operational"
    else
        log_warning "DRY RUN completed - no changes made"
    fi
}

# Function to show resource status
show_status() {
    log_info "========================================="
    log_info "AWS Resource Status"
    log_info "========================================="
    
    local total_daily_cost=0
    
    # SageMaker endpoint status
    log_info ""
    log_info "1. SageMaker Endpoint"
    log_info "-------------------"
    local endpoint_status=$(aws sagemaker describe-endpoint \
        --endpoint-name ${PROJECT_NAME}-exit-risk-endpoint \
        --query '{Status:EndpointStatus,Instance:ProductionVariants[0].InstanceType}' \
        --output json 2>/dev/null || echo '{"Status":"NotFound"}')
    
    local status=$(echo "$endpoint_status" | jq -r '.Status')
    if [ "$status" = "InService" ]; then
        log_success "Status: InService"
        local instance=$(echo "$endpoint_status" | jq -r '.Instance')
        log_info "Instance: $instance"
        log_info "Cost: ~\$1.56/day"
        total_daily_cost=$(echo "$total_daily_cost + 1.56" | bc)
    elif [ "$status" = "NotFound" ]; then
        log_info "Status: Not deployed (saving \$1.56/day)"
    else
        log_warning "Status: $status"
    fi
    
    # Kinesis stream status
    log_info ""
    log_info "2. Kinesis Data Stream"
    log_info "-------------------"
    local kinesis_info=$(aws kinesis describe-stream \
        --stream-name ${PROJECT_NAME}-user-events \
        --query '{Status:StreamDescription.StreamStatus,Shards:length(StreamDescription.Shards)}' \
        --output json 2>/dev/null || echo '{"Status":"NotFound"}')
    
    local stream_status=$(echo "$kinesis_info" | jq -r '.Status')
    if [ "$stream_status" = "ACTIVE" ]; then
        local shard_count=$(echo "$kinesis_info" | jq -r '.Shards')
        log_success "Status: ACTIVE"
        log_info "Shards: $shard_count"
        local kinesis_cost=$(echo "$shard_count * 0.36" | bc)
        log_info "Cost: ~\$${kinesis_cost}/day"
        total_daily_cost=$(echo "$total_daily_cost + $kinesis_cost" | bc)
    else
        log_warning "Status: $stream_status"
    fi
    
    # Lambda functions status
    log_info ""
    log_info "3. Lambda Functions"
    log_info "-------------------"
    local lambda_functions=("event_processor" "intervention-executor")
    
    for func in "${lambda_functions[@]}"; do
        local func_info=$(aws lambda get-function-concurrency \
            --function-name "$func" 2>/dev/null || echo '{}')
        
        if [ -n "$func_info" ] && [ "$func_info" != "{}" ]; then
            local concurrency=$(echo "$func_info" | jq -r '.ReservedConcurrentExecutions // "unlimited"')
            if [ "$concurrency" = "0" ]; then
                log_warning "$func: Concurrency = 0 (disabled)"
            else
                log_success "$func: Concurrency = $concurrency"
            fi
        else
            log_success "$func: No concurrency limit"
        fi
        log_info "Cost: \$0/day (only charged on invocation)"
    done
    
    # CloudWatch alarms
    log_info ""
    log_info "4. CloudWatch Alarms"
    log_info "-------------------"
    local alarm_count=$(aws cloudwatch describe-alarms \
        --alarm-name-prefix "$PROJECT_NAME" \
        --query 'length(MetricAlarms)' --output text 2>/dev/null || echo "0")
    
    log_info "Total alarms: $alarm_count"
    log_info "Cost: ~\$0.03/day"
    total_daily_cost=$(echo "$total_daily_cost + 0.03" | bc)
    
    # DynamoDB tables
    log_info ""
    log_info "5. DynamoDB Tables"
    log_info "-------------------"
    local table_count=$(aws dynamodb list-tables \
        --query "length(TableNames[?starts_with(@, '$PROJECT_NAME')])" --output text 2>/dev/null || echo "0")
    
    log_info "Total tables: $table_count"
    log_info "Billing: On-demand (pay per request)"
    log_info "Cost: ~\$0/day (idle)"
    
    # Summary
    log_info ""
    log_info "========================================="
    log_info "Cost Summary"
    log_info "========================================="
    log_info "Daily cost: ~\$${total_daily_cost}"
    log_info "Monthly cost: ~\$$(echo "$total_daily_cost * 30" | bc)"
    log_info ""
    
    if (( $(echo "$total_daily_cost > 1.0" | bc -l) )); then
        log_warning "💡 Tip: Run './scripts/aws-resource-manager.sh stop' to reduce costs"
    else
        log_success "✓ Resources are optimized for minimal cost"
    fi
}

# Show help
show_help() {
    cat << EOF
AWS Resource Manager for User Journey Analytics

Usage:
  $0 stop [--dry-run] [--force]    Stop all AWS resources
  $0 start [--dry-run]             Start all AWS resources
  $0 status                        Show current resource status
  $0 --help                        Show this help message

Options:
  --dry-run    Show what would be done without making changes
  --force      Skip confirmation prompts

Examples:
  # Show current status and costs
  $0 status

  # Preview what would be stopped (dry run)
  $0 stop --dry-run

  # Stop all resources to save costs
  $0 stop

  # Start all resources from saved state
  $0 start

Resources Managed:
  - SageMaker Endpoints (saves ~\$1.56/day when stopped)
  - Kinesis Data Streams (saves ~\$0.36/day when scaled down)
  - Lambda Functions (prevents invocations when stopped)
  - CloudWatch Alarms (saves ~\$0.03/day when disabled)

State File: $STATE_FILE
Log File: $LOG_FILE

EOF
}

# Main script
main() {
    check_aws_cli
    
    # Parse arguments
    COMMAND=""
    while [[ $# -gt 0 ]]; do
        case $1 in
            stop|start|status)
                COMMAND=$1
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Check if command is provided
    if [ -z "$COMMAND" ]; then
        log_error "No command specified"
        show_help
        exit 1
    fi
    
    # Execute command
    case $COMMAND in
        stop)
            if [ "$FORCE" = false ] && [ "$DRY_RUN" = false ]; then
                echo -e "${YELLOW}WARNING: This will stop AWS resources and may affect running applications.${NC}"
                read -p "Are you sure you want to continue? (yes/no): " confirm
                if [ "$confirm" != "yes" ]; then
                    log_info "Operation cancelled"
                    exit 0
                fi
            fi
            stop_resources
            ;;
        start)
            start_resources
            ;;
        status)
            show_status
            ;;
    esac
}

# Run main function
main "$@"
