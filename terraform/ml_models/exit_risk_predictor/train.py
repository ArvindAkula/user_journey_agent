import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
import os
import argparse

def load_training_data(data_path):
    """
    Load and prepare training data
    """
    # In a real implementation, this would load data from S3 or DynamoDB
    # For now, we'll generate synthetic training data
    
    np.random.seed(42)
    n_samples = 1000
    
    # Generate synthetic features based on user behavior patterns
    data = {
        'error_count': np.random.poisson(2, n_samples),
        'retry_count': np.random.poisson(1, n_samples),
        'help_requests': np.random.poisson(0.5, n_samples),
        'session_duration': np.random.exponential(300, n_samples),
        'page_exits': np.random.poisson(1, n_samples),
        'form_abandons': np.random.poisson(0.3, n_samples),
        'click_frustration': np.random.poisson(3, n_samples),
        'success_rate': np.random.beta(2, 2, n_samples),
        'engagement_score': np.random.normal(50, 20, n_samples),
        'time_since_last_success': np.random.exponential(60, n_samples),
        'session_count': np.random.poisson(3, n_samples),
        'unique_pages_visited': np.random.poisson(5, n_samples),
        'average_time_per_page': np.random.exponential(45, n_samples)
    }
    
    df = pd.DataFrame(data)
    
    # Clip values to reasonable ranges
    df['engagement_score'] = np.clip(df['engagement_score'], 0, 100)
    df['success_rate'] = np.clip(df['success_rate'], 0, 1)
    
    # Generate target variable based on logical rules
    # Higher risk if: more errors, low success rate, high frustration, etc.
    risk_score = (
        df['error_count'] * 0.2 +
        df['retry_count'] * 0.15 +
        df['help_requests'] * 0.3 +
        df['form_abandons'] * 0.25 +
        df['click_frustration'] * 0.1 +
        (1 - df['success_rate']) * 0.4 +
        (100 - df['engagement_score']) / 100 * 0.3
    )
    
    # Convert to binary classification (exit risk: 0 = low, 1 = high)
    threshold = np.percentile(risk_score, 70)  # Top 30% are high risk
    df['exit_risk'] = (risk_score > threshold).astype(int)
    
    return df

def train_model(df):
    """
    Train the exit risk prediction model
    """
    # Prepare features and target
    feature_columns = [
        'error_count', 'retry_count', 'help_requests', 'session_duration',
        'page_exits', 'form_abandons', 'click_frustration', 'success_rate',
        'engagement_score', 'time_since_last_success', 'session_count',
        'unique_pages_visited', 'average_time_per_page'
    ]
    
    X = df[feature_columns]
    y = df['exit_risk']
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Train Random Forest model
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        class_weight='balanced'  # Handle class imbalance
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate model
    train_score = model.score(X_train, y_train)
    test_score = model.score(X_test, y_test)
    
    # Cross-validation
    cv_scores = cross_val_score(model, X_train, y_train, cv=5)
    
    # Predictions for detailed evaluation
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    
    # Calculate metrics
    auc_score = roc_auc_score(y_test, y_pred_proba)
    
    print("Model Performance:")
    print(f"Training Accuracy: {train_score:.4f}")
    print(f"Test Accuracy: {test_score:.4f}")
    print(f"Cross-validation Score: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")
    print(f"AUC Score: {auc_score:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    
    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': feature_columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print("\nFeature Importance:")
    print(feature_importance)
    
    return model, {
        'train_accuracy': train_score,
        'test_accuracy': test_score,
        'cv_score_mean': cv_scores.mean(),
        'cv_score_std': cv_scores.std(),
        'auc_score': auc_score,
        'feature_importance': feature_importance.to_dict('records')
    }

def save_model(model, model_dir):
    """
    Save the trained model
    """
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, 'exit_risk_model.pkl')
    joblib.dump(model, model_path)
    print(f"Model saved to: {model_path}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-dir', type=str, default='/opt/ml/model')
    parser.add_argument('--data-dir', type=str, default='/opt/ml/input/data')
    parser.add_argument('--output-dir', type=str, default='/opt/ml/output')
    
    args = parser.parse_args()
    
    print("Starting model training...")
    
    # Load training data
    print("Loading training data...")
    df = load_training_data(args.data_dir)
    print(f"Loaded {len(df)} training samples")
    
    # Train model
    print("Training model...")
    model, metrics = train_model(df)
    
    # Save model
    print("Saving model...")
    save_model(model, args.model_dir)
    
    # Save metrics
    metrics_path = os.path.join(args.output_dir, 'metrics.json')
    os.makedirs(args.output_dir, exist_ok=True)
    with open(metrics_path, 'w') as f:
        json.dump(metrics, f, indent=2, default=str)
    
    print("Training completed successfully!")

if __name__ == "__main__":
    main()