#!/bin/bash

# User Journey Analytics Agent - Monitoring Health Check Script
# This script performs comprehensive health checks on all monitoring components

set -e

# Configuration
PROJECT_NAME="user-journey-analytics"
ENVIRONMENT="${1:-dev}"
AWS_REGION="${2:-us-east-1}"
NAMESPACE="UserJourneyAnalytics"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if AWS CLI is configured
check_aws_cli() {
    log_info "Checking AWS CLI configuration..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS CLI is not configured or credentials are invalid"
        exit 1
    fi
    
    log_info "AWS CLI is properly configured"
}

# Check CloudWatch dashboards
check_dashboards() {
    log_info "Checking CloudWatch dashboards..."
    
    local dashboards=(
        "${PROJECT_NAME}-system-health-${ENVIRONMENT}"
        "${PROJECT_NAME}-ai-services-${ENVIRONMENT}"
        "${PROJECT_NAME}-performance-${ENVIRONMENT}"
        "${PROJECT_NAME}-cost-monitoring-${ENVIRONMENT}"
        "${PROJECT_NAME}-distributed-tracing-${ENVIRONMENT}"
    )
    
    local missing_dashboards=()
    
    for dashboard in "${dashboards[@]}"; do
        if aws cloudwatch get-dashboard --dashboard-name "$dashboard" --region "$AWS_REGION" &> /dev/null; then
            log_info "✓ Dashboard '$dashboard' exists"
        else
            log_error "✗ Dashboard '$dashboard' is missing"
            missing_dashboards+=("$dashboard")
        fi
    done
    
    if [ ${#missing_dashboards[@]} -eq 0 ]; then
        log_info "All dashboards are configured correctly"
        return 0
    else
        log_error "Missing dashboards: ${missing_dashboards[*]}"
        return 1
    fi
}

# Check CloudWatch alarms
check_alarms() {
    log_info "Checking CloudWatch alarms..."
    
    local expected_alarms=(
        "${PROJECT_NAME}-event-processor-errors-${ENVIRONMENT}"
        "${PROJECT_NAME}-event-processor-duration-${ENVIRONMENT}"
        "${PROJECT_NAME}-ai-service-errors-${ENVIRONMENT}"
        "${PROJECT_NAME}-high-processing-latency-${ENVIRONMENT}"
        "${PROJECT_NAME}-kinesis-iterator-age-${ENVIRONMENT}"
    )
    
    local missing_alarms=()
    local alarm_states=()
    
    for alarm in "${expected_alarms[@]}"; do
        local alarm_info=$(aws cloudwatch describe-alarms --alarm-names "$alarm" --region "$AWS_REGION" --query 'MetricAlarms[0].[AlarmName,StateValue]' --output text 2>/dev/null)
        
        if [ -n "$alarm_info" ]; then
            local alarm_name=$(echo "$alarm_info" | cut -f1)
            local alarm_state=$(echo "$alarm_info" | cut -f2)
            
            log_info "✓ Alarm '$alarm_name' exists (State: $alarm_state)"
            
            if [ "$alarm_state" = "ALARM" ]; then
                log_warn "⚠ Alarm '$alarm_name' is in ALARM state"
                alarm_states+=("$alarm_name:ALARM")
            fi
        else
            log_error "✗ Alarm '$alarm' is missing"
            missing_alarms+=("$alarm")
        fi
    done
    
    if [ ${#missing_alarms[@]} -eq 0 ]; then
        log_info "All alarms are configured correctly"
        
        if [ ${#alarm_states[@]} -gt 0 ]; then
            log_warn "Some alarms are in ALARM state: ${alarm_states[*]}"
            return 2
        fi
        return 0
    else
        log_error "Missing alarms: ${missing_alarms[*]}"
        return 1
    fi
}

# Check custom metrics
check_custom_metrics() {
    log_info "Checking custom metrics..."
    
    local expected_metrics=(
        "UserEventsProcessed"
        "StruggleSignalsDetected"
        "InterventionsExecuted"
        "AIServiceErrors"
        "BedrockInvocations"
        "DataProcessingLatency"
    )
    
    local missing_metrics=()
    
    for metric in "${expected_metrics[@]}"; do
        local metric_exists=$(aws cloudwatch list-metrics --namespace "$NAMESPACE" --metric-name "$metric" --region "$AWS_REGION" --query 'Metrics[0].MetricName' --output text 2>/dev/null)
        
        if [ "$metric_exists" = "$metric" ]; then
            log_info "✓ Custom metric '$metric' exists"
        else
            log_warn "⚠ Custom metric '$metric' not found (may not have data yet)"
            missing_metrics+=("$metric")
        fi
    done
    
    if [ ${#missing_metrics[@]} -eq 0 ]; then
        log_info "All custom metrics are available"
        return 0
    else
        log_warn "Metrics without recent data: ${missing_metrics[*]}"
        return 2
    fi
}

# Check X-Ray tracing
check_xray_tracing() {
    log_info "Checking X-Ray tracing configuration..."
    
    local sampling_rules=$(aws xray get-sampling-rules --region "$AWS_REGION" --query "SamplingRuleRecords[?SamplingRule.RuleName=='${PROJECT_NAME}-sampling-${ENVIRONMENT}'].SamplingRule.RuleName" --output text 2>/dev/null)
    
    if [ -n "$sampling_rules" ]; then
        log_info "✓ X-Ray sampling rules are configured"
    else
        log_error "✗ X-Ray sampling rules are missing"
        return 1
    fi
    
    # Check for recent traces
    local end_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local start_time=$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)
    
    local trace_count=$(aws xray get-trace-summaries --time-range-type TimeRangeByStartTime --start-time "$start_time" --end-time "$end_time" --region "$AWS_REGION" --query 'length(TraceSummaries)' --output text 2>/dev/null || echo "0")
    
    if [ "$trace_count" -gt 0 ]; then
        log_info "✓ X-Ray traces are being generated ($trace_count traces in last hour)"
    else
        log_warn "⚠ No X-Ray traces found in the last hour (system may be idle)"
    fi
    
    return 0
}

# Check log groups and retention
check_log_groups() {
    log_info "Checking CloudWatch log groups..."
    
    local expected_log_groups=(
        "/aws/lambda/${PROJECT_NAME}-event-processor-${ENVIRONMENT}"
        "/aws/lambda/${PROJECT_NAME}-struggle-detector-${ENVIRONMENT}"
        "/aws/lambda/${PROJECT_NAME}-video-analyzer-${ENVIRONMENT}"
        "/aws/lambda/${PROJECT_NAME}-intervention-executor-${ENVIRONMENT}"
        "/aws/lambda/${PROJECT_NAME}-log-analyzer-${ENVIRONMENT}"
    )
    
    local missing_log_groups=()
    
    for log_group in "${expected_log_groups[@]}"; do
        local log_group_info=$(aws logs describe-log-groups --log-group-name-prefix "$log_group" --region "$AWS_REGION" --query "logGroups[?logGroupName=='$log_group'].[logGroupName,retentionInDays]" --output text 2>/dev/null)
        
        if [ -n "$log_group_info" ]; then
            local retention=$(echo "$log_group_info" | cut -f2)
            log_info "✓ Log group '$log_group' exists (Retention: ${retention:-unlimited} days)"
        else
            log_error "✗ Log group '$log_group' is missing"
            missing_log_groups+=("$log_group")
        fi
    done
    
    if [ ${#missing_log_groups[@]} -eq 0 ]; then
        log_info "All log groups are configured correctly"
        return 0
    else
        log_error "Missing log groups: ${missing_log_groups[*]}"
        return 1
    fi
}

# Check SNS topics for alerting
check_sns_topics() {
    log_info "Checking SNS topics for alerting..."
    
    local alert_topic_arn=$(aws sns list-topics --region "$AWS_REGION" --query "Topics[?contains(TopicArn, '${PROJECT_NAME}-alerts-${ENVIRONMENT}')].TopicArn" --output text 2>/dev/null)
    
    if [ -n "$alert_topic_arn" ]; then
        log_info "✓ SNS alert topic exists: $alert_topic_arn"
        
        # Check subscriptions
        local subscription_count=$(aws sns list-subscriptions-by-topic --topic-arn "$alert_topic_arn" --region "$AWS_REGION" --query 'length(Subscriptions)' --output text 2>/dev/null || echo "0")
        
        if [ "$subscription_count" -gt 0 ]; then
            log_info "✓ SNS topic has $subscription_count subscription(s)"
        else
            log_warn "⚠ SNS topic has no subscriptions - alerts will not be delivered"
        fi
    else
        log_error "✗ SNS alert topic is missing"
        return 1
    fi
    
    return 0
}

# Check cost monitoring
check_cost_monitoring() {
    log_info "Checking cost monitoring configuration..."
    
    # Check if budgets exist
    local budget_name="${PROJECT_NAME}-monthly-budget-${ENVIRONMENT}"
    local budget_exists=$(aws budgets describe-budget --account-id "$(aws sts get-caller-identity --query Account --output text)" --budget-name "$budget_name" --query 'Budget.BudgetName' --output text 2>/dev/null || echo "")
    
    if [ "$budget_exists" = "$budget_name" ]; then
        log_info "✓ Cost budget '$budget_name' is configured"
    else
        log_warn "⚠ Cost budget '$budget_name' is missing"
    fi
    
    # Check cost anomaly detection
    local anomaly_detectors=$(aws ce get-anomaly-detectors --query "AnomalyDetectors[?AnomalyDetectorArn contains '${PROJECT_NAME}']" --output text 2>/dev/null || echo "")
    
    if [ -n "$anomaly_detectors" ]; then
        log_info "✓ Cost anomaly detection is configured"
    else
        log_warn "⚠ Cost anomaly detection is not configured"
    fi
    
    return 0
}

# Generate health report
generate_health_report() {
    local timestamp=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
    local report_file="monitoring-health-report-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).txt"
    
    log_info "Generating health report: $report_file"
    
    cat > "$report_file" << EOF
User Journey Analytics Agent - Monitoring Health Report
Environment: $ENVIRONMENT
Region: $AWS_REGION
Generated: $timestamp

=== HEALTH CHECK RESULTS ===

EOF
    
    # Run all checks and capture results
    local overall_status="HEALTHY"
    
    echo "1. CloudWatch Dashboards:" >> "$report_file"
    if check_dashboards >> "$report_file" 2>&1; then
        echo "   Status: PASS" >> "$report_file"
    else
        echo "   Status: FAIL" >> "$report_file"
        overall_status="UNHEALTHY"
    fi
    echo "" >> "$report_file"
    
    echo "2. CloudWatch Alarms:" >> "$report_file"
    local alarm_result
    check_alarms >> "$report_file" 2>&1
    alarm_result=$?
    if [ $alarm_result -eq 0 ]; then
        echo "   Status: PASS" >> "$report_file"
    elif [ $alarm_result -eq 2 ]; then
        echo "   Status: WARNING (Some alarms in ALARM state)" >> "$report_file"
    else
        echo "   Status: FAIL" >> "$report_file"
        overall_status="UNHEALTHY"
    fi
    echo "" >> "$report_file"
    
    echo "3. Custom Metrics:" >> "$report_file"
    if check_custom_metrics >> "$report_file" 2>&1; then
        echo "   Status: PASS" >> "$report_file"
    else
        echo "   Status: WARNING" >> "$report_file"
    fi
    echo "" >> "$report_file"
    
    echo "4. X-Ray Tracing:" >> "$report_file"
    if check_xray_tracing >> "$report_file" 2>&1; then
        echo "   Status: PASS" >> "$report_file"
    else
        echo "   Status: FAIL" >> "$report_file"
        overall_status="UNHEALTHY"
    fi
    echo "" >> "$report_file"
    
    echo "5. Log Groups:" >> "$report_file"
    if check_log_groups >> "$report_file" 2>&1; then
        echo "   Status: PASS" >> "$report_file"
    else
        echo "   Status: FAIL" >> "$report_file"
        overall_status="UNHEALTHY"
    fi
    echo "" >> "$report_file"
    
    echo "6. SNS Topics:" >> "$report_file"
    if check_sns_topics >> "$report_file" 2>&1; then
        echo "   Status: PASS" >> "$report_file"
    else
        echo "   Status: FAIL" >> "$report_file"
        overall_status="UNHEALTHY"
    fi
    echo "" >> "$report_file"
    
    echo "7. Cost Monitoring:" >> "$report_file"
    if check_cost_monitoring >> "$report_file" 2>&1; then
        echo "   Status: PASS" >> "$report_file"
    else
        echo "   Status: WARNING" >> "$report_file"
    fi
    echo "" >> "$report_file"
    
    echo "=== OVERALL STATUS: $overall_status ===" >> "$report_file"
    
    log_info "Health report generated: $report_file"
    log_info "Overall system status: $overall_status"
    
    if [ "$overall_status" = "UNHEALTHY" ]; then
        return 1
    else
        return 0
    fi
}

# Main execution
main() {
    log_info "Starting monitoring health check for environment: $ENVIRONMENT"
    log_info "AWS Region: $AWS_REGION"
    
    check_aws_cli
    
    local exit_code=0
    
    # Run individual checks
    check_dashboards || exit_code=1
    echo ""
    
    check_alarms || exit_code=1
    echo ""
    
    check_custom_metrics || exit_code=1
    echo ""
    
    check_xray_tracing || exit_code=1
    echo ""
    
    check_log_groups || exit_code=1
    echo ""
    
    check_sns_topics || exit_code=1
    echo ""
    
    check_cost_monitoring || exit_code=1
    echo ""
    
    # Generate comprehensive report
    generate_health_report || exit_code=1
    
    if [ $exit_code -eq 0 ]; then
        log_info "✅ All monitoring components are healthy"
    else
        log_error "❌ Some monitoring components have issues - check the report for details"
    fi
    
    exit $exit_code
}

# Script usage
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [environment] [aws-region]"
    echo ""
    echo "Arguments:"
    echo "  environment  Environment name (default: dev)"
    echo "  aws-region   AWS region (default: us-east-1)"
    echo ""
    echo "Examples:"
    echo "  $0 dev us-east-1"
    echo "  $0 prod us-west-2"
    exit 0
fi

# Run main function
main "$@"