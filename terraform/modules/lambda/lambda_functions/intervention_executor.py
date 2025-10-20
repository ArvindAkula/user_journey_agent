import json
import boto3
import os
from datetime import datetime
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')
ses = boto3.client('ses')

# Environment variables
ENVIRONMENT = os.environ.get('ENVIRONMENT', '${environment}')
USER_PROFILES_TABLE = os.environ.get('USER_PROFILES_TABLE')
STRUGGLE_SIGNALS_TABLE = os.environ.get('STRUGGLE_SIGNALS_TABLE')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN')

def lambda_handler(event, context):
    """
    Bedrock Agent action group handler for executing interventions
    """
    try:
        # Parse the input from Bedrock Agent
        input_data = json.loads(event.get('inputText', '{}'))
        
        user_id = input_data.get('userId')
        intervention_type = input_data.get('interventionType', 'general')
        priority = input_data.get('priority', 'normal')
        context_data = input_data.get('context', {})
        
        if not user_id:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'userId is required'})
            }
        
        # Execute intervention based on type and priority
        result = execute_intervention(user_id, intervention_type, priority, context_data)
        
        # Log intervention execution
        log_intervention_execution(user_id, intervention_type, priority, result)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'interventionExecuted': True,
                'type': intervention_type,
                'priority': priority,
                'result': result
            })
        }
        
    except Exception as e:
        logger.error(f"Error in intervention executor: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def execute_intervention(user_id, intervention_type, priority, context_data):
    """
    Execute the appropriate intervention based on type and priority
    """
    try:
        # Get user profile for personalization
        user_profile = get_user_profile(user_id)
        
        result = {
            'actionsExecuted': [],
            'notifications': [],
            'followUpScheduled': []
        }
        
        # Execute interventions based on priority
        if priority == 'high' or priority == 'critical':
            result.update(execute_high_priority_intervention(user_id, intervention_type, context_data, user_profile))
        elif priority == 'normal':
            result.update(execute_normal_priority_intervention(user_id, intervention_type, context_data, user_profile))
        else:
            result.update(execute_low_priority_intervention(user_id, intervention_type, context_data, user_profile))
        
        # Update user profile with intervention history
        update_user_intervention_history(user_id, intervention_type, priority)
        
        return result
        
    except Exception as e:
        logger.error(f"Error executing intervention: {str(e)}")
        return {'error': str(e)}

def execute_high_priority_intervention(user_id, intervention_type, context_data, user_profile):
    """
    Execute high priority interventions (immediate response required)
    """
    result = {
        'actionsExecuted': [],
        'notifications': [],
        'followUpScheduled': []
    }
    
    # Send immediate notifications
    if intervention_type == 'struggle_critical':
        # Send push notification
        push_result = send_push_notification(user_id, {
            'title': 'We\'re Here to Help!',
            'message': 'Having trouble? Our support team is ready to assist you.',
            'action': 'open_support_chat'
        })
        result['notifications'].append(push_result)
        
        # Notify support team
        support_result = notify_support_team(user_id, context_data, 'critical')
        result['notifications'].append(support_result)
        
        # Schedule immediate follow-up
        result['followUpScheduled'].append({
            'type': 'support_call',
            'scheduledIn': '15 minutes',
            'priority': 'critical'
        })
        
        result['actionsExecuted'].extend([
            'immediate_push_notification',
            'support_team_alert',
            'priority_support_queue'
        ])
    
    elif intervention_type == 'exit_risk_high':
        # Send personalized retention email
        email_result = send_personalized_email(user_id, user_profile, 'retention_high_risk')
        result['notifications'].append(email_result)
        
        # Trigger phone outreach
        result['followUpScheduled'].append({
            'type': 'phone_outreach',
            'scheduledIn': '30 minutes',
            'priority': 'high'
        })
        
        result['actionsExecuted'].extend([
            'personalized_retention_email',
            'phone_outreach_scheduled'
        ])
    
    return result

def execute_normal_priority_intervention(user_id, intervention_type, context_data, user_profile):
    """
    Execute normal priority interventions
    """
    result = {
        'actionsExecuted': [],
        'notifications': [],
        'followUpScheduled': []
    }
    
    if intervention_type == 'struggle_medium':
        # Send helpful email with resources
        email_result = send_helpful_email(user_id, context_data.get('struggleType', 'general'))
        result['notifications'].append(email_result)
        
        # Schedule follow-up check
        result['followUpScheduled'].append({
            'type': 'progress_check',
            'scheduledIn': '2 hours',
            'priority': 'normal'
        })
        
        result['actionsExecuted'].extend([
            'helpful_resources_email',
            'progress_monitoring'
        ])
    
    elif intervention_type == 'video_engagement_low':
        # Send content recommendation email
        email_result = send_content_recommendations(user_id, user_profile)
        result['notifications'].append(email_result)
        
        result['actionsExecuted'].append('content_recommendations_sent')
    
    elif intervention_type == 'feature_guidance':
        # Send feature tutorial
        tutorial_result = send_feature_tutorial(user_id, context_data.get('feature', 'general'))
        result['notifications'].append(tutorial_result)
        
        result['actionsExecuted'].append('tutorial_sent')
    
    return result

def execute_low_priority_intervention(user_id, intervention_type, context_data, user_profile):
    """
    Execute low priority interventions
    """
    result = {
        'actionsExecuted': [],
        'notifications': [],
        'followUpScheduled': []
    }
    
    # Low priority interventions are typically in-app guidance
    if intervention_type == 'gentle_guidance':
        result['actionsExecuted'].append('in_app_tooltip_triggered')
        
    elif intervention_type == 'progress_encouragement':
        # Send encouraging push notification
        push_result = send_push_notification(user_id, {
            'title': 'Great Progress!',
            'message': 'You\'re doing well. Keep it up!',
            'action': 'continue_journey'
        })
        result['notifications'].append(push_result)
        result['actionsExecuted'].append('encouragement_notification')
    
    return result

def get_user_profile(user_id):
    """
    Get user profile from DynamoDB
    """
    try:
        table = dynamodb.Table(USER_PROFILES_TABLE)
        response = table.get_item(Key={'userId': user_id})
        return response.get('Item', {})
    except Exception as e:
        logger.error(f"Error getting user profile: {str(e)}")
        return {}

def send_push_notification(user_id, notification_data):
    """
    Send push notification via SNS
    """
    try:
        if not SNS_TOPIC_ARN:
            return {'status': 'skipped', 'reason': 'SNS topic not configured'}
        
        message = {
            'userId': user_id,
            'type': 'push_notification',
            'data': notification_data
        }
        
        response = sns.publish(
            TopicArn=SNS_TOPIC_ARN,
            Message=json.dumps(message),
            Subject=f"User Intervention: {user_id}"
        )
        
        return {
            'status': 'sent',
            'type': 'push_notification',
            'messageId': response['MessageId']
        }
        
    except Exception as e:
        logger.error(f"Error sending push notification: {str(e)}")
        return {'status': 'failed', 'error': str(e)}

def notify_support_team(user_id, context_data, priority):
    """
    Notify support team of user issue
    """
    try:
        if not SNS_TOPIC_ARN:
            return {'status': 'skipped', 'reason': 'SNS topic not configured'}
        
        message = {
            'type': 'support_alert',
            'userId': user_id,
            'priority': priority,
            'context': context_data,
            'timestamp': datetime.now().isoformat()
        }
        
        response = sns.publish(
            TopicArn=SNS_TOPIC_ARN,
            Message=json.dumps(message),
            Subject=f"Support Alert - {priority.upper()} - User {user_id}"
        )
        
        return {
            'status': 'sent',
            'type': 'support_alert',
            'messageId': response['MessageId']
        }
        
    except Exception as e:
        logger.error(f"Error notifying support team: {str(e)}")
        return {'status': 'failed', 'error': str(e)}

def send_personalized_email(user_id, user_profile, email_type):
    """
    Send personalized email via SES
    """
    try:
        # Email templates based on type
        templates = {
            'retention_high_risk': {
                'subject': 'We\'re Here to Help You Succeed',
                'body': f"""
                Hi there,
                
                We noticed you might be experiencing some challenges with your application.
                Our team is here to help you every step of the way.
                
                Would you like to schedule a quick call with one of our specialists?
                
                Best regards,
                The Support Team
                """
            }
        }
        
        template = templates.get(email_type, templates['retention_high_risk'])
        
        # This would typically use SES templates in production
        response = {
            'status': 'would_send',
            'type': 'personalized_email',
            'template': email_type,
            'reason': 'SES not configured in demo'
        }
        
        return response
        
    except Exception as e:
        logger.error(f"Error sending personalized email: {str(e)}")
        return {'status': 'failed', 'error': str(e)}

def send_helpful_email(user_id, struggle_type):
    """
    Send helpful email with resources
    """
    try:
        # Resource mapping based on struggle type
        resources = {
            'document_upload': 'Document Upload Help Guide',
            'form_completion': 'Form Completion Tips',
            'calculator': 'Calculator Usage Tutorial',
            'general': 'General Help Resources'
        }
        
        resource = resources.get(struggle_type, resources['general'])
        
        return {
            'status': 'would_send',
            'type': 'helpful_email',
            'resource': resource,
            'reason': 'SES not configured in demo'
        }
        
    except Exception as e:
        logger.error(f"Error sending helpful email: {str(e)}")
        return {'status': 'failed', 'error': str(e)}

def send_content_recommendations(user_id, user_profile):
    """
    Send content recommendations based on user profile
    """
    try:
        return {
            'status': 'would_send',
            'type': 'content_recommendations',
            'reason': 'SES not configured in demo'
        }
        
    except Exception as e:
        logger.error(f"Error sending content recommendations: {str(e)}")
        return {'status': 'failed', 'error': str(e)}

def send_feature_tutorial(user_id, feature):
    """
    Send feature-specific tutorial
    """
    try:
        return {
            'status': 'would_send',
            'type': 'feature_tutorial',
            'feature': feature,
            'reason': 'SES not configured in demo'
        }
        
    except Exception as e:
        logger.error(f"Error sending feature tutorial: {str(e)}")
        return {'status': 'failed', 'error': str(e)}

def update_user_intervention_history(user_id, intervention_type, priority):
    """
    Update user profile with intervention history
    """
    try:
        table = dynamodb.Table(USER_PROFILES_TABLE)
        
        intervention_record = {
            'type': intervention_type,
            'priority': priority,
            'timestamp': int(datetime.now().timestamp() * 1000),
            'status': 'executed'
        }
        
        table.update_item(
            Key={'userId': user_id},
            UpdateExpression='SET interventionHistory = list_append(if_not_exists(interventionHistory, :empty_list), :intervention)',
            ExpressionAttributeValues={
                ':empty_list': [],
                ':intervention': [intervention_record]
            }
        )
        
    except Exception as e:
        logger.error(f"Error updating intervention history: {str(e)}")

def log_intervention_execution(user_id, intervention_type, priority, result):
    """
    Log intervention execution for analytics
    """
    try:
        logger.info(f"Intervention executed - User: {user_id}, Type: {intervention_type}, Priority: {priority}, Result: {result}")
        
        # In production, this would also write to CloudWatch metrics
        # and potentially to a dedicated intervention tracking table
        
    except Exception as e:
        logger.error(f"Error logging intervention execution: {str(e)}")