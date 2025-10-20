import json
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
sns = boto3.client('sns')
ses = boto3.client('ses')
lambda_client = boto3.client('lambda')

# Environment variables
USER_PROFILES_TABLE = os.environ.get('USER_PROFILES_TABLE', 'user-journey-analytics-user-profiles-dev')
STRUGGLE_SIGNALS_TABLE = os.environ.get('STRUGGLE_SIGNALS_TABLE', 'user-journey-analytics-struggle-signals-dev')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN', '')
SUPPORT_EMAIL = os.environ.get('SUPPORT_EMAIL', 'support@example.com')
FROM_EMAIL = os.environ.get('FROM_EMAIL', 'noreply@example.com')

def lambda_handler(event, context):
    """
    Lambda handler for executing interventions
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
        intervention_type = input_data.get('interventionType', 'general')
        risk_level = input_data.get('riskLevel', 'medium')
        
        if not user_id:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'userId is required'})
            }
        
        # Execute appropriate intervention
        intervention_result = execute_intervention(user_id, intervention_type, risk_level, input_data)
        
        # Log intervention
        log_intervention(user_id, intervention_type, intervention_result)
        
        return {
            'statusCode': 200,
            'body': json.dumps(intervention_result)
        }
        
    except Exception as e:
        logger.error(f"Intervention executor error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def execute_intervention(user_id: str, intervention_type: str, risk_level: str, context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute appropriate intervention based on type and risk level
    """
    try:
        # Get user profile for personalization
        user_profile = get_user_profile(user_id)
        
        # Determine intervention strategy
        intervention_strategy = determine_intervention_strategy(intervention_type, risk_level, user_profile)
        
        # Execute interventions
        executed_interventions = []
        
        for action in intervention_strategy['actions']:
            try:
                result = execute_intervention_action(user_id, action, user_profile, context)
                executed_interventions.append(result)
            except Exception as e:
                logger.error(f"Failed to execute intervention action {action['type']}: {str(e)}")
                executed_interventions.append({
                    'type': action['type'],
                    'status': 'failed',
                    'error': str(e)
                })
        
        return {
            'userId': user_id,
            'interventionType': intervention_type,
            'riskLevel': risk_level,
            'strategy': intervention_strategy,
            'executedInterventions': executed_interventions,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'success': any(intervention.get('status') == 'success' for intervention in executed_interventions)
        }
        
    except Exception as e:
        logger.error(f"Error executing intervention: {str(e)}")
        return {
            'userId': user_id,
            'error': str(e),
            'success': False
        }

def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get user profile for personalization
    """
    try:
        table = dynamodb.Table(USER_PROFILES_TABLE)
        response = table.get_item(Key={'userId': user_id})
        return response.get('Item')
    except Exception as e:
        logger.error(f"Error getting user profile: {str(e)}")
        return None

def determine_intervention_strategy(intervention_type: str, risk_level: str, user_profile: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Determine the appropriate intervention strategy
    """
    try:
        # Base strategy templates
        strategies = {
            'struggle_detected': {
                'critical': {
                    'priority': 'immediate',
                    'actions': [
                        {'type': 'live_chat_offer', 'priority': 1},
                        {'type': 'support_ticket', 'priority': 1},
                        {'type': 'phone_callback', 'priority': 2},
                        {'type': 'push_notification', 'priority': 1, 'message': 'immediate_help'},
                        {'type': 'email_intervention', 'priority': 2, 'template': 'critical_support'}
                    ]
                },
                'high': {
                    'priority': 'urgent',
                    'actions': [
                        {'type': 'live_chat_offer', 'priority': 1},
                        {'type': 'push_notification', 'priority': 1, 'message': 'help_available'},
                        {'type': 'email_intervention', 'priority': 2, 'template': 'assistance_offer'},
                        {'type': 'in_app_guidance', 'priority': 1}
                    ]
                },
                'medium': {
                    'priority': 'standard',
                    'actions': [
                        {'type': 'in_app_guidance', 'priority': 1},
                        {'type': 'helpful_resources', 'priority': 1},
                        {'type': 'email_intervention', 'priority': 3, 'template': 'helpful_tips'}
                    ]
                },
                'low': {
                    'priority': 'low',
                    'actions': [
                        {'type': 'contextual_tips', 'priority': 1},
                        {'type': 'progress_encouragement', 'priority': 2}
                    ]
                }
            },
            'video_engagement': {
                'low': {
                    'priority': 'standard',
                    'actions': [
                        {'type': 'content_recommendation', 'priority': 1},
                        {'type': 'engagement_survey', 'priority': 2},
                        {'type': 'alternative_content', 'priority': 1}
                    ]
                },
                'high': {
                    'priority': 'standard',
                    'actions': [
                        {'type': 'advanced_content', 'priority': 1},
                        {'type': 'certification_offer', 'priority': 2},
                        {'type': 'success_reinforcement', 'priority': 1}
                    ]
                }
            },
            'proactive': {
                'medium': {
                    'priority': 'standard',
                    'actions': [
                        {'type': 'check_in_email', 'priority': 1},
                        {'type': 'progress_update', 'priority': 2},
                        {'type': 'educational_content', 'priority': 1}
                    ]
                }
            }
        }
        
        # Get base strategy
        strategy = strategies.get(intervention_type, {}).get(risk_level, {
            'priority': 'standard',
            'actions': [{'type': 'general_support', 'priority': 1}]
        })
        
        # Personalize based on user profile
        if user_profile:
            strategy = personalize_intervention_strategy(strategy, user_profile)
        
        return strategy
        
    except Exception as e:
        logger.error(f"Error determining intervention strategy: {str(e)}")
        return {
            'priority': 'standard',
            'actions': [{'type': 'general_support', 'priority': 1}]
        }

def personalize_intervention_strategy(strategy: Dict[str, Any], user_profile: Dict[str, Any]) -> Dict[str, Any]:
    """
    Personalize intervention strategy based on user profile
    """
    try:
        # Get user preferences and history
        behavior_metrics = user_profile.get('behaviorMetrics', {})
        last_activity = user_profile.get('lastActivity', {})
        
        # Adjust based on user's historical response to interventions
        struggle_count = behavior_metrics.get('struggleCount', 0)
        success_count = behavior_metrics.get('successfulActions', 0)
        
        # If user has high success rate, prefer lighter interventions
        if success_count > struggle_count * 2:
            # Filter out heavy interventions for successful users
            strategy['actions'] = [
                action for action in strategy['actions']
                if action['type'] not in ['support_ticket', 'phone_callback']
            ]
        
        # If user frequently struggles, prioritize human support
        elif struggle_count > 5:
            # Prioritize human support actions
            for action in strategy['actions']:
                if action['type'] in ['live_chat_offer', 'support_ticket']:
                    action['priority'] = 1
        
        # Add timing considerations
        last_activity_time = last_activity.get('timestamp')
        if last_activity_time:
            last_time = datetime.fromisoformat(last_activity_time.replace('Z', '+00:00'))
            hours_since_activity = (datetime.now(timezone.utc) - last_time).total_seconds() / 3600
            
            # If user was recently active, prefer immediate interventions
            if hours_since_activity < 1:
                for action in strategy['actions']:
                    if action['type'] in ['push_notification', 'in_app_guidance']:
                        action['priority'] = 1
        
        return strategy
        
    except Exception as e:
        logger.error(f"Error personalizing strategy: {str(e)}")
        return strategy

def execute_intervention_action(user_id: str, action: Dict[str, Any], user_profile: Optional[Dict[str, Any]], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a specific intervention action
    """
    action_type = action['type']
    
    try:
        if action_type == 'push_notification':
            return send_push_notification(user_id, action, context)
        
        elif action_type == 'email_intervention':
            return send_email_intervention(user_id, action, user_profile, context)
        
        elif action_type == 'live_chat_offer':
            return offer_live_chat(user_id, action, context)
        
        elif action_type == 'support_ticket':
            return create_support_ticket(user_id, action, context)
        
        elif action_type == 'in_app_guidance':
            return trigger_in_app_guidance(user_id, action, context)
        
        elif action_type == 'helpful_resources':
            return send_helpful_resources(user_id, action, context)
        
        elif action_type == 'content_recommendation':
            return send_content_recommendation(user_id, action, context)
        
        elif action_type == 'contextual_tips':
            return show_contextual_tips(user_id, action, context)
        
        else:
            return execute_generic_action(user_id, action, context)
        
    except Exception as e:
        logger.error(f"Error executing action {action_type}: {str(e)}")
        return {
            'type': action_type,
            'status': 'failed',
            'error': str(e)
        }

def send_push_notification(user_id: str, action: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Send push notification intervention
    """
    try:
        if not SNS_TOPIC_ARN:
            return {
                'type': 'push_notification',
                'status': 'skipped',
                'reason': 'SNS topic not configured'
            }
        
        message_type = action.get('message', 'general')
        
        # Message templates
        messages = {
            'immediate_help': {
                'title': 'Need Help?',
                'body': 'We noticed you might be having trouble. Tap here for immediate assistance!'
            },
            'help_available': {
                'title': 'Help is Available',
                'body': 'Having difficulty? Our support team is ready to help you succeed.'
            },
            'general': {
                'title': 'We\'re Here to Help',
                'body': 'Need assistance? We\'re here to support your journey.'
            }
        }
        
        message_content = messages.get(message_type, messages['general'])
        
        # Send notification
        notification_payload = {
            'userId': user_id,
            'type': 'intervention_notification',
            'title': message_content['title'],
            'body': message_content['body'],
            'data': {
                'interventionType': context.get('interventionType', 'general'),
                'riskLevel': context.get('riskLevel', 'medium'),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
        }
        
        sns.publish(
            TopicArn=SNS_TOPIC_ARN,
            Message=json.dumps(notification_payload),
            Subject='User Intervention Notification'
        )
        
        return {
            'type': 'push_notification',
            'status': 'success',
            'message': message_content,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error sending push notification: {str(e)}")
        raise

def send_email_intervention(user_id: str, action: Dict[str, Any], user_profile: Optional[Dict[str, Any]], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Send email intervention
    """
    try:
        template = action.get('template', 'general')
        
        # Email templates
        templates = {
            'critical_support': {
                'subject': 'Immediate Support Available - We\'re Here to Help',
                'body': '''
                Hi there,
                
                We noticed you might be experiencing some difficulties and wanted to reach out immediately.
                Our support team is standing by to provide personalized assistance.
                
                You can:
                • Start a live chat session
                • Schedule a phone call
                • Reply to this email for priority support
                
                We're committed to your success!
                
                Best regards,
                Support Team
                '''
            },
            'assistance_offer': {
                'subject': 'Need a Hand? We\'re Here to Help',
                'body': '''
                Hello,
                
                We wanted to check in and see if you need any assistance.
                Our team has noticed you might benefit from some additional support.
                
                Here are some resources that might help:
                • Step-by-step guides
                • Video tutorials
                • Live chat support
                
                Don't hesitate to reach out!
                
                Best,
                Support Team
                '''
            },
            'helpful_tips': {
                'subject': 'Tips to Help You Succeed',
                'body': '''
                Hi,
                
                We've put together some helpful tips based on your recent activity:
                
                • Take your time with each step
                • Use our help resources when needed
                • Remember that practice makes perfect
                
                You're doing great - keep it up!
                
                Cheers,
                Support Team
                '''
            }
        }
        
        email_content = templates.get(template, templates['helpful_tips'])
        
        # Get user email (in real implementation, this would come from user profile)
        user_email = f"user-{user_id}@example.com"  # Placeholder
        
        # Send email using SES
        ses.send_email(
            Source=FROM_EMAIL,
            Destination={'ToAddresses': [user_email]},
            Message={
                'Subject': {'Data': email_content['subject']},
                'Body': {'Text': {'Data': email_content['body']}}
            }
        )
        
        return {
            'type': 'email_intervention',
            'status': 'success',
            'template': template,
            'recipient': user_email,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error sending email intervention: {str(e)}")
        # Don't fail the entire intervention if email fails
        return {
            'type': 'email_intervention',
            'status': 'failed',
            'error': str(e)
        }

def offer_live_chat(user_id: str, action: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Offer live chat support
    """
    try:
        # In a real implementation, this would integrate with a chat system
        # For now, we'll create a chat offer record
        
        chat_offer = {
            'userId': user_id,
            'type': 'live_chat_offer',
            'priority': action.get('priority', 2),
            'context': context,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'status': 'offered'
        }
        
        # Send notification to support team
        if SNS_TOPIC_ARN:
            sns.publish(
                TopicArn=SNS_TOPIC_ARN,
                Message=json.dumps({
                    'type': 'live_chat_request',
                    'userId': user_id,
                    'priority': action.get('priority', 2),
                    'context': context
                }),
                Subject='Live Chat Support Requested'
            )
        
        return {
            'type': 'live_chat_offer',
            'status': 'success',
            'chatOffer': chat_offer,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error offering live chat: {str(e)}")
        raise

def create_support_ticket(user_id: str, action: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create support ticket
    """
    try:
        # Create support ticket record
        ticket = {
            'userId': user_id,
            'type': 'automated_intervention',
            'priority': 'high' if context.get('riskLevel') in ['high', 'critical'] else 'medium',
            'description': f"User intervention triggered - {context.get('interventionType', 'general')}",
            'context': context,
            'status': 'open',
            'createdAt': datetime.now(timezone.utc).isoformat(),
            'ticketId': f"INT-{user_id}-{int(datetime.now().timestamp())}"
        }
        
        # Notify support team
        if SNS_TOPIC_ARN:
            sns.publish(
                TopicArn=SNS_TOPIC_ARN,
                Message=json.dumps({
                    'type': 'support_ticket_created',
                    'ticket': ticket
                }),
                Subject=f'Support Ticket Created - {ticket["ticketId"]}'
            )
        
        return {
            'type': 'support_ticket',
            'status': 'success',
            'ticket': ticket,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error creating support ticket: {str(e)}")
        raise

def trigger_in_app_guidance(user_id: str, action: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Trigger in-app guidance
    """
    try:
        # Create in-app guidance trigger
        guidance = {
            'userId': user_id,
            'type': 'contextual_guidance',
            'trigger': 'intervention',
            'content': {
                'message': 'We noticed you might need some help. Here are some tips to get you back on track.',
                'actions': [
                    {'label': 'Show Tutorial', 'action': 'show_tutorial'},
                    {'label': 'Contact Support', 'action': 'contact_support'},
                    {'label': 'Continue', 'action': 'dismiss'}
                ]
            },
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        # Send to frontend via SNS/WebSocket
        if SNS_TOPIC_ARN:
            sns.publish(
                TopicArn=SNS_TOPIC_ARN,
                Message=json.dumps({
                    'type': 'in_app_guidance',
                    'userId': user_id,
                    'guidance': guidance
                }),
                Subject='In-App Guidance Trigger'
            )
        
        return {
            'type': 'in_app_guidance',
            'status': 'success',
            'guidance': guidance,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error triggering in-app guidance: {str(e)}")
        raise

def send_helpful_resources(user_id: str, action: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Send helpful resources
    """
    try:
        # Curate resources based on context
        resources = {
            'articles': [
                {'title': 'Getting Started Guide', 'url': '/help/getting-started'},
                {'title': 'Common Issues and Solutions', 'url': '/help/troubleshooting'},
                {'title': 'Best Practices', 'url': '/help/best-practices'}
            ],
            'videos': [
                {'title': 'Quick Tutorial', 'url': '/videos/quick-tutorial'},
                {'title': 'Step-by-Step Walkthrough', 'url': '/videos/walkthrough'}
            ],
            'support': [
                {'title': 'Contact Support', 'url': '/support/contact'},
                {'title': 'Live Chat', 'url': '/support/chat'}
            ]
        }
        
        # Send resources notification
        if SNS_TOPIC_ARN:
            sns.publish(
                TopicArn=SNS_TOPIC_ARN,
                Message=json.dumps({
                    'type': 'helpful_resources',
                    'userId': user_id,
                    'resources': resources
                }),
                Subject='Helpful Resources Available'
            )
        
        return {
            'type': 'helpful_resources',
            'status': 'success',
            'resources': resources,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error sending helpful resources: {str(e)}")
        raise

def send_content_recommendation(user_id: str, action: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Send content recommendations
    """
    try:
        # Generate content recommendations based on context
        recommendations = {
            'videos': [
                {'id': 'intro-101', 'title': 'Introduction to Basics', 'duration': '5 min'},
                {'id': 'tips-tricks', 'title': 'Tips and Tricks', 'duration': '8 min'}
            ],
            'articles': [
                {'id': 'guide-1', 'title': 'Comprehensive Guide', 'readTime': '10 min'},
                {'id': 'faq', 'title': 'Frequently Asked Questions', 'readTime': '5 min'}
            ]
        }
        
        return {
            'type': 'content_recommendation',
            'status': 'success',
            'recommendations': recommendations,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error sending content recommendation: {str(e)}")
        raise

def show_contextual_tips(user_id: str, action: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Show contextual tips
    """
    try:
        tips = [
            "Take your time - there's no rush to complete everything at once.",
            "Use the help button if you get stuck on any step.",
            "Remember to save your progress regularly.",
            "Don't hesitate to reach out if you need assistance."
        ]
        
        return {
            'type': 'contextual_tips',
            'status': 'success',
            'tips': tips,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error showing contextual tips: {str(e)}")
        raise

def execute_generic_action(user_id: str, action: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute generic intervention action
    """
    try:
        return {
            'type': action['type'],
            'status': 'success',
            'message': f"Generic intervention executed for {action['type']}",
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error executing generic action: {str(e)}")
        raise

def log_intervention(user_id: str, intervention_type: str, result: Dict[str, Any]):
    """
    Log intervention execution for analytics
    """
    try:
        table = dynamodb.Table(STRUGGLE_SIGNALS_TABLE)
        
        # Create intervention log entry
        log_entry = {
            'userId': user_id,
            'signalId': f"{user_id}#intervention#{datetime.now(timezone.utc).isoformat()}",
            'type': 'intervention_executed',
            'interventionType': intervention_type,
            'result': result,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'ttl': int((datetime.now(timezone.utc).timestamp() + (90 * 24 * 60 * 60)))  # 90 days TTL
        }
        
        table.put_item(Item=log_entry)
        logger.info(f"Logged intervention for user: {user_id}, type: {intervention_type}")
        
    except Exception as e:
        logger.error(f"Error logging intervention: {str(e)}")
        # Don't fail the intervention if logging fails