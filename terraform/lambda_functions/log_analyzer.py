import json
import base64
import gzip
import boto3
import os
from datetime import datetime
from typing import Dict, List, Any

# Initialize AWS clients
cloudwatch = boto3.client('cloudwatch')

def lambda_handler(event, context):
    """
    Process log events from Kinesis stream and generate custom metrics
    """
    
    try:
        processed_records = 0
        error_count = 0
        warning_count = 0
        ai_service_calls = 0
        performance_issues = 0
        
        for record in event['Records']:
            # Decode Kinesis data
            payload = base64.b64decode(record['kinesis']['data'])
            
            # Decompress if gzipped
            try:
                if payload[:2] == b'\x1f\x8b':  # gzip magic number
                    payload = gzip.decompress(payload)
            except:
                pass
            
            # Parse log data
            try:
                log_data = json.loads(payload.decode('utf-8'))
                processed_records += 1
                
                # Analyze log content
                analysis_result = analyze_log_event(log_data)
                
                # Update counters
                error_count += analysis_result.get('errors', 0)
                warning_count += analysis_result.get('warnings', 0)
                ai_service_calls += analysis_result.get('ai_calls', 0)
                performance_issues += analysis_result.get('performance_issues', 0)
                
            except json.JSONDecodeError:
                # Handle plain text logs
                log_text = payload.decode('utf-8', errors='ignore')
                analysis_result = analyze_text_log(log_text)
                
                error_count += analysis_result.get('errors', 0)
                warning_count += analysis_result.get('warnings', 0)
                ai_service_calls += analysis_result.get('ai_calls', 0)
                performance_issues += analysis_result.get('performance_issues', 0)
                
                processed_records += 1
        
        # Send custom metrics to CloudWatch
        send_custom_metrics({
            'ProcessedLogRecords': processed_records,
            'LogErrors': error_count,
            'LogWarnings': warning_count,
            'AIServiceCalls': ai_service_calls,
            'PerformanceIssues': performance_issues
        })
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'processed_records': processed_records,
                'errors_found': error_count,
                'warnings_found': warning_count,
                'ai_service_calls': ai_service_calls,
                'performance_issues': performance_issues
            })
        }
        
    except Exception as e:
        print(f"ERROR: Failed to process log records: {str(e)}")
        
        # Send error metric
        send_custom_metrics({
            'LogProcessingErrors': 1
        })
        
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def analyze_log_event(log_data: Dict[str, Any]) -> Dict[str, int]:
    """
    Analyze structured log event and extract metrics
    """
    result = {
        'errors': 0,
        'warnings': 0,
        'ai_calls': 0,
        'performance_issues': 0
    }
    
    message = log_data.get('message', '').upper()
    level = log_data.get('level', '').upper()
    
    # Count errors and warnings
    if level == 'ERROR' or 'ERROR' in message:
        result['errors'] = 1
    elif level == 'WARN' or level == 'WARNING' or 'WARNING' in message:
        result['warnings'] = 1
    
    # Count AI service calls
    ai_keywords = ['BEDROCK', 'NOVA', 'SAGEMAKER', 'AI_SERVICE']
    if any(keyword in message for keyword in ai_keywords):
        result['ai_calls'] = 1
    
    # Detect performance issues
    duration = log_data.get('duration', 0)
    if duration > 10000:  # More than 10 seconds
        result['performance_issues'] = 1
    
    # Check for timeout or memory issues
    if any(keyword in message for keyword in ['TIMEOUT', 'OUT_OF_MEMORY', 'THROTTLE']):
        result['performance_issues'] = 1
    
    return result

def analyze_text_log(log_text: str) -> Dict[str, int]:
    """
    Analyze plain text log and extract metrics
    """
    result = {
        'errors': 0,
        'warnings': 0,
        'ai_calls': 0,
        'performance_issues': 0
    }
    
    log_upper = log_text.upper()
    
    # Count errors and warnings
    if any(keyword in log_upper for keyword in ['ERROR', 'EXCEPTION', 'FAILED']):
        result['errors'] = 1
    elif any(keyword in log_upper for keyword in ['WARN', 'WARNING']):
        result['warnings'] = 1
    
    # Count AI service calls
    ai_keywords = ['BEDROCK', 'NOVA', 'SAGEMAKER', 'AI_SERVICE']
    if any(keyword in log_upper for keyword in ai_keywords):
        result['ai_calls'] = 1
    
    # Detect performance issues
    perf_keywords = ['TIMEOUT', 'THROTTLE', 'SLOW', 'HIGH_LATENCY', 'OUT_OF_MEMORY']
    if any(keyword in log_upper for keyword in perf_keywords):
        result['performance_issues'] = 1
    
    return result

def send_custom_metrics(metrics: Dict[str, int]):
    """
    Send custom metrics to CloudWatch
    """
    try:
        metric_data = []
        
        for metric_name, value in metrics.items():
            if value > 0:  # Only send non-zero metrics
                metric_data.append({
                    'MetricName': metric_name,
                    'Value': value,
                    'Unit': 'Count',
                    'Dimensions': [
                        {
                            'Name': 'Environment',
                            'Value': os.environ.get('ENVIRONMENT', 'unknown')
                        },
                        {
                            'Name': 'LogAnalyzer',
                            'Value': 'true'
                        }
                    ]
                })
        
        if metric_data:
            cloudwatch.put_metric_data(
                Namespace='UserJourneyAnalytics/LogAnalysis',
                MetricData=metric_data
            )
            
            print(f"INFO: Sent {len(metric_data)} custom metrics to CloudWatch")
        
    except Exception as e:
        print(f"ERROR: Failed to send custom metrics: {str(e)}")

def detect_security_events(log_text: str) -> List[str]:
    """
    Detect potential security events in logs
    """
    security_events = []
    log_upper = log_text.upper()
    
    security_patterns = [
        'UNAUTHORIZED',
        'FORBIDDEN',
        'AUTHENTICATION_FAILED',
        'INVALID_TOKEN',
        'SUSPICIOUS_ACTIVITY',
        'BRUTE_FORCE',
        'SQL_INJECTION',
        'XSS_ATTEMPT'
    ]
    
    for pattern in security_patterns:
        if pattern in log_upper:
            security_events.append(pattern)
    
    return security_events

def extract_user_journey_events(log_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract user journey specific events for analysis
    """
    message = log_data.get('message', '')
    
    journey_events = {
        'struggle_signals': 0,
        'interventions': 0,
        'video_engagements': 0,
        'user_events': 0
    }
    
    if 'STRUGGLE_SIGNAL_DETECTED' in message:
        journey_events['struggle_signals'] = 1
    elif 'INTERVENTION_EXECUTED' in message:
        journey_events['interventions'] = 1
    elif 'VIDEO_ENGAGEMENT' in message:
        journey_events['video_engagements'] = 1
    elif 'USER_EVENT' in message:
        journey_events['user_events'] = 1
    
    return journey_events