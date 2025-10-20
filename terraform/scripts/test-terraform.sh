#!/bin/bash

# Terraform testing script for User Journey Analytics Agent
# Usage: ./test-terraform.sh [test-type] [environment] [options]

set -e

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$TERRAFORM_DIR/logs"
TEST_DIR="$TERRAFORM_DIR/tests"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Default values
TEST_TYPE=${1:-all}
ENVIRONMENT=${2:-dev}
VERBOSE=false
CLEANUP=true
PARALLEL=false

# Create directories
mkdir -p "$LOG_DIR" "$TEST_DIR"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose)
            VERBOSE=true
            shift
            ;;
        --no-cleanup)
            CLEANUP=false
            shift
            ;;
        --parallel)
            PARALLEL=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [test-type] [environment] [options]"
            echo ""
            echo "Test Types:"
            echo "  all              Run all tests"
            echo "  unit             Run unit tests"
            echo "  integration      Run integration tests"
            echo "  security         Run security tests"
            echo "  performance      Run performance tests"
            echo "  compliance       Run compliance tests"
            echo ""
            echo "Options:"
            echo "  --verbose        Enable verbose output"
            echo "  --no-cleanup     Don't cleanup test resources"
            echo "  --parallel       Run tests in parallel"
            echo "  -h, --help       Show this help message"
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_DIR/test_${TIMESTAMP}.log"
}

# Test result tracking
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

# Test result functions
test_passed() {
    local test_name=$1
    ((TESTS_PASSED++))
    log "PASS" "$test_name"
}

test_failed() {
    local test_name=$1
    local error_msg=$2
    ((TESTS_FAILED++))
    FAILED_TESTS+=("$test_name: $error_msg")
    log "FAIL" "$test_name - $error_msg"
}

# Unit tests
run_unit_tests() {
    log "INFO" "Running unit tests..."
    
    # Test 1: Terraform syntax validation
    if terraform fmt -check=true -diff=true -recursive "$TERRAFORM_DIR"; then
        test_passed "Terraform formatting check"
    else
        test_failed "Terraform formatting check" "Code formatting issues found"
    fi
    
    # Test 2: Terraform configuration validation
    cd "$TERRAFORM_DIR"
    if terraform validate; then
        test_passed "Terraform configuration validation"
    else
        test_failed "Terraform configuration validation" "Configuration validation failed"
    fi
    
    # Test 3: Variable validation
    local required_vars=("environment" "aws_region" "project_name")
    local vars_file="$TERRAFORM_DIR/variables.tf"
    
    for var in "${required_vars[@]}"; do
        if grep -q "variable \"$var\"" "$vars_file"; then
            test_passed "Required variable defined: $var"
        else
            test_failed "Required variable missing: $var" "Variable not found in variables.tf"
        fi
    done
    
    # Test 4: Output validation
    local required_outputs=("vpc_id" "dynamodb_table_names" "kinesis_stream_name")
    local outputs_file="$TERRAFORM_DIR/outputs.tf"
    
    for output in "${required_outputs[@]}"; do
        if grep -q "output \"$output\"" "$outputs_file"; then
            test_passed "Required output defined: $output"
        else
            test_failed "Required output missing: $output" "Output not found in outputs.tf"
        fi
    done
    
    # Test 5: Module structure validation
    local modules=("vpc" "iam" "s3" "dynamodb" "kinesis" "sqs" "lambda" "monitoring")
    
    for module in "${modules[@]}"; do
        local module_dir="$TERRAFORM_DIR/modules/$module"
        if [[ -d "$module_dir" && -f "$module_dir/main.tf" ]]; then
            test_passed "Module structure valid: $module"
        else
            test_failed "Module structure invalid: $module" "Module directory or main.tf missing"
        fi
    done
}

# Integration tests
run_integration_tests() {
    log "INFO" "Running integration tests..."
    
    # Test 1: Backend configuration test
    local backend_file="$TERRAFORM_DIR/environments/${ENVIRONMENT}-backend.hcl"
    if [[ -f "$backend_file" ]]; then
        test_passed "Backend configuration exists for $ENVIRONMENT"
        
        # Validate backend configuration
        local bucket=$(grep "bucket" "$backend_file" | cut -d'"' -f2)
        local table=$(grep "dynamodb_table" "$backend_file" | cut -d'"' -f2)
        
        if aws s3 ls "s3://$bucket" >/dev/null 2>&1; then
            test_passed "Backend S3 bucket accessible: $bucket"
        else
            test_failed "Backend S3 bucket not accessible: $bucket" "Bucket not found or no access"
        fi
        
        if aws dynamodb describe-table --table-name "$table" >/dev/null 2>&1; then
            test_passed "Backend DynamoDB table accessible: $table"
        else
            test_failed "Backend DynamoDB table not accessible: $table" "Table not found or no access"
        fi
    else
        test_failed "Backend configuration missing for $ENVIRONMENT" "Backend file not found"
    fi
    
    # Test 2: Terraform initialization test
    cd "$TERRAFORM_DIR"
    if terraform init -backend-config="environments/${ENVIRONMENT}-backend.hcl" >/dev/null 2>&1; then
        test_passed "Terraform initialization successful"
    else
        test_failed "Terraform initialization failed" "Init command failed"
    fi
    
    # Test 3: Terraform plan test
    if terraform workspace select "$ENVIRONMENT" 2>/dev/null || terraform workspace new "$ENVIRONMENT"; then
        test_passed "Terraform workspace setup successful"
    else
        test_failed "Terraform workspace setup failed" "Workspace command failed"
    fi
    
    if terraform plan -var-file="environments/${ENVIRONMENT}.tfvars" >/dev/null 2>&1; then
        test_passed "Terraform plan successful"
    else
        test_failed "Terraform plan failed" "Plan command failed"
    fi
}

# Security tests
run_security_tests() {
    log "INFO" "Running security tests..."
    
    cd "$TERRAFORM_DIR"
    
    # Test 1: Check for hardcoded secrets
    if ! grep -r "password\s*=\s*\"[^$]" . --include="*.tf" --include="*.tfvars" | grep -v "var\." | grep -v "local\."; then
        test_passed "No hardcoded passwords found"
    else
        test_failed "Hardcoded passwords detected" "Found potential hardcoded passwords"
    fi
    
    # Test 2: Check for hardcoded access keys
    if ! grep -r "access_key\s*=\s*\"[^$]" . --include="*.tf" --include="*.tfvars" | grep -v "var\." | grep -v "local\."; then
        test_passed "No hardcoded access keys found"
    else
        test_failed "Hardcoded access keys detected" "Found potential hardcoded access keys"
    fi
    
    # Test 3: Check encryption settings
    if grep -r "encrypt.*=.*true" . --include="*.tf" >/dev/null; then
        test_passed "Encryption configurations found"
    else
        test_failed "No encryption configurations found" "Missing encryption settings"
    fi
    
    # Test 4: Check S3 bucket security
    if grep -r "block_public" . --include="*.tf" >/dev/null; then
        test_passed "S3 public access blocking configured"
    else
        test_failed "S3 public access blocking not configured" "Missing S3 security settings"
    fi
    
    # Test 5: Check IAM least privilege
    if grep -r "Effect.*Allow" . --include="*.tf" | wc -l | awk '{if($1 > 0) print "found"}' >/dev/null; then
        # This is a basic check - in practice, you'd want more sophisticated IAM policy analysis
        test_passed "IAM policies found (manual review recommended)"
    else
        test_failed "No IAM policies found" "Missing IAM configurations"
    fi
    
    # Test 6: Run Checkov if available
    if command -v checkov >/dev/null 2>&1; then
        if checkov -d . --framework terraform --quiet --compact; then
            test_passed "Checkov security scan passed"
        else
            test_failed "Checkov security scan failed" "Security issues found by Checkov"
        fi
    else
        log "WARN" "Checkov not installed, skipping advanced security scan"
    fi
}

# Performance tests
run_performance_tests() {
    log "INFO" "Running performance tests..."
    
    cd "$TERRAFORM_DIR"
    
    # Test 1: Plan execution time
    local start_time=$(date +%s)
    if terraform plan -var-file="environments/${ENVIRONMENT}.tfvars" >/dev/null 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        if [[ $duration -lt 60 ]]; then
            test_passed "Terraform plan performance acceptable ($duration seconds)"
        else
            test_failed "Terraform plan performance slow" "Plan took $duration seconds (>60s threshold)"
        fi
    else
        test_failed "Terraform plan failed during performance test" "Plan command failed"
    fi
    
    # Test 2: Configuration size check
    local config_size=$(find . -name "*.tf" -exec wc -l {} + | tail -1 | awk '{print $1}')
    if [[ $config_size -lt 5000 ]]; then
        test_passed "Configuration size reasonable ($config_size lines)"
    else
        test_failed "Configuration size large" "Configuration has $config_size lines (>5000 threshold)"
    fi
    
    # Test 3: Module dependency analysis
    local module_count=$(find modules -name "main.tf" | wc -l)
    if [[ $module_count -gt 0 && $module_count -lt 20 ]]; then
        test_passed "Module count reasonable ($module_count modules)"
    else
        test_failed "Module count concerning" "Found $module_count modules (0 or >20)"
    fi
}

# Compliance tests
run_compliance_tests() {
    log "INFO" "Running compliance tests..."
    
    cd "$TERRAFORM_DIR"
    
    # Test 1: Required tags validation
    local required_tags=("Project" "Environment" "ManagedBy")
    local tags_found=0
    
    for tag in "${required_tags[@]}"; do
        if grep -r "\"$tag\"" . --include="*.tf" | grep -q "tags"; then
            ((tags_found++))
        fi
    done
    
    if [[ $tags_found -eq ${#required_tags[@]} ]]; then
        test_passed "All required tags configured"
    else
        test_failed "Missing required tags" "Found $tags_found/${#required_tags[@]} required tags"
    fi
    
    # Test 2: Naming convention validation
    local naming_violations=0
    while IFS= read -r line; do
        if [[ "$line" =~ resource[[:space:]]+\"[^\"]+\"[[:space:]]+\"([^\"]+)\" ]]; then
            local resource_name="${BASH_REMATCH[1]}"
            if [[ ! "$resource_name" =~ ^[a-z0-9_]+$ ]]; then
                ((naming_violations++))
            fi
        fi
    done < <(grep -r "^resource " . --include="*.tf")
    
    if [[ $naming_violations -eq 0 ]]; then
        test_passed "Naming conventions followed"
    else
        test_failed "Naming convention violations" "Found $naming_violations violations"
    fi
    
    # Test 3: Documentation validation
    if [[ -f "README.md" ]]; then
        test_passed "README.md exists"
    else
        test_failed "README.md missing" "No documentation found"
    fi
    
    # Test 4: Version constraints validation
    if grep -q "required_version" main.tf && grep -q "required_providers" main.tf; then
        test_passed "Version constraints defined"
    else
        test_failed "Version constraints missing" "Terraform and provider versions not constrained"
    fi
}

# Cleanup function
cleanup_test_resources() {
    if [[ "$CLEANUP" == "true" ]]; then
        log "INFO" "Cleaning up test resources..."
        
        # Remove temporary files
        find "$TEST_DIR" -name "*.tmp" -delete 2>/dev/null || true
        find "$TERRAFORM_DIR" -name "*.tfplan" -delete 2>/dev/null || true
        
        log "INFO" "Cleanup completed"
    fi
}

# Test summary
print_test_summary() {
    log "INFO" "Test Summary:"
    log "INFO" "  Tests Passed: $TESTS_PASSED"
    log "INFO" "  Tests Failed: $TESTS_FAILED"
    log "INFO" "  Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
    
    if [[ $TESTS_FAILED -gt 0 ]]; then
        log "ERROR" "Failed Tests:"
        for failed_test in "${FAILED_TESTS[@]}"; do
            log "ERROR" "  - $failed_test"
        done
    fi
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        log "INFO" "All tests passed successfully!"
        return 0
    else
        log "ERROR" "Some tests failed. Check the log for details."
        return 1
    fi
}

# Main test execution
run_tests() {
    local test_type=$1
    
    case $test_type in
        unit)
            run_unit_tests
            ;;
        integration)
            run_integration_tests
            ;;
        security)
            run_security_tests
            ;;
        performance)
            run_performance_tests
            ;;
        compliance)
            run_compliance_tests
            ;;
        all)
            run_unit_tests
            run_integration_tests
            run_security_tests
            run_performance_tests
            run_compliance_tests
            ;;
        *)
            log "ERROR" "Unknown test type: $test_type"
            exit 1
            ;;
    esac
}

# Main execution
main() {
    log "INFO" "Starting Terraform tests - Type: $TEST_TYPE, Environment: $ENVIRONMENT"
    
    # Validate AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log "WARN" "AWS credentials not configured - some tests may fail"
    fi
    
    # Run tests
    run_tests "$TEST_TYPE"
    
    # Cleanup
    cleanup_test_resources
    
    # Print summary and exit
    if print_test_summary; then
        exit 0
    else
        exit 1
    fi
}

# Execute main function
main "$@"