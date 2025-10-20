#!/bin/bash

# Production Mode Switcher Script
# Switches between mock AWS services and real AWS services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_ROOT}/.env.production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    cat << EOF
Production Mode Switcher

Usage: $0 [MODE]

Modes:
    mock    - Use mock AWS services (LocalStack/embedded mocks)
    real    - Use real AWS services (requires valid credentials)
    status  - Show current mode

Examples:
    $0 mock     # Switch to mock mode for testing
    $0 real     # Switch to real AWS services
    $0 status   # Check current configuration
EOF
}

get_current_mode() {
    if [ ! -f "$ENV_FILE" ]; then
        echo "unknown"
        return
    fi
    
    local mock_mode=$(grep "^AWS_MOCK_MODE=" "$ENV_FILE" | cut -d'=' -f2)
    if [ "$mock_mode" = "true" ]; then
        echo "mock"
    elif [ "$mock_mode" = "false" ]; then
        echo "real"
    else
        echo "unknown"
    fi
}

show_status() {
    local current_mode=$(get_current_mode)
    
    echo "=================================="
    echo "Production Configuration Status"
    echo "=================================="
    echo "Current Mode: $current_mode"
    echo ""
    
    if [ "$current_mode" = "mock" ]; then
        echo -e "${YELLOW}Mock Mode Active${NC}"
        echo "- Uses embedded/LocalStack AWS services"
        echo "- Safe for testing without AWS costs"
        echo "- No real AWS credentials required"
    elif [ "$current_mode" = "real" ]; then
        echo -e "${GREEN}Real AWS Mode Active${NC}"
        echo "- Uses real AWS services"
        echo "- Requires valid AWS credentials"
        echo "- Will incur AWS costs"
    else
        echo -e "${RED}Unknown Mode${NC}"
        echo "- Configuration may be incomplete"
    fi
    
    echo ""
    echo "Configuration file: $ENV_FILE"
}

switch_to_mock() {
    log_info "Switching to mock AWS services mode..."
    
    # Update AWS_MOCK_MODE
    if grep -q "^AWS_MOCK_MODE=" "$ENV_FILE"; then
        sed -i.bak 's/^AWS_MOCK_MODE=.*/AWS_MOCK_MODE=true/' "$ENV_FILE"
    else
        echo "AWS_MOCK_MODE=true" >> "$ENV_FILE"
    fi
    
    # Set LocalStack endpoints for mock mode
    if ! grep -q "^DYNAMODB_ENDPOINT=" "$ENV_FILE"; then
        echo "DYNAMODB_ENDPOINT=http://localhost:4566" >> "$ENV_FILE"
    fi
    if ! grep -q "^KINESIS_ENDPOINT=" "$ENV_FILE"; then
        echo "KINESIS_ENDPOINT=http://localhost:4566" >> "$ENV_FILE"
    fi
    if ! grep -q "^S3_ENDPOINT=" "$ENV_FILE"; then
        echo "S3_ENDPOINT=http://localhost:4566" >> "$ENV_FILE"
    fi
    if ! grep -q "^SQS_ENDPOINT=" "$ENV_FILE"; then
        echo "SQS_ENDPOINT=http://localhost:4566" >> "$ENV_FILE"
    fi
    
    log_info "✅ Switched to mock mode"
    log_warn "Note: This mode uses embedded/LocalStack services for testing"
}

switch_to_real() {
    log_info "Switching to real AWS services mode..."
    
    # Check if real AWS credentials are configured
    local aws_key=$(grep "^AWS_ACCESS_KEY_ID=" "$ENV_FILE" | cut -d'=' -f2)
    local aws_secret=$(grep "^AWS_SECRET_ACCESS_KEY=" "$ENV_FILE" | cut -d'=' -f2)
    
    if [ "$aws_key" = "test" ] || [ "$aws_secret" = "test" ] || [ -z "$aws_key" ] || [ -z "$aws_secret" ]; then
        log_error "Real AWS credentials not configured!"
        log_error "Please update AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in $ENV_FILE"
        log_error "See REAL_PRODUCTION_CONFIG.md for detailed setup instructions"
        exit 1
    fi
    
    # Update AWS_MOCK_MODE
    if grep -q "^AWS_MOCK_MODE=" "$ENV_FILE"; then
        sed -i.bak 's/^AWS_MOCK_MODE=.*/AWS_MOCK_MODE=false/' "$ENV_FILE"
    else
        echo "AWS_MOCK_MODE=false" >> "$ENV_FILE"
    fi
    
    # Remove LocalStack endpoints for real AWS
    sed -i.bak '/^DYNAMODB_ENDPOINT=/d' "$ENV_FILE"
    sed -i.bak '/^KINESIS_ENDPOINT=/d' "$ENV_FILE"
    sed -i.bak '/^S3_ENDPOINT=/d' "$ENV_FILE"
    sed -i.bak '/^SQS_ENDPOINT=/d' "$ENV_FILE"
    
    log_info "✅ Switched to real AWS mode"
    log_warn "Note: This mode will use real AWS services and incur costs"
    log_warn "Ensure all AWS resources are provisioned before starting the application"
}

main() {
    local mode=${1:-status}
    
    case $mode in
        mock)
            switch_to_mock
            show_status
            ;;
        real)
            switch_to_real
            show_status
            ;;
        status)
            show_status
            ;;
        -h|--help)
            show_help
            ;;
        *)
            log_error "Unknown mode: $mode"
            show_help
            exit 1
            ;;
    esac
}

main "$@"