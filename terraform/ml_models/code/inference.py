import json
import logging

logger = logging.getLogger(__name__)

def model_fn(model_dir):
    """Load model - required by PyTorch container"""
    return {"type": "exit_risk", "version": "1.0"}

def input_fn(request_body, request_content_type):
    """Deserialize input data"""
    if request_content_type == 'application/json':
        return json.loads(request_body)
    raise ValueError(f"Unsupported content type: {request_content_type}")

def predict_fn(input_data, model):
    """Make prediction"""
    user_id = input_data.get('user_id', 'unknown')
    features = input_data.get('features', {})
    
    session_duration = features.get('session_duration', 300)
    page_views = features.get('page_views', 5)
    bounce_rate = features.get('bounce_rate', 0.3)
    
    risk_score = min(1.0, max(0.0, 
        (bounce_rate * 0.4) + 
        (max(0, 600 - session_duration) / 600 * 0.3) + 
        (max(0, 10 - page_views) / 10 * 0.3)
    ))
    
    return {
        'user_id': user_id,
        'exit_risk_score': round(risk_score, 3),
        'risk_level': 'high' if risk_score > 0.7 else 'medium' if risk_score > 0.4 else 'low',
        'confidence': 0.85,
        'model_version': '1.0'
    }

def output_fn(prediction, content_type):
    """Serialize output"""
    if content_type == 'application/json':
        return json.dumps(prediction)
    raise ValueError(f"Unsupported content type: {content_type}")
