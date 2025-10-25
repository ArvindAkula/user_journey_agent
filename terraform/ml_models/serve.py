#!/usr/bin/env python3
"""
Simple serving script for SageMaker using Flask.
"""
from flask import Flask, request, jsonify
import json

app = Flask(__name__)

@app.route('/ping', methods=['GET'])
def ping():
    """Health check endpoint"""
    return '', 200

@app.route('/invocations', methods=['POST'])
def invocations():
    """Inference endpoint"""
    try:
        # Get request data
        data = request.get_json(force=True)
        
        # Mock prediction logic
        user_id = data.get('user_id', 'unknown')
        features = data.get('features', {})
        
        session_duration = features.get('session_duration', 300)
        page_views = features.get('page_views', 5)
        bounce_rate = features.get('bounce_rate', 0.3)
        
        # Calculate risk score
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
        
        return jsonify(prediction), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
