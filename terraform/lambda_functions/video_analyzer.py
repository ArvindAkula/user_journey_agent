import json
import boto3
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional
import logging
from decimal import Decimal
import statistics

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')

# Environment variables
VIDEO_ENGAGEMENT_TABLE = os.environ.get('VIDEO_ENGAGEMENT_TABLE', 'user-journey-analytics-video-engagement-dev')
USER_PROFILES_TABLE = os.environ.get('USER_PROFILES_TABLE', 'user-journey-analytics-user-profiles-dev')
S3_BUCKET = os.environ.get('S3_BUCKET', 'user-journey-analytics-analytics-data-dev-9bf2a9c5')

def lambda_handler(event, context):
    """
    Lambda handler for video engagement analysis
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
        video_id = input_data.get('videoId')
        
        if not user_id:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'userId is required'})
            }
        
        # Perform video analysis
        if video_id:
            # Analyze specific video
            analysis_result = analyze_video_engagement(user_id, video_id, input_data)
        else:
            # Analyze overall video behavior
            analysis_result = analyze_user_video_behavior(user_id)
        
        return {
            'statusCode': 200,
            'body': json.dumps(analysis_result)
        }
        
    except Exception as e:
        logger.error(f"Video analyzer error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def analyze_video_engagement(user_id: str, video_id: str, event_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze engagement for a specific video
    """
    try:
        # Get video engagement history
        video_events = get_video_events(user_id, video_id)
        
        # Calculate engagement metrics
        engagement_metrics = calculate_video_engagement_metrics(video_events, event_data)
        
        # Analyze viewing patterns
        viewing_patterns = analyze_viewing_patterns(video_events)
        
        # Generate insights
        insights = generate_video_insights(engagement_metrics, viewing_patterns)
        
        # Store analysis results
        store_video_analysis(user_id, video_id, {
            'engagementMetrics': engagement_metrics,
            'viewingPatterns': viewing_patterns,
            'insights': insights
        })
        
        return {
            'userId': user_id,
            'videoId': video_id,
            'engagementMetrics': engagement_metrics,
            'viewingPatterns': viewing_patterns,
            'insights': insights,
            'analysisTimestamp': datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error analyzing video engagement: {str(e)}")
        return {
            'error': str(e),
            'userId': user_id,
            'videoId': video_id
        }

def analyze_user_video_behavior(user_id: str) -> Dict[str, Any]:
    """
    Analyze overall video behavior patterns for a user
    """
    try:
        # Get all video events for user
        all_video_events = get_all_user_video_events(user_id)
        
        # Calculate overall metrics
        overall_metrics = calculate_overall_video_metrics(all_video_events)
        
        # Identify preferences and patterns
        preferences = identify_video_preferences(all_video_events)
        
        # Generate recommendations
        recommendations = generate_video_recommendations(overall_metrics, preferences)
        
        # Update user profile with video insights
        update_user_video_profile(user_id, overall_metrics, preferences)
        
        return {
            'userId': user_id,
            'overallMetrics': overall_metrics,
            'preferences': preferences,
            'recommendations': recommendations,
            'analysisTimestamp': datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error analyzing user video behavior: {str(e)}")
        return {
            'error': str(e),
            'userId': user_id
        }

def get_video_events(user_id: str, video_id: str, days: int = 7) -> List[Dict[str, Any]]:
    """
    Get video events for specific video and user
    """
    try:
        table = dynamodb.Table(VIDEO_ENGAGEMENT_TABLE)
        
        # Calculate time range
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(days=days)
        
        # Query video events
        response = table.scan(
            FilterExpression='userId = :userId AND videoId = :videoId AND #ts BETWEEN :start_time AND :end_time',
            ExpressionAttributeNames={'#ts': 'timestamp'},
            ExpressionAttributeValues={
                ':userId': user_id,
                ':videoId': video_id,
                ':start_time': start_time.isoformat(),
                ':end_time': end_time.isoformat()
            }
        )
        
        return response.get('Items', [])
        
    except Exception as e:
        logger.error(f"Error getting video events: {str(e)}")
        return []

def get_all_user_video_events(user_id: str, days: int = 30) -> List[Dict[str, Any]]:
    """
    Get all video events for a user
    """
    try:
        table = dynamodb.Table(VIDEO_ENGAGEMENT_TABLE)
        
        # Calculate time range
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(days=days)
        
        # Scan for user's video events
        response = table.scan(
            FilterExpression='userId = :userId AND #ts BETWEEN :start_time AND :end_time',
            ExpressionAttributeNames={'#ts': 'timestamp'},
            ExpressionAttributeValues={
                ':userId': user_id,
                ':start_time': start_time.isoformat(),
                ':end_time': end_time.isoformat()
            }
        )
        
        return response.get('Items', [])
        
    except Exception as e:
        logger.error(f"Error getting all video events: {str(e)}")
        return []

def calculate_video_engagement_metrics(events: List[Dict[str, Any]], current_event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate engagement metrics for a specific video
    """
    try:
        metrics = {
            'totalViews': 0,
            'totalWatchTime': 0,
            'averageWatchTime': 0,
            'completionRate': 0,
            'replayCount': 0,
            'pauseCount': 0,
            'seekCount': 0,
            'speedChangeCount': 0,
            'engagementScore': 0,
            'dropOffPoints': [],
            'replaySegments': [],
            'viewingSessions': 0
        }
        
        if not events:
            return metrics
        
        # Group events by session
        sessions = {}
        for event in events:
            session_id = event.get('sessionId', 'default')
            if session_id not in sessions:
                sessions[session_id] = []
            sessions[session_id].append(event)
        
        metrics['viewingSessions'] = len(sessions)
        
        # Analyze each session
        total_watch_times = []
        completions = 0
        
        for session_id, session_events in sessions.items():
            session_metrics = analyze_video_session(session_events)
            
            metrics['totalViews'] += 1
            metrics['pauseCount'] += session_metrics.get('pauses', 0)
            metrics['seekCount'] += session_metrics.get('seeks', 0)
            metrics['speedChangeCount'] += session_metrics.get('speedChanges', 0)
            metrics['replayCount'] += session_metrics.get('replays', 0)
            
            if session_metrics.get('watchTime', 0) > 0:
                total_watch_times.append(session_metrics['watchTime'])
            
            if session_metrics.get('completed', False):
                completions += 1
            
            # Collect drop-off points and replay segments
            if session_metrics.get('dropOffPoint'):
                metrics['dropOffPoints'].append(session_metrics['dropOffPoint'])
            
            if session_metrics.get('replaySegments'):
                metrics['replaySegments'].extend(session_metrics['replaySegments'])
        
        # Calculate aggregate metrics
        if total_watch_times:
            metrics['totalWatchTime'] = sum(total_watch_times)
            metrics['averageWatchTime'] = statistics.mean(total_watch_times)
        
        if metrics['totalViews'] > 0:
            metrics['completionRate'] = completions / metrics['totalViews']
        
        # Calculate engagement score
        metrics['engagementScore'] = calculate_engagement_score(metrics)
        
        return metrics
        
    except Exception as e:
        logger.error(f"Error calculating video metrics: {str(e)}")
        return {}

def analyze_video_session(session_events: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze a single video viewing session
    """
    try:
        session_metrics = {
            'watchTime': 0,
            'pauses': 0,
            'seeks': 0,
            'speedChanges': 0,
            'replays': 0,
            'completed': False,
            'dropOffPoint': None,
            'replaySegments': []
        }
        
        # Sort events by timestamp
        sorted_events = sorted(session_events, key=lambda x: x.get('timestamp', ''))
        
        current_position = 0
        last_play_time = None
        
        for event in sorted_events:
            event_type = event.get('eventType', '')
            properties = event.get('properties', {})
            
            if event_type == 'video_start':
                last_play_time = datetime.fromisoformat(event.get('timestamp', '').replace('Z', '+00:00'))
                current_position = properties.get('position', 0)
            
            elif event_type == 'video_play':
                last_play_time = datetime.fromisoformat(event.get('timestamp', '').replace('Z', '+00:00'))
                current_position = properties.get('position', current_position)
            
            elif event_type == 'video_pause':
                if last_play_time:
                    pause_time = datetime.fromisoformat(event.get('timestamp', '').replace('Z', '+00:00'))
                    session_metrics['watchTime'] += (pause_time - last_play_time).total_seconds()
                    last_play_time = None
                session_metrics['pauses'] += 1
                current_position = properties.get('position', current_position)
            
            elif event_type == 'video_seek':
                session_metrics['seeks'] += 1
                new_position = properties.get('position', current_position)
                if new_position < current_position:
                    # Replay detected
                    session_metrics['replays'] += 1
                    session_metrics['replaySegments'].append({
                        'from': new_position,
                        'to': current_position
                    })
                current_position = new_position
            
            elif event_type == 'video_speed_change':
                session_metrics['speedChanges'] += 1
            
            elif event_type == 'video_completed':
                session_metrics['completed'] = True
                if last_play_time:
                    complete_time = datetime.fromisoformat(event.get('timestamp', '').replace('Z', '+00:00'))
                    session_metrics['watchTime'] += (complete_time - last_play_time).total_seconds()
            
            elif event_type == 'video_abandoned':
                session_metrics['dropOffPoint'] = properties.get('position', current_position)
                if last_play_time:
                    abandon_time = datetime.fromisoformat(event.get('timestamp', '').replace('Z', '+00:00'))
                    session_metrics['watchTime'] += (abandon_time - last_play_time).total_seconds()
        
        return session_metrics
        
    except Exception as e:
        logger.error(f"Error analyzing video session: {str(e)}")
        return {}

def analyze_viewing_patterns(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze viewing patterns and behaviors
    """
    try:
        patterns = {
            'preferredViewingTimes': [],
            'sessionDurations': [],
            'commonDropOffPoints': [],
            'frequentReplaySegments': [],
            'viewingConsistency': 0,
            'engagementTrend': 'stable'
        }
        
        if not events:
            return patterns
        
        # Analyze viewing times
        viewing_hours = []
        for event in events:
            timestamp = event.get('timestamp', '')
            if timestamp:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                viewing_hours.append(dt.hour)
        
        if viewing_hours:
            # Find most common viewing hours
            hour_counts = {}
            for hour in viewing_hours:
                hour_counts[hour] = hour_counts.get(hour, 0) + 1
            
            patterns['preferredViewingTimes'] = sorted(
                hour_counts.items(), 
                key=lambda x: x[1], 
                reverse=True
            )[:3]  # Top 3 preferred hours
        
        # Analyze engagement trend over time
        if len(events) >= 5:
            # Sort events by timestamp
            sorted_events = sorted(events, key=lambda x: x.get('timestamp', ''))
            
            # Calculate engagement scores over time
            engagement_scores = []
            for event in sorted_events:
                score = event.get('engagementScore', 0)
                if isinstance(score, (int, float, Decimal)):
                    engagement_scores.append(float(score))
            
            if len(engagement_scores) >= 3:
                # Simple trend analysis
                first_half = engagement_scores[:len(engagement_scores)//2]
                second_half = engagement_scores[len(engagement_scores)//2:]
                
                first_avg = statistics.mean(first_half)
                second_avg = statistics.mean(second_half)
                
                if second_avg > first_avg * 1.1:
                    patterns['engagementTrend'] = 'improving'
                elif second_avg < first_avg * 0.9:
                    patterns['engagementTrend'] = 'declining'
                else:
                    patterns['engagementTrend'] = 'stable'
        
        return patterns
        
    except Exception as e:
        logger.error(f"Error analyzing viewing patterns: {str(e)}")
        return {}

def calculate_engagement_score(metrics: Dict[str, Any]) -> float:
    """
    Calculate overall engagement score for video
    """
    try:
        score = 0
        
        # Base score from completion rate
        completion_rate = metrics.get('completionRate', 0)
        score += completion_rate * 40  # Up to 40 points
        
        # Watch time factor
        avg_watch_time = metrics.get('averageWatchTime', 0)
        if avg_watch_time > 0:
            # Normalize to reasonable video length (assume 5 minutes = 300 seconds)
            watch_time_score = min(30, (avg_watch_time / 300) * 30)
            score += watch_time_score
        
        # Interaction engagement (pauses, seeks, replays)
        interactions = (
            metrics.get('pauseCount', 0) * 2 +
            metrics.get('seekCount', 0) * 1.5 +
            metrics.get('replayCount', 0) * 3
        )
        interaction_score = min(20, interactions)
        score += interaction_score
        
        # Multiple viewing sessions bonus
        sessions = metrics.get('viewingSessions', 0)
        if sessions > 1:
            score += min(10, sessions * 2)
        
        return min(100, max(0, score))
        
    except Exception as e:
        logger.error(f"Error calculating engagement score: {str(e)}")
        return 0

def calculate_overall_video_metrics(all_events: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate overall video engagement metrics for user
    """
    try:
        metrics = {
            'totalVideosWatched': 0,
            'totalWatchTime': 0,
            'averageEngagementScore': 0,
            'preferredVideoTypes': [],
            'completionRateOverall': 0,
            'mostEngagedVideos': [],
            'videoConsumptionTrend': 'stable'
        }
        
        if not all_events:
            return metrics
        
        # Group by video
        videos = {}
        for event in all_events:
            video_id = event.get('videoId', 'unknown')
            if video_id not in videos:
                videos[video_id] = []
            videos[video_id].append(event)
        
        metrics['totalVideosWatched'] = len(videos)
        
        # Analyze each video
        engagement_scores = []
        completion_rates = []
        total_watch_time = 0
        
        for video_id, video_events in videos.items():
            video_metrics = calculate_video_engagement_metrics(video_events, {})
            
            if video_metrics.get('engagementScore', 0) > 0:
                engagement_scores.append(video_metrics['engagementScore'])
            
            if video_metrics.get('completionRate', 0) > 0:
                completion_rates.append(video_metrics['completionRate'])
            
            total_watch_time += video_metrics.get('totalWatchTime', 0)
            
            # Track highly engaged videos
            if video_metrics.get('engagementScore', 0) > 70:
                metrics['mostEngagedVideos'].append({
                    'videoId': video_id,
                    'engagementScore': video_metrics['engagementScore']
                })
        
        # Calculate averages
        if engagement_scores:
            metrics['averageEngagementScore'] = statistics.mean(engagement_scores)
        
        if completion_rates:
            metrics['completionRateOverall'] = statistics.mean(completion_rates)
        
        metrics['totalWatchTime'] = total_watch_time
        
        # Sort most engaged videos
        metrics['mostEngagedVideos'].sort(key=lambda x: x['engagementScore'], reverse=True)
        metrics['mostEngagedVideos'] = metrics['mostEngagedVideos'][:5]  # Top 5
        
        return metrics
        
    except Exception as e:
        logger.error(f"Error calculating overall metrics: {str(e)}")
        return {}

def identify_video_preferences(all_events: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Identify user's video preferences and patterns
    """
    try:
        preferences = {
            'preferredDuration': 'medium',  # short, medium, long
            'preferredInteractionStyle': 'passive',  # passive, interactive
            'contentPreferences': [],
            'viewingTimePreferences': [],
            'devicePreferences': []
        }
        
        # Analyze interaction patterns
        total_interactions = 0
        total_videos = 0
        
        video_groups = {}
        for event in all_events:
            video_id = event.get('videoId', 'unknown')
            if video_id not in video_groups:
                video_groups[video_id] = []
                total_videos += 1
            video_groups[video_id].append(event)
        
        for video_events in video_groups.values():
            interactions = sum(1 for event in video_events 
                             if event.get('eventType', '') in ['video_pause', 'video_seek', 'video_speed_change'])
            total_interactions += interactions
        
        # Determine interaction style
        if total_videos > 0:
            avg_interactions = total_interactions / total_videos
            if avg_interactions > 3:
                preferences['preferredInteractionStyle'] = 'highly_interactive'
            elif avg_interactions > 1:
                preferences['preferredInteractionStyle'] = 'interactive'
            else:
                preferences['preferredInteractionStyle'] = 'passive'
        
        return preferences
        
    except Exception as e:
        logger.error(f"Error identifying preferences: {str(e)}")
        return {}

def generate_video_insights(metrics: Dict[str, Any], patterns: Dict[str, Any]) -> List[str]:
    """
    Generate actionable insights from video analysis
    """
    insights = []
    
    try:
        engagement_score = metrics.get('engagementScore', 0)
        completion_rate = metrics.get('completionRate', 0)
        
        # Engagement insights
        if engagement_score > 80:
            insights.append("Highly engaged with this video content")
        elif engagement_score > 60:
            insights.append("Good engagement with video content")
        elif engagement_score > 40:
            insights.append("Moderate engagement - consider content optimization")
        else:
            insights.append("Low engagement - content may not match user interests")
        
        # Completion insights
        if completion_rate > 0.8:
            insights.append("High completion rate indicates strong content relevance")
        elif completion_rate > 0.5:
            insights.append("Moderate completion rate - content partially relevant")
        else:
            insights.append("Low completion rate - consider shorter or more engaging content")
        
        # Replay insights
        replay_count = metrics.get('replayCount', 0)
        if replay_count > 2:
            insights.append("Multiple replays suggest complex or valuable content")
        
        # Drop-off insights
        drop_offs = metrics.get('dropOffPoints', [])
        if len(drop_offs) > 0:
            avg_drop_off = statistics.mean(drop_offs) if drop_offs else 0
            insights.append(f"Common drop-off point around {avg_drop_off:.0f}% - consider content restructuring")
        
        # Trend insights
        trend = patterns.get('engagementTrend', 'stable')
        if trend == 'improving':
            insights.append("Engagement improving over time - user is becoming more interested")
        elif trend == 'declining':
            insights.append("Engagement declining - may need content variety or intervention")
        
        return insights
        
    except Exception as e:
        logger.error(f"Error generating insights: {str(e)}")
        return ["Analysis completed with limited insights due to processing error"]

def generate_video_recommendations(metrics: Dict[str, Any], preferences: Dict[str, Any]) -> List[str]:
    """
    Generate video content recommendations
    """
    recommendations = []
    
    try:
        avg_engagement = metrics.get('averageEngagementScore', 0)
        completion_rate = metrics.get('completionRateOverall', 0)
        
        # Engagement-based recommendations
        if avg_engagement < 50:
            recommendations.append("Recommend shorter, more interactive video content")
            recommendations.append("Consider adding captions or visual aids")
        
        if completion_rate < 0.5:
            recommendations.append("Break longer videos into shorter segments")
            recommendations.append("Add progress indicators and chapter markers")
        
        # Interaction style recommendations
        interaction_style = preferences.get('preferredInteractionStyle', 'passive')
        if interaction_style == 'highly_interactive':
            recommendations.append("Provide interactive video content with quizzes and polls")
        elif interaction_style == 'passive':
            recommendations.append("Focus on high-quality, engaging narrative content")
        
        # General recommendations
        most_engaged = metrics.get('mostEngagedVideos', [])
        if most_engaged:
            recommendations.append("Recommend similar content to highly engaged videos")
        
        return recommendations
        
    except Exception as e:
        logger.error(f"Error generating recommendations: {str(e)}")
        return ["Unable to generate specific recommendations"]

def store_video_analysis(user_id: str, video_id: str, analysis_data: Dict[str, Any]):
    """
    Store video analysis results
    """
    try:
        table = dynamodb.Table(VIDEO_ENGAGEMENT_TABLE)
        
        # Convert float values to Decimal for DynamoDB
        def convert_floats(obj):
            if isinstance(obj, float):
                return Decimal(str(obj))
            elif isinstance(obj, dict):
                return {k: convert_floats(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_floats(v) for v in obj]
            return obj
        
        analysis_item = {
            'userId': user_id,
            'videoId': video_id,
            'engagementId': f"{user_id}#{video_id}#analysis#{datetime.now(timezone.utc).isoformat()}",
            'analysisType': 'video_intelligence',
            'analysisData': convert_floats(analysis_data),
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'ttl': int((datetime.now(timezone.utc).timestamp() + (90 * 24 * 60 * 60)))  # 90 days TTL
        }
        
        table.put_item(Item=analysis_item)
        logger.info(f"Stored video analysis for user: {user_id}, video: {video_id}")
        
    except Exception as e:
        logger.error(f"Error storing video analysis: {str(e)}")

def update_user_video_profile(user_id: str, metrics: Dict[str, Any], preferences: Dict[str, Any]):
    """
    Update user profile with video insights
    """
    try:
        table = dynamodb.Table(USER_PROFILES_TABLE)
        
        # Get current profile
        response = table.get_item(Key={'userId': user_id})
        
        if 'Item' in response:
            profile = response['Item']
        else:
            profile = {
                'userId': user_id,
                'createdAt': datetime.now(timezone.utc).isoformat()
            }
        
        # Update video-related metrics
        if 'behaviorMetrics' not in profile:
            profile['behaviorMetrics'] = {}
        
        profile['behaviorMetrics']['videoEngagementScore'] = metrics.get('averageEngagementScore', 0)
        profile['behaviorMetrics']['videoCompletionRate'] = metrics.get('completionRateOverall', 0)
        profile['behaviorMetrics']['totalVideoWatchTime'] = metrics.get('totalWatchTime', 0)
        
        # Add video preferences
        profile['videoPreferences'] = preferences
        profile['updatedAt'] = datetime.now(timezone.utc).isoformat()
        
        table.put_item(Item=profile)
        logger.info(f"Updated video profile for user: {user_id}")
        
    except Exception as e:
        logger.error(f"Error updating user video profile: {str(e)}")