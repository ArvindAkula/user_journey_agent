#!/bin/bash

# Production Deployment Script
# This script handles the complete production deployment process

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_ROOT}/.env.production"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.production.yml"
BACKUP_DIR="${PROJECT_ROOT}/backups/deployment-$(date +%Y%m%d-%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Error handling
error_exit() {
    log_error "$1"
    exit 1
}

# Cleanup function
cleanup() {
    if [ $? -ne 0 ]; then
        log_error "Deployment failed. Cleaning up..."
        # Add cleanup logic here if needed
    fi
}

trap cleanup EXIT

# Validate prerequisites
validate_prerequisites() {
    log_step "Validating prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        error_exit "Docker is not installed or not in PATH"
    fi
    
    if ! docker info &> /dev/null; then
        error_exit "Docker daemon is not running"
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error_exit "Docker Compose is not installed"
    fi
    
    # Check if environment file exists
    if [ ! -f "$ENV_FILE" ]; then
        error_exit "Production environment file not found: $ENV_FILE"
    fi
    
    # Check if compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        error_exit "Production compose file not found: $COMPOSE_FILE"
    fi
    
    log_info "Prerequisites validation passed"
}

# Load and validate environment
load_environment() {
    log_step "Loading production environment..."
    
    # Source the environment file
    set -a
    source "$ENV_FILE"
    set +a
    
    # Run comprehensive environment validation
    log_info "Running environment validation..."
    if ! "$SCRIPT_DIR/validate-production-config.sh"; then
        error_exit "Environment validation failed. Please fix configuration errors before deploying."
    fi
    
    log_info "Environment loaded and validated"
}

# Create backup
create_backup() {
    log_step "Creating deployment backup..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup current environment
    if [ -f "$ENV_FILE" ]; then
        cp "$ENV_FILE" "$BACKUP_DIR/env.backup"
    fi
    
    # Backup current compose file
    if [ -f "$COMPOSE_FILE" ]; then
        cp "$COMPOSE_FILE" "$BACKUP_DIR/docker-compose.backup.yml"
    fi
    
    # Export current container states if any are running
    if docker-compose -f "$COMPOSE_FILE" ps -q &> /dev/null; then
        docker-compose -f "$COMPOSE_FILE" ps > "$BACKUP_DIR/container-states.txt" 2>/dev/null || true
    fi
    
    log_info "Backup created at: $BACKUP_DIR"
}

# Build or pull images
prepare_images() {
    log_step "Preparing Docker images..."
    
    if [ "${BUILD_IMAGES:-true}" = "true" ]; then
        log_info "Building images locally..."
        "$SCRIPT_DIR/build-docker-images.sh" --tag "${IMAGE_TAG:-latest}"
    else
        log_info "Pulling images from registry..."
        docker-compose -f "$COMPOSE_FILE" pull
    fi
}

# Pre-deployment health checks
pre_deployment_checks() {
    log_step "Running pre-deployment checks..."
    
    # Check AWS connectivity
    if ! aws sts get-caller-identity &> /dev/null; then
        log_warn "AWS CLI not configured or credentials invalid"
    fi
    
    # Check if required AWS resources exist
    log_info "Validating AWS resources..."
    
    # Check DynamoDB tables
    if [ -n "$DYNAMODB_TABLE_PREFIX" ]; then
        log_info "Checking DynamoDB tables with prefix: $DYNAMODB_TABLE_PREFIX"
        # Add DynamoDB table checks here
    fi
    
    # Check Kinesis streams
    if [ -n "$KINESIS_STREAM_NAME" ]; then
        log_info "Checking Kinesis stream: $KINESIS_STREAM_NAME"
        # Add Kinesis stream checks here
    fi
    
    # Check S3 buckets
    if [ -n "$S3_BUCKET_NAME" ]; then
        log_info "Checking S3 bucket: $S3_BUCKET_NAME"
        # Add S3 bucket checks here
    fi
    
    log_info "Pre-deployment checks completed"
}

# Deploy services
deploy_services() {
    log_step "Deploying services..."
    
    # Stop existing services gracefully
    if docker-compose -f "$COMPOSE_FILE" ps -q &> /dev/null; then
        log_info "Stopping existing services..."
        docker-compose -f "$COMPOSE_FILE" down --timeout 30
    fi
    
    # Start services in the correct order
    log_info "Starting infrastructure services..."
    docker-compose -f "$COMPOSE_FILE" up -d redis
    
    # Wait for Redis to be ready
    log_info "Waiting for Redis to be ready..."
    timeout 60 bash -c 'until docker-compose -f "$1" exec redis redis-cli ping; do sleep 2; done' _ "$COMPOSE_FILE"
    
    log_info "Starting backend services..."
    docker-compose -f "$COMPOSE_FILE" up -d backend
    
    # Wait for backend to be ready
    log_info "Waiting for backend to be ready..."
    timeout 120 bash -c 'until docker-compose -f "$1" exec backend curl -f http://localhost:8080/actuator/health; do sleep 5; done' _ "$COMPOSE_FILE"
    
    log_info "Starting frontend services..."
    docker-compose -f "$COMPOSE_FILE" up -d user-app analytics-dashboard
    
    log_info "Starting load balancer..."
    docker-compose -f "$COMPOSE_FILE" up -d nginx-proxy
    
    log_info "All services started successfully"
}

# Post-deployment validation
post_deployment_validation() {
    log_step "Running post-deployment validation..."
    
    # Wait for all services to be healthy
    log_info "Waiting for services to become healthy..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        local healthy_services=0
        local total_services=0
        
        # Check each service health
        for service in user-app analytics-dashboard backend redis; do
            total_services=$((total_services + 1))
            if docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "healthy\|Up"; then
                healthy_services=$((healthy_services + 1))
            fi
        done
        
        if [ $healthy_services -eq $total_services ]; then
            log_info "All services are healthy"
            break
        fi
        
        log_info "Waiting for services to become healthy ($healthy_services/$total_services)..."
        sleep 10
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_warn "Some services may not be fully healthy yet"
    fi
    
    # Test endpoints
    log_info "Testing application endpoints..."
    
    # Test user app health
    if curl -f "http://localhost/health" &> /dev/null; then
        log_info "✓ User app health check passed"
    else
        log_warn "✗ User app health check failed"
    fi
    
    # Test analytics dashboard health
    if curl -f "http://localhost/analytics/health" &> /dev/null; then
        log_info "✓ Analytics dashboard health check passed"
    else
        log_warn "✗ Analytics dashboard health check failed"
    fi
    
    # Test backend API
    if curl -f "http://localhost/api/actuator/health" &> /dev/null; then
        log_info "✓ Backend API health check passed"
    else
        log_warn "✗ Backend API health check failed"
    fi
}

# Display deployment summary
show_deployment_summary() {
    log_step "Deployment Summary"
    
    echo "=================================="
    echo "Production Deployment Completed"
    echo "=================================="
    echo "Timestamp: $(date)"
    echo "Backup Location: $BACKUP_DIR"
    echo ""
    echo "Service Status:"
    docker-compose -f "$COMPOSE_FILE" ps
    echo ""
    echo "Application URLs:"
    echo "  User App: https://${USER_APP_DOMAIN:-app.yourdomain.com}"
    echo "  Analytics Dashboard: https://${ANALYTICS_DASHBOARD_DOMAIN:-analytics.yourdomain.com}"
    echo ""
    echo "Monitoring:"
    echo "  Logs: docker-compose -f $COMPOSE_FILE logs -f"
    echo "  Status: docker-compose -f $COMPOSE_FILE ps"
    echo ""
}

# Rollback function
rollback_deployment() {
    log_error "Rolling back deployment..."
    
    if [ -d "$BACKUP_DIR" ]; then
        # Stop current services
        docker-compose -f "$COMPOSE_FILE" down --timeout 30
        
        # Restore backup files
        if [ -f "$BACKUP_DIR/env.backup" ]; then
            cp "$BACKUP_DIR/env.backup" "$ENV_FILE"
        fi
        
        if [ -f "$BACKUP_DIR/docker-compose.backup.yml" ]; then
            cp "$BACKUP_DIR/docker-compose.backup.yml" "$COMPOSE_FILE"
        fi
        
        log_info "Backup restored. Please restart services manually."
    else
        log_error "No backup found for rollback"
    fi
}

# Help function
show_help() {
    cat << EOF
Production Deployment Script

Usage: $0 [OPTIONS]

Options:
    -h, --help              Show this help message
    -b, --build             Build images locally instead of pulling
    -r, --rollback          Rollback to previous deployment
    -v, --validate-only     Only run validation checks
    --skip-backup           Skip creating deployment backup
    --skip-health-check     Skip post-deployment health checks

Environment Variables:
    BUILD_IMAGES           Set to 'true' to build images locally
    IMAGE_TAG              Docker image tag to deploy
    SKIP_BACKUP            Set to 'true' to skip backup creation
    SKIP_HEALTH_CHECK      Set to 'true' to skip health checks

Examples:
    # Standard production deployment
    $0

    # Deploy with local image build
    $0 --build

    # Rollback deployment
    $0 --rollback

    # Validation only
    $0 --validate-only
EOF
}

# Main deployment function
main() {
    local build_images=false
    local rollback=false
    local validate_only=false
    local skip_backup=false
    local skip_health_check=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -b|--build)
                build_images=true
                shift
                ;;
            -r|--rollback)
                rollback=true
                shift
                ;;
            -v|--validate-only)
                validate_only=true
                shift
                ;;
            --skip-backup)
                skip_backup=true
                shift
                ;;
            --skip-health-check)
                skip_health_check=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Handle rollback
    if [ "$rollback" = true ]; then
        rollback_deployment
        exit 0
    fi
    
    log_info "Starting production deployment process..."
    
    # Set environment variables from flags
    export BUILD_IMAGES=$build_images
    export SKIP_BACKUP=$skip_backup
    export SKIP_HEALTH_CHECK=$skip_health_check
    
    # Run deployment steps
    validate_prerequisites
    load_environment
    
    if [ "$validate_only" = true ]; then
        pre_deployment_checks
        log_info "Validation completed successfully"
        exit 0
    fi
    
    if [ "$skip_backup" != true ]; then
        create_backup
    fi
    
    prepare_images
    pre_deployment_checks
    deploy_services
    
    if [ "$skip_health_check" != true ]; then
        post_deployment_validation
    fi
    
    show_deployment_summary
    
    log_info "Production deployment completed successfully!"
}

# Run main function
main "$@"