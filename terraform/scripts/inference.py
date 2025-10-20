#!/usr/bin/env python3
"""
SageMaker inference script for exit risk prediction model
"""

import os
import json
import joblib
import numpy as np
import pandas as pd

def model_fn(model_dir):
    """Load model for inference"""
    model = joblib.load(os.path.join(model_dir, "model.joblib"))
    
    # Load feature names
    with open(os.path.join(model_dir, "feature_names.json"), 'r') as f:
        feature_names = json.load(f)
    
    return {
        'model': model,
        'feature_names': feature_names
    }

def input_fn(request_body, content_type='application/json'):
    """Parse input data for inference"""
    if content_type == 'application/json':
        input_data = json.loads(request_body)
        
        # Handle both single instance and batch predictions
        if 'instances' in input_data:
            # Batch prediction format
            instances = input_data['instances']
        else:
            # Single instance format
            instances = [input_data]
        
        return pd.DataFrame(instances)
    
    elif content_type == 'text/csv':
        # Handle CSV input
        from io import StringIO
        return pd.read_csv(StringIO(request_body))
    
    else:
        raise ValueError(f"Unsupported content type: {content_type}")

def predict_fn(input_data, model_artifacts):
    """Make predictions"""
    model = model_artifacts['model']
    feature_names = model_artifacts['feature_names']
    
    # Ensure input data has the correct features
    if isinstance(input_data, pd.DataFrame):
        # Reorder columns to match training data
        input_data = input_data[feature_names]
    else:
        # Convert to DataFrame if needed
        input_data = pd.DataFrame(input_data, columns=feature_names)
    
    # Make predictions
    predictions = model.predict_proba(input_data)
    risk_scores = predictions[:, 1]  # Probability of positive class (exit risk)
    
    # Categorize risk levels
    risk_levels = []
    for score in risk_scores:
        if score < 0.3:
            risk_levels.append('LOW')
        elif score < 0.6:
            risk_levels.append('MEDIUM')
        else:
            risk_levels.append('HIGH')
    
    return {
        'risk_scores': risk_scores.tolist(),
        'risk_levels': risk_levels,
        'feature_importance': dict(zip(feature_names, model.feature_importances_.tolist()))
    }

def output_fn(prediction, accept='application/json'):
    """Format prediction output"""
    if accept == 'application/json':
        return json.dumps(prediction)
    else:
        raise ValueError(f"Unsupported accept type: {accept}")