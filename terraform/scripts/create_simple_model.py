#!/usr/bin/env python3
"""
Create a simple pre-trained model for SageMaker deployment
"""

import os
import sys
import pickle
import tarfile
import tempfile
import json
from pathlib import Path

# Simple model implementation without sklearn dependencies
class SimpleExitRiskPredictor:
    """
    Simple rule-based exit risk predictor
    """
    
    def __init__(self):
        self.feature_names = [
            'error_count', 'retry_count', 'help_requests', 'session_duration',
            'page_exits', 'form_abandons', 'click_frustration', 'success_rate',
            'engagement_score', 'time_since_last_success', 'session_count',
            'unique_pages_visited', 'average_time_per_page'
        ]
        
        # Simple weights for rule-based prediction
        self.weights = {
            'error_count': 0.2,
            'retry_count': 0.15,
            'help_requests': 0.3,
            'session_duration': -0.05,  # Longer sessions are better
            'page_exits': 0.1,
            'form_abandons': 0.25,
            'click_frustration': 0.15,
            'success_rate': -0.4,  # Higher success rate is better
            'engagement_score': -0.3,  # Higher engagement is better
            'time_since_last_success': 0.1,
            'session_count': -0.05,  # More sessions might indicate engagement
            'unique_pages_visited': -0.02,  # More exploration might be good
            'average_time_per_page': 0.02  # Too much time per page might indicate confusion
        }
        
        self.threshold = 0.6  # Risk threshold
    
    def predict_proba(self, X):
        """
        Predict probabilities for exit risk
        """
        if isinstance(X, list):
            X = [X] if not isinstance(X[0], list) else X
        
        probabilities = []
        
        for instance in X:
            # Calculate risk score
            risk_score = 0
            
            for i, feature_name in enumerate(self.feature_names):
                if i < len(instance):
                    value = instance[i]
                    weight = self.weights.get(feature_name, 0)
                    
                    # Normalize some features
                    if feature_name == 'success_rate':
                        value = max(0, min(1, value))  # Clamp to 0-1
                    elif feature_name == 'engagement_score':
                        value = max(0, min(100, value)) / 100  # Normalize to 0-1
                    elif feature_name in ['session_duration', 'time_since_last_success', 'average_time_per_page']:
                        value = min(value / 300, 2)  # Normalize time features
                    elif feature_name in ['error_count', 'retry_count', 'help_requests', 'page_exits', 'form_abandons', 'click_frustration']:
                        value = min(value / 10, 1)  # Normalize count features
                    
                    risk_score += value * weight
            
            # Convert to probability (sigmoid-like function)
            risk_prob = max(0, min(1, (risk_score + 1) / 2))
            
            probabilities.append([1 - risk_prob, risk_prob])
        
        return probabilities
    
    def predict(self, X):
        """
        Predict binary exit risk
        """
        probabilities = self.predict_proba(X)
        return [1 if prob[1] > self.threshold else 0 for prob in probabilities]

def create_simple_inference_script():
    """
    Create a simple inference script that doesn't require sklearn
    """
    
    inference_code = '''
import json
import pickle
import os

class SimpleExitRiskPredictor:
    """
    Simple rule-based exit risk predictor
    """
    
    def __init__(self):
        self.feature_names = [
            'error_count', 'retry_count', 'help_requests', 'session_duration',
            'page_exits', 'form_abandons', 'click_frustration', 'success_rate',
            'engagement_score', 'time_since_last_success', 'session_count',
            'unique_pages_visited', 'average_time_per_page'
        ]
        
        # Simple weights for rule-based prediction
        self.weights = {
            'error_count': 0.2,
            'retry_count': 0.15,
            'help_requests': 0.3,
            'session_duration': -0.05,
            'page_exits': 0.1,
            'form_abandons': 0.25,
            'click_frustration': 0.15,
            'success_rate': -0.4,
            'engagement_score': -0.3,
            'time_since_last_success': 0.1,
            'session_count': -0.05,
            'unique_pages_visited': -0.02,
            'average_time_per_page': 0.02
        }
        
        self.threshold = 0.6
    
    def predict_proba(self, X):
        if isinstance(X, list):
            X = [X] if not isinstance(X[0], list) else X
        
        probabilities = []
        
        for instance in X:
            risk_score = 0
            
            for i, feature_name in enumerate(self.feature_names):
                if i < len(instance):
                    value = instance[i]
                    weight = self.weights.get(feature_name, 0)
                    
                    if feature_name == 'success_rate':
                        value = max(0, min(1, value))
                    elif feature_name == 'engagement_score':
                        value = max(0, min(100, value)) / 100
                    elif feature_name in ['session_duration', 'time_since_last_success', 'average_time_per_page']:
                        value = min(value / 300, 2)
                    elif feature_name in ['error_count', 'retry_count', 'help_requests', 'page_exits', 'form_abandons', 'click_frustration']:
                        value = min(value / 10, 1)
                    
                    risk_score += value * weight
            
            risk_prob = max(0, min(1, (risk_score + 1) / 2))
            probabilities.append([1 - risk_prob, risk_prob])
        
        return probabilities
    
    def predict(self, X):
        probabilities = self.predict_proba(X)
        return [1 if prob[1] > self.threshold else 0 for prob in probabilities]

def model_fn(model_dir):
    """Load the model for inference"""
    model_path = os.path.join(model_dir, 'exit_risk_model.pkl')
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
    return model

def input_fn(request_body, request_content_type):
    """Parse input data for inference"""
    if request_content_type == 'application/json':
        input_data = json.loads(request_body)
        
        if 'instances' in input_data:
            instances = input_data['instances']
        else:
            instances = [input_data]
        
        # Convert to list of lists
        processed_instances = []
        required_features = [
            'error_count', 'retry_count', 'help_requests', 'session_duration',
            'page_exits', 'form_abandons', 'click_frustration', 'success_rate',
            'engagement_score', 'time_since_last_success', 'session_count',
            'unique_pages_visited', 'average_time_per_page'
        ]
        
        for instance in instances:
            feature_values = []
            for feature in required_features:
                feature_values.append(instance.get(feature, 0.0))
            processed_instances.append(feature_values)
        
        return processed_instances
    else:
        raise ValueError(f"Unsupported content type: {request_content_type}")

def predict_fn(input_data, model):
    """Make predictions using the loaded model"""
    try:
        probabilities = model.predict_proba(input_data)
        predictions = model.predict(input_data)
        
        results = []
        for i, (pred, prob) in enumerate(zip(predictions, probabilities)):
            results.append({
                'prediction': int(pred),
                'probability': float(prob[1]),
                'confidence': float(max(prob)),
                'risk_score': float(prob[1] * 100)
            })
        
        return results
    except Exception as e:
        return {'error': str(e)}

def output_fn(prediction, content_type):
    """Format the prediction output"""
    if content_type == 'application/json':
        return json.dumps({
            'predictions': prediction,
            'model_version': '1.0',
            'model_type': 'simple_rule_based'
        })
    else:
        raise ValueError(f"Unsupported content type: {content_type}")
'''
    
    return inference_code

def create_model_package():
    """Create the model package for SageMaker"""
    
    script_dir = Path(__file__).parent
    terraform_dir = script_dir.parent
    
    print("Creating simple ML model package...")
    
    # Create temporary directory for building
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # Create model
        model = SimpleExitRiskPredictor()
        
        # Save model
        model_path = temp_path / "exit_risk_model.pkl"
        with open(model_path, 'wb') as f:
            pickle.dump(model, f)
        
        # Create inference script
        inference_script = create_simple_inference_script()
        inference_path = temp_path / "inference.py"
        with open(inference_path, 'w') as f:
            f.write(inference_script)
        
        # Create model.tar.gz
        output_path = terraform_dir / "ml_models" / "exit_risk_predictor.tar.gz"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        print(f"Creating model package: {output_path}")
        
        with tarfile.open(output_path, "w:gz") as tar:
            tar.add(model_path, arcname="exit_risk_model.pkl")
            tar.add(inference_path, arcname="inference.py")
        
        print(f"Model package created successfully: {output_path}")
        print(f"Package size: {output_path.stat().st_size / 1024:.2f} KB")
        
        return output_path

def main():
    """Main function"""
    try:
        print("Starting simple ML model build process...")
        
        # Create model package
        package_path = create_model_package()
        
        print("Simple ML model build completed successfully!")
        print(f"Model package: {package_path}")
        
        # Test the model
        print("\\nTesting model...")
        model = SimpleExitRiskPredictor()
        
        test_data = [
            [3, 2, 1, 300, 2, 1, 5, 0.3, 25, 120, 2, 5, 60]  # High risk case
        ]
        
        probabilities = model.predict_proba(test_data)
        predictions = model.predict(test_data)
        
        print(f"Test prediction: {predictions[0]}")
        print(f"Test probability: {probabilities[0][1]:.3f}")
        print(f"Test risk score: {probabilities[0][1] * 100:.1f}%")
        
        return 0
        
    except Exception as e:
        print(f"Error building simple ML model: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())