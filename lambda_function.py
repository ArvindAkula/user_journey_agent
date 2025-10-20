import json
import boto3
import base64
from datetime import datetime
from decimal import Decimal

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
bedrock_runtime = boto3.client('bedrock-runtime', region_name='us-east-1')

# DynamoDB tables
events_table = dynamodb.Table('user-journey-analytics-user-events')
analytics_table = dynamodb.Table('user-journey-analytics-struggle-signals')

def lambda_handler(event, context):
    """
    Process events from Kinesis stream and analyze with Bedrock
    """
    print(f"Received {len(event['Records'])} records from Kinesis")
    
    processed_count = 0
    analyzed_count = 0
    
    for record in event['Records']:
        try:
            # Decode Kinesis data
            payload = base64.b64decode(record['kinesis']['data']).decode('utf-8')
            event_data = json.loads(payload)
            
            print(f"Processing event: {event_data}")
            
            # Store event in DynamoDB
            store_event(event_data)
            processed_count += 1
            
            # Analyze user journey with Bedrock (every 5 events or on key events)
            if should_analyze(event_data):
                analyze_user_journey(event_data['userId'])
                analyzed_count += 1
                
        except Exception as e:
            print(f"Error processing record: {str(e)}")
            continue
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'processed': processed_count,
            'analyzed': analyzed_count
        })
    }

def store_event(event_data):
    """Store event in DynamoDB"""
    # Convert timestamp to number if it's a string
    timestamp = event_data.get('timestamp')
    if isinstance(timestamp, str):
        # Try to parse ISO format or use current time
        try:
            from datetime import datetime as dt
            timestamp = int(dt.fromisoformat(timestamp.replace('Z', '+00:00')).timestamp() * 1000)
        except:
            timestamp = int(datetime.now().timestamp() * 1000)
    elif not isinstance(timestamp, int):
        timestamp = int(datetime.now().timestamp() * 1000)
    
    # Generate eventId
    event_id = f"evt_{event_data['userId']}_{event_data['eventType']}_{timestamp}"
    
    # Get date partition
    date_partition = datetime.fromtimestamp(timestamp / 1000).strftime('%Y-%m-%d')
    
    item = {
        'userId': event_data['userId'],
        'timestamp': timestamp,
        'eventId': event_id,
        'eventType': event_data['eventType'],
        'sessionId': event_data.get('sessionId', 'unknown'),
        'datePartition': date_partition,
        'ttl': int(datetime.now().timestamp()) + (90 * 24 * 60 * 60)  # 90 days
    }
    
    # Add eventData if present
    if 'eventData' in event_data and event_data['eventData']:
        item['eventData'] = event_data['eventData']
    
    events_table.put_item(Item=item)
    print(f"Stored event for user {event_data['userId']}")

def should_analyze(event_data):
    """Determine if we should trigger AI analysis"""
    # Analyze on key events
    key_events = ['pricing_page_view', 'checkout_abandon', 'video_complete', 'form_error']
    
    if event_data['eventType'] in key_events:
        print(f"🤖 Triggering AI analysis for key event: {event_data['eventType']}")
        return True
    
    # Or analyze every 5th event (to reduce costs)
    # In production, you might want more sophisticated logic
    return False

def analyze_user_journey(user_id):
    """Analyze user journey using Bedrock"""
    try:
        # Get recent events for this user
        response = events_table.query(
            KeyConditionExpression='userId = :uid',
            ExpressionAttributeValues={':uid': user_id},
            ScanIndexForward=False,
            Limit=20
        )
        
        events = response.get('Items', [])
        if not events:
            print(f"No events found for user {user_id}")
            return
        
        # Prepare prompt for Bedrock
        events_summary = summarize_events(events)
        prompt = f"""Analyze this user journey and provide insights:

User ID: {user_id}
Recent Activity: {events_summary}

Provide a JSON response with:
1. engagement_level: "high", "medium", or "low"
2. exit_risk_score: number from 0-100
3. recommended_actions: array of 2-3 specific actions
4. key_insights: brief summary

Keep response concise and actionable."""

        # Call Bedrock
        bedrock_response = bedrock_runtime.converse(
            modelId='amazon.nova-micro-v1:0',
            messages=[
                {
                    'role': 'user',
                    'content': [{'text': prompt}]
                }
            ],
            inferenceConfig={
                'maxTokens': 400,
                'temperature': 0.7
            }
        )
        
        # Extract AI response
        ai_text = bedrock_response['output']['message']['content'][0]['text']
        print(f"Bedrock analysis: {ai_text}")
        
        # Try to parse JSON from response
        analysis = parse_ai_response(ai_text)
        
        # Store analytics
        store_analytics(user_id, analysis, events_summary)
        
        print(f"✅ Analyzed journey for user {user_id}")
        
    except Exception as e:
        print(f"Error analyzing user journey: {str(e)}")

def summarize_events(events):
    """Create a concise summary of user events"""
    event_counts = {}
    for event in events:
        event_type = event['eventType']
        event_counts[event_type] = event_counts.get(event_type, 0) + 1
    
    summary = []
    for event_type, count in event_counts.items():
        summary.append(f"{count} {event_type}")
    
    return ", ".join(summary)

def parse_ai_response(ai_text):
    """Extract structured data from AI response"""
    try:
        # Try to find JSON in the response
        start = ai_text.find('{')
        end = ai_text.rfind('}') + 1
        if start >= 0 and end > start:
            json_str = ai_text[start:end]
            return json.loads(json_str)
    except:
        pass
    
    # Fallback: extract key information with simple parsing
    analysis = {
        'engagement_level': 'medium',
        'exit_risk_score': 50,
        'recommended_actions': ['Review user behavior', 'Consider engagement campaign'],
        'key_insights': ai_text[:200]
    }
    
    # Try to extract exit risk score
    if 'exit risk' in ai_text.lower():
        import re
        match = re.search(r'(\d+)', ai_text[ai_text.lower().find('exit risk'):])
        if match:
            analysis['exit_risk_score'] = int(match.group(1))
    
    return analysis

def store_analytics(user_id, analysis, events_summary):
    """Store analytics results in DynamoDB (struggle-signals table)"""
    timestamp_ms = int(datetime.now().timestamp() * 1000)
    
    # Map engagement level to severity
    engagement_level = analysis.get('engagement_level', 'medium')
    severity_map = {'low': 'high', 'medium': 'medium', 'high': 'low'}
    severity = severity_map.get(engagement_level, 'medium')
    
    item = {
        'userId': user_id,
        'featureId': f'ai_analysis_{timestamp_ms}',
        'detectedAt': timestamp_ms,
        'severity': severity,
        'signalType': 'ai_journey_analysis',
        'description': analysis.get('key_insights', events_summary)[:500],
        'exitRiskScore': Decimal(str(analysis.get('exit_risk_score', 0))),
        'recommendedActions': analysis.get('recommended_actions', []),
        'eventsAnalyzed': events_summary,
        'ttl': int(datetime.now().timestamp()) + (90 * 24 * 60 * 60)
    }
    
    analytics_table.put_item(Item=item)
    print(f"Stored analytics for user {user_id} with exit risk: {item['exitRiskScore']}")
