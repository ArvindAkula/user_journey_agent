#!/usr/bin/env python3
"""
SageMaker model training script for exit risk prediction
"""

import boto3
import pandas as pd
import numpy as np
import json
import os
import argparse
from datetime import datetime, timedelta
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.preprocessing import StandardScaler
import joblib
import sagemaker
from sagemaker.sklearn.estimator import SKLearn
from sagemaker.sklearn.model import SKLearnModel

class ExitRiskModelTrainer:
    def __init__(self, region='us-east-1'):
        self.region = region
        self.sagemaker_session = sagemaker.Session()
        self.role = sagemaker.get_execution_role()
        self.bucket = self.sagemaker_session.default_bucket()
        
        # Feature names matching the Java model
        self.feature_names = [
            'struggle_signal_count_7d',
            'video_engagement_score',
            'feature_completion_rate',
            'session_frequency_trend',
            'support_interaction_count',
            'days_since_last_login',
            'application_progress_percentage',
            'avg_session_duration',
            'total_sessions',
            'error_rate',
            'help_seeking_behavior',
            'content_engagement_score',
            'platform_usage_pattern'
        ]
    
    def generate_synthetic_training_data(self, num_samples=10000):
        """
        Generate synthetic training data for demonstration purposes
        In production, this would load real historical data
        """
        print(f"Generating {num_samples} synthetic training samples...")
        
        np.random.seed(42)
        data = []
        
        for i in range(num_samples):
            # Generate realistic feature values
            struggle_signals = np.random.poisson(2)  # Average 2 struggle signals per week
            video_engagement = np.random.beta(2, 2) * 100  # Beta distribution for engagement
            feature_completion = np.random.beta(3, 1) * 100  # Higher completion rates
            session_trend = np.random.normal(0, 1)  # Session frequency trend
            support_interactions = np.random.poisson(0.5)  # Low support interaction rate
            days_since_login = np.random.exponential(2)  # Exponential distribution for recency
            app_progress = np.random.beta(2, 1) * 100  # Progress through application
            avg_session_duration = np.random.lognormal(5, 1)  # Log-normal for session duration
            total_sessions = np.random.poisson(8)  # Average sessions
            error_rate = np.random.beta(1, 4) * 100  # Low error rates typically
            help_seeking = np.random.beta(1, 3) * 100  # Occasional help seeking
            content_engagement = np.random.beta(2, 1) * 100  # Good content engagement
            platform_pattern = np.random.choice([1, 2, 3])  # Web, mobile, mixed
            
            # Calculate exit probability based on features (realistic relationships)
            exit_prob = 0.1  # Base probability
            
            # Risk factors that increase exit probability
            exit_prob += struggle_signals * 0.05  # More struggles = higher risk
            exit_prob += max(0, days_since_login - 3) * 0.02  # Inactivity increases risk
            exit_prob += max(0, 20 - video_engagement) * 0.01  # Low engagement increases risk
            exit_prob += max(0, 50 - feature_completion) * 0.008  # Low completion increases risk
            exit_prob += error_rate * 0.005  # Errors increase risk
            
            # Protective factors that decrease exit probability
            exit_prob -= min(app_progress, 80) * 0.003  # Progress reduces risk
            exit_prob -= min(content_engagement, 80) * 0.002  # Engagement reduces risk
            exit_prob -= min(total_sessions, 10) * 0.01  # More sessions reduce risk
            
            # Ensure probability is within bounds
            exit_prob = max(0.01, min(0.95, exit_prob))
            
            # Generate binary outcome
            exited = np.random.random() < exit_prob
            
            sample = [
                struggle_signals,
                video_engagement,
                feature_completion,
                session_trend,
                support_interactions,
                days_since_login,
                app_progress,
                avg_session_duration,
                total_sessions,
                error_rate,
                help_seeking,
                content_engagement,
                platform_pattern,
                int(exited)
            ]
            
            data.append(sample)
        
        # Create DataFrame
        columns = self.feature_names + ['target']
        df = pd.DataFrame(data, columns=columns)
        
        print(f"Generated dataset shape: {df.shape}")
        print(f"Exit rate: {df['target'].mean():.3f}")
        
        return df
    
    def prepare_training_data(self, df):
        """
        Prepare data for training
        """
        print("Preparing training data...")
        
        # Separate features and target
        X = df[self.feature_names].copy()
        y = df['target'].copy()
        
        # Handle missing values
        X = X.fillna(X.median())
        
        # Feature scaling
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        X_scaled = pd.DataFrame(X_scaled, columns=self.feature_names)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42, stratify=y
        )
        
        print(f"Training set size: {X_train.shape[0]}")
        print(f"Test set size: {X_test.shape[0]}")
        
        return X_train, X_test, y_train, y_test, scaler
    
    def train_model(self, X_train, y_train):
        """
        Train the exit risk prediction model
        """
        print("Training Random Forest model...")
        
        # Configure model with good defaults for exit risk prediction
        model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            class_weight='balanced'  # Handle class imbalance
        )
        
        # Train model
        model.fit(X_train, y_train)
        
        print("Model training completed")
        return model
    
    def evaluate_model(self, model, X_test, y_test):
        """
        Evaluate model performance
        """
        print("Evaluating model performance...")
        
        # Make predictions
        y_pred = model.predict(X_test)
        y_pred_proba = model.predict_proba(X_test)[:, 1]
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred)
        recall = recall_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)
        auc = roc_auc_score(y_test, y_pred_proba)
        
        metrics = {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1,
            'auc_roc': auc
        }
        
        print("Model Performance Metrics:")
        for metric, value in metrics.items():
            print(f"  {metric}: {value:.4f}")
        
        # Feature importance
        feature_importance = pd.DataFrame({
            'feature': self.feature_names,
            'importance': model.feature_importances_
        }).sort_values('importance', ascending=False)
        
        print("\nTop 5 Most Important Features:")
        for _, row in feature_importance.head().iterrows():
            print(f"  {row['feature']}: {row['importance']:.4f}")
        
        return metrics, feature_importance
    
    def save_model_artifacts(self, model, scaler, metrics, feature_importance):
        """
        Save model artifacts for deployment
        """
        print("Saving model artifacts...")
        
        # Create model directory
        model_dir = 'model_artifacts'
        os.makedirs(model_dir, exist_ok=True)
        
        # Save model
        joblib.dump(model, f'{model_dir}/model.pkl')
        
        # Save scaler
        joblib.dump(scaler, f'{model_dir}/scaler.pkl')
        
        # Save feature names
        with open(f'{model_dir}/feature_names.json', 'w') as f:
            json.dump(self.feature_names, f)
        
        # Save metrics
        with open(f'{model_dir}/metrics.json', 'w') as f:
            json.dump(metrics, f, indent=2)
        
        # Save feature importance
        feature_importance.to_csv(f'{model_dir}/feature_importance.csv', index=False)
        
        # Create inference script
        self.create_inference_script(model_dir)
        
        print(f"Model artifacts saved to {model_dir}/")
        return model_dir
    
    def create_inference_script(self, model_dir):
        """
        Create inference script for SageMaker deployment
        """
        inference_script = '''
import joblib
import json
import numpy as np
import os

def model_fn(model_dir):
    """Load model artifacts"""
    model = joblib.load(os.path.join(model_dir, 'model.pkl'))
    scaler = joblib.load(os.path.join(model_dir, 'scaler.pkl'))
    
    with open(os.path.join(model_dir, 'feature_names.json'), 'r') as f:
        feature_names = json.load(f)
    
    return {
        'model': model,
        'scaler': scaler,
        'feature_names': feature_names
    }

def input_fn(request_body, request_content_type):
    """Parse input data"""
    if request_content_type == 'application/json':
        input_data = json.loads(request_body)
        
        if 'instances' in input_data:
            # Handle batch prediction format
            instances = input_data['instances']
            return np.array(instances)
        else:
            # Handle single instance
            return np.array([input_data])
    else:
        raise ValueError(f"Unsupported content type: {request_content_type}")

def predict_fn(input_data, model_artifacts):
    """Make predictions"""
    model = model_artifacts['model']
    scaler = model_artifacts['scaler']
    
    # Scale input data
    input_scaled = scaler.transform(input_data)
    
    # Make predictions
    predictions = model.predict_proba(input_scaled)[:, 1]  # Probability of exit
    
    return predictions.tolist()

def output_fn(prediction, content_type):
    """Format output"""
    if content_type == 'application/json':
        return json.dumps({
            'predictions': prediction
        })
    else:
        raise ValueError(f"Unsupported content type: {content_type}")
'''
        
        with open(f'{model_dir}/inference.py', 'w') as f:
            f.write(inference_script)
    
    def deploy_to_sagemaker(self, model_dir, endpoint_name='exit-risk-predictor'):
        """
        Deploy model to SageMaker endpoint
        """
        print(f"Deploying model to SageMaker endpoint: {endpoint_name}")
        
        # Upload model artifacts to S3
        model_artifacts = self.sagemaker_session.upload_data(
            path=model_dir,
            bucket=self.bucket,
            key_prefix='exit-risk-model'
        )
        
        print(f"Model artifacts uploaded to: {model_artifacts}")
        
        # Create SageMaker model
        sklearn_model = SKLearnModel(
            model_data=model_artifacts,
            role=self.role,
            entry_point='inference.py',
            framework_version='1.0-1',
            py_version='py3'
        )
        
        # Deploy model
        try:
            predictor = sklearn_model.deploy(
                initial_instance_count=1,
                instance_type='ml.t2.medium',
                endpoint_name=endpoint_name
            )
            
            print(f"Model deployed successfully to endpoint: {endpoint_name}")
            
            # Test the endpoint
            self.test_endpoint(predictor)
            
            return predictor
            
        except Exception as e:
            print(f"Deployment failed: {str(e)}")
            raise
    
    def test_endpoint(self, predictor):
        """
        Test the deployed endpoint
        """
        print("Testing deployed endpoint...")
        
        # Create test data
        test_features = [
            [2, 65.0, 80.0, 0.5, 1, 2, 75.0, 300.0, 5, 10.0, 15.0, 70.0, 3]  # Medium risk
        ]
        
        try:
            # Make prediction
            result = predictor.predict(test_features)
            print(f"Test prediction result: {result}")
            
            # Validate result format
            if isinstance(result, dict) and 'predictions' in result:
                risk_score = result['predictions'][0] * 100
                print(f"Exit risk score: {risk_score:.2f}%")
            else:
                print("Warning: Unexpected result format")
                
        except Exception as e:
            print(f"Endpoint test failed: {str(e)}")
            raise
    
    def run_full_pipeline(self, num_samples=10000, endpoint_name='exit-risk-predictor'):
        """
        Run the complete training and deployment pipeline
        """
        print("Starting exit risk model training pipeline...")
        
        # Generate training data
        df = self.generate_synthetic_training_data(num_samples)
        
        # Prepare data
        X_train, X_test, y_train, y_test, scaler = self.prepare_training_data(df)
        
        # Train model
        model = self.train_model(X_train, y_train)
        
        # Evaluate model
        metrics, feature_importance = self.evaluate_model(model, X_test, y_test)
        
        # Save artifacts
        model_dir = self.save_model_artifacts(model, scaler, metrics, feature_importance)
        
        # Deploy to SageMaker
        predictor = self.deploy_to_sagemaker(model_dir, endpoint_name)
        
        print("Pipeline completed successfully!")
        return predictor, metrics

def main():
    parser = argparse.ArgumentParser(description='Train and deploy exit risk prediction model')
    parser.add_argument('--samples', type=int, default=10000, help='Number of training samples')
    parser.add_argument('--endpoint', type=str, default='exit-risk-predictor', help='SageMaker endpoint name')
    parser.add_argument('--region', type=str, default='us-east-1', help='AWS region')
    
    args = parser.parse_args()
    
    # Initialize trainer
    trainer = ExitRiskModelTrainer(region=args.region)
    
    # Run pipeline
    try:
        predictor, metrics = trainer.run_full_pipeline(
            num_samples=args.samples,
            endpoint_name=args.endpoint
        )
        
        print(f"\\nModel successfully deployed!")
        print(f"Endpoint name: {args.endpoint}")
        print(f"Model accuracy: {metrics['accuracy']:.4f}")
        print(f"Model AUC-ROC: {metrics['auc_roc']:.4f}")
        
    except Exception as e:
        print(f"Pipeline failed: {str(e)}")
        return 1
    
    return 0

if __name__ == '__main__':
    exit(main())