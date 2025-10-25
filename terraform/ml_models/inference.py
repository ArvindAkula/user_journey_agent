#!/usr/bin/env python3
"""
Inference script for exit risk prediction.
Compatible with SageMaker scikit-learn container.
"""
import json
import os
import joblib

def model_fn(model_dir):
    """Load the model for inference - required by SageMaker"""
    try:
        # Load the model from model_dir
        model_path = os.path.join(model_dir, 'model.joblib')
        if os.path.exists(model_path):
            model = joblib.load(model_path)
        else:
            # Return a simple mock model if file doesn't exist
            model = {"model_type": "exit_risk_predictor", "version": "1.0"}
        return model
    except Exception as e:
        print(f"Error loading model: {str(e)}")
        # Return mock model on error
        return {"model_type": "exit_risk_predictor", "version": "1.0"}

def input_fn(request_body, content_type='application/json'):
    """Parse input data for inference - required by SageMaker"""
    if content_type == 'application/json':
        input_data = json.loads(request_body)
        return input_data
    else:
        raise ValueError(f"Unsupported content type: {content_type}")

def predict_fn(input_data, model):
    """Run inference on the input data - required by SageMaker"""
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
        'model_version': '1.0'
    }
    
    return prediction

def output_fn(prediction, accept='application/json'):
    """Format the prediction output - required by SageMaker"""
    if accept == 'application/json':
        return json.dumps(prediction), accept
    else:
        raise ValueError(f"Unsupported accept type: {accept}")
