#!/bin/bash

# Demo Environment Management Script
# Manages demo environment lifecycle, cost tracking, and resource management

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEMO_CONFIG_FILE="$PROJECT_ROOT/config/demo-environment.json"
COST_TRACKING_FILE="$PROJECT_ROOT/logs/demo-costs.json"
BACKUP_DIR="$PROJECT_ROOT/backups/demo-data"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Load demo configuration
load_demo_config() {
    if [[ ! -f "$DEMO_CONFIG_FILE" ]]; then
        error "Demo configuration file not found: $DEMO_CONFIG_FILE"
        exit 1
    fi
    
    DEMO_ENVIRONMENT=$(jq -r '.environment' "$DEMO_CONFIG_FILE")
    AWS_REGION=$(jq -r '.aws.region' "$DEMO_CONFIG_FILE")
    DEMO_DURATION_HOURS=$(jq -r '.demo.durationHours' "$DEMO_CONFIG_FILE")
    AUTO_SHUTDOWN=$(jq -r '.demo.autoShutdown' "$DEMO_CONFIG_FILE")
}

# Start demo environment
start_demo_environment() {
    log "Starting demo environment..."
    
    # Record start time
    START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Update demo config with start time
    jq --arg start_time "$START_TIME" '.demo.startTime = $start_time' "$DEMO_CONFIG_FILE" > tmp.$$.json && mv tmp.$$.json "$DEMO_CONFIG_FILE"
    
    # Start infrastructure
    log "Deploying infrastructure..."
    cd "$PROJECT_ROOT/terraform"
    terraform init -backend-config="backend-dev.hcl"
    terraform apply -var="demo_mode=true" -var="environment=demo" -auto-approve
    
    # Start backend services
    log "Starting backend services..."
    cd "$PROJECT_ROOT/backend"
    ./mvnw spring-boot:run -Dspring-boot.run.profiles=demo &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$PROJECT_ROOT/logs/backend.pid"
    
    # Start frontend
    log "Starting frontend..."
    cd "$PROJECT_ROOT/frontend"
    npm start &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$PROJECT_ROOT/logs/frontend.pid"
    
    # Seed demo data
    log "Seeding demo data..."
    sleep 30 # Wait for services to start
    curl -X POST "http://localhost:8080/api/demo/seed" -H "Content-Type: application/json"
    
    # Schedule auto-shutdown if enabled
    if [[ "$AUTO_SHUTDOWN" == "true" ]]; then
        schedule_auto_shutdown
    fi
    
    # Start cost tracking
    start_cost_tracking
    
    success "Demo environment started successfully!"
    log "Frontend: http://localhost:3000"
    log "Backend API: http://localhost:8080"
    log "Demo will auto-shutdown in $DEMO_DURATION_HOURS hours (if enabled)"
}

# Stop demo environment
stop_demo_environment() {
    log "Stopping demo environment..."
    
    # Stop frontend and backend
    if [[ -f "$PROJECT_ROOT/logs/frontend.pid" ]]; then
        FRONTEND_PID=$(cat "$PROJECT_ROOT/logs/frontend.pid")
        kill $FRONTEND_PID 2>/dev/null || true
        rm -f "$PROJECT_ROOT/logs/frontend.pid"
    fi
    
    if [[ -f "$PROJECT_ROOT/logs/backend.pid" ]]; then
        BACKEND_PID=$(cat "$PROJECT_ROOT/logs/backend.pid")
        kill $BACKEND_PID 2>/dev/null || true
        rm -f "$PROJECT_ROOT/logs/backend.pid"
    fi
    
    # Backup demo data before shutdown
    backup_demo_data
    
    # Stop infrastructure (optional - keep for cost savings)
    read -p "Do you want to destroy AWS infrastructure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Destroying infrastructure..."
        cd "$PROJECT_ROOT/terraform"
        terraform destroy -var="demo_mode=true" -var="environment=demo" -auto-approve
    fi
    
    # Record stop time and calculate costs
    STOP_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    calculate_session_cost "$STOP_TIME"
    
    success "Demo environment stopped successfully!"
}

# Schedule auto-shutdown
schedule_auto_shutdown() {
    log "Scheduling auto-shutdown in $DEMO_DURATION_HOURS hours..."
    
    # Create shutdown script
    cat > "$PROJECT_ROOT/logs/auto-shutdown.sh" << EOF
#!/bin/bash
cd "$PROJECT_ROOT"
./scripts/demo-environment-manager.sh stop
EOF
    chmod +x "$PROJECT_ROOT/logs/auto-shutdown.sh"
    
    # Schedule with at command (macOS/Linux)
    if command -v at &> /dev/null; then
        echo "$PROJECT_ROOT/logs/auto-shutdown.sh" | at now + ${DEMO_DURATION_HOURS} hours
        success "Auto-shutdown scheduled for $(date -d "+${DEMO_DURATION_HOURS} hours" 2>/dev/null || date -v+${DEMO_DURATION_HOURS}H 2>/dev/null)"
    else
        warning "Auto-shutdown scheduling not available (at command not found)"
    fi
}

# Start cost tracking
start_cost_tracking() {
    log "Starting cost tracking..."
    
    # Initialize cost tracking file
    mkdir -p "$(dirname "$COST_TRACKING_FILE")"
    
    START_TIME=$(jq -r '.demo.startTime' "$DEMO_CONFIG_FILE")
    
    cat > "$COST_TRACKING_FILE" << EOF
{
  "sessionId": "$(uuidgen | tr '[:upper:]' '[:lower:]')",
  "startTime": "$START_TIME",
  "environment": "$DEMO_ENVIRONMENT",
  "estimatedHourlyCost": 12.50,
  "services": {
    "lambda": {"estimatedCost": 2.00, "unit": "hour"},
    "dynamodb": {"estimatedCost": 1.50, "unit": "hour"},
    "kinesis": {"estimatedCost": 3.00, "unit": "hour"},
    "bedrock": {"estimatedCost": 4.00, "unit": "hour"},
    "sagemaker": {"estimatedCost": 2.00, "unit": "hour"}
  },
  "actualCosts": []
}
EOF
}

# Calculate session cost
calculate_session_cost() {
    local stop_time=$1
    local start_time=$(jq -r '.demo.startTime' "$DEMO_CONFIG_FILE")
    
    # Calculate duration in hours
    local start_epoch=$(date -d "$start_time" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$start_time" +%s)
    local stop_epoch=$(date -d "$stop_time" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$stop_time" +%s)
    local duration_hours=$(echo "scale=2; ($stop_epoch - $start_epoch) / 3600" | bc)
    
    local estimated_cost=$(echo "scale=2; $duration_hours * 12.50" | bc)
    
    # Update cost tracking file
    jq --arg stop_time "$stop_time" --arg duration "$duration_hours" --arg cost "$estimated_cost" \
       '.stopTime = $stop_time | .durationHours = ($duration | tonumber) | .estimatedTotalCost = ($cost | tonumber)' \
       "$COST_TRACKING_FILE" > tmp.$$.json && mv tmp.$$.json "$COST_TRACKING_FILE"
    
    log "Demo session duration: $duration_hours hours"
    log "Estimated cost: \$$estimated_cost"
}

# Backup demo data
backup_demo_data() {
    log "Backing up demo data..."
    
    mkdir -p "$BACKUP_DIR"
    BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="$BACKUP_DIR/demo_backup_$BACKUP_TIMESTAMP.json"
    
    # Export data from DynamoDB tables
    aws dynamodb scan --table-name "UserProfiles-demo" --region "$AWS_REGION" > "$BACKUP_FILE.userprofiles" 2>/dev/null || true
    aws dynamodb scan --table-name "UserEvents-demo" --region "$AWS_REGION" > "$BACKUP_FILE.userevents" 2>/dev/null || true
    aws dynamodb scan --table-name "StruggleSignals-demo" --region "$AWS_REGION" > "$BACKUP_FILE.strugglesignals" 2>/dev/null || true
    
    # Create backup manifest
    cat > "$BACKUP_FILE" << EOF
{
  "backupId": "$(uuidgen | tr '[:upper:]' '[:lower:]')",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "$DEMO_ENVIRONMENT",
  "files": {
    "userProfiles": "$BACKUP_FILE.userprofiles",
    "userEvents": "$BACKUP_FILE.userevents",
    "struggleSignals": "$BACKUP_FILE.strugglesignals"
  }
}
EOF
    
    success "Demo data backed up to: $BACKUP_FILE"
}

# Restore demo data
restore_demo_data() {
    local backup_file=$1
    
    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log "Restoring demo data from: $backup_file"
    
    # Clear existing data
    reset_demo_data
    
    # Restore from backup files
    local user_profiles_file=$(jq -r '.files.userProfiles' "$backup_file")
    local user_events_file=$(jq -r '.files.userEvents' "$backup_file")
    local struggle_signals_file=$(jq -r '.files.struggleSignals' "$backup_file")
    
    # Restore each table
    if [[ -f "$user_profiles_file" ]]; then
        jq -r '.Items[] | @base64' "$user_profiles_file" | while read item; do
            echo "$item" | base64 --decode | aws dynamodb put-item --table-name "UserProfiles-demo" --item file:///dev/stdin --region "$AWS_REGION"
        done
    fi
    
    success "Demo data restored successfully!"
}

# Reset demo data to clean state
reset_demo_data() {
    log "Resetting demo data to clean state..."
    
    # Clear DynamoDB tables
    aws dynamodb scan --table-name "UserProfiles-demo" --region "$AWS_REGION" --query "Items[].userId.S" --output text | \
    xargs -I {} aws dynamodb delete-item --table-name "UserProfiles-demo" --key '{"userId":{"S":"{}"}}'  --region "$AWS_REGION" 2>/dev/null || true
    
    # Reseed with fresh demo data
    curl -X POST "http://localhost:8080/api/demo/seed" -H "Content-Type: application/json" 2>/dev/null || true
    
    success "Demo data reset completed!"
}

# Health check
health_check() {
    log "Performing demo environment health check..."
    
    local health_status="healthy"
    local issues=()
    
    # Check frontend
    if ! curl -s "http://localhost:3000" > /dev/null; then
        health_status="unhealthy"
        issues+=("Frontend not responding")
    fi
    
    # Check backend
    if ! curl -s "http://localhost:8080/actuator/health" > /dev/null; then
        health_status="unhealthy"
        issues+=("Backend not responding")
    fi
    
    # Check AWS services
    if ! aws dynamodb describe-table --table-name "UserProfiles-demo" --region "$AWS_REGION" > /dev/null 2>&1; then
        health_status="unhealthy"
        issues+=("DynamoDB tables not accessible")
    fi
    
    # Generate health report
    cat > "$PROJECT_ROOT/logs/health-check.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "status": "$health_status",
  "issues": $(printf '%s\n' "${issues[@]}" | jq -R . | jq -s .),
  "services": {
    "frontend": "$(curl -s "http://localhost:3000" > /dev/null && echo "healthy" || echo "unhealthy")",
    "backend": "$(curl -s "http://localhost:8080/actuator/health" > /dev/null && echo "healthy" || echo "unhealthy")",
    "dynamodb": "$(aws dynamodb describe-table --table-name "UserProfiles-demo" --region "$AWS_REGION" > /dev/null 2>&1 && echo "healthy" || echo "unhealthy")"
  }
}
EOF
    
    if [[ "$health_status" == "healthy" ]]; then
        success "Demo environment is healthy!"
    else
        error "Demo environment has issues:"
        printf '%s\n' "${issues[@]}"
    fi
}

# Cost estimation
estimate_cost() {
    local duration_hours=${1:-4}
    
    log "Estimating cost for $duration_hours hour demo session..."
    
    local base_hourly_cost=12.50
    local total_cost=$(echo "scale=2; $duration_hours * $base_hourly_cost" | bc)
    
    cat << EOF

Demo Cost Estimation:
=====================
Duration: $duration_hours hours
Base hourly rate: \$$base_hourly_cost

Service Breakdown (per hour):
- AWS Lambda: \$2.00
- DynamoDB: \$1.50
- Kinesis Data Streams: \$3.00
- Amazon Bedrock: \$4.00
- SageMaker: \$2.00

Total Estimated Cost: \$$total_cost

Note: Actual costs may vary based on usage patterns.
EOF
}

# Main command handler
case "${1:-}" in
    "start")
        load_demo_config
        start_demo_environment
        ;;
    "stop")
        load_demo_config
        stop_demo_environment
        ;;
    "restart")
        load_demo_config
        stop_demo_environment
        sleep 5
        start_demo_environment
        ;;
    "backup")
        load_demo_config
        backup_demo_data
        ;;
    "restore")
        if [[ -z "${2:-}" ]]; then
            error "Please specify backup file to restore"
            exit 1
        fi
        load_demo_config
        restore_demo_data "$2"
        ;;
    "reset")
        load_demo_config
        reset_demo_data
        ;;
    "health")
        load_demo_config
        health_check
        ;;
    "cost")
        estimate_cost "${2:-4}"
        ;;
    "status")
        load_demo_config
        health_check
        if [[ -f "$COST_TRACKING_FILE" ]]; then
            log "Current session cost tracking:"
            cat "$COST_TRACKING_FILE" | jq .
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|backup|restore|reset|health|cost|status}"
        echo ""
        echo "Commands:"
        echo "  start           - Start demo environment"
        echo "  stop            - Stop demo environment"
        echo "  restart         - Restart demo environment"
        echo "  backup          - Backup demo data"
        echo "  restore <file>  - Restore demo data from backup"
        echo "  reset           - Reset demo data to clean state"
        echo "  health          - Check demo environment health"
        echo "  cost [hours]    - Estimate cost for demo session"
        echo "  status          - Show current demo status"
        exit 1
        ;;
esac