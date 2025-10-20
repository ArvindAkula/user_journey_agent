"""
Automated Performance Optimizer Lambda Function
Analyzes system performance metrics and provides optimization recommendations
"""

import json
import boto3
import os
from datetime import datetime, timedelta
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
cloudwatch = boto3.client('cloudwatch')
lambda_client = boto3.client('lambda')
dynamodb = boto3.client('dynamodb')
application_autoscaling = boto3.client('application-autoscaling')

ENVIRONMENT = os.environ.get('ENVIRONMENT', '${environment}')
PROJECT_NAME = os.environ.get('PROJECT_NAME', 'user-journey-analytics')

def lambda_handler(event, context):
    """
    Main handler for performance optimization analysis
    """
    try:
        logger.info("Starting performance optimization analysis")
        
        # Analyze Lambda performance
        lambda_recommendations = analyze_lambda_performance()
        
        # Analyze DynamoDB performance
        dynamodb_recommendations = analyze_dynamodb_performance()
        
        # Analyze CloudFront performance
        cloudfront_recommendations = analyze_cloudfront_performance()
        
        # Analyze Kinesis performance
        kinesis_recommendations = analyze_kinesis_performance()
        
        # Generate optimization report
        optimization_report = {
            'timestamp': datetime.utcnow().isoformat(),
            'environment': ENVIRONMENT,
            'recommendations': {
                'lambda': lambda_recommendations,
                'dynamodb': dynamodb_recommendations,
                'cloudfront': cloudfront_recommendations,
                'kinesis': kinesis_recommendations
            }
        }
        
        # Apply automatic optimizations if enabled
        if event.get('apply_optimizations', False):
            apply_optimizations(optimization_report)
        
        # Send report to CloudWatch
        send_optimization_metrics(optimization_report)
        
        logger.info("Performance optimization analysis completed")
        
        return {
            'statusCode': 200,
            'body': json.dumps(optimization_report)
        }
        
    except Exception as e:
        logger.error(f"Error in performance optimization: {str(e)}")
        raise e

def analyze_lambda_performance():
    """Analyze Lambda function performance and provide recommendations"""
    recommendations = []
    
    try:
        # Get Lambda metrics for the last hour
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=1)
        
        function_names = [
            f"{PROJECT_NAME}-event-processor-{ENVIRONMENT}",
            f"{PROJECT_NAME}-struggle-detector-{ENVIRONMENT}",
            f"{PROJECT_NAME}-video-analyzer-{ENVIRONMENT}",
            f"{PROJECT_NAME}-intervention-executor-{ENVIRONMENT}"
        ]
        
        for function_name in function_names:
            # Get duration metrics
            duration_response = cloudwatch.get_metric_statistics(
                Namespace='AWS/Lambda',
                MetricName='Duration',
                Dimensions=[{'Name': 'FunctionName', 'Value': function_name}],
                StartTime=start_time,
                EndTime=end_time,
                Period=300,
                Statistics=['Average', 'Maximum']
            )
            
            # Get memory utilization
            memory_response = cloudwatch.get_metric_statistics(
                Namespace='AWS/Lambda',
                MetricName='MemoryUtilization',
                Dimensions=[{'Name': 'FunctionName', 'Value': function_name}],
                StartTime=start_time,
                EndTime=end_time,
                Period=300,
                Statistics=['Average', 'Maximum']
            )
            
            # Analyze and generate recommendations
            if duration_response['Datapoints']:
                avg_duration = sum(dp['Average'] for dp in duration_response['Datapoints']) / len(duration_response['Datapoints'])
                max_duration = max(dp['Maximum'] for dp in duration_response['Datapoints'])
                
                if avg_duration > 5000:  # 5 seconds
                    recommendations.append({
                        'function': function_name,
                        'type': 'duration',
                        'severity': 'high' if avg_duration > 10000 else 'medium',
                        'message': f"High average duration: {avg_duration:.0f}ms",
                        'suggestion': "Consider optimizing code, increasing memory, or enabling provisioned concurrency"
                    })
            
            if memory_response['Datapoints']:
                avg_memory = sum(dp['Average'] for dp in memory_response['Datapoints']) / len(memory_response['Datapoints'])
                
                if avg_memory > 80:
                    recommendations.append({
                        'function': function_name,
                        'type': 'memory',
                        'severity': 'high' if avg_memory > 90 else 'medium',
                        'message': f"High memory utilization: {avg_memory:.1f}%",
                        'suggestion': "Consider increasing memory allocation or optimizing memory usage"
                    })
                elif avg_memory < 30:
                    recommendations.append({
                        'function': function_name,
                        'type': 'memory',
                        'severity': 'low',
                        'message': f"Low memory utilization: {avg_memory:.1f}%",
                        'suggestion': "Consider reducing memory allocation to save costs"
                    })
        
    except Exception as e:
        logger.error(f"Error analyzing Lambda performance: {str(e)}")
    
    return recommendations

def analyze_dynamodb_performance():
    """Analyze DynamoDB performance and provide recommendations"""
    recommendations = []
    
    try:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=1)
        
        table_names = [
            f"{PROJECT_NAME}-user-profiles-{ENVIRONMENT}",
            f"{PROJECT_NAME}-user-events-{ENVIRONMENT}",
            f"{PROJECT_NAME}-struggle-signals-{ENVIRONMENT}",
            f"{PROJECT_NAME}-video-engagement-{ENVIRONMENT}"
        ]
        
        for table_name in table_names:
            # Get throttle metrics
            throttle_response = cloudwatch.get_metric_statistics(
                Namespace='AWS/DynamoDB',
                MetricName='ThrottledRequests',
                Dimensions=[{'Name': 'TableName', 'Value': table_name}],
                StartTime=start_time,
                EndTime=end_time,
                Period=300,
                Statistics=['Sum']
            )
            
            # Get latency metrics
            latency_response = cloudwatch.get_metric_statistics(
                Namespace='AWS/DynamoDB',
                MetricName='SuccessfulRequestLatency',
                Dimensions=[
                    {'Name': 'TableName', 'Value': table_name},
                    {'Name': 'Operation', 'Value': 'Query'}
                ],
                StartTime=start_time,
                EndTime=end_time,
                Period=300,
                Statistics=['Average', 'Maximum']
            )
            
            # Check for throttling
            if throttle_response['Datapoints']:
                total_throttles = sum(dp['Sum'] for dp in throttle_response['Datapoints'])
                if total_throttles > 0:
                    recommendations.append({
                        'table': table_name,
                        'type': 'throttling',
                        'severity': 'high',
                        'message': f"Throttled requests detected: {total_throttles}",
                        'suggestion': "Consider increasing provisioned capacity or switching to on-demand billing"
                    })
            
            # Check latency
            if latency_response['Datapoints']:
                avg_latency = sum(dp['Average'] for dp in latency_response['Datapoints']) / len(latency_response['Datapoints'])
                if avg_latency > 50:  # 50ms
                    recommendations.append({
                        'table': table_name,
                        'type': 'latency',
                        'severity': 'medium' if avg_latency < 100 else 'high',
                        'message': f"High query latency: {avg_latency:.1f}ms",
                        'suggestion': "Consider optimizing queries, using projection expressions, or enabling DAX caching"
                    })
        
    except Exception as e:
        logger.error(f"Error analyzing DynamoDB performance: {str(e)}")
    
    return recommendations

def analyze_cloudfront_performance():
    """Analyze CloudFront performance and provide recommendations"""
    recommendations = []
    
    try:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=1)
        
        # Get CloudFront distributions
        cloudfront = boto3.client('cloudfront')
        distributions = cloudfront.list_distributions()
        
        for distribution in distributions['DistributionList']['Items']:
            distribution_id = distribution['Id']
            
            # Get cache hit rate
            cache_hit_response = cloudwatch.get_metric_statistics(
                Namespace='AWS/CloudFront',
                MetricName='CacheHitRate',
                Dimensions=[{'Name': 'DistributionId', 'Value': distribution_id}],
                StartTime=start_time,
                EndTime=end_time,
                Period=300,
                Statistics=['Average']
            )
            
            # Get origin latency
            origin_latency_response = cloudwatch.get_metric_statistics(
                Namespace='AWS/CloudFront',
                MetricName='OriginLatency',
                Dimensions=[{'Name': 'DistributionId', 'Value': distribution_id}],
                StartTime=start_time,
                EndTime=end_time,
                Period=300,
                Statistics=['Average']
            )
            
            # Analyze cache hit rate
            if cache_hit_response['Datapoints']:
                avg_cache_hit = sum(dp['Average'] for dp in cache_hit_response['Datapoints']) / len(cache_hit_response['Datapoints'])
                if avg_cache_hit < 80:
                    recommendations.append({
                        'distribution': distribution_id,
                        'type': 'cache_hit_rate',
                        'severity': 'medium' if avg_cache_hit > 60 else 'high',
                        'message': f"Low cache hit rate: {avg_cache_hit:.1f}%",
                        'suggestion': "Review cache behaviors, TTL settings, and query string forwarding"
                    })
            
            # Analyze origin latency
            if origin_latency_response['Datapoints']:
                avg_latency = sum(dp['Average'] for dp in origin_latency_response['Datapoints']) / len(origin_latency_response['Datapoints'])
                if avg_latency > 1000:  # 1 second
                    recommendations.append({
                        'distribution': distribution_id,
                        'type': 'origin_latency',
                        'severity': 'high',
                        'message': f"High origin latency: {avg_latency:.0f}ms",
                        'suggestion': "Optimize origin server performance or consider using multiple origins"
                    })
        
    except Exception as e:
        logger.error(f"Error analyzing CloudFront performance: {str(e)}")
    
    return recommendations

def analyze_kinesis_performance():
    """Analyze Kinesis performance and provide recommendations"""
    recommendations = []
    
    try:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=1)
        
        stream_name = f"{PROJECT_NAME}-user-events-{ENVIRONMENT}"
        
        # Get iterator age
        iterator_age_response = cloudwatch.get_metric_statistics(
            Namespace='AWS/Kinesis',
            MetricName='GetRecords.IteratorAgeMilliseconds',
            Dimensions=[{'Name': 'StreamName', 'Value': stream_name}],
            StartTime=start_time,
            EndTime=end_time,
            Period=300,
            Statistics=['Average', 'Maximum']
        )
        
        # Get throughput metrics
        incoming_records_response = cloudwatch.get_metric_statistics(
            Namespace='AWS/Kinesis',
            MetricName='IncomingRecords',
            Dimensions=[{'Name': 'StreamName', 'Value': stream_name}],
            StartTime=start_time,
            EndTime=end_time,
            Period=300,
            Statistics=['Sum']
        )
        
        # Analyze iterator age
        if iterator_age_response['Datapoints']:
            avg_iterator_age = sum(dp['Average'] for dp in iterator_age_response['Datapoints']) / len(iterator_age_response['Datapoints'])
            max_iterator_age = max(dp['Maximum'] for dp in iterator_age_response['Datapoints'])
            
            if avg_iterator_age > 30000:  # 30 seconds
                recommendations.append({
                    'stream': stream_name,
                    'type': 'iterator_age',
                    'severity': 'high' if avg_iterator_age > 60000 else 'medium',
                    'message': f"High iterator age: {avg_iterator_age:.0f}ms",
                    'suggestion': "Consider increasing shard count or optimizing Lambda processing"
                })
        
        # Analyze throughput
        if incoming_records_response['Datapoints']:
            total_records = sum(dp['Sum'] for dp in incoming_records_response['Datapoints'])
            records_per_second = total_records / 3600  # Convert to per second
            
            if records_per_second > 800:  # Near shard limit (1000 records/sec per shard)
                recommendations.append({
                    'stream': stream_name,
                    'type': 'throughput',
                    'severity': 'medium',
                    'message': f"High throughput: {records_per_second:.0f} records/sec",
                    'suggestion': "Consider increasing shard count to handle higher throughput"
                })
        
    except Exception as e:
        logger.error(f"Error analyzing Kinesis performance: {str(e)}")
    
    return recommendations

def apply_optimizations(optimization_report):
    """Apply automatic optimizations based on recommendations"""
    try:
        logger.info("Applying automatic optimizations")
        
        for category, recommendations in optimization_report['recommendations'].items():
            for rec in recommendations:
                if rec['severity'] == 'high' and category == 'lambda':
                    # Auto-adjust Lambda memory for high memory utilization
                    if rec['type'] == 'memory' and 'High memory utilization' in rec['message']:
                        adjust_lambda_memory(rec['function'])
                
                elif rec['severity'] == 'high' and category == 'dynamodb':
                    # Auto-scale DynamoDB for throttling issues
                    if rec['type'] == 'throttling':
                        adjust_dynamodb_capacity(rec['table'])
        
    except Exception as e:
        logger.error(f"Error applying optimizations: {str(e)}")

def adjust_lambda_memory(function_name):
    """Automatically adjust Lambda memory allocation"""
    try:
        # Get current configuration
        response = lambda_client.get_function_configuration(FunctionName=function_name)
        current_memory = response['MemorySize']
        
        # Increase memory by 25% (rounded to nearest 64MB)
        new_memory = min(3008, ((current_memory * 1.25) // 64) * 64)
        
        if new_memory > current_memory:
            lambda_client.update_function_configuration(
                FunctionName=function_name,
                MemorySize=int(new_memory)
            )
            logger.info(f"Increased memory for {function_name} from {current_memory}MB to {new_memory}MB")
        
    except Exception as e:
        logger.error(f"Error adjusting Lambda memory for {function_name}: {str(e)}")

def adjust_dynamodb_capacity(table_name):
    """Automatically adjust DynamoDB capacity"""
    try:
        # This would typically involve updating auto-scaling policies
        # For now, just log the recommendation
        logger.info(f"Recommendation: Increase capacity for DynamoDB table {table_name}")
        
    except Exception as e:
        logger.error(f"Error adjusting DynamoDB capacity for {table_name}: {str(e)}")

def send_optimization_metrics(optimization_report):
    """Send optimization metrics to CloudWatch"""
    try:
        # Count recommendations by severity
        severity_counts = {'high': 0, 'medium': 0, 'low': 0}
        
        for category, recommendations in optimization_report['recommendations'].items():
            for rec in recommendations:
                severity_counts[rec['severity']] += 1
        
        # Send metrics
        cloudwatch.put_metric_data(
            Namespace='UserJourneyAnalytics/Optimization',
            MetricData=[
                {
                    'MetricName': 'HighSeverityRecommendations',
                    'Value': severity_counts['high'],
                    'Unit': 'Count'
                },
                {
                    'MetricName': 'MediumSeverityRecommendations',
                    'Value': severity_counts['medium'],
                    'Unit': 'Count'
                },
                {
                    'MetricName': 'LowSeverityRecommendations',
                    'Value': severity_counts['low'],
                    'Unit': 'Count'
                }
            ]
        )
        
        logger.info(f"Sent optimization metrics: {severity_counts}")
        
    except Exception as e:
        logger.error(f"Error sending optimization metrics: {str(e)}")