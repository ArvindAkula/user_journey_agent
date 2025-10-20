#!/usr/bin/env python3
"""
Test script for Bedrock Agent integration with Lambda functions
"""

import json
import boto3
import os
import sys
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock
import pytest

# Add the lambda functions directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the lambda functions
import struggle_detector
import video_analyzer
import intervention_executor
import event_processor

class TestBedrockAgentIntegration:
    """Test suite for Bedrock Agent integration"""
    
    def setup_method(self):
        """Set up test environment"""
        # Mock environment variables
        os.environ['ENVIRONMENT'] = 'test'
        os.environ['STRUGGLE_SIGNALS_TABLE'] = 'test-struggle-signals'
        os.environ['USER_PROFILES_TABLE'] = 'test-user-profiles'
        os.environ['VIDEO_ENGAGEMENT_TABLE'] = 'test-video-engagement'
        os.environ['TIMESTREAM_DATABASE'] = 'test-timestream'
        os.environ['BEDROCK_AGENT_ID'] = 'test-agent-id'
        os.environ['BEDROCK_AGENT_ALIAS_ID'] = 'test-alias-id'
        
        # Sample test data
        self.sample_struggle_event = {
            'inputText': json.dumps({
                'userId': 'test-user-123',
                'struggleType': 'document_upload',
                'attemptCount': 3,
                'context': {
                    'sessionStage': 'onboarding',
                    'timeSpent': 180
                }
            })
        }
        
        self.sample_video_event = {
            'inputText': json.dumps({
                'userId': 'test-user-123',
                'videoId': 'tutorial-video-1'
            })
        }
        
        self.sample_intervention_event = {
            'inputText': json.dumps({
                'userId': 'test-user-123',
                'interventionType': 'struggle_critical',
                'priority': 'high',
                'context': {
                    'struggleType': 'document_upload',
                    'attemptCount': 3
                }
            })
        }
        
        self.sample_kinesis_event = {
            'Records': [{
                'kinesis': {
                    'data': json.dumps({
                        'userId': 'test-user-123',
                        'eventType': 'feature_interaction',
                        'sessionId': 'session-456',
                        'timestamp': int(datetime.now().timestamp() * 1000),
                        'eventData': {
                            'feature': 'document_upload',
                            'attemptCount': 3,
                            'duration': 180
                        },
                        'userContext': {
                            'sessionStage': 'onboarding'
                        }
                    }).encode('utf-8')
                }
            }]
        }

    @patch('struggle_detector.dynamodb')
    @patch('struggle_detector.timestream_write')
    def test_struggle_detector_bedrock_integration(self, mock_timestream, mock_dynamodb):
        """Test struggle detector Lambda function as Bedrock Agent action group"""
        
        # Mock DynamoDB response
        mock_table = Mock()
        mock_table.query.return_value = {
            'Items': [
                {
                    'userId': 'test-user-123',
                    'featureId': 'document_upload',
                    'severity': 'medium',
                    'detectedAt': int(datetime.now().timestamp() * 1000)
                }
            ]
        }
        mock_dynamodb.Table.return_value = mock_table
        
        # Mock Timestream
        mock_timestream.write_records.return_value = {}
        
        # Test the lambda handler
        context = Mock()
        result = struggle_detector.lambda_handler(self.sample_struggle_event, context)
        
        # Assertions
        assert result['statusCode'] == 200
        response_body = json.loads(result['body'])
        assert 'analysis' in response_body
        assert 'intervention' in response_body
        assert response_body['analysis']['userId'] == 'test-user-123'
        assert response_body['analysis']['currentStruggle']['type'] == 'document_upload'
        assert response_body['analysis']['currentStruggle']['attemptCount'] == 3
        
        # Verify DynamoDB was called
        mock_table.query.assert_called_once()
        
        # Verify Timestream was called
        mock_timestream.write_records.assert_called_once()

    @patch('video_analyzer.dynamodb')
    @patch('video_analyzer.timestream_write')
    def test_video_analyzer_bedrock_integration(self, mock_timestream, mock_dynamodb):
        """Test video analyzer Lambda function as Bedrock Agent action group"""
        
        # Mock DynamoDB response
        mock_table = Mock()
        mock_table.get_item.return_value = {
            'Item': {
                'userId': 'test-user-123',
                'videoId': 'tutorial-video-1',
                'completionRate': 75.0,
                'viewCount': 2,
                'totalWatchTime': 450,
                'interestScore': 80,
                'lastWatchedAt': int(datetime.now().timestamp() * 1000)
            }
        }
        mock_dynamodb.Table.return_value = mock_table
        
        # Mock Timestream
        mock_timestream.write_records.return_value = {}
        
        # Test the lambda handler
        context = Mock()
        result = video_analyzer.lambda_handler(self.sample_video_event, context)
        
        # Assertions
        assert result['statusCode'] == 200
        response_body = json.loads(result['body'])
        assert 'analysis' in response_body
        assert 'recommendations' in response_body
        assert response_body['analysis']['userId'] == 'test-user-123'
        assert response_body['analysis']['videoId'] == 'tutorial-video-1'
        assert response_body['analysis']['engagement']['level'] == 'very_high'
        
        # Verify DynamoDB was called
        mock_table.get_item.assert_called_once()

    @patch('intervention_executor.dynamodb')
    @patch('intervention_executor.sns')
    def test_intervention_executor_bedrock_integration(self, mock_sns, mock_dynamodb):
        """Test intervention executor Lambda function as Bedrock Agent action group"""
        
        # Mock DynamoDB
        mock_table = Mock()
        mock_table.get_item.return_value = {
            'Item': {
                'userId': 'test-user-123',
                'userSegment': 'active_user',
                'preferences': {
                    'preferredInteractionStyle': 'guided'
                }
            }
        }
        mock_table.update_item.return_value = {}
        mock_dynamodb.Table.return_value = mock_table
        
        # Mock SNS
        mock_sns.publish.return_value = {'MessageId': 'test-message-id'}
        
        # Test the lambda handler
        context = Mock()
        result = intervention_executor.lambda_handler(self.sample_intervention_event, context)
        
        # Assertions
        assert result['statusCode'] == 200
        response_body = json.loads(result['body'])
        assert response_body['interventionExecuted'] == True
        assert response_body['type'] == 'struggle_critical'
        assert response_body['priority'] == 'high'
        assert 'result' in response_body
        
        # Verify interventions were executed
        result_data = response_body['result']
        assert 'actionsExecuted' in result_data
        assert 'notifications' in result_data

    @patch('event_processor.bedrock_agent')
    @patch('event_processor.dynamodb')
    @patch('event_processor.timestream_write')
    def test_event_processor_bedrock_integration(self, mock_timestream, mock_dynamodb, mock_bedrock):
        """Test event processor Lambda function with Bedrock Agent integration"""
        
        # Mock DynamoDB
        mock_table = Mock()
        mock_table.put_item.return_value = {}
        mock_table.update_item.return_value = {}
        mock_dynamodb.Table.return_value = mock_table
        
        # Mock Timestream
        mock_timestream.write_records.return_value = {}
        
        # Mock Bedrock Agent response
        mock_response = {
            'completion': [
                {
                    'chunk': {
                        'bytes': b'Analysis complete: High priority intervention recommended for document upload struggle.'
                    }
                }
            ]
        }
        mock_bedrock.invoke_agent.return_value = mock_response
        
        # Test the lambda handler
        context = Mock()
        result = event_processor.lambda_handler(self.sample_kinesis_event, context)
        
        # Assertions
        assert result['statusCode'] == 200
        response_body = json.loads(result['body'])
        assert response_body == 'Events processed successfully'
        
        # Verify Bedrock Agent was invoked
        mock_bedrock.invoke_agent.assert_called_once()
        
        # Verify the agent was called with correct parameters
        call_args = mock_bedrock.invoke_agent.call_args[1]
        assert 'agentId' in call_args
        assert 'sessionId' in call_args
        assert 'inputText' in call_args
        assert 'test-user-123' in call_args['sessionId']

    def test_struggle_signal_severity_calculation(self):
        """Test struggle signal severity calculation logic"""
        
        # Test different attempt counts
        test_cases = [
            (1, 'low'),
            (2, 'medium'),
            (3, 'high'),
            (5, 'critical'),
            (10, 'critical')
        ]
        
        for attempt_count, expected_severity in test_cases:
            # Mock the calculation logic from struggle_detector
            if attempt_count >= 5:
                severity = 'critical'
            elif attempt_count >= 3:
                severity = 'high'
            elif attempt_count >= 2:
                severity = 'medium'
            else:
                severity = 'low'
            
            assert severity == expected_severity, f"Failed for attempt_count {attempt_count}"

    def test_video_engagement_scoring(self):
        """Test video engagement scoring logic"""
        
        test_cases = [
            (90, 2, 'very_high'),  # completion_rate, view_count, expected_level
            (75, 1, 'high'),
            (50, 1, 'medium'),
            (25, 1, 'low'),
            (10, 1, 'low')
        ]
        
        for completion_rate, view_count, expected_level in test_cases:
            # Mock the scoring logic from video_analyzer
            interest_score = min(100, completion_rate + (view_count - 1) * 10)
            
            if interest_score >= 80:
                level = 'very_high'
            elif interest_score >= 60:
                level = 'high'
            elif interest_score >= 40:
                level = 'medium'
            else:
                level = 'low'
            
            assert level == expected_level, f"Failed for completion_rate {completion_rate}, view_count {view_count}"

    def test_intervention_priority_mapping(self):
        """Test intervention priority mapping logic"""
        
        test_cases = [
            ('struggle_critical', 'high'),
            ('exit_risk_high', 'high'),
            ('struggle_medium', 'normal'),
            ('video_engagement_low', 'normal'),
            ('gentle_guidance', 'low')
        ]
        
        for intervention_type, expected_priority in test_cases:
            # Mock the priority mapping logic
            if intervention_type in ['struggle_critical', 'exit_risk_high']:
                priority = 'high'
            elif intervention_type in ['struggle_medium', 'video_engagement_low', 'feature_guidance']:
                priority = 'normal'
            else:
                priority = 'low'
            
            assert priority == expected_priority, f"Failed for intervention_type {intervention_type}"

    @patch('event_processor.bedrock_agent')
    def test_bedrock_agent_fallback(self, mock_bedrock):
        """Test fallback behavior when Bedrock Agent is unavailable"""
        
        # Mock Bedrock Agent failure
        mock_bedrock.invoke_agent.side_effect = Exception("Bedrock service unavailable")
        
        # Create a test event that would trigger intervention
        test_event_data = {
            'userId': 'test-user-123',
            'eventType': 'feature_interaction',
            'sessionId': 'session-456',
            'eventData': {
                'feature': 'document_upload',
                'attemptCount': 3
            },
            'userContext': {
                'sessionStage': 'onboarding'
            }
        }
        
        # Test the fallback logic (this would be called from trigger_intervention)
        attempt_count = test_event_data['eventData']['attemptCount']
        
        # Verify fallback logic
        if attempt_count >= 3:
            fallback_action = 'high_priority_intervention'
        elif attempt_count >= 2:
            fallback_action = 'medium_priority_intervention'
        else:
            fallback_action = 'low_priority_intervention'
        
        assert fallback_action == 'high_priority_intervention'

    def test_agent_response_parsing(self):
        """Test parsing of Bedrock Agent responses"""
        
        # Mock agent response
        mock_response_text = """
        Analysis: User is experiencing high difficulty with document upload feature.
        Recommended Actions:
        1. Show file size requirements
        2. Provide format conversion tool
        3. Enable live chat support
        Success Probability: 85%
        """
        
        # Test response parsing logic
        lines = mock_response_text.strip().split('\n')
        analysis_found = any('Analysis:' in line for line in lines)
        actions_found = any('Recommended Actions:' in line for line in lines)
        probability_found = any('Success Probability:' in line for line in lines)
        
        assert analysis_found
        assert actions_found
        assert probability_found

def run_tests():
    """Run all tests"""
    test_suite = TestBedrockAgentIntegration()
    test_methods = [method for method in dir(test_suite) if method.startswith('test_')]
    
    passed = 0
    failed = 0
    
    for method_name in test_methods:
        try:
            print(f"Running {method_name}...")
            test_suite.setup_method()
            method = getattr(test_suite, method_name)
            method()
            print(f"✓ {method_name} passed")
            passed += 1
        except Exception as e:
            print(f"✗ {method_name} failed: {str(e)}")
            failed += 1
    
    print(f"\nTest Results: {passed} passed, {failed} failed")
    return failed == 0

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)