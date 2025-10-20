#!/usr/bin/env python3
"""
Simple inference script for exit risk prediction.
This is a placeholder model that returns mock predictions.
"""
import json
import numpy as np
import sys
import traceback

def model_fn(model_dir):
    """Load the model for inference"""
    try:
        # For demo purposes, return a simple mock model
        return {"model_type": "exit_risk_predictor", "version": "1.0"}
    except Exception as e:
        print(f"Error loading model: {str(e)}")
        raise

def input_fn(request_body, content_type='application/json'):
    """Parse input data for inference"""
    try:
        if content_type == 'application/json':
            input_data = json.loads(request_body)
            return input_data
        else:
            raise ValueError(f"Unsupported content type: {content_type}")
    except Exception as e:
        print(f"Error parsing input: {str(e)}")
        raise

def predict_fn(input_data, model):
    """Run inference on the input data"""
    try:
        # Mock prediction logic
        user_id = input_data.get('user_id', 'unknown')
        features = input_data.get('features', {})
        
        # Simple mock logic based on features
        session_duration = features.get('session_duration', 300)  # seconds
        page_views = features.get('page_views', 5)
        bounce_rate = features.get('bounce_rate', 0.3)
        
        # Mock exit risk calculation
        risk_score = min(1.0, max(0.0, 
            (bounce_rate * 0.4) + 
            (max(0, 600 - session_duration) / 600 * 0.3) + 
            (max(0, 10 - page_views) / 10 * 0.3)
        ))
        
        prediction = {
            'user_id': user_id,
            'exit_risk_score': round(risk_score, 3),
            'risk_level': 'high' if risk_score > 0.7 else 'medium' if risk_score > 0.4 else 'low',
            'confidence': 0.85,
            'model_version': '1.0',
            'timestamp': input_data.get('timestamp', '2024-01-01T00:00:00Z')
        }
        
        return prediction
    except Exception as e:
        print(f"Error during prediction: {str(e)}")
        raise

def output_fn(prediction, accept='application/json'):
    """Format the prediction output"""
    try:
        if accept == 'application/json':
            return json.dumps(prediction), accept
        else:
            raise ValueError(f"Unsupported accept type: {accept}")
    except Exception as e:
        print(f"Error formatting output: {str(e)}")
        raise