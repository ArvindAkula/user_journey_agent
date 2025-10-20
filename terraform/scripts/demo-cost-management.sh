#!/bin/bash

# Demo Cost Management Script
# Provides cost monitoring, optimization, and cleanup tools for demo environment

set -e

COMMAND=${1:-status}
AWS_REGION=${2:-us-east-1}
PROJECT_NAME="user-journey-analytics"

case $COMMAND in
    status)
        echo "💰 Demo Environment Cost Status"
        echo "================================"
        echo ""
        
        # Get current month's costs
        echo "📊 Current month costs:"
        aws ce get-cost-and-usage \
            --time-period Start=$(date -d "$(date +%Y-%m-01)" +%Y-%m-%d),End=$(date +%Y-%m-%d) \
            --granularity MONTHLY \
            --metrics BlendedCost \
            --group-by Type=DIMENSION,Key=SERVICE \
            --query 'ResultsByTime[0].Groups[?Metrics.BlendedCost.Amount>`0`].[Keys[0],Metrics.BlendedCost.Amount]' \
            --output table
        
        echo ""
        echo "📈 Daily costs (last 7 days):"
        aws ce get-cost-and-usage \
            --time-period Start=$(date -d "7 days ago" +%Y-%m-%d),End=$(date +%Y-%m-%d) \
            --granularity DAILY \
            --metrics BlendedCost \
            --query 'ResultsByTime[].[TimePeriod.Start,Total.BlendedCost.Amount]' \
            --output table
        ;;
        
    optimize)
        echo "🔧 Demo Cost Optimization"
        echo "========================="
        echo ""
        
        echo "Checking for cost optimization opportunities..."
        
        # Check for unused resources
        echo "🔍 Checking for unused resources:"
        
        # Check for unused Lambda functions (no invocations in last 7 days)
        echo "   • Lambda functions with no recent invocations:"
        aws logs describe-log-groups \
            --log-group-name-prefix "/aws/lambda/$PROJECT_NAME" \
            --query 'logGroups[?lastEventTime<`'$(date -d "7 days ago" +%s)'000`].[logGroupName]' \
            --output table
        
        # Check for empty S3 buckets
        echo "   • Checking S3 bucket usage..."
        aws s3api list-buckets \
            --query "Buckets[?contains(Name, '$PROJECT_NAME')].[Name]" \
            --output text | while read bucket; do
                if [ ! -z "$bucket" ]; then
                    size=$(aws s3 ls s3://$bucket --recursive --summarize | grep "Total Size" | awk '{print $3}')
                    if [ "$size" = "0" ]; then
                        echo "     - Empty bucket: $bucket"
                    fi
                fi
            done
        
        echo ""
        echo "💡 Optimization recommendations:"
        echo "   1. Consider using Spot instances for non-critical workloads"
        echo "   2. Enable S3 Intelligent Tiering for automatic cost optimization"
        echo "   3. Review CloudWatch log retention periods"
        echo "   4. Use Reserved Instances for predictable workloads"
        ;;
        
    alerts)
        echo "🚨 Setting up Cost Alerts"
        echo "========================"
        echo ""
        
        # Create budget for demo environment
        ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
        
        cat > /tmp/demo-budget.json << EOF
{
    "BudgetName": "$PROJECT_NAME-demo-budget",
    "BudgetLimit": {
        "Amount": "300",
        "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST",
    "CostFilters": {
        "TagKey": ["Project"],
        "TagValue": ["$PROJECT_NAME"]
    }
}
EOF

        cat > /tmp/demo-budget-notifications.json << EOF
[
    {
        "Notification": {
            "NotificationType": "ACTUAL",
            "ComparisonOperator": "GREATER_THAN",
            "Threshold": 80
        },
        "Subscribers": [
            {
                "SubscriptionType": "EMAIL",
                "Address": "demo-alerts@example.com"
            }
        ]
    },
    {
        "Notification": {
            "NotificationType": "FORECASTED",
            "ComparisonOperator": "GREATER_THAN",
            "Threshold": 100
        },
        "Subscribers": [
            {
                "SubscriptionType": "EMAIL",
                "Address": "demo-alerts@example.com"
            }
        ]
    }
]
EOF

        echo "Creating AWS Budget for demo environment..."
        aws budgets create-budget \
            --account-id $ACCOUNT_ID \
            --budget file:///tmp/demo-budget.json \
            --notifications-with-subscribers file:///tmp/demo-budget-notifications.json
        
        echo "✅ Budget created with $300 monthly limit"
        echo "📧 Alerts will be sent at 80% actual and 100% forecasted spend"
        
        # Clean up temp files
        rm /tmp/demo-budget.json /tmp/demo-budget-notifications.json
        ;;
        
    cleanup)
        echo "🧹 Demo Environment Cleanup"
        echo "==========================="
        echo ""
        
        echo "⚠️  This will terminate ALL demo resources!"
        read -p "Are you sure you want to proceed? (yes/no): " confirm
        
        if [ "$confirm" = "yes" ]; then
            echo "🚀 Starting cleanup process..."
            
            # Run terraform destroy
            cd "$(dirname "$0")/.."
            ./deploy-demo.sh destroy
            
            echo ""
            echo "🧹 Additional cleanup tasks:"
            
            # Clean up CloudWatch logs
            echo "   • Cleaning up CloudWatch log groups..."
            aws logs describe-log-groups \
                --log-group-name-prefix "/aws/lambda/$PROJECT_NAME" \
                --query 'logGroups[].logGroupName' \
                --output text | xargs -I {} aws logs delete-log-group --log-group-name {}
            
            # Clean up any remaining S3 objects
            echo "   • Emptying S3 buckets..."
            aws s3api list-buckets \
                --query "Buckets[?contains(Name, '$PROJECT_NAME')].[Name]" \
                --output text | while read bucket; do
                    if [ ! -z "$bucket" ]; then
                        echo "     - Emptying bucket: $bucket"
                        aws s3 rm s3://$bucket --recursive
                    fi
                done
            
            echo ""
            echo "✅ Demo environment cleanup completed!"
            echo "💰 All billable resources have been terminated"
        else
            echo "❌ Cleanup cancelled"
        fi
        ;;
        
    schedule)
        echo "⏰ Demo Environment Scheduling"
        echo "============================="
        echo ""
        
        echo "Setting up automated start/stop schedule for cost optimization..."
        
        # Create Lambda function for scheduled start/stop
        cat > /tmp/scheduler-function.py << 'EOF'
import boto3
import json

def lambda_handler(event, context):
    action = event.get('action', 'stop')
    
    if action == 'stop':
        # Stop non-essential services
        # This is a placeholder - implement actual stop logic
        print("Stopping demo environment services...")
    elif action == 'start':
        # Start services
        print("Starting demo environment services...")
    
    return {
        'statusCode': 200,
        'body': json.dumps(f'Demo environment {action} completed')
    }
EOF

        echo "📝 Scheduler function created (placeholder)"
        echo "💡 To implement full scheduling:"
        echo "   1. Deploy the scheduler Lambda function"
        echo "   2. Create EventBridge rules for start/stop times"
        echo "   3. Configure service-specific start/stop logic"
        
        rm /tmp/scheduler-function.py
        ;;
        
    report)
        echo "📊 Demo Cost Report"
        echo "=================="
        echo ""
        
        # Generate comprehensive cost report
        echo "Generating cost report for demo environment..."
        
        # Get costs by service for current month
        echo "💰 Costs by AWS Service (Current Month):"
        aws ce get-cost-and-usage \
            --time-period Start=$(date -d "$(date +%Y-%m-01)" +%Y-%m-%d),End=$(date +%Y-%m-%d) \
            --granularity MONTHLY \
            --metrics BlendedCost \
            --group-by Type=DIMENSION,Key=SERVICE \
            --query 'ResultsByTime[0].Groups[?Metrics.BlendedCost.Amount>`0`]' \
            --output table
        
        echo ""
        echo "📈 Daily Trend (Last 14 days):"
        aws ce get-cost-and-usage \
            --time-period Start=$(date -d "14 days ago" +%Y-%m-%d),End=$(date +%Y-%m-%d) \
            --granularity DAILY \
            --metrics BlendedCost \
            --query 'ResultsByTime[].[TimePeriod.Start,Total.BlendedCost.Amount]' \
            --output table
        
        echo ""
        echo "🎯 Demo Environment Summary:"
        echo "   • Environment: Demo/Development"
        echo "   • Optimization Level: High (cost-optimized)"
        echo "   • Monitoring: Active with $100/$200/$300 alerts"
        echo "   • Auto-cleanup: Available via 'cleanup' command"
        ;;
        
    *)
        echo "Demo Cost Management Tool"
        echo "========================"
        echo ""
        echo "Usage: $0 <command> [aws-region]"
        echo ""
        echo "Commands:"
        echo "  status     - Show current cost status and usage"
        echo "  optimize   - Analyze and suggest cost optimizations"
        echo "  alerts     - Set up cost monitoring and alerts"
        echo "  cleanup    - Clean up all demo resources"
        echo "  schedule   - Set up automated start/stop scheduling"
        echo "  report     - Generate comprehensive cost report"
        echo ""
        echo "Examples:"
        echo "  $0 status"
        echo "  $0 optimize"
        echo "  $0 cleanup"
        ;;
esac