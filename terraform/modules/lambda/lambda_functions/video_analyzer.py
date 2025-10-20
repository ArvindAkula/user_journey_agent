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
VIDEO_ENGAGEMENT_TABLE = os.environ.get('VIDEO_ENGAGEMENT_TABLE')
USER_PROFILES_TABLE = os.environ.get('USER_PROFILES_TABLE')
TIMESTREAM_DATABASE = os.environ.get('TIMESTREAM_DATABASE')

def lambda_handler(event, context):
    """
    Bedrock Agent action group handler for video engagement analysis
    """
    try:
        # Parse the input from Bedrock Agent
        input_data = json.loads(event.get('inputText', '{}'))
        
        user_id = input_data.get('userId')
        video_id = input_data.get('videoId')
        
        if not user_id:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'userId is required'})
            }
        
        # Analyze video engagement
        if video_id:
            analysis = analyze_specific_video_engagement(user_id, video_id)
        else:
            analysis = analyze_user_video_patterns(user_id)
        
        # Generate recommendations
        recommendations = generate_video_recommendations(analysis)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'analysis': analysis,
                'recommendations': recommendations
            })
        }
        
    except Exception as e:
        logger.error(f"Error in video analyzer: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def analyze_specific_video_engagement(user_id, video_id):
    """
    Analyze engagement for a specific video
    """
    try:
        table = dynamodb.Table(VIDEO_ENGAGEMENT_TABLE)
        
        # Get video engagement data
        response = table.get_item(
            Key={
                'userId': user_id,
                'videoId': video_id
            }
        )
        
        if 'Item' not in response:
            return {
                'userId': user_id,
                'videoId': video_id,
                'status': 'not_watched',
                'engagement': 'none'
            }
        
        item = response['Item']
        
        # Calculate engagement metrics
        completion_rate = item.get('completionRate', 0)
        view_count = item.get('viewCount', 0)
        total_watch_time = item.get('totalWatchTime', 0)
        interest_score = item.get('interestScore', 0)
        
        # Determine engagement level
        engagement_level = 'low'
        if interest_score >= 80:
            engagement_level = 'very_high'
        elif interest_score >= 60:
            engagement_level = 'high'
        elif interest_score >= 40:
            engagement_level = 'medium'
        
        # Analyze viewing patterns
        viewing_pattern = analyze_viewing_pattern(completion_rate, view_count, total_watch_time)
        
        analysis = {
            'userId': user_id,
            'videoId': video_id,
            'engagement': {
                'level': engagement_level,
                'score': interest_score,
                'completionRate': completion_rate,
                'viewCount': view_count,
                'totalWatchTime': total_watch_time
            },
            'patterns': viewing_pattern,
            'readinessIndicators': calculate_readiness_indicators(item),
            'lastWatched': item.get('lastWatchedAt')
        }
        
        # Store analysis in Timestream
        store_video_analysis(analysis)
        
        return analysis
        
    except Exception as e:
        logger.error(f"Error analyzing specific video engagement: {str(e)}")
        return {
            'userId': user_id,
            'videoId': video_id,
            'error': str(e)
        }

def analyze_user_video_patterns(user_id):
    """
    Analyze overall video engagement patterns for a user
    """
    try:
        table = dynamodb.Table(VIDEO_ENGAGEMENT_TABLE)
        
        # Query all videos for this user
        response = table.query(
            KeyConditionExpression='userId = :userId',
            ExpressionAttributeValues={
                ':userId': user_id
            }
        )
        
        videos = response.get('Items', [])
        
        if not videos:
            return {
                'userId': user_id,
                'status': 'no_video_activity',
                'totalVideos': 0
            }
        
        # Calculate aggregate metrics
        total_videos = len(videos)
        total_watch_time = sum(v.get('totalWatchTime', 0) for v in videos)
        avg_completion_rate = sum(v.get('completionRate', 0) for v in videos) / total_videos
        avg_interest_score = sum(v.get('interestScore', 0) for v in videos) / total_videos
        
        # Find top interests
        top_videos = sorted(videos, key=lambda x: x.get('interestScore', 0), reverse=True)[:5]
        
        # Identify content preferences
        content_preferences = identify_content_preferences(videos)
        
        # Calculate engagement trends
        engagement_trend = calculate_engagement_trend(videos)
        
        analysis = {
            'userId': user_id,
            'overview': {
                'totalVideos': total_videos,
                'totalWatchTime': total_watch_time,
                'avgCompletionRate': round(avg_completion_rate, 2),
                'avgInterestScore': round(avg_interest_score, 2)
            },
            'topVideos': [
                {
                    'videoId': v['videoId'],
                    'interestScore': v.get('interestScore', 0),
                    'completionRate': v.get('completionRate', 0)
                } for v in top_videos
            ],
            'contentPreferences': content_preferences,
            'engagementTrend': engagement_trend,
            'learningReadiness': assess_learning_readiness(videos)
        }
        
        return analysis
        
    except Exception as e:
        logger.error(f"Error analyzing user video patterns: {str(e)}")
        return {
            'userId': user_id,
            'error': str(e)
        }

def analyze_viewing_pattern(completion_rate, view_count, total_watch_time):
    """
    Analyze viewing patterns to understand user behavior
    """
    patterns = []
    
    if view_count > 1:
        patterns.append('repeat_viewer')
    
    if completion_rate >= 90:
        patterns.append('completes_videos')
    elif completion_rate >= 50:
        patterns.append('partial_viewer')
    else:
        patterns.append('quick_browser')
    
    if total_watch_time > 600:  # 10 minutes
        patterns.append('engaged_learner')
    elif total_watch_time > 180:  # 3 minutes
        patterns.append('moderate_engagement')
    else:
        patterns.append('brief_engagement')
    
    return patterns

def calculate_readiness_indicators(video_data):
    """
    Calculate indicators of user readiness for next steps
    """
    indicators = []
    
    completion_rate = video_data.get('completionRate', 0)
    view_count = video_data.get('viewCount', 0)
    interest_score = video_data.get('interestScore', 0)
    
    if completion_rate >= 80:
        indicators.append('content_mastery')
    
    if view_count >= 2:
        indicators.append('high_interest')
    
    if interest_score >= 70:
        indicators.append('ready_for_advanced')
    
    if completion_rate >= 90 and interest_score >= 80:
        indicators.append('ready_for_action')
    
    return indicators

def identify_content_preferences(videos):
    """
    Identify user's content preferences based on engagement
    """
    # This would typically use video metadata to categorize content
    # For now, we'll use simple heuristics based on video IDs
    
    preferences = {
        'tutorial': 0,
        'educational': 0,
        'promotional': 0,
        'tips': 0
    }
    
    for video in videos:
        video_id = video.get('videoId', '').lower()
        interest_score = video.get('interestScore', 0)
        
        if 'tutorial' in video_id or 'guide' in video_id:
            preferences['tutorial'] += interest_score
        elif 'tip' in video_id or 'trick' in video_id:
            preferences['tips'] += interest_score
        elif 'promo' in video_id or 'intro' in video_id:
            preferences['promotional'] += interest_score
        else:
            preferences['educational'] += interest_score
    
    # Normalize and return top preferences
    total_score = sum(preferences.values())
    if total_score > 0:
        for key in preferences:
            preferences[key] = round((preferences[key] / total_score) * 100, 1)
    
    return preferences

def calculate_engagement_trend(videos):
    """
    Calculate engagement trend over time
    """
    if len(videos) < 2:
        return 'insufficient_data'
    
    # Sort by last watched time
    sorted_videos = sorted(videos, key=lambda x: x.get('lastWatchedAt', 0))
    
    # Compare recent vs older engagement
    mid_point = len(sorted_videos) // 2
    older_videos = sorted_videos[:mid_point]
    recent_videos = sorted_videos[mid_point:]
    
    older_avg = sum(v.get('interestScore', 0) for v in older_videos) / len(older_videos)
    recent_avg = sum(v.get('interestScore', 0) for v in recent_videos) / len(recent_videos)
    
    if recent_avg > older_avg + 10:
        return 'increasing'
    elif recent_avg < older_avg - 10:
        return 'decreasing'
    else:
        return 'stable'

def assess_learning_readiness(videos):
    """
    Assess user's readiness for learning progression
    """
    if not videos:
        return 'unknown'
    
    avg_completion = sum(v.get('completionRate', 0) for v in videos) / len(videos)
    avg_interest = sum(v.get('interestScore', 0) for v in videos) / len(videos)
    total_videos = len(videos)
    
    if avg_completion >= 80 and avg_interest >= 70 and total_videos >= 3:
        return 'high'
    elif avg_completion >= 60 and avg_interest >= 50 and total_videos >= 2:
        return 'medium'
    else:
        return 'low'

def generate_video_recommendations(analysis):
    """
    Generate video recommendations based on analysis
    """
    recommendations = {
        'nextActions': [],
        'contentSuggestions': [],
        'engagementStrategies': []
    }
    
    if 'engagement' in analysis:
        engagement_level = analysis['engagement'].get('level', 'low')
        
        if engagement_level == 'very_high':
            recommendations['nextActions'].append('Recommend advanced content')
            recommendations['nextActions'].append('Suggest practical application')
        elif engagement_level == 'high':
            recommendations['nextActions'].append('Provide related videos')
            recommendations['nextActions'].append('Offer deeper dive content')
        elif engagement_level == 'medium':
            recommendations['engagementStrategies'].append('Send follow-up content')
            recommendations['engagementStrategies'].append('Provide interactive elements')
        else:
            recommendations['engagementStrategies'].append('Simplify content presentation')
            recommendations['engagementStrategies'].append('Reduce video length')
    
    if 'contentPreferences' in analysis:
        prefs = analysis['contentPreferences']
        top_pref = max(prefs.keys(), key=lambda k: prefs[k])
        recommendations['contentSuggestions'].append(f'Focus on {top_pref} content')
    
    if 'learningReadiness' in analysis:
        readiness = analysis['learningReadiness']
        if readiness == 'high':
            recommendations['nextActions'].append('Offer certification or assessment')
        elif readiness == 'medium':
            recommendations['nextActions'].append('Provide practice exercises')
        else:
            recommendations['engagementStrategies'].append('Improve content accessibility')
    
    return recommendations

def store_video_analysis(analysis):
    """
    Store video analysis in Timestream
    """
    try:
        records = [{
            'Time': str(int(datetime.now().timestamp() * 1000)),
            'TimeUnit': 'MILLISECONDS',
            'Dimensions': [
                {'Name': 'userId', 'Value': analysis['userId']},
                {'Name': 'videoId', 'Value': analysis.get('videoId', 'aggregate')},
                {'Name': 'engagementLevel', 'Value': analysis.get('engagement', {}).get('level', 'unknown')}
            ],
            'MeasureName': 'video_analysis',
            'MeasureValue': str(analysis.get('engagement', {}).get('score', 0)),
            'MeasureValueType': 'DOUBLE'
        }]
        
        timestream_write.write_records(
            DatabaseName=TIMESTREAM_DATABASE,
            TableName='video-engagement',
            Records=records
        )
        
    except Exception as e:
        logger.error(f"Error storing video analysis: {str(e)}")