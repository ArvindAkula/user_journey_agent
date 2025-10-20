import json
import base64
import boto3
import os
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
bedrock_agent = boto3.client('bedrock-agent-runtime')
sagemaker_runtime = boto3.client('sagemaker-runtime')
sns = boto3.client('sns')

# Environment variables
USER_PROFILES_TABLE = os.environ.get('USER_PROFILES_TABLE', 'user-journey-analytics-user-profiles-dev')
USER_EVENTS_TABLE = os.environ.get('USER_EVENTS_TABLE', 'user-journey-analytics-user-events-dev')
STRUGGLE_SIGNALS_TABLE = os.environ.get('STRUGGLE_SIGNALS_TABLE', 'user-journey-analytics-struggle-signals-dev')
VIDEO_ENGAGEMENT_TABLE = os.environ.get('VIDEO_ENGAGEMENT_TABLE', 'user-journey-analytics-video-engagement-dev')
BEDROCK_AGENT_ID = os.environ.get('BEDROCK_AGENT_ID', '')
BEDROCK_AGENT_ALIAS_ID = os.environ.get('BEDROCK_AGENT_ALIAS_ID', 'TSTALIASID')
SAGEMAKER_ENDPOINT = os.environ.get('SAGEMAKER_ENDPOINT', 'user-journey-exit-risk-predictor')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN', '')

def lambda_handler(event, context):
    """
    Main Lambda handler for processing Kinesis events
    """
    try:
        processed_events = 0
        failed_events = 0
        
        logger.info(f"Processing {len(event['Records'])} Kinesis records")
        
        for record in event['Records']:
            try:
                # Decode Kinesis data
                payload = base64.b64decode(record['kinesis']['data'])
                event_data = json.loads(payload.decode('utf-8'))
                
                # Process the event
                await process_user_event(event_data)
                processed_events += 1
                
            except Exception as e:
                logger.error(f"Failed to process record: {str(e)}")
                failed_events += 1
                continue
        
        logger.info(f"Processing complete. Success: {processed_events}, Failed: {failed_events}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'processed': processed_events,
                'failed': failed_events
            })
        }
        
    except Exception as e:
        logger.error(f"Lambda handler error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

async def process_user_event(event_data: Dict[str, Any]):
    """
    Process individual user event
    """
    try:
        user_id = event_data.get('userId')
        event_type = event_data.get('eventType')
        timestamp = event_data.get('timestamp', datetime.now(timezone.utc).isoformat())
        
        if not user_id or not event_type:
            logger.warning("Missing required fields: userId or eventType")
            return
        
        # Store the event
        await store_user_event(event_data)
        
        # Update user profile
        await update_user_profile(user_id, event_data)
        
        # Analyze for struggles and interventions
        if should_analyze_event(event_type):
            await analyze_user_behavior(user_id, event_data)
        
        # Process video events specifically
        if event_type.startswith('video_'):
            await process_video_event(user_id, event_data)
            
    except Exception as e:
        logger.error(f"Error processing user event: {str(e)}")
        raise

async def store_user_event(event_data: Dict[str, Any]):
    """
    Store user event in DynamoDB
    """
    try:
        table = dynamodb.Table(USER_EVENTS_TABLE)
        
        # Prepare event item
        event_item = {
            'userId': event_data['userId'],
            'timestamp': event_data.get('timestamp', datetime.now(timezone.utc).isoformat()),
            'eventType': event_data['eventType'],
            'sessionId': event_data.get('sessionId', ''),
            'properties': event_data.get('properties', {}),
            'metadata': {
                'source': event_data.get('source', 'unknown'),
                'platform': event_data.get('platform', 'unknown'),
                'version': event_data.get('version', '1.0'),
                'processedAt': datetime.now(timezone.utc).isoformat()
            },
            'ttl': int((datetime.now(timezone.utc).timestamp() + (365 * 24 * 60 * 60)))  # 1 year TTL
        }
        
        # Add sort key for efficient querying
        event_item['eventId'] = f"{event_data['userId']}#{event_data.get('timestamp', datetime.now(timezone.utc).isoformat())}"
        
        table.put_item(Item=event_item)
        logger.info(f"Stored event: {event_data['eventType']} for user: {event_data['userId']}")
        
    except Exception as e:
        logger.error(f"Error storing user event: {str(e)}")
        raise

async def update_user_profile(user_id: str, event_data: Dict[str, Any]):
    """
    Update user profile with latest activity
    """
    try:
        table = dynamodb.Table(USER_PROFILES_TABLE)
        
        # Get current profile or create new one
        response = table.get_item(Key={'userId': user_id})
        
        if 'Item' in response:
            profile = response['Item']
        else:
            profile = {
                'userId': user_id,
                'createdAt': datetime.now(timezone.utc).isoformat(),
                'totalEvents': 0,
                'lastActivity': {},
                'behaviorMetrics': {
                    'struggleCount': 0,
                    'successfulActions': 0,
                    'averageSessionDuration': 0,
                    'videoEngagementScore': 0
                }
            }
        
        # Update profile
        profile['lastActivity'] = {
            'timestamp': event_data.get('timestamp', datetime.now(timezone.utc).isoformat()),
            'eventType': event_data['eventType'],
            'sessionId': event_data.get('sessionId', '')
        }
        profile['totalEvents'] = profile.get('totalEvents', 0) + 1
        profile['updatedAt'] = datetime.now(timezone.utc).isoformat()
        
        # Update behavior metrics based on event type
        if event_data['eventType'] in ['error', 'retry', 'help_requested']:
            profile['behaviorMetrics']['struggleCount'] += 1
        elif event_data['eventType'] in ['task_completed', 'goal_achieved', 'success']:
            profile['behaviorMetrics']['successfulActions'] += 1
        
        table.put_item(Item=profile)
        logger.info(f"Updated profile for user: {user_id}")
        
    except Exception as e:
        logger.error(f"Error updating user profile: {str(e)}")
        raise

def should_analyze_event(event_type: str) -> bool:
    """
    Determine if event should trigger AI analysis
    """
    analysis_triggers = [
        'error', 'retry', 'help_requested', 'page_exit', 'form_abandon',
        'video_pause', 'video_rewind', 'session_timeout', 'click_frustration'
    ]
    return event_type in analysis_triggers

async def analyze_user_behavior(user_id: str, event_data: Dict[str, Any]):
    """
    Trigger AI analysis for potential struggles
    """
    try:
        if not BEDROCK_AGENT_ID:
            logger.warning("Bedrock Agent ID not configured, skipping AI analysis")
            return
        
        # Prepare context for Bedrock Agent
        context = {
            'userId': user_id,
            'currentEvent': event_data,
            'analysisType': 'struggle_detection',
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        # Invoke Bedrock Agent
        response = bedrock_agent.invoke_agent(
            agentId=BEDROCK_AGENT_ID,
            agentAliasId=BEDROCK_AGENT_ALIAS_ID,
            sessionId=f"session-{user_id}-{int(datetime.now().timestamp())}",
            inputText=f"Analyze user behavior for struggle detection: {json.dumps(context)}"
        )
        
        # Process agent response
        if 'completion' in response:
            await process_ai_analysis_result(user_id, response['completion'])
        
    except Exception as e:
        logger.error(f"Error in AI behavior analysis: {str(e)}")
        # Continue processing even if AI analysis fails

async def process_video_event(user_id: str, event_data: Dict[str, Any]):
    """
    Process video-specific events
    """
    try:
        table = dynamodb.Table(VIDEO_ENGAGEMENT_TABLE)
        
        video_id = event_data.get('properties', {}).get('videoId')
        if not video_id:
            return
        
        # Create or update video engagement record
        engagement_item = {
            'userId': user_id,
            'videoId': video_id,
            'eventType': event_data['eventType'],
            'timestamp': event_data.get('timestamp', datetime.now(timezone.utc).isoformat()),
            'properties': event_data.get('properties', {}),
            'sessionId': event_data.get('sessionId', ''),
            'engagementScore': calculate_engagement_score(event_data),
            'updatedAt': datetime.now(timezone.utc).isoformat()
        }
        
        # Use composite key for video engagement
        engagement_item['engagementId'] = f"{user_id}#{video_id}#{event_data.get('timestamp', datetime.now(timezone.utc).isoformat())}"
        
        table.put_item(Item=engagement_item)
        
        # Trigger video intelligence analysis if needed
        if event_data['eventType'] in ['video_completed', 'video_abandoned']:
            await analyze_video_engagement(user_id, video_id, event_data)
        
    except Exception as e:
        logger.error(f"Error processing video event: {str(e)}")

def calculate_engagement_score(event_data: Dict[str, Any]) -> float:
    """
    Calculate engagement score based on video event
    """
    try:
        properties = event_data.get('properties', {})
        event_type = event_data['eventType']
        
        # Base scores for different event types
        base_scores = {
            'video_start': 10,
            'video_play': 15,
            'video_pause': 5,
            'video_resume': 10,
            'video_seek': 8,
            'video_completed': 50,
            'video_abandoned': -10,
            'video_rewind': 12,  # Indicates engagement
            'video_speed_change': 8
        }
        
        score = base_scores.get(event_type, 0)
        
        # Adjust based on watch duration
        duration = properties.get('duration', 0)
        watch_time = properties.get('watchTime', 0)
        
        if duration > 0 and watch_time > 0:
            completion_rate = watch_time / duration
            score *= (1 + completion_rate)
        
        return max(0, min(100, score))  # Clamp between 0-100
        
    except Exception as e:
        logger.error(f"Error calculating engagement score: {str(e)}")
        return 0

async def analyze_video_engagement(user_id: str, video_id: str, event_data: Dict[str, Any]):
    """
    Analyze video engagement patterns using AI
    """
    try:
        if not BEDROCK_AGENT_ID:
            logger.warning("Bedrock Agent ID not configured, skipping video analysis")
            return
        
        context = {
            'userId': user_id,
            'videoId': video_id,
            'eventData': event_data,
            'analysisType': 'video_engagement',
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        # Invoke Bedrock Agent for video analysis
        response = bedrock_agent.invoke_agent(
            agentId=BEDROCK_AGENT_ID,
            agentAliasId=BEDROCK_AGENT_ALIAS_ID,
            sessionId=f"video-session-{user_id}-{int(datetime.now().timestamp())}",
            inputText=f"Analyze video engagement patterns: {json.dumps(context)}"
        )
        
        if 'completion' in response:
            await process_video_analysis_result(user_id, video_id, response['completion'])
        
    except Exception as e:
        logger.error(f"Error in video engagement analysis: {str(e)}")

async def process_ai_analysis_result(user_id: str, analysis_result: str):
    """
    Process AI analysis results and trigger interventions if needed
    """
    try:
        # Parse AI response (assuming JSON format)
        try:
            result = json.loads(analysis_result)
        except:
            # If not JSON, treat as text response
            result = {'analysis': analysis_result, 'riskLevel': 'unknown'}
        
        risk_level = result.get('riskLevel', 'low')
        
        if risk_level in ['high', 'critical']:
            # Store struggle signal
            await store_struggle_signal(user_id, result)
            
            # Trigger intervention
            await trigger_intervention(user_id, result)
        
    except Exception as e:
        logger.error(f"Error processing AI analysis result: {str(e)}")

async def store_struggle_signal(user_id: str, analysis_result: Dict[str, Any]):
    """
    Store detected struggle signal
    """
    try:
        table = dynamodb.Table(STRUGGLE_SIGNALS_TABLE)
        
        struggle_item = {
            'userId': user_id,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'riskLevel': analysis_result.get('riskLevel', 'unknown'),
            'struggleType': analysis_result.get('struggleType', 'general'),
            'confidence': analysis_result.get('confidence', 0.5),
            'analysis': analysis_result.get('analysis', ''),
            'recommendations': analysis_result.get('recommendations', []),
            'interventionTriggered': False,
            'createdAt': datetime.now(timezone.utc).isoformat()
        }
        
        # Generate unique ID
        struggle_item['signalId'] = f"{user_id}#{datetime.now(timezone.utc).isoformat()}"
        
        table.put_item(Item=struggle_item)
        logger.info(f"Stored struggle signal for user: {user_id}")
        
    except Exception as e:
        logger.error(f"Error storing struggle signal: {str(e)}")

async def trigger_intervention(user_id: str, analysis_result: Dict[str, Any]):
    """
    Trigger appropriate intervention based on analysis
    """
    try:
        # Check if this is a critical intervention (exitRiskScore > 70)
        exit_risk_score = analysis_result.get('exitRiskScore', 0)
        risk_level = analysis_result.get('riskLevel', 'unknown')
        should_trigger_critical = exit_risk_score > 70 or risk_level in ['high', 'critical']
        
        intervention_message = {
            'userId': user_id,
            'interventionType': 'live_chat_offer' if should_trigger_critical else 'struggle_detected',
            'riskLevel': risk_level,
            'riskScore': exit_risk_score,
            'recommendations': analysis_result.get('recommendations', []),
            'context': {
                'analysis': analysis_result.get('description', ''),
                'detectedAt': datetime.now(timezone.utc).isoformat()
            },
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        # 1. Send to SNS for real-time frontend delivery
        if SNS_TOPIC_ARN:
            sns.publish(
                TopicArn=SNS_TOPIC_ARN,
                Message=json.dumps({
                    'type': 'critical_intervention' if should_trigger_critical else 'intervention',
                    'action': 'show_live_chat_popup' if should_trigger_critical else 'notify',
                    'userId': user_id,
                    'payload': intervention_message
                }),
                Subject=f"User Intervention Required - {risk_level} Risk",
                MessageAttributes={
                    'userId': {'DataType': 'String', 'StringValue': user_id},
                    'priority': {'DataType': 'String', 'StringValue': 'critical' if should_trigger_critical else 'normal'}
                }
            )
            logger.info(f"Published intervention to SNS for user: {user_id}")
        
        # 2. Invoke intervention-executor Lambda for critical cases
        if should_trigger_critical:
            lambda_client = boto3.client('lambda')
            try:
                lambda_client.invoke(
                    FunctionName='intervention-executor',
                    InvocationType='Event',  # Asynchronous
                    Payload=json.dumps(intervention_message)
                )
                logger.info(f"✅ Invoked intervention-executor Lambda for user: {user_id} (exitRiskScore: {exit_risk_score})")
            except Exception as lambda_error:
                logger.error(f"Failed to invoke intervention-executor: {str(lambda_error)}")
                # Don't fail the main flow if Lambda invocation fails
        
        logger.info(f"Triggered intervention for user: {user_id}, critical: {should_trigger_critical}")
        
    except Exception as e:
        logger.error(f"Error triggering intervention: {str(e)}")

async def process_video_analysis_result(user_id: str, video_id: str, analysis_result: str):
    """
    Process video analysis results
    """
    try:
        # Update video engagement record with AI insights
        table = dynamodb.Table(VIDEO_ENGAGEMENT_TABLE)
        
        # This would update the existing video engagement record
        # with AI-generated insights about user engagement patterns
        logger.info(f"Processed video analysis for user: {user_id}, video: {video_id}")
        
    except Exception as e:
        logger.error(f"Error processing video analysis result: {str(e)}")