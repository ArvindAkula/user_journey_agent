import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import os

def model_fn(model_dir):
    """
    Load the model for inference
    """
    model_path = os.path.join(model_dir, 'exit_risk_model.pkl')
    model = joblib.load(model_path)
    return model

def input_fn(request_body, request_content_type):
    """
    Parse input data for inference
    """
    if request_content_type == 'application/json':
        input_data = json.loads(request_body)
        
        # Handle both single instance and batch predictions
        if 'instances' in input_data:
            # Batch prediction format
            instances = input_data['instances']
        else:
            # Single instance format
            instances = [input_data]
        
        # Convert to DataFrame for consistent processing
        df = pd.DataFrame(instances)
        
        # Ensure all required features are present
        required_features = [
            'error_count', 'retry_count', 'help_requests', 'session_duration',
            'page_exits', 'form_abandons', 'click_frustration', 'success_rate',
            'engagement_score', 'time_since_last_success', 'session_count',
            'unique_pages_visited', 'average_time_per_page'
        ]
        
        # Fill missing features with defaults
        for feature in required_features:
            if feature not in df.columns:
                df[feature] = 0.0
        
        # Reorder columns to match training data
        df = df[required_features]
        
        return df.values
    
    else:
        raise ValueError(f"Unsupported content type: {request_content_type}")

def predict_fn(input_data, model):
    """
    Make predictions using the loaded model
    """
    try:
        # Get prediction probabilities
        probabilities = model.predict_proba(input_data)
        
        # Get binary predictions
        predictions = model.predict(input_data)
        
        # Return both probabilities and predictions
        results = []
        for i, (pred, prob) in enumerate(zip(predictions, probabilities)):
            results.append({
                'prediction': int(pred),
                'probability': float(prob[1]),  # Probability of exit risk (class 1)
                'confidence': float(max(prob)),  # Confidence in prediction
                'risk_score': float(prob[1] * 100)  # Risk score as percentage
            })
        
        return results
    
    except Exception as e:
        return {'error': str(e)}

def output_fn(prediction, content_type):
    """
    Format the prediction output
    """
    if content_type == 'application/json':
        return json.dumps({
            'predictions': prediction,
            'model_version': '1.0',
            'timestamp': pd.Timestamp.now().isoformat()
        })
    else:
        raise ValueError(f"Unsupported content type: {content_type}")

# For local testing
if __name__ == "__main__":
    # Test the inference pipeline
    test_data = {
        'instances': [
            {
                'error_count': 3,
                'retry_count': 2,
                'help_requests': 1,
                'session_duration': 300,
                'page_exits': 2,
                'form_abandons': 1,
                'click_frustration': 5,
                'success_rate': 0.3,
                'engagement_score': 25,
                'time_since_last_success': 120,
                'session_count': 2,
                'unique_pages_visited': 5,
                'average_time_per_page': 60
            }
        ]
    }
    
    print("Test data:", json.dumps(test_data, indent=2))
    
    # This would normally load a real model
    # For testing, we'll create a dummy model
    from sklearn.ensemble import RandomForestClassifier
    import numpy as np
    
    # Create dummy training data
    X_dummy = np.random.rand(100, 13)
    y_dummy = np.random.randint(0, 2, 100)
    
    # Train dummy model
    dummy_model = RandomForestClassifier(n_estimators=10, random_state=42)
    dummy_model.fit(X_dummy, y_dummy)
    
    # Test inference
    input_data = input_fn(json.dumps(test_data), 'application/json')
    predictions = predict_fn(input_data, dummy_model)
    output = output_fn(predictions, 'application/json')
    
    print("Predictions:", output)