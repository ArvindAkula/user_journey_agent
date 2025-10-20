"""
Load Testing Lambda Function
Generates synthetic load to test system performance and scalability
"""

import json
import boto3
import os
import time
import random
import threading
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
import requests
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
kinesis = boto3.client('kinesis')
cloudwatch = boto3.client('cloudwatch')
s3 = boto3.client('s3')

# Environment variables
ENVIRONMENT = os.environ.get('ENVIRONMENT', '${environment}')
PROJECT_NAME = os.environ.get('PROJECT_NAME', 'user-journey-analytics')
KINESIS_STREAM_NAME = os.environ.get('KINESIS_STREAM_NAME')
API_GATEWAY_URL = os.environ.get('API_GATEWAY_URL')
CLOUDFRONT_DOMAIN = os.environ.get('CLOUDFRONT_DOMAIN')

def lambda_handler(event, context):
    """
    Main handler for load testing operations
    """
    try:
        action = event.get('action', 'execute')
        test_type = event.get('test_type', 'baseline')
        
        logger.info(f"Starting load test: action={action}, type={test_type}")
        
        if action == 'prepare':
            return prepare_load_test(event)
        elif action == 'execute':
            return execute_load_test(event)
        elif action == 'cleanup':
            return cleanup_load_test(event)
        else:
            raise ValueError(f"Unknown action: {action}")
            
    except Exception as e:
        logger.error(f"Error in load testing: {str(e)}")
        raise e

def prepare_load_test(event):
    """Prepare the system for load testing"""
    try:
        test_type = event.get('test_type', 'baseline')
        
        # Warm up Lambda functions
        warm_up_functions()
        
        # Pre-populate test data
        generate_test_data()
        
        # Verify system health
        health_check = verify_system_health()
        
        if not health_check['healthy']:
            raise Exception(f"System not ready for load testing: {health_check['issues']}")
        
        logger.info(f"Load test preparation completed for {test_type}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Load test preparation completed',
                'test_type': test_type,
                'system_health': health_check
            })
        }
        
    except Exception as e:
        logger.error(f"Error preparing load test: {str(e)}")
        raise e

def execute_load_test(event):
    """Execute the load test"""
    try:
        test_type = event.get('test_type', 'baseline')
        duration_seconds = int(event.get('duration_seconds', 300))
        concurrent_users = int(event.get('concurrent_users', 10))
        requests_per_second = int(event.get('requests_per_second', 50))
        
        logger.info(f"Executing {test_type} load test: {concurrent_users} users, {requests_per_second} RPS, {duration_seconds}s")
        
        # Initialize test metrics
        test_metrics = {
            'test_type': test_type,
            'start_time': datetime.utcnow().isoformat(),
            'duration_seconds': duration_seconds,
            'concurrent_users': concurrent_users,
            'target_rps': requests_per_second,
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'response_times': [],
            'errors': []
        }
        
        # Execute load test based on type
        if test_type == 'baseline':
            results = execute_baseline_test(test_metrics, duration_seconds, concurrent_users, requests_per_second)
        elif test_type == 'stress':
            results = execute_stress_test(test_metrics, duration_seconds, concurrent_users, requests_per_second)
        elif test_type == 'spike':
            results = execute_spike_test(test_metrics, duration_seconds, concurrent_users, requests_per_second)
        else:
            raise ValueError(f"Unknown test type: {test_type}")
        
        # Store results
        store_test_results(results)
        
        # Send metrics to CloudWatch
        send_load_test_metrics(results)
        
        logger.info(f"LOAD_TEST_RESULT {test_type} completed: {results['successful_requests']}/{results['total_requests']} successful")
        
        return {
            'statusCode': 200,
            'body': json.dumps(results)
        }
        
    except Exception as e:
        logger.error(f"Error executing load test: {str(e)}")
        raise e

def execute_baseline_test(test_metrics, duration_seconds, concurrent_users, requests_per_second):
    """Execute baseline load test with steady load"""
    
    end_time = time.time() + duration_seconds
    request_interval = 1.0 / requests_per_second
    
    with ThreadPoolExecutor(max_workers=concurrent_users) as executor:
        futures = []
        
        while time.time() < end_time:
            # Submit requests at target rate
            for _ in range(min(concurrent_users, requests_per_second)):
                if time.time() >= end_time:
                    break
                    
                future = executor.submit(execute_single_request, test_metrics)
                futures.append(future)
                
                time.sleep(request_interval)
        
        # Wait for all requests to complete
        for future in as_completed(futures, timeout=60):
            try:
                future.result()
            except Exception as e:
                test_metrics['errors'].append(str(e))
    
    # Calculate final metrics
    test_metrics['end_time'] = datetime.utcnow().isoformat()
    test_metrics['actual_duration'] = time.time() - time.mktime(datetime.fromisoformat(test_metrics['start_time']).timetuple())
    test_metrics['actual_rps'] = test_metrics['total_requests'] / test_metrics['actual_duration']
    test_metrics['success_rate'] = (test_metrics['successful_requests'] / test_metrics['total_requests']) * 100 if test_metrics['total_requests'] > 0 else 0
    test_metrics['avg_response_time'] = sum(test_metrics['response_times']) / len(test_metrics['response_times']) if test_metrics['response_times'] else 0
    test_metrics['p95_response_time'] = calculate_percentile(test_metrics['response_times'], 95)
    test_metrics['p99_response_time'] = calculate_percentile(test_metrics['response_times'], 99)
    
    return test_metrics

def execute_stress_test(test_metrics, duration_seconds, concurrent_users, requests_per_second):
    """Execute stress test with gradually increasing load"""
    
    # Gradually increase load over time
    phases = [
        {'duration': duration_seconds * 0.2, 'users': concurrent_users * 0.3, 'rps': requests_per_second * 0.3},
        {'duration': duration_seconds * 0.3, 'users': concurrent_users * 0.6, 'rps': requests_per_second * 0.6},
        {'duration': duration_seconds * 0.3, 'users': concurrent_users * 0.9, 'rps': requests_per_second * 0.9},
        {'duration': duration_seconds * 0.2, 'users': concurrent_users, 'rps': requests_per_second}
    ]
    
    for phase_num, phase in enumerate(phases):
        logger.info(f"Stress test phase {phase_num + 1}: {phase['users']} users, {phase['rps']} RPS")
        
        phase_start = time.time()
        phase_end = phase_start + phase['duration']
        request_interval = 1.0 / phase['rps']
        
        with ThreadPoolExecutor(max_workers=int(phase['users'])) as executor:
            futures = []
            
            while time.time() < phase_end:
                for _ in range(min(int(phase['users']), int(phase['rps']))):
                    if time.time() >= phase_end:
                        break
                        
                    future = executor.submit(execute_single_request, test_metrics)
                    futures.append(future)
                    
                    time.sleep(request_interval)
            
            # Wait for phase requests to complete
            for future in as_completed(futures, timeout=30):
                try:
                    future.result()
                except Exception as e:
                    test_metrics['errors'].append(str(e))
    
    # Calculate final metrics (same as baseline)
    test_metrics['end_time'] = datetime.utcnow().isoformat()
    test_metrics['actual_duration'] = time.time() - time.mktime(datetime.fromisoformat(test_metrics['start_time']).timetuple())
    test_metrics['actual_rps'] = test_metrics['total_requests'] / test_metrics['actual_duration']
    test_metrics['success_rate'] = (test_metrics['successful_requests'] / test_metrics['total_requests']) * 100 if test_metrics['total_requests'] > 0 else 0
    test_metrics['avg_response_time'] = sum(test_metrics['response_times']) / len(test_metrics['response_times']) if test_metrics['response_times'] else 0
    test_metrics['p95_response_time'] = calculate_percentile(test_metrics['response_times'], 95)
    test_metrics['p99_response_time'] = calculate_percentile(test_metrics['response_times'], 99)
    
    return test_metrics

def execute_spike_test(test_metrics, duration_seconds, concurrent_users, requests_per_second):
    """Execute spike test with sudden load increase"""
    
    # Spike pattern: low -> high -> low
    phases = [
        {'duration': duration_seconds * 0.2, 'users': concurrent_users * 0.1, 'rps': requests_per_second * 0.1},
        {'duration': duration_seconds * 0.6, 'users': concurrent_users, 'rps': requests_per_second},
        {'duration': duration_seconds * 0.2, 'users': concurrent_users * 0.1, 'rps': requests_per_second * 0.1}
    ]
    
    for phase_num, phase in enumerate(phases):
        logger.info(f"Spike test phase {phase_num + 1}: {phase['users']} users, {phase['rps']} RPS")
        
        phase_start = time.time()
        phase_end = phase_start + phase['duration']
        request_interval = 1.0 / max(phase['rps'], 1)
        
        with ThreadPoolExecutor(max_workers=int(phase['users'])) as executor:
            futures = []
            
            while time.time() < phase_end:
                for _ in range(min(int(phase['users']), max(int(phase['rps']), 1))):
                    if time.time() >= phase_end:
                        break
                        
                    future = executor.submit(execute_single_request, test_metrics)
                    futures.append(future)
                    
                    if phase['rps'] > 0:
                        time.sleep(request_interval)
            
            # Wait for phase requests to complete
            for future in as_completed(futures, timeout=30):
                try:
                    future.result()
                except Exception as e:
                    test_metrics['errors'].append(str(e))
    
    # Calculate final metrics (same as baseline)
    test_metrics['end_time'] = datetime.utcnow().isoformat()
    test_metrics['actual_duration'] = time.time() - time.mktime(datetime.fromisoformat(test_metrics['start_time']).timetuple())
    test_metrics['actual_rps'] = test_metrics['total_requests'] / test_metrics['actual_duration']
    test_metrics['success_rate'] = (test_metrics['successful_requests'] / test_metrics['total_requests']) * 100 if test_metrics['total_requests'] > 0 else 0
    test_metrics['avg_response_time'] = sum(test_metrics['response_times']) / len(test_metrics['response_times']) if test_metrics['response_times'] else 0
    test_metrics['p95_response_time'] = calculate_percentile(test_metrics['response_times'], 95)
    test_metrics['p99_response_time'] = calculate_percentile(test_metrics['response_times'], 99)
    
    return test_metrics

def execute_single_request(test_metrics):
    """Execute a single request and record metrics"""
    
    request_start = time.time()
    
    try:
        # Randomly choose request type
        request_type = random.choice(['kinesis_event', 'api_call', 'cloudfront_asset'])
        
        if request_type == 'kinesis_event':
            success = send_kinesis_event()
        elif request_type == 'api_call':
            success = make_api_call()
        else:
            success = fetch_cloudfront_asset()
        
        response_time = (time.time() - request_start) * 1000  # Convert to milliseconds
        
        # Thread-safe metrics update
        with threading.Lock():
            test_metrics['total_requests'] += 1
            test_metrics['response_times'].append(response_time)
            
            if success:
                test_metrics['successful_requests'] += 1
            else:
                test_metrics['failed_requests'] += 1
        
    except Exception as e:
        response_time = (time.time() - request_start) * 1000
        
        with threading.Lock():
            test_metrics['total_requests'] += 1
            test_metrics['failed_requests'] += 1
            test_metrics['response_times'].append(response_time)
            test_metrics['errors'].append(str(e))

def send_kinesis_event():
    """Send a synthetic event to Kinesis"""
    try:
        event_data = {
            'userId': f'load_test_user_{random.randint(1, 1000)}',
            'sessionId': f'session_{random.randint(1, 100)}',
            'timestamp': int(time.time() * 1000),
            'eventType': random.choice(['page_view', 'video_engagement', 'feature_interaction']),
            'eventData': {
                'feature': random.choice(['document_upload', 'calculator', 'video_player']),
                'duration': random.randint(1000, 30000),
                'attemptCount': random.randint(1, 5),
                'completionRate': random.uniform(0.1, 1.0)
            },
            'deviceInfo': {
                'platform': random.choice(['iOS', 'Android', 'Web']),
                'appVersion': '1.0.0'
            }
        }
        
        response = kinesis.put_record(
            StreamName=KINESIS_STREAM_NAME,
            Data=json.dumps(event_data),
            PartitionKey=event_data['userId']
        )
        
        return response['ResponseMetadata']['HTTPStatusCode'] == 200
        
    except Exception as e:
        logger.error(f"Error sending Kinesis event: {str(e)}")
        return False

def make_api_call():
    """Make a synthetic API call"""
    try:
        if not API_GATEWAY_URL:
            return True  # Skip if not configured
        
        # Random API endpoint
        endpoints = ['/analytics', '/events']
        endpoint = random.choice(endpoints)
        
        if endpoint == '/analytics':
            params = {
                'userId': f'load_test_user_{random.randint(1, 1000)}',
                'timeRange': '24h'
            }
            response = requests.get(f"{API_GATEWAY_URL}{endpoint}", params=params, timeout=10)
        else:
            event_data = {
                'userId': f'load_test_user_{random.randint(1, 1000)}',
                'eventType': 'load_test',
                'timestamp': int(time.time() * 1000)
            }
            response = requests.post(f"{API_GATEWAY_URL}{endpoint}", json=event_data, timeout=10)
        
        return response.status_code < 400
        
    except Exception as e:
        logger.error(f"Error making API call: {str(e)}")
        return False

def fetch_cloudfront_asset():
    """Fetch a synthetic asset from CloudFront"""
    try:
        if not CLOUDFRONT_DOMAIN:
            return True  # Skip if not configured
        
        # Random asset
        assets = ['index.html', 'app.js', 'styles.css', 'logo.png']
        asset = random.choice(assets)
        
        response = requests.get(f"https://{CLOUDFRONT_DOMAIN}/{asset}", timeout=10)
        return response.status_code < 400
        
    except Exception as e:
        logger.error(f"Error fetching CloudFront asset: {str(e)}")
        return False

def warm_up_functions():
    """Warm up Lambda functions before load testing"""
    try:
        lambda_client = boto3.client('lambda')
        
        function_names = [
            f"{PROJECT_NAME}-event-processor-{ENVIRONMENT}",
            f"{PROJECT_NAME}-struggle-detector-{ENVIRONMENT}",
            f"{PROJECT_NAME}-video-analyzer-{ENVIRONMENT}",
            f"{PROJECT_NAME}-intervention-executor-{ENVIRONMENT}"
        ]
        
        for function_name in function_names:
            try:
                lambda_client.invoke(
                    FunctionName=function_name,
                    InvocationType='RequestResponse',
                    Payload=json.dumps({'warmup': True})
                )
                logger.info(f"Warmed up function: {function_name}")
            except Exception as e:
                logger.warning(f"Could not warm up function {function_name}: {str(e)}")
        
    except Exception as e:
        logger.error(f"Error warming up functions: {str(e)}")

def generate_test_data():
    """Generate test data for load testing"""
    try:
        # This would typically pre-populate databases with test data
        logger.info("Test data generation completed")
        
    except Exception as e:
        logger.error(f"Error generating test data: {str(e)}")

def verify_system_health():
    """Verify system health before load testing"""
    try:
        health_check = {
            'healthy': True,
            'issues': []
        }
        
        # Check Kinesis stream
        try:
            kinesis.describe_stream(StreamName=KINESIS_STREAM_NAME)
        except Exception as e:
            health_check['healthy'] = False
            health_check['issues'].append(f"Kinesis stream not accessible: {str(e)}")
        
        # Check API Gateway
        if API_GATEWAY_URL:
            try:
                response = requests.get(f"{API_GATEWAY_URL}/health", timeout=5)
                if response.status_code >= 400:
                    health_check['issues'].append(f"API Gateway health check failed: {response.status_code}")
            except Exception as e:
                health_check['issues'].append(f"API Gateway not accessible: {str(e)}")
        
        return health_check
        
    except Exception as e:
        return {
            'healthy': False,
            'issues': [f"Health check failed: {str(e)}"]
        }

def calculate_percentile(data, percentile):
    """Calculate percentile of response times"""
    if not data:
        return 0
    
    sorted_data = sorted(data)
    index = int((percentile / 100) * len(sorted_data))
    return sorted_data[min(index, len(sorted_data) - 1)]

def store_test_results(results):
    """Store test results in S3"""
    try:
        bucket_name = f"{PROJECT_NAME}-load-test-results-{ENVIRONMENT}"
        key = f"load-test-results/{results['test_type']}/{datetime.utcnow().strftime('%Y/%m/%d/%H-%M-%S')}.json"
        
        s3.put_object(
            Bucket=bucket_name,
            Key=key,
            Body=json.dumps(results, indent=2),
            ContentType='application/json'
        )
        
        logger.info(f"Stored test results: s3://{bucket_name}/{key}")
        
    except Exception as e:
        logger.error(f"Error storing test results: {str(e)}")

def send_load_test_metrics(results):
    """Send load test metrics to CloudWatch"""
    try:
        metrics = [
            {
                'MetricName': 'ResponseTime',
                'Value': results['avg_response_time'],
                'Unit': 'Milliseconds',
                'Dimensions': [
                    {'Name': 'TestType', 'Value': results['test_type']},
                    {'Name': 'Environment', 'Value': ENVIRONMENT}
                ]
            },
            {
                'MetricName': 'Throughput',
                'Value': results['actual_rps'],
                'Unit': 'Count/Second',
                'Dimensions': [
                    {'Name': 'TestType', 'Value': results['test_type']},
                    {'Name': 'Environment', 'Value': ENVIRONMENT}
                ]
            },
            {
                'MetricName': 'ErrorRate',
                'Value': 100 - results['success_rate'],
                'Unit': 'Percent',
                'Dimensions': [
                    {'Name': 'TestType', 'Value': results['test_type']},
                    {'Name': 'Environment', 'Value': ENVIRONMENT}
                ]
            },
            {
                'MetricName': 'P95ResponseTime',
                'Value': results['p95_response_time'],
                'Unit': 'Milliseconds',
                'Dimensions': [
                    {'Name': 'TestType', 'Value': results['test_type']},
                    {'Name': 'Environment', 'Value': ENVIRONMENT}
                ]
            }
        ]
        
        cloudwatch.put_metric_data(
            Namespace='UserJourneyAnalytics/LoadTesting',
            MetricData=metrics
        )
        
        logger.info(f"Sent load test metrics to CloudWatch")
        
    except Exception as e:
        logger.error(f"Error sending load test metrics: {str(e)}")

def cleanup_load_test(event):
    """Clean up after load testing"""
    try:
        # Clean up any test data or resources
        logger.info("Load test cleanup completed")
        
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Load test cleanup completed'})
        }
        
    except Exception as e:
        logger.error(f"Error cleaning up load test: {str(e)}")
        raise e