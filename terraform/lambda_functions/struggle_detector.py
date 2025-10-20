import json
import boto3
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional
import logging
from decimal import Decimal

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
sagemaker_runtime = boto3.client('sagemaker-runtime')
sns = boto3.client('sns')

# Environment variables
USER_PROFILES_TABLE = os.environ.get('USER_PROFILES_TABLE', 'user-journey-analytics-user-profiles-dev')
USER_EVENTS_TABLE = os.environ.get('USER_EVENTS_TABLE', 'user-journey-analytics-user-events-dev')
STRUGGLE_SIGNALS_TABLE = os.environ.get('STRUGGLE_SIGNALS_TABLE', 'user-journey-analytics-struggle-signals-dev')
SAGEMAKER_ENDPOINT = os.environ.get('SAGEMAKER_ENDPOINT', 'user-journey-exit-risk-predictor')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN', '')

def lambda_handler(event, context):
    """
    Lambda handler for struggle detection analysis
    """
    try:
        # Parse input from Bedrock Agent or direct invocation
        if 'inputText' in event:
            # Called from Bedrock Agent
            input_data = json.loads(event['inputText'])
        else:
            # Direct invocation
            input_data = event
        
        user_id = input_data.get('userId')
        if not user_id:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'userId is required'})
            }
        
        # Perform struggle analysis
        analysis_result = analyze_user_struggles(user_id, input_data)
        
        # Store results if struggle detected
        if analysis_result['riskLevel'] in ['medium', 'high', 'critical']:
            store_struggle_signal(user_id, analysis_result)
        
        return {
            'statusCode': 200,
            'body': json.dumps(analysis_result)
        }
        
    except Exception as e:
        logger.error(f"Struggle detector error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def analyze_user_struggles(user_id: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze user behavior patterns to detect struggles
    """
    try:
        # Get user's recent activity
        recent_events = get_recent_user_events(user_id)
        user_profile = get_user_profile(user_id)
        
        # Extract behavioral features
        features = extract_behavioral_features(recent_events, user_profile)
        
        # Calculate struggle indicators
        struggle_indicators = calculate_struggle_indicators(features)
        
        # Get ML prediction if available
        ml_risk_score = get_ml_risk_prediction(features)
        
        # Combine rule-based and ML analysis
        final_analysis = combine_analysis_results(struggle_indicators, ml_risk_score, features)
        
        return final_analysis
        
    except Exception as e:
        logger.error(f"Error in struggle analysis: {str(e)}")
        return {
            'riskLevel': 'unknown',
            'confidence': 0.0,
            'analysis': f'Analysis failed: {str(e)}',
            'recommendations': ['Manual review required']
        }

def get_recent_user_events(user_id: str, hours: int = 24) -> List[Dict[str, Any]]:
    """
    Get user's recent events for analysis
    """
    try:
        table = dynamodb.Table(USER_EVENTS_TABLE)
        
        # Calculate time range
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(hours=hours)
        
        # Query recent events
        response = table.query(
            KeyConditionExpression='userId = :userId AND #ts BETWEEN :start_time AND :end_time',
            ExpressionAttributeNames={'#ts': 'timestamp'},
            ExpressionAttributeValues={
                ':userId': user_id,
                ':start_time': start_time.isoformat(),
                ':end_time': end_time.isoformat()
            },
            ScanIndexForward=False,  # Most recent first
            Limit=100  # Limit to prevent excessive data processing
        )
        
        return response.get('Items', [])
        
    except Exception as e:
        logger.error(f"Error getting recent events: {str(e)}")
        return []

def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get user profile data
    """
    try:
        table = dynamodb.Table(USER_PROFILES_TABLE)
        response = table.get_item(Key={'userId': user_id})
        return response.get('Item')
        
    except Exception as e:
        logger.error(f"Error getting user profile: {str(e)}")
        return None

def extract_behavioral_features(events: List[Dict[str, Any]], profile: Optional[Dict[str, Any]]) -> Dict[str, float]:
    """
    Extract behavioral features for analysis
    """
    try:
        features = {
            'error_count': 0,
            'retry_count': 0,
            'help_requests': 0,
            'session_duration': 0,
            'page_exits': 0,
            'form_abandons': 0,
            'click_frustration': 0,
            'success_rate': 0,
            'engagement_score': 0,
            'time_since_last_success': 0,
            'session_count': 0,
            'unique_pages_visited': 0,
            'average_time_per_page': 0
        }
        
        if not events:
            return features
        
        # Analyze events
        session_ids = set()
        pages_visited = set()
        success_events = 0
        total_events = len(events)
        last_success_time = None
        
        # Group events by type
        event_counts = {}
        for event in events:
            event_type = event.get('eventType', '')
            event_counts[event_type] = event_counts.get(event_type, 0) + 1
            
            # Track specific indicators
            if event_type in ['error', 'exception', 'failure']:
                features['error_count'] += 1
            elif event_type in ['retry', 'repeat_action']:
                features['retry_count'] += 1
            elif event_type in ['help_requested', 'support_contact']:
                features['help_requests'] += 1
            elif event_type in ['page_exit', 'navigation_away']:
                features['page_exits'] += 1
            elif event_type in ['form_abandon', 'incomplete_form']:
                features['form_abandons'] += 1
            elif event_type in ['rapid_clicks', 'click_frustration']:
                features['click_frustration'] += 1
            elif event_type in ['success', 'task_completed', 'goal_achieved']:
                success_events += 1
                last_success_time = event.get('timestamp')
            
            # Track sessions and pages
            if event.get('sessionId'):
                session_ids.add(event['sessionId'])
            if event.get('properties', {}).get('page'):
                pages_visited.add(event['properties']['page'])
        
        # Calculate derived features
        features['session_count'] = len(session_ids)
        features['unique_pages_visited'] = len(pages_visited)
        features['success_rate'] = success_events / total_events if total_events > 0 else 0
        
        # Calculate time since last success
        if last_success_time:
            last_success = datetime.fromisoformat(last_success_time.replace('Z', '+00:00'))
            features['time_since_last_success'] = (datetime.now(timezone.utc) - last_success).total_seconds() / 3600
        
        # Add profile-based features
        if profile:
            behavior_metrics = profile.get('behaviorMetrics', {})
            features['engagement_score'] = behavior_metrics.get('videoEngagementScore', 0)
            features['historical_struggle_count'] = behavior_metrics.get('struggleCount', 0)
            features['historical_success_count'] = behavior_metrics.get('successfulActions', 0)
        
        return features
        
    except Exception as e:
        logger.error(f"Error extracting features: {str(e)}")
        return {}

def calculate_struggle_indicators(features: Dict[str, float]) -> Dict[str, Any]:
    """
    Calculate struggle indicators using rule-based logic
    """
    try:
        indicators = {
            'error_rate': 0,
            'frustration_level': 0,
            'engagement_decline': 0,
            'success_decline': 0,
            'help_seeking_behavior': 0
        }
        
        # Error rate indicator
        total_actions = sum([
            features.get('error_count', 0),
            features.get('retry_count', 0),
            features.get('success_rate', 0) * 10  # Approximate successful actions
        ])
        
        if total_actions > 0:
            indicators['error_rate'] = features.get('error_count', 0) / total_actions
        
        # Frustration level (multiple rapid actions, clicks, retries)
        frustration_signals = (
            features.get('retry_count', 0) * 0.3 +
            features.get('click_frustration', 0) * 0.4 +
            features.get('form_abandons', 0) * 0.3
        )
        indicators['frustration_level'] = min(1.0, frustration_signals / 10)
        
        # Engagement decline
        if features.get('engagement_score', 0) < 30:  # Low engagement threshold
            indicators['engagement_decline'] = 1.0 - (features.get('engagement_score', 0) / 100)
        
        # Success decline
        if features.get('success_rate', 0) < 0.3:  # Low success rate
            indicators['success_decline'] = 1.0 - features.get('success_rate', 0)
        
        # Help seeking behavior
        if features.get('help_requests', 0) > 0:
            indicators['help_seeking_behavior'] = min(1.0, features.get('help_requests', 0) / 5)
        
        return indicators
        
    except Exception as e:
        logger.error(f"Error calculating struggle indicators: {str(e)}")
        return {}

def get_ml_risk_prediction(features: Dict[str, float]) -> Dict[str, Any]:
    """
    Get ML-based risk prediction from SageMaker
    """
    try:
        if not SAGEMAKER_ENDPOINT:
            logger.warning("SageMaker endpoint not configured")
            return {'risk_score': 0.5, 'confidence': 0.0}
        
        # Prepare feature vector for ML model
        feature_vector = prepare_feature_vector(features)
        
        # Call SageMaker endpoint
        response = sagemaker_runtime.invoke_endpoint(
            EndpointName=SAGEMAKER_ENDPOINT,
            ContentType='application/json',
            Body=json.dumps({'instances': [feature_vector]})
        )
        
        # Parse response
        result = json.loads(response['Body'].read().decode())
        
        return {
            'risk_score': result.get('predictions', [0.5])[0],
            'confidence': result.get('confidence', 0.8),
            'model_version': result.get('model_version', '1.0')
        }
        
    except Exception as e:
        logger.error(f"Error getting ML prediction: {str(e)}")
        return {'risk_score': 0.5, 'confidence': 0.0}

def prepare_feature_vector(features: Dict[str, float]) -> List[float]:
    """
    Prepare feature vector for ML model
    """
    # Define the 13 features expected by the ML model
    feature_order = [
        'error_count', 'retry_count', 'help_requests', 'session_duration',
        'page_exits', 'form_abandons', 'click_frustration', 'success_rate',
        'engagement_score', 'time_since_last_success', 'session_count',
        'unique_pages_visited', 'average_time_per_page'
    ]
    
    return [features.get(feature, 0.0) for feature in feature_order]

def combine_analysis_results(
    struggle_indicators: Dict[str, Any],
    ml_prediction: Dict[str, Any],
    features: Dict[str, float]
) -> Dict[str, Any]:
    """
    Combine rule-based and ML analysis results
    """
    try:
        # Calculate overall risk score
        rule_based_score = calculate_rule_based_risk(struggle_indicators)
        ml_risk_score = ml_prediction.get('risk_score', 0.5)
        ml_confidence = ml_prediction.get('confidence', 0.0)
        
        # Weighted combination (favor ML if high confidence, otherwise use rules)
        if ml_confidence > 0.7:
            combined_score = 0.7 * ml_risk_score + 0.3 * rule_based_score
        else:
            combined_score = 0.4 * ml_risk_score + 0.6 * rule_based_score
        
        # Determine risk level
        if combined_score >= 0.8:
            risk_level = 'critical'
        elif combined_score >= 0.6:
            risk_level = 'high'
        elif combined_score >= 0.4:
            risk_level = 'medium'
        else:
            risk_level = 'low'
        
        # Generate analysis text
        analysis_text = generate_analysis_text(struggle_indicators, features, combined_score)
        
        # Generate recommendations
        recommendations = generate_recommendations(risk_level, struggle_indicators, features)
        
        return {
            'riskLevel': risk_level,
            'riskScore': combined_score,
            'confidence': max(ml_confidence, 0.6),  # Minimum confidence
            'analysis': analysis_text,
            'recommendations': recommendations,
            'struggleIndicators': struggle_indicators,
            'mlPrediction': ml_prediction,
            'features': features,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error combining analysis results: {str(e)}")
        return {
            'riskLevel': 'unknown',
            'confidence': 0.0,
            'analysis': f'Analysis combination failed: {str(e)}',
            'recommendations': ['Manual review required']
        }

def calculate_rule_based_risk(indicators: Dict[str, Any]) -> float:
    """
    Calculate risk score from rule-based indicators
    """
    weights = {
        'error_rate': 0.25,
        'frustration_level': 0.25,
        'engagement_decline': 0.2,
        'success_decline': 0.2,
        'help_seeking_behavior': 0.1
    }
    
    risk_score = sum(
        indicators.get(indicator, 0) * weight
        for indicator, weight in weights.items()
    )
    
    return min(1.0, risk_score)

def generate_analysis_text(
    indicators: Dict[str, Any],
    features: Dict[str, float],
    risk_score: float
) -> str:
    """
    Generate human-readable analysis text
    """
    analysis_parts = []
    
    if indicators.get('error_rate', 0) > 0.3:
        analysis_parts.append(f"High error rate detected ({indicators['error_rate']:.1%})")
    
    if indicators.get('frustration_level', 0) > 0.5:
        analysis_parts.append("Signs of user frustration observed")
    
    if features.get('help_requests', 0) > 0:
        analysis_parts.append(f"User has requested help {int(features['help_requests'])} times")
    
    if features.get('success_rate', 0) < 0.3:
        analysis_parts.append(f"Low success rate ({features['success_rate']:.1%})")
    
    if not analysis_parts:
        analysis_parts.append("User behavior appears normal")
    
    return f"Risk Score: {risk_score:.2f}. " + ". ".join(analysis_parts)

def generate_recommendations(
    risk_level: str,
    indicators: Dict[str, Any],
    features: Dict[str, float]
) -> List[str]:
    """
    Generate actionable recommendations
    """
    recommendations = []
    
    if risk_level in ['high', 'critical']:
        recommendations.append("Immediate intervention required")
        recommendations.append("Consider live chat or phone support")
        
        if indicators.get('error_rate', 0) > 0.3:
            recommendations.append("Review error messages and improve UX")
        
        if features.get('help_requests', 0) > 0:
            recommendations.append("Proactive support outreach recommended")
    
    elif risk_level == 'medium':
        recommendations.append("Monitor user closely")
        recommendations.append("Send helpful resources or tutorials")
        
        if indicators.get('frustration_level', 0) > 0.5:
            recommendations.append("Simplify current user flow")
    
    else:
        recommendations.append("Continue normal monitoring")
        recommendations.append("User appears to be progressing well")
    
    return recommendations

def store_struggle_signal(user_id: str, analysis_result: Dict[str, Any]):
    """
    Store struggle signal in DynamoDB and trigger intervention if critical
    """
    try:
        table = dynamodb.Table(STRUGGLE_SIGNALS_TABLE)
        
        # Convert float values to Decimal for DynamoDB
        def convert_floats(obj):
            if isinstance(obj, float):
                return Decimal(str(obj))
            elif isinstance(obj, dict):
                return {k: convert_floats(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_floats(v) for v in obj]
            return obj
        
        # Check if intervention should be triggered (exitRiskScore > 70)
        risk_score = analysis_result.get('riskScore', 0)
        should_trigger_intervention = risk_score > 0.70  # 70% threshold
        
        struggle_item = {
            'userId': user_id,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'signalId': f"{user_id}#{datetime.now(timezone.utc).isoformat()}",
            'riskLevel': analysis_result['riskLevel'],
            'riskScore': convert_floats(analysis_result['riskScore']),
            'confidence': convert_floats(analysis_result['confidence']),
            'analysis': analysis_result['analysis'],
            'recommendations': analysis_result['recommendations'],
            'struggleIndicators': convert_floats(analysis_result['struggleIndicators']),
            'features': convert_floats(analysis_result['features']),
            'interventionTriggered': should_trigger_intervention,
            'createdAt': datetime.now(timezone.utc).isoformat(),
            'ttl': int((datetime.now(timezone.utc).timestamp() + (30 * 24 * 60 * 60)))  # 30 days TTL
        }
        
        table.put_item(Item=struggle_item)
        logger.info(f"Stored struggle signal for user: {user_id}, risk level: {analysis_result['riskLevel']}, risk score: {risk_score}")
        
        # Trigger critical intervention if risk score > 70
        if should_trigger_intervention:
            logger.info(f"Triggering critical intervention for user: {user_id} (risk score: {risk_score})")
            trigger_critical_intervention(user_id, analysis_result)
        
    except Exception as e:
        logger.error(f"Error storing struggle signal: {str(e)}")
        raise

def trigger_critical_intervention(user_id: str, analysis_result: Dict[str, Any]):
    """
    Trigger critical intervention for high-risk users
    """
    try:
        # Prepare intervention payload
        intervention_payload = {
            'userId': user_id,
            'interventionType': 'live_chat_offer',
            'riskLevel': analysis_result['riskLevel'],
            'riskScore': analysis_result['riskScore'],
            'trigger': 'automatic_high_risk',
            'context': {
                'analysis': analysis_result['analysis'],
                'recommendations': analysis_result['recommendations'],
                'features': analysis_result.get('features', {}),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
        }
        
        # Send to SNS topic for real-time delivery to frontend
        if SNS_TOPIC_ARN:
            sns.publish(
                TopicArn=SNS_TOPIC_ARN,
                Message=json.dumps({
                    'type': 'critical_intervention',
                    'action': 'show_live_chat_popup',
                    'userId': user_id,
                    'payload': intervention_payload
                }),
                Subject=f'Critical Intervention Required - User {user_id}',
                MessageAttributes={
                    'userId': {'DataType': 'String', 'StringValue': user_id},
                    'interventionType': {'DataType': 'String', 'StringValue': 'live_chat_offer'},
                    'priority': {'DataType': 'String', 'StringValue': 'critical'}
                }
            )
            logger.info(f"Published critical intervention to SNS for user: {user_id}")
        
        # Also invoke intervention executor Lambda asynchronously
        try:
            lambda_client = boto3.client('lambda')
            lambda_client.invoke(
                FunctionName='intervention-executor',  # Update with actual function name
                InvocationType='Event',  # Asynchronous invocation
                Payload=json.dumps(intervention_payload)
            )
            logger.info(f"Invoked intervention executor for user: {user_id}")
        except Exception as lambda_error:
            logger.error(f"Error invoking intervention executor: {str(lambda_error)}")
            # Don't fail the main flow if Lambda invocation fails
        
    except Exception as e:
        logger.error(f"Error triggering critical intervention: {str(e)}")
        # Don't fail the main flow if intervention trigger fails