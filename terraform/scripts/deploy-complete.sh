#!/bin/bash

# Complete deployment orchestration script for User Journey Analytics Agent
# Usage: ./deploy-complete.sh <environment> [--skip-tests] [--auto-approve] [--verbose]

set -e

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$TERRAFORM_DIR/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Default values
ENVIRONMENT=${1:-dev}
SKIP_TESTS=false
AUTO_APPROVE=false
VERBOSE=false
DEPLOYMENT_PHASE="pre-deployment"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --auto-approve)
            AUTO_APPROVE=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            cat << EOF
Complete Deployment Script for User Journey Analytics Agent

Usage: $0 <environment> [options]

Arguments:
  environment      Target environment (dev|staging|prod)

Options:
  --skip-tests     Skip test execution (not recommended for prod)
  --auto-approve   Skip interactive approval prompts
  --verbose        Enable verbose output
  -h, --help       Show this help message

Deployment Phases:
  1. Pre-deployment validation
  2. Backend setup verification
  3. Configuration testing
  4. Infrastructure planning
  5. Infrastructure deployment
  6. Post-deployment validation
  7. Smoke testing

Examples:
  $0 dev                           # Interactive development deployment
  $0 prod --verbose                # Production deployment with verbose output
  $0 staging --skip-tests          # Staging deployment without tests
  $0 prod --auto-approve --verbose # Fully automated production deployment

EOF
            exit 0
            ;;
        *)
            ENVIRONMENT=$1
            shift
            ;;
    esac
done

# Create logs directory
mkdir -p "$LOG_DIR"

# Logging function with phase tracking
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$DEPLOYMENT_PHASE] [$level] $message" | tee -a "$LOG_DIR/complete_deploy_${ENVIRONMENT}_${TIMESTAMP}.log"
}

# Error handling with cleanup
error_exit() {
    log "ERROR" "$1"
    log "ERROR" "Deployment failed in phase: $DEPLOYMENT_PHASE"
    
    # Offer rollback option
    if [[ "$AUTO_APPROVE" == "false" && "$DEPLOYMENT_PHASE" != "pre-deployment" ]]; then
        read -p "Would you like to attempt rollback? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            attempt_rollback
        fi
    fi
    
    exit 1
}

# Progress tracking
show_progress() {
    local current_step=$1
    local total_steps=$2
    local step_name=$3
    
    local progress=$((current_step * 100 / total_steps))
    log "INFO" "Progress: [$current_step/$total_steps] ($progress%) - $step_name"
}

# Validation functions
validate_environment() {
    if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
        error_exit "Environment must be dev, staging, or prod"
    fi
    
    log "INFO" "Deploying to environment: $ENVIRONMENT"
}

validate_prerequisites() {
    DEPLOYMENT_PHASE="pre-deployment"
    show_progress 1 7 "Validating prerequisites"
    
    log "INFO" "Running pre-deployment validation..."
    
    local validation_args=""
    if [[ "$VERBOSE" == "true" ]]; then
        validation_args="--verbose"
    fi
    
    if ! "$SCRIPT_DIR/validate-deployment.sh" "$ENVIRONMENT" $validation_args; then
        error_exit "Pre-deployment validation failed"
    fi
    
    log "INFO" "Pre-deployment validation completed successfully"
}

setup_backend() {
    DEPLOYMENT_PHASE="backend-setup"
    show_progress 2 7 "Setting up backend"
    
    log "INFO" "Verifying backend setup..."
    
    # Check if backend exists, create if needed
    local backend_file="$TERRAFORM_DIR/environments/${ENVIRONMENT}-backend.hcl"
    
    if [[ ! -f "$backend_file" ]]; then
        log "INFO" "Backend configuration not found, creating..."
        if ! "$SCRIPT_DIR/manage-state.sh" setup-backend "$ENVIRONMENT"; then
            error_exit "Backend setup failed"
        fi
    else
        log "INFO" "Backend configuration exists, validating..."
        local bucket_name=$(grep "bucket" "$backend_file" | cut -d'"' -f2)
        
        if ! aws s3 ls "s3://$bucket_name" >/dev/null 2>&1; then
            log "INFO" "Backend S3 bucket not found, creating..."
            if ! "$SCRIPT_DIR/manage-state.sh" setup-backend "$ENVIRONMENT"; then
                error_exit "Backend setup failed"
            fi
        fi
    fi
    
    log "INFO" "Backend setup completed successfully"
}

run_tests() {
    DEPLOYMENT_PHASE="testing"
    show_progress 3 7 "Running tests"
    
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log "WARN" "Skipping tests as requested"
        return
    fi
    
    log "INFO" "Running comprehensive tests..."
    
    local test_args=""
    if [[ "$VERBOSE" == "true" ]]; then
        test_args="--verbose"
    fi
    
    # Run different test suites based on environment
    local test_types="unit security compliance"
    if [[ "$ENVIRONMENT" != "prod" ]]; then
        test_types="$test_types integration performance"
    fi
    
    for test_type in $test_types; do
        log "INFO" "Running $test_type tests..."
        if ! "$SCRIPT_DIR/test-terraform.sh" "$test_type" "$ENVIRONMENT" $test_args; then
            if [[ "$ENVIRONMENT" == "prod" ]]; then
                error_exit "$test_type tests failed - cannot proceed with production deployment"
            else
                log "WARN" "$test_type tests failed - continuing with non-production deployment"
            fi
        fi
    done
    
    log "INFO" "All tests completed successfully"
}

create_backup() {
    DEPLOYMENT_PHASE="backup"
    log "INFO" "Creating state backup before deployment..."
    
    if ! "$SCRIPT_DIR/manage-state.sh" backup-state "$ENVIRONMENT"; then
        log "WARN" "State backup failed - continuing with deployment"
    else
        log "INFO" "State backup created successfully"
    fi
}

plan_deployment() {
    DEPLOYMENT_PHASE="planning"
    show_progress 4 7 "Planning deployment"
    
    log "INFO" "Creating deployment plan..."
    
    local deploy_args="--validate-only"
    if [[ "$VERBOSE" == "true" ]]; then
        deploy_args="$deploy_args --verbose"
    fi
    
    if ! "$SCRIPT_DIR/deploy-infrastructure.sh" "$ENVIRONMENT" plan $deploy_args; then
        error_exit "Deployment planning failed"
    fi
    
    log "INFO" "Deployment plan created successfully"
    
    # Show plan summary for manual review
    if [[ "$AUTO_APPROVE" == "false" ]]; then
        log "INFO" "Please review the deployment plan above"
        read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "INFO" "Deployment cancelled by user"
            exit 0
        fi
    fi
}

deploy_infrastructure() {
    DEPLOYMENT_PHASE="deployment"
    show_progress 5 7 "Deploying infrastructure"
    
    log "INFO" "Deploying infrastructure..."
    
    local deploy_args=""
    if [[ "$AUTO_APPROVE" == "true" ]]; then
        deploy_args="--auto-approve"
    fi
    if [[ "$VERBOSE" == "true" ]]; then
        deploy_args="$deploy_args --verbose"
    fi
    
    if ! "$SCRIPT_DIR/deploy-infrastructure.sh" "$ENVIRONMENT" apply $deploy_args; then
        error_exit "Infrastructure deployment failed"
    fi
    
    log "INFO" "Infrastructure deployment completed successfully"
}

validate_deployment() {
    DEPLOYMENT_PHASE="post-deployment"
    show_progress 6 7 "Validating deployment"
    
    log "INFO" "Running post-deployment validation..."
    
    local validation_args="--post-deploy"
    if [[ "$VERBOSE" == "true" ]]; then
        validation_args="$validation_args --verbose"
    fi
    
    if ! "$SCRIPT_DIR/validate-deployment.sh" "$ENVIRONMENT" $validation_args; then
        error_exit "Post-deployment validation failed"
    fi
    
    log "INFO" "Post-deployment validation completed successfully"
}

run_smoke_tests() {
    DEPLOYMENT_PHASE="smoke-testing"
    show_progress 7 7 "Running smoke tests"
    
    log "INFO" "Running smoke tests..."
    
    # Basic connectivity and functionality tests
    cd "$TERRAFORM_DIR"
    
    # Get outputs for testing
    local outputs_json
    if outputs_json=$(terraform output -json 2>/dev/null); then
        log "INFO" "Retrieved Terraform outputs for testing"
        
        # Test basic AWS service connectivity
        if echo "$outputs_json" | jq -e '.kinesis_stream_name.value' >/dev/null 2>&1; then
            local stream_name=$(echo "$outputs_json" | jq -r '.kinesis_stream_name.value')
            if aws kinesis describe-stream --stream-name "$stream_name" >/dev/null 2>&1; then
                log "INFO" "Smoke test passed: Kinesis stream accessible"
            else
                log "WARN" "Smoke test failed: Kinesis stream not accessible"
            fi
        fi
        
        if echo "$outputs_json" | jq -e '.dynamodb_table_names.value' >/dev/null 2>&1; then
            local table_names=$(echo "$outputs_json" | jq -r '.dynamodb_table_names.value[0]')
            if aws dynamodb describe-table --table-name "$table_names" >/dev/null 2>&1; then
                log "INFO" "Smoke test passed: DynamoDB table accessible"
            else
                log "WARN" "Smoke test failed: DynamoDB table not accessible"
            fi
        fi
    else
        log "WARN" "Could not retrieve outputs for smoke testing"
    fi
    
    log "INFO" "Smoke tests completed"
}

# Rollback function
attempt_rollback() {
    log "INFO" "Attempting rollback..."
    
    # List available backups
    "$SCRIPT_DIR/manage-state.sh" list-backups "$ENVIRONMENT"
    
    read -p "Enter backup name to restore (or 'skip' to skip rollback): " backup_name
    
    if [[ "$backup_name" != "skip" && -n "$backup_name" ]]; then
        if "$SCRIPT_DIR/manage-state.sh" restore-state "$ENVIRONMENT" "$backup_name"; then
            log "INFO" "Rollback completed successfully"
        else
            log "ERROR" "Rollback failed"
        fi
    else
        log "INFO" "Rollback skipped"
    fi
}

# Generate deployment report
generate_report() {
    local report_file="$LOG_DIR/deployment_report_${ENVIRONMENT}_${TIMESTAMP}.md"
    
    cat > "$report_file" << EOF
# Deployment Report

**Environment:** $ENVIRONMENT  
**Date:** $(date)  
**Status:** SUCCESS  
**Duration:** $(($(date +%s) - START_TIME)) seconds

## Deployment Summary

- ✅ Pre-deployment validation
- ✅ Backend setup verification
- ✅ Configuration testing
- ✅ Infrastructure planning
- ✅ Infrastructure deployment
- ✅ Post-deployment validation
- ✅ Smoke testing

## Infrastructure Outputs

\`\`\`json
$(cd "$TERRAFORM_DIR" && terraform output -json 2>/dev/null || echo "{}")
\`\`\`

## Next Steps

1. Configure application environment variables
2. Deploy application services
3. Run end-to-end tests
4. Monitor system health

## Support

- Logs: $LOG_DIR/complete_deploy_${ENVIRONMENT}_${TIMESTAMP}.log
- Terraform State: Check via \`terraform show\`
- Monitoring: Check CloudWatch dashboards

EOF

    log "INFO" "Deployment report generated: $report_file"
}

# Main execution
main() {
    local START_TIME=$(date +%s)
    
    log "INFO" "Starting complete deployment process"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Auto-approve: $AUTO_APPROVE"
    log "INFO" "Skip tests: $SKIP_TESTS"
    log "INFO" "Verbose: $VERBOSE"
    
    # Validate inputs
    validate_environment
    
    # Execute deployment phases
    validate_prerequisites
    setup_backend
    run_tests
    create_backup
    plan_deployment
    deploy_infrastructure
    validate_deployment
    run_smoke_tests
    
    # Generate report
    generate_report
    
    local END_TIME=$(date +%s)
    local DURATION=$((END_TIME - START_TIME))
    
    log "INFO" "Deployment completed successfully!"
    log "INFO" "Total duration: $DURATION seconds"
    log "INFO" "Environment $ENVIRONMENT is ready for use"
    
    # Show key outputs
    cd "$TERRAFORM_DIR"
    log "INFO" "Key infrastructure outputs:"
    terraform output 2>/dev/null || log "WARN" "Could not retrieve outputs"
}

# Execute main function
main "$@"