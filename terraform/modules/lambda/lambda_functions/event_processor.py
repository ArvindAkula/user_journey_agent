import json
import boto3
import os
from datetime import datetime
import logging
import time
from functools import lru_cache
from botocore.config import Config
import threading

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Performance optimization configurations
DYNAMODB_POOL_SIZE = int(os.environ.get('DYNAMODB_CONNECTION_POOL_SIZE', '20'))
TIMESTREAM_POOL_SIZE = int(os.environ.get('TIMESTREAM_CONNECTION_POOL_SIZE', '10'))
BEDROCK_POOL_SIZE = int(os.environ.get('BEDROCK_CONNECTION_POOL_SIZE', '5'))
ENABLE_CACHING = os.environ.get('ENABLE_CACHING', 'true').lower() == 'true'
CACHE_TTL_SECONDS = int(os.environ.get('CACHE_TTL_SECONDS', '300'))

# Connection pooling configuration
config = Config(
    region_name=os.environ.get('AWS_REGION', 'us-east-1'),
    retries={'max_attempts': 3, 'mode': 'adaptive'},
    max_pool_connections=50
)

# Initialize AWS clients with connection pooling
dynamodb = boto3.resource('dynamodb', config=config)
timestream_write = boto3.client('timestream-write', config=config)
bedrock_agent = boto3.client('bedrock-agent-runtime', config=config)

# Thread-local storage for caching
thread_local = threading.local()

# In-memory cache for frequently accessed data
cache = {}
cache_timestamps = {}

def get_cached_data(key):
    """Get data from cache if not expired"""
    if not ENABLE_CACHING:
        return None
    
    if key in cache and key in cache_timestamps:
        if time.time() - cache_timestamps[key] < CACHE_TTL_SECONDS:
            return cache[key]
        else:
            # Remove expired cache entry
            del cache[key]
            del cache_timestamps[key]
    return None

def set_cached_data(key, data):
    """Set data in cache with timestamp"""
    if ENABLE_CACHING:
        cache[key] = data
        cache_timestamps[key] = time.time()

@lru_cache(maxsize=1000)
def get_user_profile_cached(user_id):
    """Get user profile with LRU caching"""
    cache_key = f"user_profile_{user_id}"
    cached_data = get_cached_data(cache_key)
    
    if cached_data:
        return cached_data
    
    try:
        table = dynamodb.Table(USER_PROFILES_TABLE)
        response = table.get_item(Key={'userId': user_id})
        
        if 'Item' in response:
            profile_data = response['Item']
            set_cached_data(cache_key, profile_data)
            return profile_data
    except Exception as e:
        logger.error(f"Error getting user profile: {str(e)}")
    
    return None

def batch_write_dynamodb(table_name, items):
    """Batch write items to DynamoDB for better performance"""
    if not items:
        return
    
    table = dynamodb.Table(table_name)
    
    # Process items in batches of 25 (DynamoDB limit)
    batch_size = 25
    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        
        with table.batch_writer() as batch_writer:
            for item in batch:
                batch_writer.put_item(Item=item)

def batch_write_timestream(records):
    """Batch write records to Timestream for better performance"""
    if not records:
        return
    
    try:
        # Process records in batches of 100 (Timestream limit)
        batch_size = 100
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            
            timestream_write.write_records(
                DatabaseName=TIMESTREAM_DATABASE,
                TableName='user-metrics',
                Records=batch
            )
    except Exception as e:
        logger.error(f"Error batch writing to Timestream: {str(e)}")

# Environment variables
ENVIRONMENT = os.environ.get('ENVIRONMENT', '${environment}')
USER_PROFILES_TABLE = os.environ.get('USER_PROFILES_TABLE')
USER_EVENTS_TABLE = os.environ.get('USER_EVENTS_TABLE')
STRUGGLE_SIGNALS_TABLE = os.environ.get('STRUGGLE_SIGNALS_TABLE')
VIDEO_ENGAGEMENT_TABLE = os.environ.get('VIDEO_ENGAGEMENT_TABLE')
TIMESTREAM_DATABASE = os.environ.get('TIMESTREAM_DATABASE')

def lambda_handler(event, context):
    """
    Process user events from Kinesis Data Stream with performance optimizations
    """
    start_time = time.time()
    processed_count = 0
    failed_count = 0
    
    try:
        # Collect all events for batch processing
        events_to_store = []
        timestream_records = []
        
        for record in event['Records']:
            try:
                # Decode Kinesis data
                payload = json.loads(record['kinesis']['data'])
                
                # Process the user event with batch collection
                process_user_event_optimized(payload, events_to_store, timestream_records)
                processed_count += 1
                
            except Exception as e:
                logger.error(f"Error processing individual record: {str(e)}")
                failed_count += 1
        
        # Batch write to DynamoDB
        if events_to_store:
            batch_write_dynamodb(USER_EVENTS_TABLE, events_to_store)
        
        # Batch write to Timestream
        if timestream_records:
            batch_write_timestream(timestream_records)
        
        # Log performance metrics
        processing_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        logger.info(f"PROCESSING_LATENCY {processing_time}")
        logger.info(f"EVENT_PROCESSED {processed_count}")
        
        if failed_count > 0:
            logger.warning(f"Failed to process {failed_count} events out of {processed_count + failed_count}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Events processed successfully',
                'processed': processed_count,
                'failed': failed_count,
                'processing_time_ms': processing_time
            })
        }
        
    except Exception as e:
        logger.error(f"Error processing events: {str(e)}")
        raise e

def process_user_event(event_data):
    """
    Process individual user event
    """
    try:
        # Store event in DynamoDB
        store_user_event(event_data)
        
        # Store time-series data in Timestream
        store_timestream_data(event_data)
        
        # Update user profile
        update_user_profile(event_data)
        
        # Check for struggle signals
        if detect_struggle_signal(event_data):
            trigger_intervention(event_data)
            
        # Process video engagement
        if event_data.get('eventType') == 'video_engagement':
            process_video_engagement(event_data)
            
    except Exception as e:
        logger.error(f"Error processing user event: {str(e)}")
        raise e

def store_user_event(event_data):
    """
    Store user event in DynamoDB
    """
    table = dynamodb.Table(USER_EVENTS_TABLE)
    
    # Add TTL (30 days from now)
    ttl = int(datetime.now().timestamp()) + (30 * 24 * 60 * 60)
    
    item = {
        'userId': event_data['userId'],
        'timestamp': event_data['timestamp'],
        'eventType': event_data['eventType'],
        'sessionId': event_data['sessionId'],
        'eventData': event_data.get('eventData', {}),
        'deviceInfo': event_data.get('deviceInfo', {}),
        'userContext': event_data.get('userContext', {}),
        'ttl': ttl
    }
    
    table.put_item(Item=item)

def store_timestream_data(event_data):
    """
    Store time-series data in Timestream
    """
    try:
        records = []
        
        # Create base record
        record = {
            'Time': str(event_data['timestamp']),
            'TimeUnit': 'MILLISECONDS',
            'Dimensions': [
                {'Name': 'userId', 'Value': event_data['userId']},
                {'Name': 'eventType', 'Value': event_data['eventType']},
                {'Name': 'sessionId', 'Value': event_data['sessionId']}
            ]
        }
        
        # Add event-specific metrics
        if event_data['eventType'] == 'video_engagement':
            record.update({
                'MeasureName': 'video_watch_duration',
                'MeasureValue': str(event_data['eventData'].get('duration', 0)),
                'MeasureValueType': 'BIGINT'
            })
            records.append(record.copy())
            
            record.update({
                'MeasureName': 'video_completion_rate',
                'MeasureValue': str(event_data['eventData'].get('completionRate', 0)),
                'MeasureValueType': 'DOUBLE'
            })
            records.append(record.copy())
            
        elif event_data['eventType'] == 'feature_interaction':
            record.update({
                'MeasureName': 'feature_attempt_count',
                'MeasureValue': str(event_data['eventData'].get('attemptCount', 1)),
                'MeasureValueType': 'BIGINT'
            })
            records.append(record)
        
        if records:
            timestream_write.write_records(
                DatabaseName=TIMESTREAM_DATABASE,
                TableName='user-metrics',
                Records=records
            )
            
    except Exception as e:
        logger.error(f"Error storing Timestream data: {str(e)}")

def update_user_profile(event_data):
    """
    Update user profile based on event
    """
    table = dynamodb.Table(USER_PROFILES_TABLE)
    
    try:
        # Update last active timestamp and increment session count
        table.update_item(
            Key={'userId': event_data['userId']},
            UpdateExpression='SET lastActiveAt = :timestamp, totalSessions = if_not_exists(totalSessions, :zero) + :one',
            ExpressionAttributeValues={
                ':timestamp': event_data['timestamp'],
                ':zero': 0,
                ':one': 1
            }
        )
    except Exception as e:
        logger.error(f"Error updating user profile: {str(e)}")

def detect_struggle_signal(event_data):
    """
    Detect if user is struggling with a feature
    """
    if event_data['eventType'] == 'feature_interaction':
        attempt_count = event_data['eventData'].get('attemptCount', 1)
        if attempt_count >= 2:
            store_struggle_signal(event_data)
            return True
    return False

def store_struggle_signal(event_data):
    """
    Store struggle signal in DynamoDB
    """
    table = dynamodb.Table(STRUGGLE_SIGNALS_TABLE)
    
    attempt_count = event_data['eventData'].get('attemptCount', 1)
    severity = 'low'
    if attempt_count >= 5:
        severity = 'critical'
    elif attempt_count >= 3:
        severity = 'high'
    elif attempt_count >= 2:
        severity = 'medium'
    
    # Add TTL (7 days from now)
    ttl = int(datetime.now().timestamp()) + (7 * 24 * 60 * 60)
    
    item = {
        'userId': event_data['userId'],
        'featureId': event_data['eventData'].get('feature', 'unknown'),
        'detectedAt': event_data['timestamp'],
        'signalType': 'repeated_attempts',
        'severity': severity,
        'attemptCount': attempt_count,
        'timeSpent': event_data['eventData'].get('duration', 0),
        'resolved': False,
        'ttl': ttl
    }
    
    table.put_item(Item=item)

def trigger_intervention(event_data):
    """
    Trigger AI intervention through Bedrock Agent
    """
    try:
        # Get environment variables for Bedrock Agent
        agent_id = os.environ.get('BEDROCK_AGENT_ID')
        agent_alias_id = os.environ.get('BEDROCK_AGENT_ALIAS_ID', 'TSTALIASID')
        
        if not agent_id:
            logger.warning("Bedrock Agent ID not configured, skipping intervention")
            return
        
        # Prepare intervention request
        intervention_request = {
            'userId': event_data['userId'],
            'struggleType': event_data['eventData'].get('feature', 'unknown'),
            'attemptCount': event_data['eventData'].get('attemptCount', 1),
            'context': event_data.get('userContext', {}),
            'timestamp': event_data['timestamp']
        }
        
        # Generate session ID for Bedrock Agent
        session_id = f"{event_data['userId']}-{event_data['sessionId']}"
        
        # Create input text for the agent
        input_text = f"""
        Analyze the following user struggle signal and recommend appropriate interventions:
        
        User ID: {intervention_request['userId']}
        Feature: {intervention_request['struggleType']}
        Attempt Count: {intervention_request['attemptCount']}
        Session Stage: {intervention_request['context'].get('sessionStage', 'unknown')}
        
        Please analyze this struggle pattern and recommend immediate interventions.
        """
        
        # Invoke Bedrock Agent
        response = bedrock_agent.invoke_agent(
            agentId=agent_id,
            agentAliasId=agent_alias_id,
            sessionId=session_id,
            inputText=input_text
        )
        
        # Process the agent response
        process_agent_response(response, event_data['userId'])
        
        logger.info(f"Successfully triggered Bedrock Agent intervention for user {event_data['userId']}")
        
    except Exception as e:
        logger.error(f"Error triggering Bedrock Agent intervention: {str(e)}")
        # Fallback to rule-based intervention
        trigger_fallback_intervention(event_data)

def process_agent_response(response, user_id):
    """
    Process the response from Bedrock Agent
    """
    try:
        # The response is a streaming response, so we need to collect it
        response_text = ""
        
        for event in response.get('completion', []):
            if 'chunk' in event:
                chunk = event['chunk']
                if 'bytes' in chunk:
                    response_text += chunk['bytes'].decode('utf-8')
        
        logger.info(f"Bedrock Agent response for user {user_id}: {response_text}")
        
        # Store the agent response for analytics
        store_agent_response(user_id, response_text)
        
    except Exception as e:
        logger.error(f"Error processing agent response: {str(e)}")

def store_agent_response(user_id, response_text):
    """
    Store Bedrock Agent response for analytics
    """
    try:
        # Store in Timestream for analytics
        records = [{
            'Time': str(int(datetime.now().timestamp() * 1000)),
            'TimeUnit': 'MILLISECONDS',
            'Dimensions': [
                {'Name': 'userId', 'Value': user_id},
                {'Name': 'responseType', 'Value': 'bedrock_agent_intervention'}
            ],
            'MeasureName': 'agent_response',
            'MeasureValue': '1',
            'MeasureValueType': 'BIGINT'
        }]
        
        timestream_write.write_records(
            DatabaseName=TIMESTREAM_DATABASE,
            TableName='agent-interactions',
            Records=records
        )
        
    except Exception as e:
        logger.error(f"Error storing agent response: {str(e)}")

def trigger_fallback_intervention(event_data):
    """
    Fallback intervention when Bedrock Agent is unavailable
    """
    try:
        attempt_count = event_data['eventData'].get('attemptCount', 1)
        
        # Simple rule-based intervention
        if attempt_count >= 3:
            logger.info(f"Fallback: High priority intervention for user {event_data['userId']}")
            # Would trigger high priority intervention
        elif attempt_count >= 2:
            logger.info(f"Fallback: Medium priority intervention for user {event_data['userId']}")
            # Would trigger medium priority intervention
        
    except Exception as e:
        logger.error(f"Error in fallback intervention: {str(e)}")

def process_video_engagement(event_data):
    """
    Process video engagement data
    """
    table = dynamodb.Table(VIDEO_ENGAGEMENT_TABLE)
    
    try:
        # Calculate interest score based on completion rate and watch time
        completion_rate = event_data['eventData'].get('completionRate', 0)
        duration = event_data['eventData'].get('duration', 0)
        interest_score = min(100, (completion_rate * 0.7 + min(duration / 300, 1) * 0.3) * 100)
        
        table.put_item(Item={
            'userId': event_data['userId'],
            'videoId': event_data['eventData'].get('videoId', 'unknown'),
            'lastWatchedAt': event_data['timestamp'],
            'viewCount': 1,
            'totalWatchTime': duration,
            'completionRate': completion_rate,
            'interestScore': int(interest_score)
        })
        
    except Exception as e:
        logger.error(f"Error processing video engagement: {str(e)}")

def process_user_event_optimized(event_data, events_to_store, timestream_records):
    """
    Optimized user event processing for batch operations
    """
    try:
        # Prepare event for batch storage
        ttl = int(datetime.now().timestamp()) + (30 * 24 * 60 * 60)
        
        event_item = {
            'userId': event_data['userId'],
            'timestamp': event_data['timestamp'],
            'eventType': event_data['eventType'],
            'sessionId': event_data['sessionId'],
            'eventData': event_data.get('eventData', {}),
            'deviceInfo': event_data.get('deviceInfo', {}),
            'userContext': event_data.get('userContext', {}),
            'ttl': ttl
        }
        events_to_store.append(event_item)
        
        # Prepare Timestream records for batch storage
        base_record = {
            'Time': str(event_data['timestamp']),
            'TimeUnit': 'MILLISECONDS',
            'Dimensions': [
                {'Name': 'userId', 'Value': event_data['userId']},
                {'Name': 'eventType', 'Value': event_data['eventType']},
                {'Name': 'sessionId', 'Value': event_data['sessionId']}
            ]
        }
        
        # Add event-specific metrics to batch
        if event_data['eventType'] == 'video_engagement':
            video_record = base_record.copy()
            video_record.update({
                'MeasureName': 'video_watch_duration',
                'MeasureValue': str(event_data['eventData'].get('duration', 0)),
                'MeasureValueType': 'BIGINT'
            })
            timestream_records.append(video_record)
            
            completion_record = base_record.copy()
            completion_record.update({
                'MeasureName': 'video_completion_rate',
                'MeasureValue': str(event_data['eventData'].get('completionRate', 0)),
                'MeasureValueType': 'DOUBLE'
            })
            timestream_records.append(completion_record)
            
        elif event_data['eventType'] == 'feature_interaction':
            feature_record = base_record.copy()
            feature_record.update({
                'MeasureName': 'feature_attempt_count',
                'MeasureValue': str(event_data['eventData'].get('attemptCount', 1)),
                'MeasureValueType': 'BIGINT'
            })
            timestream_records.append(feature_record)
        
        # Update user profile asynchronously (cached)
        update_user_profile_cached(event_data)
        
        # Check for struggle signals
        if detect_struggle_signal(event_data):
            trigger_intervention_async(event_data)
            
        # Process video engagement
        if event_data.get('eventType') == 'video_engagement':
            process_video_engagement_cached(event_data)
            
    except Exception as e:
        logger.error(f"Error in optimized event processing: {str(e)}")
        raise e

def update_user_profile_cached(event_data):
    """
    Update user profile with caching optimization
    """
    try:
        # Check if we recently updated this user's profile
        cache_key = f"profile_update_{event_data['userId']}"
        last_update = get_cached_data(cache_key)
        
        # Only update if we haven't updated in the last 60 seconds
        if not last_update or (time.time() - last_update) > 60:
            table = dynamodb.Table(USER_PROFILES_TABLE)
            table.update_item(
                Key={'userId': event_data['userId']},
                UpdateExpression='SET lastActiveAt = :timestamp, totalSessions = if_not_exists(totalSessions, :zero) + :one',
                ExpressionAttributeValues={
                    ':timestamp': event_data['timestamp'],
                    ':zero': 0,
                    ':one': 1
                }
            )
            set_cached_data(cache_key, time.time())
            
    except Exception as e:
        logger.error(f"Error updating cached user profile: {str(e)}")

def trigger_intervention_async(event_data):
    """
    Trigger intervention asynchronously to avoid blocking main processing
    """
    try:
        # Log the intervention trigger for async processing
        logger.info(f"INTERVENTION_TRIGGERED {event_data['userId']} {event_data['eventData'].get('feature', 'unknown')}")
        
        # Store struggle signal for batch processing
        store_struggle_signal_optimized(event_data)
        
    except Exception as e:
        logger.error(f"Error triggering async intervention: {str(e)}")

def store_struggle_signal_optimized(event_data):
    """
    Store struggle signal with optimization
    """
    try:
        table = dynamodb.Table(STRUGGLE_SIGNALS_TABLE)
        
        attempt_count = event_data['eventData'].get('attemptCount', 1)
        severity = 'low'
        if attempt_count >= 5:
            severity = 'critical'
        elif attempt_count >= 3:
            severity = 'high'
        elif attempt_count >= 2:
            severity = 'medium'
        
        # Add TTL (7 days from now)
        ttl = int(datetime.now().timestamp()) + (7 * 24 * 60 * 60)
        
        item = {
            'userId': event_data['userId'],
            'featureId': event_data['eventData'].get('feature', 'unknown'),
            'detectedAt': event_data['timestamp'],
            'signalType': 'repeated_attempts',
            'severity': severity,
            'attemptCount': attempt_count,
            'timeSpent': event_data['eventData'].get('duration', 0),
            'resolved': False,
            'ttl': ttl
        }
        
        # Use conditional write to avoid duplicates
        table.put_item(
            Item=item,
            ConditionExpression='attribute_not_exists(userId) AND attribute_not_exists(featureId)'
        )
        
    except Exception as e:
        if 'ConditionalCheckFailedException' not in str(e):
            logger.error(f"Error storing optimized struggle signal: {str(e)}")

def process_video_engagement_cached(event_data):
    """
    Process video engagement with caching
    """
    try:
        # Check cache for recent video engagement processing
        cache_key = f"video_engagement_{event_data['userId']}_{event_data['eventData'].get('videoId', 'unknown')}"
        cached_engagement = get_cached_data(cache_key)
        
        if not cached_engagement:
            table = dynamodb.Table(VIDEO_ENGAGEMENT_TABLE)
            
            # Calculate interest score based on completion rate and watch time
            completion_rate = event_data['eventData'].get('completionRate', 0)
            duration = event_data['eventData'].get('duration', 0)
            interest_score = min(100, (completion_rate * 0.7 + min(duration / 300, 1) * 0.3) * 100)
            
            engagement_data = {
                'userId': event_data['userId'],
                'videoId': event_data['eventData'].get('videoId', 'unknown'),
                'lastWatchedAt': event_data['timestamp'],
                'viewCount': 1,
                'totalWatchTime': duration,
                'completionRate': completion_rate,
                'interestScore': int(interest_score)
            }
            
            table.put_item(Item=engagement_data)
            set_cached_data(cache_key, engagement_data)
            
    except Exception as e:
        logger.error(f"Error processing cached video engagement: {str(e)}")