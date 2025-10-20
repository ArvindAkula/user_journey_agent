import json
import boto3
import os
from datetime import datetime, timedelta
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
timestream_write = boto3.client('timestream-write')

# Environment variables
ENVIRONMENT = os.environ.get('ENVIRONMENT', '${environment}')
STRUGGLE_SIGNALS_TABLE = os.environ.get('STRUGGLE_SIGNALS_TABLE')
USER_PROFILES_TABLE = os.environ.get('USER_PROFILES_TABLE')
TIMESTREAM_DATABASE = os.environ.get('TIMESTREAM_DATABASE')

def lambda_handler(event, context):
    """
    Bedrock Agent action group handler for struggle detection
    """
    try:
        # Parse the input from Bedrock Agent
        input_data = json.loads(event.get('inputText', '{}'))
        
        user_id = input_data.get('userId')
        struggle_type = input_data.get('struggleType')
        attempt_count = input_data.get('attemptCount', 1)
        
        if not user_id:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'userId is required'})
            }
        
        # Analyze struggle pattern
        struggle_analysis = analyze_struggle_pattern(user_id, struggle_type, attempt_count)
        
        # Generate intervention recommendation
        intervention = generate_intervention_recommendation(struggle_analysis)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'analysis': struggle_analysis,
                'intervention': intervention
            })
        }
        
    except Exception as e:
        logger.error(f"Error in struggle detector: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def analyze_struggle_pattern(user_id, struggle_type, attempt_count):
    """
    Analyze user's struggle pattern
    """
    try:
        table = dynamodb.Table(STRUGGLE_SIGNALS_TABLE)
        
        # Query recent struggle signals for this user
        response = table.query(
            KeyConditionExpression='userId = :userId',
            FilterExpression='detectedAt > :recent_time',
            ExpressionAttributeValues={
                ':userId': user_id,
                ':recent_time': int((datetime.now() - timedelta(hours=24)).timestamp() * 1000)
            }
        )
        
        struggle_signals = response.get('Items', [])
        
        # Analyze patterns
        total_struggles = len(struggle_signals)
        feature_struggles = len([s for s in struggle_signals if s.get('featureId') == struggle_type])
        severity_counts = {}
        
        for signal in struggle_signals:
            severity = signal.get('severity', 'low')
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        # Determine current severity
        current_severity = 'low'
        if attempt_count >= 5:
            current_severity = 'critical'
        elif attempt_count >= 3:
            current_severity = 'high'
        elif attempt_count >= 2:
            current_severity = 'medium'
        
        analysis = {
            'userId': user_id,
            'currentStruggle': {
                'type': struggle_type,
                'attemptCount': attempt_count,
                'severity': current_severity
            },
            'recentPattern': {
                'totalStruggles24h': total_struggles,
                'featureSpecificStruggles': feature_struggles,
                'severityDistribution': severity_counts
            },
            'riskLevel': calculate_risk_level(total_struggles, attempt_count, severity_counts)
        }
        
        # Store analysis in Timestream
        store_struggle_analysis(analysis)
        
        return analysis
        
    except Exception as e:
        logger.error(f"Error analyzing struggle pattern: {str(e)}")
        return {
            'userId': user_id,
            'error': str(e)
        }

def calculate_risk_level(total_struggles, attempt_count, severity_counts):
    """
    Calculate user's risk level based on struggle patterns
    """
    risk_score = 0
    
    # Base score from current attempt count
    risk_score += min(attempt_count * 10, 50)
    
    # Add score for recent struggles
    risk_score += min(total_struggles * 5, 30)
    
    # Add score for severity distribution
    risk_score += severity_counts.get('critical', 0) * 15
    risk_score += severity_counts.get('high', 0) * 10
    risk_score += severity_counts.get('medium', 0) * 5
    
    # Determine risk level
    if risk_score >= 80:
        return 'critical'
    elif risk_score >= 60:
        return 'high'
    elif risk_score >= 40:
        return 'medium'
    else:
        return 'low'

def generate_intervention_recommendation(analysis):
    """
    Generate intervention recommendation based on analysis
    """
    risk_level = analysis.get('riskLevel', 'low')
    struggle_type = analysis.get('currentStruggle', {}).get('type', 'unknown')
    attempt_count = analysis.get('currentStruggle', {}).get('attemptCount', 1)
    
    interventions = {
        'critical': {
            'immediate': [
                'Trigger live chat support',
                'Send priority notification to support team',
                'Offer phone call assistance'
            ],
            'followUp': [
                'Schedule follow-up call within 1 hour',
                'Assign dedicated support agent',
                'Escalate to product team for UX review'
            ]
        },
        'high': {
            'immediate': [
                'Show contextual help tooltip',
                'Offer video tutorial',
                'Send personalized assistance email'
            ],
            'followUp': [
                'Monitor for resolution within 2 hours',
                'Send follow-up survey after completion'
            ]
        },
        'medium': {
            'immediate': [
                'Display helpful hints',
                'Suggest alternative approach',
                'Show FAQ section'
            ],
            'followUp': [
                'Track completion rate',
                'Collect feedback on experience'
            ]
        },
        'low': {
            'immediate': [
                'Show progress indicator',
                'Provide gentle guidance'
            ],
            'followUp': [
                'Monitor for escalation'
            ]
        }
    }
    
    # Feature-specific interventions
    feature_interventions = {
        'document_upload': [
            'Check file size and format requirements',
            'Provide upload troubleshooting guide',
            'Offer alternative upload methods'
        ],
        'form_completion': [
            'Highlight required fields',
            'Provide field-specific help text',
            'Save progress automatically'
        ],
        'calculator': [
            'Show example calculations',
            'Provide input validation feedback',
            'Offer guided calculation mode'
        ]
    }
    
    recommendation = interventions.get(risk_level, interventions['low'])
    
    # Add feature-specific interventions
    if struggle_type in feature_interventions:
        recommendation['featureSpecific'] = feature_interventions[struggle_type]
    
    return {
        'riskLevel': risk_level,
        'priority': 'high' if risk_level in ['critical', 'high'] else 'normal',
        'interventions': recommendation,
        'estimatedResolutionTime': get_estimated_resolution_time(risk_level),
        'successProbability': get_success_probability(analysis)
    }

def get_estimated_resolution_time(risk_level):
    """
    Get estimated time to resolve the struggle
    """
    times = {
        'critical': '15-30 minutes',
        'high': '30-60 minutes',
        'medium': '1-2 hours',
        'low': '2-4 hours'
    }
    return times.get(risk_level, '2-4 hours')

def get_success_probability(analysis):
    """
    Calculate probability of successful resolution
    """
    risk_level = analysis.get('riskLevel', 'low')
    attempt_count = analysis.get('currentStruggle', {}).get('attemptCount', 1)
    
    base_probability = {
        'critical': 60,
        'high': 75,
        'medium': 85,
        'low': 95
    }.get(risk_level, 85)
    
    # Reduce probability based on attempt count
    probability = max(base_probability - (attempt_count - 1) * 5, 30)
    
    return f"{probability}%"

def store_struggle_analysis(analysis):
    """
    Store struggle analysis in Timestream
    """
    try:
        records = [{
            'Time': str(int(datetime.now().timestamp() * 1000)),
            'TimeUnit': 'MILLISECONDS',
            'Dimensions': [
                {'Name': 'userId', 'Value': analysis['userId']},
                {'Name': 'struggleType', 'Value': analysis['currentStruggle']['type']},
                {'Name': 'riskLevel', 'Value': analysis['riskLevel']}
            ],
            'MeasureName': 'struggle_analysis',
            'MeasureValue': str(analysis['currentStruggle']['attemptCount']),
            'MeasureValueType': 'BIGINT'
        }]
        
        timestream_write.write_records(
            DatabaseName=TIMESTREAM_DATABASE,
            TableName='struggle-signals-timeseries',
            Records=records
        )
        
    except Exception as e:
        logger.error(f"Error storing struggle analysis: {str(e)}")